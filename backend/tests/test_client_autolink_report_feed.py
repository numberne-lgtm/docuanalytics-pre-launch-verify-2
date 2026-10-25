# Iteration 27: auto-link robustness (P.IVA variants/fallback), client PDF report (reduced), per-client calendar export + feed. NO AI calls.
import os, re, json, uuid, hashlib
import pytest, requests, pymupdf
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
W = lambda p: f"{BASE}/api/workspace{p}"


def _reg(tag):
    email = f"test_it27_{tag}_{uuid.uuid4().hex[:8]}@example.com"
    d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": f"TEST {tag}"}).json()
    return {"email": email, "uid": d["user"]["user_id"], "h": {"Authorization": f"Bearer {d['token']}"}}


def _clean(u):
    for c in ("analyses", "reminders", "clients", "multi_document_audits"):
        mdb[c].delete_many({"user_id": u["uid"]})
    mdb.users.delete_one({"user_id": u["uid"]})


def _client(u, name, piva="", cf=""):
    r = requests.post(W("/clients"), json={"name": name, "piva": piva, "cf": cf}, headers=u["h"])
    assert r.status_code == 200, r.text
    return r.json()


def _seed(u, key, result, day=1):
    aid = f"TEST_{key}_{uuid.uuid4().hex[:6]}"
    mdb.analyses.insert_one({"analysis_id": aid, "user_id": u["uid"], "filename": f"TEST_{key}.pdf",
                             "created_at": f"2026-01-{day:02d}T10:00:00+00:00", "result": result})
    return aid


def _doc(aid):
    return mdb.analyses.find_one({"analysis_id": aid}, {"_id": 0})


INV = lambda cust, sup=None: {"doc_type": "Fattura", "summary": "TEST", "fields": [], "audit": [],
                              "structured": {"supplier": sup or {"name": "Fornitore X", "piva": "99999999999"}, "customer": cust}}

POSITIVE = {
    "cat_fattura": {**INV({"name": "Rossi SRL", "piva": "22222222222"}), "category": "Fattura"},
    "no_category": INV({"name": "Rossi", "piva": "22222222222"}),
    "nested_fattura": {"category": "Fattura", "doc_type": "Fattura", "fields": [], "audit": [],
                       "structured": {"fattura": {"supplier": {"name": "F", "piva": "99999999999"}, "customer": {"name": "R", "piva": "22222222222"}}}},
    "json_string": {"category": "invoice", "doc_type": "Fattura", "fields": [], "audit": [],
                    "structured": json.dumps({"supplier": {"name": "F", "piva": "99999999999"}, "customer": {"name": "R", "piva": "22222222222"}})},
    "piva_prefix": {**INV({"name": "R", "piva": "P.IVA IT22222222222"}), "category": "invoice"},
    "legacy_fields": {"doc_type": "Fattura", "fields": [{"label": "P.IVA cliente", "value": "IT22222222222"}], "audit": []},
    "full_text_only": {"doc_type": "Documento", "full_text": "Spett.le Rossi SRL, P.IVA IT22222222222, via Roma 1.", "audit": []},
}


@pytest.fixture(scope="module")
def env():
    a, b = _reg("a"), _reg("b")
    rossi = _client(a, "Rossi SRL", "22222222222", "RSSMRA80A01H501U")
    bianchi = _client(a, "Bianchi Spa", "33333333333")
    b_client = _client(b, "Verdi Srl", "55555555555")
    yield {"a": a, "b": b, "rossi": rossi, "bianchi": bianchi, "b_client": b_client}
    _clean(a); _clean(b)


# ---------- Auto-link ----------
def test_autolink_positive_variants(env):
    a = env["a"]
    ids = {k: _seed(a, k, v) for k, v in POSITIVE.items()}
    r = requests.get(W("/overview"), headers=a["h"]); assert r.status_code == 200
    bad = {k: (_doc(aid).get("client_id"), (_doc(aid).get("client_link") or {}).get("status")) for k, aid in ids.items()
           if _doc(aid).get("client_id") != env["rossi"]["client_id"] or (_doc(aid).get("client_link") or {}).get("status") != "auto"}
    assert not bad, f"not auto-linked: {bad}"


def test_autolink_negatives(env):
    a = env["a"]
    neg = {
        "one_digit_off": {**INV({"name": "Rossi SRL", "piva": "22222222223"}), "category": "invoice"},
        "name_only": {**INV({"name": "Rossi SRL"}), "category": "invoice"},
        "ambiguous": {**INV({"name": "Rossi", "piva": "22222222222"}, {"name": "Bianchi", "piva": "33333333333"}), "category": "invoice"},
        "ambiguous_text": {"doc_type": "Doc", "full_text": "P.IVA 22222222222 e P.IVA 33333333333"},
        "other_user_piva": {**INV({"name": "Verdi", "piva": "55555555555"}), "category": "invoice"},
        "longer_number": {"doc_type": "Doc", "full_text": "Codice 122222222222 riferimento"},
    }
    ids = {k: _seed(a, k, v) for k, v in neg.items()}
    requests.get(W("/overview"), headers=a["h"])
    linked = {k: _doc(aid).get("client_id") for k, aid in ids.items() if _doc(aid).get("client_id")}
    assert not linked, f"unexpectedly linked: {linked}"


def test_manual_unassign_stays_unlinked(env):
    a = env["a"]
    aid = _seed(a, "unassign", {**INV({"name": "R", "piva": "22222222222"}), "category": "invoice"})
    requests.get(W("/overview"), headers=a["h"])
    assert _doc(aid)["client_id"] == env["rossi"]["client_id"]
    r = requests.post(W(f"/documents/{aid}/assign"), json={"client_id": None}, headers=a["h"]); assert r.status_code == 200
    requests.get(W("/overview"), headers=a["h"]); requests.post(W("/sync"), headers=a["h"])
    d = _doc(aid)
    assert d["client_id"] is None and d["client_link"]["status"] == "unlinked"


def test_other_user_not_matched(env):
    b = env["b"]
    aid = _seed(b, "b_rossi", {**INV({"name": "Rossi", "piva": "22222222222"}), "category": "invoice"})
    requests.get(W("/overview"), headers=b["h"])
    assert not _doc(aid).get("client_id")


# ---------- Deadlines seed for PDF/ICS ----------
@pytest.fixture(scope="module")
def dls(env):
    a, rossi, bianchi = env["a"], env["rossi"], env["bianchi"]
    aid = _seed(a, "pdfdoc", {"category": "invoice", "doc_type": "Fattura TEST PDF", "summary": "s",
                              "structured": {"customer": {"name": "Rossi SRL", "piva": "22222222222"}},
                              "fields": [{"label": "Numero fattura", "value": "FT-2026-777"}, {"label": "Totale", "value": "1.234,56 EUR"}],
                              "audit": [{"level": "error", "message": "REDFLAG_SECRET IBAN non coerente"}, {"level": "warning", "message": "WARNFLAG_SECRET"}]}, day=5)
    requests.get(W("/overview"), headers=a["h"])
    assert _doc(aid)["client_id"] == rossi["client_id"]
    mk = lambda body: requests.post(W("/deadlines"), json=body, headers=a["h"]).json()
    man = mk({"label": "TEST_MANUALE_ROSSI", "due_date": "2026-03-15", "client_id": rossi["client_id"], "kind": "payment"})
    other = mk({"label": "TEST_ALTRO_CLIENTE", "due_date": "2026-04-10", "client_id": bianchi["client_id"]})
    rid_tv, rid_auto_ok = str(uuid.uuid4()), str(uuid.uuid4())
    base = {"user_id": a["uid"], "email": a["email"], "analysis_id": aid, "client_id": rossi["client_id"], "doc_type": "Fattura",
            "source": "auto", "notify_days": [], "sent": [], "active": True, "created_at": "2026-01-01T00:00:00+00:00", "raw_date": "x"}
    mdb.reminders.insert_one({**base, "reminder_id": rid_tv, "kind": "renewal", "due_date": "2026-05-05", "label": "TEST_DA_VERIFICARE_ROSSI", "status": "to_verify"})
    mdb.reminders.insert_one({**base, "reminder_id": rid_auto_ok, "kind": "payment", "due_date": "2026-06-20", "label": "TEST_AUTO_CONFERMATA", "status": "confirmed"})
    return {"aid": aid, "man": man, "other": other}


# ---------- PDF report ----------
def test_report_pdf_content(env, dls):
    a, rossi = env["a"], env["rossi"]
    r = requests.get(W(f"/clients/{rossi['client_id']}/report.pdf"), headers=a["h"])
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert 'filename="report-rossi-srl.pdf"' in r.headers.get("content-disposition", "")
    txt = "".join(p.get_text() for p in pymupdf.open(stream=r.content, filetype="pdf"))
    flat = " ".join(txt.split())
    for must in ("Rossi SRL", "22222222222", "RSSMRA80A01H501U", "15/03/2026", "TEST_MANUALE_ROSSI", "20/06/2026", "TEST_AUTO_CONFERMATA",
                 "FT-2026-777", "1.234,56 EUR", "Fattura TEST PDF", "Non costituisce consulenza"):
        assert must in flat, f"missing {must}"
    for bad in ("REDFLAG_SECRET", "WARNFLAG_SECRET", "TEST_DA_VERIFICARE_ROSSI", "05/05/2026", "TEST_ALTRO_CLIENTE", "Alto", "Medio", "Basso", "DA VERIFICARE"):
        assert bad not in flat, f"leaked {bad}"


def test_report_pdf_authz(env):
    cid = env["rossi"]["client_id"]
    assert requests.get(W(f"/clients/{cid}/report.pdf"), headers=env["b"]["h"]).status_code == 404
    assert requests.get(W(f"/clients/{cid}/report.pdf")).status_code == 401


# ---------- Per-client ICS + feed ----------
def _summaries(ics):
    return re.findall(r"SUMMARY:(.*)", ics.replace("\r\n ", ""))


def test_client_ics_only_client_confirmed(env, dls):
    r = requests.get(W(f"/clients/{env['rossi']['client_id']}/calendar.ics"), headers=env["a"]["h"])
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/calendar")
    assert "scadenze-rossi-srl.ics" in r.headers["content-disposition"]
    s = [x.strip() for x in _summaries(r.text)]
    assert "TEST_MANUALE_ROSSI" in s and "TEST_AUTO_CONFERMATA" in s
    assert "TEST_ALTRO_CLIENTE" not in s and "TEST_DA_VERIFICARE_ROSSI" not in s
    assert requests.get(W(f"/clients/{env['rossi']['client_id']}/calendar.ics"), headers=env["b"]["h"]).status_code == 404


def test_client_feed_lifecycle(env, dls):
    a, cid = env["a"], env["rossi"]["client_id"]
    st = requests.get(W(f"/clients/{cid}/calendar/feed"), headers=a["h"]).json(); assert st["active"] is False
    t1 = requests.post(W(f"/clients/{cid}/calendar/feed"), headers=a["h"]).json()["token"]
    assert len(t1) >= 40
    stored = mdb.clients.find_one({"client_id": cid})["calendar_feed"]
    assert stored["hash"] == hashlib.sha256(t1.encode()).hexdigest() and t1 not in json.dumps(stored)
    pub = requests.get(W(f"/feed/{t1}.ics")); assert pub.status_code == 200
    s = [x.strip() for x in _summaries(pub.text)]
    assert "TEST_MANUALE_ROSSI" in s and "TEST_ALTRO_CLIENTE" not in s
    # global feed independent
    g = requests.post(W("/calendar/feed"), headers=a["h"]).json()["token"]
    gs = [x.strip() for x in _summaries(requests.get(W(f"/feed/{g}.ics")).text)]
    assert "TEST_ALTRO_CLIENTE" in gs and "TEST_MANUALE_ROSSI" in gs
    assert requests.get(W(f"/feed/{t1}.ics")).status_code == 200
    t2 = requests.post(W(f"/clients/{cid}/calendar/feed"), headers=a["h"]).json()["token"]
    assert requests.get(W(f"/feed/{t1}.ics")).status_code == 404
    assert requests.get(W(f"/feed/{t2}.ics")).status_code == 200
    assert requests.get(W(f"/feed/{g}.ics")).status_code == 200
    # other user
    for m in ("get", "post", "delete"):
        assert getattr(requests, m)(W(f"/clients/{cid}/calendar/feed"), headers=env["b"]["h"]).status_code == 404
    assert requests.get(W(f"/feed/{t2}.ics")).status_code == 200
    assert requests.delete(W(f"/clients/{cid}/calendar/feed"), headers=a["h"]).json()["active"] is False
    assert requests.get(W(f"/feed/{t2}.ics")).status_code == 404
    assert requests.get(W(f"/feed/{g}.ics")).status_code == 200
    requests.delete(W("/calendar/feed"), headers=a["h"])
    assert requests.get(W(f"/feed/{g}.ics")).status_code == 404
    assert requests.get(W(f"/clients/{cid}/calendar/feed")).status_code == 401


def test_delete_client_kills_feed(env):
    a = env["a"]
    c = _client(a, "TEST Da Eliminare", "77777777777")
    t = requests.post(W(f"/clients/{c['client_id']}/calendar/feed"), headers=a["h"]).json()["token"]
    assert requests.get(W(f"/feed/{t}.ics")).status_code == 200
    assert requests.delete(W(f"/clients/{c['client_id']}"), headers=a["h"]).status_code == 200
    assert requests.get(W(f"/feed/{t}.ics")).status_code == 404


def test_short_or_bogus_token_404():
    assert requests.get(W("/feed/abc.ics")).status_code == 404
    assert requests.get(W(f"/feed/{'x' * 43}.ics")).status_code == 404
