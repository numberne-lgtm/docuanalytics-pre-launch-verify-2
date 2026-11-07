import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Mail, ShieldCheck } from "lucide-react";
import { PREFERENCES_EVENT } from "./analyticsConsent";

const LEGAL = {
  name: (process.env.REACT_APP_LEGAL_NAME || "").trim(),
  vat: (process.env.REACT_APP_LEGAL_VAT || "").trim(),
  address: (process.env.REACT_APP_LEGAL_ADDRESS || "").trim(),
  registration: (process.env.REACT_APP_LEGAL_REGISTRATION || "").trim(),
  pec: (process.env.REACT_APP_LEGAL_PEC || "").trim(),
  phone: (process.env.REACT_APP_LEGAL_PHONE || "").trim(),
};
const CONTACT_EMAIL = "docuanalyticsai@docuanalytics.online";
const Contact = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const DOCS = [
  ["/dati-legali", "Dati legali"],
  ["/termini", "Condizioni di servizio"],
  ["/acquisti-rimborsi", "Acquisti e rimborsi"],
  ["/privacy", "Privacy"],
  ["/cookie-policy", "Cookie"],
  ["/accessibilita", "Accessibilità"],
];

function Layout({ title, subtitle, children, isDraft = true }) {
  useEffect(() => {
    document.title = `${title} · DocuAnalytics AI`;
    window.scrollTo(0, 0);
  }, [title]);
  return (
    <div className="App">
      <main className="wrap pv-page" data-testid="legal-page">
        <Link to="/" className="pv-back">← DocuAnalytics AI</Link>
        <h1>{title}</h1>
        {subtitle && <p className="pv-lead">{subtitle}</p>}
        {isDraft && (
          <div className="pv-draft" role="note" data-testid="legal-draft-banner">
            <AlertTriangle aria-hidden="true" size={18} />
            <span>Documento preparatorio del progetto. Alcune informazioni sono in corso di verifica e devono essere completate prima di poter considerare conclusa la documentazione legale e contrattuale.</span>
          </div>
        )}
        {children}
        <nav aria-label="Documentazione e informazioni legali" className="pv-sec pv-legal-nav">
          <h2>Altre informazioni</h2>
          <div className="pv-legal-links">
            {DOCS.map(([href, label]) => <Link key={href} to={href}>{label}</Link>)}
          </div>
        </nav>
        <p className="pv-upd">Revisione dei testi: 7 novembre 2026. Ultima verifica dei contenuti e dell'applicabilità normativa prima del lancio commerciale ancora necessaria.</p>
      </main>
    </div>
  );
}

export function LegalPage() {
  const detailsComplete = Boolean(LEGAL.name && LEGAL.address);
  return (
    <Layout title="Dati legali" subtitle="Informazioni sull'iniziativa DocuAnalytics AI e contatti del progetto.">
      <section className="pv-sec">
        <h2>Progetto e gestore</h2>
        <p><strong>Nome del progetto:</strong> DocuAnalytics AI — piattaforma online di analisi e organizzazione documentale assistita dall'intelligenza artificiale.</p>
        <p><strong>Stato dell'attività:</strong> iniziativa in preparazione, attualmente gestita a titolo personale. La formalizzazione dell'attività economica è in corso di valutazione.</p>
        {LEGAL.name ? <p><strong>Nome o denominazione del gestore:</strong> {LEGAL.name}</p> :
          <p className="pv-pending">Identità completa del gestore: da inserire e verificare prima dell'avvio commerciale.</p>}
        {LEGAL.address ? <p><strong>Recapito geografico / sede:</strong> {LEGAL.address}</p> :
          <p className="pv-pending">Recapito geografico dell'operatore: da completare prima dell'avvio commerciale.</p>}
        {LEGAL.vat && <p><strong>Partita IVA:</strong> {LEGAL.vat}</p>}
        {LEGAL.registration && <p><strong>Iscrizione / registro:</strong> {LEGAL.registration}</p>}
        {LEGAL.pec && <p><strong>PEC:</strong> <a href={`mailto:${LEGAL.pec}`}>{LEGAL.pec}</a></p>}
        {LEGAL.phone && <p><strong>Telefono:</strong> <a href={`tel:${LEGAL.phone}`}>{LEGAL.phone}</a></p>}
        {!detailsComplete && <p><strong>Importante:</strong> l'indicazione dello stato preparatorio non sostituisce le informazioni identificative eventualmente obbligatorie per l'erogazione commerciale del servizio.</p>}
      </section>
      <section className="pv-sec">
        <h2>Contatti del progetto</h2>
        <p><Mail size={16} aria-hidden="true" className="pv-inline-icon" /> Per supporto, segnalazioni e richieste relative al sito: <Contact />.</p>
        <p>Per questioni sulla protezione dei dati, puoi usare lo stesso recapito e consultare l'<Link to="/privacy">informativa privacy</Link>.</p>
      </section>
      <section className="pv-sec">
        <h2>Natura del servizio e avvertenze</h2>
        <p>DocuAnalytics AI fornisce strumenti software per estrarre informazioni, preparare riepiloghi, analizzare documenti e organizzare scadenze. I risultati automatizzati possono essere incompleti o errati e devono essere verificati prima di decisioni fiscali, giuridiche, contabili o professionali.</p>
        <p>Il progetto non si presenta come studio di commercialisti, studio legale, notaio o autorità pubblica. Le funzioni software non sostituiscono un professionista abilitato.</p>
      </section>
      <section className="pv-sec">
        <h2>Documenti da consultare</h2>
        <p>Consulta le <Link to="/termini">condizioni di servizio in preparazione</Link>, le informazioni su <Link to="/acquisti-rimborsi">acquisti e rimborsi</Link>, la <Link to="/privacy">privacy</Link>, le <Link to="/cookie-policy">tecnologie di tracciamento</Link> e la pagina sull'<Link to="/accessibilita">accessibilità</Link>.</p>
      </section>
    </Layout>
  );
}

export function TermsPage() {
  return (
    <Layout title="Condizioni di servizio" subtitle="Schema informativo preliminare: le condizioni definitive richiedono verifica e approvazione prima dell'uso per nuove vendite.">
      <section className="pv-sec">
        <h2>1. Il servizio</h2>
        <p>DocuAnalytics AI è un'applicazione web che consente, secondo le funzioni effettivamente disponibili, di caricare e analizzare documenti, consultare risultati, collegarli ai clienti, organizzare scadenze, preparare report ed utilizzare strumenti assistiti dall'AI.</p>
        <p>Le funzionalità, i limiti d'uso e gli eventuali costi devono essere descritti nelle schermate pertinenti prima che l'utente completi un'operazione a pagamento.</p>
      </section>
      <section className="pv-sec">
        <h2>2. Account e utilizzo corretto</h2>
        <p>Chi registra un account è tenuto a fornire informazioni corrette, custodire le proprie credenziali e utilizzare le funzioni nel rispetto della legge e dei diritti di terzi. Il caricamento di documenti di altre persone richiede una base giuridica appropriata.</p>
        <p>Non devono essere caricati dati o documenti per cui l'utente non dispone dei necessari diritti o autorizzazioni.</p>
      </section>
      <section className="pv-sec">
        <h2>3. Analisi automatizzate e responsabilità professionale</h2>
        <p>Le elaborazioni possono generare errori, omissioni o interpretazioni non corrette. Il risultato è un ausilio operativo e non una certificazione della validità di un documento né una consulenza fiscale, giuridica, finanziaria o notarile.</p>
        <p>È necessaria una verifica umana prima di utilizzare i risultati in procedimenti, adempimenti o decisioni rilevanti. Restano salvi i diritti inderogabili riconosciuti dalla legge applicabile.</p>
      </section>
      <section className="pv-sec">
        <h2>4. Crediti, prezzi e pagamenti</h2>
        <p>Alcune funzioni possono utilizzare crediti. Il numero di crediti necessari, la composizione dei pacchetti, gli importi e i metodi di pagamento effettivamente disponibili sono mostrati nell'interfaccia di acquisto.</p>
        <p>Le regole definitive su durata dei crediti, eventuale scadenza, malfunzionamenti, rimborsi e recesso sono in revisione e devono essere rese chiare <strong>prima</strong> della conclusione di qualsiasi acquisto.</p>
        <p>Leggi la pagina <Link to="/acquisti-rimborsi">Acquisti e rimborsi</Link>.</p>
      </section>
      <section className="pv-sec">
        <h2>5. Dati, riservatezza e clienti dello studio</h2>
        <p>L'utilizzo dei dati personali è descritto nell'<Link to="/privacy">informativa privacy</Link>. Per documenti caricati da studi professionali può essere necessario un accordo sul trattamento per conto dello studio ai sensi dell'articolo 28 GDPR. I relativi accordi e la catena dei fornitori richiedono verifica prima di trattamenti professionali reali.</p>
      </section>
      <section className="pv-sec">
        <h2>6. Assistenza, problemi e reclami</h2>
        <p>Per problemi di accesso, crediti, report, sicurezza o reclami puoi contattare <Contact /> indicando il problema e, se disponibile, l'identificativo della transazione. Non inviare password o documenti riservati tramite email ordinaria.</p>
      </section>
      <section className="pv-sec">
        <h2>7. Versione contrattuale definitiva</h2>
        <p>Questo testo è preparatorio: non specifica ancora tutte le condizioni vincolanti di vendita, recesso, sospensione del servizio, durata, risoluzione e legge applicabile. Tali aspetti saranno definiti e sottoposti a verifica prima dell'utilizzo come condizioni generali per gli acquisti.</p>
        <p>Non sono previste tramite questa pagina rinunce automatiche a diritti dei consumatori o limitazioni alle tutele obbligatorie.</p>
      </section>
    </Layout>
  );
}

export function PurchasesPage() {
  return (
    <Layout title="Acquisti, crediti e rimborsi" subtitle="Informazioni preliminari sui pagamenti per le funzionalità del servizio.">
      <section className="pv-sec">
        <h2>Come funzionano i crediti</h2>
        <p>DocuAnalytics AI può utilizzare crediti per eseguire determinate analisi e operazioni. I crediti inclusi, il prezzo e le operazioni coperte da ciascun pacchetto devono risultare nella schermata di acquisto prima della conferma.</p>
        <p>La durata, l'eventuale scadenza e le condizioni dei crediti già acquistati devono essere indicate in modo esplicito: queste regole sono ancora da completare nella documentazione contrattuale.</p>
      </section>
      <section className="pv-sec">
        <h2>Prezzi e metodi di pagamento</h2>
        <p>L'importo effettivo e le eventuali imposte devono essere visibili prima del pagamento. Il servizio può mostrare metodi di pagamento gestiti da fornitori esterni, a seconda della configurazione del checkout.</p>
        <p>La sola presenza di un logo di pagamento non garantisce che quel metodo sia disponibile in ogni momento.</p>
      </section>
      <section className="pv-sec">
        <h2>Diritto di recesso e rimborsi</h2>
        <p>Per gli acquisti effettuati da consumatori, il diritto di recesso e le sue eventuali eccezioni dipendono dalla normativa applicabile e dalla natura del servizio o contenuto digitale. L'eventuale perdita del diritto non è automatica al solo acquisto: nei casi previsti dalla legge sono necessari specifici presupposti e consensi.</p>
        <p>Le procedure definitive di recesso e rimborso, incluso un eventuale modulo e i tempi di risposta, devono essere definite prima di operare verso consumatori. Nulla in questa bozza esclude i diritti inderogabili previsti dalla legge.</p>
      </section>
      <section className="pv-sec">
        <h2>Problemi con un pagamento</h2>
        <p>Se un pagamento risulta addebitato ma non vedi i crediti, evita acquisti ripetuti e contatta <Contact />. Indica data, importo, metodo utilizzato e riferimento della transazione, senza inviare numeri di carta o password.</p>
        <p>Per la gestione dei dati di pagamento consulta l'<Link to="/privacy">informativa privacy</Link>.</p>
      </section>
      <section className="pv-sec">
        <h2>Da definire prima del lancio commerciale</h2>
        <p>Identità del soggetto venditore, trattamento fiscale, condizioni vincolanti dei pacchetti, scadenza dei crediti, recesso, rimborsi e conferme d'ordine devono essere convalidati anche nel flusso di checkout, non soltanto in questa pagina.</p>
      </section>
    </Layout>
  );
}

export function CookiesPage() {
  return (
    <Layout title="Cookie e tecnologie simili" subtitle="Informazioni sull'uso di cookie, storage del browser e statistiche.">
      <section className="pv-sec">
        <h2>Strumenti necessari</h2>
        <p>Il servizio utilizza strumenti tecnici del browser per riconoscere sessioni, memorizzare preferenze e gestire l'utilizzo delle funzionalità. Alcuni sono necessari al funzionamento dell'applicazione.</p>
      </section>
      <section className="pv-sec">
        <h2>Statistiche facoltative</h2>
        <p>La configurazione applicativa prevede Google Analytics per le statistiche, subordinato al consenso. Puoi accettare o rifiutare le statistiche e modificare la scelta successivamente.</p>
        <button className="btn btn-sm btn-primary" type="button" onClick={() => window.dispatchEvent(new Event(PREFERENCES_EVENT))}>Modifica preferenze cookie</button>
      </section>
      <section className="pv-sec">
        <h2>Durata e fornitori</h2>
        <p>L'inventario tecnico completo dei cookie e delle altre tecnologie, con nomi, durata, finalità e fornitori effettivamente attivi sul sito pubblicato, è ancora in verifica. Nessuna tecnologia facoltativa deve essere presentata come necessaria senza verifica.</p>
        <p>Per le informazioni sul trattamento dei dati, consulta l'<Link to="/privacy">informativa privacy</Link>.</p>
      </section>
    </Layout>
  );
}

export function AccessibilityPage() {
  return (
    <Layout title="Accessibilità" subtitle="Informazioni sul percorso di miglioramento dell'accessibilità digitale di DocuAnalytics AI.">
      <section className="pv-sec">
        <h2>Il nostro obiettivo</h2>
        <p>Vogliamo rendere l'interfaccia utilizzabile con tastiera, tecnologie assistive, ingrandimento del testo e dispositivi mobili. I riferimenti tecnici per la verifica includono le WCAG 2.2 di livello A e AA.</p>
      </section>
      <section className="pv-sec">
        <h2>Verifiche tecniche</h2>
        <p>In ambiente di sviluppo sono stati eseguiti controlli automatici su sette viste dell'Area di lavoro, comprendendo Priorità, Documenti, Clienti e Scadenze. Tali controlli non coprono l'intero sito, l'accesso tramite ogni tecnologia assistiva o tutte le condizioni d'uso reale.</p>
        <p><strong>Non si dichiara in questa fase una conformità legale completa</strong>: restano da completare verifiche manuali, test con screen reader e valutazione dell'applicabilità delle norme all'operatore del servizio.</p>
      </section>
      <section className="pv-sec">
        <h2>Segnala una barriera</h2>
        <p><ShieldCheck size={16} aria-hidden="true" className="pv-inline-icon" /> Puoi scrivere a <Contact /> indicando pagina, problema, dispositivo, browser ed eventuale tecnologia assistiva. Evita di includere documenti personali o dati sensibili nella segnalazione.</p>
      </section>
      <section className="pv-sec">
        <h2>Informazioni normative</h2>
        <p>L'eventuale obbligo di informazioni o dichiarazioni specifiche deve essere valutato secondo la normativa applicabile, anche con riferimento al D.Lgs. 82/2022. Questa pagina non sostituisce eventuali dichiarazioni formali richieste.</p>
      </section>
    </Layout>
  );
}
