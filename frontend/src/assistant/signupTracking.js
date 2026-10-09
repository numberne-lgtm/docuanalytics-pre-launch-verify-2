import axios from "axios";

const KEY = "da_from_assistant";
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export const markFromAssistant = (sessionId, utm) => {
  localStorage.setItem(KEY, JSON.stringify({ sid: sessionId, utm, ts: Date.now() }));
};

export const reportAssistantSignup = async (token) => {
  let f;
  try { f = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { f = null; }
  if (!f) return;
  if (Date.now() - f.ts > MAX_AGE_MS) { localStorage.removeItem(KEY); return; }
  try {
    await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/assistant/signup`,
      { session_id: f.sid, event: "signup_completed", ...f.utm },
      { headers: { Authorization: `Bearer ${token}` } });
    localStorage.removeItem(KEY);
  } catch { /* tracking must never affect login */ }
};
