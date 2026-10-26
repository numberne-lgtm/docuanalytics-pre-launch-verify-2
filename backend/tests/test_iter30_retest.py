# Iteration 30 re-test: real AI account (t_ai_12258) workspace data, deadlines, audit, client 360 report/feeds,
# digest/studio, cross-account isolation and core regressions. ZERO AI calls, ZERO real email sends, no payments.
import os, uuid, io
import pytest, requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
W = lambda p: f"{API}/workspace{p}"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
REAL = {"email": "t_ai_12258@example.com", "password": "Test12345"}


@pytest.fixture(scope="module")
def real():
    r = requests.post(f"{API}/auth/login", json=REAL)
    if r.status_code != 200:
        pytest.skip("real account login failed")
    d = r.json()
    return {"h": {"Authorization": f"Bearer {d['token']}"}, "uid": d["user"]["user_id"]}


@pytest.fixture(scope="module")
def fresh():
    email = f"test_iter30_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Test12345", "name": "TEST iter30"})
    assert r.status_code == 200, r.text
    d = r.json()
    yield {"h": {"Authorization": f"Bearer {d['token']}"}, "uid": d["user"]["user_id"], "email": email}
    for col in ("analyses", "reminders", "clients", "email_log", "files", "multi_document_audits", "payment_transactions"):
        mdb[col].delete_many({"user_id": d["user"]["user_id"]})
    mdb.users.delete_one({"user_id": d["user"]["user_id"]})


def _docs(real):
    return {d["client_name"]: d for d in requests.get(W("/documents"), headers=real["h"]).json()["documents"]}


def _clients(real):
    return {c["name"]: c for c in requests.get(W("/clients"), headers=real["h"]).json()["clients"]}


def _all_dls(real):
    b = requests.get(W("/deadlines"), headers=real["h"]).json()["buckets"]
    return [d for v in b.values() for d in v]


# --- Real data consistency ---
def test_real_overview_documents_clients(real):
    ov = requests.get(W("/overview"), headers=real["h"]).json()["counts"]
    docs = _docs(real)
    assert ov["documents"] == len(docs) == 2
    assert ov["clients"] == 2 and ov["unassigned"] == 0
    assert docs["Rossi SRL"]["client_link"] == "auto" and docs["Verdi Spa"]["client_link"] == "auto"
    hist = requests.get(f"{API}/analyses", headers=real["h"]).json()["analyses"]
    assert len(hist) == 2


def test_real_client360(real):
    cl = _clients(real)
    for name in ("Rossi SRL", "Verdi Spa"):
        c = requests.get(W(f"/clients/{cl[name]['client_id']}"), headers=real["h"]).json()
        assert len(c["documents"]) == 1
        assert len(c["deadlines"]) >= 1
    v = requests.get(W(f"/clients/{cl['Verdi Spa']['client_id']}"), headers=real["h"]).json()
    assert len(v["deadlines"]) >= 2


# --- Deadlines ---
def test_unconfirmed_auto_absent_from_reminders(real):
    ids = {r["reminder_id"] for r in requests.get(f"{API}/reminders", headers=real["h"]).json()["reminders"]}
    for d in _all_dls(real):
        if d["source"] == "auto" and d["status"] != "confirmed":
            assert d["reminder_id"] not in ids


def test_confirm_edit_notify_client_flow(real):
    dl = next(d for d in _all_dls(real) if d["label"] == "Scadenza Pagamento")
    rid = dl["reminder_id"]
    if dl["status"] != "confirmed":
        r = requests.post(W(f"/deadlines/{rid}/confirm"), json={"notify": True, "notify_days": [7, 1]}, headers=real["h"])
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "confirmed" and sorted(r.json()["notify_days"]) == [1, 7]
    ids = {r["reminder_id"] for r in requests.get(f"{API}/reminders", headers=real["h"]).json()["reminders"]}
    assert rid in ids
    r = requests.patch(W(f"/deadlines/{rid}"), json={"due_date": "2026-12-01"}, headers=real["h"])
    assert r.status_code == 200 and r.json()["due_date"] == "2026-12-01"
    r = requests.patch(W(f"/deadlines/{rid}"), json={"due_date": "31/02/2026"}, headers=real["h"])
    assert r.status_code == 400
    r = requests.patch(W(f"/deadlines/{rid}"), json={"notify_client": True, "client_message": "  TEST messaggio  "}, headers=real["h"])
    assert r.status_code == 200 and r.json()["notify_client"] is True
    got = next(d for d in _all_dls(real) if d["reminder_id"] == rid)
    assert got["client_message"] == "TEST messaggio" and got["due_date"] == "2026-12-01"


def test_to_verify_and_delete(fresh):
    # seed a DA VERIFICARE auto deadline directly (no AI)
    rid = str(uuid.uuid4())
    mdb.reminders.insert_one({"reminder_id": rid, "user_id": fresh["uid"], "email": fresh["email"], "analysis_id": None, "client_id": None,
                              "doc_type": "", "label": "TEST_dubbia", "due_date": None, "raw_date": "fine mese", "kind": "other",
                              "status": "to_verify", "source": "auto", "sent": [], "active": True, "notify_days": [], "created_at": "2026-01-01"})
    b = requests.get(W("/deadlines"), headers=fresh["h"]).json()["buckets"]
    assert any(d["reminder_id"] == rid for d in b["to_verify"])
    assert requests.post(W(f"/deadlines/{rid}/confirm"), json={"notify": True}, headers=fresh["h"]).status_code == 400
    r = requests.patch(W(f"/deadlines/{rid}"), json={"due_date": "2026-12-20", "notify_days": [3]}, headers=fresh["h"])
    assert r.status_code == 200
    r = requests.post(W(f"/deadlines/{rid}/confirm"), json={"notify": True}, headers=fresh["h"])
    assert r.status_code == 200 and r.json()["status"] == "confirmed" and r.json()["notify_days"] == [3]
    assert requests.delete(W(f"/deadlines/{rid}"), headers=fresh["h"]).status_code == 200
    assert requests.delete(W(f"/deadlines/{rid}"), headers=fresh["h"]).status_code == 404
    assert rid not in {r["reminder_id"] for r in requests.get(f"{API}/reminders", headers=fresh["h"]).json()["reminders"]}


# --- Multi-doc audit (deterministic only) ---
def test_audit_real_docs(real):
    ids = [d["analysis_id"] for d in _docs(real).values()]
    r = requests.post(W("/audits"), json={"analysis_ids": ids}, headers=real["h"])
    assert r.status_code == 200, r.text
    a = r.json()
    assert set(a["deterministic"].keys()) >= {"consistent", "differences", "anomalies", "to_verify"}
    assert [d["ref"] for d in a["documents"]] == ["Documento A", "Documento B"]
    assert a["deep"] is None
    g = requests.get(W(f"/audits/{a['audit_id']}"), headers=real["h"]).json()
    assert g["audit_id"] == a["audit_id"]
    mdb.multi_document_audits.delete_one({"audit_id": a["audit_id"]})
    assert requests.post(W("/audits"), json={"analysis_ids": [ids[0], ids[0]]}, headers=real["h"]).status_code == 400


# --- Client 360 report / email / feeds ---
def test_report_pdf(real):
    cid = _clients(real)["Verdi Spa"]["client_id"]
    r = requests.get(W(f"/clients/{cid}/report.pdf"), headers=real["h"])
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf" and r.content[:4] == b"%PDF"
    import fitz
    txt = "\n".join(pg.get_text() for pg in fitz.open(stream=r.content, filetype="pdf"))
    assert "Verdi Spa" in txt
    low = txt.lower()
    assert "red flag" not in low and "rischio" not in low, txt[:500]


def test_client_email_and_report_send_blocked(real):
    cid = _clients(real)["Rossi SRL"]["client_id"]
    r = requests.patch(W(f"/clients/{cid}"), json={"email": "TEST_cliente@example.com"}, headers=real["h"])
    assert r.status_code == 200 and r.json()["email"].lower() == "test_cliente@example.com"
    r = requests.post(W(f"/clients/{cid}/report/send"), json={"message": "TEST"}, headers=real["h"])
    assert r.status_code == 400 and r.json()["detail"] == "Indirizzo non consentito per l'invio."
    em = requests.get(W(f"/clients/{cid}/emails"), headers=real["h"]).json()["emails"]
    assert em and em[0]["kind"] == "Report PDF" and em[0]["status"] == "skipped_reserved_domain"


def test_client_calendar_and_feed(real):
    cid = _clients(real)["Verdi Spa"]["client_id"]
    r = requests.get(W(f"/clients/{cid}/calendar.ics"), headers=real["h"])
    assert r.status_code == 200 and "BEGIN:VCALENDAR" in r.text
    f1 = requests.post(W(f"/clients/{cid}/calendar/feed"), headers=real["h"]).json()
    assert f1["active"] and len(f1["token"]) >= 40
    tok1 = f1["token"]
    assert "BEGIN:VCALENDAR" in requests.get(W(f"/feed/{tok1}.ics")).text
    f2 = requests.post(W(f"/clients/{cid}/calendar/feed"), headers=real["h"]).json()
    assert f2["token"] != tok1
    assert requests.get(W(f"/feed/{tok1}.ics")).status_code == 404
    assert requests.get(W(f"/feed/{f2['token']}.ics")).status_code == 200
    assert requests.delete(W(f"/clients/{cid}/calendar/feed"), headers=real["h"]).json()["active"] is False
    assert requests.get(W(f"/feed/{f2['token']}.ics")).status_code == 404


def test_global_calendar_feed(real):
    r = requests.get(W("/calendar.ics"), headers=real["h"])
    assert r.status_code == 200 and "BEGIN:VCALENDAR" in r.text and "Scadenza Pagamento" in r.text
    f = requests.post(W("/calendar/feed"), headers=real["h"]).json()
    tok = f["token"]
    assert "BEGIN:VCALENDAR" in requests.get(W(f"/feed/{tok}.ics")).text
    requests.delete(W("/calendar/feed"), headers=real["h"])
    assert requests.get(W(f"/feed/{tok}.ics")).status_code == 404


# --- Digest / studio ---
def test_digest_toggle_and_preview(fresh):
    assert requests.put(W("/settings"), json={"weekly_digest": True}, headers=fresh["h"]).json()["weekly_digest"] is True
    assert requests.get(W("/settings"), headers=fresh["h"]).json()["weekly_digest"] is True
    r = requests.post(W("/digest/preview"), headers=fresh["h"])
    assert r.status_code == 400
    assert mdb.email_log.find_one({"user_id": fresh["uid"], "kind": "digest_preview"})["status"] == "skipped_reserved_domain"
    requests.put(W("/settings"), json={"weekly_digest": False}, headers=fresh["h"])


def test_studio_signature_logo(fresh):
    r = requests.put(W("/studio"), json={"name": "TEST Studio", "email": "studio@example.com", "phone": "0123"}, headers=fresh["h"])
    assert r.status_code == 200 and r.json()["name"] == "TEST Studio"
    from test_studio_signature_email_log import png_bytes
    png = png_bytes(20, 10)
    r = requests.post(W("/studio/logo"), files={"file": ("l.png", png, "image/png")}, headers=fresh["h"])
    assert r.status_code == 200 and r.json()["has_logo"]
    g = requests.get(W("/studio/logo"), headers=fresh["h"])
    assert g.status_code == 200 and g.content == png
    assert requests.delete(W("/studio/logo"), headers=fresh["h"]).status_code == 200
    assert requests.get(W("/studio/logo"), headers=fresh["h"]).status_code == 404


# --- Isolation ---
def test_isolation(real, fresh):
    cl = _clients(real)
    cid = cl["Verdi Spa"]["client_id"]
    aid = _docs(real)["Verdi Spa"]["analysis_id"]
    rid = _all_dls(real)[0]["reminder_id"]
    h = fresh["h"]
    for m, p in (("get", f"/clients/{cid}"), ("get", f"/clients/{cid}/report.pdf"), ("get", f"/clients/{cid}/emails"),
                 ("get", f"/clients/{cid}/calendar.ics"), ("post", f"/clients/{cid}/calendar/feed"), ("patch", f"/clients/{cid}"),
                 ("get", f"/documents/{aid}"), ("patch", f"/deadlines/{rid}"), ("delete", f"/deadlines/{rid}"),
                 ("post", f"/deadlines/{rid}/confirm"), ("post", f"/clients/{cid}/report/send")):
        r = getattr(requests, m)(W(p), headers=h, json={})
        assert r.status_code == 404, f"{m} {p} -> {r.status_code}"
    assert requests.post(W("/audits"), json={"analysis_ids": [aid, _docs(real)["Rossi SRL"]["analysis_id"]]}, headers=h).status_code == 404
    assert requests.get(W("/documents"), headers=h).json()["documents"] == []
    assert requests.get(W("/clients"), headers=h).json()["clients"] == []


# --- Core regressions ---
def test_auth_and_packages(fresh):
    me = requests.get(f"{API}/auth/me", headers=fresh["h"]).json()["user"]
    assert me["email"] == fresh["email"] and me["credits"] == 3
    assert requests.post(f"{API}/auth/login", json={"email": fresh["email"], "password": "wrong"}).status_code == 401
    ref = requests.get(f"{API}/referral/{fresh['uid']}", headers=fresh["h"])
    assert ref.status_code == 200 and ref.json().get("referral_code")
    pk = requests.get(f"{API}/packages").json()
    prices = sorted(float(p.get("amount", p.get("price", 0))) for p in (pk.get("packages", pk) if isinstance(pk, dict) else pk)
                    + (pk.get("subscriptions", []) if isinstance(pk, dict) else []))
    for v in (19, 49, 149, 29, 99, 299):
        assert float(v) in prices, prices


def test_legacy_reminders_crud(fresh):
    r = requests.post(f"{API}/reminders", json={"label": "TEST_legacy", "due_date": "2026-12-31", "email": fresh["email"]}, headers=fresh["h"])
    assert r.status_code == 200, r.text
    rid = r.json()["reminder_id"]
    assert rid in {x["reminder_id"] for x in requests.get(f"{API}/reminders", headers=fresh["h"]).json()["reminders"]}
    assert requests.delete(f"{API}/reminders/{rid}", headers=fresh["h"]).status_code == 200
    assert rid not in {x["reminder_id"] for x in requests.get(f"{API}/reminders", headers=fresh["h"]).json()["reminders"]}


def test_stripe_checkout_session_created(fresh):
    r = requests.post(f"{API}/payments/checkout", json={"package_id": "starter", "origin_url": BASE, "user_id": fresh["uid"]}, headers=fresh["h"])
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("checkout_url", "").startswith("https://checkout.stripe.com") and d.get("session_id", "").startswith("cs_live_")
