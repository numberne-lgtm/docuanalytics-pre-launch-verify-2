"""Security-audit regression suite (SEC-002 BOLA, rate-limits, webhook signature,
generic 500s) + regression of legitimate flows (anonymous session, analyze, chat,
register, login, subscriptions/referral).

All tests live in ONE class on purpose: pytest.ini uses -n 2 --dist loadscope, so a
single class is pinned to one worker and executes in declaration order (the rate-limit
tests MUST run last because they burn the per-IP budget).
"""
import base64
import io
import os
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

RANDOM_UUID = str(uuid.uuid4())


def _doc_png() -> str:
    """Small but real invoice-like PNG (text, lines, edges) as base64."""
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (760, 520), (252, 252, 250))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 740, 500], outline=(30, 30, 60), width=3)
    d.text((40, 45), "FATTURA N. 2026/0147", fill=(10, 10, 40))
    d.text((40, 75), "Studio Rossi S.r.l. - P.IVA IT01234567890", fill=(20, 20, 20))
    d.text((40, 100), "Via Roma 12, 20121 Milano (MI)", fill=(20, 20, 20))
    d.text((40, 140), "Cliente: Bianchi & Partners - P.IVA IT09876543210", fill=(20, 20, 20))
    d.text((40, 170), "Data: 12/03/2026   Scadenza: 11/04/2026", fill=(20, 20, 20))
    d.line([40, 200, 720, 200], fill=(60, 60, 90), width=2)
    d.text((40, 220), "Descrizione                 Qta    Prezzo     Totale", fill=(0, 0, 0))
    d.text((40, 250), "Consulenza fiscale           10    100,00   1.000,00", fill=(0, 0, 0))
    d.text((40, 275), "Revisione bilancio            5    120,00     600,00", fill=(0, 0, 0))
    d.line([40, 305, 720, 305], fill=(60, 60, 90), width=2)
    d.text((40, 325), "Imponibile: 1.600,00 EUR", fill=(0, 0, 0))
    d.text((40, 350), "IVA 22%: 352,00 EUR", fill=(0, 0, 0))
    d.text((40, 375), "TOTALE: 1.952,00 EUR", fill=(120, 0, 0))
    d.text((40, 420), "IBAN: IT60X0542811101000000123456", fill=(0, 0, 0))
    d.rectangle([560, 330, 700, 400], outline=(120, 120, 160), width=2)
    d.text((575, 355), "TIMBRO", fill=(120, 120, 160))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# shared state across the ordered test class
STATE = {}


class TestSecurityAudit:

    # ---------- basics ----------
    def test_00_health(self, client):
        r = client.get(f"{API}/", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ok"

    # ---------- REGRESSION: anonymous session ----------
    def test_01_anonymous_session_grants_3_credits(self, client):
        r = client.post(f"{API}/session", json={}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("user_id"), str) and len(d["user_id"]) > 10
        assert d["credits"] == 3, f"expected 3 free credits, got {d.get('credits')}"
        assert d.get("email") is None
        STATE["anon_id"] = d["user_id"]

    def test_02_reusing_session_does_not_add_credits(self, client):
        uid = STATE["anon_id"]
        for _ in range(3):
            r = client.post(f"{API}/session", json={"user_id": uid}, timeout=30)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["user_id"] == uid
            assert d["credits"] == 3, f"credit farming! credits={d['credits']}"

    # ---------- REGRESSION: anonymous analyze (consumes 1 credit + Gemini) ----------
    def test_03_anonymous_analyze(self, client):
        payload = {"user_id": STATE["anon_id"], "doc_type": "auto",
                   "filename": "TEST_fattura.png", "mime_type": "image/png",
                   "file_base64": f"data:image/png;base64,{_doc_png()}"}
        r = client.post(f"{API}/analyze", json=payload, timeout=180)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:600]}"
        d = r.json()
        assert isinstance(d.get("analysis_id"), str)
        res = d.get("result") or {}
        assert res.get("doc_type"), f"no doc_type in result: {res}"
        assert res.get("summary"), "empty summary"
        assert isinstance(res.get("fields"), list)
        assert d["credits"] == 2, f"credit not decremented correctly: {d['credits']}"
        STATE["analysis_id"] = d["analysis_id"]

        g = client.get(f"{API}/session/{STATE['anon_id']}", timeout=30)
        assert g.status_code == 200
        assert g.json()["credits"] == 2

    # ---------- REGRESSION: anonymous copilot ----------
    def test_04_anonymous_chat(self, client):
        r = client.post(f"{API}/chat", json={
            "user_id": STATE["anon_id"], "analysis_id": STATE["analysis_id"],
            "question": "Qual e' l'importo totale della fattura?"}, timeout=180)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:600]}"
        ans = r.json().get("answer")
        assert isinstance(ans, str) and len(ans) > 5, f"empty copilot answer: {ans!r}"

    # ---------- REGRESSION: register (upgrade anonymous, credits preserved) ----------
    def test_05_register_preserves_credits(self, client):
        email = f"test_sec_{uuid.uuid4().hex[:10]}@example.com"
        pwd = "secret123"
        r = client.post(f"{API}/auth/register", json={
            "email": email, "password": pwd, "name": "TEST Sec",
            "user_id": STATE["anon_id"]}, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        d = r.json()
        assert d.get("token"), "no token returned"
        u = d["user"]
        assert u["email"] == email
        assert u["user_id"] == STATE["anon_id"], "anonymous account was not upgraded"
        assert u["credits"] == 2, f"credits not preserved on register: {u['credits']}"
        assert u.get("referral_code")
        STATE.update({"email": email, "pwd": pwd, "token": d["token"], "reg_id": u["user_id"]})

    def test_06_authenticated_gets(self, client):
        h = {"Authorization": f"Bearer {STATE['token']}"}
        me = client.get(f"{API}/auth/me", headers=h, timeout=30)
        assert me.status_code == 200, me.text
        assert me.json()["user"]["email"] == STATE["email"]

        s = client.get(f"{API}/subscriptions/{STATE['reg_id']}", headers=h, timeout=60)
        assert s.status_code == 200, s.text
        assert isinstance(s.json().get("subscriptions"), list)

        rf = client.get(f"{API}/referral/{STATE['reg_id']}", headers=h, timeout=30)
        assert rf.status_code == 200, rf.text
        assert rf.json().get("referral_code")

    # ---------- REGRESSION: login ----------
    def test_07_login_ok_and_wrong_password(self, client):
        r = client.post(f"{API}/auth/login", json={
            "email": STATE["email"], "password": STATE["pwd"]}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("token")
        assert r.json()["user"]["credits"] == 2
        STATE["token"] = r.json()["token"]

        bad = client.post(f"{API}/auth/login", json={
            "email": STATE["email"], "password": "wrongpass999"}, timeout=30)
        assert bad.status_code == 401, f"expected 401, got {bad.status_code}: {bad.text[:200]}"

    # ---------- SEC-002 BOLA: registered user_id in body, NO token -> 401 ----------
    @pytest.mark.parametrize("path,body", [
        ("/analyze", {"doc_type": "auto", "filename": "x.png", "mime_type": "image/png",
                      "file_base64": "aGVsbG8="}),
        ("/chat", {"analysis_id": "any", "question": "ciao"}),
        ("/paypal/order", {"package_id": "starter"}),
        ("/payments/checkout", {"package_id": "starter", "origin_url": "https://example.com"}),
        ("/subscriptions/cancel", {"subscription_id": "sub_fake"}),
        ("/crypto/order", {"package_id": "starter", "coin": "BTC"}),
    ])
    def test_08_bola_without_token_is_401(self, client, path, body):
        payload = dict(body)
        payload["user_id"] = STATE["reg_id"]
        r = client.post(f"{API}{path}", json=payload, timeout=90)
        assert r.status_code == 401, f"{path} -> {r.status_code} (expected 401): {r.text[:300]}"

    def test_09_credits_untouched_after_bola_attempts(self, client):
        h = {"Authorization": f"Bearer {STATE['token']}"}
        me = client.get(f"{API}/auth/me", headers=h, timeout=30)
        assert me.status_code == 200
        assert me.json()["user"]["credits"] == 2, "credits changed during BOLA attempts!"

    # ---------- SEC-002 positive: same endpoints with valid token ----------
    def test_10_checkout_with_token(self, client):
        h = {"Authorization": f"Bearer {STATE['token']}"}
        r = client.post(f"{API}/payments/checkout", headers=h, json={
            "user_id": RANDOM_UUID,  # spoofed body id must be ignored
            "package_id": "starter", "origin_url": BASE_URL}, timeout=90)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        d = r.json()
        assert d.get("checkout_url", "").startswith("http"), d
        assert d.get("session_id")

    def test_11_paypal_order_with_token(self, client):
        h = {"Authorization": f"Bearer {STATE['token']}"}
        r = client.post(f"{API}/paypal/order", headers=h, json={
            "user_id": RANDOM_UUID, "package_id": "starter"}, timeout=90)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        assert r.json().get("order_id")

    def test_12_cancel_subscription_not_found_with_token(self, client):
        h = {"Authorization": f"Bearer {STATE['token']}"}
        r = client.post(f"{API}/subscriptions/cancel", headers=h, json={
            "user_id": RANDOM_UUID, "subscription_id": f"sub_{uuid.uuid4().hex[:12]}"}, timeout=60)
        assert r.status_code == 404, f"expected 404 for unknown sub, got {r.status_code}: {r.text[:200]}"

    def test_13_invalid_token_is_401(self, client):
        h = {"Authorization": "Bearer not.a.valid.jwt"}
        r = client.post(f"{API}/payments/checkout", headers=h, json={
            "user_id": STATE["reg_id"], "package_id": "starter", "origin_url": BASE_URL}, timeout=60)
        assert r.status_code == 401, f"{r.status_code}: {r.text[:200]}"

    # ---------- SEC: protected GETs ----------
    def test_14_get_subscriptions_referral_require_token(self, client):
        for path in (f"/subscriptions/{RANDOM_UUID}", f"/referral/{RANDOM_UUID}"):
            r = client.get(f"{API}{path}", timeout=30)
            assert r.status_code == 401, f"{path} -> {r.status_code} (expected 401): {r.text[:200]}"

    def test_15_get_with_token_ignores_path_uuid(self, client):
        h = {"Authorization": f"Bearer {STATE['token']}"}
        r = client.get(f"{API}/referral/{RANDOM_UUID}", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        mine = client.get(f"{API}/referral/{STATE['reg_id']}", headers=h, timeout=30).json()
        assert r.json()["referral_code"] == mine["referral_code"], "path uuid not ignored"
        s = client.get(f"{API}/subscriptions/{RANDOM_UUID}", headers=h, timeout=60)
        assert s.status_code == 200, s.text
        assert isinstance(s.json()["subscriptions"], list)

    # ---------- SEC: stripe webhook signature ----------
    def test_16_stripe_webhook_requires_signature(self, client):
        fake = {"id": "evt_test", "type": "checkout.session.completed",
                "data": {"object": {"id": "cs_test_fake", "payment_status": "paid",
                                    "metadata": {"user_id": STATE["reg_id"], "credits": "500"}}}}
        r = client.post(f"{API}/webhook/stripe", json=fake, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"
        h = {"Authorization": f"Bearer {STATE['token']}"}
        me = client.get(f"{API}/auth/me", headers=h, timeout=30)
        assert me.json()["user"]["credits"] == 2, "webhook credited credits without signature!"

    # ---------- SEC: generic error messages ----------
    def test_17_analyze_error_is_generic(self, client):
        h = {"Authorization": f"Bearer {STATE['token']}"}
        r = client.post(f"{API}/analyze", headers=h, json={
            "user_id": STATE["reg_id"], "doc_type": "auto", "filename": "broken.png",
            "mime_type": "image/png", "file_base64": "!!!not-valid-base64!!!"}, timeout=90)
        assert r.status_code == 500, f"expected 500, got {r.status_code}: {r.text[:300]}"
        body = r.text.lower()
        for leak in ("traceback", "file \"/app", "binascii", "line ", "exception:", "emergentintegrations"):
            assert leak not in body, f"internal detail leaked ({leak}): {r.text[:400]}"
        assert "errore" in body
        me = client.get(f"{API}/auth/me", headers=h, timeout=30)
        assert me.json()["user"]["credits"] == 2, "credit consumed on failed analyze"

    # ---------- SEC: rate limits (MUST BE LAST) ----------
    def test_98_login_rate_limit(self, client):
        codes = []
        for _ in range(13):
            r = client.post(f"{API}/auth/login", json={
                "email": f"nobody_{uuid.uuid4().hex[:6]}@example.com",
                "password": "whatever123"}, timeout=30)
            codes.append(r.status_code)
            if r.status_code == 429:
                break
            time.sleep(0.2)
        assert 429 in codes, f"no rate limit on login, codes={codes}"
        assert codes.count(401) <= 10, f"more than 10 attempts allowed: {codes}"

    def test_99_register_rate_limit(self, client):
        # invalid emails -> 400 (no DB pollution) but still consume the per-IP budget
        codes = []
        for _ in range(8):
            r = client.post(f"{API}/auth/register", json={
                "email": "not-an-email", "password": "short"}, timeout=30)
            codes.append(r.status_code)
            if r.status_code == 429:
                break
            time.sleep(0.2)
        assert 429 in codes, f"no rate limit on register, codes={codes}"
