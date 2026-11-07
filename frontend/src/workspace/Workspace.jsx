import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { LayoutDashboard, Users, FileText, CalendarClock, X, Zap } from "lucide-react";
import { ws, errMsg, hasToken } from "./api";
import RiskDashboard, { Level } from "./RiskDashboard";
import { focusListRow } from "./keyboard";
import WorkspaceCopilot from "./WorkspaceCopilot";
import PriorityQrPdf from "./PriorityQrPdf";
import Documents from "./Documents";
import Deadlines, { DeadlineList } from "./Deadlines";
import { ClientList, Client360 } from "./Clients";
import AuditView from "./AuditView";
import "../assistant/assistant.css";
import "./workspace.css";

const NAV = [["dashboard", "Dashboard", LayoutDashboard], ["clients", "Clienti", Users], ["documents", "Documenti", FileText], ["deadlines", "Scadenze", CalendarClock]];

function DocPanel({ aid, onClose, onStep, onOpenClient, reloadKey, onChanged }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [deleting, setDeleting] = useState(false);
  const panelRef = useRef(null);
  const keyboardNavigation = Boolean(onStep);
  useEffect(() => { if (keyboardNavigation) panelRef.current?.focus({ preventScroll: true }); }, [keyboardNavigation]);
  const navigatePanel = (event) => {
    if (!onStep || deleting || !["ArrowDown", "ArrowUp"].includes(event.key) ||
        event.target.closest("input, textarea, select, [contenteditable='true']")) return;
    event.preventDefault();
    onStep(event.key === "ArrowDown" ? 1 : -1);
  };
  useEffect(() => { ws.get(`/documents/${aid}`).then(setD).catch((e) => setErr(errMsg(e))); }, [aid, reloadKey]);
  const deleteAnalysis = async () => {
    const label = d.filename || d.doc_type || "questo documento";
    if (!window.confirm(`Eliminare definitivamente l’analisi di ${label}? Verranno rimossi dati estratti, controlli, scadenze automatiche e confronti salvati che includono il documento. Le scadenze manuali restano senza il collegamento all’analisi.`)) return;
    setDeleting(true);
    setErr("");
    try {
      await ws.del(`/documents/${aid}`);
      onClose();
      onChanged();
    } catch (e) {
      setErr(errMsg(e));
      setDeleting(false);
    }
  };
  return (
    <div className="ws-panel" data-testid="doc-panel">
      <div className="ws-panel-in" ref={panelRef} tabIndex={-1} onKeyDown={navigatePanel}>
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
            <PriorityQrPdf kind="document" itemId={aid} expandedInitially testId="doc-panel-qrpdf" />
            <div className="ws-dl-actions">
              <button type="button" className="as-btn" data-testid="doc-delete-analysis" onClick={deleteAnalysis} disabled={deleting}>
                {deleting ? "Eliminazione…" : "Elimina analisi"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Workspace() {
  const { analysisId } = useParams();
  const documentId = /^[A-Za-z0-9-]{1,128}$/.test(analysisId || "") ? analysisId : null;
  return <WorkspaceView key={documentId || "dashboard"} documentId={documentId} />;
}

function WorkspaceView({ documentId }) {
  const [view, setView] = useState(documentId ? "documents" : "dashboard");
  const [client, setClient] = useState(null);
  const [doc, setDoc] = useState(null);
  const [audit, setAudit] = useState(null);
  const documentListRef = useRef(null);
  const priorityListRef = useRef(null);
  const priorityTrigger = useRef(null);
  const documentTrigger = useRef(null);
  const [focusClient, setFocusClient] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  const [credits, setCredits] = useState(null);
  useEffect(() => {
    document.title = "Area di lavoro · DocuAnalytics AI";
    if (documentId) window.scrollTo(0, 0);
    if (hasToken()) axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${localStorage.getItem("da_token")}` } })
      .then(({ data }) => setCredits(data.user.credits)).catch(() => {});
  }, [documentId]);

  if (!hasToken()) {
    return (
      <div className="App"><main className="wrap ws-page" data-testid="workspace-locked">
        <h1 className="ws-h1">Area di lavoro</h1>
        <p className="ws-muted">Clienti, Risk Dashboard, Scadenze e Confronto documenti sono riservati agli utenti registrati.</p>
        <a className="btn btn-primary" href={documentId ? `/?auth=login&return_to=${encodeURIComponent(`/area/documenti/${documentId}`)}` : "/?auth=register"} data-testid="workspace-login">Accedi o registrati</a>
      </main></div>
    );
  }
  const go = (v) => { setView(v); setClient(null); setAudit(null); setDoc(null); };
  const titles = () => [...(documentListRef.current?.querySelectorAll("[data-document-title]") || [])];
  const openDocument = (id, trigger) => {
    documentTrigger.current = trigger || null;
    priorityTrigger.current = view === "dashboard" ? trigger || null : null;
    setDoc(id);
  };
  const closeDocument = () => {
    const title = titles().find((button) => button.dataset.documentTitle === doc);
    const trigger = view === "dashboard" ? priorityTrigger.current : (title || documentTrigger.current);
    setDoc(null);
    // The trigger must be restored after the panel has been removed, not before.
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else if (view === "dashboard") focusListRow(priorityListRef.current);
      else focusListRow(documentListRef.current, doc);
    });
  };
  const stepDocument = (direction) => {
    const buttons = titles();
    const index = buttons.findIndex((title) => title.dataset.documentTitle === doc);
    const next = index >= 0 ? buttons[index + direction] : undefined;
    if (next) setDoc(next.dataset.documentTitle);
  };
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
        {view === "dashboard" && <RiskDashboard onOpenDoc={openDocument} onOpenClient={openClient} reloadKey={reloadKey} listRef={priorityListRef} />}
        {view === "clients" && (client ? <Client360 cid={client} onBack={() => { setFocusClient(client); setClient(null); }} onOpenDoc={openDocument} reloadKey={reloadKey} onChanged={reload} />
          : <ClientList focusClient={focusClient} onOpen={setClient} reloadKey={reloadKey} onChanged={reload} />)}
        {view === "documents" && (audit ? <AuditView ids={audit} onBack={() => setAudit(null)} onCredits={setCredits} />
          : <Documents listRef={documentListRef} highlightedId={documentId} onOpenDoc={openDocument} onCompare={setAudit} reloadKey={reloadKey} onChanged={reload} />)}
        {view === "deadlines" && <Deadlines reloadKey={reloadKey} onChanged={reload} />}
        <p className="ws-disclaimer">DocuAnalytics evidenzia dati e possibili anomalie: non sostituisce il commercialista, l'avvocato o il notaio.</p>
      </main>
      {doc && <DocPanel key={doc} aid={doc} onClose={closeDocument} onStep={view === "documents" ? stepDocument : undefined} onOpenClient={openClient} reloadKey={reloadKey} onChanged={reload} />}
      <WorkspaceCopilot analysisId={doc} clientId={client} />
    </div>
  );
}
