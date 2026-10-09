import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { LogOut, Search, ShieldAlert, FileClock, Trash2, FlaskConical } from "lucide-react";
import { Login } from "./assistant/AdminAssistant";
import "./assistant/assistant.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin/privacy`;
const TOKEN_KEY = "da_admin_privacy_token";

const useApi = (token) => useCallback((method, path, data) =>
  axios({ method, url: `${API}${path}`, data, headers: { "X-Admin-Token": token } }).then((r) => r.data), [token]);

const errMsg = (e) => e.response?.data?.detail || "Errore di rete.";

function Lookup({ call }) {
  const [email, setEmail] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const go = (e) => { e.preventDefault(); setErr(""); call("post", "/lookup", { email }).then(setRes).catch((x) => setErr(errMsg(x))); };
  return (
    <section className="ad-card" data-testid="privacy-lookup">
      <h2><Search size={15} /> 1. Cerca account</h2>
      <form className="ad-row" onSubmit={go}>
        <input className="as-input" placeholder="Email dell'account" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="privacy-lookup-email" />
        <button className="as-btn as-btn-primary" data-testid="privacy-lookup-btn">Cerca</button>
      </form>
      {err && <div className="as-error ad-ml0">{err}</div>}
      {res && !res.found && <p className="ad-meta" data-testid="privacy-lookup-notfound">Nessun account trovato.</p>}
      {res?.found && (
        <div className="ad-meta" data-testid="privacy-lookup-result">
          <b>{res.email_masked}</b> · accesso {res.auth_provider} · creato {res.created_at?.slice(0, 10)} · abbonamenti attivi: <b>{res.active_subscriptions}</b>
          <div className="ad-tags">{Object.entries(res.counts).map(([k, v]) => <span key={k} className="ad-tag">{k}: {v}</span>)}</div>
        </div>
      )}
    </section>
  );
}

function RequestForm({ call, methods, onCreated }) {
  const [f, setF] = useState({ account_email: "", requester_email: "", identity_method: "email_from_account_address", identity_reference: "", attest: false });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const go = (e) => { e.preventDefault(); setErr(""); call("post", "/requests", f).then(() => { onCreated(); setF({ ...f, account_email: "", requester_email: "", identity_reference: "", attest: false }); }).catch((x) => setErr(errMsg(x))); };
  return (
    <section className="ad-card" data-testid="privacy-request-form">
      <h2><ShieldAlert size={15} /> 2. Registra richiesta e verifica identità</h2>
      <form className="ad-grid" onSubmit={go}>
        <input className="as-input" placeholder="Email dell'account" value={f.account_email} onChange={set("account_email")} data-testid="privacy-req-account-email" />
        <input className="as-input" placeholder="Email da cui è arrivata la richiesta" value={f.requester_email} onChange={set("requester_email")} data-testid="privacy-req-requester-email" />
        <select className="as-input" value={f.identity_method} onChange={set("identity_method")} data-testid="privacy-req-method">
          {Object.entries(methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="as-input" placeholder="Riferimento (es. email del 09/10 ore 10:12)" value={f.identity_reference} onChange={set("identity_reference")} data-testid="privacy-req-reference" />
        <label className="ad-check"><input type="checkbox" checked={f.attest} onChange={set("attest")} data-testid="privacy-req-attest" /> Confermo di aver verificato che il richiedente è il titolare dell'account.</label>
        <button className="as-btn as-btn-primary" data-testid="privacy-req-submit">Registra richiesta</button>
      </form>
      {err && <div className="as-error ad-ml0" data-testid="privacy-req-error">{err}</div>}
    </section>
  );
}

function ExecutePanel({ call, req, enabled, onDone }) {
  const [email, setEmail] = useState("");
  const [phrase, setPhrase] = useState("");
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const run = (dry_run) => { setErr(""); call("post", `/requests/${req.request_id}/execute`, { confirm_email: email, confirm_phrase: phrase, dry_run }).then((d) => { setOut(d); onDone(); }).catch((x) => setErr(errMsg(x))); };
  return (
    <div className="ad-exec" data-testid={`privacy-exec-${req.request_id}`}>
      <div className="ad-row">
        <input className="as-input" placeholder="Ridigita l'email dell'account" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="privacy-exec-email" />
        <input className="as-input" placeholder='Digita "ELIMINA"' value={phrase} onChange={(e) => setPhrase(e.target.value)} data-testid="privacy-exec-phrase" />
      </div>
      <div className="ad-row">
        <button className="as-btn" onClick={() => run(true)} data-testid="privacy-exec-dryrun"><FlaskConical size={14} /> Simula (nessuna cancellazione)</button>
        <button className="as-btn ad-danger" disabled={!enabled} onClick={() => run(false)} data-testid="privacy-exec-real"
          title={enabled ? "" : "Disabilitata in questo ambiente"}><Trash2 size={14} /> Cancella definitivamente</button>
      </div>
      {err && <div className="as-error ad-ml0" data-testid="privacy-exec-error">{err}</div>}
      {out && <pre className="ad-pre" data-testid="privacy-exec-result">{JSON.stringify(out, null, 2)}</pre>}
    </div>
  );
}

function Requests({ call, rows, enabled, reload }) {
  const [open, setOpen] = useState(null);
  return (
    <section className="ad-card" data-testid="privacy-requests">
      <h2><Trash2 size={15} /> 3. Esegui richiesta</h2>
      {rows.length === 0 && <p className="ad-meta">Nessuna richiesta registrata.</p>}
      {rows.map((r) => (
        <div key={r.request_id} className="ad-reqrow">
          <div className="ad-row">
            <span><b>{r.email_masked}</b> · {r.status} · {r.created_at?.slice(0, 16).replace("T", " ")} · {r.identity_method}</span>
            {r.status !== "completed" && <button className="as-btn" onClick={() => setOpen(open === r.request_id ? null : r.request_id)} data-testid="privacy-req-open">Procedi</button>}
          </div>
          {open === r.request_id && <ExecutePanel call={call} req={r} enabled={enabled} onDone={reload} />}
        </div>
      ))}
    </section>
  );
}

function Retention({ call, onRun }) {
  const [a, setA] = useState(24);
  const [i, setI] = useState(24);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const go = (e) => { e.preventDefault(); setErr(""); call("get", `/retention-simulation?analyses_months=${a}&inactive_months=${i}`).then((d) => { setRes(d); onRun(); }).catch((x) => setErr(errMsg(x))); };
  return (
    <section className="ad-card" data-testid="privacy-retention">
      <h2><FlaskConical size={15} /> Simulazione conservazione (nessuna cancellazione)</h2>
      <form className="ad-row" onSubmit={go}>
        <label className="ad-lbl">Storico analisi oltre (mesi)<input type="number" min={1} max={120} className="as-input" value={a} onChange={(e) => setA(e.target.value)} data-testid="privacy-ret-analyses" /></label>
        <label className="ad-lbl">Account inattivi da (mesi)<input type="number" min={1} max={120} className="as-input" value={i} onChange={(e) => setI(e.target.value)} data-testid="privacy-ret-inactive" /></label>
        <button className="as-btn as-btn-primary" data-testid="privacy-ret-run">Simula</button>
      </form>
      {err && <div className="as-error ad-ml0">{err}</div>}
      {res && <div className="ad-tags" data-testid="privacy-ret-result">
        <span className="ad-tag">Analisi oltre il periodo: {res.analyses_older_than_period} / {res.analyses_total}</span>
        <span className="ad-tag">Account registrati inattivi: {res.registered_accounts_inactive} / {res.registered_accounts_total}</span>
        <span className="ad-tag">Sessioni anonime inattive: {res.anonymous_sessions_inactive}</span>
      </div>}
    </section>
  );
}

function AuditLog({ rows }) {
  return (
    <section className="ad-card" data-testid="privacy-audit-log">
      <h2><FileClock size={15} /> Registro operazioni</h2>
      <div className="ad-scroll"><table className="ad-table"><thead><tr><th>Data</th><th>Azione</th><th>Admin</th><th>Richiesta</th></tr></thead>
        <tbody>{rows.map((l) => <tr key={l.log_id}><td>{l.at?.slice(0, 19).replace("T", " ")}</td><td>{l.action}</td><td>{l.admin}</td><td>{l.request_id?.slice(0, 8) || "—"}</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

export default function AdminPrivacy() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [cfg, setCfg] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const call = useApi(token);

  const reload = useCallback(() => {
    call("get", "/requests").then((d) => setReqs(d.requests)).catch(() => {});
    call("get", "/log").then((d) => setLog(d.log)).catch(() => {});
  }, [call]);

  useEffect(() => {
    document.title = "Admin · Privacy DocuAnalytics";
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex,nofollow"; document.head.appendChild(m);
    return () => m.remove();
  }, []);

  useEffect(() => {
    if (!token) return;
    call("get", "/config").then((d) => { setCfg(d); sessionStorage.setItem(TOKEN_KEY, token); setError(""); reload(); })
      .catch((e) => { setToken(""); sessionStorage.removeItem(TOKEN_KEY); setError(errMsg(e)); });
  }, [token, call, reload]);

  if (!token || !cfg) return <div className="ad-page"><Login onToken={setToken} error={error} title="Strumenti privacy" /></div>;

  return (
    <div className="ad-page" data-testid="admin-privacy-page">
      <header className="ad-head">
        <h1>Strumenti privacy</h1>
        <span className={`ad-badge ${cfg.deletion_enabled ? "on" : ""}`} data-testid="privacy-deletion-status">
          Cancellazione reale: {cfg.deletion_enabled ? "ATTIVA" : "disabilitata (solo simulazione)"}
        </span>
        <button className="as-icon-btn" onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setToken(""); setCfg(null); }} data-testid="privacy-logout-btn" aria-label="Esci"><LogOut size={16} /></button>
      </header>
      <Lookup call={call} />
      <RequestForm call={call} methods={cfg.identity_methods} onCreated={reload} />
      <Requests call={call} rows={reqs} enabled={cfg.deletion_enabled} reload={reload} />
      <Retention call={call} onRun={reload} />
      <AuditLog rows={log} />
    </div>
  );
}
