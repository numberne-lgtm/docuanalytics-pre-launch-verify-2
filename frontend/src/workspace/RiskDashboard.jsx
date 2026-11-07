import { useEffect, useState } from "react";
import { navigateRows, markActiveRow, selectRowWithMouse } from "./keyboard";
import PriorityQrPdf from "./PriorityQrPdf";
import DocumentReviewControl, { reviewLabel } from "./DocumentReviewControl";
import { ws, errMsg, LEVEL, dueText } from "./api";

const KPIS = [["documents", "Documenti analizzati"], ["no_issues", "Senza criticità AI"], ["to_verify", "Da verificare (AI)"], ["review_pending", "Verifiche da completare"],
  ["high", "Criticità elevate"], ["upcoming", "Scadenze prossime (30 gg)"], ["overdue", "Scadenze superate"]];

export const Level = ({ level }) => {
  const l = LEVEL[level] || LEVEL.low;
  return <span className={`ws-level ${l.cls}`} data-testid={`level-${level}`}>{l.dot} {l.label}</span>;
};

export default function RiskDashboard({ onOpenDoc, onOpenClient, onGoDocuments, onGoDeadlines, onLocateDocument, highlightedId, onChanged, reloadKey, listRef }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { ws.get("/overview").then(setData).catch((e) => setErr(errMsg(e))); }, [reloadKey]);
  const [saving, setSaving] = useState({});
  const [readErr, setReadErr] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [requestedDoc, setRequestedDoc] = useState(null);
  useEffect(() => {
    if (!highlightedId) { setRequestedDoc(null); return; }
    let active = true;
    ws.get(`/documents/${highlightedId}`).then((doc) => {
      if (active) setRequestedDoc(doc);
    }).catch(() => { if (active) setRequestedDoc(null); });
    return () => { active = false; };
  }, [highlightedId, reloadKey]);
  const markRead = async (p) => {
    const itemId = p.type === "document" ? p.analysis_id : p.reminder_id;
    const key = `${p.type}:${itemId}`;
    if (!itemId || saving[key]) return;
    setSaving((prev) => ({ ...prev, [key]: true }));
    setReadErr("");
    try {
      await ws.put("/priorities/read-state", { type: p.type, item_id: itemId, is_read: !p.is_read });
      setData((prev) => prev ? ({ ...prev, priorities: prev.priorities.map((item) =>
        (item.type === p.type && (item.type === "document" ? item.analysis_id : item.reminder_id) === itemId)
          ? { ...item, is_read: !p.is_read } : item) }) : prev);
    } catch (e) { setReadErr(errMsg(e)); }
    finally { setSaving((prev) => ({ ...prev, [key]: false })); }
  };
  if (err) return <div className="ws-error" data-testid="risk-error">{err}</div>;
  if (!data) return <div className="ws-muted">Caricamento…</div>;
  const c = data.counts;
  const priorities = showAll ? data.priorities : data.priorities.filter(
    (p) => p.type !== "document" || p.review_status !== "verified"
  );
  const recent = data.recent_documents || [];
  const highlightedDoc = highlightedId
    ? (recent.find((d) => d.analysis_id === highlightedId) || (requestedDoc?.analysis_id === highlightedId ? requestedDoc : null))
    : null;
  const latest = highlightedDoc
    ? [highlightedDoc, ...recent.filter((d) => d.analysis_id !== highlightedId)].slice(0, 6)
    : recent;
  return (
    <div data-testid="risk-dashboard">
      <h2 className="ws-h2">Panoramica dello studio</h2>
      <p className="ws-muted">Documenti, attività da gestire e scadenze in un unico posto. I risultati automatici non sostituiscono la verifica professionale.</p>
      {highlightedDoc && (
        <section className="ws-new-analysis" data-testid="overview-new-analysis" aria-label="Documento appena analizzato">
          <div className="ws-new-analysis-text">
            <span className="ws-new-analysis-caption">✓ Documento appena analizzato</span>
            <strong>{highlightedDoc.doc_type || highlightedDoc.filename}</strong>
            <span>{highlightedDoc.filename} · {highlightedDoc.client_name || "Cliente non associato"}</span>
          </div>
          <Level level={highlightedDoc.risk_level} />
          <div className="ws-new-analysis-actions">
            <button type="button" className="as-btn as-btn-primary" onClick={(event) => onOpenDoc(highlightedDoc.analysis_id, event.currentTarget)} data-testid="overview-new-open">Apri report</button>
            <button type="button" className="as-btn" onClick={() => onLocateDocument(highlightedDoc.analysis_id)} data-testid="overview-new-to-documents">Mostra in Documenti</button>
          </div>
        </section>
      )}
      <div className="ws-overview-actions">
        <button className="as-btn" type="button" onClick={onGoDocuments} data-testid="overview-all-documents">Apri archivio documenti</button>
        <button className="as-btn" type="button" onClick={onGoDeadlines} data-testid="overview-all-deadlines">Gestisci scadenze</button>
      </div>
      <div className="ws-kpis">
        {KPIS.map(([k, l]) => (
          <div key={k} className={`ws-kpi ${k === "high" || k === "overdue" ? "kpi-red" : k === "to_verify" || k === "upcoming" ? "kpi-orange" : k === "no_issues" ? "kpi-green" : ""}`} data-testid={`kpi-${k}`}>
            <b>{c[k]}</b><span>{l}</span>
          </div>
        ))}
      </div>
      {(c.unassigned > 0 || c.deadlines_to_verify > 0) && (
        <p className="ws-note" data-testid="risk-notes">{c.unassigned > 0 && `${c.unassigned} ${c.unassigned === 1 ? "documento" : "documenti"} senza cliente associato. `}{c.deadlines_to_verify > 0 && `${c.deadlines_to_verify} date da verificare.`}</p>
      )}
      <div className="ws-bar ws-overview-priorities-heading">
        <h3 className="ws-h3">Da gestire ({priorities.length})</h3>
        <button className="ws-link" type="button" onClick={() => setShowAll((prev) => !prev)}
          aria-pressed={showAll} data-testid="overview-toggle-priorities">
          {showAll ? "Mostra da gestire" : "Mostra tutte le priorità"}
        </button>
      </div>
      <p className="ws-muted">Lettura, rischio AI e verifica del professionista sono informazioni distinte.</p>
      {readErr && <p className="ws-error" role="alert">{readErr}</p>}
      {priorities.length === 0 && <p className="ws-muted" data-testid="priorities-empty">Nessuna attività da gestire in questo elenco.</p>}
      <div className="ws-list" data-testid="priorities-list" data-ws-nav-list ref={listRef} onKeyDown={navigateRows} onFocus={markActiveRow} onMouseDown={markActiveRow} onClick={selectRowWithMouse}>
        {priorities.map((p, i) => (
          <div key={`${p.type}:${p.type === "document" ? p.analysis_id : p.reminder_id}`} className={`ws-priority-item ${["high", "medium", "low"].includes(p.level) ? `ws-tone-${p.level}` : ""}`} data-ws-nav-row data-ws-nav-key={`${p.type}:${p.type === "document" ? p.analysis_id : p.reminder_id}`}>
            <button className="ws-row ws-priority-open" data-testid={`priority-${i}`}
              data-ws-nav-target onClick={(event) => (p.analysis_id ? onOpenDoc(p.analysis_id, event.currentTarget) : p.client_id && onOpenClient(p.client_id))}>
              <span className="ws-priority-number" aria-label={`Posizione ${i + 1}`} style={{ minWidth: "2.5rem", textAlign: "center", fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>#{i + 1}</span>
              <Level level={p.level} />
              <span className="ws-row-main"><b>{p.client_name || "Cliente non associato"}</b>
                <span>{p.title} — {p.type === "deadline" ? `${p.detail}, ${dueText(p.days_left)}` : p.detail}</span>
                {p.type === "document" && <span>Verifica: {reviewLabel(p.review_status)}</span>}
              </span>
            </button>
            <PriorityQrPdf kind={p.type} itemId={p.type === "document" ? p.analysis_id : p.reminder_id} testId={`priority-qr-${i}`} />
            <button type="button" className="ws-priority-read" data-testid={`priority-read-${i}`}
              aria-label={p.is_read ? "Già letta: segna come non letta" : "Non letta: segna come già letta"}
              disabled={!!saving[`${p.type}:${p.type === "document" ? p.analysis_id : p.reminder_id}`]}
              onClick={() => markRead(p)}>
              {p.is_read ? "✓ Già letta" : "● Non letta"}
            </button>
          </div>
        ))}
      </div>
      <div className="ws-bar ws-overview-recent-heading">
        <h3 className="ws-h3">Ultimi documenti analizzati</h3>
        <button className="ws-link" type="button" onClick={onGoDocuments} data-testid="overview-view-all">Vedi tutti i documenti</button>
      </div>
      <p className="ws-muted">Qui compaiono anche i documenti senza criticità. La valutazione AI non equivale a verifica umana.</p>
      <div className="ws-list" data-testid="overview-recent-list"
        data-ws-nav-list onKeyDown={navigateRows} onFocus={markActiveRow}
        onMouseDown={markActiveRow} onClick={selectRowWithMouse}>
        {latest.length === 0 && <p className="ws-muted">Nessun documento analizzato.</p>}
        {latest.map((d) => (
          <div key={d.analysis_id} className={`ws-recent-item ws-tone-${d.risk_level || "low"}${d.analysis_id === highlightedId ? " ws-recent-highlight" : ""}`}
            data-testid={d.analysis_id === highlightedId ? "overview-recent-highlight" : undefined}
            data-ws-nav-row data-ws-nav-key={d.analysis_id}>
            <button className="ws-row ws-recent-open" type="button" data-ws-nav-target
              onClick={(event) => onOpenDoc(d.analysis_id, event.currentTarget)}
              data-testid={`recent-doc-${d.analysis_id}`}>
              <Level level={d.risk_level} />
              <span className="ws-row-main"><b>{d.doc_type || d.filename}</b>
                <span>{d.client_name || "Senza cliente"} · {d.filename}</span>
              </span>
            </button>
            <DocumentReviewControl documentId={d.analysis_id} status={d.review_status} onChanged={onChanged} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
