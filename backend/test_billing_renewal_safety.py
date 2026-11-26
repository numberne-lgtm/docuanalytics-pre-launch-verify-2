import os
import unittest
import uuid
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
from billing_renewal_safety import renewal_update

CUTOVER = datetime(2026, 12, 1, tzinfo=timezone.utc)
PAID = CUTOVER + timedelta(days=1)

class RenewalGuardTests(unittest.TestCase):
    def test_replay_same_provider_payment_same_marker(self):
        a = renewal_update("u", "stripe", "invoice_1", 100, PAID, CUTOVER)
        b = renewal_update("u", "stripe", "invoice_1", 100, PAID, CUTOVER)
        self.assertEqual(a, b)
        self.assertEqual(a[0]["billing_renewal_claims"]["$ne"], a[1]["$addToSet"]["billing_renewal_claims"])
        self.assertEqual(a[1]["$inc"], {"credits": 100})
        self.assertNotIn("invoice_1", str(a))
    def test_different_payments_and_providers(self):
        a = renewal_update("u", "stripe", "id", 100, PAID, CUTOVER)
        b = renewal_update("u", "paypal", "id", 100, PAID, CUTOVER)
        c = renewal_update("u", "stripe", "id2", 100, PAID, CUTOVER)
        self.assertNotEqual(a, b)
        self.assertNotEqual(a, c)
    def test_unsafe_inputs_fail_closed(self):
        for args in [
            ("u", "unknown", "id", 100, PAID, CUTOVER),
            ("u", "stripe", "", 100, PAID, CUTOVER),
            ("u", "stripe", "id", 0, PAID, CUTOVER),
            ("u", "stripe", "id", True, PAID, CUTOVER),
            ("u", "stripe", "id", 100, CUTOVER-timedelta(seconds=1), CUTOVER),
            ("u", "stripe", "id", 100, PAID.replace(tzinfo=None), CUTOVER),
        ]:
            self.assertIsNone(renewal_update(*args))

@unittest.skipUnless(os.environ.get("TEST_MONGO_URL"), "Requires isolated MongoDB")
class RenewalMongoConcurrencyTests(unittest.TestCase):
    def test_24_parallel_replays_credit_once_and_distinct_payment_credits_again(self):
        from pymongo import MongoClient
        client = MongoClient(os.environ["TEST_MONGO_URL"], serverSelectionTimeoutMS=5000)
        users = client["docuanalytics_ci_disposable"]["users"]
        uid = uuid.uuid4().hex
        try:
            users.insert_one({"user_id":uid, "credits":3})
            selector, mutation = renewal_update(uid, "stripe", "synthetic_invoice_1", 100, PAID, CUTOVER)
            with ThreadPoolExecutor(max_workers=12) as pool:
                applied = list(pool.map(lambda _: users.update_one(selector, mutation).modified_count, range(24)))
            self.assertEqual(sum(applied), 1)
            self.assertEqual(users.find_one({"user_id":uid})["credits"],103)
            self.assertEqual(users.update_one(selector, mutation).modified_count,0)
            selector, mutation = renewal_update(uid, "stripe", "synthetic_invoice_2", 100, PAID, CUTOVER)
            self.assertEqual(users.update_one(selector, mutation).modified_count,1)
            doc = users.find_one({"user_id":uid})
            self.assertEqual(doc["credits"],203)
            self.assertEqual(len(doc["billing_renewal_claims"]),2)
        finally:
            users.delete_many({"user_id":uid})
            client.close()

if __name__ == "__main__":
    unittest.main()
