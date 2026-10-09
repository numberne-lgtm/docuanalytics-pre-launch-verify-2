import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Lock, RefreshCw, LogOut, Eye, MessageSquare, UserPlus, UserCheck, Sparkles, CreditCard, Percent, Download, Copy, QrCode } from "lucide-react";
import "./assistant.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/assistant`;
const TOKEN_KEY = "da_admin_assistant_token";
const COLS = [["visit", "Visite"], ["message", "Messaggi"], ["cta_register", "Click Registrati"], ["cta_trial", "Prova gratis"], ["cta_pricing", "Prezzi"], ["signup_completed", "Registrazioni completate"]];

const QR_BASE = "https://docuanalytics.online/assistant";
const QR_CHANNELS = [["qr", "QR generico", "qr", "offline"], ["linkedin", "LinkedIn", "linkedin", "social"], ["facebook", "Facebook", "facebook", "social"],
  ["instagram", "Instagram", "instagram", "social"], ["brochure", "Brochure / stampa", "brochure", "print"], ["presentazione", "Presentazioni", "presentazione", "slide"]];

function QrKit() {
  const [copied, setCopied] = useState("");
  const copy = (id, url) => navigator.clipboard?.writeText(url).then(() => { setCopied(id); setTimeout(() => setCopied(""), 1500); });
  return (
    <section className="ad-card" data-testid="admin-qr-kit">
      <h2><QrCode size={16} /> QR code e link condivisibili</h2>
      <p className="ad-meta">Puntano a <b>{QR_BASE}</b>: funzioneranno dopo la pubblicazione su docuanalytics.online. Colori ufficiali (blu #2f6bff, angoli navy #0a1022 su bianco) con logo al centro. PNG 2600 px a 300 dpi per web, social e stampa; SVG vettoriale per tipografia.</p>
      <div className="ad-qr-grid">
        {QR_CHANNELS.map(([id, label, src, med]) => {
          const url = `${QR_BASE}?utm_source=${src}&utm_medium=${med}&utm_campaign=assistant_launch`;
          const file = `/assistant-qr/docuanalytics-assistant-${id}`;
          return (
            <div className="ad-qr" key={id} data-testid={`admin-qr-${id}`}>
              <img src={`${file}.png?v=3`} alt={`QR ${label}`} loading="lazy" />
              <b>{label}</b>
              <code title={url}>utm_source={src}</code>
              <div className="ad-qr-actions">
                <a className="as-btn" href={`${file}.png?v=3`} download={`docuanalytics-assistant-${id}.png`} data-testid={`admin-qr-${id}-png`}><Download size={13} /> PNG</a>
                <a className="as-btn" href={`${file}.svg?v=3`} download={`docuanalytics-assistant-${id}.svg`} data-testid={`admin-qr-${id}-svg`}><Download size={13} /> SVG</a>
                <button className="as-btn" onClick={() => copy(id, url)} data-testid={`admin-qr-${id}-copy`}><Copy size={13} /> {copied === id ? "Copiato" : "Link"}</button>
              </div>
            </div>
          );
        })}
      </div>
      <a className="ad-meta ad-link" href="/assistant-qr/links.txt" target="_blank" rel="noreferrer" data-testid="admin-qr-links-txt">Elenco completo dei link (links.txt)</a>
    </section>
  );
}

const rate = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

const groupBy = (rows, key) => {
  const out = {};
  rows.forEach((r) => { const k = r[key]; out[k] = out[k] || {}; out[k][r.event] = (out[k][r.event] || 0) + r.count; });
  return out;
};

export function Login({ onToken, error, title = "Statistiche assistente" }) {
  const [v, setV] = useState("");
  return (
    <form className="ad-login" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onToken(v.trim()); }} data-testid="admin-login-form">
      <Lock size={22} />
      <h1>{title}</h1>
      <p>Area riservata agli amministratori. Inserisci il token admin.</p>
      <input type="password" className="as-input" placeholder="Token admin" value={v} onChange={(e) => setV(e.target.value)} data-testid="admin-token-input" />
      <button className="as-btn as-btn-primary" type="submit" data-testid="admin-login-btn">Accedi</button>
      {error && <div className="as-error" data-testid="admin-login-error">{error}</div>}
    </form>
  );
}

function Kpis({ totals }) {
  const items = [[Eye, "Visite", totals.visit], [MessageSquare, "Messaggi", totals.message], [UserPlus, "Click Registrati", totals.cta_register],
    [Sparkles, "Click Prova gratis", totals.cta_trial], [CreditCard, "Click Prezzi", totals.cta_pricing], [UserCheck, "Registrazioni completate", totals.signup_completed], [Percent, "Conversione visite → registrazioni", rate(totals.signup_completed || 0, totals.visit || 0)]];
  return (
    <div className="ad-kpis">
      {items.map(([Icon, l, v]) => (
        <div className="ad-kpi" key={l} data-testid={`admin-kpi-${l.toLowerCase().replace(/\s+/g, "-")}`}>
          <Icon size={16} /><span>{l}</span><b>{v || 0}</b>
        </div>
      ))}
    </div>
  );
}

function StatsTable({ title, data, label, testid, sortDesc }) {
  const keys = Object.keys(data).sort((a, b) => (sortDesc ? b.localeCompare(a) : (data[b].visit || 0) - (data[a].visit || 0)));
  return (
    <section className="ad-card" data-testid={testid}>
      <h2>{title}</h2>
      <div className="ad-scroll">
        <table className="ad-table">
          <thead><tr><th>{label}</th>{COLS.map(([, l]) => <th key={l}>{l}</th>)}<th>Conv. visite → registrazioni</th></tr></thead>
          <tbody>
            {keys.length === 0 && <tr><td colSpan={COLS.length + 2}>Nessun dato nel periodo.</td></tr>}
            {keys.map((k) => (
              <tr key={k}><td>{k}</td>{COLS.map(([e]) => <td key={e}>{data[k][e] || 0}</td>)}<td>{rate(data[k].signup_completed || 0, data[k].visit || 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminAssistant() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    document.title = "Admin · Assistente DocuAnalytics";
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex,nofollow"; document.head.appendChild(m);
    return () => m.remove();
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true); setError("");
    axios.get(`${API}/stats`, { params: { days }, headers: { "X-Admin-Token": token } })
      .then(({ data }) => { setData(data); sessionStorage.setItem(TOKEN_KEY, token); })
      .catch((e) => { if (e.response?.status === 401 || e.response?.status === 503) { setData(null); setToken(""); sessionStorage.removeItem(TOKEN_KEY); } setError(e.response?.data?.detail || "Errore di caricamento."); })
      .finally(() => setLoading(false));
  }, [token, days, tick]);

  const rows = useMemo(() => data?.events || [], [data]);
  const totals = useMemo(() => rows.reduce((a, r) => ({ ...a, [r.event]: (a[r.event] || 0) + r.count }), {}), [rows]);

  if (!token) return <div className="ad-page"><Login onToken={setToken} error={error} /></div>;

  return (
    <div className="ad-page" data-testid="admin-assistant-page">
      <header className="ad-head">
        <h1>Conversioni assistente</h1>
        <select className="as-input ad-select" value={days} onChange={(e) => setDays(Number(e.target.value))} data-testid="admin-days-select">
          {[7, 30, 90].map((d) => <option key={d} value={d}>Ultimi {d} giorni</option>)}
        </select>
        <button className="as-icon-btn" onClick={() => setTick((n) => n + 1)} data-testid="admin-refresh-btn" aria-label="Aggiorna"><RefreshCw size={16} className={loading ? "as-spin" : ""} /></button>
        <button className="as-icon-btn" onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setToken(""); setData(null); }} data-testid="admin-logout-btn" aria-label="Esci"><LogOut size={16} /></button>
      </header>
      {data && (
        <>
          <p className="ad-meta" data-testid="admin-budget">Messaggi AI oggi: <b>{data.messages_today}</b> / {data.daily_budget} · dal {data.since}</p>
          <Kpis totals={totals} />
          <QrKit />
          <StatsTable title="Per canale (utm_source)" data={groupBy(rows, "utm_source")} label="Canale" testid="admin-table-source" />
          <StatsTable title="Per giorno" data={groupBy(rows, "date")} label="Giorno" testid="admin-table-day" sortDesc />
          <p className="ad-meta">Dati anonimi: nessun IP, nessun testo dei messaggi. "Registrazioni completate" conta solo account nuovi (creati da meno di 48 ore) di visitatori passati dall'assistente, una sola volta per account.</p>
        </>
      )}
    </div>
  );
}
