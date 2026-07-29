"""Auth (register/login/me) + referral tests for DocuAnalytics AI."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pre-launch-verify-2.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _rand_email():
    return f"test+{uuid.uuid4().hex[:10]}@studio.it"


@pytest.fixture()
def anon_user():
    r = requests.post(f"{API}/session", json={})
    assert r.status_code == 200
    return r.json()


class TestRegister:
    def test_register_from_anon_preserves_credits(self, anon_user):
        email = _rand_email()
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "secret123", "name": "Mario",
            "user_id": anon_user["user_id"],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["token"] and isinstance(d["token"], str)
        u = d["user"]
        # preserves anon credits (3, not reset)
        assert u["credits"] == 3, f"expected 3 credits preserved, got {u['credits']}"
        assert u["user_id"] == anon_user["user_id"]
        assert u["email"] == email
        assert u["referral_code"] and len(u["referral_code"]) == 8

        # /auth/me works
        me = requests.get(f"{API}/auth/me",
                          headers={"Authorization": f"Bearer {d['token']}"})
        assert me.status_code == 200
        assert me.json()["user"]["email"] == email

    def test_register_duplicate_email_409(self, anon_user):
        email = _rand_email()
        requests.post(f"{API}/auth/register", json={
            "email": email, "password": "secret123", "user_id": anon_user["user_id"]})
        anon2 = requests.post(f"{API}/session", json={}).json()
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "secret123", "user_id": anon2["user_id"]})
        assert r.status_code == 409

    def test_register_short_password_400(self, anon_user):
        r = requests.post(f"{API}/auth/register", json={
            "email": _rand_email(), "password": "abc", "user_id": anon_user["user_id"]})
        assert r.status_code == 400

    def test_register_invalid_email_400(self, anon_user):
        r = requests.post(f"{API}/auth/register", json={
            "email": "notanemail", "password": "secret123", "user_id": anon_user["user_id"]})
        assert r.status_code == 400


class TestLogin:
    def test_login_success(self, anon_user):
        email = _rand_email()
        pwd = "secret123"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": pwd, "user_id": anon_user["user_id"]})
        assert r.status_code == 200

        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert r2.status_code == 200
        d = r2.json()
        assert d["token"]
        assert d["user"]["email"] == email

    def test_login_wrong_password_401(self, anon_user):
        email = _rand_email()
        requests.post(f"{API}/auth/register", json={
            "email": email, "password": "secret123", "user_id": anon_user["user_id"]})
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongpass"})
        assert r.status_code == 401

    def test_login_unknown_email_401(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": _rand_email(), "password": "whatever123"})
        assert r.status_code == 401


class TestAuthMe:
    def test_me_missing_token_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token_401(self):
        r = requests.get(f"{API}/auth/me",
                         headers={"Authorization": "Bearer garbage.token.value"})
        assert r.status_code == 401


class TestReferral:
    def test_referral_flow_bonuses(self):
        # Register A
        a_anon = requests.post(f"{API}/session", json={}).json()
        a_email = _rand_email()
        rA = requests.post(f"{API}/auth/register", json={
            "email": a_email, "password": "secret123", "user_id": a_anon["user_id"]})
        assert rA.status_code == 200
        A_uid = rA.json()["user"]["user_id"]
        A_ref = rA.json()["user"]["referral_code"]
        A_credits_before = rA.json()["user"]["credits"]  # 3

        # Register B with A's ref code from fresh anon
        b_anon = requests.post(f"{API}/session", json={}).json()
        b_email = _rand_email()
        rB = requests.post(f"{API}/auth/register", json={
            "email": b_email, "password": "secret123",
            "user_id": b_anon["user_id"], "ref": A_ref})
        assert rB.status_code == 200
        B_user = rB.json()["user"]
        # B started with 3 anon credits, +5 referral bonus = 8
        assert B_user["credits"] == 8, f"expected B credits=8, got {B_user['credits']}"

        # A credits should have increased by 5 -> 3+5=8
        sA = requests.get(f"{API}/session/{A_uid}")
        assert sA.status_code == 200
        assert sA.json()["credits"] == A_credits_before + 5

        # /referral/{A} shows invited_count incremented
        info = requests.get(f"{API}/referral/{A_uid}")
        assert info.status_code == 200
        d = info.json()
        assert d["referral_code"] == A_ref
        assert d["invited_count"] >= 1
        assert d["bonus_per_invite"] == 5

    def test_referral_invalid_code_no_bonus_no_crash(self):
        anon = requests.post(f"{API}/session", json={}).json()
        r = requests.post(f"{API}/auth/register", json={
            "email": _rand_email(), "password": "secret123",
            "user_id": anon["user_id"], "ref": "BOGUSXYZ"})
        assert r.status_code == 200
        # Still just 3 credits, no bonus
        assert r.json()["user"]["credits"] == 3
