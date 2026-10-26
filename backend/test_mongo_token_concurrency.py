"""Concurrency test against a disposable MongoDB database.

Runs only when TEST_MONGO_URL is explicitly provided by CI.
No application secrets, email sending, or production database are used.
"""
import os
import uuid
import unittest
from concurrent.futures import ThreadPoolExecutor


@unittest.skipUnless(os.environ.get("TEST_MONGO_URL"), "Requires isolated test MongoDB")
class ConcurrentTokenClaimTests(unittest.TestCase):
    def test_exactly_one_claim_wins(self):
        from pymongo import MongoClient
        client = MongoClient(os.environ["TEST_MONGO_URL"], serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        database = client["docuanalytics_ci_disposable"]
        collection = database["email_verifications"]
        token = uuid.uuid4().hex
        try:
            collection.insert_one({"token": token, "used": False})

            def redeem(_):
                return collection.find_one_and_update(
                    {"token": token, "used": False},
                    {"$set": {"used": True}},
                )

            with ThreadPoolExecutor(max_workers=12) as pool:
                results = list(pool.map(redeem, range(24)))
            self.assertEqual(sum(item is not None for item in results), 1)
            self.assertTrue(collection.find_one({"token": token})["used"])
        finally:
            collection.delete_many({"token": token})
            client.close()


if __name__ == "__main__":
    unittest.main()
