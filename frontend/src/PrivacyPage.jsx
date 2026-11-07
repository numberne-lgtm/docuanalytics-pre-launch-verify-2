import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { PREFERENCES_EVENT } from "./analyticsConsent";
import { AlertTriangle } from "lucide-react";

const LEGAL = {
  name: process.env.REACT_APP_LEGAL_NAME,
  vat: process.env.REACT_APP_LEGAL_VAT,
  address: process.env.REACT_APP_LEGAL_ADDRESS,
  registration: process.env.REACT_APP_LEGAL_REGISTRATION,
};
const PRIVACY_EMAIL = "docuanalyticsai@docuanalytics.online";
const PrivacyContact = () => <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>;

const SECTIONS = [
  ["Titolare del trattamento", <p key="t">
    {LEGAL.name || "Identità del titolare in verifica."} Per domande sul trattamento o per esercitare i tuoi diritti, scrivi a <PrivacyContact />. I recapiti dell’attività sono nella pagina <Link to="/dati-legali">Dati legali</Link>.</p>],
  ["Dati che trattiamo", <ul key="d">
    <li><b>Account</b>: email, nome, password (protetta tramite hash), foto profilo se accedi con Google, codice invito.</li>
    <li><b>Utilizzo senza registrazione</b>: un identificativo di sessione salvato nel tuo browser per gestire i crediti gratuiti.</li>
    <li><b>Documenti caricati</b>: il file viene elaborato attraverso il servizio AI selezionato. L’applicazione usa una copia temporanea e ne prevede la rimozione a fine elaborazione. Le condizioni di conservazione dei fornitori AI sono oggetto di verifica.</li>
    <li><b>Risultati delle analisi</b>: dati estratti, controlli (audit) e testo del documento, salvati nel tuo storico per consultarli e usare il Copilot.</li>
    <li><b>Crediti e pagamenti</b>: pacchetti acquistati, importi e stato dei pagamenti. I dati della carta sono gestiti direttamente da Stripe o PayPal e non transitano sui nostri server.</li>
    <li><b>Sicurezza</b>: indirizzo IP al momento della registrazione, usato per limitare abusi dei crediti gratuiti e del programma inviti.</li>
    <li><b>Area di lavoro</b>: dati identificativi e contatti dei clienti dello studio (nome, email, PEC, telefono e referente), collegamenti ai documenti, scadenze e dati del profilo dello studio, compreso il logo se caricato.</li>
    <li><b>Report e calendario</b>: i report e i file di calendario che esporti contengono i dati delle schede selezionate. Se apri una bozza dalla scheda cliente, scegli il mittente e spedisci dal tuo programma di posta. Un eventuale link di abbonamento al calendario consente a chi lo possiede di leggere le scadenze incluse.</li>
    <li><b>Promemoria</b>: email, descrizione e data della scadenza, se attivi un promemoria.</li>
    <li><b>Assistente commerciale</b>: registriamo eventi di utilizzo e il canale di provenienza con un identificativo di sessione trasformato tramite hash. I messaggi sono elaborati per generare la risposta.</li>
    <li><b>Statistiche del sito</b>: Google Analytics, se acconsenti alle statistiche.</li>
  </ul>],
  ["Finalità e basi giuridiche", <ul key="f">
    <li><b>Contratto o misure precontrattuali</b>: creare l’account, erogare le funzioni richieste, gestire crediti, acquisti e assistenza relativa al servizio.</li>
    <li><b>Obblighi di legge</b>: adempiere agli obblighi fiscali e contabili.</li>
    <li><b>Legittimo interesse</b>: proteggere il servizio, contrastare abusi e tutelare i diritti del titolare. L’applicazione di questa base va valutata per ciascuna finalità.</li>
    <li><b>Consenso</b>: raccogliere statistiche del sito con Google Analytics. Puoi rifiutare o revocare il consenso dalla sezione Preferenze cookie.</li>
    <li>Se mancano i dati necessari a una funzione, come un indirizzo per inviare un promemoria, quella funzione non può essere erogata. Le statistiche sono facoltative.</li>
  </ul>],
  ["Dati gestiti per conto dello studio", <p key="roles">
    Lo studio decide per quali finalità trattare i dati dei propri clienti. Quando DocuAnalytics li tratta su istruzione dello studio, il trattamento va disciplinato da un accordo ai sensi dell’art. 28 del GDPR. DocuAnalytics opera come titolare per le proprie finalità di gestione del servizio, sicurezza e adempimenti. I risultati AI sono un supporto alle verifiche del professionista.</p>],
  ["Destinatari e fornitori", <ul key="p">
    <li><b>Google (Gemini)</b>, <b>Anthropic (Claude)</b>, <b>OpenAI (ChatGPT)</b>: elaborazione AI attraverso il servizio di integrazione Emergent. Il modello dipende dalla funzione utilizzata e dalla selezione disponibile.</li>
    <li><b>Emergent</b>: hosting e integrazioni, inclusi accesso con Google e instradamento delle richieste AI.</li>
    <li><b>Cloudflare</b>: rete di distribuzione e protezione del sito.</li>
    <li><b>Stripe</b> e <b>PayPal</b>: pagamenti, secondo il metodo scelto.</li>
    <li><b>Resend</b>: invio email (verifica account e promemoria), se attivo.</li>
    <li><b>Google Analytics</b>: statistiche di utilizzo con consenso.</li>
  </ul>],
  ["Trasferimenti di dati", <p key="transfer">
    Per i servizi dei fornitori stiamo verificando i Paesi effettivi di trattamento, i subfornitori e le garanzie applicabili agli eventuali trasferimenti fuori dallo Spazio economico europeo. Questa parte dell’informativa resta in revisione.</p>],
  ["Per quanto tempo conserviamo i dati", <>
    <p key="r1">La copia temporanea del file usata dall’applicazione ha lo scopo di consentire l’elaborazione. Il testo estratto, i dati strutturati e i controlli possono restare nello storico per la consultazione e il Copilot.</p>
    <p key="r2">I dati dell’account, le schede e i risultati servono a mantenere disponibili le funzioni richieste. Puoi eliminare singole analisi dalla scheda del documento oppure chiedere la cancellazione dell’account scrivendo a <PrivacyContact />. La procedura di cancellazione e i tempi per dati residui, log, backup e fornitori sono ancora da validare.</p>
    <p key="r3">I dati contabili seguono i termini previsti dalla normativa applicabile.</p>
  </>],
  ["I tuoi diritti", <p key="dr">
    Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporti al trattamento scrivendo a <a href="mailto:docuanalyticsai@docuanalytics.online">docuanalyticsai@docuanalytics.online</a>. Quando il trattamento si basa sul consenso puoi revocarlo in ogni momento. Puoi presentare reclamo al <a href="https://www.garanteprivacy.it/">Garante per la protezione dei dati personali</a>.</p>],
  ["Consigli d'uso", <p key="c">
    I risultati dell'AI possono contenere errori e vanno sempre verificati. Prima di caricare documenti con dati personali di terzi, verifica di averne titolo e le informative del tuo studio.</p>],
];

export default function PrivacyPage() {
  const { hash } = useLocation();
  useEffect(() => { document.title = "Informativa privacy · DocuAnalytics AI"; }, []);
  useEffect(() => {
    if (hash === "#preferenze-cookie") document.getElementById("preferenze-cookie")?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash]);
  return (
    <div className="App">
      <main className="wrap pv-page" data-testid="privacy-page">
        <Link to="/" className="pv-back" data-testid="privacy-home-link">← DocuAnalytics AI</Link>
        <div className="pv-draft" data-testid="privacy-draft-banner"><AlertTriangle size={16} /> Bozza in revisione. Da confermare i dati dell’attività, la conservazione, i trasferimenti e gli accordi con i fornitori.</div>
        <h1>Informativa privacy</h1>
        <p className="pv-upd">Bozza aggiornata il 7 novembre 2026</p>
        {SECTIONS.map(([h, body]) => (
          <section key={h} className="pv-sec"><h2>{h}</h2>{body}</section>
        ))}
        <section className="pv-sec" id="preferenze-cookie">
          <h2>Preferenze cookie</h2>
          <p>Usiamo lo spazio di archiviazione del browser per sessione, preferenze e crediti. Google Analytics viene caricato sul sito pubblico dopo che scegli di accettare le statistiche. La scelta viene salvata nel browser.</p>
          <button type="button" className="btn btn-sm btn-primary mt1" onClick={() => window.dispatchEvent(new Event(PREFERENCES_EVENT))}>Modifica preferenze cookie</button>
        </section>
      </main>
    </div>
  );
}


export function LegalPage() {
  useEffect(() => { document.title = "Dati legali · DocuAnalytics AI"; window.scrollTo(0, 0); }, []);
  return (
    <main className="wrap pv-page">
      <Link to="/" className="pv-back">← DocuAnalytics AI</Link>
      <h1>Dati legali</h1>
      <section className="pv-sec">
        <h2>Gestore del servizio</h2>
        {(!LEGAL.name || !LEGAL.vat || !LEGAL.address) && <p>Dati dell’attività in verifica.</p>}
        {LEGAL.name && <p>{LEGAL.name}</p>}
        {LEGAL.vat && <p>Partita IVA {LEGAL.vat}</p>}
        {LEGAL.address && <p>{LEGAL.address}</p>}
        {LEGAL.registration && <p>{LEGAL.registration}</p>}
        <p>Contatto <PrivacyContact /></p>
        <p><Link to="/privacy">Informativa privacy e cookie</Link></p>
      </section>
    </main>
  );
}
