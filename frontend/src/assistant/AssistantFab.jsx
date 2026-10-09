import { Bot } from "lucide-react";
import "./assistant.css";

export const AssistantFab = ({ label }) => {
  const page = (window.location.pathname.replace(/\//g, "") || "home").slice(0, 40);
  return (
    <a className="as-fab" data-testid="assistant-fab" aria-label={label}
      href={`/assistant?utm_source=site&utm_medium=fab&utm_campaign=${encodeURIComponent(page)}`}>
      <span className="as-fab-ic"><Bot size={20} /></span>
      <span className="as-fab-label">{label}</span>
    </a>
  );
};
