"""PR7 synthetic staging integration tests with the REAL workspace router and fake accounts.

No production server, real keys, paid calls or external networking.
MongoDB must be available at PR7_TEST_MONGO_URL.
"""
import os
import importlib
import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient


@pytest.fixture(scope="module")
def staged():
    os.environ["APP_ENV"] = "test"
    os.environ["PR7_LOCAL_STAGING"] = "1"
    os.environ["STAGING_MONGO_URI"] = os.getenv("PR7_TEST_MONGO_URL", "mongodb://127.0.0.1:27017")
    for variable in ("EMERGENT_LLM_KEY", "STRIPE_API_KEY", "PAYPAL_SECRET", "RESEND_API_KEY"):
        assert not os.getenv(variable), f"Unsafe external secret in isolated CI: {variable}"
    staged_app = importlib.import_module("staging_local")
    sync = MongoClient(os.environ["STAGING_MONGO_URI"], serverSelectionTimeoutMS=2500)
    # This dedicated synthetic database is always disposable.
    sync.drop_database(staged_app.DB_NAME)
    try:
        with TestClient(staged_app.app) as http:
            yield http
    finally:
        sync.drop_database(staged_app.DB_NAME)
        sync.close()


def _login(http, name):
    r = http.post("/api/auth/login", json={
        "email": f"studio-{name}@demo.invalid", "password": "synthetic-local-only"})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_synthetic_login_workspace_qr_pdf_and_account_isolation(staged):
    assert staged.get("/api/pr7-staging/status").json()["billable_integrations"] is False
    assert staged.get("/api/workspace/overview").status_code == 401
    alice, bob = _login(staged, "a"), _login(staged, "b")
    overview = staged.get("/api/workspace/overview", headers=alice)
    assert overview.status_code == 200, overview.text
    assert any(p["analysis_id"] == "pr7-analysis-a" for p in overview.json()["priorities"])
    assert all(p.get("analysis_id") != "pr7-analysis-b" for p in overview.json()["priorities"])
    assert staged.get("/api/workspace/priorities/document/pr7-analysis-a", headers=bob).status_code == 404
    detail = staged.get("/api/workspace/priorities/document/pr7-analysis-a", headers=alice)
    assert detail.status_code == 200
    qr = staged.get("/api/workspace/priorities/document/pr7-analysis-a/qr", headers=alice)
    assert qr.status_code == 200 and qr.content.startswith(bytes((137, 80, 78, 71)))
    pdf = staged.get("/api/workspace/priorities/document/pr7-analysis-a/pdf", headers=alice)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    update = staged.put("/api/workspace/priorities/read-state", headers=alice, json={
        "type": "document", "item_id": "pr7-analysis-a", "is_read": True})
    assert update.status_code == 200
    assert any(p["is_read"] for p in staged.get("/api/workspace/overview", headers=alice).json()["priorities"]
               if p["analysis_id"] == "pr7-analysis-a")


def test_no_paid_services_and_no_external_llm(staged):
    alice = _login(staged, "a")
    for method, path in (
        ("POST", "/api/workspace/copilot/ask"),
        ("POST", "/api/workspace/audits"),
        ("POST", "/api/workspace/digest/preview"),
        ("POST", "/api/workspace/clients/pr7-client-a/report/send"),
        ("POST", "/api/payments/checkout"),
        ("POST", "/api/analyze"),
    ):
        response = staged.request(method, path, headers=alice, json={})
        assert response.status_code == 503, (method, path, response.status_code)
    assert staged.post("/api/auth/login", json={
        "email": "studio-a@demo.invalid", "password": "wrong"}).status_code == 401


def test_synthetic_deadline_exclusion_is_reversible(staged):
    a = _login(staged, "a")
    r = staged.get("/api/workspace/calendar.ics", headers=a)
    assert r.status_code == 200
    assert "Scadenza sintetica A" in r.text
    excluded = staged.put("/api/workspace/deadlines/pr7-deadline-a/operational",
                           headers=a, json={"excluded": True, "reason": "Staging test"})
    assert excluded.status_code == 200
    assert "Scadenza sintetica A" not in staged.get("/api/workspace/calendar.ics", headers=a).text
    reviewed = staged.get("/api/workspace/deadlines/review", headers=a)
    assert any(p["reminder_id"] == "pr7-deadline-a" for p in reviewed.json()["items"])
    restored = staged.put("/api/workspace/deadlines/pr7-deadline-a/operational",
                          headers=a, json={"excluded": False})
    assert restored.status_code == 200
