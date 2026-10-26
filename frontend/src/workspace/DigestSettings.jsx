import { useEffect, useState } from "react";
import { ws, errMsg } from "./api";

export default function DigestSettings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { ws.get("/settings").then(setS).catch((e) => setErr(errMsg(e))); }, []);
  const toggle = () => { setErr(""); setMsg(""); ws.put("/settings", { weekly_digest: !s.weekly_digest }).then(setS).catch((e) => setErr(errMsg(e))); };
  const preview = () => {
    setBusy(true); setErr(""); setMsg("");
    ws.post("/digest/preview").then((r) => setMsg(`Anteprima inviata a ${r.to}.`)).catch((e) => setErr(errMsg(e))).finally(() => setBusy(false));
  };
  if (!s) return err ? <div className="ws-error">{err}</div> : null;
  return (
    <section className="ws-card ws-cal-export" data-testid="digest-settings">
      <h3 className="ws-h3">Riepilogo settimanale</h3>
      <p className="ws-muted">Ogni lunedì alle 8:00 ricevi a {s.email} le scadenze della settimana, quelle superate e i documenti da verificare.</p>
      <label className="ws-switch" data-testid="digest-toggle-label">
        <input type="checkbox" checked={s.weekly_digest} onChange={toggle} data-testid="digest-toggle" />
        <span>{s.weekly_digest ? "Attivo" : "Disattivato"}</span>
      </label>
      <button className="as-btn" onClick={preview} disabled={busy} data-testid="digest-preview">{busy ? "Invio…" : "Invia un'anteprima ora"}</button>
      {msg && <p className="ws-ok" data-testid="digest-msg">{msg}</p>}
      {err && <div className="ws-error" data-testid="digest-error">{err}</div>}
    </section>
  );
}
