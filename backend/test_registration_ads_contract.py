"""Cross-layer contract guards for signup conversion; no live browser or API calls."""
import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class RegistrationAdsContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.backend = (ROOT / "backend/server.py").read_text(encoding="utf-8")
        cls.frontend = (ROOT / "frontend/src/App.js").read_text(encoding="utf-8")
        cls.ads = (ROOT / "frontend/src/openaiAds.js").read_text(encoding="utf-8")

    def test_verification_required_response_does_not_trigger_conversion(self):
        self.assertRegex(
            self.frontend,
            r"if\s*\(data\.verification_required\)\s*\{[^}]*return\s*;\s*\}"
            r"[\s\S]*?trackAdsRegistration\(data\.user\?\.user_id\)"
        )
        self.assertIn('"verification_required": True', self.backend)

    def test_login_flag_is_checked_before_conversion(self):
        self.assertIn('"recently_verified_registration": eligible_registration', self.backend)
        self.assertRegex(
            self.frontend,
            r"if\s*\(data\.recently_verified_registration\)\s*"
            r"trackAdsRegistration\(data\.user\?\.user_id\)"
        )

    def test_ads_sdk_requires_opt_in_and_deduplicates(self):
        self.assertIn('localStorage.getItem(CONSENT_KEY) === "yes"', self.ads)
        self.assertIn('if (!userId || !initAdsPixel()) return false', self.ads)
        self.assertIn('if (measured.has(id)) return false', self.ads)
        self.assertIn('"registration_completed"', self.ads)
        self.assertIn('event_id: id', self.ads)


if __name__ == "__main__":
    unittest.main()
