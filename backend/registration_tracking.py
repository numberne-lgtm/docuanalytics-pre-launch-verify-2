"""Pure eligibility rule for a recently verified registration (no DB or email calls)."""
from datetime import datetime, timezone, timedelta


def recently_verified_registration(verified_at, now=None):
    if not isinstance(verified_at, str):
        return False
    try:
        timestamp = datetime.fromisoformat(verified_at)
        if timestamp.tzinfo is None:
            return False
        current = now or datetime.now(timezone.utc)
        age = current - timestamp
        return timedelta(0) <= age <= timedelta(hours=24)
    except (ValueError, TypeError, OverflowError):
        return False
