import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

const PH = ({ children }) => <mark className="pv-ph">{children}</mark>;

const SECTIONS = [
  ["Titolare del trattamento", <p key="t">
    Francesco Lampone (impresa individuale), P.IVA 03803270838, C.F. LMPFNC83E23A638T, Via Edoardo De Filippo 68, 98051 Barcellona Pozzo di Gotto (ME), Italia. Contatto privacy: <a href="mailto:docuanalyticsai@docuanalytics.online">docuanalyticsai@docuanalytics.online</a>.</p>],
  ["Dati che trattiamo", <ul key="d">
    <li><b>Account</b>: email, nome, password (salvata solo in forma cifrata con hash), foto profilo se accedi con Google, codice invito.</li>
    <li><b>Utilizzo senza registrazione</b>: un identificativo anonimo salvato nel tuo browser per gestire i crediti gratuiti.</li>
    <li><b>Documenti caricati</b>: il file viene salvato temporaneamente solo per l'elaborazione e cancellato al termine dell'analisi.</li>
    <li><b>Risultati delle analisi</b>: dati estratti, controlli (audit) e testo del documento, salvati nel tuo storico per consultarli e usare il Copilot.</li>
    <li><b>Crediti e pagamenti</b>: pacchetti acquistati, importi e stato dei pagamenti. I dati della carta sono gestiti direttamente da Stripe o PayPal e non transitano sui nostri server.</li>
    <li><b>Sicurezza</b>: indirizzo IP al momento della registrazione, usato per limitare abusi dei crediti gratuiti e del programma inviti.</li>
    <li><b>Promemoria</b>: email, descrizione e data della scadenza, se attivi un promemoria.</li>
    <li><b>Assistente commerciale</b>: solo statistiche anonime (canale di provenienza e tipo di azione). Non salviamo il testo dei messaggi né l'indirizzo IP.</li>
    <li><b>Statistiche del sito</b>: Google Analytics con anonimizzazione IP.</li>
  </ul>],
  ["Finalità", <ul key="f">
    <li>Fornire il servizio di analisi documentale, Copilot, storico ed esportazioni.</li>
    <li>Gestire account, crediti, pagamenti e programma inviti.</li>
    <li>Prevenire abusi e garantire la sicurezza del servizio.</li>
    <li>Misurare in forma aggregata l'uso del sito e dell'assistente.</li>
  </ul>],
  ["Fornitori che trattano dati per nostro conto", <ul key="p">
    <li><b>Google (Gemini)</b>, <b>Anthropic (Claude)</b>, <b>OpenAI (ChatGPT)</b>: elaborazione AI del documento, secondo il motore che scegli, e risposte dell'assistente.</li>
    <li><b>Emergent</b>: hosting dell'applicazione e del database; servizio di accesso con Google.</li>
    <li><b>Cloudflare</b>: rete di distribuzione e protezione del sito.</li>
    <li><b>Stripe</b> e <b>PayPal</b>: pagamenti.</li>
    <li><b>Resend</b>: invio email (verifica account e promemoria), se attivo.</li>
    <li><b>Google Analytics</b>: statistiche di utilizzo.</li>
  </ul>],
  ["Per quanto tempo conserviamo i dati", <>
    <p key="r1">Il <b>file caricato</b> viene cancellato al termine dell'analisi.</p>
    <p key="r2">Lo <b>storico delle analisi</b> e i dati dell'account sono conservati finché mantieni l'account. Puoi chiederne la cancellazione scrivendo a <a href="mailto:docuanalyticsai@docuanalytics.online">docuanalyticsai@docuanalytics.online</a>. La cancellazione non è automatica.</p>
    <p key="r3">I dati di pagamento sono conservati per il tempo richiesto dagli obblighi fiscali e contabili.</p>
  </>],
  ["I tuoi diritti", <p key="dr">
    Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporti al trattamento scrivendo a <a href="mailto:docuanalyticsai@docuanalytics.online">docuanalyticsai@docuanalytics.online</a>. Hai inoltre diritto di proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).</p>],
  ["Consigli d'uso", <p key="c">
    I risultati dell'AI possono contenere errori e vanno sempre verificati. Prima di caricare documenti con dati personali di terzi, verifica di averne titolo e le informative del tuo studio.</p>],
];

export default function PrivacyPage() {
  useEffect(() => { document.title = "Informativa privacy · DocuAnalytics AI"; window.scrollTo(0, 0); }, []);
  return (
    <div className="App">
      <main className="wrap pv-page" data-testid="privacy-page">
        <Link to="/" className="pv-back" data-testid="privacy-home-link">← DocuAnalytics AI</Link>
        <div className="pv-draft" data-testid="privacy-draft-banner"><AlertTriangle size={16} /> Bozza in revisione: dati del titolare da confermare e politica di conservazione da validare prima della pubblicazione.</div>
        <h1>Informativa privacy</h1>
        <p className="pv-upd">Ultimo aggiornamento: <PH>[data del deploy]</PH></p>
        {SECTIONS.map(([h, body]) => (
          <section key={h} className="pv-sec"><h2>{h}</h2>{body}</section>
        ))}
      </main>
    </div>
  );
}
