import { useEffect, useState } from "react";
import { ws, errMsg } from "./api";

export const REVIEW_STATES = [
  ["to_review", "Da verificare"],
  ["in_progress", "In lavorazione"],
  ["verified", "Verificato dal professionista"],
];
export const reviewLabel = (status) =>
  REVIEW_STATES.find(([value]) => value === status)?.[1] || "Da verificare";

// Manual workflow is distinct from automated risk classification.
// This component never hides or changes an AI red flag.
export default function DocumentReviewControl({ documentId, status = "to_review", onChanged, compact = false }) {
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setCurrent(status), [status, documentId]);

  const change = async (next) => {
    if (!REVIEW_STATES.some(([key]) => key === next) || next === current || busy) return;
    if (next === "verified" && !window.confirm(
      "Confermi di avere verificato personalmente questo documento? I rischi e le anomalie AI rimarranno visibili."
    )) return;
    const old = current;
    setCurrent(next);
    setBusy(true);
    setError("");
    try {
      await ws.put(`/documents/${documentId}/review-state`, { status: next });
      onChanged?.();
    } catch (e) {
      setCurrent(old);
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={`ws-review-control ws-review-${current}${compact ? " ws-review-compact" : ""}`}>
      <label className="ws-review-label">
        <span>Stato verifica</span>
        <select aria-label="Stato verifica del professionista" value={current} disabled={busy}
          onChange={(e) => change(e.target.value)} data-testid={`review-state-${documentId}`}>
          {REVIEW_STATES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      {error && <span className="ws-error" role="alert">{error}</span>}
    </span>
  );
}
