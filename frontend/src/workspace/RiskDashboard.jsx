import { useEffect, useState } from "react";
import { ws, errMsg, LEVEL, dueText } from "./api";

const KPIS = [["documents", "Documenti analizzati"], ["no_issues", "Senza criticità"], ["to_verify", "Da verificare"],
  ["high", "Criticità elevate"], ["upcoming", "Scadenze prossime (30 gg)"], ["overdue", "Scadenze superate"]];

export const Level = ({ level }) => {
  const l = LEVEL[level] || LEVEL.low;
  return <span className={`ws-level ${l.cls}`} data-testid={`level-${level}`}>{l.dot} {l.label}</span>;
};

export default function RiskDashboard({ onOpenDoc, onOpenClient, reloadKey }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { ws.get("/overview").then(setData).catch((e) => setErr(errMsg(e))); }, [reloadKey]);
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
      <h3 className="ws-h3">Priorità</h3>
      {data.priorities.length === 0 && <p className="ws-muted" data-testid="priorities-empty">Nessuna priorità: nessuna criticità o scadenza rilevata.</p>}
      <div className="ws-list" data-testid="priorities-list">
        {data.priorities.map((p, i) => (
          <button key={i} className="ws-row" data-testid={`priority-${i}`}
            onClick={() => (p.analysis_id ? onOpenDoc(p.analysis_id) : p.client_id && onOpenClient(p.client_id))}>
            <Level level={p.level} />
            <span className="ws-row-main"><b>{p.client_name || "Cliente non associato"}</b><span>{p.title} — {p.type === "deadline" ? `${p.detail}, ${dueText(p.days_left)}` : p.detail}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
