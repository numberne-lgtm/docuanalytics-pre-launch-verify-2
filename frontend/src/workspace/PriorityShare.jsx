import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, LockKeyhole, ArrowLeft } from "lucide-react";
import { ws, errMsg, hasToken, fmtDate, LEVEL } from "./api";
import "./workspace.css";

export default function PriorityShare() {
  const { kind, itemId } = useParams();
  const [priority, setPriority] = useState(null);
  const [qrSrc, setQrSrc] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = (kind === "document" || kind === "deadline") && /^[a-zA-Z0-9-]{1,128}$/.test(itemId || "");
  const loggedIn = hasToken();

  useEffect(() => {
    document.title = "Priorità protetta · DocuAnalytics AI";
    setPriority(null);
    setError("");
    if (!loggedIn || !allowed) return;
    let active = true;
    ws.get(`/priorities/${kind}/${itemId}`)
      .then((result) => { if (active) setPriority(result); })
      .catch((e) => { if (active) setError(errMsg(e)); });
    return () => { active = false; };
  }, [kind, itemId, loggedIn, allowed]);

  useEffect(() => {
    if (!loggedIn || !allowed || !priority) return;
    let active = true;
    let src = "";
    setQrSrc("");
    // The endpoint is private and requires the same bearer authentication as the detail.
    const base = `${process.env.REACT_APP_BACKEND_URL}/api/workspace`;
    fetch(`${base}/priorities/${kind}/${itemId}/qr`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("da_token") || ""}` },
      cache: "no-store",
    }).then((response) => {
      if (!response.ok) throw new Error("QR non disponibile");
      return response.blob();
    }).then((blob) => {
      if (!active) return;
      src = URL.createObjectURL(blob);
      setQrSrc(src);
    }).catch(() => { /* QR optional; details and PDF remain available */ });
    return () => { active = false; if (src) URL.revokeObjectURL(src); };
  }, [kind, itemId, loggedIn, allowed, priority]);

  const download = async () => {
    if (busy || !priority) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/workspace/priorities/${kind}/${itemId}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("da_token") || ""}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Impossibile scaricare il PDF. Controlla il tuo accesso.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "docuanalytics-priorita.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { setError(e.message || "Errore durante l'esportazione."); }
    finally { setBusy(false); }
  };

  return (
    <div className="App">
      <main className="wrap ws-page" data-testid="priority-share">
        <Link to="/area" className="ws-link"><ArrowLeft size={15} /> Torna all'Area di lavoro</Link>
        <h1 className="ws-h1">Scheda priorità</h1>
        <p className="ws-muted"><LockKeyhole size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Accesso riservato: il QR non contiene dati del documento.</p>
        {!loggedIn ? (
          <div className="ws-doc" role="status" data-testid="priority-login-required">
            <h2 className="ws-h2">Accesso richiesto</h2>
            <p>Per consultare o esportare questa priorità devi accedere con l'account autorizzato.</p>
            <a className="btn btn-primary" href="/?auth=login">Accedi a DocuAnalytics</a>
            <p className="ws-muted">Dopo l'accesso, riapri questo link o scansiona di nuovo il QR.</p>
          </div>
        ) : !allowed ? <p className="ws-error">Collegamento non valido.</p> : (
          <div className="ws-doc">
            {error && <p className="ws-error" role="alert">{error}</p>}
            {!priority && !error && <p className="ws-muted">Caricamento priorità…</p>}
            {priority && (
              <>
                <h2 className="ws-h2">{priority.title}</h2>
                <span className={`ws-level ${(LEVEL[priority.level] || LEVEL.low).cls}`}>{(LEVEL[priority.level] || LEVEL.low).label}</span>
                {priority.filename && <p>Documento: {priority.filename}</p>}
                {priority.date && <p>Data indicata: {fmtDate(priority.date)}</p>}
                {priority.status && <p>Stato scadenza: {priority.status === "confirmed" ? "Confermata" : "Da verificare"}</p>}
                {priority.summary && <p>{priority.summary}</p>}
                {(priority.details || []).length > 0 && <><h3 className="ws-h3">Controlli e dettagli</h3><ul>{priority.details.map((d, i) => <li key={i}>{d}</li>)}</ul></>}
                <p className="ws-muted">Verificare sempre date e dati prima di assumere decisioni operative o legali.</p>
                <button type="button" className="btn btn-primary" onClick={download} disabled={busy} data-testid="priority-pdf-download">
                  <Download size={16} /> {busy ? "Preparazione PDF…" : "Scarica PDF"}
                </button>
                {qrSrc && <figure className="ws-priority-qr"><img src={qrSrc} alt="QR per aprire questa scheda protetta" width="190" height="190" /><figcaption>Scansiona il QR per aprire questa scheda sul telefono dopo l'accesso.</figcaption></figure>}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
