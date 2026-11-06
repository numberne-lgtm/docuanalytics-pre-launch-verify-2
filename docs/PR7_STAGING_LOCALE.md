# Staging locale PR #7 — 0 crediti Emergent

Questa configurazione consente una verifica **sul proprio computer**, senza account, chiavi o crediti Emergent. NON è un server pubblico, NON è la produzione e NON esegue AI, invii email, pagamenti, upload o richieste esterne.

## Requisiti

- Docker Desktop / Docker Compose
- Node.js 22 e Yarn 1.x (per compilare il frontend)
- Codice del ramo `feature/risk-priority-numbering`

## Avvio su Mac, controllato e senza pubblicazione

Da una copia pulita del repository, sul ramo `feature/risk-priority-numbering`:

```bash
bash scripts/pr7_local.sh check
bash scripts/pr7_local.sh start
```

Il comando `check` verifica senza avviare container: Mac, Node 22, Yarn classic 1.x, Docker Desktop acceso, ramo di lavoro, porta 8765 disponibile, assenza di file `.env` frontend e rete privata della configurazione Compose. Il comando `start` compila il frontend e avvia lo staging soltanto se i controlli passano. Non modifica il ramo né importa alcun database remoto.

Per controllare o fermare:

```bash
bash scripts/pr7_local.sh status
bash scripts/pr7_local.sh stop
```

Solo per cancellare anche il volume MongoDB *sintetico* (conferma richiesta):

```bash
bash scripts/pr7_local.sh clean
```

**Se devi ancora clonare il repository**, utilizza GitHub con il tuo account autorizzato e seleziona il ramo `feature/risk-priority-numbering`, poi esegui i comandi dalla radice del repository. Non inserire mai chiavi Stripe, PayPal, Resend o Emergent nella copia di staging.

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

**Verifica CI eseguita:** il browser Chromium ha superato sia l'E2E con server FastAPI e MongoDB avviati nel runner, sia l'E2E sulla stessa applicazione lanciata come container Docker Compose con proxy nginx; vedi l'esecuzione Actions 42302261025. Anche la build e lo smoke test Docker Compose sono stati superati su Linux CI. **L'avvio su un Mac fisico (Intel o Apple Silicon) non è ancora stato verificato**: le immagini sono multi-architettura, ma il runtime arm64 richiede collaudo prima di un'affermazione di compatibilità completa.

## Prossimo gate

La PR può restare in bozza fino alla verifica delle condizioni DPA/subprocessori/retention con Emergent e alla disponibilità di un ambiente staging vero con credenziali di prova. Nessun merge né deploy è necessario per utilizzare lo staging locale.
