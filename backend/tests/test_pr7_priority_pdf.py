"""PR #7: safe Unicode PDF and historical-deadline regression tests.

Run only on an isolated development/test environment:
    pytest -q backend/tests/test_pr7_priority_pdf.py
"""
import pymupdf
import unicodedata
import re


def normalized_pdf_text(document):
    text = "\n".join(page.get_text() for page in document)
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()
from workspace import core


def test_priority_pdf_unicode_and_validity():
    pdf_bytes = core.priority_report_pdf({
        "type": "deadline",
        "title": "Diffida: scadenza da verificare – € 1.700,61",
        "level": "high",
        "date": "2015-10-22",
        "status": "to_verify",
        "summary": "È necessario verificare la data di ricezione.",
        "details": ["Data estratta: 15/10/2015", "Non inferire una scadenza attuale."],
    })
    assert pdf_bytes.startswith(b"%PDF-")
    document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert document.page_count >= 1
    rendered_text = normalized_pdf_text(document)
    assert "Diffida" in rendered_text
    assert "verificare" in rendered_text
    assert "15/10/2015" in rendered_text
    document.close()


def test_priority_pdf_escapes_html_and_paginates():
    priority = {
        "type": "document",
        "title": "<script>alert('not executed')</script> & documento",
        "level": "medium",
        "filename": "Documento prova.pdf",
        "summary": ("Anomalia da verificare, senza conclusioni legali. " * 100),
        "details": ["<b>Non fidarsi dei dati estratti</b>"] * 20,
    }
    pdf = core.priority_report_pdf(priority)
    document = pymupdf.open(stream=pdf, filetype="pdf")
    text = normalized_pdf_text(document)
    assert document.page_count >= 2
    assert "alert(" in text
    assert "Non fidarsi dei dati estratti" in text
    document.close()


def test_historical_events_remain_non_operational():
    historical = {"source": "auto", "status": "detected",
                  "label": "Data Decadenza Beneficio Termine", "due_date": "2008-06-05"}
    assert core.is_historical_event(historical["label"])
    assert not core.show_operational_deadline(historical)
    # Legacy auto rows may appear "confirmed" because the old UI defaulted missing status.
    # Without confirmed_at this is NOT evidence of a human confirmation.
    assert not core.show_operational_deadline({**historical, "status": "confirmed"})
    assert core.is_legacy_historical_auto({**historical, "status": "confirmed"})
    # Explicit confirmation is preserved unless the owner excludes it.
    confirmed = {**historical, "status": "confirmed", "confirmed_at": "2026-11-01T00:00:00Z"}
    assert core.show_operational_deadline(confirmed)
    assert not core.show_operational_deadline({**confirmed, "operational_excluded": True})
    assert core.show_operational_deadline({**historical, "source": "manual"})
    assert not core.show_operational_deadline({**historical, "source": "manual", "operational_excluded": True})


def test_priority_pdf_metadata_does_not_overlap():
    """Regression for the overlapping labels observed in the Mac PDF export."""
    pdf = core.priority_report_pdf({
        "type": "document", "title": "Contratto sintetico", "level": "medium",
        "filename": "contratto-fittizio-a.pdf", "summary": "Documento inventato per Studio A.",
    })
    with pymupdf.open(stream=pdf, filetype="pdf") as document:
        page = document[0]
        text = normalized_pdf_text(document)
        assert "Medio" in text and "MEDIUM" not in text
        spans = [s for b in page.get_text("dict")["blocks"] for line in b.get("lines", []) for s in line["spans"]]
        for label, value in (("Tipo", "Documento"), ("Livello di attenzione", "Medio"),
                             ("Documento originale", "contratto-fittizio-a.pdf")):
            label_rect = page.search_for(label)[0]
            # A value follows its label vertically, with no intersecting text.
            values = [pymupdf.Rect(s["bbox"]) for s in spans
                      if unicodedata.normalize("NFKC", s["text"]) == value]
            value_rect = next(r for r in values if r.y0 >= label_rect.y1)
            assert value_rect.y0 - label_rect.y1 >= 0
            assert (label_rect & value_rect).is_empty
