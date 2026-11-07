"""Verified capability guide for DocuAnalytics assistants.

Separate generic product explanations from account-owned analysis content.
Workflows below are implemented on feature/risk-priority-numbering (PR #7);
until a production release, the public assistant must call them PREVIEW features.
"""

WORKSPACE_GUIDE = """
GUIDA FUNZIONALE DOCUANALYTICS — versione in test (PR #7, novembre 2026).
Il sistema propone strumenti di SUPPORTO. Non certifica documenti e non compie adempimenti fiscali/legali per conto del professionista.

- Dopo un'analisi: l'utente consulta il report e preme «Vai all'Area di lavoro». Nella versione aggiornata arriva alla Panoramica dello studio, dove il documento appena analizzato compare evidenziato tra gli ultimi documenti. Può aprire il report o andare all'archivio.
- Panoramica: mostra conteggi di documenti, segnalazioni AI e verifiche professionali ancora da completare; separa «Da gestire» (criticità e date da valutare) dagli «Ultimi documenti analizzati», che includono anche quelli senza criticità AI. Nessuna criticità AI rilevata NON significa che il documento sia già verificato.
- Documenti: archivio completo con ricerca e filtri (tutti, da gestire, verificati, rischio alto, senza cliente); si può consultare il report, associare/cambiare cliente, ottenere PDF/QR protetto e selezionare 2–10 documenti per Multi-Document Audit. Le frecce della tastiera e il mouse facilitano la navigazione.
- Verifica professionale: lo stato di lavoro è «Da verificare», «In lavorazione» o «Verificato dal professionista». Il rischio AI (basso/medio/alto) resta INDIPENDENTE. La conferma «Verificato» richiede un'azione esplicita del professionista e non cancella red flag o rischio.
- Nel report: il professionista può salvare un esito (nessuna anomalia dopo controllo, anomalia confermata, segnalazione AI non pertinente, servono informazioni), aggiungere note e correggere singoli campi con motivazione e storico. Il valore AI originale e il PDF non vengono modificati. Le correzioni ai campi estratti NON aggiornano automaticamente scadenze o dati di terzi.
- Clienti: documenti e analisi sono consultabili per cliente nella scheda cliente; i collegamenti si gestiscono nell'Area di lavoro.
- Agenda Scadenze: vista «Da gestire» con scadute, oggi, date da confermare, prossimi 7 e 8–30 giorni; ricerca, filtri, note, modifica della data, collegamento al documento, promemoria email e calendario (.ics) per le scadenze effettivamente confermate. Date rilevate automaticamente e incerte richiedono verifica umana. Confermare la DATA non significa avere completato l'ADEMPIMENTO. La conferma non attiva automaticamente nuovi avvisi: l'utente può scegliere di attivarli.
- Esportazione e notifiche: file calendario .ics, eventuale link privato d'abbonamento e riepilogo settimanale sono configurabili dall'utente. Non dichiarare che una notifica sia stata inviata senza esito verificato.
- Multi-Document Audit: confronta da 2 a 10 analisi e mostra coerenze, possibili contraddizioni e controlli da esaminare; non produce certificazioni.
- Copilot sul documento: risponde alle domande sul singolo documento analizzato, dopo accesso e relativa analisi. Copilot nell'Area di lavoro: risponde a domande su documenti, clienti e scadenze DELL'ACCOUNT, in sola lettura e con consenso esplicito all'invio delle informazioni selezionate al modello AI; per dettagli di un documento serve un consenso aggiuntivo.
- Sicurezza: l'assistente pubblico accessibile da /assistant (anche tramite QR code, senza registrazione) spiega il prodotto e i percorsi ma NON accede mai ai documenti, ai clienti o alle scadenze di un account. Per lavorare su dati propri bisogna accedere.
- Limiti: i Copilot non eseguono correzioni, conferme, pagamenti, invii o altre azioni per conto dell'utente; indicano soltanto i passaggi da compiere nell'interfaccia. L'AI può sbagliare, e il controllo professionale rimane necessario.
""".strip()

# The QR-code assistant runs without login on the public site.
# Distinguish capabilities currently deployed from the feature-branch preview.
PUBLIC_RELEASE_NOTE = (
    "STATO DI DISPONIBILITÀ: le funzioni di Panoramica operativa, verifica "
    "professionale tracciata, nuove schede Documenti e agenda Scadenze sono "
    "implementate e collaudate nel RAMO DI SVILUPPO / ANTEPRIMA PR #7. "
    "Non presentarle come già pubblicate sul sito accessibile dal QR code "
    "finché non avviene il rilascio in produzione. Per descriverle usa "
    "«in anteprima», «previsto nel prossimo aggiornamento» oppure "
    "«attualmente in test»; non promettere una data di pubblicazione."
)
