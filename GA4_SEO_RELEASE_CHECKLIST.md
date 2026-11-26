# GA4 / SEO release gate (draft, not deployed)

Public domain proposed: https://docuanalytics.online (matches backend default and marketing links). Verify both .online and .it live, HTTPS, redirects preserving attribution, canonical tags, Search Console ownership and sitemap before release. Do not modify DNS or existing Google verification token blindly. Sitemap contains 11 public routes from App.js and Blog.js, no login/payment/document URLs.

## GA4 property G-ZQ2FJJKY2H
Requires Editor access and verified property/stream. Do not activate production before completing this checklist:
- Web stream URL matches verified canonical public origin.
- Disable Enhanced Measurement / browser history page-change collection that can duplicate manual page_view or collect raw URLs. Check automatic event detection and every other tag/stream/destination for sensitive URLs, query strings, forms, and user-provided data. No document or checkout IDs, filenames, emails, tokens, or contents may be sent.
- Verify opt-in, reject, withdrawal and return visits in a test environment; test with outbound requests captured/blocked first, then approved separate test property. Review privacy notice and actual cookie behavior.
- Key events: sign_up only verified email flow (browser dedup, not cross-device); purchase only confirmed live Stripe / single PayPal captures. Do not mark session_start, page_view or view_item as business conversions. document_analyzed is an engagement metric, not unique activation; first_document_analyzed is NOT implemented. Keep begin_checkout and registration_created as diagnostic funnel events.
- Inspect existing key event settings and imports into Ads before changing them; don't change campaign optimization or budget without specific approval. Changes to key event status do not retroactively repair old reports.
- Test filters for internal/developer traffic before activation. Keep production data separate from sandbox; do not generate synthetic production purchases. Validate with Tag Assistant and DebugView and compare genuine purchases with payment-provider records.
- PayPal subscriptions, renewals, Google login, cross-device signup deduplication and exact first-analysis activation remain separate work. Browser events are consent-dependent and cannot represent all revenue. No GA4 admin change was made in this draft.
- Instagram bio URL must be changed on the profile, not in Buffer:
  https://docuanalytics.online/?utm_source=instagram&utm_medium=organic_social&utm_campaign=dicembre_2026&utm_content=bio

References: https://support.google.com/analytics/answer/13128484
https://support.google.com/analytics/answer/9216061
https://support.google.com/analytics/answer/7201382

Release requires a green run for the latest commit (not an earlier run), preview/manual review and explicit approval of stacked PRs #1 and #8; confirm deployed source matches audited source before merging. No live transaction, deployment or DNS change.
