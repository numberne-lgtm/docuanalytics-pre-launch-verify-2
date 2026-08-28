import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, BookOpen, Sparkles, CreditCard, Globe } from "lucide-react";

const SITE = "https://docuanalytics.it";
const VALID = ["it", "en", "es", "de", "fr"];
const LANGS = [
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

const DEFAULT_DESC = "Analisi documenti automatica con Intelligenza Artificiale: carica fatture, contratti, visure camerali ed F24 ed estrai i dati in 2 secondi.";
const DEFAULT_TITLE = "DocuAnalytics AI — Analisi Documenti con Intelligenza Artificiale | Fatture, F24, Contratti";

const BLOG_UI = {
  it: { kicker: "GUIDE & RISORSE", t1: "Blog e Guide", t2: "Document Intelligence AI", sub: "Approfondimenti pratici per commercialisti, avvocati e notai: come usare l'Intelligenza Artificiale per analizzare fatture, F24, contratti e visure camerali.", home: "Home", tryFree: "Prova gratis", allGuides: "Tutte le guide", readSuffix: "di lettura", readMore: "Leggi la guida", footTitle: "DocuAnalytics AI — Guide per Studi Professionali", footDesc: "Approfondimenti su analisi documenti, fatture, F24, contratti e visure con Intelligenza Artificiale.", toApp: "Vai all'app", rights: "Tutti i diritti riservati", ctaText: "Prova DocuAnalytics AI: 3 crediti gratis, nessuna carta richiesta.", ctaBtn: "Analizza un documento", other: "Altre guide", nfTitle: "Guida non trovata", nfSub: "La risorsa che cerchi non esiste o è stata spostata.", idxTitle: "Blog e Guide AI per Commercialisti, Avvocati e Notai | DocuAnalytics AI", idxDesc: "Guide pratiche sull'analisi documenti con Intelligenza Artificiale: fatture elettroniche, controllo F24, clausole vessatorie nei contratti e antiriciclaggio da visure camerali." },
  en: { kicker: "GUIDES & RESOURCES", t1: "Blog & Guides", t2: "Document Intelligence AI", sub: "Practical insights for accountants, lawyers and notaries: how to use Artificial Intelligence to analyze invoices, tax forms, contracts and company records.", home: "Home", tryFree: "Try free", allGuides: "All guides", readSuffix: "read", readMore: "Read the guide", footTitle: "DocuAnalytics AI — Guides for Professional Firms", footDesc: "Insights on document analysis, invoices, tax forms, contracts and company records with Artificial Intelligence.", toApp: "Go to app", rights: "All rights reserved", ctaText: "Try DocuAnalytics AI: 3 free credits, no card required.", ctaBtn: "Analyze a document", other: "More guides", nfTitle: "Guide not found", nfSub: "The resource you are looking for does not exist or has been moved.", idxTitle: "AI Blog & Guides for Accountants, Lawyers and Notaries | DocuAnalytics AI", idxDesc: "Practical guides on AI document analysis: e-invoices, tax-form checks, unfair clauses in contracts and anti-money-laundering from company records." },
  es: { kicker: "GUÍAS & RECURSOS", t1: "Blog y Guías", t2: "Document Intelligence AI", sub: "Consejos prácticos para contables, abogados y notarios: cómo usar la Inteligencia Artificial para analizar facturas, modelos fiscales, contratos y registros mercantiles.", home: "Inicio", tryFree: "Prueba gratis", allGuides: "Todas las guías", readSuffix: "de lectura", readMore: "Leer la guía", footTitle: "DocuAnalytics AI — Guías para Despachos Profesionales", footDesc: "Contenidos sobre análisis de documentos, facturas, modelos fiscales, contratos y registros mercantiles con IA.", toApp: "Ir a la app", rights: "Todos los derechos reservados", ctaText: "Prueba DocuAnalytics AI: 3 créditos gratis, sin tarjeta.", ctaBtn: "Analizar un documento", other: "Más guías", nfTitle: "Guía no encontrada", nfSub: "El recurso que buscas no existe o se ha movido.", idxTitle: "Blog y Guías de IA para Contables, Abogados y Notarios | DocuAnalytics AI", idxDesc: "Guías prácticas sobre análisis de documentos con IA: facturas electrónicas, control de modelos fiscales, cláusulas abusivas en contratos y prevención de blanqueo." },
  de: { kicker: "RATGEBER & RESSOURCEN", t1: "Blog & Ratgeber", t2: "Document Intelligence AI", sub: "Praktische Tipps für Steuerberater, Anwälte und Notare: wie Sie mit Künstlicher Intelligenz Rechnungen, Steuerformulare, Verträge und Registerauszüge analysieren.", home: "Startseite", tryFree: "Kostenlos testen", allGuides: "Alle Ratgeber", readSuffix: "Lesezeit", readMore: "Ratgeber lesen", footTitle: "DocuAnalytics AI — Ratgeber für Kanzleien", footDesc: "Inhalte zu Dokumentenanalyse, Rechnungen, Steuerformularen, Verträgen und Registerauszügen mit KI.", toApp: "Zur App", rights: "Alle Rechte vorbehalten", ctaText: "Testen Sie DocuAnalytics AI: 3 Gratis-Guthaben, keine Karte nötig.", ctaBtn: "Dokument analysieren", other: "Weitere Ratgeber", nfTitle: "Ratgeber nicht gefunden", nfSub: "Die gesuchte Ressource existiert nicht oder wurde verschoben.", idxTitle: "KI-Blog & Ratgeber für Steuerberater, Anwälte und Notare | DocuAnalytics AI", idxDesc: "Praktische Ratgeber zur KI-Dokumentenanalyse: E-Rechnungen, Steuerformular-Prüfung, unzulässige Vertragsklauseln und Geldwäscheprävention." },
  fr: { kicker: "GUIDES & RESSOURCES", t1: "Blog & Guides", t2: "Document Intelligence AI", sub: "Conseils pratiques pour experts-comptables, avocats et notaires : comment utiliser l'Intelligence Artificielle pour analyser factures, formulaires fiscaux, contrats et extraits Kbis.", home: "Accueil", tryFree: "Essai gratuit", allGuides: "Tous les guides", readSuffix: "de lecture", readMore: "Lire le guide", footTitle: "DocuAnalytics AI — Guides pour Cabinets", footDesc: "Contenus sur l'analyse de documents, factures, formulaires fiscaux, contrats et extraits Kbis avec l'IA.", toApp: "Aller à l'app", rights: "Tous droits réservés", ctaText: "Essayez DocuAnalytics AI : 3 crédits gratuits, sans carte.", ctaBtn: "Analyser un document", other: "Autres guides", nfTitle: "Guide introuvable", nfSub: "La ressource recherchée n'existe pas ou a été déplacée.", idxTitle: "Blog & Guides IA pour Experts-comptables, Avocats et Notaires | DocuAnalytics AI", idxDesc: "Guides pratiques sur l'analyse de documents par IA : factures électroniques, contrôle des formulaires fiscaux, clauses abusives et lutte anti-blanchiment." },
};

/* Slug order shared across languages */
export const SLUGS = ["analisi-fatture-elettroniche-ai", "controllo-quadratura-f24", "clausole-vessatorie-contratti-ai", "visure-camerali-antiriciclaggio-kyc-aml"];

export const ARTICLES = {
  it: [
    { slug: "analisi-fatture-elettroniche-ai", title: "Analisi delle fatture elettroniche con l'AI: come estrarre i dati in 2 secondi", desc: "Guida pratica per commercialisti: come usare l'Intelligenza Artificiale per leggere fatture elettroniche, estrarre imponibile, IVA, IBAN e totali ed evitare errori di quadratura.", read: "6 min", tag: "Fatture", excerpt: "Dall'upload del file all'estrazione automatica di imponibile, IVA e IBAN: come l'AI azzera la digitazione manuale e segnala le anomalie prima che diventino un problema.", body: [
      { h: null, p: ["L'inserimento manuale dei dati delle fatture è una delle attività più ripetitive e a rischio errore in uno studio. Un'AI di document intelligence come DocuAnalytics legge il documento (PDF o immagine), lo classifica come fattura ed estrae automaticamente tutti i campi chiave in pochi secondi."] },
      { h: "Quali dati estrae l'AI da una fattura", p: ["Il modello riconosce e struttura i dati indipendentemente dal layout del fornitore:"], li: ["Numero e data della fattura", "Cedente e cessionario con P.IVA e codice fiscale", "Imponibile, aliquota e importo IVA, totale documento", "IBAN e modalità di pagamento", "Scadenze e condizioni di pagamento"] },
      { h: "Quadratura automatica e controllo anti-errore", p: ["Oltre all'estrazione, l'AI verifica la coerenza aritmetica: imponibile + IVA = totale. Se il documento non quadra, ricevi un avviso immediato. Il sistema segnala anche IBAN esteri e importi anomali, utili per i controlli antiriciclaggio."] },
      { h: "Dall'estrazione al gestionale", p: ["I dati estratti si esportano in CSV o JSON, pronti per l'importazione in gestionali come Zucchetti, TeamSystem o Datev, riducendo drasticamente i tempi di Prima Nota."] },
      { h: "Come iniziare", p: ["Carica la tua prima fattura e ottieni l'estrazione completa in 2 secondi. Hai 3 crediti gratuiti per provare senza registrazione."] },
    ] },
    { slug: "controllo-quadratura-f24", title: "Controllo e quadratura del Modello F24: guida per commercialisti", desc: "Come verificare automaticamente codici tributo, importi e saldi di un F24 con l'Intelligenza Artificiale, individuando squadrature e il visto di conformità IVA sopra i 5.000 €.", read: "5 min", tag: "F24", excerpt: "Codici tributo, saldi Debito/Credito e visto di conformità: come l'AI controlla un F24 e ti avvisa prima dell'invio.", body: [
      { h: null, p: ["Il Modello F24 concentra molte informazioni critiche in poco spazio. Un errore in un codice tributo o in un saldo può generare sanzioni. L'AI legge l'F24 ed esegue i controlli al posto tuo."] },
      { h: "Cosa verifica l'AI su un F24", li: ["Estrazione di codici tributo, importi a debito e a credito, periodo di riferimento", "Quadratura Debito / Credito / Saldo finale con avviso in caso di squadratura", "Rilevamento del visto di conformità obbligatorio per crediti IVA superiori a 5.000 €", "Controllo della coerenza tra sezioni (Erario, INPS, Regioni, IMU)"] },
      { h: "Perché conta la quadratura automatica", p: ["Il controllo manuale dei saldi è lento e soggetto a distrazioni. L'audit anti-errore integrato confronta i totali e segnala immediatamente ogni incoerenza, così puoi correggere prima dell'invio telematico."] },
      { h: "Integrazione nel flusso di lavoro", p: ["I dati dell'F24 possono essere esportati e archiviati insieme al resto della documentazione del cliente. Ogni analisi include anche il Copilot AI, a cui puoi chiedere in linguaggio naturale: \"Qual è il saldo finale?\"."] },
      { h: "Prova subito", p: ["Carica un F24 e verifica la quadratura in automatico. I primi 3 controlli sono gratuiti."] },
    ] },
    { slug: "clausole-vessatorie-contratti-ai", title: "Clausole vessatorie nei contratti (Art. 1341 c.c.): individuarle con l'AI", desc: "Guida per avvocati e studi legali: come l'Intelligenza Artificiale rileva clausole vessatorie, termini di recesso e scadenze critiche nei contratti, con riepilogo in linguaggio chiaro.", read: "6 min", tag: "Contratti", excerpt: "Individuazione automatica delle clausole vessatorie ex Art. 1341 c.c., preavvisi e scadenze: l'AI legge il contratto e ti segnala i rischi.", body: [
      { h: null, p: ["Rileggere ogni contratto per intero è dispendioso. Un'AI addestrata sul linguaggio giuridico individua le clausole potenzialmente vessatorie e i punti di attenzione, lasciando al professionista il giudizio finale."] },
      { h: "Cosa rileva l'AI in un contratto", li: ["Clausole potenzialmente vessatorie ai sensi dell'Art. 1341 c.c.", "Parti, oggetto, durata, corrispettivi e termini di recesso", "Preavvisi e scadenze contrattuali critiche", "Rinnovi taciti e penali"] },
      { h: "Riepilogo in linguaggio chiaro", p: ["L'AI genera una sintesi comprensibile delle clausole complesse, utile per confronti rapidi con il cliente. Con il Copilot puoi chiedere: \"Esiste una clausola di recesso anticipato?\" e ottenere la risposta con il riferimento al testo."] },
      { h: "Privacy e conformità", p: ["I documenti sono trattati su server 100% in UE con crittografia AES 256-bit, nel rispetto del GDPR e dell'EU AI Act — un requisito imprescindibile per gli studi legali."] },
      { h: "Inizia l'analisi", p: ["Carica un contratto e ricevi l'elenco dei punti di attenzione in pochi secondi, con 3 crediti gratuiti."] },
    ] },
    { slug: "visure-camerali-antiriciclaggio-kyc-aml", title: "Visure camerali e antiriciclaggio (KYC/AML): estrazione dati automatica", desc: "Come estrarre automaticamente REA, P.IVA, soci, amministratori e titolare effettivo da una visura camerale per le verifiche antiriciclaggio (KYC/AML) con l'Intelligenza Artificiale.", read: "5 min", tag: "Visure", excerpt: "REA, soci, amministratori e titolare effettivo: come l'AI accelera le verifiche KYC/AML a partire dalla visura camerale.", body: [
      { h: null, p: ["Le verifiche antiriciclaggio richiedono di identificare rapidamente la compagine societaria e il titolare effettivo. L'AI estrae questi dati direttamente dalla visura camerale, riducendo i tempi dell'adeguata verifica."] },
      { h: "Dati estratti dalla visura", li: ["Numero REA, P.IVA, sede, capitale sociale e PEC", "Elenco soci con relative quote", "Amministratori e poteri di firma", "Stato attività e procedure in corso"] },
      { h: "Supporto alle verifiche KYC/AML", p: ["Il sistema evidenzia gli elementi utili all'individuazione del titolare effettivo e segnala anomalie. Resta sempre responsabilità del professionista la valutazione finale del rischio."] },
      { h: "Archiviazione e coerenza dei dati", p: ["I dati estratti si esportano in CSV/JSON e possono essere confrontati con altri documenti del fascicolo cliente per verificarne la coerenza."] },
      { h: "Prova la demo", p: ["Carica una visura e ottieni l'estrazione strutturata della compagine societaria. I primi 3 documenti sono gratuiti."] },
    ] },
  ],
  en: [
    { slug: "analisi-fatture-elettroniche-ai", title: "E-invoice analysis with AI: extract the data in 2 seconds", desc: "Practical guide for accountants: how to use Artificial Intelligence to read e-invoices, extract taxable amount, VAT, IBAN and totals and avoid reconciliation errors.", read: "6 min", tag: "Invoices", excerpt: "From uploading the file to automatic extraction of taxable amount, VAT and IBAN: how AI eliminates manual data entry and flags anomalies before they become a problem.", body: [
      { h: null, p: ["Manual data entry from invoices is one of the most repetitive and error-prone tasks in a firm. A document-intelligence AI like DocuAnalytics reads the document (PDF or image), classifies it as an invoice and automatically extracts every key field in seconds."] },
      { h: "Which data the AI extracts from an invoice", p: ["The model recognizes and structures the data regardless of the supplier's layout:"], li: ["Invoice number and date", "Supplier and customer with VAT and tax IDs", "Taxable amount, VAT rate and amount, document total", "IBAN and payment method", "Due dates and payment terms"] },
      { h: "Automatic reconciliation and error check", p: ["Beyond extraction, the AI verifies arithmetic consistency: taxable + VAT = total. If the document does not add up, you get an instant alert. The system also flags foreign IBANs and unusual amounts, useful for anti-money-laundering checks."] },
      { h: "From extraction to your accounting software", p: ["Extracted data is exported to CSV or JSON, ready for import into accounting software such as Zucchetti, TeamSystem or Datev, drastically cutting bookkeeping time."] },
      { h: "How to start", p: ["Upload your first invoice and get the full extraction in 2 seconds. You have 3 free credits to try without signing up."] },
    ] },
    { slug: "controllo-quadratura-f24", title: "Tax-form (F24) checks and reconciliation: a guide for accountants", desc: "How to automatically verify tax codes, amounts and balances of a tax form with Artificial Intelligence, spotting mismatches and the VAT compliance visa above €5,000.", read: "5 min", tag: "Tax forms", excerpt: "Tax codes, Debit/Credit balances and compliance visa: how AI checks a tax form and warns you before submission.", body: [
      { h: null, p: ["The Italian F24 tax form packs a lot of critical information into little space. A mistake in a tax code or a balance can trigger penalties. The AI reads the form and runs the checks for you."] },
      { h: "What the AI verifies on a tax form", li: ["Extraction of tax codes, debit and credit amounts, reference period", "Debit / Credit / Final balance reconciliation with mismatch alerts", "Detection of the mandatory compliance visa for VAT credits above €5,000", "Consistency check across sections (Treasury, social security, regional, property tax)"] },
      { h: "Why automatic reconciliation matters", p: ["Manually checking balances is slow and prone to distraction. The built-in error-check audit compares the totals and instantly flags any inconsistency, so you can fix it before the electronic submission."] },
      { h: "Fitting it into your workflow", p: ["Tax-form data can be exported and archived alongside the rest of the client's documents. Every analysis also includes the AI Copilot, which you can ask in plain language: \"What is the final balance?\"."] },
      { h: "Try it now", p: ["Upload a tax form and check the reconciliation automatically. The first 3 checks are free."] },
    ] },
    { slug: "clausole-vessatorie-contratti-ai", title: "Unfair clauses in contracts: spotting them with AI", desc: "Guide for lawyers and law firms: how Artificial Intelligence detects unfair clauses, withdrawal terms and critical deadlines in contracts, with a plain-language summary.", read: "6 min", tag: "Contracts", excerpt: "Automatic detection of unfair clauses, notice periods and deadlines: the AI reads the contract and flags the risks for you.", body: [
      { h: null, p: ["Re-reading every contract in full is time-consuming. An AI trained on legal language identifies potentially unfair clauses and points of attention, leaving the final judgement to the professional."] },
      { h: "What the AI detects in a contract", li: ["Potentially unfair clauses", "Parties, subject, duration, fees and withdrawal terms", "Critical notices and contract deadlines", "Automatic renewals and penalties"] },
      { h: "Plain-language summary", p: ["The AI generates an understandable summary of complex clauses, useful for quick reviews with the client. With the Copilot you can ask: \"Is there an early-termination clause?\" and get the answer with a reference to the text."] },
      { h: "Privacy and compliance", p: ["Documents are processed on 100% EU servers with AES 256-bit encryption, in compliance with GDPR and the EU AI Act — an essential requirement for law firms."] },
      { h: "Start the analysis", p: ["Upload a contract and get the list of attention points in seconds, with 3 free credits."] },
    ] },
    { slug: "visure-camerali-antiriciclaggio-kyc-aml", title: "Company records and AML (KYC): automatic data extraction", desc: "How to automatically extract registration number, VAT, shareholders, directors and beneficial owner from a company record for anti-money-laundering (KYC/AML) checks with AI.", read: "5 min", tag: "Records", excerpt: "Registration number, shareholders, directors and beneficial owner: how AI speeds up KYC/AML checks starting from the company record.", body: [
      { h: null, p: ["Anti-money-laundering checks require quickly identifying the ownership structure and the beneficial owner. The AI extracts this data directly from the company record, reducing due-diligence time."] },
      { h: "Data extracted from the record", li: ["Registration number, VAT/tax ID, registered office, share capital and certified email", "List of shareholders with their stakes", "Directors and signing powers", "Business status and ongoing proceedings"] },
      { h: "Support for KYC/AML checks", p: ["The system highlights the elements useful to identify the beneficial owner and flags anomalies. The final risk assessment always remains the professional's responsibility."] },
      { h: "Archiving and data consistency", p: ["Extracted data is exported to CSV/JSON and can be compared with other documents in the client file to verify consistency."] },
      { h: "Try the demo", p: ["Upload a company record and get the structured extraction of the ownership structure. The first 3 documents are free."] },
    ] },
  ],
  es: [
    { slug: "analisi-fatture-elettroniche-ai", title: "Análisis de facturas electrónicas con IA: extrae los datos en 2 segundos", desc: "Guía práctica para contables: cómo usar la Inteligencia Artificial para leer facturas electrónicas, extraer base imponible, IVA, IBAN y totales y evitar errores de cuadre.", read: "6 min", tag: "Facturas", excerpt: "Desde subir el archivo hasta la extracción automática de base, IVA e IBAN: cómo la IA elimina la introducción manual y detecta anomalías antes de que sean un problema.", body: [
      { h: null, p: ["La introducción manual de datos de facturas es una de las tareas más repetitivas y propensas a error en un despacho. Una IA de document intelligence como DocuAnalytics lee el documento (PDF o imagen), lo clasifica como factura y extrae automáticamente todos los campos clave en segundos."] },
      { h: "Qué datos extrae la IA de una factura", p: ["El modelo reconoce y estructura los datos con independencia del diseño del proveedor:"], li: ["Número y fecha de la factura", "Emisor y receptor con NIF/CIF", "Base imponible, tipo e importe de IVA, total del documento", "IBAN y forma de pago", "Vencimientos y condiciones de pago"] },
      { h: "Cuadre automático y control de errores", p: ["Además de la extracción, la IA verifica la coherencia aritmética: base + IVA = total. Si el documento no cuadra, recibes un aviso inmediato. El sistema también detecta IBAN extranjeros e importes anómalos, útiles para los controles antiblanqueo."] },
      { h: "De la extracción a tu software contable", p: ["Los datos extraídos se exportan a CSV o JSON, listos para importar en software contable, reduciendo drásticamente los tiempos de contabilización."] },
      { h: "Cómo empezar", p: ["Sube tu primera factura y obtén la extracción completa en 2 segundos. Tienes 3 créditos gratis para probar sin registrarte."] },
    ] },
    { slug: "controllo-quadratura-f24", title: "Control y cuadre del modelo fiscal: guía para contables", desc: "Cómo verificar automáticamente códigos, importes y saldos de un modelo fiscal con Inteligencia Artificial, detectando descuadres y el visado de conformidad de IVA.", read: "5 min", tag: "Modelos fiscales", excerpt: "Códigos, saldos Debe/Haber y visado de conformidad: cómo la IA revisa un modelo fiscal y te avisa antes del envío.", body: [
      { h: null, p: ["Los modelos fiscales concentran mucha información crítica en poco espacio. Un error en un código o en un saldo puede generar sanciones. La IA lee el modelo y realiza los controles por ti."] },
      { h: "Qué verifica la IA en un modelo fiscal", li: ["Extracción de códigos, importes a debe y haber, periodo de referencia", "Cuadre Debe / Haber / Saldo final con aviso de descuadre", "Detección del visado de conformidad para créditos de IVA elevados", "Comprobación de coherencia entre secciones"] },
      { h: "Por qué importa el cuadre automático", p: ["El control manual de saldos es lento y propenso a distracciones. La auditoría antierrores integrada compara los totales y señala al instante cualquier incoherencia, para corregirla antes del envío telemático."] },
      { h: "Integración en tu flujo de trabajo", p: ["Los datos del modelo pueden exportarse y archivarse junto al resto de la documentación del cliente. Cada análisis incluye también el Copilot de IA, al que puedes preguntar: \"¿Cuál es el saldo final?\"."] },
      { h: "Pruébalo ahora", p: ["Sube un modelo fiscal y comprueba el cuadre automáticamente. Los primeros 3 controles son gratis."] },
    ] },
    { slug: "clausole-vessatorie-contratti-ai", title: "Cláusulas abusivas en los contratos: detectarlas con IA", desc: "Guía para abogados y despachos: cómo la Inteligencia Artificial detecta cláusulas abusivas, plazos de desistimiento y vencimientos críticos en los contratos, con resumen claro.", read: "6 min", tag: "Contratos", excerpt: "Detección automática de cláusulas abusivas, preavisos y vencimientos: la IA lee el contrato y te señala los riesgos.", body: [
      { h: null, p: ["Releer cada contrato entero es costoso. Una IA entrenada en lenguaje jurídico identifica las cláusulas potencialmente abusivas y los puntos de atención, dejando el juicio final al profesional."] },
      { h: "Qué detecta la IA en un contrato", li: ["Cláusulas potencialmente abusivas", "Partes, objeto, duración, importes y desistimiento", "Preavisos y vencimientos contractuales críticos", "Renovaciones automáticas y penalizaciones"] },
      { h: "Resumen en lenguaje claro", p: ["La IA genera un resumen comprensible de las cláusulas complejas, útil para revisiones rápidas con el cliente. Con el Copilot puedes preguntar: \"¿Existe una cláusula de rescisión anticipada?\" y obtener la respuesta con la referencia al texto."] },
      { h: "Privacidad y cumplimiento", p: ["Los documentos se tratan en servidores 100% en la UE con cifrado AES 256 bits, cumpliendo el RGPD y el EU AI Act, un requisito imprescindible para los despachos."] },
      { h: "Inicia el análisis", p: ["Sube un contrato y obtén la lista de puntos de atención en segundos, con 3 créditos gratis."] },
    ] },
    { slug: "visure-camerali-antiriciclaggio-kyc-aml", title: "Registros mercantiles y prevención de blanqueo (KYC/AML): extracción automática", desc: "Cómo extraer automáticamente número registral, NIF, socios, administradores y titular real de un registro mercantil para las verificaciones antiblanqueo (KYC/AML) con IA.", read: "5 min", tag: "Registros", excerpt: "Número registral, socios, administradores y titular real: cómo la IA agiliza las verificaciones KYC/AML a partir del registro mercantil.", body: [
      { h: null, p: ["Las verificaciones antiblanqueo exigen identificar rápidamente la estructura societaria y el titular real. La IA extrae estos datos directamente del registro mercantil, reduciendo el tiempo de diligencia debida."] },
      { h: "Datos extraídos del registro", li: ["Número registral, NIF, domicilio, capital social y email certificado", "Lista de socios con sus participaciones", "Administradores y poderes de firma", "Estado de actividad y procedimientos en curso"] },
      { h: "Apoyo a las verificaciones KYC/AML", p: ["El sistema destaca los elementos útiles para identificar al titular real y señala anomalías. La valoración final del riesgo es siempre responsabilidad del profesional."] },
      { h: "Archivo y coherencia de datos", p: ["Los datos extraídos se exportan a CSV/JSON y pueden compararse con otros documentos del expediente del cliente para verificar su coherencia."] },
      { h: "Prueba la demo", p: ["Sube un registro mercantil y obtén la extracción estructurada de la estructura societaria. Los primeros 3 documentos son gratis."] },
    ] },
  ],
  de: [
    { slug: "analisi-fatture-elettroniche-ai", title: "E-Rechnungsanalyse mit KI: die Daten in 2 Sekunden extrahieren", desc: "Praxisleitfaden für Steuerberater: wie Sie mit Künstlicher Intelligenz E-Rechnungen lesen, Nettobetrag, USt., IBAN und Summen extrahieren und Abgleichfehler vermeiden.", read: "6 min", tag: "Rechnungen", excerpt: "Vom Hochladen der Datei bis zur automatischen Extraktion von Nettobetrag, USt. und IBAN: wie die KI die manuelle Eingabe ersetzt und Anomalien meldet.", body: [
      { h: null, p: ["Die manuelle Dateneingabe aus Rechnungen ist eine der repetitivsten und fehleranfälligsten Aufgaben in einer Kanzlei. Eine Document-Intelligence-KI wie DocuAnalytics liest das Dokument (PDF oder Bild), klassifiziert es als Rechnung und extrahiert automatisch alle wichtigen Felder in Sekunden."] },
      { h: "Welche Daten die KI aus einer Rechnung extrahiert", p: ["Das Modell erkennt und strukturiert die Daten unabhängig vom Layout des Lieferanten:"], li: ["Rechnungsnummer und -datum", "Lieferant und Kunde mit USt-IdNr. und Steuernummer", "Nettobetrag, USt-Satz und -Betrag, Gesamtbetrag", "IBAN und Zahlungsart", "Fälligkeiten und Zahlungsbedingungen"] },
      { h: "Automatischer Abgleich und Fehlerprüfung", p: ["Neben der Extraktion prüft die KI die rechnerische Konsistenz: Netto + USt. = Summe. Stimmt das Dokument nicht, erhalten Sie sofort einen Hinweis. Das System meldet auch ausländische IBAN und ungewöhnliche Beträge, nützlich für Geldwäscheprüfungen."] },
      { h: "Von der Extraktion in Ihre Buchhaltungssoftware", p: ["Die extrahierten Daten werden als CSV oder JSON exportiert, bereit für den Import in Buchhaltungssoftware, was die Buchungszeit drastisch verkürzt."] },
      { h: "So starten Sie", p: ["Laden Sie Ihre erste Rechnung hoch und erhalten Sie die vollständige Extraktion in 2 Sekunden. Sie haben 3 Gratis-Guthaben zum Testen ohne Registrierung."] },
    ] },
    { slug: "controllo-quadratura-f24", title: "Prüfung und Abgleich von Steuerformularen: Leitfaden für Steuerberater", desc: "Wie Sie Codes, Beträge und Salden eines Steuerformulars automatisch mit Künstlicher Intelligenz prüfen, Abweichungen erkennen und den USt-Konformitätsvermerk finden.", read: "5 min", tag: "Steuerformulare", excerpt: "Codes, Soll/Haben-Salden und Konformitätsvermerk: wie die KI ein Steuerformular prüft und Sie vor der Übermittlung warnt.", body: [
      { h: null, p: ["Steuerformulare bündeln viele kritische Informationen auf engem Raum. Ein Fehler in einem Code oder Saldo kann Strafen auslösen. Die KI liest das Formular und führt die Prüfungen für Sie durch."] },
      { h: "Was die KI am Steuerformular prüft", li: ["Extraktion von Codes, Soll- und Haben-Beträgen, Bezugszeitraum", "Soll / Haben / Endsaldo-Abgleich mit Abweichungshinweis", "Erkennung des Konformitätsvermerks für hohe USt-Guthaben", "Konsistenzprüfung zwischen den Abschnitten"] },
      { h: "Warum der automatische Abgleich zählt", p: ["Die manuelle Saldenprüfung ist langsam und fehleranfällig. Das integrierte Fehler-Audit vergleicht die Summen und meldet sofort jede Inkonsistenz, damit Sie sie vor der elektronischen Übermittlung korrigieren."] },
      { h: "Einbindung in Ihren Workflow", p: ["Die Formulardaten können exportiert und mit den übrigen Mandantenunterlagen archiviert werden. Jede Analyse enthält auch den KI-Copilot, den Sie fragen können: \"Wie hoch ist der Endsaldo?\"."] },
      { h: "Jetzt testen", p: ["Laden Sie ein Steuerformular hoch und prüfen Sie den Abgleich automatisch. Die ersten 3 Prüfungen sind kostenlos."] },
    ] },
    { slug: "clausole-vessatorie-contratti-ai", title: "Unzulässige Klauseln in Verträgen: mit KI erkennen", desc: "Leitfaden für Anwälte und Kanzleien: wie Künstliche Intelligenz unzulässige Klauseln, Kündigungsfristen und kritische Termine in Verträgen erkennt, mit klarer Zusammenfassung.", read: "6 min", tag: "Verträge", excerpt: "Automatische Erkennung unzulässiger Klauseln, Fristen und Termine: die KI liest den Vertrag und meldet die Risiken.", body: [
      { h: null, p: ["Jeden Vertrag vollständig neu zu lesen ist zeitaufwendig. Eine auf Rechtssprache trainierte KI identifiziert potenziell unzulässige Klauseln und Aufmerksamkeitspunkte und überlässt das endgültige Urteil dem Fachmann."] },
      { h: "Was die KI in einem Vertrag erkennt", li: ["Potenziell unzulässige Klauseln", "Parteien, Gegenstand, Laufzeit, Entgelte und Kündigung", "Kritische Fristen und Vertragstermine", "Automatische Verlängerungen und Vertragsstrafen"] },
      { h: "Zusammenfassung in einfacher Sprache", p: ["Die KI erstellt eine verständliche Zusammenfassung komplexer Klauseln, nützlich für schnelle Prüfungen mit dem Mandanten. Mit dem Copilot können Sie fragen: \"Gibt es eine Klausel zur vorzeitigen Kündigung?\" und erhalten die Antwort mit Textverweis."] },
      { h: "Datenschutz und Compliance", p: ["Dokumente werden auf 100% EU-Servern mit AES-256-Bit-Verschlüsselung verarbeitet, konform mit DSGVO und EU AI Act, eine unverzichtbare Anforderung für Kanzleien."] },
      { h: "Analyse starten", p: ["Laden Sie einen Vertrag hoch und erhalten Sie die Liste der Aufmerksamkeitspunkte in Sekunden, mit 3 Gratis-Guthaben."] },
    ] },
    { slug: "visure-camerali-antiriciclaggio-kyc-aml", title: "Registerauszüge und Geldwäscheprävention (KYC/AML): automatische Datenextraktion", desc: "Wie Sie Registernummer, USt-IdNr., Gesellschafter, Geschäftsführer und wirtschaftlich Berechtigten aus einem Registerauszug für KYC/AML-Prüfungen mit KI extrahieren.", read: "5 min", tag: "Registerauszüge", excerpt: "Registernummer, Gesellschafter, Geschäftsführer und wirtschaftlich Berechtigter: wie die KI KYC/AML-Prüfungen aus dem Registerauszug beschleunigt.", body: [
      { h: null, p: ["Geldwäscheprüfungen erfordern die schnelle Identifizierung der Eigentümerstruktur und des wirtschaftlich Berechtigten. Die KI extrahiert diese Daten direkt aus dem Registerauszug und verkürzt die Sorgfaltsprüfung."] },
      { h: "Aus dem Auszug extrahierte Daten", li: ["Registernummer, USt-IdNr., Sitz, Stammkapital und zertifizierte E-Mail", "Liste der Gesellschafter mit ihren Anteilen", "Geschäftsführer und Zeichnungsbefugnisse", "Geschäftsstatus und laufende Verfahren"] },
      { h: "Unterstützung bei KYC/AML-Prüfungen", p: ["Das System hebt die Elemente hervor, die zur Identifizierung des wirtschaftlich Berechtigten nützlich sind, und meldet Anomalien. Die endgültige Risikobewertung bleibt stets Aufgabe des Fachmanns."] },
      { h: "Archivierung und Datenkonsistenz", p: ["Die extrahierten Daten werden als CSV/JSON exportiert und können mit anderen Dokumenten der Mandantenakte auf Konsistenz verglichen werden."] },
      { h: "Demo testen", p: ["Laden Sie einen Registerauszug hoch und erhalten Sie die strukturierte Extraktion der Eigentümerstruktur. Die ersten 3 Dokumente sind kostenlos."] },
    ] },
  ],
  fr: [
    { slug: "analisi-fatture-elettroniche-ai", title: "Analyse des factures électroniques par IA : extraire les données en 2 secondes", desc: "Guide pratique pour experts-comptables : comment utiliser l'Intelligence Artificielle pour lire les factures électroniques, extraire base HT, TVA, IBAN et totaux et éviter les erreurs.", read: "6 min", tag: "Factures", excerpt: "De l'import du fichier à l'extraction automatique de la base HT, de la TVA et de l'IBAN : comment l'IA supprime la saisie manuelle et signale les anomalies.", body: [
      { h: null, p: ["La saisie manuelle des données de factures est l'une des tâches les plus répétitives et sujettes aux erreurs dans un cabinet. Une IA de document intelligence comme DocuAnalytics lit le document (PDF ou image), le classe comme facture et extrait automatiquement tous les champs clés en quelques secondes."] },
      { h: "Quelles données l'IA extrait d'une facture", p: ["Le modèle reconnaît et structure les données quelle que soit la mise en page du fournisseur :"], li: ["Numéro et date de la facture", "Fournisseur et client avec n° de TVA et identifiants", "Base HT, taux et montant de TVA, total du document", "IBAN et mode de paiement", "Échéances et conditions de paiement"] },
      { h: "Rapprochement automatique et contrôle d'erreurs", p: ["Au-delà de l'extraction, l'IA vérifie la cohérence arithmétique : base + TVA = total. Si le document ne s'équilibre pas, vous recevez une alerte immédiate. Le système signale aussi les IBAN étrangers et les montants anormaux, utiles pour les contrôles anti-blanchiment."] },
      { h: "De l'extraction à votre logiciel comptable", p: ["Les données extraites s'exportent en CSV ou JSON, prêtes à être importées dans un logiciel comptable, réduisant fortement le temps de saisie."] },
      { h: "Comment commencer", p: ["Importez votre première facture et obtenez l'extraction complète en 2 secondes. Vous avez 3 crédits gratuits pour essayer sans inscription."] },
    ] },
    { slug: "controllo-quadratura-f24", title: "Contrôle et rapprochement des formulaires fiscaux : guide pour experts-comptables", desc: "Comment vérifier automatiquement codes, montants et soldes d'un formulaire fiscal avec l'Intelligence Artificielle, en repérant les écarts et le visa de conformité TVA.", read: "5 min", tag: "Formulaires fiscaux", excerpt: "Codes, soldes Débit/Crédit et visa de conformité : comment l'IA contrôle un formulaire fiscal et vous alerte avant l'envoi.", body: [
      { h: null, p: ["Les formulaires fiscaux concentrent beaucoup d'informations critiques dans peu d'espace. Une erreur dans un code ou un solde peut entraîner des pénalités. L'IA lit le formulaire et effectue les contrôles à votre place."] },
      { h: "Ce que l'IA vérifie sur un formulaire fiscal", li: ["Extraction des codes, montants au débit et au crédit, période de référence", "Rapprochement Débit / Crédit / Solde final avec alerte en cas d'écart", "Détection du visa de conformité pour les crédits de TVA élevés", "Contrôle de cohérence entre les sections"] },
      { h: "Pourquoi le rapprochement automatique compte", p: ["Le contrôle manuel des soldes est lent et sujet aux distractions. L'audit anti-erreur intégré compare les totaux et signale instantanément toute incohérence, pour la corriger avant l'envoi télématique."] },
      { h: "Intégration dans votre flux de travail", p: ["Les données du formulaire peuvent être exportées et archivées avec le reste des documents du client. Chaque analyse inclut aussi le Copilot IA, à qui vous pouvez demander : « Quel est le solde final ? »."] },
      { h: "Essayez maintenant", p: ["Importez un formulaire fiscal et vérifiez le rapprochement automatiquement. Les 3 premiers contrôles sont gratuits."] },
    ] },
    { slug: "clausole-vessatorie-contratti-ai", title: "Clauses abusives dans les contrats : les repérer avec l'IA", desc: "Guide pour avocats et cabinets : comment l'Intelligence Artificielle détecte les clauses abusives, les délais de rétractation et les échéances critiques, avec un résumé clair.", read: "6 min", tag: "Contrats", excerpt: "Détection automatique des clauses abusives, préavis et échéances : l'IA lit le contrat et vous signale les risques.", body: [
      { h: null, p: ["Relire chaque contrat en entier est coûteux. Une IA entraînée au langage juridique identifie les clauses potentiellement abusives et les points d'attention, laissant le jugement final au professionnel."] },
      { h: "Ce que l'IA détecte dans un contrat", li: ["Clauses potentiellement abusives", "Parties, objet, durée, honoraires et rétractation", "Préavis et échéances contractuelles critiques", "Renouvellements tacites et pénalités"] },
      { h: "Résumé en langage clair", p: ["L'IA génère un résumé compréhensible des clauses complexes, utile pour des revues rapides avec le client. Avec le Copilot, vous pouvez demander : « Existe-t-il une clause de résiliation anticipée ? » et obtenir la réponse avec la référence au texte."] },
      { h: "Confidentialité et conformité", p: ["Les documents sont traités sur des serveurs 100% UE avec chiffrement AES 256 bits, conformément au RGPD et à l'EU AI Act, une exigence essentielle pour les cabinets."] },
      { h: "Lancer l'analyse", p: ["Importez un contrat et obtenez la liste des points d'attention en quelques secondes, avec 3 crédits gratuits."] },
    ] },
    { slug: "visure-camerali-antiriciclaggio-kyc-aml", title: "Extraits Kbis et lutte anti-blanchiment (KYC/AML) : extraction automatique des données", desc: "Comment extraire automatiquement numéro d'immatriculation, TVA, associés, dirigeants et bénéficiaire effectif d'un extrait pour les vérifications anti-blanchiment (KYC/AML) avec l'IA.", read: "5 min", tag: "Extraits", excerpt: "Numéro d'immatriculation, associés, dirigeants et bénéficiaire effectif : comment l'IA accélère les vérifications KYC/AML à partir de l'extrait.", body: [
      { h: null, p: ["Les vérifications anti-blanchiment exigent d'identifier rapidement la structure de l'actionnariat et le bénéficiaire effectif. L'IA extrait ces données directement de l'extrait, réduisant le temps de vigilance."] },
      { h: "Données extraites de l'extrait", li: ["Numéro d'immatriculation, TVA, siège, capital social et email certifié", "Liste des associés et de leurs parts", "Dirigeants et pouvoirs de signature", "Statut de l'activité et procédures en cours"] },
      { h: "Appui aux vérifications KYC/AML", p: ["Le système met en évidence les éléments utiles pour identifier le bénéficiaire effectif et signale les anomalies. L'évaluation finale du risque reste toujours de la responsabilité du professionnel."] },
      { h: "Archivage et cohérence des données", p: ["Les données extraites s'exportent en CSV/JSON et peuvent être comparées avec d'autres documents du dossier client pour en vérifier la cohérence."] },
      { h: "Essayez la démo", p: ["Importez un extrait et obtenez l'extraction structurée de l'actionnariat. Les 3 premiers documents sont gratuits."] },
    ] },
  ],
};

/* ---------------- helpers ---------------- */
function readLang() {
  const q = new URLSearchParams(window.location.search).get("lang");
  if (q && VALID.includes(q)) return q;
  const s = localStorage.getItem("da_lang");
  return VALID.includes(s) ? s : "it";
}
function useBlogLang() {
  const [lang, setLang] = useState(readLang);
  const change = (l) => {
    setLang(l);
    localStorage.setItem("da_lang", l);
    document.documentElement.lang = l;
    const u = new URL(window.location.href);
    if (l === "it") u.searchParams.delete("lang"); else u.searchParams.set("lang", l);
    window.history.replaceState({}, "", u);
  };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return [lang, change];
}

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
  el.setAttribute("href", href);
}
function setHreflang(path) {
  document.head.querySelectorAll('link[data-hl="1"]').forEach((e) => e.remove());
  const add = (hl, href) => { const l = document.createElement("link"); l.rel = "alternate"; l.hreflang = hl; l.href = href; l.setAttribute("data-hl", "1"); document.head.appendChild(l); };
  VALID.forEach((l) => add(l, l === "it" ? SITE + path : `${SITE}${path}?lang=${l}`));
  add("x-default", SITE + path);
}
function injectJsonLd(obj) {
  let el = document.getElementById("ld-blog");
  if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = "ld-blog"; document.head.appendChild(el); }
  el.textContent = JSON.stringify(obj);
}
function useSeo({ title, description, path, lang, jsonLd }) {
  useEffect(() => {
    const canonical = lang === "it" ? SITE + path : `${SITE}${path}?lang=${lang}`;
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertCanonical(canonical);
    setHreflang(path);
    if (jsonLd) injectJsonLd(jsonLd);
    window.scrollTo(0, 0);
    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta("name", "description", DEFAULT_DESC);
      upsertCanonical(SITE + "/");
      document.head.querySelectorAll('link[data-hl="1"]').forEach((e) => e.remove());
      const ld = document.getElementById("ld-blog");
      if (ld) ld.remove();
    };
  }, [title, description, path, lang, jsonLd]);
}

function BlogLangSwitcher({ lang, change }) {
  const [open, setOpen] = useState(false);
  const cur = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <div className="lang-wrap" data-testid="blog-lang-switcher">
      <button className="btn btn-sm btn-ghost" data-testid="blog-lang-toggle" onClick={() => setOpen((o) => !o)}>
        <Globe size={15} /> {cur.flag} <span className="lang-code">{cur.code.toUpperCase()}</span>
      </button>
      {open && (
        <div className="lang-menu" onMouseLeave={() => setOpen(false)}>
          {LANGS.map((l) => (
            <div key={l.code} className={`lang-item ${l.code === lang ? "on" : ""}`} data-testid={`blog-lang-${l.code}`}
              onClick={() => { change(l.code); setOpen(false); }}>
              <span>{l.flag}</span> {l.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlogChrome({ ui, lang, change, children }) {
  return (
    <div className="App">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo" data-testid="blog-logo-home" style={{ textDecoration: "none", color: "inherit" }}>
            <img src="/logo.png" alt="DocuAnalytics AI" className="logo-img" /> Docu<span className="grad">Analytics</span> AI
          </Link>
          <nav className="nav">
            <BlogLangSwitcher lang={lang} change={change} />
            <Link to="/" className="btn btn-sm btn-ghost" data-testid="blog-nav-home"><ArrowLeft size={15} /> {ui.home}</Link>
            <Link to="/" className="btn btn-primary btn-sm" data-testid="blog-nav-cta"><Sparkles size={15} /> {ui.tryFree}</Link>
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="footer">
        <div className="wrap">
          <p style={{ fontWeight: 800 }}>{ui.footTitle}</p>
          <p style={{ color: "var(--text-muted)", fontSize: ".82rem", marginTop: ".3rem" }}>{ui.footDesc}</p>
          <div className="flex gap wrapf aic" style={{ justifyContent: "center", marginTop: "1rem" }}>
            <Link to="/blog" className="btn btn-sm btn-ghost"><BookOpen size={14} /> {ui.allGuides}</Link>
            <Link to="/" className="btn btn-primary btn-sm"><CreditCard size={14} /> {ui.toApp}</Link>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: ".72rem", marginTop: "1.2rem" }}>© {new Date().getFullYear()} DocuAnalytics AI · {ui.rights}</p>
        </div>
      </footer>
    </div>
  );
}

export function BlogIndex() {
  const [lang, change] = useBlogLang();
  const ui = BLOG_UI[lang];
  const arts = ARTICLES[lang];
  useSeo({
    title: ui.idxTitle, description: ui.idxDesc, path: "/blog", lang,
    jsonLd: { "@context": "https://schema.org", "@type": "Blog", "name": ui.t1, "url": SITE + "/blog", "blogPost": arts.map((a) => ({ "@type": "BlogPosting", "headline": a.title, "url": `${SITE}/blog/${a.slug}`, "description": a.desc })) },
  });
  return (
    <BlogChrome ui={ui} lang={lang} change={change}>
      <section className="hero fade" style={{ paddingBottom: "1.5rem" }}>
        <div className="hero-badges mb1"><span className="badge badge-info">{ui.kicker}</span></div>
        <h1>{ui.t1}<br /><span className="grad">{ui.t2}</span></h1>
        <p>{ui.sub}</p>
      </section>
      <section className="section" data-testid="blog-list">
        <div className="accent-bar" />
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          {arts.map((a) => (
            <Link key={a.slug} to={`/blog/${a.slug}`} data-testid={`blog-card-${a.slug}`}
              className="glass pad blog-card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <div className="flex aic gap mb1">
                <span className="badge badge-info">{a.tag}</span>
                <span className="flex aic gap" style={{ color: "var(--text-muted)", fontSize: ".74rem" }}><Clock size={13} /> {a.read}</span>
              </div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.3, margin: ".2rem 0 .5rem" }}>{a.title}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: ".86rem", lineHeight: 1.55 }}>{a.excerpt}</p>
              <span className="flex aic gap grad" style={{ fontWeight: 700, fontSize: ".85rem", marginTop: ".8rem" }}>{ui.readMore} <ArrowRight size={15} /></span>
            </Link>
          ))}
        </div>
      </section>
    </BlogChrome>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [lang, change] = useBlogLang();
  const ui = BLOG_UI[lang];
  const article = ARTICLES[lang].find((a) => a.slug === slug);

  useSeo({
    title: article ? `${article.title} | DocuAnalytics AI` : DEFAULT_TITLE,
    description: article ? article.desc : DEFAULT_DESC,
    path: `/blog/${slug}`, lang,
    jsonLd: article ? {
      "@context": "https://schema.org", "@type": "BlogPosting",
      "headline": article.title, "description": article.desc,
      "inLanguage": lang,
      "author": { "@type": "Organization", "name": "DocuAnalytics AI" },
      "publisher": { "@type": "Organization", "name": "DocuAnalytics AI", "logo": { "@type": "ImageObject", "url": SITE + "/logo.png" } },
      "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE}/blog/${slug}` },
      "image": SITE + "/og-image.png",
    } : null,
  });

  if (!article) {
    return (
      <BlogChrome ui={ui} lang={lang} change={change}>
        <section className="section center" data-testid="blog-not-found" style={{ paddingTop: "3rem" }}>
          <h1>{ui.nfTitle}</h1>
          <p className="section-sub mb1">{ui.nfSub}</p>
          <button className="btn btn-primary" onClick={() => navigate("/blog")}><BookOpen size={16} /> {ui.allGuides}</button>
        </section>
      </BlogChrome>
    );
  }

  return (
    <BlogChrome ui={ui} lang={lang} change={change}>
      <article className="section fade article-body" data-testid="blog-article">
        <Link to="/blog" className="flex aic gap" data-testid="article-back" style={{ color: "var(--text-muted)", fontSize: ".82rem", textDecoration: "none", marginBottom: "1rem" }}>
          <ArrowLeft size={14} /> {ui.allGuides}
        </Link>
        <div className="flex aic gap mb1">
          <span className="badge badge-info">{article.tag}</span>
          <span className="flex aic gap" style={{ color: "var(--text-muted)", fontSize: ".74rem" }}><Clock size={13} /> {article.read} {ui.readSuffix}</span>
        </div>
        <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.6rem)", lineHeight: 1.2 }}>{article.title}</h1>
        <p className="section-sub" style={{ marginTop: ".6rem", marginBottom: "1.5rem" }}>{article.excerpt}</p>

        {article.body.map((sec, i) => (
          <div key={i} className="mb1">
            {sec.h && <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "1.4rem 0 .6rem" }}>{sec.h}</h2>}
            {(sec.p || []).map((para, j) => (
              <p key={j} style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: ".7rem" }}>{para}</p>
            ))}
            {sec.li && (
              <div style={{ marginTop: ".2rem" }}>
                {sec.li.map((item, k) => (
                  <div className="flex gap" key={k} style={{ alignItems: "flex-start", marginBottom: ".5rem" }}>
                    <CheckCircle2 size={17} color="var(--success)" style={{ flexShrink: 0, marginTop: 3 }} />
                    <span style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="glass pad mt2 flex aic gap wrapf" style={{ justifyContent: "space-between", border: "1px solid #00d2ff44" }}>
          <span className="flex aic gap"><Sparkles size={20} color="var(--accent)" /> {ui.ctaText}</span>
          <Link to="/" className="btn btn-primary" data-testid="article-cta"><CreditCard size={16} /> {ui.ctaBtn} <ArrowRight size={15} /></Link>
        </div>

        <div className="mt2">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: ".8rem" }}>{ui.other}</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {ARTICLES[lang].filter((a) => a.slug !== article.slug).slice(0, 3).map((a) => (
              <Link key={a.slug} to={`/blog/${a.slug}`} className="glass pad blog-card" data-testid={`related-${a.slug}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <span className="badge badge-info mb1" style={{ display: "inline-block" }}>{a.tag}</span>
                <div style={{ fontWeight: 700, fontSize: ".92rem", lineHeight: 1.35 }}>{a.title}</div>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </BlogChrome>
  );
}
