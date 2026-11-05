"""Offline API integration tests for Workspace overview/deadlines using an in-memory DB fake.
No real database, external HTTP or credentials are accessed.
Run: PYTHONPATH=backend .venv/bin/python -m unittest backend.tests.test_risk_dashboard_api -v
"""
import unittest
from datetime import date, timedelta

import httpx
from fastapi import FastAPI
from workspace.router import build_workspace_router


class Cursor:
    def __init__(self, rows):
        self.rows = list(rows)

    def sort(self, *args):
        return self

    def limit(self, n):
        self.rows = self.rows[:n]
        return self

    def __aiter__(self):
        self.iterator = iter(self.rows)
        return self

    async def __anext__(self):
        try:
            return next(self.iterator)
        except StopIteration:
            raise StopAsyncIteration


class Collection:
    def __init__(self, rows):
        self.rows = rows

    def find(self, query, projection=None):
        def matches(row):
            for key, expected in query.items():
                actual = row.get(key)
                if isinstance(expected, dict):
                    if "$nin" in expected and actual in expected["$nin"]:
                        return False
                    if "$ne" in expected and actual == expected["$ne"]:
                        return False
                elif actual != expected:
                    return False
            return True
        return Cursor([r.copy() for r in self.rows if matches(r)])

    async def update_one(self, *args, **kwargs):
        raise AssertionError("Unexpected database write in read-only fixture")

    async def insert_one(self, *args, **kwargs):
        raise AssertionError("Unexpected database write in read-only fixture")


class FakeDB:
    def __init__(self):
        self.clients = Collection([])
        self.analyses = Collection([{
            "user_id": "u1", "analysis_id": "doc1", "filename": "sample.pdf",
            "ws_synced": True, "client_id": None, "client_link": {"status": "unlinked"},
            "risk_level": "low", "result": {"category": "other", "doc_type": "Altro", "fields": []},
        }])
        due_soon = (date.today() + timedelta(days=3)).isoformat()
        self.reminders = Collection([
            {"user_id": "u1", "reminder_id": "historical-auto", "analysis_id": "doc1",
             "source": "auto", "status": "detected", "active": True,
             "label": "Decadenza beneficio del termine", "due_date": "2008-06-05", "kind": "validity"},
            {"user_id": "u1", "reminder_id": "historical-unconfirmed", "analysis_id": "doc1",
             "source": "auto", "status": "to_verify", "active": True,
             "label": "Decadenza dal beneficio del termine", "due_date": "2008-06-05", "kind": "validity"},
            {"user_id": "u1", "reminder_id": "confirmed-auto", "analysis_id": "doc1",
             "source": "auto", "status": "confirmed", "active": True,
             "label": "Decadenza beneficio del termine", "due_date": "2008-06-05", "kind": "validity"},
            {"user_id": "u1", "reminder_id": "confirmed-manual", "analysis_id": "doc1",
             "source": "manual", "status": "confirmed", "active": True,
             "label": "Scadenza pagamento", "due_date": due_soon, "kind": "payment"},
            {"user_id": "u1", "reminder_id": "normal-auto", "analysis_id": "doc1",
             "source": "auto", "status": "detected", "active": True,
             "label": "Scadenza contratto", "due_date": "2099-01-01", "kind": "validity"},
            {"user_id": "u2", "reminder_id": "other-user", "analysis_id": "doc2",
             "source": "manual", "status": "confirmed", "active": True,
             "label": "Altra utenza", "due_date": "2008-06-05", "kind": "payment"},
        ])


class RiskDashboardApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDB()
        async def current_user(_request):
            return {"user_id": "u1", "email": "test@example.invalid"}
        async def send_email(*args, **kwargs):
            raise AssertionError("Unexpected email")
        app = FastAPI()
        app.include_router(build_workspace_router(self.db, current_user, "", [], send_email, "", ""))
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_overview_excludes_only_unconfirmed_historical_auto(self):
        response = await self.client.get("/api/workspace/overview")
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["counts"]["documents"], 1)
        self.assertEqual(data["counts"]["overdue"], 1)
        self.assertEqual(data["counts"]["upcoming"], 1)
        self.assertEqual(data["counts"]["deadlines_to_verify"], 0)
        ids = {p.get("reminder_id") for p in data["priorities"]}
        self.assertIn("confirmed-auto", ids)
        self.assertIn("confirmed-manual", ids)
        self.assertNotIn("historical-auto", ids)
        self.assertNotIn("historical-unconfirmed", ids)
        self.assertNotIn("other-user", ids)

    async def test_deadlines_endpoint_keeps_confirmed_and_normal_auto(self):
        response = await self.client.get("/api/workspace/deadlines")
        self.assertEqual(response.status_code, 200, response.text)
        buckets = response.json()["buckets"]
        ids = {d["reminder_id"] for group in buckets.values() for d in group}
        self.assertEqual(ids, {"confirmed-auto", "confirmed-manual", "normal-auto"})


if __name__ == "__main__":
    unittest.main()
