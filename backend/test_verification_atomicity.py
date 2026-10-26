"""Regression guard: email verification token must be claimed atomically."""
import ast
import pathlib
import unittest


class VerificationTokenAtomicityTests(unittest.TestCase):
    def test_verify_handler_uses_atomic_claim(self):
        tree = ast.parse(pathlib.Path("server.py").read_text(encoding="utf-8"))
        handler = next(
            n for n in tree.body
            if isinstance(n, ast.AsyncFunctionDef) and n.name == "verify_email"
        )
        calls = [
            n for n in ast.walk(handler)
            if isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute)
            and n.func.attr == "find_one_and_update"
        ]
        self.assertEqual(len(calls), 1, "Verification must atomically claim a token")
        self.assertGreaterEqual(len(calls[0].args), 2)
        filter_arg = calls[0].args[0]
        self.assertIsInstance(filter_arg, ast.Dict)
        filter_values = {
            k.value: v.value for k, v in zip(filter_arg.keys, filter_arg.values)
            if isinstance(k, ast.Constant) and isinstance(v, ast.Constant)
        }
        self.assertIs(filter_values.get("used"), False)


if __name__ == "__main__":
    unittest.main()
