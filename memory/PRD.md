# DocuAnalytics AI — PRD & Stato Progetto

## AGGIORNAMENTO 2026-06 (20) — ChatGPT (OpenAI) come terzo provider ✅ TESTATO e2e (ADD ONLY)
- Scelta utente: ENTRAMBI i modelli (avanzato + veloce), via CHIAVE EMERGENT (universale, già in backend/.env).
- Backend (server.py): nuovo helper `_resolve_model()` mappa la chiave frontend → (provider emergentintegrations, model id, label):
  gemini→gemini-2.5-flash · claude→claude-sonnet-5 · openai→gpt-5.6-terra (avanzato) · openai-fast→gpt-5.4-mini (veloce).
  `/api/analyze` e `/api/chat` ora usano questo helper. Per Claude E OpenAI si usa il percorso VISION (immagine diretta
  o pagine PDF renderizzate in PNG con PyMuPDF via ImageContent base64); Gemini resta su FileContentWithMimeType.
- Frontend (App.js/App.css/content.js): selettore modello con 2 nuovi pulsanti `model-openai` (ChatGPT) e
  `model-openai-fast` (ChatGPT mini), hint i18n (openai_hint/openai_fast_hint, 5 lingue), helper `provLabel/provBadge`
  per etichette/badge coerenti in risultato, confronto modelli e storico. Badge verde `.mb-openai`. `.model-toggle`
  ora `flex-wrap` per non sforare su mobile con 4 opzioni. Palette toggle attivo aggiornata a blu/ciano.
- Test e2e curl (preview): analyze model=openai → provider=openai, category=invoice, 11 campi, totale 1.220,00 estratto,
  credito scalato; Copilot (model=openai) risponde corretto "1.220,00 EUR"; analyze model=openai-fast → provider=openai-fast OK.
- Nessuna regressione su Gemini/Claude (dispatch invariato per quei due).


## AGGIORNAMENTO 2026-06 (19) — Emergent-managed Google sign-in ✅ TESTATO 100% (ADD ONLY)
- Aggiunto login "Continua con Google" (Emergent Auth) ACCANTO a email/password, senza rompere nulla.
- Backend: nuovo `POST /api/auth/google` (server.py) — scambia il `session_id` monouso con Emergent session-data
  (lato server, mai dal frontend), fa upsert utente per email, preserva i crediti dell'utente anonimo se `user_id`
  passato, assegna 3 crediti gratuiti ai nuovi utenti Google (email già verificata), e rilascia lo STESSO JWT
  dell'app di login email/password ({token, user}). 401 su session_id non valido. `_public_user` ora include `picture`.
- Frontend: bottone `auth-google` nell'AuthModal (5 lingue, chiavi `auth_google`/`auth_or`) → redirect a
  `https://auth.emergentagent.com/?redirect=<origin>/` (nessun fallback hardcoded). `useUser()` processa
  `#session_id=` all'avvio, pulisce l'hash e stabilisce la sessione app. Nessuna API key richiesta (gestito da Emergent).
- Test iteration_19: backend 6/6, frontend 100%, zero regressioni (email/password, anonimo, logout, crediti). 
  Round-trip Google reale NON automatizzabile → va provato manualmente dall'utente.
- NB: service worker precedentemente portato a network-first v2 (fix cache logo).

## In sospeso — ChatGPT (OpenAI): utente ha scelto "entrambi i modelli (avanzato+veloce)" + "propria API key OpenAI".
  BLOCCATO in attesa della OPENAI_API_KEY dell'utente. Playbook già acquisito (emergentintegrations LlmChat,
  modelli es. gpt-5.6-terra avanzato + gpt-5.4-mini veloce; vision via ImageContent base64 per PDF→immagini).


## AGGIORNAMENTO 2026-06 (18) — Brand/UI/SEO refresh (nuovo logo DA) ✅ TESTATO 95% (ADD ONLY)
- **Nuovo logo ufficiale DA** (scudo, monogramma DA viola→ciano, bordo oro). Da `image-2.jpeg` 1024² generati via chroma-key in `public/`: `docuanalytics-ai-logo.png` (trasparente, main/SEO), `logo.png` (navbar/footer), `favicon.ico` + `favicon-16/32/48`, `apple-touch-icon.png` (180, su navy), `icon-192/512.png` (any) + `icon-512-maskable.png` (safe zone su navy), `og-image.png` (1200×630, logo+wordmark su navy). Tutti 200.
- **Palette → blu/ciano** (viola solo accento): `:root` `--primary:#2f6bff`, `--accent:#22c7ff`, `--bg-color:#070b16`, glow/radiali/header aggiornati. `theme_color/background_color` manifest = `#0a1022`.
- **UI branding (ADD ONLY)**: header e footer già usano `/logo.png`; hero-right = `.hero-logo-badge` (logo DA fluttuante) + `HeroDemo` (mockup UI reale); AuthModal con `.auth-logo`. Nessuna funzione rimossa.
- **SEO tecnico → dominio canonico `docuanalytics.online`**: `index.html` canonical/OG/twitter + Schema.org `@graph` (Organization + WebSite + WebApplication, logo URL assoluto, niente rating/offer fittizi); favicon set corretto; title/description aggiornati. `PUBLIC_ORIGIN` e hreflang (App.js) + `SITE` (Blog.js) → .online. `sitemap.xml` ripulita (rimossi /pricing /features /how-it-works /login /register; solo home, blog, 5 landing settore) e tutto su .online. `robots.txt`: `Disallow: /payment/` + sitemap .online.
- **FIX BUILD (autorizzato)**: rimosso import `Trash2` duplicato + entry-point `RemindersModal` non definito (stato `remOpen`, prop, bottone nav, render) che impedivano la compilazione. La card "Crea promemoria" in `Results` (POST /api/reminders) resta attiva. Build: Compiled (0 errori).
- Test: `iteration_18.json` frontend 95% — branding, asset 200, SEO, nav, auth (register/login mario@studio.it/secret123/logout), pricing modal (6 pacchetti + tab), referral, landing settore, mobile 390px. Zero errori console. Unico flag (click Stripe in automazione) = FALSO POSITIVO: checkout verificato via API → ritorna sessione `cs_live_` reale. Nessuna regressione.
- ⚠️ Backend/DB/auth/pagamenti/segreti NON modificati. Tutto in PREVIEW → richiede DEPLOY per andare live. Google Search Console: inserire token property `docuanalytics.online` (placeholder attuale è della property .it) + inviare sitemap dopo deploy.


## AGGIORNAMENTO 2026-09 (16) — Reminder Scadenze completati + fix build deploy ✅
- **Reminder Scadenze** (contratti/F24): backend `POST/GET/DELETE /api/reminders` + scheduler asyncio (`_reminder_loop`, check ogni 12h) che invia email 30/7/1 giorni prima via Resend. `_send_email_bg` ora ritorna esito (non marca "inviato" se l'invio fallisce). CRUD + scheduler testati via curl (invio+marcatura OK con mittente verificato).
- **Frontend Reminder**: card "Crea promemoria" in `Results` quando c'è una scadenza (contract.expiration_date / f24.due_date) e l'utente è loggato; modal "Scadenze" (`RemindersModal`) dal header con badge conto-alla-rovescia e delete. i18n 5 lingue.
- **Resend**: key configurata; `SENDER_EMAIL=noreply@docuanalytics.it`. ⚠️ Dominio NON ancora verificato su Resend → gli invii dal dominio custom falliscono finché non si aggiungono i record DNS su Register.it. `EMAIL_VERIFICATION_ENABLED=false` (non attivata per non rompere la registrazione).
- **FIX BUILD DEPLOY**: rimosso import duplicato `Trash2` (App.js:12) e definito `RemindersModal` mancante → il deploy era fallito su `yarn build`. Verificato `CI=false yarn build` → **Compiled successfully** (exit 0). Deploy ri-triggerato.
- ⚠️ La UI Reminder non è ancora stata testata end-to-end via browser (solo build + backend curl).

## AGGIORNAMENTO 2026-09 (15) — Sicurezza pre-push GitHub (audit + bonifica + purga storia)
- `.gitignore` esteso (`.env`, `.env.*`, `**/.env`, `_incoming/`); `backend/.env` e `frontend/.env` ora IGNORED e non tracciati.
- `_incoming/` (bundle legacy "DocuMind" con Stripe secret key hardcoded) rimosso dal tracking e **purgato da TUTTA la storia Git** (`git filter-branch` + gc). File fisici preservati (236). Storia e snapshot: **0 segreti**. Nessun remote, nessun push. Consigliata rotazione prudenziale della Stripe key legacy.


## AGGIORNAMENTO 2026-06 (14) — Italian Professional Accounting & Legal Export Engine ✅ TESTATO (95%→fix)
- **Estrazione strutturata tipizzata**: il prompt di `/api/analyze` ora restituisce `category` (invoice/f24/visura/contract/other) e `structured` con schema dedicato per categoria (fattura: supplier/customer/document/totals/vat_lines/iban/line_items; F24: taxpayer/sections/codici tributo/saldi; visura: company/REA/ATECO/rappresentanti; contratto: parties/date/penali/reminder). Selettore categoria manuale nel drawer come fallback.
- **Validatori CF/P.IVA** (checksum): `export_engine.py` (Python) + `content.js` (JS) — P.IVA algoritmo di controllo mod10, Codice Fiscale tabelle pari/dispari mod26. Validazione live nel Field Mapping.
- **Drawer "Export & Sync"** (`ExportDrawer`, portalato su document.body): badge GDPR (testo accurato "nessuna conservazione · file non salvato"), selettore categoria, Field Mapping Preview editabile (flattenObj/setByPath) con validazione live inline, e opzioni export.
- **Export multi-formato**: XML FatturaPA v1.2 bozza NON firmata SDI (lxml, solo categoria invoice); Excel/CSV pre-mappati per Zucchetti/TeamSystem/Datev Koinos/Passepartout (openpyxl, tracciati GENERICI etichettati "da adattare"); JSON con metadata; PDF Executive Summary (jsPDF+autotable, con tabelle campi/audit e testo estratto per verifica OCR side-by-side).
- Endpoint: `POST /api/validate`, `POST /api/export/fatturapa`, `POST /api/export/accounting` (fmt xlsx|csv). Deps: lxml, openpyxl (già in requirements.txt).
- Test: `iteration_17.json` → 8/8 scenari funzionali OK (download tutti i formati, validazione live, edit mapping persistito, gating FatturaPA). Bug MEDIO overlay non full-viewport (containing block da transform su .fade) → RISOLTO con React portal. Migliorata validazione `piva_cf`.
- ⚠️ TRASPARENZA: NON dichiarata conformità XSD SDI completa (FatturaPA è bozza) né compatibilità 1:1 con i gestionali (tracciati generici). Badge GDPR: solo "no-retention" (verificabile); "Processed in EU" NON asserito perché dipende dalla region del provider LLM (Emergent/Gemini/Anthropic) — da confermare prima di eventuale claim EU.

## AGGIORNAMENTO 2026-06 (13) — Storico Riapribile + Export Confronto ✅ TESTATO (100%)
- **Storico Riapribile**: pulsante `history-reopen` in ogni voce dello Storico carica l'analisi passata nella vista risultati principale (`#results`) con badge modello e Copilot funzionante (chat resettata via `key={analysisId}`). Il confronto è nascosto per le analisi riaperte (nessun file in memoria → `canCompare`).
- **Export Confronto**: nel `compare-panel` pulsanti `compare-export-csv` e `compare-export-pdf`. CSV e PDF (jsPDF + jspdf-autotable, client-side) con tabella a 3 colonne (Campo, Modello1, Modello2). Deps aggiunte: jspdf, jspdf-autotable.
- Test: `iteration_16.json` → 100%, download CSV/PDF verificati, Copilot su analisi riaperta OK, zero errori console. Fix applicato: `key={analysisId}` su Results per resettare la chat.
- Nota: il confronto crea una seconda analisi reale (con l'altro modello) che appare anch'essa nello Storico — comportamento voluto.
- Deploy in produzione: avviato dopo questa iterazione.

## AGGIORNAMENTO 2026-06 (12) — Claude hint + Storico analisi + Confronto modelli ✅ TESTATO (100%)
- **Claude Consigliato**: hint contestuale sotto il selettore (`data-testid="model-hint"`) — Claude "consigliato per contratti e testi lunghi", Gemini "veloce su fatture e documenti strutturati". 5 lingue.
- **Storico Analisi**: nuovo `GET /api/analyses` (auth via `_auth_user_id`, max 50, ordinato per data) + `HistoryModal` aperto dal bottone header `nav-history`. Lista con tipo doc, badge modello, data (localizzata per lingua) ed espansione dettaglio campi.
- **Confronto Modelli**: pulsante `compare-btn` in `Results` che rianalizza lo STESSO file (ancora in memoria nel browser — nessun file salvato sul server, privacy preservata) con l'altro modello e mostra `compare-panel` a due colonne con badge e campi. Consuma 1 credito.
- Test: `iteration_15.json` → 5/5 scenari passati, nessun errore console. Fix minore applicato (locale data storico per lingua).
- Note code-review (non bloccanti, backlog): App.js grande (~2080 righe, valutare split); compare no-op se file assente dopo reset; HistoryModal non distingue errore fetch da lista vuota.

## AGGIORNAMENTO 2026-06 (11) — Badge Modello + Claude su PDF + deploy ✅ TESTATO
- **Claude su PDF**: i PDF vengono renderizzati in immagini (PyMuPDF `pymupdf==1.28.2`, max 5 pagine, matrix 2x) e inviati a Claude vision. Ora la scelta Gemini/Claude vale su TUTTI i documenti (immagini e PDF). Gemini resta default con attachment file nativo.
- **Badge Modello**: `/api/analyze` salva e ritorna `ai_provider` ("gemini"/"claude"); `Results` mostra un chip `data-testid="model-badge"` (Claude Sonnet 5 arancio / Gemini blu) nella wow-bar. Stringa i18n `analyzed_by` in 5 lingue.
- Test e2e (localhost): Claude analyze su PDF fattura ✅ (ai_provider=claude, campi estratti), badge cablato ✅.
- **Deploy in produzione**: avviato via deployer (job queued) con Claude multi-modello + badge + Claude-PDF.
- **Verifica Email (Resend)**: ancora PENDING — l'utente ha saltato la Resend API key. Scaffolding pronto; da attivare quando l'utente fornisce la key + dominio verificato. Scelte da riconfermare al momento dell'attivazione (mittente dominio proprio vs resend.dev; crediti sbloccati dopo verifica vs entro un limite).


- Aggiunta scelta modello AI: **Gemini** (default) o **Claude Sonnet 5** (`claude-sonnet-5`), via Emergent LLM key (nessuna chiave utente).
- Selettore UI (`data-testid="model-select"`, `model-gemini`, `model-claude`) accanto al pulsante "Analizza"; stato `aiModel` in `Home()`.
- Backend `server.py`: `AnalyzeReq.model` e `ChatReq.model`; dispatch provider in `/api/analyze` (Claude vision per immagini, Gemini per PDF) e `/api/chat` (Copilot Gemini o Claude).
- Nota comportamento: Claude analizza le IMMAGINI (vision); i PDF usano sempre Gemini (attachment file non supportato via Claude in questo path). Fallback silenzioso a Gemini per PDF anche se l'utente sceglie Claude.
- Stringa i18n `ai_engine` in 5 lingue (`content.js`); stili `.model-select/.model-toggle/.model-opt` in `App.css`.
- Test e2e (localhost): Gemini analyze ✅, Claude analyze su immagine fattura (campi estratti correttamente, credito -1) ✅, Copilot Claude ✅. Provider Claude verificato via Emergent key.
- NON ancora deployato in produzione: richiede publish esplicito dall'utente.


## AGGIORNAMENTO 2026-06 (9) — Icone PWA dedicate + deploy (PWA + dominio .it)
- **Icone PWA su misura**: generata icona on-brand (documento + spark AI + lente, gradiente ciano→viola su tile scura). Create `public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`; `manifest.json` aggiornato (icons any + maskable); aggiunto `apple-touch-icon` in index.html. Tutte 200.
- **DEPLOY accodato**: pubblica PWA (manifest/sw/icone) + migrazione dominio docuanalytics.it (sitemap/robots/canonical/OG/hreflang/PUBLIC_BASE_URL/CORS). Nessuna modifica a segreti/API.
- IN ATTESA utente: collegare docuanalytics.it su Emergent (Link domain) + DNS Register.it + redirect 301 .eu/.online; fornire RESEND_API_KEY per verifica email.


- **Dominio principale → docuanalytics.it**: sostituito `docuanalytics.online` in tutto (sitemap 82 URL, robots.txt, canonical+OG index.html, hreflang App.js/Blog.js, `PUBLIC_BASE_URL`). CORS ora ammette .it/.eu/.online (+www) + preview. `.eu` e `.online` andranno in redirect 301 → .it (lato registrar Register.it). Passaggi piattaforma forniti (Emergent "Link domain" + DNS Register.it + Search Console "Cambio indirizzo").
- **PWA**: `public/manifest.json` (name/short_name DocuAnalytics, start_url "/", standalone, bg #000000, theme #6B5CE7, icons logo.png); `public/index.html` head con manifest + theme-color #6B5CE7 + apple-mobile-web-app-capable/title; `src/index.js` registra `/sw.js` on load; `public/sw.js` cache-first per asset core (/, index.html, manifest, logo), network-first per navigazioni, salta /api e cross-origin. Verificato: sw.js/manifest 200, nessun errore console.
- ⚠️ Tutto in PREVIEW: richiede DEPLOY per andare live (+ collegamento dominio lato utente).


- Report code-review valutato criticamente. La maggior parte erano falsi positivi o refactor stilistici rischiosi su app live → non applicati (token localStorage = design JWT; `is False` server.py = uso corretto del singleton; hook-deps/split/useMemo/key statiche/catch no-op = warning senza impatto utente).
- **UNICA modifica applicata**: in PaypalCheckout sostituito `ref.current.innerHTML = ""` con `ref.current.replaceChildren()` (2 punti) per rimuovere il pattern segnalato (svuotamento contenitore prima del mount dei bottoni PayPal). Funzionalmente identico.
- TEST iteration_14.json: 100% — bottoni PayPal packs+subs montano, toggle tab senza errori, Stripe ok. Nessuna regressione. Cambio funzionalmente neutro → nessun deploy urgente, si allinea al prossimo.


- **Hero demo a rotazione**: `DEMO` in content.js ora ha `variants` (fattura, contratto, busta paga) per 5 lingue, ognuna con campi estratti e Red-Flag specifici; `HeroDemo` cicla `di` a ogni loop. Rimossa la fase Copilot dalla demo (Copilot resta come sezione dedicata). Loop più rapido. Dati fittizi etichettati.
- Verificato: compila senza errori console; deploy accodato (frontend-only).
- Meta description settore: le attuali sono già SEO-ottimizzate (keyword + beneficio + CTA "3 crediti, senza carta"); in attesa di eventuali keyword target dall'utente per un tuning mirato.


- **Hero a due colonne (desktop)**: testo + CTA a sinistra, `HeroDemo` animata a destra (CSS `.hero-2col/.hero-left/.hero-right`, breakpoint 1000px; su mobile impilato). Layout SaaS ad alta conversione.
- **H1 SEO landing settore**: SectorLanding ora deriva un H1 keyword-rich dallo split del `meta_title` (parte prima di "|", divisa su "—" in titolo bianco + sottotitolo gradient). Es. /avvocati → "AI per Avvocati / Analisi contratti e clausole".
- Verificato via screenshot (hero 2col + demo + H1 landing). DEPLOY accodato (frontend-only). Verifica email ancora OFF (attende RESEND_API_KEY).


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

## 2026-10-09 — FASE 1: Assistente AI commerciale (/assistant) — PREVIEW ONLY (not deployed)
- Backend isolated module `backend/assistant/` (router.py, assistant_kb.md, generate_qr.py), mounted in server.py via `build_assistant_router(...)`.
- Endpoints: GET /api/assistant/config, POST /api/assistant/chat (Gemini 2.5 Flash -> fallback gpt-5.4-mini), POST /api/assistant/event, GET /api/assistant/stats (X-Admin-Token).
- Limits (.env): ASSISTANT_DAILY_BUDGET=100, ASSISTANT_SESSION_LIMIT=10, ASSISTANT_IP_HOURLY_LIMIT=20, ASSISTANT_MAX_REPLY_TOKENS=1500; msg max 500 chars, history 6 turns, honeypot `website`.
- New collections: assistant_events (hashed session, event, utm only), assistant_usage (daily counter).
- Frontend: src/assistant/AssistantPage.jsx + assistant.css, route /assistant; Home opens AuthModal on ?auth=register.
- QR PNG/SVG + links.txt in frontend/public/assistant-qr/ (qr, linkedin, facebook, instagram, brochure, presentazione).
- Tested: iteration_21 (100%), regression analysis/copilot/history/credits OK via curl.
- Pending: user approval to deploy; homepage button to /assistant; sitemap entry; admin conversion dashboard UI.

## 2026-10-09 — Assistant button + Conversion dashboard (PREVIEW ONLY, not deployed)
- Floating "Parla con l'assistente" button (AssistantFab, inside Footer -> homepage + 5 sector pages) + footer link; UTM: utm_source=site, utm_medium=fab|footer, utm_campaign=<page>. i18n key assistant_cta (5 langs).
- /admin/assistant (AdminAssistant.jsx): admin token typed by hand (sessionStorage only), noindex; KPIs, per-channel and per-day tables, register conversion; GET /api/assistant/stats?days=7|30|90.
- Sitemap NOT updated (only at authorized deploy). Security copy NOT changed: proposal in /app/memory/security_copy_proposal.md awaiting approval.

## 2026-10-09 — Security/privacy copy applied in PREVIEW (not deployed)
- Truthful copy in 5 langs: security cards, privacy banner, trust badges, FAQ a1/a4, footer desc, HR sector, blog privacy; removed "482 recensioni"/rating; "2 secondi" -> "pochi secondi".
- New /privacy page (PrivacyPage.jsx, IT) with DRAFT banner and placeholders [Ragione sociale, P.IVA, Indirizzo, data] — MUST be filled before deploy. Footer link "Privacy".
- Deletion on request: NOT implemented in app; manual DB procedure documented in /app/memory/data_deletion_procedure.md. Retention policy undefined -> GDPR review required.
- Real sign-up tracking (signup_completed) NOT implemented: needs 1-line backend change (EVENTS whitelist) — user forbade backend changes in this step.
- Sitemap still NOT updated (/assistant, /privacy to add at authorized deploy).
- 2026-10-09: /privacy controller filled in PREVIEW: Francesco Lampone (impresa individuale), P.IVA 03803270838, C.F. LMPFNC83E23A638T, Via Edoardo De Filippo 68, 98051 Barcellona Pozzo di Gotto (ME). Source: certificato attribuzione P.IVA 31/03/2025 (ATECO: procacciamento d'affari). PENDING owner checks: P.IVA status, ATECO update for DocuAnalytics, fiscal domicile update. Date = deploy date (placeholder). Draft banner kept.

## 2026-10-09 — Admin privacy tools + sign-up tracking + retention proposal (PREVIEW ONLY)
- backend/privacy_admin/router.py (/api/admin/privacy: config, lookup, requests, requests/{id}/execute, log, retention-simulation). Admin token; identity = requester email must equal account email + method + reference + attestation; confirm = re-typed email + "ELIMINA"; dry-run default; real deletion blocked unless ADMIN_DELETION_ENABLED=true (false in preview). Audit in privacy_audit_log, requests in privacy_requests (masked email + hash only).
- Real deletion = delete analyses/reminders/email_verifications/referrals, anonymize user, keep payments (fiscal). NOT executed in tests (by design).
- Sign-up tracking: CTA click sets localStorage da_from_assistant; App login() calls POST /api/assistant/signup; counted only if account created <48h, deduped (hash). Registration logic untouched. Limitation: anon session older than 48h upgraded to account is not counted (undercount).
- /admin/privacy UI (AdminPrivacy.jsx); /admin/assistant shows "Registrazioni completate".
- Retention proposal: /app/memory/retention_policy_proposal.md (options, no job). Tested: iteration_22 100%.
- 2026-10-09: QR kit section added to /admin/assistant (preview): 6 channels, PNG/SVG download, copy link, links.txt. All 12 files decoded OK at 260px.
- 2026-10-09: QR regenerated with brand colors (#2f6bff modules, #0a1022 finders, white bg), logo center (20%, ECC H) in PNG 2600px/300dpi and SVG (embedded logo). Robustness decode OK (blur, rotation, low contrast, dim, jpeg, 200px).
- 2026-10-09: Homepage AssistantPromo section (#assistente, after SectorsSection) with QR (qr-web.png 520px) + button -> /assistant?utm_source=site&utm_medium=home_section; sector pages AssistantNudge strip (no QR) before TrialCTA; i18n ap_* keys 5 langs. PREVIEW ONLY.
- 2026-10-09: Share menu (AssistantShare.jsx, react-icons) in homepage assistant section: WhatsApp/Facebook/LinkedIn share URLs, Instagram/TikTok via navigator.share (+QR file) or fallback copy/download, copy link, QR download. utm_medium=share.
- 2026-10-11: Public email -> docuanalyticsai@docuanalytics.online (footer, /privacy, assistant KB). SENDER_EMAIL (noreply@docuanalytics.it, Resend) NOT changed. DNS: MX IONOS (mx00/mx01.ionos.it), SPF ionos only, DMARC p=none; mailbox send/receive NOT verified.
- QR card actions: Copia link (base URL), Copia QR (ClipboardItem, fallback download), Scarica PNG, SVG; share menu native-share item. Deploy dispatched.
- Voice Live: NOT implemented (awaiting authorization; requires realtime voice API).

## 2026-10-11 — FASE 1 Evoluzione prodotto: Area di lavoro /area (PREVIEW ONLY, not deployed)
- Backend backend/workspace/{core.py,router.py} mounted at /api/workspace (registered users only via get_current_user): sync, overview (Risk Dashboard+Priorità), documents (+detail, candidates, assign), clients CRUD (create/list/360/patch/delete), deadlines (buckets, create, patch, confirm, delete), audits (create deterministic, list, get, deep AI 1 credit atomic w/ refund).
- Data: new collections clients, multi_document_audits; optional fields on analyses (client_id, client_link, ws_synced, risk_level) and reminders (status detected|to_verify|confirmed, source auto|manual, kind, client_id, raw_date). Auto deadlines have notify_days [] until confirmed. Legacy GET /api/reminders now hides unconfirmed auto deadlines.
- Sync is lazy (on /area load), /api/analyze untouched. Auto client link only on exact P.IVA/CF match with a single existing client.
- Frontend src/workspace/* (Italian UI), route /area, header link nav-workspace (authed). Tested iteration_23 (backend 100%, frontend all flows; fixes applied after).
- Not done: page/section refs in audit (not in extraction), i18n for /area, Fase 2.

## 2026-10-25 — FASE 1 final smoke test (PREVIEW ONLY, no deploy)
- Report: /app/test_reports/iteration_24.json (UI desktop+mobile 100%, backend 21/21 + 28 combined).
- Fixed: core.structured() unwraps AI output nested under category key (auto-link P.IVA was failing intermittently); PATCH /clients duplicate P.IVA/CF -> 409 and empty name rejected; deep audit lock expires after 3 min (deep_started); AI sources no empty "()"; singular "1 documento".
- Open (low): header credits badge not refreshed after deep audit until reload; audit shows raw field keys; native date input mm/dd; first sync of 500 analyses ~5s (N+1), analyses beyond 500 not synced; _check_reminders relies on notify_days=[] (no explicit status filter).
- Demo testimonials/99%/12 ore claims still on homepage (untouched, pending decision).

## 2026-10-25 — /area UX improvements (PREVIEW ONLY, no deploy)
- Credits pill in /area top bar (workspace-credits), updates immediately after deep audit (onCredits).
- Audit field labels in Italian via fieldLabel()/SEG map in workspace/api.js; unknown keys auto-humanized.
- Deadlines date input: DateField.jsx (Radix Popover + react-day-picker with own CSS, Italian locale, gg/mm/aaaa, Monday start, re-click keeps date). NOTE: Tailwind is NOT active in this project — shadcn components need plain CSS.
- Report: /app/test_reports/iteration_25.json + post-fix screenshot check (desktop/mobile).

## 2026-10-25 — Notify days, calendar export, clean AI wording (PREVIEW ONLY, no deploy)
- Per-deadline email days: chips 30/15/7/3/1/0 (NOTIFY_CHOICES); unconfirmed auto deadlines store notify_pref (never emailed), applied on confirm. Past-date confirm asks confirmation.
- Calendar: GET /api/workspace/calendar.ics (auth); private feed POST/GET/DELETE /api/workspace/calendar/feed, public GET /api/workspace/feed/{token}.ics. Token secrets.token_urlsafe(32), stored only as sha256 in users.calendar_feed; regenerate revokes old. Only confirmed/manual deadlines exported.
- Deep audit: AI receives Italian-labeled data (core.labeled), outputs cleaned by core.clean_tech (protects emails/URLs).
- Tests: iteration_26.json, backend/tests/test_calendar_notify.py (11/11).
- Open: 1 smoke-suite real-AI auto-link check failed once in iter26 (AI-output variance suspected, not investigated).


## 2026-10-25 — Auto-link robustness, client PDF report, per-client calendar (PREVIEW ONLY, no deploy, no AI calls)
- Auto-link: core.category() normalises/infers category; structured() handles JSON strings and Italian wrapper keys; norm_id strips label prefixes (P.IVA, CF, P.IVA/CF, IT); ids_from_text() merges exact IDs from fields/full_text (older/partial analyses). Safety unchanged: exact ID + exactly one client; manual unlink respected. 38 older analyses (Jul/Aug) without structured data can now link via fields.
- GET /api/workspace/clients/{cid}/report.pdf — reduced client-facing PDF (pymupdf Story): identifiers, public registry, documents+extracted fields, confirmed deadlines, disclaimer. No risk/red flags/unconfirmed deadlines.
- Per-client calendar: /clients/{cid}/calendar.ics and /clients/{cid}/calendar/feed (GET/POST/DELETE), token hash in clients.calendar_feed, public /feed/{token}.ics resolves user or client feed.
- Tests: iteration_27.json, backend/tests/test_client_autolink_report_feed.py.
