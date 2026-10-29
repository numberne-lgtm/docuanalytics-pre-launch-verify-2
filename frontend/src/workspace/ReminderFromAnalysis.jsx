import { useState } from "react";
import { BellPlus, X, Check } from "lucide-react";
import { ws, errMsg, fmtDate } from "./api";
import DateField from "./DateField";
import "./workspace.css";

const toIso = (s) => {
  const m = String(s || "").match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 10) : "";
};

function Editor({ init, onSave, saving }) {
  const [label, setLabel] = useState(init.label);
  const [date, setDate] = useState(init.date);
  const [note, setNote] = useState(init.note || "");
  const save = () => {
    if (!label.trim()) return;
    if (!window.confirm(`Salvare il promemoria "${label.trim()}" del ${date.split("-").reverse().join("/")}?`)) return;
    onSave({ label: label.trim(), due_date: date, note });
  };
  return (
    <div className="ws-rem-edit" data-testid={`reminder-editor-${init.key}`}>
      {init.uncertain && <p className="ws-hint" data-testid="reminder-uncertain">{init.date ? "Data da verificare: controllala sul documento prima di salvare." : "Data non rilevata con certezza: inseriscila manualmente."}</p>}
      <input className="as-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Titolo" maxLength={200} data-testid="reminder-label" />
      <DateField value={date} onChange={setDate} testid="reminder-date" />
      <textarea className="as-input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Descrizione (facoltativa)" data-testid="reminder-note" />
      <button className="as-btn as-btn-primary" disabled={saving || !date || !label.trim()} onClick={save} data-testid="reminder-save">
        {saving ? "Salvataggio…" : "Conferma e salva"}
      </button>
    </div>
  );
}

export default function ReminderFromAnalysis({ analysisId, guess, docType, loggedIn, notify }) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const load = () => ws.post("/sync").then(() => ws.get(`/documents/${analysisId}`)).then(setDoc);
  const start = () => {
    if (!loggedIn) { notify("Registrati o accedi per creare promemoria nell'Area di lavoro."); return; }
    setOpen(true); setErr(""); setDone(""); setDoc(null);
    load().catch((e) => setErr(errMsg(e)));
  };
  const run = (p) => { setSaving(true); setErr(""); p.then(() => { setDone("Promemoria salvato nell'Area di lavoro › Scadenze."); notify("Promemoria creato"); return load(); }).catch((e) => setErr(errMsg(e))).finally(() => setSaving(false)); };
  const confirmExisting = (d) => (v) => run(ws.patch(`/deadlines/${d.reminder_id}`, v).then(() => ws.post(`/deadlines/${d.reminder_id}/confirm`, { notify: true })));
  const createNew = (v) => run(ws.post("/deadlines", { ...v, analysis_id: analysisId, client_id: doc?.client_id || undefined }));

  const dls = doc?.deadlines || [];
  const pending = dls.filter((d) => d.status !== "confirmed");
  const confirmed = dls.filter((d) => d.status === "confirmed");
  return (
    <>
      <button className="btn btn-sm btn-ghost" onClick={start} data-testid="create-reminder-btn"><BellPlus size={14} /> Crea promemoria</button>
      {open && (
        <div className="ws-panel" onClick={() => setOpen(false)}>
          <div className="ws-panel-in ws-rem-panel" onClick={(e) => e.stopPropagation()} data-testid="reminder-modal">
            <div className="ws-bar"><h3 className="ws-h3">Crea promemoria</h3>
              <button className="ws-link" onClick={() => setOpen(false)} aria-label="Chiudi" data-testid="reminder-close"><X size={18} /></button></div>
            {!doc && !err && <p className="ws-muted">Caricamento…</p>}
            {doc && <>
              <p className="ws-muted">Documento: {doc.doc_type || ""} {doc.filename}{doc.client_name ? ` · ${doc.client_name}` : ""}. Nulla viene salvato senza la tua conferma.</p>
              {confirmed.map((d) => (
                <p key={d.reminder_id} className="ws-ok" data-testid={`reminder-existing-${d.reminder_id}`}><Check size={14} /> Già presente: {d.label} — {fmtDate(d.due_date)}</p>
              ))}
              {pending.map((d) => (
                <Editor key={d.reminder_id} saving={saving} onSave={confirmExisting(d)}
                  init={{ key: d.reminder_id, label: d.label, date: d.due_date || "", note: d.note, uncertain: d.status === "to_verify" || !d.due_date }} />
              ))}
              {pending.length === 0 && (
                <Editor key="new" saving={saving} onSave={createNew}
                  init={{ key: "new", label: guess?.label || `Scadenza ${docType || "documento"}`, date: toIso(guess?.due), uncertain: !toIso(guess?.due) }} />
              )}
            </>}
            {done && <p className="ws-ok" data-testid="reminder-done">{done}</p>}
            {err && <div className="ws-error" data-testid="reminder-error">{err}</div>}
          </div>
        </div>
      )}
    </>
  );
}
