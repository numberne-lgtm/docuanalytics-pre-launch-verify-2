"""Execute the actual verify_email handler against a disposable in-memory async DB.

No live backend, network, email, or payment service is used.
"""
import ast
import asyncio
import pathlib
import unittest
from datetime import datetime, timezone


class RedirectResponse:
    def __init__(self, url, status_code):
        self.url, self.status_code = url, status_code


class FakeTokens:
    def __init__(self, records):
        self.records = records
        self.lock = asyncio.Lock()

    async def find_one_and_update(self, query, update):
        async with self.lock:
            for record in self.records:
                if all(record.get(k) == v for k, v in query.items()):
                    record.update(update["$set"])
                    return dict(record)
            return None


class FakeUsers:
    def __init__(self):
        self.user = {"user_id": "synthetic-user", "email_verified": False, "credits": 0}
        self.lock = asyncio.Lock()

    async def update_one(self, query, update):
        async with self.lock:
            matched = self.user["user_id"] == query["user_id"] and not self.user["email_verified"]
            if matched:
                self.user.update(update["$set"])
            return type("Result", (), {"modified_count": int(matched)})()


class FakeDB:
    def __init__(self):
        self.email_verifications = FakeTokens([
            {"token": "synthetic-token-1", "used": False, "user_id": "synthetic-user"},
            {"token": "synthetic-token-2", "used": False, "user_id": "synthetic-user"},
        ])
        self.users = FakeUsers()


class ActualVerificationHandlerTests(unittest.IsolatedAsyncioTestCase):
    async def test_multiple_links_and_replays_grant_once(self):
        tree = ast.parse(pathlib.Path("server.py").read_text(encoding="utf-8"))
        handler = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "verify_email")
        handler.decorator_list = []
        module = ast.fix_missing_locations(ast.Module(body=[handler], type_ignores=[]))
        db = FakeDB()
        referrals = []
        async def apply_referral(*args):
            referrals.append(args)
        namespace = {
            "db": db, "datetime": datetime, "timezone": timezone,
            "PUBLIC_BASE_URL": "https://example.invalid", "FREE_CREDITS": 3,
            "_apply_referral": apply_referral, "FakeRedirectResponse": RedirectResponse,
        }
        # Handler's local import is replaced only to avoid importing FastAPI here.
        handler.body[0] = ast.Assign(targets=[ast.Name(id="RedirectResponse", ctx=ast.Store())], value=ast.Name(id="FakeRedirectResponse", ctx=ast.Load()))
        exec(compile(ast.fix_missing_locations(module), "<verify_email>", "exec"), namespace)
        verify = namespace["verify_email"]
        results = await asyncio.gather(*(
            verify(token) for token in
            ["synthetic-token-1", "synthetic-token-2", "synthetic-token-1"] * 8
        ))
        self.assertEqual(db.users.user["credits"], 3)
        self.assertTrue(db.users.user["email_verified"])
        self.assertEqual(len(referrals), 1)
        self.assertEqual(sum(r.url.endswith("?verify=ok") for r in results), 2)
        self.assertEqual(sum(r.url.endswith("?verify=invalid") for r in results), 22)


if __name__ == "__main__":
    unittest.main()
