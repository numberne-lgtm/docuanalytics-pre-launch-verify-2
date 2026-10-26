import { useEffect, useState } from "react";
import { ws, errMsg } from "./api";

const fmt = (iso) => new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function ClientEmails({ cid, reloadKey }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { ws.get(`/clients/${cid}/emails`).then((d) => setList(d.emails)).catch((e) => setErr(errMsg(e))); }, [cid, reloadKey]);
  if (err) return <div className="ws-error">{err}</div>;
  if (!list) return <div className="ws-muted">Caricamento…</div>;
  return (
    <div data-testid="client-emails">
      <p className="ws-muted">Report e avvisi di scadenza inviati a questo cliente. "Inviata" significa accettata dal servizio email, non necessariamente letta.</p>
      {list.length === 0 ? <p className="ws-muted" data-testid="client-emails-empty">Nessun invio.</p> : list.map((x, i) => (
        <div key={i} className="ws-email-row" data-testid={`client-email-log-${i}`}>
          <span className={`ws-tag st-${x.status === "sent" ? "confirmed" : "to_verify"}`}>{x.status_label}</span>
          <span className="ws-row-main"><b>{x.kind}</b><span>{x.subject} · a {x.to}</span></span>
          <span className="ws-muted">{fmt(x.at)}</span>
        </div>
      ))}
    </div>
  );
}
