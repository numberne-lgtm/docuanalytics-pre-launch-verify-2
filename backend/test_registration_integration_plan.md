# Isolated registration integration checks

Not yet executed. Use a disposable database and synthetic accounts only.

1. Register a synthetic account with email verification enabled and an email sender stub.
2. Confirm login is blocked until verification.
3. Redeem the captured verification link and confirm one grant of free credits.
4. Replay the link and test simultaneous redemptions for duplicate grants.
5. Confirm recent-verification login eligibility and expiry after 24 hours.
6. Mock browser Ads SDK and check consent, event payload, and duplicate suppression.
7. Keep payment services, live email sending, real Ads events, and production database disconnected.

Release gate: no merge or deployment before isolated integration tests and explicit approval.
