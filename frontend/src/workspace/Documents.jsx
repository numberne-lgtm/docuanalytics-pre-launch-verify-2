import { useEffect, useRef, useState } from "react";
import { navigateRows, markActiveRow, selectRowWithMouse } from "./keyboard";
import { ws, errMsg, fmtDate } from "./api";
import { Level } from "./RiskDashboard";
import PriorityQrPdf from "./PriorityQrPdf";
import DocumentReviewControl, { reviewLabel } from "./DocumentReviewControl";
import { FileSearch, Users, Files, FileCheck2, CircleHelp } from "lucide-react";

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
  const [showShare, setShowShare] = useState(false);
  const associated = Boolean(d.client_id);
  const flagged = d.flags?.length || 0;
  return (
    <article className={`ws-doc ws-document-card ${["high", "medium", "low"].includes(d.risk_level) ? `ws-tone-${d.risk_level}` : ""} ${selected ? "sel" : ""}${highlighted ? " ws-doc-highlight" : ""}`}
      data-testid={`doc-${d.analysis_id}`} data-ws-nav-row data-ws-nav-key={d.analysis_id}>
      <header className="ws-document-header">
        <div className="ws-document-name">
          {selectable && <input type="checkbox" checked={selected} onChange={onToggle}
            data-testid={`doc-select-${d.analysis_id}`} aria-label={`Seleziona ${d.filename} per il confronto`} />}
          <button className="ws-document-title" onClick={(event) => onOpen(d.analysis_id, event.currentTarget)}
            data-testid={`doc-open-${d.analysis_id}`} aria-current={highlighted ? "true" : undefined}
            data-document-title={d.analysis_id} data-ws-nav-target title="Apri report e controlli del documento">
            <strong>{d.doc_type || "Documento"}</strong>
            <span>{d.filename} · {fmtDate(d.created_at)}</span>
          </button>
        </div>
        <div className="ws-document-risk">
          <span className="ws-document-meta-label">Rischio rilevato dall'AI</span>
          <Level level={d.risk_level} />
        </div>
      </header>
      <div className="ws-document-summary">
        <p><strong>Cliente:</strong> {d.client_name || "Non ancora associato"}</p>
        <p><strong>Controlli AI:</strong> {flagged ? `${flagged} segnalazioni da esaminare` : "Nessuna criticità rilevata"}</p>
      </div>
      <div className="ws-document-review-row">
        <div className="ws-document-review-context">
          <span className="ws-document-meta-label">Verifica del professionista</span>
          <span className="ws-muted">La valutazione AI non equivale al controllo umano.</span>
        </div>
        <DocumentReviewControl documentId={d.analysis_id} status={d.review_status} onChanged={onChanged} compact />
      </div>
      <div className="ws-document-actions" aria-label={`Azioni disponibili per ${d.filename}`}>
        <button type="button" className="as-btn as-btn-primary" onClick={(event) => onOpen(d.analysis_id, event.currentTarget)}
          data-testid={`doc-action-report-${d.analysis_id}`}>
          <FileSearch size={16} aria-hidden="true" /> Apri report e verifica
        </button>
        <button type="button" className="as-btn" aria-expanded={open}
          onClick={() => setOpen(value => !value)} data-testid={`doc-assign-${d.analysis_id}`}>
          <Users size={16} aria-hidden="true" /> {associated ? "Cambia cliente" : "Associa cliente"}
        </button>
        <button type="button" className="as-btn" onClick={() => setShowShare(value => !value)}
          aria-expanded={showShare} data-testid={`doc-share-${d.analysis_id}`}>
          <Files size={16} aria-hidden="true" /> {showShare ? "Nascondi PDF e QR" : "PDF e QR protetto"}
        </button>
      </div>
      {open && <Candidates aid={d.analysis_id} onCancel={() => setOpen(false)}
        onDone={() => { setOpen(false); onChanged(); }} />}
      {showShare && <div className="ws-document-share" data-testid={`doc-share-content-${d.analysis_id}`}>
        <p className="ws-muted">Puoi scaricare un PDF della scheda o aprire un collegamento protetto tramite QR. Per consultarlo serve l'accesso autorizzato.</p>
        <PriorityQrPdf kind="document" itemId={d.analysis_id}
          testId={`document-qrpdf-${d.analysis_id}`} expandedInitially />
      </div>}
    </article>
  );
}

export default function Documents({ highlightedId, listRef, onOpenDoc, onCompare, reloadKey, onChanged, query, onQueryChange, filter, onFilterChange }) {
  const [docs, setDocs] = useState(null);
  const [sel, setSel] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => { ws.get("/documents").then((d) => setDocs(d.documents)).catch((e) => setErr(errMsg(e))); }, [reloadKey]);
  const highlightedDoc = docs?.find((d) => d.analysis_id === highlightedId);
  const orderedDocs = highlightedDoc ? [highlightedDoc, ...docs.filter((d) => d.analysis_id !== highlightedId)] : docs;
  const visibleDocs = (orderedDocs || []).filter((d) => {
    const q = query.trim().toLocaleLowerCase("it");
    const matches = !q || [d.filename, d.doc_type, d.client_name, d.summary]
      .some((value) => String(value || "").toLocaleLowerCase("it").includes(q));
    const state = d.review_status || "to_review";
    const byFilter = filter === "all" || (filter === "pending" && state !== "verified")
      || (filter === "verified" && state === "verified")
      || (filter === "high" && d.risk_level === "high")
      || (filter === "unassigned" && !d.client_id);
    return matches && byFilter;
  });
  const focusId = visibleDocs?.[0]?.analysis_id;
  const firstFocusDone = useRef(false);
  useEffect(() => {
    // Focus on initial entry, not on each search/filter keystroke.
    if (!docs || firstFocusDone.current) return;
    firstFocusDone.current = true;
    const target = highlightedId
      ? [...(listRef.current?.querySelectorAll("[data-document-title]") || [])]
          .find(el => el.dataset.documentTitle === highlightedId)
      : listRef.current?.querySelector("[data-document-title]");
    target?.focus({ preventScroll: true });
  }, [docs, highlightedId, listRef]);

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 10 ? s : [...s, id]));
  if (err) return <div className="ws-error">{err}</div>;
  if (!docs) return <div className="ws-muted">Caricamento…</div>;
  return (
    <div data-testid="documents-view">
      <div className="ws-bar">
        <h2 className="ws-h2">Documenti</h2>
        <button className="btn btn-primary" disabled={sel.length < 2} onClick={() => onCompare(sel)} data-testid="compare-btn">Confronta documenti ({sel.length})</button>
      </div>
      <p className="ws-muted">Qui trovi tutti i documenti analizzati. Apri il report per controllare i risultati, registrare la tua valutazione e correggere eventuali dati estratti.</p>
      <div className="ws-documents-help" data-testid="documents-help">
        <span><FileSearch size={17} aria-hidden="true" /> <strong>Apri report e verifica</strong> per controllare anomalie, dati e scadenze.</span>
        <span><FileCheck2 size={17} aria-hidden="true" /> <strong>Stato verifica</strong> indica a che punto sei: non cambia il rischio AI.</span>
        <span><CircleHelp size={17} aria-hidden="true" /> <strong>Seleziona le caselle</strong> di 2–10 documenti per confrontarli.</span>
      </div>
      <div className="ws-searchbar" role="search" aria-label="Cerca documenti">
        <input className="as-input" type="search" value={query} onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Cerca documento, cliente o testo" aria-label="Cerca nell'archivio documenti" data-testid="documents-search" />
        <label className="ws-filter-label">Mostra
          <select className="as-input" value={filter} onChange={(e) => onFilterChange(e.target.value)} data-testid="documents-filter">
            <option value="all">Tutti</option>
            <option value="pending">Da gestire</option>
            <option value="verified">Verificati</option>
            <option value="high">Rischio alto</option>
            <option value="unassigned">Senza cliente</option>
          </select>
        </label>
      </div>
      <p className="ws-muted" role="status" data-testid="documents-count">{visibleDocs.length} documenti visualizzati su {docs.length}.</p>
      {docs.length === 0 && <p className="ws-muted">Nessun documento analizzato.</p>}
      {docs.length > 0 && visibleDocs.length === 0 && <p className="ws-muted">Nessun documento corrisponde alla ricerca o al filtro.</p>}
      {focusId && <p className="ws-muted">Usa ↑ e ↓ per spostarti tra i documenti e Invio per aprire la scheda.</p>}
      <div ref={listRef} data-ws-nav-list onKeyDown={navigateRows} onFocus={markActiveRow} onMouseDown={markActiveRow} onClick={selectRowWithMouse}>
        {visibleDocs.map((d) => <DocCard key={d.analysis_id} d={d} highlighted={d.analysis_id === highlightedId} selectable selected={sel.includes(d.analysis_id)} onToggle={() => toggle(d.analysis_id)} onOpen={onOpenDoc} onChanged={onChanged} />)}
      </div>
    </div>
  );
}
