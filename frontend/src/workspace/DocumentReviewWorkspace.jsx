import { useEffect, useState } from "react";
import { ClipboardCheck, PencilLine, Save, Undo2, AlertCircle } from "lucide-react";
import { ws, errMsg, fmtDate } from "./api";

const OUTCOMES = [
  ["pending", "Esito non ancora registrato"],
  ["ok", "Nessuna anomalia dopo il controllo"],
  ["confirmed_issue", "Anomalia confermata"],
  ["false_positive", "Segnalazione AI non pertinente"],
  ["needs_info", "Servono documenti o informazioni"],
];

export const outcomeLabel = (value) =>
  OUTCOMES.find(([key]) => key === value)?.[1] || OUTCOMES[0][1];

export default function DocumentReviewWorkspace({ document, onChanged }) {
  const id = document.analysis_id;
  const [outcome, setOutcome] = useState(document.review_outcome || "pending");
  const [note, setNote] = useState(document.review_note || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [correctedValue, setCorrectedValue] = useState("");
  const [reason, setReason] = useState("");
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [fieldCorrections, setFieldCorrections] = useState(document.field_corrections || {});
  const [correctionHistory, setCorrectionHistory] = useState(document.field_correction_history || []);
  const [reviewHistory, setReviewHistory] = useState(document.review_details_history || []);
  useEffect(() => {
    setOutcome(document.review_outcome || "pending");
    setNote(document.review_note || "");
    setFieldCorrections(document.field_corrections || {});
    setCorrectionHistory(document.field_correction_history || []);
    setReviewHistory(document.review_details_history || []);
  }, [document]);

  const saveDetails = async () => {
    if (saving) return;
    setSaving(true); setMessage(""); setError("");
    try {
      await ws.put(`/documents/${id}/review-details`, { outcome, note });
      setMessage("Esito e note salvati. Il rischio AI originale rimane invariato.");
      onChanged?.();
    } catch (e) {
      setError(errMsg(e));
    } finally { setSaving(false); }
  };

  const startCorrection = (index, value) => {
    setEditingIndex(index);
    setCorrectedValue(String(value ?? ""));
    setReason("");
    setMessage(""); setError("");
  };
  const saveCorrection = async (index, value) => {
    if (correctionBusy || reason.trim().length < 3) return;
    setCorrectionBusy(true); setMessage(""); setError("");
    try {
      const response = await ws.put(`/documents/${id}/field-correction`, {
        index, corrected_value: value, reason: reason.trim()
      });
      setFieldCorrections(prev => {
        const next = { ...prev };
        if (response.correction) next[String(index)] = response.correction;
        else delete next[String(index)];
        return next;
      });
      setCorrectionHistory(prev => [...prev, { index, reason: reason.trim(), at: new Date().toISOString() }].slice(-20));
      setEditingIndex(null);
      setMessage(value === null ? "Correzione rimossa. Il valore AI originale è rimasto invariato." : "Correzione registrata con motivazione.");
      onChanged?.();
    } catch (e) { setError(errMsg(e)); }
    finally { setCorrectionBusy(false); }
  };

  const fields = Array.isArray(document.fields) ? document.fields : [];
  return (
    <section className="ws-review-workspace" data-testid="document-review-workspace" aria-label="Verifica e correzione del documento">
      <div className="ws-review-heading">
        <ClipboardCheck size={20} aria-hidden="true" />
        <div>
          <h3 className="ws-h3">Verifica professionale</h3>
          <p className="ws-muted">Controlla il documento originale e registra la tua valutazione. L'analisi AI non viene alterata.</p>
        </div>
      </div>
      <ol className="ws-review-steps">
        <li>Leggi il report e i controlli dell'AI.</li>
        <li>Confronta i dati con il documento originale e correggi eventuali valori.</li>
        <li>Registra l'esito e le note; solo dopo conferma lo stato «Verificato».</li>
      </ol>
      <div className="ws-review-form">
        <label>Esito del controllo
          <select className="as-input" value={outcome} onChange={e => setOutcome(e.target.value)}
            data-testid="review-outcome">
            {OUTCOMES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>Note del professionista
          <textarea className="as-input" rows={3} maxLength={2000}
            placeholder="Es. contratto verificato, manca un allegato, cliente da contattare…"
            value={note} onChange={e => setNote(e.target.value)} data-testid="review-note" />
        </label>
        <button type="button" className="as-btn as-btn-primary" onClick={saveDetails} disabled={saving} data-testid="review-details-save">
          <Save size={16} aria-hidden="true" /> {saving ? "Salvataggio…" : "Salva esito e note"}
        </button>
      </div>

      <div className="ws-review-section-head">
        <h3 className="ws-h3">Controllo dei dati estratti</h3>
        <p className="ws-muted">Correggi il valore interpretato dall'AI senza sostituire l'originale. Ogni correzione richiede un motivo ed è registrata.</p>
      </div>
      {fields.length === 0 && <p className="ws-muted">L'analisi non contiene campi estratti da correggere.</p>}
      <div className="ws-correction-list" data-testid="review-fields">
        {fields.map((field, index) => {
          const current = fieldCorrections[String(index)];
          const original = String(field?.value ?? "");
          return <div className="ws-correction-field" key={index} data-testid={`review-field-${index}`}>
            <div className="ws-correction-content">
              <strong>{String(field?.label || `Campo ${index + 1}`)}</strong>
              <span><small>Valore rilevato dall'AI</small>{original || "—"}</span>
              {current && <span className="ws-corrected-value"><small>Correzione del professionista</small><b>{current.value || "(vuoto)"}</b></span>}
            </div>
            <div className="ws-correction-actions">
              <button type="button" className="as-btn" onClick={() => startCorrection(index, current?.value ?? original)}
                data-testid={`review-correct-${index}`} aria-expanded={editingIndex === index}>
                <PencilLine size={15} aria-hidden="true" /> {current ? "Modifica correzione" : "Correggi dato"}
              </button>
            </div>
            {editingIndex === index && <div className="ws-correction-editor" data-testid={`review-editor-${index}`}>
              <label>Valore corretto
                <input className="as-input" maxLength={500} value={correctedValue}
                  onChange={e => setCorrectedValue(e.target.value)} data-testid={`review-value-${index}`} />
              </label>
              <label>Motivo della correzione (obbligatorio)
                <textarea className="as-input" maxLength={250} rows={2} value={reason}
                  onChange={e => setReason(e.target.value)} data-testid={`review-reason-${index}`}
                  placeholder="Per esempio: data corretta confrontando il PDF originale" />
              </label>
              <div className="ws-review-buttons">
                <button type="button" className="as-btn as-btn-primary" disabled={correctionBusy || reason.trim().length < 3}
                  onClick={() => saveCorrection(index, correctedValue)} data-testid={`review-correction-save-${index}`}>
                  <Save size={15} aria-hidden="true" /> Registra correzione
                </button>
                {current && <button type="button" className="as-btn" disabled={correctionBusy || reason.trim().length < 3}
                  onClick={() => saveCorrection(index, null)} data-testid={`review-correction-undo-${index}`}>
                  <Undo2 size={15} aria-hidden="true" /> Ripristina valore AI
                </button>}
                <button type="button" className="as-btn" onClick={() => setEditingIndex(null)} disabled={correctionBusy}>Annulla</button>
              </div>
            </div>}
          </div>;
        })}
      </div>
      {message && <p className="ws-ok" role="status" data-testid="review-save-feedback">{message}</p>}
      {error && <p className="ws-error" role="alert">{error}</p>}
      {(reviewHistory.length > 0 || correctionHistory.length > 0) && (
        <details className="ws-review-history">
          <summary>Storico delle verifiche e correzioni</summary>
          <ul>
            {reviewHistory.map((h, index) =>
              <li key={`review-${index}`}>{fmtDate(h.updated_at)} · Esito: {outcomeLabel(h.outcome)}{h.note ? ` · ${h.note}` : ""}</li>)}
            {correctionHistory.map((h, index) =>
              <li key={`correction-${index}`}>{fmtDate(h.at)} · Campo {h.field || Number(h.index) + 1}: correzione registrata · {h.reason}</li>)}
          </ul>
        </details>
      )}
      <p className="ws-review-caution"><AlertCircle size={16} aria-hidden="true" /> La correzione non modifica il file PDF originale, il rischio AI né i dati utilizzati automaticamente per le scadenze. Le scadenze si verificano e correggono nella sezione dedicata.</p>
    </section>
  );
}
