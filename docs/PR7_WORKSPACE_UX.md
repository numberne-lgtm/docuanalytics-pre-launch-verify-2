# DocuAnalytics — scrivania operativa per studi professionali

**Stato:** implementato su PR #7, ramo `feature/risk-priority-numbering`. Preview isolata e sintetica; nessun rilascio in produzione.

## Flusso operativo
1. L'analisi del documento produce un risultato salvato. Il pulsante **Vai all'Area di lavoro** apre `/area/documenti/:analysisId` e seleziona il documento appena analizzato.
2. La **Panoramica** si aggiorna tramite `GET /api/workspace/overview`. I conteggi AI includono tutti i documenti; le **Priorità** contengono solo criticità o scadenze attive. Gli **Ultimi documenti analizzati** mostrano anche quelli a basso rischio.
3. Rischio AI (`low/medium/high`) e verifica umana (`to_review/in_progress/verified`) sono campi indipendenti. **Verificato** richiede conferma esplicita, non altera `risk_level`, `audit` o scadenze. Per una priorità documentale verificata si mantiene il dato, ma la vista “Da gestire” la nasconde; “Mostra tutte” la recupera.
4. Ogni documento ha azioni per aprire il report, cambiare o associare cliente, esportare PDF/QR, creare un promemoria e segnare la verifica manuale. Il Copilot del workspace resta disponibile come funzionalità separata soggetta alle normali regole di consenso e credito.
5. **Documenti** offre ricerca, filtri (tutti, da gestire, verificati, rischio alto, senza cliente) e selezione per Multi-Document Audit. Filtri e ricerca sono mantenuti finché l'Area di lavoro resta aperta. Aprendo esplicitamente un documento dall'anteprima, i filtri vengono eliminati per non nasconderlo.
6. Ricerca globale tra documenti, clienti e scadenze, su dati dell'account autenticato, con limiti di risultati per tipo. Nessuna ricerca in servizi esterni.

## API e controlli di sicurezza
- `GET /api/workspace/overview` include `recent_documents` (massimo sei), `review_pending` nel gruppo counts e `review_status` delle priorità documentali.
- `GET /api/workspace/documents` e `GET /api/workspace/documents/{aid}` includono i dati di revisione.
- `PUT /api/workspace/documents/{aid}/review-state`: body `{"status":"to_review"|"in_progress"|"verified"}`, verifica identità utente e proprietà documento, storico sintetico limitato a 50 cambiamenti; nessuna modifica al risultato AI.
- La whitelist dello staging ammette solamente la nuova operazione sul documento e `POST /sync`, già disponibile per le sole analisi dell'account fittizio.
- Dati reali, provider AI paganti, email e sistemi di pagamento disattivati nell'ambiente di test.

## Collaudi
- Test backend isolati, React build, Chromium mobile, E2E reale su backend e Mongo sintetici, Docker Compose.
- Playwright verifica ricerca globale, ricerca archivio e focus, passaggio di stato manuale con persistenza, filtro, mancata alterazione del livello di rischio AI, navigazione con frecce, due account e mancata autorizzazione cross-account.
- Axe-core continua a controllare automaticamente le sette viste principali per WCAG A/AA; risultati senza violazioni automatizzate non equivalgono a conformità totale.

## Fase successiva (non implementata in questa PR)
- Eventuali code di lavoro con assegnazione a collaboratori, commenti, firma approvativa e cronologia strutturata del singolo intervento.
- Verifica manuale con screen reader e test Safari/macOS.
- Valutazione del carico di lettura dell'overview su studi con migliaia di documenti e necessità di paginazione server-side.
