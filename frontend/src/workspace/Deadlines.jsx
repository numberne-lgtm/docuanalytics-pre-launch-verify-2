import { useEffect, useState } from "react";
import { ws, errMsg, fmtDate, dueText } from "./api";
import { Level } from "./RiskDashboard";

function Row({ d, onChanged }) {
  const [edit, setEdit] = useState(false);
  const [date, setDate] = useState(d.due_date || "");
  const [label, setLabel] = useState(d.label);
  const [err, setErr] = useState("");
  const run = (p) => { setErr(""); return p.then(() => { setEdit(false); onChanged(); }).catch((e) => setErr(errMsg(e))); };
  return (
    <div className="ws-dl" data-testid={`deadline-${d.reminder_id}`}>
      <div className="ws-dl-main">
        <Level level={d.priority} />
        <span><b>{d.label}</b> <span className="ws-muted">· {d.kind_label !== d.label && `${d.kind_label} · `} {d.due_date ? fmtDate(d.due_date) : `"${d.raw_date}"`} · {dueText(d.status === "to_verify" ? null : d.days_left)}</span></span>
        <span className={`ws-tag st-${d.status}`} data-testid={`deadline-status-${d.reminder_id}`}>{d.status === "to_verify" ? "DA VERIFICARE" : d.status === "detected" ? "Rilevata" : "Confermata"}</span>
      </div>
      <div className="ws-dl-actions">
        {d.status !== "confirmed" && <button className="as-btn" onClick={() => run(ws.post(`/deadlines/${d.reminder_id}/confirm`, { notify: true }))} data-testid={`deadline-confirm-${d.reminder_id}`}>Conferma + promemoria</button>}
        <button className="as-btn" onClick={() => setEdit(!edit)} data-testid={`deadline-edit-${d.reminder_id}`}>Modifica</button>
        <button className="as-btn" onClick={() => window.confirm("Eliminare questa scadenza?") && run(ws.del(`/deadlines/${d.reminder_id}`))} data-testid={`deadline-delete-${d.reminder_id}`}>Elimina</button>
      </div>
      {edit && (
        <div className="ws-dl-edit">
          <input className="as-input" value={label} onChange={(e) => setLabel(e.target.value)} data-testid="deadline-edit-label" />
          <input className="as-input" type="date" lang="it" value={date} onChange={(e) => setDate(e.target.value)} data-testid="deadline-edit-date" />
          <button className="as-btn as-btn-primary" onClick={() => run(ws.patch(`/deadlines/${d.reminder_id}`, { label, due_date: date || undefined }))} data-testid="deadline-edit-save">Salva</button>
        </div>
      )}
      {err && <div className="ws-error">{err}</div>}
    </div>
  );
}

export const DeadlineList = ({ items, onChanged }) => (
  items.length ? items.map((d) => <Row key={d.reminder_id} d={d} onChanged={onChanged} />) : <p className="ws-muted">Nessuna scadenza.</p>
);

const BUCKETS = [["overdue", "Scadute"], ["today", "Oggi"], ["next7", "Prossimi 7 giorni"], ["next30", "Prossimi 30 giorni"], ["to_verify", "Da verificare"], ["later", "Oltre 30 giorni"]];

function AddDeadline({ onChanged }) {
  const [f, setF] = useState({ label: "", due_date: "" });
  const [err, setErr] = useState("");
  const add = (e) => { e.preventDefault(); setErr(""); ws.post("/deadlines", f).then(() => { setF({ label: "", due_date: "" }); onChanged(); }).catch((x) => setErr(errMsg(x))); };
  return (
    <form className="ws-dl-edit" onSubmit={add} data-testid="deadline-add-form">
      <input className="as-input" placeholder="Nuova scadenza manuale" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} data-testid="deadline-add-label" />
      <input className="as-input" type="date" lang="it" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} data-testid="deadline-add-date" />
      <button className="as-btn as-btn-primary" data-testid="deadline-add-btn">Aggiungi</button>
      {err && <div className="ws-error">{err}</div>}
    </form>
  );
}

export default function Deadlines({ reloadKey, onChanged }) {
  const [b, setB] = useState(null);
  const [tab, setTab] = useState("next7");
  const [err, setErr] = useState("");
  useEffect(() => { ws.get("/deadlines").then((d) => setB(d.buckets)).catch((e) => setErr(errMsg(e))); }, [reloadKey]);
  if (err) return <div className="ws-error">{err}</div>;
  if (!b) return <div className="ws-muted">Caricamento…</div>;
  return (
    <div data-testid="deadlines-view">
      <h2 className="ws-h2">Scadenze</h2>
      <p className="ws-muted">Date rilevate automaticamente dai documenti analizzati e scadenze manuali. Le date incerte restano "DA VERIFICARE" finché non le confermi. I promemoria email partono solo per le scadenze confermate.</p>
      <div className="ws-tabs">
        {BUCKETS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={`deadline-tab-${k}`}>{l} ({b[k].length})</button>)}
      </div>
      <DeadlineList items={b[tab]} onChanged={onChanged} />
      <AddDeadline onChanged={onChanged} />
    </div>
  );
}
