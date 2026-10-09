# Data deletion on request — verification & procedure (2026-10-09)

## Verified state (code inspection, no changes made)
- NO API endpoint deletes analyses, accounts or history (`server.py` only has `DELETE /api/reminders/{id}`, which sets active=false).
- NO admin UI for deletion. NO automatic retention/expiry (no TTL index, no cron).
- => Today, deletion on request is possible ONLY as a MANUAL database operation by someone with write access to the production MongoDB (Emergent-managed). The deployer agent is read-only and cannot do it. Write access for the owner in production has NOT been confirmed.
- => Privacy page states "la cancellazione non è automatica" and offers the request by email. Executing the request reliably requires either confirmed DB write access or an admin deletion endpoint (backend change, needs approval).

## Manual procedure (to run only on explicit request, after identity check)
1. Receive request at docuanalitics@gmail.com; verify the requester controls the account email (reply from that address).
2. Find the user: `db.users.findOne({email: "<email>"}, {user_id: 1})` -> `<UID>`.
3. Delete personal content:
   - `db.analyses.deleteMany({user_id: "<UID>"})`  (history, extracted data, full text)
   - `db.reminders.deleteMany({user_id: "<UID>"})`
   - `db.email_verifications.deleteMany({user_id: "<UID>"})`
   - `db.referrals.deleteMany({$or: [{inviter: "<UID>"}, {invitee: "<UID>"}]})`
4. Payments (`payment_transactions`, `subscriptions`, `crypto_orders`): keep for fiscal/accounting retention; cancel active subscriptions first (Stripe/PayPal).
5. Account: delete `db.users.deleteOne({user_id: "<UID>"})` OR anonymize (unset email, name, password_hash, picture, signup_ip) if payment records must stay linked.
6. Reply to the user confirming deletion and date; log the request (date, scope) without personal content.
- Anonymous (non-registered) users: history is linked only to a browser ID; it can be deleted only if the user provides that ID (localStorage `da_uid`).

## GDPR flags (to review with a privacy professional)
- History is kept with NO predefined retention period -> define a retention policy (e.g. N months after last login) and document it.
- Records of processing, DPAs with sub-processors (Emergent, Google, Anthropic, OpenAI, Stripe, PayPal, Cloudflare, Resend, Google Analytics), cookie/consent for Google Analytics, controller data — all to be completed before publishing GDPR claims.
