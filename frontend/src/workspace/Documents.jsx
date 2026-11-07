import { useEffect, useState } from "react";
import { navigateRows, markActiveRow, selectRowWithMouse } from "./keyboard";
import { ws, errMsg, fmtDate } from "./api";
import { Level } from "./RiskDashboard";
import PriorityQrPdf from "./PriorityQrPdf";

function clientActionError(error) {
  if (error?.response?.status === 401) return "Accedi di nuovo e riprova.";
  if (!error?.response) return "Controlla la connessione e riprova.";
  if (error.response.status >= 500 && !error.response.data?.detail) {
    return "Il servizio non ha risposto correttamente. Riprova tra poco.";
  }
  if (!error.response.data?.detail) return "La richiesta è stata rifiutata. Ricarica la pagina e riprova.";
  return errMsg(error);
}

function Candidates({ aid, onDone, onCancel }) {
  const [data, setData] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientsError, setClientsError] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    ws.get(`/documents/${aid}/candidates`).then(setData).catch((e) => setErr(`Impossibile aprire la scelta cliente. ${clientActionError(e)}`));
    ws.get("/clients").then((d) => setClients(d.clients)).catch((e) => setClientsError(`Impossibile caricare i clienti. ${clientActionError(e)}`));
  }, [aid]);
  const run = async (save) => {
    setSaving(true);
    setErr("");
    try {
      await save();
      onDone();
    } catch (e) {
      setErr(`Salvataggio non confermato. ${clientActionError(e)}`);
      setSaving(false);
    }
  };
  if (!data) return (
    <div className="ws-cand">
      {err ? <div className="ws-error" role="alert">{err}</div> : <div className="ws-muted">Caricamento…</div>}
      <button className="as-btn" onClick={onCancel}>Annulla</button>
    </div>
  );
  return (
    <div className="ws-cand" data-testid="doc-candidates">
      <p className="ws-muted">Soggetti rilevati nel documento. Scegli tu a quale cliente associarlo.</p>
      {data.subjects.length === 0 && <p className="ws-muted">Nessun soggetto identificabile.</p>}
      {data.subjects.map((s) => (
        <div key={s.index} className="ws-cand-row">
          <span><b>{s.name || "—"}</b> · {s.role} {s.piva && `· P.IVA ${s.piva}`} {s.cf && `· CF ${s.cf}`}</span>
          {s.match ? <button className="as-btn" data-testid={`cand-link-${s.index}`} disabled={saving} onClick={() => run(() => ws.post(`/documents/${aid}/assign`, { client_id: s.match.client_id }))}>Associa a {s.match.name}</button>
            : <button className="as-btn" data-testid={`cand-create-${s.index}`} disabled={saving} onClick={() => run(() => ws.post("/clients", { name: s.name || "Cliente", piva: s.piva, cf: s.cf, from_analysis_id: aid }))}>Crea cliente</button>}
        </div>
      ))}
      <div className="ws-cand-row">
        <select className="as-input" value={selectedClient} disabled={saving} aria-label="Cliente esistente" data-testid="assign-select" onChange={(e) => setSelectedClient(e.target.value)}>
          <option value="">Scegli un cliente esistente…</option>
          {clients.map((c) => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
        </select>
        <button className="as-btn as-btn-primary" disabled={!selectedClient || saving} data-testid="assign-confirm" onClick={() => run(() => ws.post(`/documents/${aid}/assign`, { client_id: selectedClient }))}>
          {saving ? "Salvataggio…" : "Associa cliente"}
        </button>
        <button className="as-btn" disabled={saving} onClick={onCancel}>Annulla</button>
        {data.current_client_id && <button className="as-btn" data-testid="unassign-btn" disabled={saving} onClick={() => run(() => ws.post(`/documents/${aid}/assign`, { client_id: null }))}>Rimuovi associazione</button>}
      </div>
      {clientsError && <div className="ws-error" role="alert">{clientsError}</div>}
      {err && <div className="ws-error" role="alert">{err}</div>}
    </div>
  );
}

export function DocCard({ d, selectable, selected, highlighted, onToggle, onOpen, onChanged }) {
  const [open, setOpen] = useState(false);
  const associated = Boolean(d.client_id);
  return (
    <div className={`ws-doc ${["high", "medium", "low"].includes(d.risk_level) ? `ws-tone-${d.risk_level}` : ""} ${selected ? "sel" : ""}${highlighted ? " ws-doc-highlight" : ""}`} data-testid={`doc-${d.analysis_id}`} data-ws-nav-row data-ws-nav-key={d.analysis_id}>
      <div className="ws-doc-head">
        {selectable && <input type="checkbox" checked={selected} onChange={onToggle} data-testid={`doc-select-${d.analysis_id}`} aria-label="Seleziona" />}
        <button className="ws-link" onClick={(event) => onOpen(d.analysis_id, event.currentTarget)} data-testid={`doc-open-${d.analysis_id}`} aria-current={highlighted ? "true" : undefined} data-document-title={d.analysis_id} data-ws-nav-target><b>{d.doc_type || d.filename}</b> <span className="ws-muted">{d.filename} · {fmtDate(d.created_at)}</span></button>
        <Level level={d.risk_level} />
      </div>
      <div className="ws-doc-meta">
        <div>
          {d.client_name && <span>{`Cliente: ${d.client_name}${d.client_link === "auto" ? " (automatico)" : ""}`}</span>}
          {!open && <>
            {" "}
            <button className="ws-link" onClick={() => setOpen(true)} data-testid={`doc-assign-${d.analysis_id}`}>
              {associated ? "Cambia cliente" : "Scegli cliente"}
            </button>
          </>}
        </div>
        <span role="status" className={associated ? "ws-ok" : "ws-muted"}>
          {associated ? "Cliente associato" : "Nessun cliente associato"}
        </span>
      </div>
      {open && <Candidates aid={d.analysis_id} onCancel={() => setOpen(false)} onDone={() => { setOpen(false); onChanged(); }} />}
      <PriorityQrPdf kind="document" itemId={d.analysis_id} testId={`document-qrpdf-${d.analysis_id}`} />
    </div>
  );
}

export default function Documents({ highlightedId, listRef, onOpenDoc, onCompare, reloadKey, onChanged }) {
  const [docs, setDocs] = useState(null);
  const [sel, setSel] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => { ws.get("/documents").then((d) => setDocs(d.documents)).catch((e) => setErr(errMsg(e))); }, [reloadKey]);
  const highlightedDoc = docs?.find((d) => d.analysis_id === highlightedId);
  const orderedDocs = highlightedDoc ? [highlightedDoc, ...docs.filter((d) => d.analysis_id !== highlightedId)] : docs;
  const focusId = orderedDocs?.[0]?.analysis_id;
  useEffect(() => {
    if (focusId) listRef.current?.querySelector("[data-document-title]")?.focus();
  }, [focusId, listRef]);

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
      {focusId && <p className="ws-muted">Usa ↑ e ↓ per spostarti tra i documenti e Invio per aprire la scheda.</p>}
      <div ref={listRef} data-ws-nav-list onKeyDown={navigateRows} onFocus={markActiveRow} onMouseDown={markActiveRow} onClick={selectRowWithMouse}>
        {orderedDocs.map((d) => <DocCard key={d.analysis_id} d={d} highlighted={d.analysis_id === highlightedId} selectable selected={sel.includes(d.analysis_id)} onToggle={() => toggle(d.analysis_id)} onOpen={onOpenDoc} onChanged={onChanged} />)}
      </div>
    </div>
  );
}
