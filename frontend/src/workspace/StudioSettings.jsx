import { useEffect, useState } from "react";
import axios from "axios";
import { Upload, Trash2 } from "lucide-react";
import { ws, errMsg } from "./api";

const FIELDS = [["name", "Nome dello studio"], ["address", "Indirizzo"], ["phone", "Telefono"], ["email", "Email"], ["website", "Sito web"]];
const BASE = `${process.env.REACT_APP_BACKEND_URL}/api/workspace`;
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("da_token")}` });

function LogoBox({ has, onChange }) {
  const [src, setSrc] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!has) { setSrc(""); return undefined; }
    let url = "";
    axios.get(`${BASE}/studio/logo`, { responseType: "blob", headers: auth() }).then(({ data }) => { url = URL.createObjectURL(data); setSrc(url); }).catch(() => setSrc(""));
    return () => url && URL.revokeObjectURL(url);
  }, [has]);
  const upload = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 1000000) { setErr("Il logo deve pesare al massimo 1 MB."); return; }
    const fd = new FormData(); fd.append("file", f);
    setBusy(true); setErr("");
    axios.post(`${BASE}/studio/logo`, fd, { headers: auth() }).then(() => onChange(true)).catch((x) => setErr(errMsg(x))).finally(() => setBusy(false));
  };
  const remove = () => window.confirm("Rimuovere il logo dalla firma?") && ws.del("/studio/logo").then(() => onChange(false)).catch((x) => setErr(errMsg(x)));
  return (
    <div className="ws-logo-box" data-testid="studio-logo">
      {src ? <img src={src} alt="Logo dello studio" className="ws-logo-img" data-testid="studio-logo-img" /> : <span className="ws-muted">Nessun logo</span>}
      <label className="as-btn ws-btn-icon" data-testid="studio-logo-upload-label">
        <Upload size={14} /> {busy ? "Caricamento…" : has ? "Cambia logo" : "Carica logo (PNG/JPG, max 1 MB)"}
        <input type="file" accept="image/png,image/jpeg" hidden onChange={upload} data-testid="studio-logo-input" />
      </label>
      {has && <button className="as-btn ws-btn-icon" onClick={remove} data-testid="studio-logo-remove"><Trash2 size={14} /> Rimuovi</button>}
      {err && <div className="ws-error" data-testid="studio-logo-error">{err}</div>}
    </div>
  );
}

export default function StudioSettings() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    ws.get("/studio").then((d) => live && setF(d)).catch((e) => live && setErr(errMsg(e)));
    return () => { live = false; };
  }, []);
  if (!f) return err ? <div className="ws-error">{err}</div> : null;
  const save = (e) => { e.preventDefault(); setMsg(""); setErr(""); ws.put("/studio", f).then((r) => { setF(r); setMsg("Firma salvata."); }).catch((x) => setErr(errMsg(x))); };
  return (
    <section className="ws-card ws-cal-export" data-testid="studio-settings">
      <h3 className="ws-h3">Firma dello studio</h3>
      <p className="ws-muted">Compare in fondo ai report e agli avvisi di scadenza inviati ai clienti.</p>
      <LogoBox has={f.has_logo} onChange={(has) => setF({ ...f, has_logo: has })} />
      <form className="ws-studio-form" onSubmit={save}>
        {FIELDS.map(([k, l]) => (
          <input key={k} className="as-input" placeholder={l} aria-label={l} value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`studio-${k}`} />
        ))}
        <button className="as-btn as-btn-primary" data-testid="studio-save">Salva firma</button>
      </form>
      {msg && <p className="ws-ok" data-testid="studio-msg">{msg}</p>}
      {err && <div className="ws-error" data-testid="studio-error">{err}</div>}
    </section>
  );
}
