# Workspace (Area di lavoro) regression tests: documents detail, deep audit credits, isolation, legacy regression
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WS = f"{BASE_URL}/api/workspace"
SEED = {"email": "ws9ad9d766@example.com", "password": "Test12345"}
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def seed():
    d = login(**SEED)
    return {"token": d["token"], "uid": d["user"]["user_id"]}


@pytest.fixture(scope="module")
def other():
    """Brand new registered user with 2 synthetic analyses and 0 credits."""
    email = f"test_ws_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test12345", "name": "TEST ws"})
    assert r.status_code == 200, r.text
    d = r.json()
    uid = d["user"]["user_id"]
    aids = []
    for i in range(2):
        aid = f"TEST_{uuid.uuid4()}"
        mdb.analyses.insert_one({"analysis_id": aid, "user_id": uid, "filename": f"TEST_f{i}.pdf",
                                 "created_at": f"2026-01-0{i+1}T00:00:00+00:00",
                                 "result": {"category": "invoice", "doc_type": "Fattura", "summary": "x",
                                            "structured": {"total": f"{100 + i},00"}, "fields": [], "audit": []}})
        aids.append(aid)
    mdb.users.update_one({"user_id": uid}, {"$set": {"credits": 0}})
    yield {"token": d["token"], "uid": uid, "aids": aids, "email": email}
    mdb.analyses.delete_many({"user_id": uid})
    mdb.multi_document_audits.delete_many({"user_id": uid})
    mdb.reminders.delete_many({"user_id": uid})
    mdb.users.delete_one({"user_id": uid})


# --- Document detail ---
class TestDocument:
    def test_document_detail(self, seed):
        docs = requests.get(f"{WS}/documents", headers=H(seed["token"])).json()["documents"]
        assert len(docs) >= 3
        aid = docs[0]["analysis_id"]
        r = requests.get(f"{WS}/documents/{aid}", headers=H(seed["token"]))
        assert r.status_code == 200
        d = r.json()
        for k in ("fields", "audit", "deadlines", "risk_level", "client_name"):
            assert k in d
        assert isinstance(d["fields"], list) and isinstance(d["deadlines"], list)
        assert "_id" not in d

    def test_document_other_user_404(self, seed, other):
        r = requests.get(f"{WS}/documents/{other['aids'][0]}", headers=H(seed["token"]))
        assert r.status_code == 404
        r = requests.get(f"{WS}/documents/{other['aids'][0]}", headers=H(other["token"]))
        assert r.status_code == 200

    def test_anon_401(self):
        assert requests.get(f"{WS}/documents/xyz").status_code == 401


# --- Deep audit credits ---
class TestDeepAudit:
    def test_deep_zero_credits_402(self, other):
        r = requests.post(f"{WS}/audits", json={"analysis_ids": other["aids"]}, headers=H(other["token"]))
        assert r.status_code == 200, r.text
        a = r.json()
        assert [d["ref"] for d in a["documents"]] == ["Documento A", "Documento B"]
        assert len(a["deterministic"]["differences"]) >= 1
        r = requests.post(f"{WS}/audits/{a['audit_id']}/deep", headers=H(other["token"]))
        assert r.status_code == 402
        u = mdb.users.find_one({"user_id": other["uid"]})
        assert u["credits"] == 0
        assert mdb.multi_document_audits.find_one({"audit_id": a["audit_id"]})["deep"] is None

    def test_deep_other_user_audit_404(self, seed, other):
        a = requests.post(f"{WS}/audits", json={"analysis_ids": other["aids"]}, headers=H(other["token"])).json()
        r = requests.post(f"{WS}/audits/{a['audit_id']}/deep", headers=H(seed["token"]))
        assert r.status_code == 404
        assert requests.get(f"{WS}/audits/{a['audit_id']}", headers=H(seed["token"])).status_code == 404

    def test_deep_with_credits_decrements_one(self, seed):
        docs = requests.get(f"{WS}/documents", headers=H(seed["token"])).json()["documents"]
        ids = [d["analysis_id"] for d in docs[:2]]
        a = requests.post(f"{WS}/audits", json={"analysis_ids": ids}, headers=H(seed["token"])).json()
        before = requests.get(f"{BASE_URL}/api/auth/me", headers=H(seed["token"])).json()
        before_c = (before.get("user") or before)["credits"]
        if before_c <= 0:
            pytest.skip("seed user has no credits")
        t0 = time.time()
        r = requests.post(f"{WS}/audits/{a['audit_id']}/deep", headers=H(seed["token"]), timeout=180)
        print("deep took", round(time.time() - t0, 1), "s", r.status_code, r.text[:1500])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["credits"] == before_c - 1
        refs = {"Documento A", "Documento B"}
        for f in d["deep"]["findings"]:
            for s in f.get("sources") or []:
                assert s.get("ref") in refs, f"bad ref {s}"
        # second call is cached, no extra decrement
        r2 = requests.post(f"{WS}/audits/{a['audit_id']}/deep", headers=H(seed["token"]))
        assert r2.status_code == 200 and r2.json()["credits"] == before_c - 1
        after = requests.get(f"{BASE_URL}/api/auth/me", headers=H(seed["token"])).json()
        assert (after.get("user") or after)["credits"] == before_c - 1


# --- Legacy regression ---
class TestLegacy:
    def test_packages(self):
        r = requests.get(f"{BASE_URL}/api/packages")
        assert r.status_code == 200
        print(r.text[:800])
        txt = r.text
        for p in ("19", "49", "149", "29", "99", "299"):
            assert p in txt

    def test_reminders_legacy(self, other):
        r = requests.post(f"{BASE_URL}/api/reminders", json={"label": "TEST legacy", "due_date": "2027-03-01"}, headers=H(other["token"]))
        assert r.status_code == 200, r.text
        rid = r.json()["reminder_id"]
        r = requests.get(f"{BASE_URL}/api/reminders", headers=H(other["token"]))
        assert r.status_code == 200
        assert any(x["reminder_id"] == rid for x in r.json()["reminders"])
        # appears in workspace deadlines too
        b = requests.get(f"{WS}/deadlines", headers=H(other["token"])).json()["buckets"]
        assert any(x["reminder_id"] == rid for v in b.values() for x in v)
        assert requests.delete(f"{BASE_URL}/api/reminders/{rid}", headers=H(other["token"])).status_code == 200
