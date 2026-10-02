"""Iteration 19 — Google auth add-on + regression on email/password + anonymous session."""
import os
import uuid
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"


def test_anonymous_session_grants_credits():
    r = requests.post(f"{API}/session", json={}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "user_id" in data
    assert isinstance(data.get("credits"), int) and data["credits"] >= 1


def _ensure_mario():
    # Try login first
    r = requests.post(f"{API}/auth/login",
                      json={"email": "mario@studio.it", "password": "secret123"}, timeout=20)
    if r.status_code == 200:
        return r.json()
    # Register
    r = requests.post(f"{API}/auth/register",
                      json={"email": "mario@studio.it", "password": "secret123", "name": "Mario"},
                      timeout=20)
    assert r.status_code in (200, 201, 409), r.text
    if r.status_code == 409:
        r2 = requests.post(f"{API}/auth/login",
                           json={"email": "mario@studio.it", "password": "secret123"}, timeout=20)
        assert r2.status_code == 200, r2.text
        return r2.json()
    return r.json()


def test_login_returns_token_and_picture_field():
    body = _ensure_mario()
    assert "token" in body and body["token"]
    user = body["user"]
    assert user["email"] == "mario@studio.it"
    # picture field must be present (may be None)
    assert "picture" in user, f"user missing 'picture' key: {user}"


def test_auth_me_with_bearer_token():
    body = _ensure_mario()
    tok = body["token"]
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=20)
    assert r.status_code == 200, r.text
    user = r.json()["user"]
    assert user["email"] == "mario@studio.it"
    assert "picture" in user


def test_google_invalid_session_returns_401():
    r = requests.post(f"{API}/auth/google", json={"session_id": "invalid-xyz-" + uuid.uuid4().hex},
                      timeout=30)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"


def test_google_empty_session_returns_400():
    r = requests.post(f"{API}/auth/google", json={"session_id": ""}, timeout=20)
    assert r.status_code == 400, r.text


def test_register_fresh_user_autologin_with_credits():
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "secret123"}, timeout=20)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body.get("token")
    user = body["user"]
    assert user["email"] == email
    assert user.get("credits", 0) >= 3
    assert "picture" in user
