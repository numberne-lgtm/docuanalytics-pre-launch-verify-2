import axios from "axios";

const base = `${process.env.REACT_APP_BACKEND_URL}/api/workspace`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("da_token") || ""}` });

export const ws = {
  get: (p) => axios.get(base + p, { headers: headers() }).then((r) => r.data),
  post: (p, d = {}) => axios.post(base + p, d, { headers: headers() }).then((r) => r.data),
  patch: (p, d) => axios.patch(base + p, d, { headers: headers() }).then((r) => r.data),
  del: (p) => axios.delete(base + p, { headers: headers() }).then((r) => r.data),
};

export const download = (p, name) =>
  axios.get(base + p, { responseType: "blob", headers: headers() }).then(({ data }) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });

export const errMsg = (e) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) return "Dati non validi: controlla i campi obbligatori.";
  return "Errore di rete. Riprova.";
};
export const hasToken = () => !!localStorage.getItem("da_token");

export const LEVEL = {
  high: { dot: "🔴", label: "Alto", cls: "lv-high" },
  medium: { dot: "🟠", label: "Medio", cls: "lv-medium" },
  low: { dot: "🟢", label: "Basso", cls: "lv-low" },
};

const SEG = {
  supplier: "Fornitore", customer: "Cliente", name: "Nome", piva: "P.IVA", codice_fiscale: "Codice fiscale", address: "Indirizzo",
  document: "Documento", number: "Numero", date: "Data", type: "Tipo", totals: "Totali", imponibile: "Imponibile", imposta: "Imposta",
  totale: "Totale", vat_lines: "Riga IVA", aliquota: "Aliquota", natura: "Natura IVA", iban: "IBAN", line_items: "Riga",
  description: "Descrizione", quantity: "Quantità", unit_price: "Prezzo unitario", total: "Totale", vat_rate: "Aliquota IVA",
  taxpayer: "Contribuente", sections: "Sezione", section: "Sezione", entries: "Voce", codice_tributo: "Codice tributo", anno: "Anno",
  importo_debito: "Importo a debito", importo_credito: "Importo a credito", due_date: "Data di scadenza", total_debito: "Totale a debito",
  total_credito: "Totale a credito", saldo: "Saldo", company: "Società", denominazione: "Denominazione", rea: "REA", pec: "PEC",
  share_capital: "Capitale sociale", legal_form: "Forma giuridica", registered_office: "Sede legale", ateco_codes: "Codice ATECO",
  code: "Codice", legal_representatives: "Legale rappresentante", role: "Ruolo", parties: "Parte", piva_cf: "P.IVA / CF",
  effective_date: "Data di decorrenza", expiration_date: "Data di scadenza", duration: "Durata", penalty_clauses: "Clausola penale",
  clause: "Clausola", key_obligations: "Obbligo principale", reminders: "Promemoria", label: "Descrizione",
};
const human = (k) => { const s = k.replace(/_/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
export const fieldLabel = (path) => !path || !/^[\w.[\]]+$/.test(path) ? path : path.split(".").map((seg) => {
  const m = seg.match(/^(\w+)(?:\[(\d+)\])?$/);
  if (!m) return seg;
  const base = SEG[m[1]] || human(m[1]);
  return m[2] != null ? `${base} ${Number(m[2]) + 1}` : base;
}).join(" › ");

export const fmtDate = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const dueText = (d) => d == null ? "data da verificare" : d < 0 ? `scaduta da ${-d} giorni` : d === 0 ? "oggi" : `tra ${d} giorni`;
