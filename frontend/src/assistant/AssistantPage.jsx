import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Send, Scale, Calculator, Briefcase, Users, Sparkles, CreditCard, UserPlus, Loader2, RotateCcw, ArrowLeft } from "lucide-react";
import "./assistant.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/assistant`;
const SID_KEY = "da_assistant_sid";
const LOG_KEY = "da_assistant_log";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"];

const PROFILES = [
  { id: "avvocato", label: "Avvocato", icon: Scale, qs: ["Come mi aiuta ad analizzare un contratto?", "Segnala le clausole vessatorie?", "Quanto costa per uno studio legale?"] },
  { id: "commercialista", label: "Commercialista", icon: Calculator, qs: ["Posso esportare i dati verso il mio gestionale?", "Controlla F24 e fatture?", "Quale piano conviene a uno studio?"] },
  { id: "imprenditore", label: "Imprenditore", icon: Briefcase, qs: ["Come controllo le fatture dei fornitori?", "Come funzionano i crediti?", "Posso provarlo gratis?"] },
  { id: "altro professionista", label: "Altro professionista", icon: Users, qs: ["Cosa fa DocuAnalytics?", "Quali documenti posso analizzare?", "I miei documenti sono al sicuro?"] },
];

const WELCOME = "Ciao! Sono l'assistente di DocuAnalytics AI. Ti aiuto a capire se e come la piattaforma può semplificare il tuo lavoro con i documenti. Di cosa ti occupi?";

const getSid = () => {
  let s = localStorage.getItem(SID_KEY);
  if (!s) { s = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`); localStorage.setItem(SID_KEY, s); }
  return s;
};

const getUtm = () => {
  const p = new URLSearchParams(window.location.search);
  const fresh = Object.fromEntries(UTM_KEYS.map((k) => [k, p.get(k)]).filter(([, v]) => v));
  if (Object.keys(fresh).length) sessionStorage.setItem("da_assistant_utm", JSON.stringify(fresh));
  try { return JSON.parse(sessionStorage.getItem("da_assistant_utm") || "{}"); } catch { return {}; }
};

const sendEvent = (event, utm) => axios.post(`${API}/event`, { session_id: getSid(), event, ...utm }).catch(() => {});

const ctaUrl = (base, utm) => {
  const q = new URLSearchParams({ src: "assistant", ...utm });
  const [path, hash] = base.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}${q.toString()}${hash ? `#${hash}` : ""}`;
};

function RichText({ text }) {
  return (
    <>
      {text.split("\n").filter((l) => l.trim()).map((line, i) => {
        const bullet = /^\s*[-*•]\s+/.test(line);
        const parts = line.replace(/^\s*[-*•]\s+/, "").split(/\*\*(.+?)\*\*/g);
        const body = parts.map((p, j) => (j % 2 ? <strong key={j}>{p}</strong> : p.replace(/\*/g, "")));
        return bullet ? <div className="as-li" key={i}>{body}</div> : <p key={i}>{body}</p>;
      })}
    </>
  );
}

function Bubble({ m, idx }) {
  return (
    <div className={`as-msg as-${m.role}`} data-testid={`assistant-msg-${m.role}-${idx}`}>
      {m.role === "assistant" && <img src="/docuanalytics-ai-logo.png?v=2" alt="" className="as-avatar" />}
      <div className="as-bubble"><RichText text={m.content} /></div>
    </div>
  );
}

function ProfilePicker({ onPick }) {
  return (
    <div className="as-profiles" data-testid="assistant-profiles">
      {PROFILES.map((p) => (
        <button key={p.id} className="as-chip as-chip-lg" data-testid={`assistant-profile-${p.id.replace(" ", "-")}`} onClick={() => onPick(p)}>
          <p.icon size={16} /> {p.label}
        </button>
      ))}
    </div>
  );
}

function Suggestions({ items, onAsk, disabled }) {
  return (
    <div className="as-suggest" data-testid="assistant-suggestions">
      {items.map((q, i) => (
        <button key={q} className="as-chip" disabled={disabled} data-testid={`assistant-suggestion-${i}`} onClick={() => onAsk(q)}>{q}</button>
      ))}
    </div>
  );
}

function CtaBar({ utm, freeCredits }) {
  const go = (event, url) => { sendEvent(event, utm); window.location.href = ctaUrl(url, utm); };
  return (
    <div className="as-cta" data-testid="assistant-cta-bar">
      <button className="as-btn as-btn-primary" data-testid="assistant-cta-register" onClick={() => go("cta_register", "/?auth=register")}><UserPlus size={15} /> Registrati</button>
      <button className="as-btn" data-testid="assistant-cta-trial" onClick={() => go("cta_trial", "/#upload")}><Sparkles size={15} /> Prova gratis{freeCredits ? ` (${freeCredits} crediti)` : ""}</button>
      <button className="as-btn" data-testid="assistant-cta-pricing" onClick={() => go("cta_pricing", "/#prezzi")}><CreditCard size={15} /> Prezzi</button>
    </div>
  );
}

function Composer({ onSend, disabled, maxLen }) {
  const [text, setText] = useState("");
  const [hp, setHp] = useState("");
  const submit = (e) => { e.preventDefault(); const t = text.trim(); if (!t || disabled) return; onSend(t, hp); setText(""); };
  return (
    <form className="as-composer" onSubmit={submit} data-testid="assistant-composer">
      <input className="as-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
      <input className="as-input" data-testid="assistant-input" placeholder="Scrivi la tua domanda…" maxLength={maxLen}
        value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} />
      <button className="as-send" type="submit" disabled={disabled || !text.trim()} data-testid="assistant-send-btn" aria-label="Invia"><Send size={18} /></button>
    </form>
  );
}

export default function AssistantPage() {
  const [utm] = useState(getUtm);
  const [cfg, setCfg] = useState(null);
  const [profile, setProfile] = useState(() => sessionStorage.getItem("da_assistant_profile"));
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]"); } catch { return []; } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const endRef = useRef();

  useEffect(() => {
    document.title = "Assistente DocuAnalytics AI";
    axios.get(`${API}/config`).then(({ data }) => { setCfg(data); if (!data.available) setBlocked(true); }).catch(() => {});
    if (!sessionStorage.getItem("da_assistant_visit")) { sessionStorage.setItem("da_assistant_visit", "1"); sendEvent("visit", utm); }
  }, [utm]);

  useEffect(() => { sessionStorage.setItem(LOG_KEY, JSON.stringify(msgs)); endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, loading]);

  const ask = async (text, hp = "") => {
    setError("");
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/chat`, { session_id: getSid(), message: text, history, profile, website: hp, ...utm });
      setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      const st = e.response?.status;
      setError(e.response?.data?.detail || "Connessione non riuscita. Riprova tra poco.");
      if (st === 429 || st === 503) setBlocked(true);
    } finally { setLoading(false); }
  };

  const pickProfile = (p) => {
    setProfile(p.id); sessionStorage.setItem("da_assistant_profile", p.id);
    sendEvent("profile_select", utm);
    ask(`Sono ${p.id === "altro professionista" ? "un professionista" : `un ${p.id}`}. Come può aiutarmi DocuAnalytics?`);
  };

  const reset = () => { setMsgs([]); setProfile(null); setError(""); sessionStorage.removeItem("da_assistant_profile"); };
  const prof = PROFILES.find((p) => p.id === profile) || PROFILES[3];

  return (
    <div className="as-page" data-testid="assistant-page">
      <header className="as-header">
        <a href={ctaUrl("/", utm)} className="as-brand" data-testid="assistant-home-link">
          <ArrowLeft size={16} className="as-back" />
          <img src="/docuanalytics-ai-logo.png?v=2" alt="DocuAnalytics AI" />
          <span>Docu<b>Analytics</b> AI</span>
        </a>
        <span className="as-status" data-testid="assistant-status"><i className={blocked ? "off" : ""} /> <span className="as-status-label">{blocked ? "Non disponibile" : "Assistente online"}</span></span>
        {msgs.length > 0 && <button className="as-icon-btn" onClick={reset} data-testid="assistant-reset-btn" aria-label="Nuova conversazione"><RotateCcw size={16} /></button>}
      </header>

      <main className="as-chat" data-testid="assistant-chat">
        <div className="as-msg as-assistant as-welcome" data-testid="assistant-welcome">
          <img src="/docuanalytics-ai-logo.png?v=2" alt="" className="as-avatar" />
          <div className="as-bubble"><p>{WELCOME}</p></div>
        </div>
        {!profile && msgs.length === 0 && <ProfilePicker onPick={pickProfile} />}
        {msgs.map((m, i) => <Bubble key={i} m={m} idx={i} />)}
        {loading && <div className="as-typing" data-testid="assistant-loading"><Loader2 size={16} className="as-spin" /> Sto scrivendo…</div>}
        {error && <div className="as-error" data-testid="assistant-error">{error}</div>}
        {!loading && !blocked && (profile || msgs.length > 0) && msgs.length < 4 && <Suggestions items={prof.qs} onAsk={ask} disabled={loading} />}
        <div ref={endRef} />
      </main>

      <footer className="as-footer">
        {(msgs.length > 0 || blocked) && <CtaBar utm={utm} freeCredits={cfg?.free_credits} />}
        <Composer onSend={ask} disabled={loading || blocked} maxLen={cfg?.max_message_chars || 500} />
        <p className="as-disclaimer">Risposte generate da AI su informazioni ufficiali DocuAnalytics. Non inserire dati personali.</p>
      </footer>
    </div>
  );
}
