"""PR #7 isolated HTTP security regression tests. Never touch production data.

Run with local MongoDB at PR7_TEST_MONGO_URL=mongodb://127.0.0.1:27017
"""
import os
import uuid
import sys
import types
import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from workspace.router import build_workspace_router
from privacy_admin.router import build_privacy_router

MONGO = os.getenv("PR7_TEST_MONGO_URL", "mongodb://127.0.0.1:27017")


@pytest.fixture()
def report_outbox():
    return []


@pytest.fixture()
def app_client(request, report_outbox):
    name = "pr7_test_" + uuid.uuid4().hex
    sync = MongoClient(MONGO, serverSelectionTimeoutMS=2000)
    sync.admin.command("ping")
    db = sync[name]
    db.analyses.insert_many([
        {"user_id": "alice", "analysis_id": "doc-alice", "client_id": "client-alice", "filename": "alice.pdf",
         "created_at": "2026-11-06T00:00:00Z",
         "result": {"doc_type": "Contratto", "summary": "Documento sintetico",
                    "full_text": "PRIVATE_TEXT_NEVER_SEND_BY_DEFAULT",
                    "fields": [{"label": "Test", "value": "PRIVATE_FIELD_ONLY_WITH_OPTIN"}],
                    "audit": [{"level": "warning", "message": "Dato da verificare"}]},
         "ws_synced": True, "risk_level": "medium"},
        {"user_id": "bob", "analysis_id": "doc-bob", "filename": "bob.pdf",
         "created_at": "2026-11-06T00:00:00Z",
         "result": {"doc_type": "Fattura", "summary": "Dati di Bob",
                    "fields": [], "audit": []},
         "ws_synced": True, "risk_level": "low"},
    ])
    db.clients.insert_many([
        {"user_id": "alice", "client_id": "client-alice", "name": "Cliente A", "email": "", "created_at": "2026-11-06T00:00:00Z"},
        {"user_id": "alice", "client_id": "client-other", "name": "Cliente Altro", "email": "", "created_at": "2026-11-06T00:00:00Z"},
        {"user_id": "bob", "client_id": "client-bob", "name": "Cliente B", "email": "", "created_at": "2026-11-06T00:00:00Z"},
    ])
    db.reminders.insert_many([
        {"user_id": "alice", "reminder_id": "deadline-alice", "analysis_id": "doc-alice",
         "client_id": "client-alice", "status": "confirmed", "source": "manual",
         "due_date": "2027-04-30", "label": "Scadenza test A", "kind": "other", "active": True},
        {"user_id": "alice", "reminder_id": "deadline-historic", "analysis_id": "doc-alice",
         "client_id": "client-alice", "status": "confirmed", "source": "auto",
         "due_date": "2008-06-05", "label": "Data Decadenza Beneficio Termine",
         "kind": "other", "active": True, "notify_days": [7, 1], "sent": []},
        {"user_id": "alice", "reminder_id": "deadline-legal", "analysis_id": "doc-alice",
         "client_id": "client-alice", "status": "confirmed", "source": "auto",
         "due_date": "2026-10-06", "label": "Scadenza Sollecito di Pagamento / Diffida Legale",
         "kind": "other", "active": True, "notify_days": [], "sent": []},
        {"user_id": "bob", "reminder_id": "deadline-bob", "analysis_id": "doc-bob",
         "client_id": "client-bob", "status": "confirmed", "source": "manual",
         "due_date": "2027-04-30", "label": "Scadenza test B", "kind": "other", "active": True},
    ])

    async def current_user(request: Request):
        token = request.headers.get("authorization", "").removeprefix("Bearer ")
        if token not in ("alice", "bob"):
            raise HTTPException(401, "Autenticazione richiesta")
        return {"user_id": token, "email": token + "@example.invalid"}

    async def email_sender(to, subject, html, **kwargs):
        report_outbox.append(to)
        return True

    app = FastAPI()
    app.state.test_db = db
    app.include_router(build_privacy_router(AsyncIOMotorClient(MONGO)[name], "synthetic-privacy-admin"))
    app.include_router(build_workspace_router(
        AsyncIOMotorClient(MONGO)[name], current_user, getattr(request, "param", None), [30, 7, 1],
        email_sender, "not-production-test-secret", "https://docuanalytics.online"))
    try:
        with TestClient(app) as test:
            yield test
    finally:
        sync.drop_database(name)
        sync.close()


def auth(who):
    return {"Authorization": "Bearer " + who}


@pytest.mark.parametrize("path", [
    "/api/workspace/priorities/document/doc-alice",
    "/api/workspace/priorities/document/doc-alice/pdf",
    "/api/workspace/priorities/document/doc-alice/qr",
    "/api/workspace/priorities/deadline/deadline-alice",
    "/api/workspace/priorities/deadline/deadline-alice/pdf",
    "/api/workspace/priorities/deadline/deadline-alice/qr",
])
def test_anonymous_and_other_account_denied(app_client, path):
    assert app_client.get(path).status_code == 401
    assert app_client.get(path, headers=auth("bob")).status_code == 404



def test_qr_decodes_to_protected_url_without_credentials(app_client):
    """Decode the *actual* PNG response, not just its file signature."""
    from io import BytesIO
    from PIL import Image
    import zxingcpp

    qr = app_client.get("/api/workspace/priorities/document/doc-alice/qr",
                        headers=auth("alice"))
    assert qr.status_code == 200
    code = zxingcpp.read_barcode(Image.open(BytesIO(qr.content)))
    assert code is not None, "QR image was generated but cannot be decoded"
    assert code.text == "https://docuanalytics.online/area/priorita/document/doc-alice"
    assert "token=" not in code.text.lower()
    assert "bearer" not in code.text.lower()


def test_authenticated_pdf_and_qr(app_client):
    path = "/api/workspace/priorities/document/doc-alice"
    detail = app_client.get(path, headers=auth("alice"))
    assert detail.status_code == 200
    assert detail.json()["filename"] == "alice.pdf"
    pdf = app_client.get(path + "/pdf", headers=auth("alice"))
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content.startswith(b"%PDF-")
    assert pdf.headers["cache-control"] == "private, no-store"
    qr = app_client.get(path + "/qr", headers=auth("alice"))
    assert qr.status_code == 200
    assert qr.headers["content-type"].startswith("image/png")
    assert qr.content.startswith(bytes((137, 80, 78, 71, 13, 10, 26, 10)))


def test_read_state_separated_by_account_and_reversible(app_client):
    url = "/api/workspace/priorities/read-state"
    data = {"type": "document", "item_id": "doc-alice", "is_read": True}
    assert app_client.put(url, json=data, headers=auth("bob")).status_code == 404
    assert app_client.put(url, json=data, headers=auth("alice")).status_code == 200
    r = app_client.get("/api/workspace/overview", headers=auth("alice"))
    assert r.status_code == 200
    p = next(x for x in r.json()["priorities"] if x["type"] == "document" and x["analysis_id"] == "doc-alice")
    assert p["is_read"] is True
    data["is_read"] = False
    assert app_client.put(url, json=data, headers=auth("alice")).status_code == 200
    r = app_client.get("/api/workspace/overview", headers=auth("alice"))
    p = next(x for x in r.json()["priorities"] if x["type"] == "document" and x["analysis_id"] == "doc-alice")
    assert p["is_read"] is False


def test_copilot_consent_and_account_isolation_without_model_calls(app_client):
    url = "/api/workspace/copilot/ask"
    base = {"question": "Quali scadenze dovrei controllare?", "scope": "all"}
    assert app_client.post(url, json=base).status_code == 401
    assert app_client.post(url, json=base, headers=auth("alice")).status_code == 400
    assert app_client.post(url, json={**base, "consent_to_ai": True,
                                      "client_id": "client-bob"}, headers=auth("alice")).status_code == 404
    assert app_client.post(url, json={**base, "consent_to_ai": True,
                                      "analysis_id": "doc-bob"}, headers=auth("alice")).status_code == 404
    assert app_client.post(url, json={**base, "consent_to_ai": True,
                                      "analysis_id": "doc-alice", "client_id": "client-bob"},
                           headers=auth("alice")).status_code == 404
    assert app_client.post(url, json={**base, "consent_to_ai": True,
                                      "analysis_id": "doc-alice", "client_id": "client-other"},
                           headers=auth("alice")).status_code == 400
    assert app_client.post(url, json={**base, "consent_to_ai": True,
                                      "include_document_details": True}, headers=auth("alice")).status_code == 400
    # llm_key is absent, so even a valid request must fail closed without model/network calls.
    assert app_client.post(url, json={**base, "consent_to_ai": True},
                           headers=auth("alice")).status_code == 503


@pytest.mark.parametrize("app_client", ["pr7-fake-llm-key"], indirect=True)
def test_copilot_mocked_llm_isolation_optin_and_citations(app_client, monkeypatch):
    """No paid/external model is used: fake LlmChat captures the prompt and returns a response."""
    calls = []

    class UserMessage:
        def __init__(self, text):
            self.text = text

    class LlmChat:
        def __init__(self, api_key, session_id, system_message):
            assert api_key == "pr7-fake-llm-key"
            self.system_message = system_message

        def with_model(self, provider, model):
            assert provider == "openai"
            assert model == "gpt-5.4-mini"
            return self

        async def send_message(self, message):
            calls.append({"system": self.system_message, "question": message.text})
            return "Fonte [documento:doc-alice]. Falsa [documento:doc-bob]."

    package = types.ModuleType("emergentintegrations")
    package.__path__ = []
    sub = types.ModuleType("emergentintegrations.llm")
    sub.__path__ = []
    chatmod = types.ModuleType("emergentintegrations.llm.chat")
    chatmod.LlmChat = LlmChat
    chatmod.UserMessage = UserMessage
    monkeypatch.setitem(sys.modules, "emergentintegrations", package)
    monkeypatch.setitem(sys.modules, "emergentintegrations.llm", sub)
    monkeypatch.setitem(sys.modules, "emergentintegrations.llm.chat", chatmod)

    endpoint = "/api/workspace/copilot/ask"
    payload = {"question": "Riassumi il contratto del cliente.", "scope": "documents",
               "analysis_id": "doc-alice", "consent_to_ai": True}
    normal = app_client.post(endpoint, json=payload, headers=auth("alice"))
    assert normal.status_code == 200, normal.text
    data = normal.json()
    assert data["sources"] == [{"ref": "documento:doc-alice", "label": "alice.pdf"}]
    assert "[riferimento non verificato]" in data["answer"]
    assert "[documento:doc-bob]" not in data["answer"]
    assert "Documento sintetico" in calls[-1]["system"]
    assert "Dati di Bob" not in calls[-1]["system"]
    assert "PRIVATE_TEXT_NEVER_SEND_BY_DEFAULT" not in calls[-1]["system"]
    assert "PRIVATE_FIELD_ONLY_WITH_OPTIN" not in calls[-1]["system"]

    full = app_client.post(endpoint, json={**payload, "include_document_details": True},
                           headers=auth("alice"))
    assert full.status_code == 200, full.text
    assert "PRIVATE_TEXT_NEVER_SEND_BY_DEFAULT" in calls[-1]["system"]
    assert "PRIVATE_FIELD_ONLY_WITH_OPTIN" in calls[-1]["system"]
    assert len(calls) == 2


def test_historical_legacy_auto_review_and_explicit_confirmation(app_client):
    headers = auth("alice")
    overview = app_client.get("/api/workspace/overview", headers=headers).json()
    assert not any(p.get("reminder_id") == "deadline-historic" for p in overview["priorities"])
    detail = app_client.get("/api/workspace/priorities/deadline/deadline-historic", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["historical_unverified"] is True
    assert detail.json()["status"] == "to_verify"
    assert detail.json()["operational"] is False
    review = app_client.get("/api/workspace/deadlines/review", headers=headers)
    assert review.status_code == 200, review.text
    rec = next(d for d in review.json()["items"] if d["reminder_id"] == "deadline-historic")
    assert rec["legacy_historical"] is True
    assert rec["confirmed_by_user"] is False
    ics = app_client.get("/api/workspace/calendar.ics", headers=headers)
    assert ics.status_code == 200
    assert "Data Decadenza Beneficio Termine" not in ics.text
    # It cannot be restored without explicit owner confirmation.
    blocked = app_client.put("/api/workspace/deadlines/deadline-historic/operational",
                             headers=headers, json={"excluded": False})
    assert blocked.status_code == 409
    confirmed = app_client.post("/api/workspace/deadlines/deadline-historic/confirm",
                                headers=headers, json={"notify": False})
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"
    after = app_client.get("/api/workspace/deadlines/review", headers=headers)
    assert next(d for d in after.json()["items"] if d["reminder_id"] == "deadline-historic")["confirmed_by_user"] is True


def test_operational_exclusion_removes_ics_and_dashboard_but_can_restore(app_client):
    headers = auth("alice")
    url = "/api/workspace/deadlines/deadline-alice/operational"
    before = app_client.get("/api/workspace/calendar.ics", headers=headers)
    assert "Scadenza test A" in before.text
    assert app_client.put(url, headers=auth("bob"), json={"excluded": True}).status_code == 404
    excluded = app_client.put(url, headers=headers, json={
        "excluded": True, "reason": "Notifica non più necessaria"})
    assert excluded.status_code == 200
    assert excluded.json()["excluded"] is True
    review = app_client.get("/api/workspace/deadlines/review", headers=headers).json()
    assert any(x["reminder_id"] == "deadline-alice" and x["operational_excluded"] for x in review["items"])
    assert "Scadenza test A" not in app_client.get("/api/workspace/calendar.ics", headers=headers).text
    overview = app_client.get("/api/workspace/overview", headers=headers).json()
    assert not any(p.get("reminder_id") == "deadline-alice" for p in overview["priorities"])
    restored = app_client.put(url, headers=headers, json={"excluded": False})
    assert restored.status_code == 200, restored.text
    assert "Scadenza test A" in app_client.get("/api/workspace/calendar.ics", headers=headers).text


def test_legal_demand_date_is_reviewable_but_not_silently_suppressed(app_client):
    headers = auth("alice")
    review = app_client.get("/api/workspace/deadlines/review", headers=headers)
    assert review.status_code == 200
    candidate = next(x for x in review.json()["items"] if x["reminder_id"] == "deadline-legal")
    assert candidate["legal_date_review"] is True
    assert candidate["legacy_historical"] is False
    page = app_client.get("/api/workspace/priorities/deadline/deadline-legal", headers=headers)
    assert page.status_code == 200
    assert page.json()["legal_date_review"] is True
    assert page.json()["operational"] is True
    response = app_client.put("/api/workspace/deadlines/deadline-legal/operational",
                              headers=headers, json={"excluded": True, "reason": "Test"})
    assert response.status_code == 200
    after = app_client.get("/api/workspace/priorities/deadline/deadline-legal", headers=headers)
    assert after.json()["operational"] is False


def test_report_pec_address_does_not_become_the_contact_email(app_client, report_outbox):
    client_path = "/api/workspace/clients/client-alice"
    headers = auth("alice")
    missing = app_client.post(f"{client_path}/report/send", headers=headers, json={"channel": "pec"})
    assert missing.status_code == 400
    assert report_outbox == []

    pec = "report@pec.example.invalid"
    sent = app_client.post(f"{client_path}/report/send", headers=headers, json={"channel": "pec", "to": pec})
    assert sent.status_code == 200, sent.text
    assert report_outbox == [pec]
    profile = app_client.get(client_path, headers=headers)
    assert profile.json()["client"]["email"] == ""

    email = "client@example.invalid"
    sent = app_client.post(f"{client_path}/report/send", headers=headers, json={"to": email})
    assert sent.status_code == 200, sent.text
    assert report_outbox == [pec, email]
    assert app_client.get(client_path, headers=headers).json()["client"]["email"] == email


def test_professional_can_delete_owned_analysis_and_preserve_manual_deadline(app_client):
    db = app_client.app.state.test_db
    db.reminders.insert_one({"user_id": "alice", "analysis_id": "doc-alice", "reminder_id": "manual", "source": "manual"})
    db.multi_document_audits.insert_one({"user_id": "alice", "documents": [{"analysis_id": "doc-alice"}]})
    db.workspace_priority_reads.insert_one({"user_id": "alice", "priority_key": "document:doc-alice"})
    url = "/api/workspace/documents/doc-alice"
    assert app_client.delete(url).status_code == 401
    assert app_client.delete(url, headers=auth("bob")).status_code == 404
    assert app_client.delete(url, headers=auth("alice")).status_code == 200
    assert app_client.get(url, headers=auth("alice")).status_code == 404
    assert app_client.get("/api/workspace/documents/doc-bob", headers=auth("bob")).status_code == 200
    assert db.reminders.count_documents({"user_id": "alice", "analysis_id": "doc-alice"}) == 0
    assert db.reminders.find_one({"reminder_id": "manual"})["source"] == "manual"
    assert db.clients.find_one({"client_id": "client-alice"})
    assert not db.multi_document_audits.find_one({"user_id": "alice"})
    assert not db.workspace_priority_reads.find_one({"user_id": "alice"})


def test_retention_simulation_protects_recent_and_unknown_activity(app_client):
    from datetime import datetime, timezone

    db = app_client.app.state.test_db
    now = datetime.now(timezone.utc).isoformat()
    old = "2000-01-01T00:00:00+00:00"
    db.users.insert_many([
        {"user_id": "workspace-active", "email": "active@example.invalid", "created_at": old, "last_activity_at": now},
        {"user_id": "recorded-inactive", "email": "stale@example.invalid", "created_at": old, "last_activity_at": old},
        {"user_id": "legacy-unknown", "email": "unknown@example.invalid", "created_at": old},
    ])
    response = app_client.get("/api/admin/privacy/retention-simulation", headers={"X-Admin-Token": "synthetic-privacy-admin"})
    assert response.status_code == 200, response.text
    assert response.json()["registered_accounts_inactive"] == 1
    assert response.json()["registered_accounts_activity_unknown"] == 1
    assert db.users.count_documents({}) == 3
