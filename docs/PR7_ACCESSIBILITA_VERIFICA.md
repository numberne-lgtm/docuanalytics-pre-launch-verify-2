# DocuAnalytics — verbale tecnico di accessibilità Area di lavoro (7 novembre 2026)

## Ambito
Sola PR #7 sul ramo `feature/risk-priority-numbering`, ambiente isolato sintetico.
Sono state esaminate: Risk Dashboard/Priorità, dettaglio documento (dialogo), Clienti, scheda cliente, Documenti, Scadenze e revisione delle scadenze.

## Verifiche automatiche eseguite
- Chromium in CI, `axe-core` con tag WCAG 2.0/2.1/2.2 A/AA e best practice.
- Test funzionali Playwright: navigazione ↑/↓, apertura con Invio, selezione con mouse, ritorno alla riga dopo la chiusura, tasto Esc, accesso a due account fittizi, documenti e PDF sintetici.
- Build React, browser smoke mobile 390 × 844, backend isolato MongoDB e Docker Compose proxy locale.
- Risultato audit della run [42373034917](https://github.com/numberne-lgtm/docuanalytics-pre-launch-verify-2/actions/runs/42373034917): **7 viste, 0 violazioni automatiche riportate**. Due job CI superati, incluso E2E browser tramite Docker.
- Ogni nuova CI di PR #7 esegue `frontend/scripts/pr7_accessibility_audit.cjs` e allega `pr7-accessibility-audit.json` come artifact (`pr7-accessibility-audit`). Il gate deve fallire in presenza di nuove violazioni riportate.

## Correzioni
- Liste selezionabili (Priorità, Clienti, Documenti, Scadenze): frecce ↑/↓, focus visibile, selezione con mouse e nessuna intercettazione dei tasti nei campi di testo.
- Dialogo report: nome accessibile, focus iniziale, Tab/Shift+Tab circoscritti, chiusura Esc, esclusione del contenuto sottostante dalla navigazione mentre aperto, focus ripristinato alla chiusura.
- Etichette accessibili su campi di nuovo cliente e promemoria.
- Nome accessibile dei pulsanti Priorità comprensivo dello stato visibile.
- Contrasto delle informative sotto l'Area di lavoro e dei pulsanti di notifica nelle Scadenze.
- L'audit del dialogo aspetta la fine dell'animazione, per evitare risultati falsati da opacità transitoria.

## Limiti — non equivale a dichiarazione di conformità
Un test `axe-core` senza violazioni **non prova la conformità WCAG 2.2 AA** né il rispetto della normativa italiana sull'intera applicazione.

Da verificare separatamente:
1. Navigazione completa con sola tastiera su tutti i flussi, inclusi registrazione, pagamento, upload, report, email e pagine pubbliche.
2. Screen reader reali (VoiceOver su macOS/iOS, NVDA/Windows), annunci dinamici e gerarchia titoli.
3. Zoom 200% e 400%, reflow a 320 CSS px, preferenze di riduzione movimento, contrasto forzato, errori nei moduli.
4. Copilot reale, pagamenti e autenticazione Google: disattivati nello staging sintetico, non esaminati.
5. Compatibilità effettiva del Mac dell'utente e del sito pubblicato (CSS, asset e dati reali).
6. Applicabilità giuridica: qualificazione del servizio ai sensi del D.Lgs. 82/2022, verifica dell'eventuale esenzione per microimprese fornitrici di servizi, documentazione e dichiarazioni richieste quando applicabili.

## Riferimenti
- W3C [WCAG 2.2](https://www.w3.org/TR/WCAG22/) e [traduzione italiana](https://www.w3.org/Translations/WCAG22-it/).
- [AgID FAQ sull'accessibilità](https://accessibilita.agid.gov.it/domande-frequenti/): requisiti e soggetti del D.Lgs. 82/2022, effetto dal 28 giugno 2025, esenzione per microimprese fornitrici di servizi.

## Sicurezza e rilascio
La PR rimane in bozza; **nessun merge, deploy, modifica dati reali, chiavi o pagamenti**. La convalida riguarda soltanto l'ambiente PR #7. Un audit umano completato e la verifica normativa sono prerequisiti per dichiarazioni di piena conformità.
