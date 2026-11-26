import unittest
from analytics_purchase import stripe_purchase, paypal_purchase

class PurchaseTests(unittest.TestCase):
    def setUp(self):
        self.record = {"session_id": "checkout_secret", "package_id": "starter"}
        self.stripe = {"id": "checkout_secret", "livemode": True, "payment_status": "paid", "amount_total": 1900, "currency": "eur"}
        self.paypal = {"id": "checkout_secret", "status": "COMPLETED", "purchase_units": [{"payments": {"captures": [{"id": "capture_secret", "status": "COMPLETED", "amount": {"currency_code": "EUR", "value": "19.00"}}]}}]}
    def test_stripe_live_confirmed(self):
        p = stripe_purchase(self.stripe, self.record)
        self.assertEqual(p["value"], 19)
        self.assertEqual(p["currency"], "EUR")
        self.assertRegex(p["transaction_id"], r"^da_[a-f0-9]{64}$")
        self.assertNotIn("checkout_secret", str(p))
        self.assertEqual(p, stripe_purchase(self.stripe, self.record))
        self.assertEqual(p["items"][0]["item_id"], "starter")
    def test_stripe_fail_closed(self):
        for patch in [{"livemode":False}, {"payment_status":"unpaid"}, {"payment_status":"no_payment_required"}, {"amount_total":0}, {"currency":"usd"}, {"id":"other"}, {"amount_total": True}]:
            self.assertIsNone(stripe_purchase(dict(self.stripe, **patch), self.record))
    def test_paypal_confirmed_capture(self):
        p = paypal_purchase(self.paypal, self.record, "live")
        self.assertEqual(p["value"], 19)
        self.assertNotIn("capture_secret", str(p))
        self.assertIsNone(paypal_purchase(self.paypal, self.record, "sandbox"))
        self.assertIsNone(paypal_purchase(dict(self.paypal, status="APPROVED"), self.record, "live"))
    def test_paypal_pending_capture(self):
        self.paypal["purchase_units"][0]["payments"]["captures"][0]["status"] = "PENDING"
        self.assertIsNone(paypal_purchase(self.paypal, self.record, "live"))
    def test_paypal_invalid_amounts(self):
        for amount in ["NaN", "Infinity", "-1", "0", "19.001"]:
            self.paypal["purchase_units"][0]["payments"]["captures"][0]["amount"]["value"] = amount
            self.assertIsNone(paypal_purchase(self.paypal, self.record, "live"))

if __name__ == "__main__":
    unittest.main()
