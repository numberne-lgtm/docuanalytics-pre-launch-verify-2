"""PR #7 isolated HTTP security regression tests. Never touch production data.

Run with local MongoDB at PR7_TEST_MONGO_URL=mongodb://127.0.0.1:27017
"""
import os
import uuid
import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from workspace.router import build_workspace_router

MONGO = os.getenv("PR7_TEST_MONGO_URL", "mongodb://127.0.0.1:27017")


@pytest.fixture()
def app_client():
    name = "pr7_test_" + uuid.uuid4().hex
    sync = MongoClient(MONGO, serverSelectionTimeoutMS=2000)
    sync.admin.command("ping")
    db = sync[name]
    db.analyses.insert_many([
        {"user_id": "alice", "analysis_id": "doc-alice", "filename": "alice.pdf",
         "created_at": "2026-11-06T00:00:00Z",
         "result": {"doc_type": "Contratto", "summary": "Documento sintetico",
                    "fields": [], "audit": [{"level": "warning", "message": "Dato da verificare"}]},
         "ws_synced": True, "risk_level": "medium"},
        {"user_id": "bob", "analysis_id": "doc-bob", "filename": "bob.pdf",
         "created_at": "2026-11-06T00:00:00Z",
         "result": {"doc_type": "Fattura", "summary": "Dati di Bob",
                    "fields": [], "audit": []},
         "ws_synced": True, "risk_level": "low"},
    ])
    db.clients.insert_many([
        {"user_id": "alice", "client_id": "client-alice", "name": "Cliente A", "email": ""},
        {"user_id": "bob", "client_id": "client-bob", "name": "Cliente B", "email": ""},
    ])
    db.reminders.insert_many([
        {"user_id": "alice", "reminder_id": "deadline-alice", "analysis_id": "doc-alice",
         "client_id": "client-alice", "status": "confirmed", "source": "manual",
         "due_date": "2027-04-30", "label": "Scadenza test A", "kind": "other", "active": True},
        {"user_id": "bob", "reminder_id": "deadline-bob", "analysis_id": "doc-bob",
         "client_id": "client-bob", "status": "confirmed", "source": "manual",
         "due_date": "2027-04-30", "label": "Scadenza test B", "kind": "other", "active": True},
    ])

    async def current_user(request: Request):
        token = request.headers.get("authorization", "").removeprefix("Bearer ")
        if token not in ("alice", "bob"):
            raise HTTPException(401, "Autenticazione richiesta")
        return {"user_id": token, "email": token + "@example.invalid"}

    async def email_sender(*args, **kwargs):
        raise AssertionError("No email should be sent during read-only HTTP tests")

    app = FastAPI()
    app.include_router(build_workspace_router(
        AsyncIOMotorClient(MONGO)[name], current_user, None, [30, 7, 1],
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
                                      "include_document_details": True}, headers=auth("alice")).status_code == 400
    # llm_key is absent, so even a valid request must fail closed without model/network calls.
    assert app_client.post(url, json={**base, "consent_to_ai": True},
                           headers=auth("alice")).status_code == 503
