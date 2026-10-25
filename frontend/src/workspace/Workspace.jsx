import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { LayoutDashboard, Users, FileText, CalendarClock, X, Zap } from "lucide-react";
import { ws, errMsg, hasToken } from "./api";
import RiskDashboard, { Level } from "./RiskDashboard";
import Documents from "./Documents";
import Deadlines, { DeadlineList } from "./Deadlines";
import { ClientList, Client360 } from "./Clients";
import AuditView from "./AuditView";
import "../assistant/assistant.css";
import "./workspace.css";

const NAV = [["dashboard", "Dashboard", LayoutDashboard], ["clients", "Clienti", Users], ["documents", "Documenti", FileText], ["deadlines", "Scadenze", CalendarClock]];

function DocPanel({ aid, onClose, onOpenClient, reloadKey, onChanged }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { ws.get(`/documents/${aid}`).then(setD).catch((e) => setErr(errMsg(e))); }, [aid, reloadKey]);
  return (
    <div className="ws-panel" data-testid="doc-panel">
      <div className="ws-panel-in">
        <button className="ws-x" onClick={onClose} aria-label="Chiudi" data-testid="doc-panel-close"><X size={18} /></button>
        {err && <div className="ws-error">{err}</div>}
        {!d ? <div className="ws-muted">Caricamento…</div> : (
          <>
            <div className="ws-bar ws-panel-head"><h2 className="ws-h2">{d.doc_type || d.filename}</h2><Level level={d.risk_level} /></div>
            <p className="ws-muted">{d.filename}</p>
            <p>{d.summary}</p>
            {d.client_id ? <button className="ws-link" onClick={() => onOpenClient(d.client_id)} data-testid="doc-panel-client">Cliente: {d.client_name} →</button> : <p className="ws-muted">Nessun cliente associato (associalo da "Documenti").</p>}
            <h3 className="ws-h3">Controlli e red flag</h3>
            {d.audit.map((a, i) => <div key={i} className={`ws-finding lvl-${a.level}`}>{a.level === "error" ? "🔴" : a.level === "warning" ? "🟠" : "🟢"} {a.message}</div>)}
            <h3 className="ws-h3">Dati estratti</h3>
            {d.fields.length === 0 && <p className="ws-muted">Nessun dato estratto disponibile.</p>}
            <div className="ws-fields">{d.fields.map((f, i) => <div key={i}><span className="ws-muted">{f.label}</span><b>{String(f.value)}</b></div>)}</div>
            <h3 className="ws-h3">Scadenze del documento</h3>
            <DeadlineList items={d.deadlines} onChanged={onChanged} />
          </>
        )}
      </div>
    </div>
  );
}

export default function Workspace() {
  const [view, setView] = useState("dashboard");
  const [client, setClient] = useState(null);
  const [doc, setDoc] = useState(null);
  const [audit, setAudit] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  const [credits, setCredits] = useState(null);
  useEffect(() => {
    document.title = "Area di lavoro · DocuAnalytics AI";
    if (hasToken()) axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${localStorage.getItem("da_token")}` } })
      .then(({ data }) => setCredits(data.user.credits)).catch(() => {});
  }, []);

  if (!hasToken()) {
    return (
      <div className="App"><main className="wrap ws-page" data-testid="workspace-locked">
        <h1 className="ws-h1">Area di lavoro</h1>
        <p className="ws-muted">Clienti, Risk Dashboard, Scadenze e Confronto documenti sono riservati agli utenti registrati.</p>
        <a className="btn btn-primary" href="/?auth=register" data-testid="workspace-login">Accedi o registrati</a>
      </main></div>
    );
  }
  const go = (v) => { setView(v); setClient(null); setAudit(null); };
  const openClient = (cid) => { setDoc(null); setAudit(null); setView("clients"); setClient(cid); };
  return (
    <div className="App">
      <main className="wrap ws-page" data-testid="workspace-page">
        <div className="ws-top">
          <Link to="/" className="ws-link" data-testid="workspace-home">← DocuAnalytics AI</Link>
          <h1 className="ws-h1">Area di lavoro</h1>
          {credits != null && <span className="ws-credits" data-testid="workspace-credits"><Zap size={14} /> {credits} crediti</span>}
          <Link to="/#upload" className="btn btn-sm btn-primary" data-testid="workspace-analyze">Analizza documento</Link>
        </div>
        <nav className="ws-nav" data-testid="workspace-nav">
          {NAV.map(([k, l, Icon]) => <button key={k} className={view === k ? "on" : ""} onClick={() => go(k)} data-testid={`ws-nav-${k}`}><Icon size={15} /> {l}</button>)}
        </nav>
        {view === "dashboard" && <RiskDashboard onOpenDoc={setDoc} onOpenClient={openClient} reloadKey={reloadKey} />}
        {view === "clients" && (client ? <Client360 cid={client} onBack={() => setClient(null)} onOpenDoc={setDoc} reloadKey={reloadKey} onChanged={reload} />
          : <ClientList onOpen={setClient} reloadKey={reloadKey} onChanged={reload} />)}
        {view === "documents" && (audit ? <AuditView ids={audit} onBack={() => setAudit(null)} onCredits={setCredits} />
          : <Documents onOpenDoc={setDoc} onCompare={setAudit} reloadKey={reloadKey} onChanged={reload} />)}
        {view === "deadlines" && <Deadlines reloadKey={reloadKey} onChanged={reload} />}
        <p className="ws-disclaimer">DocuAnalytics evidenzia dati e possibili anomalie: non sostituisce il commercialista, l'avvocato o il notaio.</p>
      </main>
      {doc && <DocPanel aid={doc} onClose={() => setDoc(null)} onOpenClient={openClient} reloadKey={reloadKey} onChanged={reload} />}
    </div>
  );
}
