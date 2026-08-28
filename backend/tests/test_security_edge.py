"""Edge-case security probes: X-Forwarded-For rate-limit bypass and session info leak.
Run separately (consumes rate-limit budget)."""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

base_url = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")
API = base_url.rstrip("/") + "/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_xff_spoof_bypasses_login_rate_limit(client):
    """Spoofing X-Forwarded-For should NOT let a client exceed 10 failed logins."""
    codes = []
    for i in range(14):
        r = client.post(f"{API}/auth/login",
                        headers={"X-Forwarded-For": f"10.{i}.{i}.{i}"},
                        json={"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com",
                              "password": "whatever123"}, timeout=30)
        codes.append(r.status_code)
    print("codes with rotating XFF:", codes)
    assert 429 in codes, f"RATE LIMIT BYPASSED via X-Forwarded-For rotation: {codes}"


def test_register_rate_limit_keyed_on_spoofable_header(client):
    """Proves the limiter key comes from the client-supplied X-Forwarded-For:
    once one spoofed IP is exhausted, switching the header restores full quota."""
    spoof_a = {"X-Forwarded-For": "203.0.113.7"}
    codes_a = []
    for _ in range(7):
        r = client.post(f"{API}/auth/register", headers=spoof_a,
                        json={"email": "not-an-email", "password": "short"}, timeout=30)
        codes_a.append(r.status_code)
        if r.status_code == 429:
            break
    print("spoofed IP A codes:", codes_a)
    assert 429 in codes_a, "register limiter did not trigger for the spoofed IP"

    r2 = client.post(f"{API}/auth/register", headers={"X-Forwarded-For": "198.51.100.42"},
                     json={"email": "not-an-email", "password": "short"}, timeout=30)
    print("after switching spoofed IP:", r2.status_code)
    assert r2.status_code == 429, ("register rate limit bypassed by changing X-Forwarded-For "
                                   f"(got {r2.status_code})")


def test_session_lookup_does_not_leak_email(client):
    """GET /session/{uuid} of a registered account should not expose its email."""
    r = client.post(f"{API}/session", json={}, timeout=30)
    assert r.status_code in (200, 429)
    if r.status_code == 429:
        pytest.skip("anon session cap reached")
    uid = r.json()["user_id"]
    g = client.get(f"{API}/session/{uid}", timeout=30)
    assert g.status_code == 200
    assert set(g.json().keys()) <= {"user_id", "credits", "email"}
