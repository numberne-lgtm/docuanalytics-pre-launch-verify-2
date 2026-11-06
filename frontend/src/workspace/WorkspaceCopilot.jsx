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
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef(null);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages, working]);
  const ask = async (event) => {
    event.preventDefault();
    const q = question.trim();
    if (!q || working) return;
    setQuestion("");
    setMessages((list) => [...list, { role: "user", text: q }]);
    setError("");
    setWorking(true);
    try {
      const response = await ws.post("/copilot/ask", {
        question: q, scope,
        history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text.slice(0, 1200) })),
        ...(analysisId ? { analysis_id: analysisId } : {}),
        ...(clientId ? { client_id: clientId } : {}),
      });
      setMessages((list) => [...list, {
        role: "assistant", text: response.answer || "Nessuna risposta.",
        sources: response.sources || [], partial: !!response.partial,
      }]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="ws-copilot" data-testid="workspace-copilot">
      {!open ? (
        <button type="button" className="ws-copilot-launch" data-testid="workspace-copilot-open" onClick={() => setOpen(true)}>
          <Bot size={19} /> Copilot Area di lavoro
        </button>
      ) : (
        <section className="ws-copilot-box" aria-label="Copilot Area di lavoro">
          <header className="ws-copilot-head">
            <span><Bot size={18} /> Copilot Area di lavoro</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi Copilot"><X size={18}/></button>
          </header>
          <div className="ws-copilot-options">
            <label htmlFor="workspace-copilot-scope">Consulta</label>
            <select id="workspace-copilot-scope" value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="all">Documenti, clienti e scadenze</option>
              <option value="documents">Documenti</option>
              <option value="clients">Clienti</option>
              <option value="deadlines">Scadenze</option>
            </select>
            <button type="button" className="ws-copilot-reset" onClick={() => { setMessages([]); setError(""); }} aria-label="Nuova conversazione"><RotateCcw size={15} /> Nuova</button>
          </div>
          <div ref={bodyRef} className="ws-copilot-messages" role="log" aria-live="polite">
            {!messages.length && <p className="ws-muted">Chiedimi informazioni sui tuoi documenti, clienti o sulle scadenze. Le risposte indicano i riferimenti dei dati disponibili. Non modifico nulla.</p>}
            {messages.map((msg, i) => (
              <div key={i} className={`ws-copilot-msg ws-copilot-${msg.role}`}>
                <strong>{msg.role === "user" ? "Tu" : "Copilot"}</strong>
                <p>{msg.text}</p>
                {msg.partial && <p className="ws-muted">Archivio consultato parzialmente. Per maggiore precisione seleziona un contesto specifico.</p>}
              </div>
            ))}
            {working && <p className="ws-muted">Copilot sta esaminando i dati disponibili…</p>}
          </div>
          {error && <p className="ws-error" role="alert">{error}</p>}
          <form className="ws-copilot-composer" onSubmit={ask}>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200}
              placeholder="Es. Quali scadenze devo verificare?" aria-label="La tua domanda al Copilot"/>
            <button type="submit" disabled={working || !question.trim()} aria-label="Invia domanda"><Send size={17}/></button>
          </form>
          <p className="ws-copilot-disclaimer">Solo dati del tuo account. Risposte AI da verificare: non sostituiscono un professionista.</p>
        </section>
      )}
    </div>
  );
}
