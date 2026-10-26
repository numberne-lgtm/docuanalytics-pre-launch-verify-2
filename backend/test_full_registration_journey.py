"""Exercise real register, verify, and login handlers with an isolated fake database.

No external email, production services, advertising SDK, or payment calls.
"""
import ast
import asyncio
import pathlib
import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from test_verification_login_journey import FakeHTTPException
from test_verify_handler_behavior import RedirectResponse
from registration_tracking import recently_verified_registration


class Users:
    def __init__(self):
        self.records = {}
        self.lock = asyncio.Lock()

    async def find_one(self, query, projection=None):
        for record in self.records.values():
            if all(record.get(k) == v for k, v in query.items() if not isinstance(v, dict)):
                return dict(record)
        return None

    async def insert_one(self, record):
        self.records[record["user_id"]] = dict(record)

    async def update_one(self, query, update):
        async with self.lock:
            record = self.records.get(query.get("user_id"))
            matched = bool(record) and (
                not isinstance(query.get("email_verified"), dict)
                or record.get("email_verified") is not True
            )
            if matched:
                record.update(update["$set"])
            return SimpleNamespace(modified_count=int(matched))


class Tokens:
    def __init__(self):
        self.records = []
        self.lock = asyncio.Lock()

    async def insert_one(self, record):
        self.records.append(dict(record))

    async def find_one_and_update(self, query, update):
        async with self.lock:
            for record in self.records:
                if all(record.get(k) == v for k, v in query.items()):
                    before = dict(record)
                    record.update(update["$set"])
                    return before
        return None


class RegistrationJourneyTests(unittest.IsolatedAsyncioTestCase):
    async def test_actual_register_verify_login_with_email_stub(self):
        source = pathlib.Path(__file__).with_name("server.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        handlers = []
        for name in ("register", "verify_email", "login"):
            node = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
            node.decorator_list = []
            for arg in node.args.args:
                arg.annotation = None
            if name == "verify_email":
                node.body[0] = ast.Assign(
                    targets=[ast.Name(id="RedirectResponse", ctx=ast.Store())],
                    value=ast.Name(id="FakeRedirectResponse", ctx=ast.Load()))
            handlers.append(node)

        db = SimpleNamespace(users=Users(), email_verifications=Tokens())
        sent = []
        referrals = []

        async def send_email(*args):
            sent.append(args)

        async def apply_referral(*args):
            referrals.append(args)

        namespace = {
            "db": db, "asyncio": asyncio, "datetime": datetime, "timezone": timezone,
            "uuid": uuid, "PUBLIC_BASE_URL": "https://example.invalid",
            "FREE_CREDITS": 3, "EMAIL_VERIFICATION_ENABLED": True,
            "RESEND_API_KEY": "synthetic-unused-key",
            "_client_ip": lambda request: "127.0.0.1",
            "_rate_limit": lambda *args: None,
            "_gen_ref_code": lambda: "SYNTHETIC",
            "_hash_pw": lambda pw: "hash:" + pw,
            "_verify_pw": lambda pw, hashed: hashed == "hash:" + pw,
            "_make_token": lambda uid, email: "synthetic-jwt",
            "_public_user": lambda u: {"user_id": u["user_id"], "credits": u["credits"]},
            "_apply_referral": apply_referral, "_send_email_bg": send_email,
            "_verify_email_html": lambda link: "synthetic email " + link,
            "FakeRedirectResponse": RedirectResponse,
            "recently_verified_registration": recently_verified_registration,
            "HTTPException": FakeHTTPException,
        }
        exec(compile(ast.fix_missing_locations(ast.Module(
            body=handlers, type_ignores=[])), "<actual-registration-journey>", "exec"), namespace)

        request = SimpleNamespace()
        credentials = SimpleNamespace(email="new-user@example.invalid", password="synthetic-password")
        result = await namespace["register"](SimpleNamespace(
            email=credentials.email, password=credentials.password,
            name="Synthetic", user_id=None, ref=None), request)
        self.assertEqual(result, {"verification_required": True, "email": credentials.email})
        self.assertEqual(len(db.email_verifications.records), 1)
        user = next(iter(db.users.records.values()))
        self.assertEqual(user["credits"], 0)
        self.assertFalse(user["email_verified"])

        await asyncio.sleep(0)
        self.assertEqual(len(sent), 1)
        self.assertIn(db.email_verifications.records[0]["token"], sent[0][2])

        with self.assertRaises(FakeHTTPException) as blocked:
            await namespace["login"](credentials, request)
        self.assertEqual(blocked.exception.status_code, 403)

        token = db.email_verifications.records[0]["token"]
        first, replay = await asyncio.gather(
            namespace["verify_email"](token), namespace["verify_email"](token))
        self.assertEqual(sorted([first.url, replay.url]), [
            "https://example.invalid/?verify=invalid", "https://example.invalid/?verify=ok"])
        logged_in = await namespace["login"](credentials, request)
        self.assertEqual(logged_in["token"], "synthetic-jwt")
        self.assertTrue(logged_in["recently_verified_registration"])
        self.assertEqual(logged_in["user"]["credits"], 3)
        self.assertEqual(len(referrals), 1)


if __name__ == "__main__":
    unittest.main()
