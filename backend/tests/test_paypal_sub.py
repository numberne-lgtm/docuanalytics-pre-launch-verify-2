import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
# Fall back: read from /app/frontend/.env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")


def _post(path, payload, retries=1):
    url = f"{BASE_URL}{path}"
    last = None
    for _ in range(retries + 1):
        r = requests.post(url, json=payload, timeout=45)
        last = r
        if r.status_code != 502 or "PayPal" not in (r.text or ""):
            return r
    return last


# ---- PayPal subscription plan creation ----
@pytest.mark.parametrize("pkg", ["sub_single", "sub_pro", "sub_unlimited"])
def test_create_sub_plan_returns_plan_id(pkg):
    r = _post("/api/paypal/subscription/plan", {"package_id": pkg}, retries=1)
    assert r.status_code == 200, f"{pkg} -> {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "plan_id" in data
    assert isinstance(data["plan_id"], str)
    assert data["plan_id"].startswith("P-"), data
    assert data["package_id"] == pkg


def test_create_sub_plan_rejects_one_time_pack():
    r = _post("/api/paypal/subscription/plan", {"package_id": "starter"})
    assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:300]}"


# ---- Subscription activation with fake sub id ----
def test_activate_subscription_graceful_with_fake_id():
    r = _post("/api/paypal/subscription/activate",
              {"user_id": "qa2", "package_id": "sub_pro", "subscription_id": "I-FAKELIVE"})
    # Must NOT be 500; either 502 with the specific Italian detail, or 200 with credits_added=0.
    assert r.status_code != 500, f"server crashed: {r.text[:400]}"
    if r.status_code == 502:
        # Cloudflare ingress may replace 502 body with HTML; also verify against local backend.
        try:
            j = r.json()
            detail_ok = "Impossibile verificare" in (j.get("detail") or "")
        except Exception:
            detail_ok = False
        if not detail_ok:
            local = requests.post("http://localhost:8001/api/paypal/subscription/activate",
                                  json={"user_id": "qa2", "package_id": "sub_pro",
                                        "subscription_id": "I-FAKELIVE"}, timeout=30)
            assert local.status_code == 502, local.text[:300]
            assert "Impossibile verificare" in (local.json().get("detail") or ""), local.text[:300]
    elif r.status_code == 200:
        j = r.json()
        assert j.get("credits_added", 0) == 0
    else:
        # allow 4xx but not 5xx crash
        assert 400 <= r.status_code < 500, f"unexpected: {r.status_code} {r.text[:300]}"


# ---- Webhook ----
def test_webhook_ping_returns_ok():
    r = _post("/api/webhook/paypal", {"event_type": "PING", "resource": {}})
    assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
    assert r.json().get("status") == "ok"
