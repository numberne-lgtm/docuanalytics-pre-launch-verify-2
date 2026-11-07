import { useState } from "react";
import { Send } from "lucide-react";
import { ws, errMsg } from "./api";

const contactFields = [
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "pec", label: "PEC", type: "email", maxLength: 254 },
  { key: "phone", label: "Telefono", type: "tel", autoComplete: "tel", maxLength: 60 },
  { key: "contact_name", label: "Referente", type: "text", autoComplete: "name", maxLength: 120 },
];

export function ClientContacts({ c, onChanged }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const begin = () => {
    setErr("");
    setDraft(Object.fromEntries(contactFields.map(({ key }) => [key, c[key] || ""])));
  };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErr("");
    const changes = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value.trim()])
        .filter(([key, value]) => value !== (c[key] || ""))
    );
    try {
      if (Object.keys(changes).length) {
        await ws.patch(`/clients/${c.client_id}`, changes);
        onChanged();
      }
      setDraft(null);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ws-card" data-testid="client-email">
      <h3 className="ws-h3">Contatti</h3>
      {draft === null ? <>
        {contactFields.map(({ key, label }) => (
          <div className="ws-mail-row" key={key}>
            <b>{label}</b>
            <span data-testid={`client-${key}-value`}>{c[key] || <span className="ws-muted">—</span>}</span>
          </div>
        ))}
        <button className="ws-link" onClick={begin} data-testid="client-email-edit">Modifica contatti</button>
      </> : (
        <form className="ws-send-form" onSubmit={save}>
          {contactFields.map(({ key, label, ...inputProps }) => (
            <label key={key} className="ws-send-form">
              {label}
              <input className="as-input" {...inputProps} value={draft[key]} disabled={busy}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                data-testid={`client-${key}-input`} />
            </label>
          ))}
          <div className="ws-dl-actions">
            <button className="as-btn as-btn-primary" type="submit" disabled={busy} data-testid="client-email-save">
              {busy ? "Salvataggio…" : "Salva contatti"}
            </button>
            <button className="as-btn" type="button" disabled={busy} onClick={() => { setDraft(null); setErr(""); }}>Annulla</button>
          </div>
          {err && <div className="ws-error" role="alert" data-testid="client-email-error">{err}</div>}
        </form>
      )}
    </section>
  );
}

export function SendReport({ c, onSent }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(c.email || "");
  const [pec, setPec] = useState(c.pec || "");
  const [mode, setMode] = useState("email");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const useEmail = mode !== "pec";
  const usePec = mode !== "email";
  const send = async (event) => {
    event.preventDefault();
    const targets = [];
    if (useEmail) targets.push({ channel: "email", to: to.trim(), label: "Email" });
    if (usePec) targets.push({ channel: "pec", to: pec.trim(), label: "PEC" });
    if (targets.some((target) => !target.to)) return;
    if (targets.length === 2 && targets[0].to.toLowerCase() === targets[1].to.toLowerCase()) {
      setErr("Email e PEC coincidono. Scegli un solo destinatario.");
      return;
    }
    if (!window.confirm(`Inviare il report PDF a ${targets.map((target) => target.to).join(" e ")}?`)) return;
    setBusy(true);
    setErr("");
    setOk("");
    const sent = [];
    const failed = [];
    for (const target of targets) {
      try {
        const result = await ws.post(`/clients/${c.client_id}/report/send`, {
          to: target.to, channel: target.channel, message: msg || undefined,
        });
        sent.push(result.to);
      } catch (e) {
        failed.push({ ...target, reason: e?.response ? errMsg(e) : "Esito non confermato. Controlla lo storico prima di riprovare." });
      }
    }
    setBusy(false);
    if (sent.length) setOk(`Report spedito a ${sent.join(" e ")}.`);
    if (failed.length) {
      setErr(failed.map(({ label, reason }) => `${label}: ${reason}`).join(" "));
      if (failed.length === 1) setMode(failed[0].channel);
    } else {
      setOpen(false);
      setMsg("");
    }
    onSent();
  };
  return (
    <div className="ws-send" data-testid="client-report-send">
      {!open && <button className="as-btn ws-btn-icon" onClick={() => { setTo(c.email || ""); setPec(c.pec || ""); setMode(c.pec && !c.email ? "pec" : "email"); setOpen(true); setOk(""); setErr(""); }} data-testid="client-report-send-open"><Send size={14} /> Invia report</button>}
      {open && (
        <form className="ws-card ws-send-form" onSubmit={send} data-testid="client-report-send-form">
          <label className="ws-send-form">
            Destinazione
            <select className="as-input" value={mode} disabled={busy} onChange={(e) => setMode(e.target.value)}>
              <option value="email">Email</option>
              <option value="pec">Indirizzo PEC</option>
              <option value="both">Email e indirizzo PEC</option>
            </select>
          </label>
          {useEmail && <label className="ws-send-form">
            Email
            <input className="as-input" type="email" required disabled={busy} value={to} onChange={(e) => setTo(e.target.value)} placeholder="cliente@esempio.it" data-testid="client-report-send-to" />
          </label>}
          {usePec && <label className="ws-send-form">
            PEC
            <input className="as-input" type="email" required disabled={busy} value={pec} onChange={(e) => setPec(e.target.value)} placeholder="cliente@pec.esempio.it" />
          </label>}
          {usePec && <p className="ws-muted">Il report parte da un indirizzo email ordinario. La casella PEC può rifiutarlo e l’invio è privo di ricevuta PEC.</p>}
          <label className="ws-muted">Messaggio (facoltativo)</label>
          <textarea className="as-input" rows={4} maxLength={1500} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Gentile cliente, in allegato il riepilogo…" data-testid="client-report-send-message" />
          <p className="ws-muted">Il PDF in versione ridotta viene allegato. Le risposte del cliente arrivano al tuo indirizzo email.</p>
          <div className="ws-dl-actions">
            <button className="as-btn as-btn-primary" type="submit" disabled={busy || (useEmail && !to.trim()) || (usePec && !pec.trim())} data-testid="client-report-send-btn">{busy ? "Invio…" : "Invia"}</button>
            <button className="as-btn" type="button" disabled={busy} onClick={() => { setOpen(false); setErr(""); }} data-testid="client-report-send-cancel">Annulla</button>
          </div>
        </form>
      )}
      {c.last_report_sent && !ok && <p className="ws-muted" data-testid="client-report-last">Ultimo invio a {c.last_report_sent.to} il {c.last_report_sent.at.slice(0, 10).split("-").reverse().join("/")}</p>}
      {ok && <p className="ws-ok" data-testid="client-report-send-ok">{ok}</p>}
      {err && <div className="ws-error" data-testid="client-report-send-error">{err}</div>}
    </div>
  );
}
