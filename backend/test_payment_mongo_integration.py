"""Real MongoDB replica-set checks for production payment functions.

Only connects to loopback. Uses a new disposable database per test. PayPal
signature verification is stubbed: these are database tests, not Sandbox E2E.
Concurrent operations must succeed through the production driver's own retries.
"""
import ast
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import unittest
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient


class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        super().__init__(detail)


class Request:
    headers = {}

    def __init__(self, sale):
        self.sale = sale

    async def body(self):
        return json.dumps({"event_type": "PAYMENT.SALE.COMPLETED", "resource": {
            "id": self.sale, "billing_agreement_id": "subscription-test"
        }}).encode()


class PaymentMongoTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        uri = os.environ.get("PAYMENT_TEST_MONGO_URI", "mongodb://127.0.0.1:27017/?replicaSet=rs0")
        if not uri.startswith("mongodb://127.0.0.1:27017/"):
            raise RuntimeError("Integration tests only permit the local disposable MongoDB")
        self.client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=10000)
        hello = await self.client.admin.command("hello")
        self.assertTrue(hello.get("setName"), "MongoDB replica set required")
        self.db = self.client["da_payment_test_" + uuid4().hex]
        for name in ("users", "payment_transactions", "credit_grants", "subscriptions"):
            await self.db.create_collection(name)
        await self.db.users.insert_one({"user_id": "owner", "credits": 0})
        await self.db.subscriptions.insert_one({
            "subscription_id": "subscription-test", "provider": "paypal",
            "user_id": "owner", "package_id": "sub_single", "credits": 100
        })

        async def verified(*_args):
            return True

        self.ns = {"client": self.client, "db": self.db, "Optional": Optional,
                   "datetime": datetime, "timezone": timezone, "json": json,
                   "Request": Request, "HTTPException": HTTPException,
                   "logger": logging.getLogger(__name__), "_verify_paypal_webhook": verified}
        wanted = {"_credit_if_paid", "_credit_renewal_once",
                  "_paypal_sale_should_credit", "paypal_webhook"}
        tree = ast.parse(Path(__file__).with_name("server.py").read_text())
        nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                 and n.name in wanted]
        self.assertEqual({n.name for n in nodes}, wanted)
        for node in nodes:
            node.decorator_list = []
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "server.py", "exec"), self.ns)

    async def asyncTearDown(self):
        await self.client.admin.command({"configureFailPoint": "failCommand", "mode": "off"})
        if hasattr(self, "db"):
            assert self.db.name.startswith("da_payment_test_")
            await self.client.drop_database(self.db.name)
        self.client.close()

    async def balance(self):
        return (await self.db.users.find_one({"user_id": "owner"}))["credits"]

    async def test_duplicate_paid_grant_concurrent(self):
        record = {"session_id": "checkout-test", "payment_status": "paid",
                  "credited": False, "user_id": "owner", "credits": 50}
        await self.db.payment_transactions.insert_one(dict(record))
        await asyncio.gather(*(self.ns["_credit_if_paid"](record)
                               for _ in range(12)))
        self.assertEqual(await self.balance(), 50)
        self.assertTrue((await self.db.payment_transactions.find_one({"session_id": "checkout-test"}))["credited"])

    async def test_missing_owner_rolls_back_paid_flag(self):
        record = {"session_id": "checkout-missing", "payment_status": "paid",
                  "credited": False, "user_id": "missing", "credits": 50}
        await self.db.payment_transactions.insert_one(dict(record))
        with self.assertRaises(RuntimeError):
            await self.ns["_credit_if_paid"](record)
        self.assertFalse((await self.db.payment_transactions.find_one({"session_id": "checkout-missing"}))["credited"])
        self.assertEqual(await self.balance(), 0)

    async def test_duplicate_renewal_concurrent(self):
        async def grant():
            return await self.ns["_credit_renewal_once"]("invoice-test", "stripe-sub", "owner", 100)
        await asyncio.gather(*(grant() for _ in range(12)))
        self.assertEqual(await self.balance(), 100)
        self.assertEqual(await self.db.credit_grants.count_documents({}), 1)

    async def test_missing_owner_rolls_back_renewal_ledger(self):
        with self.assertRaises(RuntimeError):
            await self.ns["_credit_renewal_once"]("invoice-missing", "stripe-sub", "missing", 100)
        self.assertEqual(await self.db.credit_grants.count_documents({}), 0)

    async def test_duplicate_paypal_sale_concurrent(self):
        await asyncio.gather(*(self.ns["paypal_webhook"](Request("sale-one"))
                               for _ in range(12)))
        self.assertEqual(await self.balance(), 100)
        self.assertEqual(await self.db.payment_transactions.count_documents({"kind": "sale"}), 1)

    async def test_distinct_new_paypal_sales_concurrent(self):
        await asyncio.gather(*(self.ns["paypal_webhook"](Request(f"sale-{i}"))
                               for i in range(12)))
        self.assertEqual(await self.balance(), 1200)
        self.assertEqual(await self.db.payment_transactions.count_documents({"kind": "sale"}), 12)

    async def test_distinct_legacy_paypal_sales_only_skip_one(self):
        await self.db.payment_transactions.insert_one({
            "session_id": "pp_sub_subscription-test", "credited": True
        })
        await asyncio.gather(*(self.ns["paypal_webhook"](Request(f"legacy-{i}"))
                               for i in range(12)))
        self.assertEqual(await self.balance(), 1100)
        self.assertEqual(await self.db.payment_transactions.count_documents({"kind": "sale", "credited": False}), 1)

    async def test_transient_transaction_error_is_retried_by_application(self):
        await self.client.admin.command({
            "configureFailPoint": "failCommand", "mode": {"times": 1},
            "data": {"failCommands": ["update"], "errorCode": 112,
                     "errorLabels": ["TransientTransactionError"]}
        })
        await self.ns["paypal_webhook"](Request("transient-sale"))
        self.assertEqual(await self.balance(), 100)
        self.assertEqual(await self.db.payment_transactions.count_documents({"kind": "sale"}), 1)

    async def test_unknown_commit_result_is_retried_without_double_credit(self):
        await self.client.admin.command({
            "configureFailPoint": "failCommand", "mode": {"times": 2},
            "data": {"failCommands": ["commitTransaction"], "errorCode": 91,
                     "errorLabels": ["UnknownTransactionCommitResult"]}
        })
        await self.ns["paypal_webhook"](Request("uncertain-commit-sale"))
        self.assertEqual(await self.balance(), 100)
        await self.ns["paypal_webhook"](Request("uncertain-commit-sale"))
        self.assertEqual(await self.balance(), 100)
        self.assertEqual(await self.db.payment_transactions.count_documents({"kind": "sale"}), 1)


if __name__ == "__main__":
    unittest.main()
