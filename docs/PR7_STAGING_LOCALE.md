# Staging locale PR #7 — 0 crediti Emergent

Questa configurazione consente una verifica **sul proprio computer**, senza account, chiavi o crediti Emergent. NON è un server pubblico, NON è la produzione e NON esegue AI, invii email, pagamenti, upload o richieste esterne.

## Requisiti

- Docker Desktop / Docker Compose
- Node.js 22 e Yarn 1.x (per compilare il frontend)
- Codice del ramo `feature/risk-priority-numbering`

## Avvio locale (nessuna pubblicazione)

```bash
git checkout feature/risk-priority-numbering
cd frontend
yarn install --non-interactive
REACT_APP_BACKEND_URL='' CI=false yarn build
cd ..
docker compose -f compose.pr7.yml up --build
```

Il server sarà raggiungibile **soltanto dalla macchina locale** su
http://127.0.0.1:8765/area

Puoi aprire anche http://127.0.0.1:8765/area/priorita/document/pr7-analysis-a.

### Account rigorosamente sintetici

- Studio A: `studio-a@demo.invalid` / `synthetic-local-only`
- Studio B: `studio-b@demo.invalid` / `synthetic-local-only`

**Sono credenziali pubbliche fittizie; non usarle mai su un server accessibile da Internet.**
I documenti e i clienti creati in questo ambiente sono tutti inventati e salvati soltanto nel database Docker locale `pr7_synthetic_local_only`. Non è collegato ad alcun account, database o API reale.

### Regole di sicurezza

- Docker espone **soltanto il proxy HTTP nginx** su `127.0.0.1:8765`. MongoDB e FastAPI non pubblicano porte e condividono una rete interna privata. Il proxy collega il browser locale all'app e non contiene credenziali.
- L'applicazione e MongoDB sono collegati soltanto alla rete Docker `internal`, senza accesso diretto alla rete esterna. Il proxy si collega a due reti, ma non ha credenziali né altri upstream configurati.
- Lo staging applica `Content-Security-Policy` che vieta richieste browser verso servizi esterni (inclusi tracker e script di terze parti).
- La modalità è `APP_ENV=test`, `PR7_LOCAL_STAGING=1`; il server blocca la presenza di chiavi AI, Stripe, PayPal e Resend.
- Gli endpoint AI, pagamenti, invii email, upload, audit a pagamento e amministrazione rispondono con HTTP 503.
- Le schede delle priorità, le scadenze, i clienti, i QR e i PDF usano **il router reale `backend/workspace/router.py`** e il database MongoDB fittizio.
- Non usare `docker compose -f compose.pr7.yml up` in server remoti o host condivisi; non cambiare la porta in `0.0.0.0`.
- I QR generati riportano un URL localhost. Per questo non sono scansionabili direttamente da un telefono esterno: il test della decodifica QR è coperto dalla CI.

## Fine dei test / cancellazione dati

```bash
docker compose -f compose.pr7.yml down
```

Per cancellare anche i soli dati sintetici generati dal collaudo:

```bash
docker compose -f compose.pr7.yml down -v
```

## Limiti importanti

Questo staging utilizza **l'autenticazione fittizia** e le API reali dell'Area di lavoro. Non prova quindi l'autenticazione Google o il processo di registrazione autentico, i servizi di pagamento, il Copilot reale né il comportamento della produzione.

La CI GitHub esegue automaticamente test d'integrazione tramite `backend/tests/test_pr7_staging_local.py`, oltre ai test unitari e al browser smoke.

**Il browser end-to-end locale con il backend reale è ora verificato in GitHub Actions:** `frontend/scripts/pr7_local_e2e.cjs` viene eseguito con Chrome contro `http://127.0.0.1:8765`, dove il server `staging_local.py` e MongoDB sono avviati come processi isolati nel runner. Testa login, lettura persistente, QR/PDF, due utenti e blocco del Copilot. Quest'ultimo test non utilizza Docker Compose: la build e l'avvio Docker sul computer dell'utente restano da verificare.

## Prossimo gate

La PR può restare in bozza fino alla verifica delle condizioni DPA/subprocessori/retention con Emergent e alla disponibilità di un ambiente staging vero con credenziali di prova. Nessun merge né deploy è necessario per utilizzare lo staging locale.
