# Reminder-from-analysis (Crea promemoria) API flow: sync detection, PATCH note + confirm, POST create w/ note, duplicate 409
import os, uuid, pytest, requests
from datetime import datetime, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]
BASE_URL = BASE_URL.strip().strip('"').rstrip("/")
mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]


@pytest.fixture(scope="module")
def ctx():
    email = f"test_rem_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "secret123", "name": "TEST Rem"})
    if r.status_code != 200:
        pytest.skip(f"register failed {r.status_code} {r.text[:200]}")
    d = r.json(); uid = d["user"]["user_id"]
    now = datetime.now(timezone.utc).isoformat()
    a1, a2 = str(uuid.uuid4()), str(uuid.uuid4())
    mdb.analyses.insert_many([
        {"analysis_id": a1, "user_id": uid, "doc_type": "contract", "filename": "TEST_contratto.pdf", "created_at": now, "ai_provider": "gemini",
         "result": {"doc_type": "Contratto", "category": "contract", "summary": "Contratto di servizio", "fields": [],
                    "audit": [], "structured": {"parties": [], "expiration_date": "30/09/2027"}, "full_text": "x"}},
        {"analysis_id": a2, "user_id": uid, "doc_type": "auto", "filename": "TEST_altro.pdf", "created_at": now, "ai_provider": "gemini",
         "result": {"doc_type": "Lettera", "category": "other", "summary": "Lettera generica", "fields": [], "audit": [], "structured": {}, "full_text": "x"}},
    ])
    s = requests.Session(); s.headers.update({"Authorization": f"Bearer {d['token']}"})
    yield {"s": s, "uid": uid, "a1": a1, "a2": a2}
    mdb.analyses.delete_many({"user_id": uid}); mdb.reminders.delete_many({"user_id": uid})
    mdb.users.delete_many({"user_id": uid}); mdb.ws_clients.delete_many({"user_id": uid})


def test_sync_detects_contract_deadline(ctx):
    s = ctx["s"]
    assert s.post(f"{BASE_URL}/api/workspace/sync").status_code == 200
    d = s.get(f"{BASE_URL}/api/workspace/documents/{ctx['a1']}").json()
    dls = d["deadlines"]
    assert any(x["due_date"] == "2027-09-30" for x in dls), dls
    assert all(x["status"] != "confirmed" for x in dls)
    d2 = s.get(f"{BASE_URL}/api/workspace/documents/{ctx['a2']}").json()
    assert d2["deadlines"] == []


def test_patch_note_and_confirm(ctx):
    s = ctx["s"]
    d = s.get(f"{BASE_URL}/api/workspace/documents/{ctx['a1']}").json()
    rid = [x for x in d["deadlines"] if x["due_date"] == "2027-09-30"][0]["reminder_id"]
    p = s.patch(f"{BASE_URL}/api/workspace/deadlines/{rid}", json={"label": "TEST Rinnovo", "due_date": "2027-09-30", "note": "TEST nota"})
    assert p.status_code == 200 and p.json()["note"] == "TEST nota" and p.json()["label"] == "TEST Rinnovo"
    c = s.post(f"{BASE_URL}/api/workspace/deadlines/{rid}/confirm", json={"notify": True})
    assert c.status_code == 200 and c.json()["status"] == "confirmed"
    d = s.get(f"{BASE_URL}/api/workspace/documents/{ctx['a1']}").json()
    x = [y for y in d["deadlines"] if y["reminder_id"] == rid][0]
    assert x["status"] == "confirmed" and x["note"] == "TEST nota" and x["analysis_id"] == ctx["a1"]
    rems = s.get(f"{BASE_URL}/api/reminders").json()["reminders"]
    assert any(r["reminder_id"] == rid for r in rems)
    # resync must not revert confirmation
    s.post(f"{BASE_URL}/api/workspace/sync")
    d = s.get(f"{BASE_URL}/api/workspace/documents/{ctx['a1']}").json()
    assert [y for y in d["deadlines"] if y["reminder_id"] == rid][0]["status"] == "confirmed"


def test_create_new_with_note_and_duplicate_409(ctx):
    s = ctx["s"]
    body = {"label": "TEST Scadenza Lettera", "due_date": "2027-03-15", "note": "TEST desc", "analysis_id": ctx["a2"]}
    r = s.post(f"{BASE_URL}/api/workspace/deadlines", json=body)
    assert r.status_code == 200, r.text
    j = r.json(); assert j["note"] == "TEST desc" and j["analysis_id"] == ctx["a2"] and j["status"] == "confirmed"
    r2 = s.post(f"{BASE_URL}/api/workspace/deadlines", json=body)
    assert r2.status_code == 409 and "già" in r2.json()["detail"]
    # different date ok
    r3 = s.post(f"{BASE_URL}/api/workspace/deadlines", json={**body, "due_date": "2027-03-16"})
    assert r3.status_code == 200
    # duplicate of auto-confirmed contract deadline also 409
    r4 = s.post(f"{BASE_URL}/api/workspace/deadlines", json={"label": "x", "due_date": "30/09/2027", "analysis_id": ctx["a1"]})
    assert r4.status_code == 409


def test_note_max_length_and_bad_date(ctx):
    s = ctx["s"]
    r = s.post(f"{BASE_URL}/api/workspace/deadlines", json={"label": "x", "due_date": "2027-04-01", "note": "a" * 501, "analysis_id": ctx["a2"]})
    assert r.status_code == 422
    r = s.post(f"{BASE_URL}/api/workspace/deadlines", json={"label": "x", "due_date": "", "analysis_id": ctx["a2"]})
    assert r.status_code == 400


def test_foreign_analysis_rejected(ctx):
    s = ctx["s"]
    r = s.post(f"{BASE_URL}/api/workspace/deadlines", json={"label": "x", "due_date": "2027-04-01", "analysis_id": str(uuid.uuid4())})
    assert r.status_code in (403, 404)


def test_anonymous_cannot_create(ctx):
    r = requests.post(f"{BASE_URL}/api/workspace/deadlines", json={"label": "x", "due_date": "2027-04-01", "analysis_id": ctx["a2"]})
    assert r.status_code in (401, 403)
