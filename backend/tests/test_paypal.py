"""PayPal integration tests (sandbox). Do NOT complete real PayPal buyer login."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


def test_paypal_config(s):
    r = s.get(f"{API}/paypal/config", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["enabled"] is True
    assert data["mode"] == "sandbox"
    assert data["currency"] == "EUR"
    assert data["client_id"].startswith("AdrLIW"), f"got client_id={data['client_id'][:12]}"


@pytest.fixture(scope="module")
def starter_order(s):
    # retry once on 502 due to network to PayPal via ingress
    last = None
    for _ in range(2):
        r = s.post(f"{API}/paypal/order", json={"user_id": "qa-uid-1", "package_id": "starter"}, timeout=60)
        last = r
        if r.status_code == 200:
            break
    assert last.status_code == 200, last.text
    data = last.json()
    assert data.get("order_id"), data
    return data["order_id"]


def test_paypal_order_starter(starter_order):
    assert isinstance(starter_order, str) and len(starter_order) > 0


def test_paypal_order_pro(s):
    for _ in range(2):
        r = s.post(f"{API}/paypal/order", json={"user_id": "qa-uid-1", "package_id": "pro"}, timeout=60)
        if r.status_code == 200:
            break
    assert r.status_code == 200, r.text
    assert r.json().get("order_id")


def test_paypal_order_subscription_rejected(s):
    r = s.post(f"{API}/paypal/order", json={"user_id": "qa-uid-1", "package_id": "sub_pro"}, timeout=30)
    assert r.status_code == 400, r.text


def test_paypal_order_invalid(s):
    r = s.post(f"{API}/paypal/order", json={"user_id": "qa-uid-1", "package_id": "invalid"}, timeout=30)
    assert r.status_code == 400, r.text


def test_paypal_capture_unapproved(s, starter_order):
    r = s.post(f"{API}/paypal/capture", json={"order_id": starter_order}, timeout=60)
    # Graceful handling; NOT a crash. Expected 200 with non-paid status.
    assert r.status_code == 200, f"unexpected {r.status_code} {r.text}"
    data = r.json()
    assert data.get("credits_added", 0) == 0
    assert data.get("status") != "paid"


def test_paypal_capture_notfound(s):
    r = s.post(f"{API}/paypal/capture", json={"order_id": "DOESNOTEXIST"}, timeout=30)
    assert r.status_code == 404, r.text
    assert "non trovato" in r.text.lower()
