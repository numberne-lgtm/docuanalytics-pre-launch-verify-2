"""Regression checks for one-time account verification in the actual API handler."""
import ast
import pathlib
import unittest


class AccountVerificationHandlerTests(unittest.TestCase):
    def test_account_update_is_conditional_and_referral_is_guarded(self):
        tree = ast.parse(pathlib.Path("server.py").read_text(encoding="utf-8"))
        handler = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "verify_email")
        updates = [
            n for n in ast.walk(handler)
            if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
            and n.func.attr == "update_one"
        ]
        self.assertEqual(len(updates), 1)
        query = updates[0].args[0]
        self.assertIsInstance(query, ast.Dict)
        keys = [k.value for k in query.keys if isinstance(k, ast.Constant)]
        self.assertIn("user_id", keys)
        self.assertIn("email_verified", keys)
        guarded = [
            n for n in ast.walk(handler) if isinstance(n, ast.If)
            and isinstance(n.test, ast.Compare)
            and isinstance(n.test.left, ast.Attribute)
            and n.test.left.attr == "modified_count"
            and any(isinstance(c, ast.Eq) for c in n.test.ops)
            and any(isinstance(v, ast.Constant) and v.value == 1 for v in n.test.comparators)
        ]
        self.assertEqual(len(guarded), 1)
        self.assertTrue(any(
            isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
            and n.func.id == "_apply_referral"
            for n in ast.walk(guarded[0])
        ))


if __name__ == "__main__":
    unittest.main()
