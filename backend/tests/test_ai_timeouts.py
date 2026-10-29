"""Timeout + fallback checks with a mocked LLM (no real AI calls)."""
import asyncio
import base64
import io
import uuid

import httpx
import pytest
from PIL import Image

import server
import assistant.router as arouter
from emergentintegrations.llm.chat import LlmChat



def _png():
    b = io.BytesIO(); Image.new("RGB", (40, 40), "white").save(b, "PNG")
    return base64.b64encode(b.getvalue()).decode()


async def _client():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://t")


async def _user(c):
    r = await c.post("/api/auth/register", json={"email": f"t_to_{uuid.uuid4().hex[:8]}@example.com", "password": "Test12345"})
    d = r.json()
    return d["user"]["user_id"], {"Authorization": f"Bearer {d['token']}"}


async def _cleanup(uid):
    await server.db.analyses.delete_many({"user_id": uid})
    await server.db.users.delete_one({"user_id": uid})


async def _analyze_timeout(monkeypatch):
    async def hang(self, msg):
        await asyncio.sleep(5)
    monkeypatch.setattr(LlmChat, "send_message", hang)
    monkeypatch.setattr(server, "AI_TIMEOUT_ANALYZE", 0.5)
    async with await _client() as c:
        uid, H = await _user(c)
        before = (await server.db.users.find_one({"user_id": uid}))["credits"]
        body = {"user_id": uid, "filename": "t.png", "mime_type": "image/png", "file_base64": _png()}
        r1, r2 = await asyncio.gather(c.post("/api/analyze", json=body, headers=H), c.post("/api/analyze", json=body, headers=H))
        codes = sorted([r1.status_code, r2.status_code])
        assert codes == [408, 409], codes
        msg = (r1 if r1.status_code == 408 else r2).json()["detail"]
        assert "Nessun credito" in msg
        after = (await server.db.users.find_one({"user_id": uid}))["credits"]
        assert after == before
        assert await server.db.analyses.count_documents({"user_id": uid}) == 0
        assert uid not in server._ANALYZING
        await _cleanup(uid)


async def _analyze_ok_copilot_timeout(monkeypatch):
    async def ok(self, msg):
        return '{"doc_type":"Fattura","category":"invoice","summary":"ok","fields":[],"audit":[],"structured":{},"full_text":"x"}'
    monkeypatch.setattr(LlmChat, "send_message", ok)
    async with await _client() as c:
        uid, H = await _user(c)
        before = (await server.db.users.find_one({"user_id": uid}))["credits"]
        r = await c.post("/api/analyze", json={"user_id": uid, "filename": "t.png", "mime_type": "image/png", "file_base64": _png()}, headers=H)
        assert r.status_code == 200
        assert r.json()["credits"] == before - 1
        aid = r.json()["analysis_id"]

        async def hang(self, msg):
            await asyncio.sleep(5)
        monkeypatch.setattr(LlmChat, "send_message", hang)
        monkeypatch.setattr(server, "AI_TIMEOUT_COPILOT", 0.5)
        r = await c.post("/api/chat", json={"user_id": uid, "analysis_id": aid, "question": "totale?"}, headers=H)
        assert r.status_code == 408 and "Copilot" in r.json()["detail"]
        assert await server.db.analyses.count_documents({"user_id": uid}) == 1
        await _cleanup(uid)


async def _assistant_fallback(monkeypatch):
    calls = []

    async def send(self, msg):
        calls.append(1)
        if len(calls) == 1:
            await asyncio.sleep(5)
        return "Risposta di riserva"
    monkeypatch.setattr(LlmChat, "send_message", send)
    monkeypatch.setattr(arouter, "AI_TIMEOUT", 0.5)
    async with await _client() as c:
        r = await c.post("/api/assistant/chat", json={"session_id": f"t-{uuid.uuid4().hex}", "message": "Quanto costa?"},
                         headers={"X-Forwarded-For": f"10.9.{uuid.uuid4().int % 250}.1"})
        assert r.status_code == 200, r.text
        assert "riserva" in r.json().get("reply", r.json().get("answer", ""))
        assert len(calls) == 2


def test_timeouts_and_fallback(monkeypatch):
    async def run():
        await _analyze_timeout(monkeypatch)
        monkeypatch.undo()
        await _analyze_ok_copilot_timeout(monkeypatch)
        monkeypatch.undo()
        await _assistant_fallback(monkeypatch)
    asyncio.run(run())
