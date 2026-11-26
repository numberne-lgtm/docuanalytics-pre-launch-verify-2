import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
from analytics_activation import first_analysis_candidate, claim_first_analysis

class FirstAnalysisTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.user = {"user_id": "synthetic-user", "email_verified": True, "email_verified_at": "2026-11-01"}
        self.db = SimpleNamespace(analyses=SimpleNamespace(find_one=AsyncMock(return_value=None)),
                                  users=SimpleNamespace(update_one=AsyncMock()))
    async def test_new_verified_account(self):
        self.assertTrue(await first_analysis_candidate(self.db, self.user))
        self.db.analyses.find_one.assert_awaited_once_with({"user_id":"synthetic-user"}, {"_id":1})
    async def test_anonymous_unverified_or_already_marked(self):
        for user in [{}, {**self.user,"email_verified":False},
                     {**self.user,"email_verified_at":None}, {**self.user,"first_analysis_at":"old"}]:
            self.assertFalse(await first_analysis_candidate(self.db, user))
        self.db.analyses.find_one.assert_not_awaited()
    async def test_existing_history_not_backfilled(self):
        self.db.analyses.find_one.return_value = {"_id":"old"}
        self.assertFalse(await first_analysis_candidate(self.db, self.user))
    async def test_single_atomic_claim(self):
        self.db.users.update_one.side_effect = [SimpleNamespace(modified_count=1), SimpleNamespace(modified_count=0)]
        claims = await asyncio.gather(*(claim_first_analysis(self.db,"synthetic-user","now") for _ in range(2)))
        self.assertEqual(sum(claims), 1)
        for call in self.db.users.update_one.await_args_list:
            selector, update = call.args
            self.assertEqual(selector["first_analysis_at"], {"$exists":False})
            self.assertTrue(selector["email_verified"])
            self.assertEqual(update, {"$set":{"first_analysis_at":"now"}})

if __name__ == "__main__":
    unittest.main()
