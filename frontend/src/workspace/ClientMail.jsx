import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { ws, errMsg } from "./api";

export function ClientEmail({ c, onChanged }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(c.email || "");
  const [err, setErr] = useState("");
  const save = () => { setErr(""); ws.patch(`/clients/${c.client_id}`, { email: v }).then(() => { setEdit(false); onChanged(); }).catch((e) => setErr(errMsg(e))); };
  return (
    <div className="ws-mail-row" data-testid="client-email">
      <Mail size={14} />
      {!edit ? <>
        <span data-testid="client-email-value">{c.email || <span className="ws-muted">Email cliente non inserita</span>}</span>
        <button className="ws-link" onClick={() => setEdit(true)} data-testid="client-email-edit">{c.email ? "Modifica" : "Aggiungi email"}</button>
      </> : <>
        <input className="as-input" type="email" value={v} onChange={(e) => setV(e.target.value)} placeholder="cliente@esempio.it" data-testid="client-email-input" />
        <button className="as-btn as-btn-primary" onClick={save} data-testid="client-email-save">Salva</button>
        <button className="as-btn" onClick={() => { setEdit(false); setV(c.email || ""); }}>Annulla</button>
      </>}
      {err && <div className="ws-error" data-testid="client-email-error">{err}</div>}
    </div>
  );
}

export function SendReport({ c, onSent }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(c.email || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const send = () => {
    if (!window.confirm(`Inviare il report PDF a ${to}?`)) return;
    setBusy(true); setErr(""); setOk("");
    ws.post(`/clients/${c.client_id}/report/send`, { to, message: msg || undefined })
      .then((r) => { setOk(`Report inviato a ${r.to}.`); setOpen(false); setMsg(""); onSent(); })
      .catch((e) => setErr(errMsg(e))).finally(() => setBusy(false));
  };
  return (
    <div className="ws-send" data-testid="client-report-send">
      {!open && <button className="as-btn ws-btn-icon" onClick={() => { setTo(c.email || ""); setOpen(true); setOk(""); }} data-testid="client-report-send-open"><Send size={14} /> Invia report via email</button>}
      {open && (
        <div className="ws-card ws-send-form" data-testid="client-report-send-form">
          <label className="ws-muted">Destinatario</label>
          <input className="as-input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="cliente@esempio.it" data-testid="client-report-send-to" />
          <label className="ws-muted">Messaggio (facoltativo)</label>
          <textarea className="as-input" rows={4} maxLength={1500} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Gentile cliente, in allegato il riepilogo…" data-testid="client-report-send-message" />
          <p className="ws-muted">Il PDF in versione ridotta viene allegato. Le risposte del cliente arrivano al tuo indirizzo email.</p>
          <div className="ws-dl-actions">
            <button className="as-btn as-btn-primary" onClick={send} disabled={busy || !to} data-testid="client-report-send-btn">{busy ? "Invio…" : "Invia"}</button>
            <button className="as-btn" onClick={() => setOpen(false)} data-testid="client-report-send-cancel">Annulla</button>
          </div>
        </div>
      )}
      {c.last_report_sent && !ok && <p className="ws-muted" data-testid="client-report-last">Ultimo invio a {c.last_report_sent.to} il {c.last_report_sent.at.slice(0, 10).split("-").reverse().join("/")}</p>}
      {ok && <p className="ws-ok" data-testid="client-report-send-ok">{ok}</p>}
      {err && <div className="ws-error" data-testid="client-report-send-error">{err}</div>}
    </div>
  );
}
