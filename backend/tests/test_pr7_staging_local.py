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


def test_local_deadline_edit_persists_and_rejects_other_accounts(staged):
    a, b = _login(staged, "a"), _login(staged, "b")
    path = "/api/workspace/deadlines/pr7-deadline-a"
    change = {"label": "Scadenza sintetica A prova", "due_date": "2027-01-15", "notify_days": []}
    assert staged.patch(path, headers=b, json=change).status_code == 404
    assert staged.patch(path, json=change).status_code == 401
    edited = staged.patch(path, headers=a, json=change)
    assert edited.status_code == 200, edited.text
    assert edited.json()["label"] == change["label"]
    buckets = staged.get("/api/workspace/deadlines", headers=a).json()["buckets"]
    assert any(d["label"] == change["label"] for bucket in buckets.values() for d in bucket)
    assert change["label"] in staged.get("/api/workspace/calendar.ics", headers=a).text
    assert staged.patch(path, headers=a, json={"label": "Scadenza sintetica A"}).status_code == 200


def test_local_client_and_manual_deadline_lifecycle(staged):
    a, b = _login(staged, "a"), _login(staged, "b")
    c = staged.post("/api/workspace/clients", headers=a, json={"name": "Cliente test locale"})
    assert c.status_code == 200, c.text
    cid = c.json()["client_id"]
    cp = f"/api/workspace/clients/{cid}"
    assert staged.patch(cp, headers=b, json={"name": "Intruso"}).status_code == 404
    assert staged.delete(cp, headers=b).status_code == 404
    assert staged.patch(cp, headers=a, json={"name": "Cliente aggiornato"}).status_code == 200
    assert staged.get(cp, headers=a).json()["client"]["name"] == "Cliente aggiornato"
    candidates = "/api/workspace/documents/pr7-analysis-a/candidates"
    assert staged.get(candidates).status_code == 401
    assert staged.get(candidates, headers=b).status_code == 404
    panel = staged.get(candidates, headers=a)
    assert panel.status_code == 200, panel.text
    assert panel.json()["current_client_id"] == "pr7-client-a"
    assign = "/api/workspace/documents/pr7-analysis-a/assign"
    assert staged.post(assign, headers=b, json={"client_id": cid}).status_code == 404
    assert staged.post(assign, headers=a, json={"client_id": "pr7-client-b"}).status_code == 404
    assert staged.post(assign, headers=a, json={"client_id": cid}).status_code == 200
    assert staged.get("/api/workspace/documents/pr7-analysis-a", headers=a).json()["client_id"] == cid
    assert staged.post(assign, headers=a, json={"client_id": "pr7-client-a"}).status_code == 200
    d = staged.post("/api/workspace/deadlines", headers=a, json={
        "label": "Scadenza manuale di prova", "due_date": "2027-02-01",
        "client_id": cid, "notify_days": [], "notify_client": False})
    assert d.status_code == 200, d.text
    dp = f'/api/workspace/deadlines/{d.json()["reminder_id"]}'
    assert staged.delete(dp, headers=b).status_code == 404
    assert staged.delete(dp, headers=a).status_code == 200
    assert staged.patch(dp, headers=a, json={"label": "Rimossa"}).status_code == 404
    assert staged.delete(cp, headers=a).status_code == 200
    assert staged.get(cp, headers=a).status_code == 404


def test_local_metadata_reads_and_calendar_tokens_stay_blocked(staged):
    a = _login(staged, "a")
    for path in ("/studio", "/calendar/feed", "/clients/pr7-client-a/calendar/feed"):
        assert staged.get("/api/workspace" + path, headers=a).status_code == 200
        assert staged.get("/api/workspace" + path).status_code == 401
    for method, path in (("POST", "/calendar/feed"), ("DELETE", "/calendar/feed"),
                         ("POST", "/clients/pr7-client-a/calendar/feed"),
                         ("GET", "/feed/fake-token.ics"), ("POST", "/studio/logo")):
        assert staged.request(method, "/api/workspace" + path, headers=a).status_code == 503
