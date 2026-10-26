import unittest
from datetime import datetime, timezone, timedelta
from registration_tracking import recently_verified_registration


class RegistrationTrackingTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 26, 12, 0, tzinfo=timezone.utc)

    def test_recently_verified(self):
        self.assertTrue(recently_verified_registration((self.now - timedelta(hours=1)).isoformat(), self.now))

    def test_not_yet_verified(self):
        self.assertFalse(recently_verified_registration(None, self.now))

    def test_outside_window(self):
        self.assertFalse(recently_verified_registration((self.now - timedelta(hours=25)).isoformat(), self.now))

    def test_future_timestamp(self):
        self.assertFalse(recently_verified_registration((self.now + timedelta(minutes=1)).isoformat(), self.now))

    def test_malformed_or_naive_timestamp(self):
        self.assertFalse(recently_verified_registration("invalid", self.now))
        self.assertFalse(recently_verified_registration("2026-10-26T11:00:00", self.now))


if __name__ == "__main__":
    unittest.main()
