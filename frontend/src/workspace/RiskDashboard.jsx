import { useEffect, useState } from "react";
import { navigateRows, markActiveRow, selectRowWithMouse } from "./keyboard";
import PriorityQrPdf from "./PriorityQrPdf";
import { ws, errMsg, LEVEL, dueText } from "./api";

const KPIS = [["documents", "Documenti analizzati"], ["no_issues", "Senza criticità"], ["to_verify", "Da verificare"],
  ["high", "Criticità elevate"], ["upcoming", "Scadenze prossime (30 gg)"], ["overdue", "Scadenze superate"]];

export const Level = ({ level }) => {
  const l = LEVEL[level] || LEVEL.low;
  return <span className={`ws-level ${l.cls}`} data-testid={`level-${level}`}>{l.dot} {l.label}</span>;
};

export default function RiskDashboard({ onOpenDoc, onOpenClient, reloadKey, listRef }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { ws.get("/overview").then(setData).catch((e) => setErr(errMsg(e))); }, [reloadKey]);
  const [saving, setSaving] = useState({});
  const [readErr, setReadErr] = useState("");
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
  return (
    <div data-testid="risk-dashboard">
      <h2 className="ws-h2">Risk Dashboard</h2>
      <p className="ws-muted">Basata solo su red flag, controlli e scadenze rilevati nelle tue analisi. Non sostituisce la verifica del professionista.</p>
      <div className="ws-kpis">
        {KPIS.map(([k, l]) => (
          <div key={k} className={`ws-kpi ${k === "high" || k === "overdue" ? "kpi-red" : k === "to_verify" ? "kpi-orange" : ""}`} data-testid={`kpi-${k}`}>
            <b>{c[k]}</b><span>{l}</span>
          </div>
        ))}
      </div>
      {(c.unassigned > 0 || c.deadlines_to_verify > 0) && (
        <p className="ws-note" data-testid="risk-notes">{c.unassigned > 0 && `${c.unassigned} ${c.unassigned === 1 ? "documento" : "documenti"} senza cliente associato. `}{c.deadlines_to_verify > 0 && `${c.deadlines_to_verify} date da verificare.`}</p>
      )}
      <h3 className="ws-h3">Priorità ({data.priorities.length})</h3>
      {readErr && <p className="ws-error" role="alert">{readErr}</p>}
      {data.priorities.length === 0 && <p className="ws-muted" data-testid="priorities-empty">Nessuna priorità: nessuna criticità o scadenza rilevata.</p>}
      <div className="ws-list" data-testid="priorities-list" data-ws-nav-list ref={listRef} onKeyDown={navigateRows} onFocus={markActiveRow} onMouseDown={markActiveRow} onClick={selectRowWithMouse}>
        {data.priorities.map((p, i) => (
          <div key={`${p.type}:${p.type === "document" ? p.analysis_id : p.reminder_id}`} className="ws-priority-item" data-ws-nav-row data-ws-nav-key={`${p.type}:${p.type === "document" ? p.analysis_id : p.reminder_id}`}>
            <button className="ws-row ws-priority-open" data-testid={`priority-${i}`}
              data-ws-nav-target onClick={(event) => (p.analysis_id ? onOpenDoc(p.analysis_id, event.currentTarget) : p.client_id && onOpenClient(p.client_id))}>
              <span className="ws-priority-number" aria-label={`Posizione ${i + 1}`} style={{ minWidth: "2.5rem", textAlign: "center", fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>#{i + 1}</span>
              <Level level={p.level} />
              <span className="ws-row-main"><b>{p.client_name || "Cliente non associato"}</b><span>{p.title} — {p.type === "deadline" ? `${p.detail}, ${dueText(p.days_left)}` : p.detail}</span></span>
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
    </div>
  );
}
