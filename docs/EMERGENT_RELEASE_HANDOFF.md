# DocuAnalytics — rilascio sicuro nell'app Emergent esistente

Stato: handoff per il progetto Emergent che serve `https://docuanalytics.online`. Nessun deploy eseguito da questa procedura.

## Origine verificata
- Repository: `numberne-lgtm/docuanalytics-pre-launch-verify-2`.
- Sorgente: `feature/risk-priority-numbering`. Base `release/emergent-current`, PR #7.
- Prima di procedere annotare SHA del branch e ultimo esito CI. La PR include modifiche frontend/backend, non soltanto CSS.
- Il progetto Emergent esistente è quello del sito attuale: non creare un secondo progetto e non spostare il dominio.

## Modalità di trasferimento
Il tasto Re-publish pubblica **il codice presente nel Preview Emergent**, non il codice remoto GitHub.
Le FAQ ufficiali Emergent indicano che un import di repository è disponibile all'avvio di un nuovo job, mentre non esiste pull/merge automatico affidabile dentro un job già esistente.
Perciò, se il job Emergent attuale non può leggere GitHub e aggiornare il suo workspace in modo verificabile, **FERMARSI** e richiedere il trasferimento file/diff o assistenza senza ricreare la produzione.
- Prima di trasferire, salvare il commit/tag/snapshot del codice Preview Emergent e identificare il punto di rollback della versione Live.
- Confrontare il codice corrente del Preview con la base GitHub e applicare selettivamente le modifiche; non sovrascrivere per intero `backend/server.py` o `frontend/src/App.js` se contengono fix non presenti nella base.
- Non trasferire `.env`, `backend/.env`, dump MongoDB, dati utenti, credenziali, chiavi LLM, webhook o file privati.
- Non installare in produzione `backend/staging_local.py`, `backend/Dockerfile.pr7`, `compose.pr7.yml`, account sintetici, cookie di test o il proxy di localhost.
- Il nuovo modulo `backend/assistant/workspace_guide.py` deve essere incluso per il bot pubblico e il Copilot del documento.

## Gates PRIMA di Re-publish
1. Verificare che il Preview Emergent funzioni con il codice integrato e che `APP_ENV=test` (o equivalente ammesso) non cambi l'ambiente live.
2. React build e Python import/compile; controllare gli errori della console.
3. Account di prova autentico sul Preview: login, dashboard, analisi, pulsante verso Panoramica, evidenziazione nuovo documento, navigazione tastiera, schede Documenti, stati di revisione, note e correzioni, associazione cliente, gestione Scadenze, export.
4. Backend autenticato: ciascun account vede/modifica solo i propri documenti, clienti, scadenze e note. Un utente anonimo non ottiene dati dello studio.
5. Copilot pubblico e QR: `/assistant` è pubblico; fino al rilascio il bot deve chiamare le nuove funzioni anteprima. Copilot del documento e Copilot Area di lavoro richiedono login/consenso. Verificare risposte reali a domande sulla Panoramica, verifica e agenda.
6. Esaminare nomi delle variabili segrete necessarie (mai stampare valori). **LIVE e TEST non vanno confusi**. Verificare account reali non modificati, webhook PayPal e Stripe, email Resend, scheduler e policy cookie. Non ruotare credenziali senza coordinamento.
7. Test pagamenti con simulazioni controllate, non con acquisti reali non autorizzati. Controllare idempotenza e nessun accredito doppio.
8. Verificare privacy, termini e contatti pubblici prima di aprire pagamenti o promozioni rivolte al pubblico.
9. Confermare che la selezione sia **Re-publish** sul progetto attuale, non **Replace**, e che il database di produzione rimanga invariato.

Se un gate critico fallisce: NO_GO, niente Re-publish. Riportare file/errore e proposta di correzione.

## Dopo il Re-publish riuscito
- Controllare `https://docuanalytics.online` e pagine `/assistant`, `/area`, `/privacy`, `/dati-legali`.
- Fare un login di prova e verificare che dati utente preesistenti siano ancora accessibili; nessun reset o reimport database.
- Verificare una analisi reale solo se è stata esplicitamente autorizzata e con documento di prova non sensibile. Nessun nuovo acquisto reale senza autorizzazione.
- Controllare error log, webhook, email, scheduler e cookie consent.
- Annotare SHA di release, versione Preview, ID del publish, ora, verifica esiti e punto di rollback.

**Importante:** Emergent documenta che il Re-publish mantiene il database live e non aggiunge un nuovo canone alla pubblicazione già attiva; non equivale a un comando di merge del codice GitHub.
