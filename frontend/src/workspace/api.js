import axios from "axios";

const base = `${process.env.REACT_APP_BACKEND_URL}/api/workspace`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("da_token") || ""}` });

export const ws = {
  get: (p) => axios.get(base + p, { headers: headers() }).then((r) => r.data),
  post: (p, d = {}) => axios.post(base + p, d, { headers: headers() }).then((r) => r.data),
  patch: (p, d) => axios.patch(base + p, d, { headers: headers() }).then((r) => r.data),
  del: (p) => axios.delete(base + p, { headers: headers() }).then((r) => r.data),
};

export const errMsg = (e) => e?.response?.data?.detail || "Errore di rete. Riprova.";
export const hasToken = () => !!localStorage.getItem("da_token");

export const LEVEL = {
  high: { dot: "🔴", label: "Alto", cls: "lv-high" },
  medium: { dot: "🟠", label: "Medio", cls: "lv-medium" },
  low: { dot: "🟢", label: "Basso", cls: "lv-low" },
};

export const fmtDate = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const dueText = (d) => d == null ? "data da verificare" : d < 0 ? `scaduta da ${-d} giorni` : d === 0 ? "oggi" : `tra ${d} giorni`;
