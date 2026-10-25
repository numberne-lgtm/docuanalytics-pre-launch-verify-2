import { useEffect, useState } from "react";
import { Download, Link2, RefreshCw, XCircle, Copy } from "lucide-react";
import { ws, errMsg, fmtDate, download } from "./api";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api/workspace`;

export default function CalendarExport({ path = "", title = "Esporta nel calendario", fileName = "docuanalytics-scadenze.ics", tid = "calendar" }) {
  const [feed, setFeed] = useState(null);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { ws.get(`${path}/calendar/feed`).then(setFeed).catch((e) => setErr(errMsg(e))); }, [path]);

  const dl = () => { setErr(""); download(`${path}/calendar.ics`, fileName).catch((e) => setErr(errMsg(e))); };
  const create = () => {
    if (feed?.active && !window.confirm("Il link attuale smetterà di funzionare. Generare un nuovo link?")) return;
    setErr(""); setMsg("");
    ws.post(`${path}/calendar/feed`).then((r) => { setUrl(`${BASE}/feed/${r.token}.ics`); setFeed({ active: true, created_at: new Date().toISOString() }); })
      .catch((e) => setErr(errMsg(e)));
  };
  const revoke = () => {
    if (!window.confirm("Disattivare il link? I calendari abbonati non riceveranno più aggiornamenti.")) return;
    ws.del(`${path}/calendar/feed`).then(() => { setFeed({ active: false }); setUrl(""); setMsg("Link disattivato."); }).catch((e) => setErr(errMsg(e)));
  };
  const copy = () => (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => setMsg("Link copiato."))
    .catch(() => setMsg("Copia non disponibile: seleziona il link e copialo manualmente."));

  return (
    <section className="ws-card ws-cal-export" data-testid={`${tid}-export`}>
      <h3 className="ws-h3">{title}</h3>
      <p className="ws-muted">Solo scadenze confermate e manuali. Funziona con Google Calendar, Outlook e Apple Calendar.</p>
      <button className="as-btn" onClick={dl} data-testid={`${tid}-download`}><Download size={14} /> Scarica file calendario (.ics)</button>
      <h4 className="ws-h4">Link di abbonamento privato</h4>
      <p className="ws-muted">Il calendario si aggiorna da solo. Chi possiede il link vede le tue scadenze: non condividerlo. Puoi rigenerarlo o disattivarlo in ogni momento.</p>
      <p className="ws-muted" data-testid={`${tid}-feed-status`}>{feed == null ? "…" : feed.active ? `Link attivo${feed.created_at ? ` dal ${fmtDate(feed.created_at)}` : ""}.` : "Nessun link attivo."}</p>
      {url && (
        <div className="ws-feed-url" data-testid={`${tid}-feed-url-box`}>
          <input className="as-input" readOnly value={url} onFocus={(e) => e.target.select()} data-testid={`${tid}-feed-url`} />
          <button className="as-btn" onClick={copy} data-testid={`${tid}-feed-copy`}><Copy size={14} /> Copia</button>
          <p className="ws-muted">Mostrato solo ora: copialo e incollalo in Google Calendar (Altri calendari › Da URL) o Outlook (Aggiungi calendario › Sottoscrivi dal Web).</p>
        </div>
      )}
      <div className="ws-dl-actions">
        <button className="as-btn" onClick={create} data-testid={`${tid}-feed-create`}>{feed?.active ? <><RefreshCw size={14} /> Genera nuovo link</> : <><Link2 size={14} /> Crea link di abbonamento</>}</button>
        {feed?.active && <button className="as-btn" onClick={revoke} data-testid={`${tid}-feed-revoke`}><XCircle size={14} /> Disattiva link</button>}
      </div>
      {msg && <p className="ws-ok" data-testid={`${tid}-msg`}>{msg}</p>}
      {err && <div className="ws-error" data-testid={`${tid}-error`}>{err}</div>}
    </section>
  );
}
