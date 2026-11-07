# PR #7 — Verifica provider AI / blocco privacy e costi

Verificato il 6 novembre 2026. Questo documento non contiene alcuna credenziale e non autorizza costi.

## Evidenza dal codice
- server.py usa la variabile `EMERGENT_LLM_KEY`, `emergentintegrations.llm.chat.LlmChat` e la scelta del modello:
  - analisi: gemini-2.5-flash, claude-sonnet-5, gpt-5.6-terra, gpt-5.4-mini (secondo la selezione).
  - Copilot documentale: modello selezionabile come sopra.
  - Copilot Area di lavoro nella PR #7: `with_model("openai", "gpt-5.4-mini")`.
- Non viene effettuata una chiamata diretta con chiave API OpenAI propria dell'utente. Emergent gestisce l'accesso alla route.
- La conferma definitiva dell'effettivo modello servito richiede una richiesta sintetica con la chiave preview (non effettuata).

## Risposta del supporto Emergent, 30 ottobre 2026, per DocuAnalytics
- Il pacchetto di pubblicazione include `backend/.env`; Emergent dichiara che il pacchetto è privato e non scaricabile dal pubblico.
- `EMERGENT_LLM_KEY` è condivisa fra preview e produzione; la separazione non era offerta alla data della risposta.
- Produzione riceve la variabile dal runtime; mantenere `APP_ENV=production` per ignorare il file `.env`.
- Ruotare la Universal Key interrompe subito la precedente e richiede coordinamento, non eseguire automaticamente.
- Emergent suggerisce monitoraggio usage e limite giornaliero sulla Universal Key.

## Documentazione ufficiale esterna
- Emergent Universal Key: https://help.emergent.sh/the-universal-llm-key — addebiti in crediti in base a token/modello; controllare usage dashboard.
- Emergent DPA: https://help.emergent.sh/data-processing-agreement
- Emergent localizzazione: https://help.emergent.sh/where-your-data-is-stored
- Emergent training: https://help.emergent.sh/ai-model-training
- OpenAI trattamento API: https://developers.openai.com/api/docs/guides/your-data
  OpenAI API: no training di default. Log di monitoraggio abuse conservati generalmente fino a 30 giorni; Zero Data Retention disponibile solo per clienti idonei approvati, con limitazioni.
- OpenAI modello/pricing: https://developers.openai.com/api/docs/models/gpt-5.4-mini
  Prezzi listino API: $0.75 / milione token input, $4.50 / milione token output.
  **Non sono i prezzi applicabili in automatico alla fatturazione Emergent.**

## Rischi e incertezze di produzione
1. Emergent non ha ancora risposto specificamente su eventuale subprocessor effettivo, regione di elaborazione/inferenza, retention del percorso Universal Key, applicabilità ZDR e trasferimenti al Copilot Area di lavoro.
2. Il solo flag di consenso nell'UI non garantisce conformità GDPR. Verificare base giuridica, istruzioni del titolare, obblighi e accordi studio/fornitore, informativa e minimizzazione (attenzione a fascicoli legali).
3. Per le ricerche generali, il Copilot invia riepiloghi e metadati; per la scheda selezionata può inviare fino a 7.000 caratteri di testo + campi con autorizzazione aggiuntiva. Non inviare documenti reali durante il collaudo.
4. Non è verificato un budget Emergent per singola chiamata né un limite centralizzato multi-processo; la lock in-process esistente non limita chiamate su più worker.
5. Esempio costo OpenAI nominale, **non Emergent**: 20.000 token input e 1.000 output = USD 0.0195, esclusi overhead e conversioni di valuta.

## Collaudo controllato
Script disponibile: `backend/scripts/pr7_provider_probe.py`, **non invocato**.
- Blocca l'esecuzione di default, controlla `APP_ENV` e richiede `PR7_PROVIDER_TEST_APPROVED=YES_ONE_SYNTHETIC_CALL`.
- Solo preview, solo frase sintetica, una singola richiesta e nessuna stampa della risposta o della chiave.
- Non verificare variabili/chiavi in produzione e non impostare arbitrariamente APP_ENV test su un processo live.
- Richiedere autorizzazione esplicita a consumare crediti prima di eseguire anche un solo test, osservare usage dashboard prima/dopo.

## Domande da trasmettere al supporto Emergent (bozza NON inviata)
1. Per `EMERGENT_LLM_KEY` con `LlmChat.with_model("openai","gpt-5.4-mini")`, confermate il fornitore di inferenza effettivo e l'eventuale fallback, endpoint e regione di trattamento?
2. Quali dati vengono registrati da Emergent e dal provider (prompt, output, allegati, metadati) e per quanto tempo? Come sono gestiti cancellazione, operatori e sicurezza?
3. Quali versioni DPA e lista subprocessor sono effettivamente applicabili al mio account e alla Universal Key? Ci sono trasferimenti extra UE? Sono disponibili ZDR/MAM o un instradamento UE vincolante?
4. È possibile fissare un limite massimo reale per richieste o spesa giornaliera del Copilot, bloccando auto-recharge? Come leggere addebiti/tokens di una singola chiamata?
5. Lo stato del problema `backend/.env` nel deployment image è cambiato? Separazione preview/prod e segregazione della Universal Key sono ora supportate?
6. Qual è la procedura raccomandata per test sintetico preview senza toccare LIVE, ruotare chiavi o pubblicare?

7. Per il piano DocuAnalytics, quali sono la frequenza e la durata dei backup di database e object storage? Quando i dati rimossi spariscono dalle copie e come si evita di ripristinarli per errore?
8. Quale procedura consente di cancellare definitivamente i loghi già rimossi nell’app, comprese versioni, repliche e copie? Come possiamo ottenere conferma dell’avvenuta cancellazione?

## Stato
La CI del codice e i test simulati non costituiscono prova contrattuale del trattamento dati.
**NO-GO** per attivare il nuovo Copilot con dati reali fino alle conferme sul trattamento e a una prova sintetica autorizzata. Nessun merge, deploy o richiesta AI a pagamento.
