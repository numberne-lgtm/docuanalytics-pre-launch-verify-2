import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, RotateCcw } from "lucide-react";
import { ws, errMsg } from "./api";

/**
 * Authenticated workspace assistant. The server alone selects source records;
 * the browser never sends document content or client data to the LLM.
 */
export default function WorkspaceCopilot({ analysisId = null, clientId = null }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("all");
  const [consent, setConsent] = useState(false);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef(null);
  const requestVersion = useRef(0);
  // Do not carry a previous client's conversation or sensitive detail opt-in
  // into a newly selected client/document or scope.
  useEffect(() => {
    requestVersion.current += 1;
    setMessages([]);
    setError("");
    setQuestion("");
    setIncludeDetails(false);
    setWorking(false);
  }, [analysisId, clientId, scope]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages, working]);
  const ask = async (event) => {
    event.preventDefault();
    const q = question.trim();
    if (!q || working || !consent) return;
    setQuestion("");
    setMessages((list) => [...list, { role: "user", text: q }]);
    setError("");
    setWorking(true);
    const version = ++requestVersion.current;
    try {
      const response = await ws.post("/copilot/ask", {
        question: q, scope, consent_to_ai: consent,
        include_document_details: !!analysisId && includeDetails,
        history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text.slice(0, 1200) })),
        ...(analysisId ? { analysis_id: analysisId } : {}),
        ...(clientId ? { client_id: clientId } : {}),
      });
      if (version !== requestVersion.current) return;
      setMessages((list) => [...list, {
        role: "assistant", text: response.answer || "Nessuna risposta.",
        sources: response.sources || [], partial: !!response.partial,
      }]);
    } catch (e) {
      if (version === requestVersion.current) setError(errMsg(e));
    } finally {
      if (version === requestVersion.current) setWorking(false);
    }
  };
  return (
    <div className="ws-copilot" data-testid="workspace-copilot">
      {!open ? (
        <button type="button" className="ws-copilot-launch" data-testid="workspace-copilot-open" onClick={() => setOpen(true)}>
          <Bot size={19} /> Assistente Area di lavoro
        </button>
      ) : (
        <section className="ws-copilot-box" aria-label="Assistente Area di lavoro">
          <header className="ws-copilot-head">
            <span><Bot size={18} /> Assistente Area di lavoro</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi assistente"><X size={18}/></button>
          </header>
          <div className="ws-copilot-options">
            <label htmlFor="workspace-copilot-scope">Consulta</label>
            <select id="workspace-copilot-scope" value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="all">Documenti, clienti e scadenze</option>
              <option value="documents">Documenti</option>
              <option value="clients">Clienti</option>
              <option value="deadlines">Scadenze</option>
            </select>
            <button type="button" className="ws-copilot-reset" onClick={() => { requestVersion.current += 1; setMessages([]); setError(""); setWorking(false); }} aria-label="Nuova conversazione"><RotateCcw size={15} /> Nuova</button>
          </div>
          <div className="ws-copilot-consent">
            <label>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/>
              Autorizzo l'invio al modello AI dei dati selezionati (riepiloghi dei documenti, nomi dei clienti e scadenze) per rispondere alle mie domande.
            </label>
            {analysisId && <label>
              <input type="checkbox" checked={includeDetails} onChange={(event) => setIncludeDetails(event.target.checked)} />
              Includi anche campi estratti e testo del documento aperto, che possono contenere dati personali o riservati.
            </label>}
          </div>
          <div ref={bodyRef} className="ws-copilot-messages" role="log" aria-live="polite">
            {!messages.length && <p className="ws-muted">Chiedimi informazioni sui tuoi documenti, clienti o sulle scadenze. Le risposte indicano i riferimenti dei dati disponibili. Non modifico nulla.</p>}
            {messages.map((msg, i) => (
              <div key={i} className={`ws-copilot-msg ws-copilot-${msg.role}`}>
                <strong>{msg.role === "user" ? "Tu" : "Copilot"}</strong>
                <p>{msg.text}</p>
                {msg.sources?.length > 0 && (
                  <div className="ws-copilot-sources">
                    <strong>Fonti citate</strong>
                    {msg.sources.map((source) => {
                      const [kind, id] = source.ref.split(":");
                      const href = kind === "documento" ? `/area/priorita/document/${id}`
                        : kind === "scadenza" ? `/area/priorita/deadline/${id}` : null;
                      return href ? <a key={source.ref} href={href}>{source.label}</a>
                        : <span key={source.ref}>{source.label}</span>;
                    })}
                  </div>
                )}
                {msg.partial && <p className="ws-muted">Archivio consultato parzialmente. Per maggiore precisione seleziona un contesto specifico.</p>}
              </div>
            ))}
            {working && <p className="ws-muted">L’assistente sta esaminando i dati disponibili…</p>}
          </div>
          {error && <p className="ws-error" role="alert">{error}</p>}
          <form className="ws-copilot-composer" onSubmit={ask}>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200}
              placeholder="Es. Quali scadenze devo verificare?" aria-label="La tua domanda all’assistente"/>
            <button type="submit" disabled={working || !question.trim() || !consent} aria-label="Invia domanda"><Send size={17}/></button>
          </form>
          <p className="ws-copilot-disclaimer">Solo dati del tuo account. Risposte AI da verificare: non sostituiscono un professionista.</p>
        </section>
      )}
    </div>
  );
}
