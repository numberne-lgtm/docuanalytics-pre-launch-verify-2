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
    text = "\n".join(page.get_text() for page in document)
    assert document.page_count >= 2
    assert "alert(" in text
    assert "Non fidarsi dei dati estratti" in text, (
        "PDF tail: " + repr(text[-2000:]) + " | pages=" + str(document.page_count)
    )
    document.close()


def test_historical_events_remain_non_operational():
    historical = {"source": "auto", "status": "detected",
                  "label": "Data Decadenza Beneficio Termine", "due_date": "2008-06-05"}
    assert core.is_historical_event(historical["label"])
    assert not core.show_operational_deadline(historical)
    # Existing confirmed reminders are preserved: they must be reviewed separately.
    assert core.show_operational_deadline({**historical, "status": "confirmed"})
    assert core.show_operational_deadline({**historical, "source": "manual"})
