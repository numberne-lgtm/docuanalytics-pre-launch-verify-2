import { useEffect, useRef, useState } from "react";
import { ws } from "./api";
import { reviewLabel } from "./DocumentReviewControl";

const normalize = (text) => String(text || "").toLocaleLowerCase("it");
export default function WorkspaceSearch({ onDocument, onClient, onDeadlines, reloadKey }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  // Search only data belonging to the logged-in account, never remote public indexes.
  useEffect(() => {
    if (!query.trim() || data) return;
    let active = true;
    Promise.all([ws.get("/documents"), ws.get("/clients"), ws.get("/deadlines")])
      .then(([docs, clients, deadlines]) => {
        if (active) { setData({ docs: docs.documents || [], clients: clients.clients || [], deadlines: deadlines.deadlines || [] }); setError(""); }
      })
      .catch(() => { if (active) setError("Ricerca non disponibile. Riprova."); });
    return () => { active = false; };
  }, [query, data, reloadKey]);
  useEffect(() => { setData(null); }, [reloadKey]);
  const q = normalize(query.trim());
  const docs = (data?.docs || []).filter(d =>
    [d.doc_type, d.filename, d.client_name, d.summary].some(s => normalize(s).includes(q))).slice(0, 5);
  const clients = (data?.clients || []).filter(c =>
    [c.name, c.piva, c.cf].some(s => normalize(s).includes(q))).slice(0, 4);
  const deadlines = (data?.deadlines || []).filter(d =>
    [d.label, d.kind_label, d.raw_date].some(s => normalize(s).includes(q))).slice(0, 4);
  const done = (fn) => { setQuery(""); fn(); };
  return (
    <div className="ws-global-search" role="search" aria-label="Ricerca globale nell'Area di lavoro">
      <input ref={inputRef} type="search" className="as-input" value={query}
        aria-label="Cerca documenti, clienti e scadenze" aria-controls="ws-global-search-results"
        placeholder="Cerca documenti, clienti, scadenze…" data-testid="workspace-global-search"
        onChange={e => setQuery(e.target.value)} onKeyDown={e => {
          if (e.key === "Escape") { setQuery(""); inputRef.current?.blur(); }
        }} />
      {q && <div className="ws-search-results" id="ws-global-search-results" role="region"
        aria-label="Risultati ricerca" data-testid="workspace-search-results">
        {!data && !error && <p className="ws-muted">Ricerca in corso…</p>}
        {error && <p role="alert" className="ws-error">{error}</p>}
        {data && <>
          {docs.map(d => <button type="button" key={d.analysis_id} onClick={e =>
            done(() => onDocument(d.analysis_id, e.currentTarget))} className="ws-search-result">
            <span>Documento · {d.doc_type || d.filename}</span>
            <small>{d.client_name || "Senza cliente"} · {reviewLabel(d.review_status)}</small>
          </button>)}
          {clients.map(c => <button type="button" key={c.client_id} onClick={() =>
            done(() => onClient(c.client_id))} className="ws-search-result">
            <span>Cliente · {c.name}</span><small>{c.documents} documenti</small>
          </button>)}
          {deadlines.map(d => <button type="button" key={d.reminder_id} onClick={() =>
            done(onDeadlines)} className="ws-search-result">
            <span>Scadenza · {d.label}</span><small>{d.due_date || "Data da verificare"}</small>
          </button>)}
          {!docs.length && !clients.length && !deadlines.length && <p className="ws-muted">Nessun risultato.</p>}
        </>}
      </div>}
    </div>
  );
}
