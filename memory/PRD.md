# DocuAnalytics AI — PRD & Stato Progetto

## AGGIORNAMENTO 2026-06 (4) — Hero demo animata + chiarimento API key
- **Hero demo animata**: componente React `HeroDemo` in App.js (tema scuro on-brand), testi `DEMO` in content.js (5 lingue), CSS `.hero-demo/.hd-*`. Loop: upload → documento (fattura esempio €1.240,00) → barra avanzamento (lettura/estrazione/controllo) → risultati (3 dati + Red-Flag) → Copilot Q&A. Dati FITTIZI ed etichettati. Inserita nella hero sotto i badge documenti. Verificata via screenshot (render + on-brand). In PREVIEW → richiede deploy per andare live.
- **Chiarimento API key** (dubbio utente): le chiavi del sito (Stripe/PayPal/LLM/JWT/Mongo) sono già configurate lato backend e protette; l'utente non deve fornirle. L'unica chiave nuova è RESEND_API_KEY, necessaria SOLO per attivare la verifica email (flag `EMAIL_VERIFICATION_ENABLED`).
- IN ATTESA dall'utente: RESEND_API_KEY + verifica dominio docuanalytics.online in Resend per attivare la verifica email; conferma deploy hero demo.

Richiesta utente: protezione API key al 100% + sicurezza su crediti e registrazioni ("ci sono bug").
- **API key**: audit conferma già protette al 100% (nessun segreto al frontend/hardcoded/loggato/in risposta). Nessuna azione.
- **SEC-002 (BOLA) — RISOLTO**: identità autoritativa dal JWT (`_auth_user_id`) su analyze, chat, payments/checkout, crypto/order, paypal/order, paypal/subscription/activate, subscriptions/cancel. GET /subscriptions/{id} e /referral/{id} ora richiedono auth (ignorano l'uuid nel path). Il frontend inviava già `Authorization: Bearer` → nessuna modifica FE.
- **Anti-farming crediti — RISOLTO (low-friction)**: cap sessioni anonime per IP (MAX_ANON_PER_IP_DAY=25), blocco auto-referral stesso-IP, rate-limit register (5/h/IP). IP risolto dall'hop fidato di X-Forwarded-For (`_client_ip` con TRUSTED_PROXY_HOPS=2, verificato: Cloudflare+ingress) → spoofing dell'header non bypassa più le difese.
- **Brute force login — RISOLTO**: rate-limit per IP (10/5min) E per account/email (8/15min, a prova di IP-spoofing).
- **Hardening P3 — FATTO**: webhook Stripe firma obbligatoria (unsigned→400), messaggi errore generici (`_generic_500`), CORS ristretto ai domini reali.
- **Verifica email (Resend) — PRONTA ma OFF**: scaffolding completo dietro flag `EMAIL_VERIFICATION_ENABLED=false` (register→credits 0 + email di conferma, GET /api/auth/verify accredita FREE_CREDITS, resend-verification, login bloccato se non verificato). Da attivare quando l'utente fornisce RESEND_API_KEY + dominio verificato in Resend. Dipendenza `resend` aggiunta.
- TEST: iteration_13.json — 25/25 audit + 4/4 PoC anti-spoofing PASS; regressione flussi legittimi 100% (anon analyze/chat, register, login, checkout, paypal order, copilot, export). Utenti di test ripuliti.
- Minori accettati/da valutare: /api/paypal/capture non autenticato (basso rischio: order_id server-side + re-check paid + idempotenza); GET /session/{id} espone email (info disclosure minore); rate-limiter in-memory si resetta al restart (mitigato dal limite per-account su login).
- DEPLOY: accodato (backend + .env non-segreti). Nessuna modifica a segreti/API/FE.

- **FASE 2 — Landing per settore**: nuove route `/commercialisti`, `/avvocati`, `/notai`, `/cfo`, `/hr`. Componente `SectorLanding({slug})` in App.js, contenuti in `content.js` SECTORS (5 settori × 5 lingue: meta_title/meta_desc/problem/solution/useCases/benefits/example). Ogni landing: header + hero (H1 = nome settore + value-prop, problema, soluzione, CTA→home #upload), Casi d'uso + Vantaggi, Esempio pratico, Sicurezza, Recensioni, altre landing, CTA finale. SEO: title+meta description dinamici per settore. Le card #settori della home navigano alle 5 landing (aziende → #upload). Aggiunte 5 URL a sitemap.xml con hreflang.
- **FASE 3 — Analytics funnel (GA4)**: helper `track()` + eventi `experiment_impression`, `cta_click`, `view_pricing` (con src), `view_item` (landing settore), `document_analyzed`, `sign_up`, `login`, `copilot_used`, `begin_checkout` (stripe/paypal), `purchase` (stripe/paypal/paypal_sub). L'utente può costruire i funnel in GA4 con questi eventi.
- **A/B test Hero**: `useHeroVariant()` assegna 50/50 A|B sticky in localStorage `da_hero_ab`; `<h1 data-testid="hero-h1" data-variant>`; variante inclusa in `cta_click` e `sign_up` per misurare l'impatto sulle registrazioni. Variante B: "L'AI che trova errori e rischi nei tuoi documenti / Analisi automatica e strutturata in pochi secondi".
- TEST: iteration_12.json 100% (8/8) — landing 5 lingue, SEO, navigazione, protezione route /payment/*, A/B, eventi dataLayer. Nessun bug.
- DEPLOY: accodato al deployer (un solo deploy pubblica Fase 1+2+3+A/B). Nessuna modifica a env/segreti/API backend.
- BACKLOG residuo: guard opzionale contro doppio-fire eventi in StrictMode (solo dev, prod ok); Instagram/X footer (URL mancanti); configurare PAYPAL_WEBHOOK_ID in prod per rinnovi.

Ristrutturazione homepage orientata alla conversione, senza rompere funzionalità esistenti. Tutte le nuove copy in 5 lingue (IT/EN/ES/DE/FR) via `src/content.js` (MT = stringhe UI, MARK = array marketing; il fallback di `t()` in App.js legge anche MT).
- **Hero** benefit-oriented: H1 "Analizza i tuoi documenti in pochi secondi / L'AI trova dati, errori e rischi prima di te", doppia CTA (Analizza gratis → #upload, Scopri come funziona → #come-funziona), nota "3 crediti gratuiti · Nessuna carta", rating 4,9/5 · 482+.
- Nuove sezioni ordinate: BenefitsStrip (#benefici), HowItWorks 4 step (#come-funziona), DocTypesSection (#documenti, card cliccabili → #upload), RedFlagSection (#red-flag), CopilotSection (#copilot), SectorsSection (#settori, card → #upload), SecuritySection (#sicurezza), PricingPreview (#prezzi, dati da GET /api/crypto/info), Faq, TrialCTA/FinalCTA (#prova).
- **Momento WOW**: barra in Results con conteggio REALE (n° campi estratti + n° controlli audit). CTA contestuale post-analisi (Analizza un altro documento / Acquista crediti) con crediti residui.
- Ancore header desktop (Come funziona, Prezzi), footer con email contatto docuanalitics@gmail.com.
- GA4: helper `track()` + eventi `cta_click`, `document_analyzed`, `sign_up`.
- Rimosso NewFeatures (sostituito da sezioni dedicate Red-Flag/Copilot che riusano CONTENT.features tradotti).
- Mobile-first: results-grid single-column <860px, CTA full-width <560px, nav-anchor nascosti <940px.
- TEST: iteration_10.json (suite completa homepage, 92% - core 100%), iteration_11.json (4 fix follow-up, 100%). Regressione OK su upload/analisi/copilot/export/pricing/auth/i18n.
- ⚠️ Tutto in PREVIEW. Produzione (docuanalytics.online) esegue ancora il codice precedente: serve DEPLOY per pubblicare.
- BACKLOG: FASE 2 = landing page per settore (/commercialisti, /avvocati, /notai, /cfo, /hr) — le card oggi scrollano a #upload. FASE 3 = funnel analytics avanzato + A/B testing.


## Problem statement (originale, IT)
"rivedi questo sito nella zip controlla se ci sono bug rendilo piu professionale possibile controlla tutti i metodi di pagamento che siano funzionanti fai un check completo prima del lancio"

## Contesto
L'utente ha fornito solo la BUILD COMPILATA (dist) di un sito vanilla JS "DocuAnalytics AI" (analisi documenti AI per studi legali/commercialisti IT). I sorgenti non erano nello zip. Bug critici trovati nella build:
- Link pagamento Stripe finti (placeholder `buy.stripe.com/test_...`) -> 404.
- SECRET KEY Stripe esposta nel frontend + chiamata `api.stripe.com` dal browser (gravissimo).
- Chiave Gemini vuota -> analisi AI non funzionante.

## Decisione architetturale
Ricostruito come full-stack sicuro: React (frontend) + FastAPI + MongoDB (backend). Secret key solo lato server.

## Tech stack / Integrazioni
- AI analisi documenti + copilot chat: Gemini `gemini-2.5-flash` via `emergentintegrations` (EMERGENT_LLM_KEY).
- Pagamenti Stripe: account PROPRIO dell'utente (BYOK, `STRIPE_API_KEY` in backend/.env, TEST mode sk_test). Account con Managed Payments attivo -> uso stripe SDK raw con `price_data` + `tax_code txcd_10000000` (niente payment_method_types). Tax mode = Stripe gestisce tutto (incl. tasse).
- Crypto: incasso MANUALE (BTC + USDT TRC20) con QR (api.qrserver.com). Nessun accredito automatico.

## Modello utente
Sessione anonima: user_id (uuid) in localStorage, 3 crediti gratis, 1 credito per analisi. Nessun login.

## Endpoint backend (server.py)
- POST /api/session, GET /api/session/{id}
- POST /api/analyze (guard mime+size, ownership), POST /api/chat (ownership 403)
- POST /api/payments/checkout (6 pacchetti, origin_url validato), GET /api/payments/status/{sid}, POST /api/webhook/stripe (re-verifica con Stripe)
- GET /api/crypto/info, POST /api/crypto/order, GET /api/packages

## Catalogo (server-side, EUR)
starter 50cr/€19 · pro 200cr/€49 · enterprise 1000cr/€149 · sub_single 100cr/€29 · sub_pro 500cr/€99 · sub_unlimited illimitato/€299.

## Stato (2026-06)
IMPLEMENTATO E TESTATO (19/19 backend + frontend E2E, 100%):
- Analisi documenti AI (estrazione campi + red-flag audit), copilot chat IT.
- Crediti + esaurimento (402).
- Stripe checkout REALE per tutti i 6 pacchetti (cs_test_ URL), status polling + accredito idempotente.
- Crypto: info wallet + QR + ordine manuale.
- Export CSV/JSON, UI fedele (dark glassmorphism neon).

## Aggiornamento (2026-06) — Sessione 2
- **FIX CRITICO**: la piattaforma iniettava `STRIPE_API_KEY=sk_test_emergent` a livello OS, shadowando il .env -> il backend usava il sandbox condiviso, non l'account dell'utente. Ora la chiave Stripe è letta con `dotenv_values('.env')` -> usa l'account reale `acct_1TwFeeFPaY5VPYYX` (IT, numberne@gmail.com).
- **ABBONAMENTI RICORRENTI REALI**: i pacchetti sub_* ora sono `mode=subscription` mensili su Stripe (Managed Payments + API version 2026-02-25.preview). Accredito iniziale via status-poll; rinnovi via webhook `invoice.payment_succeeded` (billing_reason=subscription_cycle). Endpoint: GET /api/subscriptions/{user_id}, POST /api/subscriptions/cancel (ownership 403, cancel_at_period_end). Frontend: sezione "I tuoi abbonamenti" con annullamento.
- Testato end-to-end con pagamenti REALI (carta 4242): pack +50 e abbonamento +100 crediti accreditati, lista+cancel OK. 26/26 backend, frontend 100%.
- NOTA: i rinnovi mensili automatici richiedono che il webhook `/api/webhook/stripe` sia registrato nel dashboard Stripe dell'utente (+ STRIPE_WEBHOOK_SECRET) in produzione.

- P1: Configurare STRIPE_WEBHOOK_SECRET in produzione (ora l'accredito è comunque sicuro via polling + re-verify).
- P1: Andare LIVE: attivare account Stripe (KYC) e sostituire sk_test con sk_live in STRIPE_API_KEY.
- P1: RIGENERARE la secret key Stripe esposta in passato.
- P2: Abbonamenti come recurring reali (ora sono ricariche one-time di crediti).
- P2: Pannello admin per confermare pagamenti crypto e accreditare crediti.
- P2: Multi-lingua (IT/EN/ES/DE/FR), PWA, referral (presenti nell'originale, rimandati).
- P3: Rate limiting su /session e /analyze; restringere mime a PDF/JPG/PNG/WEBP.

## Aggiornamento (2026-06) — Sessione 3: Auth + Referral + Contenuti + SEO + Live
- **Stripe LIVE**: chiave sk_live_ (letta da .env), account acct_1TwFeIF8wNmKqhiF, charges_enabled. Webhook Live configurato (STRIPE_WEBHOOK_SECRET) con verifica firma.
- **SEO**: index.html con title/description/keywords IT, canonical docuanalytics.online, Open Graph + Twitter + og-image.png, JSON-LD SoftwareApplication, GA4 (G-ZQ2FJJKY2H). robots.txt + sitemap.xml. (Token Search Console da sostituire per il nuovo dominio.)
- **Auth JWT email/password** (Bearer token in localStorage): register/login/me. La registrazione fa UPGRADE dell'utente anonimo preservando i crediti. Endpoint /api/auth/*. Nessun ruolo admin (non necessario).
- **Referral +5/+5**: codice referral per utente, link ?ref=CODE, bonus a inviter+invitee. Endpoint /api/referral/{user_id}. UI: header "Invita", ReferralModal (link+copy+WhatsApp/Telegram), ReferralBanner.
- **Contenuti completi ripristinati**: sezione NewFeatures (Red-Flag Audit, Copilot), Tutorials (5 step + placeholder video), ServicesGuideModal (guida enterprise 4 categorie).
- Testato: 39/39 backend (28 regressione + 11 auth/referral), frontend 100%.

## Promemoria aperto per l'utente
- BLOG SEO + landing per settore: da implementare (richiesto/rinviato dall'utente).
- PayPal: messo in pausa (servono Client ID + Secret).
- Ogni modifica in preview richiede un nuovo DEPLOY per andare in produzione (docuanalytics.online).

## Aggiornamento (2026-06) — Sessione 4: Contenuti extra + Logo + Social + Video demo + i18n
- Loghi eleganti generati (monogramma DA su sfondo nero) → header/footer/favicon/PWA icon. Social nel footer (LinkedIn/Facebook/Instagram/X/YouTube/Telegram; Facebook = facebook.com/lampone.francesco, resto placeholder da aggiornare).
- Sezioni contenuto: NewFeatures, Tutorials con DEMO ANIMATO auto-play (5 scene, play/pausa, dots), ServicesGuideModal.
- SEO: title/meta/OG/JSON-LD/GA4 + robots.txt + sitemap.xml + og-image.png.
- Auth JWT (register/login/me, Bearer) + Referral +5/+5.
- **i18n multilingua** (IT/EN/ES/DE/FR): I18nProvider + t() + LanguageSwitcher in header, persistenza localStorage 'da_lang', <html lang> sincronizzato. Tradotti: header, hero, upload, titoli/sottotitoli sezioni, footer, modali pricing/auth. I testi lunghi (descrizioni servizi, recensioni, step tutorial) restano in IT (traduzione profonda opzionale futura). Verificato dal testing agent (iteration_6): 5 lingue OK + persistenza.

## Aggiornamento (2026-06) — Sessione 5 (fork): i18n COMPLETO
- **ROOT CAUSE traduzione incompleta**: il dizionario `CONTENT` (services/features/tutorial/testimonials/guide/demo/docTypes/pipe) esisteva già tradotto in 5 lingue, MA i componenti (Services, NewFeatures, Tutorials, DemoPlayer, Testimonials, chips/hero, PricingModal, ReferralModal, ServicesGuideModal, Footer) usavano array Italiani HARDCODED e non leggevano mai `CONTENT`.
- **FIX**: cablati tutti i componenti a `useContent()`; aggiunte ~55 chiavi UI/notifiche in `T` per 5 lingue (results, pricing modal completo, crypto tab, referral modal, guide modal, footer, toast/notifiche pagamento/auth). Rimossi i costanti obsoleti (FEATURES, TUTORIAL_STEPS, DEMO_SCENES, GUIDE_SECTIONS, PIPE, label docType).
- **Verificato dal testing agent (iteration_7): 100% (7/7 item)** — tutte le sezioni cambiano lingua in IT/EN/ES/DE/FR, persistenza `da_lang` + `<html lang>` su reload OK (bug iteration_6 risolto), 0 errori console.

## Aggiornamento (2026-06) — Sessione 5b: hreflang + Blog multilingua
- **Blog multilingua (IT/EN/ES/DE/FR)**: `Blog.js` ristrutturato con `ARTICLES` e `BLOG_UI` keyed per lingua + `SLUGS` condivisi. Le 4 guide sono tradotte in tutte e 5 le lingue (titoli/desc/excerpt/body localizzati). Selettore lingua nel blog (`blog-lang-toggle` / `blog-lang-<code>`), persistenza `da_lang` + `<html lang>`, supporto URL `?lang=xx`.
- **hreflang SEO**: tag `<link rel=alternate hreflang>` iniettati via JS per IT/EN/ES/DE/FR + x-default, sia sulla homepage (useEffect in `Home`, App.js) sia su ogni pagina blog (`useSeo` in Blog.js). Canonical self-referencing per variante lingua. `I18nProvider` ora legge `?lang=` all'avvio → le URL per-lingua sono crawlabili.
- Verificato con screenshot: articolo EN (`/blog/controllo-quadratura-f24?lang=en`) renderizzato in inglese, index/articolo IT ok, regressione home ok. Compila senza errori (solo warning preesistente exhaustive-deps).

## Aggiornamento (2026-06) — Sessione 5c: PayPal + Social reali
- **Social footer** aggiornati con URL reali: Facebook (facebook.com/FrancescoEllee), LinkedIn (in/francesco-e-l-l-e-...), YouTube (@MisteriSvelatix). Instagram e X rimossi (non forniti) per evitare link morti. `SOCIALS` in App.js.
- **PayPal (REST v2)** — integrato come metodo alternativo a Stripe, SOLO per i pacchetti a pagamento singolo (starter/pro/enterprise). Endpoint backend: `GET /api/paypal/config`, `POST /api/paypal/order`, `POST /api/paypal/capture` (accredito idempotente via `_credit_if_paid`). Frontend: componente `PaypalCheckout` + tab "PayPal" nel PricingModal (carica PayPal JS SDK dinamicamente).
- **MODALITÀ LIVE (REALE)**: dal 2026-06 le credenziali Live dell'utente sono attive. `PAYPAL_MODE=live`, `PAYPAL_CLIENT_ID` (AS_hnt…), `PAYPAL_SECRET` in backend/.env. Verificato: OAuth live 200 e creazione ordine live OK (order_id reale). Le credenziali Sandbox precedenti sono state sostituite.
- Verificato da testing agent (iteration_8): backend 100% (7/7), frontend 100% (pulsanti PayPal renderizzati, regressioni Stripe/crypto/i18n/blog OK). Warning dev innocuo `<span> in <option>` (tooling).

## Aggiornamento (2026-06) — Sessione 5e: FAQ estese + PayPal abbonamenti + deploy
- **FAQ**: sezione ampliata a 4 domande (sicurezza documenti, prezzi/piano gratuito, tipi di file, tempi di analisi), accordion indipendenti, tradotte in 5 lingue (faq_q1-4/a1-4).
- **PayPal abbonamenti (LIVE)**: piani mensili creati on-demand e cachati in `db.paypal_plans` (P-* per sub_single/sub_pro/sub_unlimited). Endpoint `/api/paypal/subscription/plan`, `/activate` (accredito primo ciclo idempotente), `/api/webhook/paypal` (rinnovi PAYMENT.SALE.COMPLETED, con guard per non riaccreditare il primo ciclo; cancel/expire). `list_subscriptions`/`cancel_subscription` instradano per `provider`. Frontend: `PaypalCheckout` carica DUE SDK (window.paypal capture + window.paypalSub subscription via data-namespace) con toggle Pacchetti/Abbonamenti.
- Errori upstream PayPal: da 502→400 (Cloudflare nascondeva il dettaglio JSON sui 5xx).
- Verificato testing agent (iteration_9): backend 100% (6/6), frontend 100% (pulsanti Subscribe renderizzati, FAQ/banner/badge, regressioni OK).
- **DEPLOY** accodato al deployer agent (redeploy).

## ⚠️ AZIONE PRODUZIONE NECESSARIA
- In produzione devono essere presenti le env `PAYPAL_MODE=live`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` (e opz. `PAYPAL_WEBHOOK_ID`). Se assenti, PayPal risulterà "non disponibile" in produzione.
- Per i RINNOVI mensili PayPal automatici serve configurare un webhook nel dashboard PayPal (Live) verso `https://docuanalytics.online/api/webhook/paypal` (eventi PAYMENT.SALE.COMPLETED, BILLING.SUBSCRIPTION.*). Il primo mese è accreditato all'attivazione; i rinnovi richiedono il webhook.

## Security Audit (2026-06) — Sessione 5g
- **SEC-001 [HIGH] CORRETTO**: `/api/paypal/subscription/activate` ora deriva pacchetto/crediti dal `plan_id` reale della sottoscrizione PayPal (lookup in `paypal_plans`), non dal `package_id` inviato dal client. Impediva di richiedere i crediti di un pacchetto più costoso.
- **SEC-002 [HIGH] CORRETTO**: `/api/webhook/paypal` ora verifica la firma di ogni evento via `verify-webhook-signature` (PAYPAL_WEBHOOK_ID) e rifiuta (400) gli eventi non verificati prima di accreditare. NB: i rinnovi ricorrenti richiedono ora `PAYPAL_WEBHOOK_ID` nei secret di produzione (fail-closed); il primo mese è accreditato all'attivazione.
- **P3 CORRETTO**: confronto token admin constant-time (`hmac.compare_digest`).
- **SEC-003 [MEDIUM] APERTO (decisione di prodotto)**: molti endpoint (analyze, chat, paypal order/capture/activate, subscriptions) identificano l'utente via `user_id` nel body invece che dal JWT → BOLA se un UUID altrui trapela. Fix corretto = enforce JWT e derivare user_id dal token, MA romperebbe il free-tier anonimo (3 crediti senza registrazione). Richiede decisione: mantenere anonimo o richiedere login per analizzare.
- **P3 APERTI**: CORS `*` con allow_credentials=True (impostare origini esplicite); messaggi d'errore con testo eccezione grezzo su alcuni endpoint; fallback JWT_SECRET "change-me" (prod ha valore forte). NoSQL injection: NON APPLICABILE (query di uguaglianza, tipi Pydantic).
