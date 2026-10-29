# Pre-deploy regression (iteration 31): auth, packages, reminders, referral, payments (no pay),
# admin gating, assistant config, QR assets, public routes. NO real AI calls, NO email sends.
import os
import uuid
import pytest
import requests
import numpy as np

BASE_URL = None
with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")


def _admin_token():
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("ADMIN_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"')
    return None


ADMIN = _admin_token()
STATE = {}
EMAIL = os.environ.get("PREDEPLOY_EMAIL") or f"test_predeploy_{uuid.uuid4().hex[:8]}@example.com"
PWD = "Test12345"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def auth(s):
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": EMAIL, "password": PWD})
    if r.status_code == 409:
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PWD})
    if r.status_code != 200:
        pytest.skip(f"register/login failed {r.status_code} {r.text[:200]}")
    d = r.json()
    STATE["uid"] = d["user"]["user_id"]
    return {"Authorization": f"Bearer {d['token']}"}


# --- health / session
def test_root(s):
    r = s.get(f"{BASE_URL}/api/")
    assert r.status_code == 200 and r.json()["status"] == "ok"


# --- auth
def test_register_me_login(s, auth):
    r = s.get(f"{BASE_URL}/api/auth/me", headers=auth)
    assert r.status_code == 200
    me = r.json()
    me = me.get("user", me)
    assert me["email"] == EMAIL
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PWD})
    assert r.status_code == 200 and r.json()["token"]
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": "wrongpass"})
    assert r.status_code == 401
    assert s.get(f"{BASE_URL}/api/auth/me").status_code == 401


# --- packages prices
def test_packages_prices(s):
    p = {x["id"]: x["amount"] for x in s.get(f"{BASE_URL}/api/packages").json()["packages"]}
    assert (p["starter"], p["pro"], p["enterprise"]) == (19.0, 49.0, 149.0)
    assert (p["sub_single"], p["sub_pro"], p["sub_unlimited"]) == (29.0, 99.0, 299.0)


# --- legacy reminders CRUD
def test_reminders_crud(s, auth):
    r = s.post(f"{BASE_URL}/api/reminders", headers=auth,
               json={"label": "TEST_scadenza", "due_date": "2030-12-31", "notify_days": [7, 1]})
    assert r.status_code == 200, r.text
    rid = r.json()["reminder_id"]
    lst = s.get(f"{BASE_URL}/api/reminders", headers=auth).json()["reminders"]
    assert any(x["reminder_id"] == rid and x["label"] == "TEST_scadenza" for x in lst)
    assert s.delete(f"{BASE_URL}/api/reminders/{rid}", headers=auth).json()["ok"] is True
    lst = s.get(f"{BASE_URL}/api/reminders", headers=auth).json()["reminders"]
    assert not any(x["reminder_id"] == rid for x in lst)


# --- referral
def test_referral(s, auth):
    r = s.get(f"{BASE_URL}/api/referral/{STATE['uid']}", headers=auth)
    assert r.status_code == 200
    d = r.json()
    assert d["referral_code"] and d["bonus_per_invite"] == 5


# --- stripe checkout (session only, no payment)
def test_stripe_checkout_session(s, auth):
    r = s.post(f"{BASE_URL}/api/payments/checkout", headers=auth,
               json={"package_id": "starter", "origin_url": BASE_URL, "user_id": STATE["uid"]})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["checkout_url"].startswith("https://checkout.stripe.com") and d["session_id"].startswith("cs_")
    st = s.get(f"{BASE_URL}/api/payments/status/{d['session_id']}")
    assert st.status_code == 200
    r = s.post(f"{BASE_URL}/api/payments/checkout", headers=auth,
               json={"package_id": "nope", "origin_url": BASE_URL, "user_id": STATE["uid"]})
    assert r.status_code == 400


def test_paypal_crypto_config(s):
    assert s.get(f"{BASE_URL}/api/paypal/config").status_code == 200
    r = s.get(f"{BASE_URL}/api/crypto/info")
    assert r.status_code == 200


# --- admin gating
@pytest.mark.parametrize("path", ["/api/assistant/stats", "/api/admin/privacy/config",
                                  "/api/admin/privacy/requests", "/api/admin/privacy/log"])
def test_admin_gating(s, path):
    assert s.get(f"{BASE_URL}{path}").status_code == 401
    assert s.get(f"{BASE_URL}{path}", headers={"X-Admin-Token": "wrong"}).status_code == 401
    r = s.get(f"{BASE_URL}{path}", headers={"X-Admin-Token": ADMIN})
    assert r.status_code == 200, r.text[:200]


def test_admin_privacy_deletion_disabled(s):
    d = s.get(f"{BASE_URL}/api/admin/privacy/config", headers={"X-Admin-Token": ADMIN}).json()
    assert d["deletion_enabled"] is False


def test_assistant_config(s):
    r = s.get(f"{BASE_URL}/api/assistant/config")
    assert r.status_code == 200
    d = r.json()
    assert d["available"] is True and len(d["packages"]) == 6


# --- QR assets
QR = ["docuanalytics-assistant-qr.png", "docuanalytics-assistant-qr-web.png", "docuanalytics-assistant-qr.svg"] + \
     [f"docuanalytics-assistant-{k}.{e}" for k in ["linkedin", "facebook", "instagram", "brochure", "presentazione"]
      for e in ["png", "svg"]]


@pytest.mark.parametrize("name", QR)
def test_qr_assets(s, name):
    r = s.get(f"{BASE_URL}/assistant-qr/{name}")
    assert r.status_code == 200
    if name.endswith(".svg"):
        assert b"<svg" in r.content[:2000]
        return
    assert r.content[:4] == b"\x89PNG"
    import cv2
    img = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
    det = cv2.QRCodeDetector()
    data = ""
    for scale in (1.0, 0.5, 2.0, 0.25):
        im = cv2.resize(img, None, fx=scale, fy=scale) if scale != 1.0 else img
        data, _, _ = det.detectAndDecode(im)
        if data:
            break
    STATE.setdefault("qr", {})[name] = data
    assert data.startswith("https://docuanalytics.online/assistant"), f"decoded: {data!r}"


# --- workspace anon blocked
def test_workspace_anon_blocked(s, auth):
    assert s.get(f"{BASE_URL}/api/workspace/overview").status_code == 401
    r = s.get(f"{BASE_URL}/api/workspace/overview", headers=auth)
    assert r.status_code == 200


# --- public routes (SPA)
@pytest.mark.parametrize("path", ["/", "/assistant", "/privacy", "/blog", "/area", "/commercialisti", "/avvocati",
                                  "/notai", "/cfo", "/hr", "/admin/assistant", "/admin/privacy"])
def test_spa_routes(s, path):
    assert s.get(f"{BASE_URL}{path}").status_code == 200
