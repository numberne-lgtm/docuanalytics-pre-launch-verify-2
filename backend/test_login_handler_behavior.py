"""Run the real login handler with synthetic users and no external services."""
import ast
import pathlib
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from registration_tracking import recently_verified_registration


class FakeHTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        super().__init__(detail)


class FakeUsers:
    def __init__(self, user):
        self.user = user

    async def find_one(self, query, projection=None):
        return dict(self.user) if self.user.get("email") == query.get("email") else None

    async def update_one(self, query, update):
        self.user.update(update["$set"])


class LoginHandlerBehaviorTests(unittest.IsolatedAsyncioTestCase):
    def build_handler(self, user):
        tree = ast.parse(pathlib.Path("server.py").read_text(encoding="utf-8"))
        handler = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "login")
        handler.decorator_list = []
        namespace = {
            "db": SimpleNamespace(users=FakeUsers(user)),
            "HTTPException": FakeHTTPException,
            "EMAIL_VERIFICATION_ENABLED": True,
            "RESEND_API_KEY": "synthetic-key-not-used",
            "_client_ip": lambda request: "127.0.0.1",
            "_rate_limit": lambda *args: None,
            "_verify_pw": lambda password, hashed: password == "synthetic-password",
            "_gen_ref_code": lambda: "TESTCODE",
            "_make_token": lambda user_id, email: "synthetic-auth-token",
            "_public_user": lambda u: {"user_id": u["user_id"], "credits": u["credits"]},
            "recently_verified_registration": recently_verified_registration,
        }
        module = ast.fix_missing_locations(ast.Module(body=[handler], type_ignores=[]))
        exec(compile(module, "<login-handler>", "exec"), namespace)
        return namespace["login"]

    def user(self, verified, verified_at=None):
        return {"user_id": "synthetic-user", "email": "synthetic@example.invalid",
                "password_hash": "synthetic-hash", "email_verified": verified,
                "email_verified_at": verified_at, "referral_code": "TESTCODE", "credits": 3}

    async def test_unverified_user_cannot_login(self):
        login = self.build_handler(self.user(False))
        with self.assertRaises(FakeHTTPException) as error:
            await login(SimpleNamespace(email="synthetic@example.invalid", password="synthetic-password"), None)
        self.assertEqual(error.exception.status_code, 403)

    async def test_recent_verification_returns_eligible_flag(self):
        timestamp = datetime.now(timezone.utc).isoformat()
        login = self.build_handler(self.user(True, timestamp))
        response = await login(SimpleNamespace(email="synthetic@example.invalid", password="synthetic-password"), None)
        self.assertEqual(response["token"], "synthetic-auth-token")
        self.assertTrue(response["recently_verified_registration"])

    async def test_old_verification_does_not_count_as_new_registration(self):
        timestamp = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
        login = self.build_handler(self.user(True, timestamp))
        response = await login(SimpleNamespace(email="synthetic@example.invalid", password="synthetic-password"), None)
        self.assertFalse(response["recently_verified_registration"])


if __name__ == "__main__":
    unittest.main()
