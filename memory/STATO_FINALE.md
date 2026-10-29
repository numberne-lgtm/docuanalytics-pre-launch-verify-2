# DocuAnalytics AI — Stato finale (stop sviluppo, 2026-10-26)

Ambiente: SOLO PREVIEW (https://pre-launch-verify-2.preview.emergentagent.com). Nessun deploy eseguito in questa sessione. FASE 2 non iniziata.

## Aggiornamento 2026-10-26 (ripresa dai problemi aperti)
- Mittente: invariato (noreply@docuanalytics.it in backend/.env SENDER_EMAIL). docuanalytics.online NON ancora verificato su Resend (utente). La chiave Resend è "solo invio": lo stato dominio non è leggibile dall'app. Proposta approvata: dopo "Verified", cambio solo SENDER_EMAIL (slot preview) a "DocuAnalytics AI <notifiche@docuanalytics.online>" via modulo sicuro + invio di prova a nunberne@gmail.com. Test email reali: ANCORA DA FARE.
- 2 analisi AI reali (fattura PNG, contratto PDF): entrambe associate automaticamente al cliente giusto (P.IVA esatta), 3 scadenze rilevate, storico OK. Associazione Cliente 360 RICONFERMATA.
- Ritest completo (iteration_30): tutte le aree PASS. Corretti 2 bug minori solo-preview (StrictMode): firma studio che cancellava il testo digitato; doppio record di confronto per clic. File: StudioSettings.jsx, AuditView.jsx.
- Restano: email reali, cron reale del lunedì, UX confronto tra documenti di tipo diverso (sezioni vuote senza spiegazione), limite registrazioni 5/ora che rende instabili le suite di test consecutive.
- Nessun deploy.

- 2026-10-26: avviso nel confronto per documenti di tipo diverso (AuditView.jsx, workspace.css), verificato in UI su 3 casi. Mittente ancora non verificato su Resend → cambio mittente e test email reali in attesa.

- 2026-10-29: SENDER_EMAIL (solo slot preview) = "DocuAnalytics AI <notifiche@docuanalytics.online>". 3 invii reali a nunberne@gmail.com (report, avviso cliente, riepilogo) RIFIUTATI da Resend: "The docuanalytics.online domain is not verified". Nessun bug di codice. Probabile chiave RESEND_API_KEY di un account/team Resend diverso da quello dove è stato verificato il dominio, oppure verifica non ancora attiva. Account di prova nunberne@gmail.com + dati test lasciati in preview per ripetere (script /app/memory/mailtest.py report|digest|log; .mailtest.json).

- 2026-10-29 (bis): nuova RESEND_API_KEY (account con dominio verificato). Destinatario corretto numberne@gmail.com (il vecchio nunberne era errato). 3 invii reali dall'account preview numberne con dati fittizi: report PDF, promemoria cliente, riepilogo → ARRIVATI in Posta in arrivo; mittente, Reply-To, firma+logo, allegato PDF confermati dall'utente. Crediti invariati (53). Dati di prova rimossi (cliente/scadenza fittizi, firma+logo fittizi, account test nunberne); preservati account numberne, crediti, impostazioni e 3 righe email_log. SENDER_EMAIL cambiato solo in preview; LIVE invariato (noreply@docuanalytics.it) → al deploy va aggiornato anche lo slot live. Nessun deploy.

- 2026-10-29 PRE-DEPLOY CHECK (nessun deploy): build frontend OK; iteration_31 tutte le aree PASS (backend 76+39 test). Da fare al deploy: SENDER_EMAIL live = "DocuAnalytics AI <notifiche@docuanalytics.online>"; WEBHOOK_CRON_SECRET live presente (verificare); RESEND_API_KEY condivisa già nuova. Punti non bloccanti: CORS_ORIGINS senza www.docuanalytics.online/dominio emergent.host (prod finora funzionante, da verificare dal deployer); nessun timeout sulle chiamate LLM (assistente può restare in attesa se il provider non risponde); pulsante "Crea promemoria" nei risultati home non visibile (codice presente ma non renderizzato); header mobile pesante.

## 1. Implementato (preview, testato)
- FASE 1 Area di lavoro (/area): Cliente 360, Risk Dashboard, Scadenze automatiche, Multi-Document Audit + analisi approfondita AI (1 credito, anti doppio addebito, rimborso su errore, blocco con scadenza 3 min).
- Collaudo finale FASE 1 (iteration_24) + correzioni: associazione automatica robusta (formati AI diversi, prefissi P.IVA, analisi vecchie/parziali), duplicati P.IVA/CF in modifica cliente rifiutati.
- Saldo crediti in alto in /area, etichette italiane nel confronto, calendario date gg/mm/aaaa.
- Analisi approfondita con testo in italiano chiaro (niente nomi tecnici).
- Giorni di avviso email per scadenza (30/15/7/3/1/giorno stesso).
- Export calendario: file .ics + link di abbonamento privato, lungo, revocabile/rigenerabile (globale e per singolo cliente).
- Report PDF per il cliente (versione ridotta) da Cliente 360.
- Email cliente in scheda, invio report PDF via email (risposte al professionista, limite 20/giorno).
- Riepilogo del lunedì (attivabile dall'utente, ore 8:00 Europe/Rome, cron .emergent/crons.yml) + anteprima.
- Avvisi scadenza anche al cliente (interruttore per scadenza) + messaggio personale per scadenza.
- Firma dello studio (nome, recapiti, logo caricato su Object Storage) nelle email ai clienti.
- Storico "Email inviate" nella scheda cliente.

## 2. Approvato/proposto ma NON implementato
- Cambio mittente a @docuanalytics.online (in attesa verifica dominio su Resend da parte dell'utente).
- Voice Live (richiede credenziale OpenAI Realtime, non disponibile).
- Proposti e non fatti: logo nel report PDF, anteprima email cliente, modelli di messaggio, export scadenze per cliente già fatto (non pendente).
- Privacy definitiva, periodo di conservazione dati: ancora bozza/proposta.
- Testimonianze e claim demo ("99%", "12 ore", nomi) ancora presenti in homepage: decisione utente pendente.
- FASE 2: non iniziata.

## 3. Bug / limiti aperti
- BLOCCANTE CONFIG: Resend rifiuta il mittente docuanalytics.it (dominio non verificato) → nessuna email reale parte in preview (promemoria, report, riepilogo, conferme email). Da verificare anche in produzione.
- Riepilogo settimanale: se l'invio fallisce, non viene ritentato nella stessa settimana.
- Performance: prima apertura /area con 500 analisi ~5 s; analisi oltre le 500 più recenti non elaborate.
- Risultati di analisi approfondite create prima delle correzioni restano col vecchio testo.
- Associazione mancata osservata 1 volta (iteration_26): causa non dimostrata (nessuna chiamata AI per riprodurla); coperte le cause plausibili.
- Warning React preesistente App.js (hook dependencies) non bloccante.

## 4. Test da completare
- Invio email reale end-to-end (report, avviso cliente, riepilogo, firma/logo inline) dopo verifica dominio, verso nunberne@gmail.com.
- Scatto reale del cron del lunedì (testato solo chiamando l'endpoint).
- Una nuova analisi AI reale per riconfermare l'associazione automatica.
- Accettazione utente di tutte le funzioni /area.
- Scansione QR con smartphone reale; verifica casella docuanalyticsai@docuanalytics.online.

## 5. File modificati nell'ultima sessione
Backend: backend/server.py, backend/workspace/core.py, backend/workspace/router.py, backend/workspace/studio.py (nuovo), backend/.env (aggiunta WEBHOOK_CRON_SECRET).
Frontend (src/workspace): AuditView.jsx, CalendarExport.jsx (nuovo), ClientEmails.jsx (nuovo), ClientMail.jsx (nuovo), Clients.jsx, DateField.jsx (nuovo), Deadlines.jsx, DigestSettings.jsx (nuovo), RiskDashboard.jsx, StudioSettings.jsx (nuovo), Workspace.jsx, api.js, workspace.css.
Config: .emergent/crons.yml (nuovo).
Test: backend/tests/test_workspace_final_smoke.py, test_calendar_notify.py, test_client_autolink_report_feed.py, test_email_digest_client_mail.py, test_studio_signature_email_log.py, perf_workspace_sync.py, seed_iter25..29_ui.py.
Report: test_reports/iteration_24..29.json. Memoria: memory/PRD.md, memory/STATO_FINALE.md.

## 6. Deploy
Nessun deploy in produzione eseguito in questa sessione. Produzione invariata.
