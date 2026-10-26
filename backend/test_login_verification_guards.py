"""Regression guards for login gating and advertising eligibility."""
import ast
import pathlib
import unittest


class LoginVerificationGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        tree = ast.parse(pathlib.Path("server.py").read_text(encoding="utf-8"))
        cls.login = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef) and node.name == "login")

    def test_unverified_account_is_blocked_before_token_issuance(self):
        body = self.login.body
        gate = next(
            (i for i, statement in enumerate(body)
             if isinstance(statement, ast.If)
             and any(isinstance(n, ast.Constant) and n.value == 403 for n in ast.walk(statement))
             and any(isinstance(n, ast.Name) and n.id == "EMAIL_VERIFICATION_ENABLED" for n in ast.walk(statement))),
            None,
        )
        self.assertIsNotNone(gate, "Missing email verification login gate")
        token_return = next(
            i for i, statement in enumerate(body)
            if isinstance(statement, ast.Return)
            and any(isinstance(n, ast.Name) and n.id == "_make_token" for n in ast.walk(statement))
        )
        self.assertLess(gate, token_return)

    def test_ads_eligibility_uses_recent_verified_timestamp(self):
        calls = [n for n in ast.walk(self.login)
                 if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                 and n.func.id == "recently_verified_registration"]
        self.assertEqual(len(calls), 1)
        self.assertTrue(any(
            isinstance(n, ast.Constant) and n.value == "email_verified_at"
            for n in ast.walk(calls[0])
        ))
        returned = [n for n in ast.walk(self.login) if isinstance(n, ast.Return)]
        self.assertTrue(any(
            isinstance(n, ast.Constant) and n.value == "recently_verified_registration"
            for statement in returned for n in ast.walk(statement)
        ))


if __name__ == "__main__":
    unittest.main()
