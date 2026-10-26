"""HTTP-level ASGI registration journey using the actual endpoint handlers.

Extracts handlers from server.py to avoid importing production services.
Only local ASGI requests, synthetic accounts and stubbed email/database.
"""
import ast
import asyncio
import pathlib
import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from registration_tracking import recently_verified_registration
from test_full_registration_journey import Users, Tokens


class RegisterReq(BaseModel):
    email: str
    password: str
    name: str = ""
    user_id: str | None = None
    ref: str | None = None


class LoginReq(BaseModel):
    email: str
    password: str


class HTTPRegistrationJourneyTests(unittest.IsolatedAsyncioTestCase):
    async def test_register_verify_login_over_local_http_asgi(self):
        source = pathlib.Path(__file__).with_name("server.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        handlers = []
        for name in ("register", "verify_email", "login"):
            node = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
            node.decorator_list = []
            handlers.append(node)

        app = FastAPI()
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
            "recently_verified_registration": recently_verified_registration,
            "HTTPException": HTTPException,
            "RegisterReq": RegisterReq, "LoginReq": LoginReq,
            "Request": __import__("fastapi").Request,
        }
        # The real verification handler imports RedirectResponse itself.
        exec(compile(ast.fix_missing_locations(ast.Module(
            body=handlers, type_ignores=[])), "<actual-http-handlers>", "exec"), namespace)
        app.post("/api/auth/register")(namespace["register"])
        app.get("/api/auth/verify")(namespace["verify_email"])
        app.post("/api/auth/login")(namespace["login"])

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://isolated.test",
                               follow_redirects=False) as client:
            creds = {"email": "synthetic@example.invalid", "password": "test-password"}
            registered = await client.post("/api/auth/register", json={**creds, "name": "Test"})
            self.assertEqual(registered.status_code, 200)
            self.assertEqual(registered.json(), {
                "verification_required": True, "email": creds["email"]})
            self.assertEqual(len(db.email_verifications.records), 1)
            self.assertEqual(next(iter(db.users.records.values()))["credits"], 0)

            blocked = await client.post("/api/auth/login", json=creds)
            self.assertEqual(blocked.status_code, 403)

            token = db.email_verifications.records[0]["token"]
            verified = await client.get("/api/auth/verify", params={"token": token})
            self.assertEqual(verified.status_code, 302)
            self.assertEqual(verified.headers["location"], "https://example.invalid/?verify=ok")

            replay = await client.get("/api/auth/verify", params={"token": token})
            self.assertEqual(replay.status_code, 302)
            self.assertEqual(replay.headers["location"], "https://example.invalid/?verify=invalid")

            login = await client.post("/api/auth/login", json=creds)
            self.assertEqual(login.status_code, 200)
            self.assertEqual(login.json()["user"]["credits"], 3)
            self.assertTrue(login.json()["recently_verified_registration"])
            self.assertEqual(len(referrals), 1)

            duplicate = await client.post("/api/auth/register", json={**creds, "name": "Again"})
            self.assertEqual(duplicate.status_code, 409)
            wrong = await client.post("/api/auth/login", json={
                "email": creds["email"], "password": "wrong"})
            self.assertEqual(wrong.status_code, 401)
            self.assertEqual(next(iter(db.users.records.values()))["credits"], 3)

        await asyncio.sleep(0)
        self.assertEqual(len(sent), 1)


if __name__ == "__main__":
    unittest.main()
