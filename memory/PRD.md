# DocuAnalytics AI — PRD & Stato Progetto

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
- **MODALITÀ SANDBOX (TEST)**: le credenziali fornite dall'utente sono di tipo Sandbox (sandbox OAuth 200 / live 401). `PAYPAL_MODE=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` in backend/.env. NESSUN pagamento reale finché non si passa a credenziali LIVE + `PAYPAL_MODE=live`.
- Verificato da testing agent (iteration_8): backend 100% (7/7), frontend 100% (pulsanti PayPal renderizzati, regressioni Stripe/crypto/i18n/blog OK). Warning dev innocuo `<span> in <option>` (tooling).

## Promemoria aperto
- PayPal: passare a credenziali **LIVE** per pagamenti reali (creare app Live su developer.paypal.com → aggiornare le 2 chiavi + `PAYPAL_MODE=live`). Abbonamenti PayPal (billing plans) = step futuro; ora PayPal solo per pack one-time.
- Social: Instagram/X non forniti → assenti dal footer (riaggiungibili con URL reali).
- OPZIONALE: aggiungere URL `?lang=` al sitemap.xml.
- Ogni modifica richiede DEPLOY per andare in produzione (docuanalytics.online).
