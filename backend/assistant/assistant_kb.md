# DocuAnalytics AI — Knowledge Base dell'assistente commerciale
(Solo fatti verificati sul codice in produzione. Prezzi e crediti NON sono qui: vengono iniettati dalla configurazione backend.)

## Cos'è
DocuAnalytics AI è una piattaforma web (https://docuanalytics.online) che analizza documenti professionali con l'intelligenza artificiale: classifica il documento, estrae i dati chiave in modo strutturato, esegue controlli anti-errore (audit / red-flag) e permette di fare domande sul documento tramite il Copilot AI.

## Documenti supportati
- Formati: PDF, JPG, PNG, WEBP, fino a 10 MB per file.
- Tipi riconosciuti: fattura / fattura elettronica, modello F24, contratto, visura camerale, busta paga / cedolino, documento generico.
- Dati estratti (a seconda del tipo): importi, imponibile, IVA, totali, date, partite IVA, codici fiscali, IBAN, parti coinvolte, codici tributo, saldi, REA, codici ATECO, clausole, obblighi e scadenze contrattuali.

## Audit e red-flag
L'analisi include controlli automatici, ad esempio: quadratura totale = imponibile + imposta, saldo F24, netto busta paga, segnalazione di clausole potenzialmente vessatorie, IBAN esteri, soglia visto di conformità IVA oltre 5.000 €, altre anomalie. Sono segnalazioni di supporto: non sostituiscono la verifica del professionista.

## Copilot AI
Dopo l'analisi l'utente può fare domande in linguaggio naturale sul documento analizzato (es. "qual è il totale?", "quando scade il contratto?"). Il Copilot risponde basandosi solo sul contenuto del documento. Le domande al Copilot non consumano crediti.

## Motori AI disponibili
L'utente può scegliere il motore di analisi: Gemini, Claude, ChatGPT, ChatGPT mini. È presente anche una funzione di confronto tra motori.

## Strumenti per lo studio
- Validazione formale di partite IVA e codici fiscali.
- Esportazione XML in formato FatturaPA.
- Esportazione Excel/CSV con tracciati per software gestionali: Zucchetti, TeamSystem, Datev Koinos, Passepartout (tracciati generici da adattare, NON ufficiali dei produttori).
- Storico delle analisi nel proprio account.
- Promemoria scadenze via email per contratti e F24 (richiede account registrato).

## Account e accesso
- Registrazione con email e password oppure con "Continua con Google".
- Si può provare anche senza registrazione con i crediti gratuiti iniziali.
- Programma "invita un collega" (referral): bonus crediti sia per chi invita sia per l'invitato (valore indicato nella sezione prezzi).

## Pagamenti
- Carta tramite Stripe per pacchetti e abbonamenti mensili.
- PayPal per i pacchetti a pagamento singolo (e abbonamenti PayPal dove disponibile).
- Crypto (BTC, USDT TRC20) con accredito manuale dopo conferma on-chain.

## Sicurezza e privacy (solo fatti verificati)
- Trasmissione su connessione HTTPS cifrata.
- Il file caricato viene elaborato e il file temporaneo viene eliminato al termine dell'analisi.
- I dati estratti dall'analisi vengono salvati nello storico dell'utente per poterli riconsultare.
- L'elaborazione AI avviene tramite fornitori di modelli AI esterni (Google Gemini, Anthropic Claude, OpenAI).
- NON affermare certificazioni, audit di sicurezza, ISO, server esclusivamente in UE o garanzie legali. Per domande specifiche su GDPR/DPA invitare a contattare il supporto.

## Contatti
- Email ufficiale: docuanalyticsai@docuanalytics.online

## Destinatari e casi d'uso
- Commercialisti: estrazione dati da fatture e F24, controlli di quadratura, export verso gestionali.
- Avvocati: analisi contratti, parti, durata, clausole penali/vessatorie, scadenze.
- Notai: lettura visure camerali, rappresentanti legali, dati societari.
- CFO / imprenditori: controllo fatture fornitori, IBAN, totali, anomalie.
- HR / consulenti del lavoro: buste paga, netto, controlli di coerenza.
- Altri professionisti che gestiscono documenti amministrativi.

## FAQ
- Tempo di analisi: in genere pochi secondi.
- Serve installare qualcosa? No, funziona dal browser, anche da smartphone.
- I risultati sono sempre corretti? L'AI può commettere errori: i risultati vanno sempre verificati dal professionista.

## Cosa NON esiste (non dichiararlo)
- Nessuna app mobile nativa sugli store, nessuna API pubblica per sviluppatori, nessuna integrazione diretta automatica con i gestionali (solo file di export), nessuna firma digitale, nessuna conservazione sostitutiva, nessun invio allo SDI.
