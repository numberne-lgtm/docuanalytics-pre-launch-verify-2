"""PayPal ownership checks isolated from network/database calls.

Run: python -m unittest -q backend.test_paypal_subscription_claim
"""
import ast
from pathlib import Path
from typing import Optional
import unittest


def load_claim_validator():
    tree = ast.parse(Path(__file__).with_name("server.py").read_text(encoding="utf-8"))
    functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
                 and node.name == "_paypal_subscription_claim_valid"]
    if len(functions) != 1:
        raise AssertionError("PayPal subscription claim helper not found")
    namespace = {"Optional": Optional}
    exec(compile(ast.Module(body=functions, type_ignores=[]), "<claim>", "exec"), namespace)
    return namespace["_paypal_subscription_claim_valid"]


class PaypalClaimTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.valid = staticmethod(load_claim_validator())

    def setUp(self):
        self.sub = {"custom_id": "da-secret"}
        self.intent = {"_id": "da-secret", "user_id": "alice", "package_id": "sub_pro", "plan_id": "P-001"}

    def test_correct_user_and_plan(self):
        self.assertTrue(self.valid("alice", "sub_pro", "P-001", self.sub, self.intent, None))

    def test_other_account_cannot_claim(self):
        self.assertFalse(self.valid("bob", "sub_pro", "P-001", self.sub, self.intent, None))

    def test_wrong_plan_is_rejected(self):
        self.assertFalse(self.valid("alice", "sub_single", "P-001", self.sub, self.intent, None))

    def test_missing_intent_is_rejected(self):
        self.assertFalse(self.valid("alice", "sub_pro", "P-001", self.sub, None, None))

    def test_tampered_subscription_custom_id(self):
        self.assertFalse(self.valid("alice", "sub_pro", "P-001", {"custom_id": "other"}, self.intent, None))

    def test_existing_owner_cannot_be_overwritten(self):
        self.assertFalse(self.valid("alice", "sub_pro", "P-001", self.sub, self.intent,
                                    {"provider": "paypal", "user_id": "bob", "package_id": "sub_pro"}))

    def test_unclaimed_legacy_subscription_is_denied(self):
        self.assertFalse(self.valid("alice", "sub_pro", "P-001", {}, None, None))

    def test_existing_legacy_subscription_owner_is_allowed(self):
        self.assertTrue(self.valid("alice", "sub_pro", "P-001", {}, None,
                                   {"provider": "paypal", "user_id": "alice", "package_id": "sub_pro"}))

    def test_existing_legacy_other_user_is_denied(self):
        self.assertFalse(self.valid("bob", "sub_pro", "P-001", {}, None,
                                    {"provider": "paypal", "user_id": "alice", "package_id": "sub_pro"}))


if __name__ == "__main__":
    unittest.main()
