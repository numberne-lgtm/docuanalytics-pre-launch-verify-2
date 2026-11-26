# GA4 / SEO release gate (draft, not deployed)

Public domain proposed: https://docuanalytics.online (matches backend default and marketing links). Verify both .online and .it live, HTTPS, redirects preserving attribution, canonical tags, Search Console ownership and sitemap before release. Do not modify DNS or existing Google verification token blindly. Sitemap contains 11 public routes from App.js and Blog.js, no login/payment/document URLs.

## GA4 property G-ZQ2FJJKY2H
Requires Editor access and verified property/stream. Do not activate production before completing this checklist:
- Web stream URL matches verified canonical public origin.
- Disable Enhanced Measurement / browser history page-change collection that can duplicate manual page_view or collect raw URLs. Check automatic event detection and every other tag/stream/destination for sensitive URLs, query strings, forms, and user-provided data. No document or checkout IDs, filenames, emails, tokens, or contents may be sent.
- Verify opt-in, reject, withdrawal and return visits in a test environment; test with outbound requests captured/blocked first, then approved separate test property. Review privacy notice and actual cookie behavior.
- Key events: sign_up only verified email flow (browser dedup, not cross-device); purchase only confirmed live Stripe / single PayPal captures. Do not mark session_start, page_view or view_item as business conversions. document_analyzed is an engagement metric, not unique activation; first_document_analyzed is a best-effort single backend claim after the first persisted analysis of a verified account with no prior history. Browser delivery requires consent and is not guaranteed; previous anonymous/history analyses are not backfilled. Treat as secondary activation, not revenue. Keep begin_checkout and registration_created as diagnostic funnel events.
- Inspect existing key event settings and imports into Ads before changing them; don't change campaign optimization or budget without specific approval. Changes to key event status do not retroactively repair old reports.
- Test filters for internal/developer traffic before activation. Keep production data separate from sandbox; do not generate synthetic production purchases. Validate with Tag Assistant and DebugView and compare genuine purchases with payment-provider records.
- PayPal subscriptions, renewals, Google login, cross-device signup deduplication and end-to-end first-analysis delivery validation remain separate work. Browser events are consent-dependent and cannot represent all revenue. No GA4 admin change was made in this draft.
- Instagram bio URL must be changed on the profile, not in Buffer:
  https://docuanalytics.online/?utm_source=instagram&utm_medium=organic_social&utm_campaign=dicembre_2026&utm_content=bio

References: https://support.google.com/analytics/answer/13128484
https://support.google.com/analytics/answer/9216061
https://support.google.com/analytics/answer/7201382

Release requires a green run for the latest commit (not an earlier run), preview/manual review and explicit approval of stacked PRs #1 and #8; confirm deployed source matches audited source before merging. No live transaction, deployment or DNS change.

## Payment lifecycle follow-up (release blocker for payment behavior changes)
- PayPal activation currently accepts APPROVED as well as ACTIVE, grants credits before a confirmed sale, and uses a non-atomic find/insert. Existing signed sale webhook assumes the first payment was credited by activation; sales arriving before subscription creation may be ignored. Do not count activation as revenue.
- Stripe invoice.payment_succeeded renewal handler currently credits on repeated webhook delivery; establish durable invoice-ID idempotency and reconcile existing records before changing renewal entitlement logic.
- Before modifying entitlements: verify production source and schema, review provider identifiers and subscription ownership, reconcile historical payments read-only, design durable unique event ledger and atomic accounting, test duplicates/concurrency, out-of-order delivery, pending/failed payment, first sale, renewals, cancellation, retry after partial failure, and live/sandbox isolation. No provider or database writes during audit.
- GA4 recurring revenue is not implemented. A signed provider event plus verified amount/currency and stable deduplication are required; server-side analytics must respect actual consent, not infer it from purchase.

## Draft renewal prototype
`backend/billing_renewal_safety.py` builds a conditional, single-user-document MongoDB update coupling the credit increment with a payment-specific marker. It is NOT connected to the Stripe or PayPal webhook handlers; no billing behavior is changed by this prototype. The isolated test sends 24 duplicate deliveries concurrently and asserts one increment, then applies a different payment. Production integration additionally requires globally unique provider-to-account binding, authoritative paid-event validation, historical reconciliation, cutover coordination (avoid legacy/new handlers processing the same payment), bounded document growth or durable transactional ledger design, and retry/recovery tests. The prototype does not replace payment records or establish revenue measurement.
