"""Focused, dependency-light regression tests for PayPal first-sale credit policy.

Run: python -m unittest -q backend.test_paypal_sale_policy
No database, PayPal credentials, or network required.
"""
import ast
from pathlib import Path
import unittest


def load_policy():
    source = Path(__file__).with_name("server.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    matches = [
        node for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "_paypal_sale_should_credit"
    ]
    if len(matches) != 1:
        raise AssertionError("Expected exactly one PayPal sale policy function")
    module = ast.Module(body=matches, type_ignores=[])
    namespace = {"Optional": __import__("typing").Optional}
    exec(compile(module, "<paypal-sale-policy>", "exec"), namespace)
    return namespace["_paypal_sale_should_credit"]


class PaypalSalePolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.should_credit = staticmethod(load_policy())

    def test_new_subscription_first_verified_sale_credits(self):
        self.assertTrue(self.should_credit(0, {"credited": False}))

    def test_legacy_subscription_first_sale_does_not_double_credit(self):
        self.assertFalse(self.should_credit(0, {"credited": True}))

    def test_renewal_credits_even_for_legacy_subscription(self):
        self.assertTrue(self.should_credit(1, {"credited": True}))

    def test_renewal_credits_for_new_subscription(self):
        self.assertTrue(self.should_credit(1, {"credited": False}))

    def test_missing_activation_does_not_suppress_verified_sale(self):
        self.assertTrue(self.should_credit(0, None))


if __name__ == "__main__":
    unittest.main()
