"""PoC: self-referral credit farming via spoofed X-Forwarded-For (same real client)."""
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


def _register(client, xff):
    email = f"test_farm_{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{API}/auth/register", headers={"X-Forwarded-For": xff},
                    json={"email": email, "password": "secret123"}, timeout=60)
    return email, r


def test_self_referral_blocked_for_same_client(client):
    _, r1 = _register(client, "192.0.2.11")
    assert r1.status_code == 200, r1.text
    inviter = r1.json()
    code = inviter["user"]["referral_code"]
    base_credits = inviter["user"]["credits"]

    _, r2 = _register(client, "192.0.2.12")  # same real client, different spoofed IP
    assert r2.status_code == 200, r2.text
    invitee = r2.json()

    me = client.get(f"{API}/auth/me",
                    headers={"Authorization": f"Bearer {inviter['token']}"}, timeout=30).json()
    print("inviter credits before invite:", base_credits, "after:", me["user"]["credits"])

    # now redeem the referral with a third spoofed IP
    _, r3 = _register(client, "192.0.2.13")
    assert r3.status_code == 200, r3.text
    email4 = f"test_farm_{uuid.uuid4().hex[:8]}@example.com"
    r4 = client.post(f"{API}/auth/register", headers={"X-Forwarded-For": "192.0.2.14"},
                     json={"email": email4, "password": "secret123", "ref": code}, timeout=60)
    assert r4.status_code == 200, r4.text
    invitee_credits = r4.json()["user"]["credits"]
    me2 = client.get(f"{API}/auth/me",
                     headers={"Authorization": f"Bearer {inviter['token']}"}, timeout=30).json()
    print("invitee credits:", invitee_credits, "| inviter credits now:", me2["user"]["credits"])
    assert not (invitee_credits > 3 and me2["user"]["credits"] > base_credits), (
        "CREDIT FARMING: referral bonus paid to the same client by rotating X-Forwarded-For "
        f"(invitee={invitee_credits}, inviter={me2['user']['credits']})")
