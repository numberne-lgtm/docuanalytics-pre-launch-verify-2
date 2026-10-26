"""Integration-style synthetic journey using actual verification and login handlers.

Runs without production services, emails, payments or browser SDK.
"""
import ast
import asyncio
import pathlib
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from test_verify_handler_behavior import FakeDB, RedirectResponse
from registration_tracking import recently_verified_registration


class FakeHTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        super().__init__(detail)


class JourneyTests(unittest.IsolatedAsyncioTestCase):
    async def test_verify_then_login_eligible_once(self):
        db = FakeDB()
        db.users.user.update({
            "email": "journey@example.invalid", "password_hash": "synthetic-hash",
            "referral_code": "TESTCODE",
        })
        async def find_one(query, projection=None):
            if db.users.user.get("email") == query.get("email"):
                return dict(db.users.user)
            return None
        db.users.find_one = find_one
        referrals = []
        async def apply_referral(*args):
            referrals.append(args)

        tree = ast.parse(pathlib.Path("server.py").read_text(encoding="utf-8"))
        verify_node = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "verify_email")
        login_node = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "login")
        verify_node.decorator_list = []
        verify_node.body[0] = ast.Assign(
            targets=[ast.Name(id="RedirectResponse", ctx=ast.Store())],
            value=ast.Name(id="FakeRedirectResponse", ctx=ast.Load()))
        login_node.decorator_list = []
        for arg in login_node.args.args:
            arg.annotation = None
        namespace = {
            "db": db, "datetime": datetime, "timezone": timezone,
            "PUBLIC_BASE_URL": "https://example.invalid", "FREE_CREDITS": 3,
            "_apply_referral": apply_referral, "FakeRedirectResponse": RedirectResponse,
            "EMAIL_VERIFICATION_ENABLED": True, "RESEND_API_KEY": "synthetic-not-used",
            "_client_ip": lambda request: "127.0.0.1", "_rate_limit": lambda *args: None,
            "_verify_pw": lambda pw, hashed: pw == "synthetic-password",
            "_gen_ref_code": lambda: "TESTCODE",
            "_make_token": lambda uid, email: "synthetic-jwt",
            "_public_user": lambda u: {"user_id": u["user_id"], "credits": u["credits"]},
            "recently_verified_registration": recently_verified_registration,
            "HTTPException": FakeHTTPException,
        }
        exec(compile(ast.fix_missing_locations(ast.Module(
            body=[verify_node, login_node], type_ignores=[])), "<journey>", "exec"), namespace)
        login = namespace["login"]
        verify = namespace["verify_email"]
        request = SimpleNamespace()
        credentials = SimpleNamespace(email="journey@example.invalid", password="synthetic-password")
        with self.assertRaises(FakeHTTPException) as blocked:
            await login(credentials, request)
        self.assertEqual(blocked.exception.status_code, 403)
        first, replay = await asyncio.gather(verify("synthetic-token-1"), verify("synthetic-token-1"))
        self.assertEqual(sorted([first.url, replay.url]), [
            "https://example.invalid/?verify=invalid", "https://example.invalid/?verify=ok"])
        result = await login(credentials, request)
        self.assertEqual(result["token"], "synthetic-jwt")
        self.assertTrue(result["recently_verified_registration"])
        self.assertEqual(result["user"]["credits"], 3)
        self.assertEqual(len(referrals), 1)


if __name__ == "__main__":
    unittest.main()
