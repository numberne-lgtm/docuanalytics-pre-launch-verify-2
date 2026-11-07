import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  applyAnalyticsChoice, PREFERENCES_EVENT, readAnalyticsChoice, saveAnalyticsChoice,
} from "./analyticsConsent";

export default function CookiePreferences() {
  const [open, setOpen] = useState(() => readAnalyticsChoice() === null);

  useEffect(() => {
    applyAnalyticsChoice(readAnalyticsChoice());
    const show = () => setOpen(true);
    const sync = () => applyAnalyticsChoice(readAnalyticsChoice());
    window.addEventListener(PREFERENCES_EVENT, show);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PREFERENCES_EVENT, show);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const choose = (choice) => {
    saveAnalyticsChoice(choice);
    setOpen(false);
  };

  if (!open) return null;
  return (
    <aside className="cookie-preferences" aria-labelledby="cookie-preferences-title">
      <strong id="cookie-preferences-title">Preferenze cookie</strong>
      <p>Usiamo strumenti necessari al servizio. Con il tuo consenso usiamo Google Analytics per misurare l’uso del sito. Puoi cambiare scelta dalla pagina <Link to="/privacy#preferenze-cookie">Privacy e cookie</Link>.</p>
      <div className="flex gap wrapf">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => choose("rejected")}>Solo necessari</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => choose("accepted")}>Accetta statistiche</button>
      </div>
    </aside>
  );
}
