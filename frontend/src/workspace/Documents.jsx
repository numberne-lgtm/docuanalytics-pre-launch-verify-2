import { useEffect, useState } from "react";
import { ws, errMsg, fmtDate } from "./api";
import { Level } from "./RiskDashboard";

function Candidates({ aid, onDone }) {
  const [data, setData] = useState(null);
  const [clients, setClients] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    ws.get(`/documents/${aid}/candidates`).then(setData).catch((e) => setErr(errMsg(e)));
    ws.get("/clients").then((d) => setClients(d.clients)).catch(() => {});
  }, [aid]);
  const run = (p) => p.then(onDone).catch((e) => setErr(errMsg(e)));
  if (!data) return <div className="ws-muted">{err || "Caricamento…"}</div>;
  return (
    <div className="ws-cand" data-testid="doc-candidates">
      <p className="ws-muted">Soggetti rilevati nel documento. Scegli tu a quale cliente associarlo.</p>
      {data.subjects.length === 0 && <p className="ws-muted">Nessun soggetto identificabile.</p>}
      {data.subjects.map((s) => (
        <div key={s.index} className="ws-cand-row">
          <span><b>{s.name || "—"}</b> · {s.role} {s.piva && `· P.IVA ${s.piva}`} {s.cf && `· CF ${s.cf}`}</span>
          {s.match ? <button className="as-btn" data-testid={`cand-link-${s.index}`} onClick={() => run(ws.post(`/documents/${aid}/assign`, { client_id: s.match.client_id }))}>Associa a {s.match.name}</button>
            : <button className="as-btn" data-testid={`cand-create-${s.index}`} onClick={() => run(ws.post("/clients", { name: s.name || "Cliente", piva: s.piva, cf: s.cf, from_analysis_id: aid }))}>Crea cliente</button>}
        </div>
      ))}
      <div className="ws-cand-row">
        <select className="as-input" defaultValue="" data-testid="assign-select" onChange={(e) => e.target.value && run(ws.post(`/documents/${aid}/assign`, { client_id: e.target.value }))}>
          <option value="">Associa a un cliente esistente…</option>
          {clients.map((c) => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
        </select>
        {data.current_client_id && <button className="as-btn" data-testid="unassign-btn" onClick={() => run(ws.post(`/documents/${aid}/assign`, { client_id: null }))}>Rimuovi associazione</button>}
      </div>
      {err && <div className="ws-error">{err}</div>}
    </div>
  );
}

export function DocCard({ d, selectable, selected, onToggle, onOpen, onChanged }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ws-doc ${selected ? "sel" : ""}`} data-testid={`doc-${d.analysis_id}`}>
      <div className="ws-doc-head">
        {selectable && <input type="checkbox" checked={selected} onChange={onToggle} data-testid={`doc-select-${d.analysis_id}`} aria-label="Seleziona" />}
        <button className="ws-link" onClick={() => onOpen(d.analysis_id)} data-testid={`doc-open-${d.analysis_id}`}><b>{d.doc_type || d.filename}</b> <span className="ws-muted">{d.filename} · {fmtDate(d.created_at)}</span></button>
        <Level level={d.risk_level} />
      </div>
      <div className="ws-doc-meta">
        <span>{d.client_name ? `Cliente: ${d.client_name}${d.client_link === "auto" ? " (automatico)" : ""}` : "Nessun cliente associato"}</span>
        <button className="ws-link" onClick={() => setOpen(!open)} data-testid={`doc-assign-${d.analysis_id}`}>{open ? "Chiudi" : "Associa cliente"}</button>
      </div>
      {open && <Candidates aid={d.analysis_id} onDone={() => { setOpen(false); onChanged(); }} />}
    </div>
  );
}

export default function Documents({ onOpenDoc, onCompare, reloadKey, onChanged }) {
  const [docs, setDocs] = useState(null);
  const [sel, setSel] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => { ws.get("/documents").then((d) => setDocs(d.documents)).catch((e) => setErr(errMsg(e))); }, [reloadKey]);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 10 ? s : [...s, id]));
  if (err) return <div className="ws-error">{err}</div>;
  if (!docs) return <div className="ws-muted">Caricamento…</div>;
  return (
    <div data-testid="documents-view">
      <div className="ws-bar">
        <h2 className="ws-h2">Documenti</h2>
        <button className="btn btn-primary" disabled={sel.length < 2} onClick={() => onCompare(sel)} data-testid="compare-btn">Confronta documenti ({sel.length})</button>
      </div>
      <p className="ws-muted">Seleziona da 2 a 10 documenti per il Multi-Document Audit.</p>
      {docs.length === 0 && <p className="ws-muted">Nessun documento analizzato.</p>}
      {docs.map((d) => <DocCard key={d.analysis_id} d={d} selectable selected={sel.includes(d.analysis_id)} onToggle={() => toggle(d.analysis_id)} onOpen={onOpenDoc} onChanged={onChanged} />)}
    </div>
  );
}
