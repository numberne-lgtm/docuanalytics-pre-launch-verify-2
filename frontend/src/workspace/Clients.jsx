import { useEffect, useState } from "react";
import { ws, errMsg, fmtDate } from "./api";
import { Level } from "./RiskDashboard";
import { DocCard } from "./Documents";
import { DeadlineList } from "./Deadlines";

const TABS = [["overview", "Panoramica"], ["docs", "Documenti"], ["risks", "Rischi"], ["deadlines", "Scadenze"], ["activity", "Attività"]];
const REG = [["rea", "REA"], ["pec", "PEC"], ["registered_office", "Sede"], ["legal_form", "Forma giuridica"], ["share_capital", "Capitale sociale"]];

function NewClient({ onCreated }) {
  const [f, setF] = useState({ name: "", piva: "", cf: "" });
  const [err, setErr] = useState("");
  const go = (e) => { e.preventDefault(); setErr(""); ws.post("/clients", f).then((c) => { setF({ name: "", piva: "", cf: "" }); onCreated(c); }).catch((x) => setErr(errMsg(x))); };
  return (
    <form className="ws-dl-edit" onSubmit={go} data-testid="client-new-form">
      <input className="as-input" placeholder="Nome / ragione sociale" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="client-new-name" />
      <input className="as-input" placeholder="P.IVA" value={f.piva} onChange={(e) => setF({ ...f, piva: e.target.value })} data-testid="client-new-piva" />
      <input className="as-input" placeholder="Codice fiscale" value={f.cf} onChange={(e) => setF({ ...f, cf: e.target.value })} data-testid="client-new-cf" />
      <button className="as-btn as-btn-primary" data-testid="client-new-btn">Crea cliente</button>
      {err && <div className="ws-error" data-testid="client-new-error">{err}</div>}
    </form>
  );
}

export function ClientList({ onOpen, reloadKey, onChanged }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { ws.get("/clients").then((d) => setList(d.clients)).catch((e) => setErr(errMsg(e))); }, [reloadKey]);
  if (err) return <div className="ws-error">{err}</div>;
  return (
    <div data-testid="clients-view">
      <h2 className="ws-h2">Clienti</h2>
      <p className="ws-muted">I documenti vengono associati automaticamente solo se P.IVA o codice fiscale coincidono con un cliente esistente. Negli altri casi scegli tu da "Documenti".</p>
      <NewClient onCreated={(c) => { onChanged(); onOpen(c.client_id); }} />
      {!list ? <div className="ws-muted">Caricamento…</div> : list.length === 0 ? <p className="ws-muted">Nessun cliente.</p> : (
        <div className="ws-list">
          {list.map((c) => (
            <button key={c.client_id} className="ws-row" onClick={() => onOpen(c.client_id)} data-testid={`client-${c.client_id}`}>
              <Level level={c.risk_level} />
              <span className="ws-row-main"><b>{c.name}</b><span>{c.piva && `P.IVA ${c.piva} · `}{c.cf && `CF ${c.cf} · `}{c.documents} documenti</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Client360({ cid, onBack, onOpenDoc, reloadKey, onChanged }) {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("overview");
  const [err, setErr] = useState("");
  useEffect(() => { ws.get(`/clients/${cid}`).then(setD).catch((e) => setErr(errMsg(e))); }, [cid, reloadKey]);
  if (err) return <div className="ws-error">{err}</div>;
  if (!d) return <div className="ws-muted">Caricamento…</div>;
  const c = d.client, reg = c.registry || {};
  return (
    <div data-testid="client-360">
      <button className="ws-link" onClick={onBack} data-testid="client-back">← Tutti i clienti</button>
      <div className="ws-bar"><h2 className="ws-h2" data-testid="client-name">{c.name}</h2><Level level={d.risk_level} />
        <button className="as-btn" data-testid="client-delete" onClick={() => window.confirm("Eliminare la scheda cliente? Documenti e scadenze restano, senza associazione.") && ws.del(`/clients/${cid}`).then(() => { onChanged(); onBack(); }).catch((e) => setErr(errMsg(e)))}>Elimina scheda</button></div>
      <p className="ws-muted">{c.piva ? `P.IVA ${c.piva}` : "P.IVA non disponibile"} · {c.cf ? `CF ${c.cf}` : "CF non disponibile"}</p>
      <div className="ws-tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={`client-tab-${k}`}>{l}</button>)}</div>
      {tab === "overview" && (
        <div className="ws-kpis" data-testid="client-overview">
          <div className="ws-kpi"><b>{d.documents.length}</b><span>Documenti</span></div>
          <div className="ws-kpi kpi-red"><b>{d.risks.filter((r) => r.level === "error").length}</b><span>Criticità elevate</span></div>
          <div className="ws-kpi kpi-orange"><b>{d.to_verify.length}</b><span>Documenti da verificare</span></div>
          <div className="ws-kpi"><b>{d.deadlines.length}</b><span>Scadenze</span></div>
          {REG.filter(([k]) => reg[k]).map(([k, l]) => <div className="ws-kpi ws-kpi-text" key={k}><span>{l}</span><b>{reg[k]}</b></div>)}
          {(reg.legal_representatives || []).length > 0 && <div className="ws-kpi ws-kpi-text"><span>Amministratori / rappresentanti</span><b>{reg.legal_representatives.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join(", ")}</b></div>}
        </div>
      )}
      {tab === "docs" && d.documents.map((x) => <DocCard key={x.analysis_id} d={x} onOpen={onOpenDoc} onChanged={onChanged} />)}
      {tab === "risks" && (d.risks.length ? d.risks.map((r, i) => (
        <button key={i} className="ws-row" onClick={() => onOpenDoc(r.analysis_id)} data-testid={`client-risk-${i}`}>
          <Level level={r.level === "error" ? "high" : "medium"} /><span className="ws-row-main"><b>{r.doc_type || r.filename}</b><span>{r.message}</span></span>
        </button>)) : <p className="ws-muted">Nessuna anomalia rilevata.</p>)}
      {tab === "deadlines" && <DeadlineList items={d.deadlines} onChanged={onChanged} />}
      {tab === "activity" && d.activity.map((a, i) => <div key={i} className="ws-act"><span className="ws-muted">{fmtDate(a.at)}</span> {a.text}</div>)}
    </div>
  );
}
