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

export function SendReport({ c, onDownload, downloading }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(c.email || "");
  const [pec, setPec] = useState(c.pec || "");
  const [mode, setMode] = useState("email");
  const [msg, setMsg] = useState("");
  const useEmail = mode !== "pec";
  const usePec = mode !== "email";

  const openDraft = (event) => {
    event.preventDefault();
    const address = event.nativeEvent.submitter?.value === "pec" ? pec.trim() : to.trim();
    if (!address) return;
    const subject = `Riepilogo documenti e scadenze — ${c.name.replace(/[\r\n]+/g, " ")}`;
    const body = msg.trim() || "Buongiorno, in allegato il riepilogo dei documenti e delle scadenze.\n\nCordiali saluti";
    window.location.href = `mailto:${encodeURIComponent(address).replace("%40", "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="ws-send" data-testid="client-report-send">
      {!open && <button className="as-btn ws-btn-icon" onClick={() => {
        setTo(c.email || "");
        setPec(c.pec || "");
        setMode(c.pec && !c.email ? "pec" : "email");
        setOpen(true);
      }} data-testid="client-report-send-open"><Send size={14} /> Invia report dallo studio</button>}
      {open && (
        <form className="ws-card ws-send-form" onSubmit={openDraft} data-testid="client-report-send-form">
          <label className="ws-send-form">
            Destinazione
            <select className="as-input" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="email">Email</option>
              <option value="pec">PEC</option>
              <option value="both">Email e PEC</option>
            </select>
          </label>
          {useEmail && <label className="ws-send-form">
            Email
            <input className="as-input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="cliente@esempio.it" data-testid="client-report-send-to" />
          </label>}
          {usePec && <label className="ws-send-form">
            PEC
            <input className="as-input" type="email" value={pec} onChange={(e) => setPec(e.target.value)} placeholder="cliente@pec.esempio.it" />
          </label>}
          <label className="ws-send-form">
            Messaggio (facoltativo)
            <textarea className="as-input" rows={4} maxLength={1500} value={msg} onChange={(e) => setMsg(e.target.value)} data-testid="client-report-send-message" />
          </label>
          <p className="ws-muted">Scarica il PDF, apri la bozza e allegalo nel tuo programma di posta. Prima di spedire, controlla che nel campo Da sia selezionata la casella dello studio.</p>
          {usePec && <p className="ws-muted">Per l’invio certificato usa la PEC dello studio. Se la usi dal web, apri la tua webmail PEC e allega lì il PDF.</p>}
          <div className="ws-dl-actions">
            <button className="as-btn" type="button" onClick={onDownload} disabled={downloading}>{downloading ? "Preparazione…" : "Scarica il PDF"}</button>
            {useEmail && <button className="as-btn as-btn-primary" type="submit" value="email" disabled={!to.trim()}>Apri bozza email</button>}
            {usePec && <button className="as-btn as-btn-primary" type="submit" value="pec" disabled={!pec.trim()}>Apri bozza per PEC</button>}
            <button className="as-btn" type="button" onClick={() => setOpen(false)} data-testid="client-report-send-cancel">Annulla</button>
          </div>
        </form>
      )}
      {c.last_report_sent && <p className="ws-muted" data-testid="client-report-last">Ultimo invio registrato a {c.last_report_sent.to} il {c.last_report_sent.at.slice(0, 10).split("-").reverse().join("/")}</p>}
    </div>
  );
}
