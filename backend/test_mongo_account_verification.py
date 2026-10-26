"""Integration test: two valid email links for one account must grant credits once."""
import os
import uuid
import unittest
from concurrent.futures import ThreadPoolExecutor

@unittest.skipUnless(os.environ.get("TEST_MONGO_URL"), "Requires isolated MongoDB")
class AccountVerificationConcurrencyTests(unittest.TestCase):
    def test_only_one_first_verification_claim(self):
        from pymongo import MongoClient
        client = MongoClient(os.environ["TEST_MONGO_URL"], serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        users = client["docuanalytics_ci_disposable"]["users"]
        user_id = uuid.uuid4().hex
        try:
            users.insert_one({"user_id": user_id, "email_verified": False, "credits": 0})
            def verify(_):
                return users.update_one(
                    {"user_id": user_id, "email_verified": {"$ne": True}},
                    {"$set": {"email_verified": True, "credits": 3}},
                ).modified_count
            with ThreadPoolExecutor(max_workers=12) as pool:
                claims = list(pool.map(verify, range(24)))
            self.assertEqual(sum(claims), 1)
            user = users.find_one({"user_id": user_id})
            self.assertTrue(user["email_verified"])
            self.assertEqual(user["credits"], 3)
        finally:
            users.delete_many({"user_id": user_id})
            client.close()

if __name__ == "__main__":
    unittest.main()
