# Security & Privacy Copy Review — PROPOSAL ONLY (not applied)
Date: 2026-10-09. No site text has been changed. Real behaviour verified in code (backend/server.py):
- File uploaded -> written to a temp file -> sent to the chosen AI provider (Google Gemini / Anthropic Claude / OpenAI) -> temp file deleted (`os.unlink`) at the end.
- Extracted results (fields, audit, structured data AND `full_text` of the document) are SAVED in MongoDB `analyses` (user history; used by Copilot).
- Transport: HTTPS (Cloudflare + ingress). Encryption at rest / AES-256, EU-only servers, GDPR/EU AI Act compliance: NOT demonstrable from code or infra.

## A. Claims NOT demonstrable or inaccurate
| # | Where | Current claim | Problem |
|---|---|---|---|
| 1 | content.js `security` (5 langs) | "Conforme al GDPR — Trattamento dei dati conforme al Regolamento europeo" | No privacy policy/DPA/register verified |
| 2 | content.js `security` | "Server in UE — elaborazione su infrastruttura UE" | AI providers are external (US companies); hosting region not verified |
| 3 | content.js `security` | "Elaborazione in tempo reale — senza archiviazione" | Extracted data + full text are archived in history |
| 4 | content.js `security` | "Nessun documento memorizzato" | True for the FILE only; extracted content is stored |
| 5 | App.js `priv_banner` (5 langs) | "...nessun dato resta sui nostri server" | False: extracted data stays in history |
| 6 | App.js `faq_a1` (5 langs) | "non memorizza alcun file... senza lasciare alcuna traccia... Nessun sistema automatico conserva... Pienamente conforme al GDPR" | Traces remain (history); GDPR not demonstrable |
| 7 | App.js `badge_gdpr` (5 langs) | "Conforme al GDPR" | Not demonstrable |
| 8 | App.js `badge_noshare` (5 langs) | "Nessuna condivisione con terze parti" | Documents are sent to AI providers (sub-processors) |
| 9 | App.js `foot_desc` (5 langs) | "• Server UE • GDPR" | Not demonstrable |
| 10 | App.js sectors HR (lines ~287/310 + EN/ES/DE/FR) | "compliance GDPR & EU AI Act, server 100% UE, crittografia AES 256-bit" | Not demonstrable |
| 11 | Blog.js "Privacy e conformità" (5 langs) | "server 100% in UE con crittografia AES 256-bit, GDPR e EU AI Act" | Not demonstrable |
| 12 | content.js `gdpr_badge` | "Elaborazione senza conservazione · File non salvato" | "senza conservazione" inaccurate (file not saved = true) |
| 13 | App.js | "4.9/5 — Basato su 482 recensioni verificate" + testimonials | Unverifiable marketing claim (consumer-protection risk) |
| 14 | App.js faq_a4 / sectors | "In media circa 2 secondi" | Measured in tests: ~5–15 s depending on model |

## B. Proposed truthful wording (IT; EN/ES/DE/FR to be translated identically on approval)
Security cards:
1. "File eliminato dopo l'analisi" — "Il file caricato viene elaborato e cancellato dai nostri server al termine dell'analisi."
2. "Solo i dati estratti nel tuo storico" — "Conserviamo i dati estratti e il testo del documento nel tuo storico, per consultarli e usare il Copilot."
3. "Connessione HTTPS cifrata" — "I dati viaggiano sempre su connessione protetta."
4. "Fornitori AI selezionati" — "L'analisi è eseguita tramite i modelli AI di Google, Anthropic o OpenAI, a tua scelta."
5. "Accesso solo al tuo account" — "Analisi e storico sono visibili solo al tuo account."
6. (remove "Conforme al GDPR" and "Server in UE")

priv_banner: "Il file che carichi non viene conservato: è elaborato e cancellato al termine dell'analisi. Nel tuo storico restano solo i dati estratti."
faq_a1: "Il file caricato viene elaborato tramite il motore AI scelto (Google, Anthropic o OpenAI) e cancellato dai nostri server al termine dell'analisi. I dati estratti e il testo del documento vengono salvati nel tuo storico, accessibile solo dal tuo account, per consultarli e usare il Copilot. La trasmissione avviene sempre su HTTPS."
badge_gdpr -> "File cancellato dopo l'analisi"; badge_noshare -> "Fornitori AI selezionati"; badge_nostore -> "File non conservato".
foot_desc: "Estrazione automatica di dati per studi legali, notai e commercialisti".
gdpr_badge: "File non conservato · Cancellato dopo l'analisi".
HR sector: "Quadratura Lordo/INPS/IRPEF/Netto e verifica TFR maturato." (remove GDPR/AI Act/UE/AES items).
Blog "Privacy e conformità": "Il file viene cancellato al termine dell'analisi e i dati estratti restano nello storico del tuo account. Prima di caricare documenti con dati personali, verifica le informative del tuo studio."
Reviews: remove "482 recensioni verificate"/rating, or replace with real, sourced reviews.
Timing: "In pochi secondi".

## C. Prerequisites to legitimately re-introduce GDPR / EU claims
Privacy policy + cookie policy published, DPA with sub-processors (Emergent hosting, Google, Anthropic, OpenAI, Stripe, PayPal), records of processing, data retention/deletion policy for `analyses`, confirmed hosting region.
