"""Backend test suite for DocuAnalytics AI (session/analyze/chat/payments/crypto)."""
import os
import base64
import io
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pre-launch-verify-2.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _make_invoice_png_b64():
    from PIL import Image, ImageDraw
    img = Image.new('RGB', (900, 1100), 'white')
    d = ImageDraw.Draw(img)
    lines = [
        'FATTURA ELETTRONICA n. 2025/0042',
        'Data: 15/01/2026',
        '',
        'Fornitore: Rossi Consulting S.r.l.',
        'P.IVA: 12345678901',
        'Sede: Via Roma 12, 20100 Milano (MI)',
        'IBAN: IT60 X054 2811 1010 0000 0123 456',
        '',
        'Cliente: Alpha Studio Legale',
        'P.IVA: 98765432109',
        '',
        'Descrizione                    Q.ta   Prezzo    Totale',
        'Consulenza fiscale               10   100.00    1000.00',
        'Assistenza contrattuale           5   200.00    1000.00',
        '',
        'Imponibile:                                      2000.00',
        'IVA 22%:                                          440.00',
        'Totale Fattura:                                  2440.00',
        '',
        'Pagamento entro 30 giorni.',
    ]
    y = 40
    for ln in lines:
        d.text((40, y), ln, fill='black')
        y += 32
    buf = io.BytesIO(); img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="session")
def invoice_b64():
    return _make_invoice_png_b64()


@pytest.fixture()
def fresh_user():
    r = requests.post(f"{API}/session", json={})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- Session ----------------
class TestSession:
    def test_create_session_empty(self):
        r = requests.post(f"{API}/session", json={})
        assert r.status_code == 200
        d = r.json()
        assert d["credits"] == 3
        assert isinstance(d["user_id"], str) and len(d["user_id"]) > 8

    def test_get_session_matches(self, fresh_user):
        uid = fresh_user["user_id"]
        r = requests.get(f"{API}/session/{uid}")
        assert r.status_code == 200
        d = r.json()
        assert d["user_id"] == uid
        assert d["credits"] == 3

    def test_get_session_404(self):
        r = requests.get(f"{API}/session/nonexistent-user-xyz-123")
        assert r.status_code == 404


# ---------------- Analyze ----------------
class TestAnalyze:
    def test_analyze_invoice_success(self, fresh_user, invoice_b64):
        payload = {
            "user_id": fresh_user["user_id"],
            "doc_type": "fattura",
            "filename": "invoice.png",
            "mime_type": "image/png",
            "file_base64": invoice_b64,
        }
        r = requests.post(f"{API}/analyze", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["credits"] == 2
        res = d["result"]
        assert "doc_type" in res
        assert "summary" in res and res["summary"]
        assert isinstance(res.get("fields"), list) and len(res["fields"]) > 0
        assert isinstance(res.get("audit"), list) and len(res["audit"]) > 0

    def test_analyze_unsupported_mime(self, fresh_user):
        r = requests.post(f"{API}/analyze", json={
            "user_id": fresh_user["user_id"],
            "doc_type": "auto",
            "filename": "note.txt",
            "mime_type": "text/plain",
            "file_base64": base64.b64encode(b"hello world").decode(),
        })
        assert r.status_code == 400

    def test_credit_exhaustion_402(self, fresh_user, invoice_b64):
        uid = fresh_user["user_id"]
        payload = {
            "user_id": uid, "doc_type": "fattura",
            "filename": "invoice.png", "mime_type": "image/png", "file_base64": invoice_b64,
        }
        # already have 3 credits
        for i in range(3):
            r = requests.post(f"{API}/analyze", json=payload, timeout=120)
            assert r.status_code == 200, f"analyze {i} failed: {r.text}"
        # 4th should be 402
        r = requests.post(f"{API}/analyze", json=payload, timeout=120)
        assert r.status_code == 402


# ---------------- Chat ----------------
class TestChat:
    def test_chat_owner_and_forbidden(self, fresh_user, invoice_b64):
        uid = fresh_user["user_id"]
        r = requests.post(f"{API}/analyze", json={
            "user_id": uid, "doc_type": "fattura", "filename": "i.png",
            "mime_type": "image/png", "file_base64": invoice_b64,
        }, timeout=120)
        assert r.status_code == 200
        aid = r.json()["analysis_id"]

        # owner chat
        r2 = requests.post(f"{API}/chat", json={
            "user_id": uid, "analysis_id": aid,
            "question": "Qual è il totale della fattura?",
        }, timeout=90)
        assert r2.status_code == 200
        assert r2.json()["answer"]

        # different user -> 403
        other = requests.post(f"{API}/session", json={}).json()["user_id"]
        r3 = requests.post(f"{API}/chat", json={
            "user_id": other, "analysis_id": aid, "question": "Totale?",
        }, timeout=30)
        assert r3.status_code == 403


# ---------------- Payments ----------------
PACKAGE_IDS = ["starter", "pro", "enterprise", "sub_single", "sub_pro", "sub_unlimited"]


class TestPayments:
    @pytest.mark.parametrize("pkg", PACKAGE_IDS)
    def test_checkout_each_package(self, fresh_user, pkg):
        r = requests.post(f"{API}/payments/checkout", json={
            "package_id": pkg, "origin_url": BASE_URL, "user_id": fresh_user["user_id"],
        }, timeout=30)
        assert r.status_code == 200, f"{pkg}: {r.text}"
        d = r.json()
        assert d["checkout_url"].startswith("https://checkout.stripe.com/"), d["checkout_url"]
        assert d["session_id"].startswith("cs_"), d["session_id"]

    def test_invalid_package(self, fresh_user):
        r = requests.post(f"{API}/payments/checkout", json={
            "package_id": "not_a_pkg", "origin_url": BASE_URL, "user_id": fresh_user["user_id"],
        })
        assert r.status_code == 400

    def test_invalid_origin_url(self, fresh_user):
        r = requests.post(f"{API}/payments/checkout", json={
            "package_id": "pro", "origin_url": "javascript:alert(1)", "user_id": fresh_user["user_id"],
        })
        assert r.status_code == 400

    def test_status_pending(self, fresh_user):
        r = requests.post(f"{API}/payments/checkout", json={
            "package_id": "starter", "origin_url": BASE_URL, "user_id": fresh_user["user_id"],
        }, timeout=30)
        sid = r.json()["session_id"]
        r2 = requests.get(f"{API}/payments/status/{sid}", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["payment_status"] == "pending"


# ---------------- Crypto ----------------
class TestCrypto:
    def test_crypto_info(self):
        r = requests.get(f"{API}/crypto/info")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["packages"], list) and len(d["packages"]) == 6
        assert d["wallets"]["BTC"]["address"]
        assert d["wallets"]["BTC"]["qr"]
        assert d["wallets"]["USDT"]["address"]
        assert d["wallets"]["USDT"]["qr"]

    def test_crypto_order(self, fresh_user):
        r = requests.post(f"{API}/crypto/order", json={
            "user_id": fresh_user["user_id"], "package_id": "pro", "coin": "BTC",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["order_id"]
        assert d["status"] == "awaiting_payment"

    def test_crypto_order_invalid_pkg(self, fresh_user):
        r = requests.post(f"{API}/crypto/order", json={
            "user_id": fresh_user["user_id"], "package_id": "nope", "coin": "BTC",
        })
        assert r.status_code == 400
