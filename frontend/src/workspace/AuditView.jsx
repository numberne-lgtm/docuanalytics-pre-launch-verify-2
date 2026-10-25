import { useEffect, useState } from "react";
import { ws, errMsg } from "./api";

const SECTIONS = [["consistent", "Coerenze", "lv-low"], ["differences", "Differenze", "lv-medium"], ["anomalies", "Possibili anomalie", "lv-high"], ["to_verify", "Da verificare", "lv-medium"]];

const Sources = ({ values }) => (
  <ul className="ws-src">{(values || []).map((v, i) => <li key={i}><b>{v.ref}</b> ({v.filename}): {v.value || v.excerpt}</li>)}</ul>
);

export default function AuditView({ ids, auditId, onBack }) {
  const [credits, setCredits] = useState(null);
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const p = auditId ? ws.get(`/audits/${auditId}`) : ws.post("/audits", { analysis_ids: ids });
    p.then(setA).catch((e) => setErr(errMsg(e)));
  }, [ids, auditId]);
  const deep = () => {
    if (!window.confirm("L'analisi approfondita con AI costa 1 credito. Procedere?")) return;
    setBusy(true); setErr("");
    ws.post(`/audits/${a.audit_id}/deep`).then((r) => { setA({ ...a, deep: r.deep }); setCredits(r.credits); }).catch((e) => setErr(errMsg(e))).finally(() => setBusy(false));
  };
  if (err && !a) return <div className="ws-error" data-testid="audit-error">{err}</div>;
  if (!a) return <div className="ws-muted">Confronto in corso…</div>;
  const r = a.deterministic;
  return (
    <div data-testid="audit-view">
      <button className="ws-link" onClick={onBack} data-testid="audit-back">← Documenti</button>
      <h2 className="ws-h2">Multi-Document Audit</h2>
      <div className="ws-tags">{a.documents.map((d) => <span key={d.ref} className="ws-tag"><b>{d.ref}</b>: {d.doc_type || ""} {d.filename}</span>)}</div>
      <p className="ws-muted">{a.note} I risultati sono confronti tra dati estratti, non verità accertate.</p>
      {SECTIONS.map(([k, label, cls]) => (
        <section key={k} className="ws-card" data-testid={`audit-${k}`}>
          <h3 className="ws-h3"><span className={`ws-level ${cls}`}>{label}</span> ({r[k].length})</h3>
          {r[k].length === 0 && <p className="ws-muted">Nessun elemento.</p>}
          {r[k].map((x, i) => (
            <div key={i} className="ws-finding">
              <b>{x.type || x.field}</b>{x.note && <span className="ws-muted"> — {x.note}</span>}
              <Sources values={x.values} />
              {x.missing_in && <p className="ws-muted">Assente in: {x.missing_in.map((m) => m.ref).join(", ")}</p>}
            </div>
          ))}
        </section>
      ))}
      <section className="ws-card" data-testid="audit-deep">
        <h3 className="ws-h3">Analisi approfondita AI</h3>
        {!a.deep ? (
          <>
            <p className="ws-muted">Cerca modifiche tra versioni e contraddizioni nel testo. Costa 1 credito, solo se completata.</p>
            <button className="btn btn-primary" onClick={deep} disabled={busy} data-testid="audit-deep-btn">{busy ? "Analisi in corso…" : "Analisi approfondita (1 credito)"}</button>
          </>
        ) : (
          <>
            <p className="ws-muted">{a.deep.disclaimer}{credits != null && ` Crediti residui: ${credits}.`}</p>
            {a.deep.findings.length === 0 && <p className="ws-muted" data-testid="audit-deep-empty">Nessuna contraddizione rilevata dall'AI.</p>}
            {a.deep.findings.map((f, i) => <div key={i} className="ws-finding" data-testid={`audit-deep-${i}`}><b>{f.level}</b>: {f.description}<Sources values={f.sources} /></div>)}
          </>
        )}
        {err && <div className="ws-error">{err}</div>}
      </section>
    </div>
  );
}
