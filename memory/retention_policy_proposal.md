# Retention Policy — PROPOSAL (not active, no automatic deletion jobs)
Date: 2026-10-09. Status: DRAFT for owner + privacy consultant review. Periods below are OPTIONS, not decisions.
Simulation tool: /admin/privacy -> "Simulazione conservazione" (GET /api/admin/privacy/retention-simulation, read-only).

## Current state (verified in code)
- Uploaded file: temp file deleted right after analysis (already implemented).
- Analyses history (extracted data + full text): kept indefinitely. No TTL, no cron.
- Accounts: kept indefinitely. Anonymous browser sessions (users without email): kept indefinitely.
- Payments/subscriptions/crypto orders: kept indefinitely.
- Assistant analytics (assistant_events): anonymous, kept indefinitely.
- Privacy audit log (privacy_audit_log / privacy_requests): kept indefinitely.

## Proposed categories and options
| Data | Purpose | Option A (minimal) | Option B (balanced) | Option C (long) | Notes |
|---|---|---|---|---|---|
| Uploaded file | Processing | deleted after analysis | same | same | Already in place |
| Analysis history | Service (history, Copilot) | 6 months after creation | 12 months after last account activity | 24 months after last activity | Professionals may need longer access; offer self-service delete as alternative |
| Registered account | Contract | deletion on request + after 24 months inactivity (with email warning 30 days before) | 36 months inactivity | on request only | Inactivity warning requires email sending |
| Anonymous sessions (no email) | Free credits/anti-abuse | 30 days inactivity | 90 days | 12 months | Contain no direct identifiers except history |
| signup_ip | Anti-abuse | 30 days | 90 days | 12 months | Can be cleared without affecting service |
| Payments / invoices | Legal (fiscal) | 10 years (art. 2220 c.c.) | 10 years | 10 years | Not deletable on request; anonymize link to user if account deleted |
| Assistant analytics | Aggregate statistics | 12 months | 24 months | 36 months | Anonymous; low risk |
| Privacy requests + audit log | Accountability (GDPR art. 5.2) | 5 years | 5 years | 10 years | Contains only masked email / hashes |

## Before activating anything
1. Owner chooses periods (with privacy consultant).
2. Update /privacy page "Per quanto tempo conserviamo i dati".
3. Implement the job only after approval; run it first in dry-run mode, log results, then enable.
4. Optional: self-service "Elimina analisi / Elimina account" in the user area.
