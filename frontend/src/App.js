import { useEffect, useState, useRef, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Upload, Zap, CreditCard, FileText, ScrollText, Building2, Landmark, Wallet,
  Bot, ShieldAlert, MessageSquare, Star, CheckCircle2, X, Send, Loader2,
  Download, ChevronRight, Bitcoin
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DOC_TYPES = [
  { id: "fattura", label: "Fattura", Icon: FileText },
  { id: "contratto", label: "Contratto", Icon: ScrollText },
  { id: "visura", label: "Visura", Icon: Building2 },
  { id: "f24", label: "F24", Icon: Landmark },
  { id: "busta_paga", label: "Busta Paga", Icon: Wallet },
];
const PIPE = ["Parsing", "Classificazione", "Estrazione", "Validazione"];

function useUser() {
  const [user, setUser] = useState({ user_id: null, credits: 0 });
  useEffect(() => {
    const uid = localStorage.getItem("da_uid");
    axios.post(`${API}/session`, { user_id: uid }).then(({ data }) => {
      localStorage.setItem("da_uid", data.user_id);
      setUser(data);
    }).catch(() => {});
  }, []);
  const refresh = useCallback(() => {
    const uid = localStorage.getItem("da_uid");
    if (uid) axios.get(`${API}/session/${uid}`).then(({ data }) => setUser(data)).catch(() => {});
  }, []);
  return { user, setUser, refresh };
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast" data-testid="toast">{msg}</div>;
}

function Home() {
  const { user, setUser, refresh } = useUser();
  const [docType, setDocType] = useState("auto");
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [stage, setStage] = useState(-1); // pipeline
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [toast, setToast] = useState("");
  const inputRef = useRef();

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 3500); };

  useEffect(() => {
    // handle payment return
    const p = new URLSearchParams(window.location.search);
    if (window.location.pathname === "/payment/success" && p.get("session_id")) {
      pollPayment(p.get("session_id"));
    } else if (window.location.pathname === "/payment/cancel") {
      notify("Pagamento annullato.");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const pollPayment = async (sid, tries = 0) => {
    notify("Verifica pagamento in corso...");
    try {
      const { data } = await axios.get(`${API}/payments/status/${sid}`);
      if (data.payment_status === "paid") {
        refresh();
        notify(`✅ Pagamento riuscito! +${data.credits_added} crediti aggiunti.`);
        window.history.replaceState({}, "", "/");
        return;
      }
      if (data.payment_status === "expired" || data.payment_status === "failed") {
        notify("Pagamento non completato."); window.history.replaceState({}, "", "/"); return;
      }
    } catch (e) {}
    if (tries < 6) setTimeout(() => pollPayment(sid, tries + 1), 2000);
    else { notify("Verifica in corso, i crediti appariranno a breve."); window.history.replaceState({}, "", "/"); }
  };

  const onFile = (f) => { if (f) { setFile(f); setResult(null); } };
  const toBase64 = (f) => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f);
  });

  const analyze = async () => {
    if (!file) return;
    if (user.credits <= 0) { notify("Crediti esauriti. Ricarica per continuare."); setPricingOpen(true); return; }
    setAnalyzing(true); setResult(null); setStage(0);
    const timers = [0, 1, 2, 3].map((i) => setTimeout(() => setStage(i), i * 700));
    try {
      const b64 = await toBase64(file);
      const { data } = await axios.post(`${API}/analyze`, {
        user_id: user.user_id, doc_type: docType, filename: file.name,
        mime_type: file.type || "application/octet-stream", file_base64: b64,
      });
      setResult(data.result); setAnalysisId(data.analysis_id);
      setUser((u) => ({ ...u, credits: data.credits }));
      setStage(3);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Analisi non riuscita.";
      notify(msg);
      if (e?.response?.status === 402) setPricingOpen(true);
    } finally {
      timers.forEach(clearTimeout); setAnalyzing(false);
    }
  };

  return (
    <div className="App">
      <Header credits={user.credits} onTopup={() => setPricingOpen(true)} />

      <main className="wrap">
        {/* Hero */}
        <section className="hero fade">
          <div className="hero-badges mb1"><span className="badge badge-info">DOCUMENT INTELLIGENCE ENTERPRISE</span></div>
          <h1>Analisi Documenti con<br /><span className="grad">Intelligenza Artificiale</span></h1>
          <p>Carica fatture, contratti, visure ed F24. L'AI li classifica ed estrae automaticamente tutti i dati chiave in pochi secondi, con audit anti-errore integrato.</p>
          <div className="hero-badges">
            {DOC_TYPES.map(({ id, label, Icon }) => (
              <span className="hero-badge flex aic gap" key={id}><Icon size={15} /> {label}</span>
            ))}
          </div>
        </section>

        {/* Upload */}
        <section className="section" id="upload">
          <div className="accent-bar" />
          <h2 className="section-title">Carica Documento</h2>
          <p className="section-sub mb1">Trascina un file o scegli il tipo di documento per l'analisi immediata</p>

          <div className="chips mb1">
            {DOC_TYPES.map(({ id, label, Icon }) => (
              <div key={id} className={`chip flex aic gap ${docType === id ? "active" : ""}`}
                data-testid={`chip-${id}`} onClick={() => setDocType(docType === id ? "auto" : id)}>
                <Icon size={15} /> {label}
              </div>
            ))}
          </div>

          <div className={`upload ${drag ? "drag" : ""}`} data-testid="upload-zone"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}>
            <Upload className="ic" />
            <p style={{ fontWeight: 700, fontSize: "1.05rem" }}>{file ? file.name : "Trascina qui il tuo documento"}</p>
            <p style={{ color: "var(--text-muted)", fontSize: ".85rem", marginTop: ".3rem" }}>PDF, JPG, PNG — Max 10MB</p>
            <input ref={inputRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png"
              data-testid="file-input" onChange={(e) => onFile(e.target.files[0])} />
          </div>

          <div className="center mt2">
            <button className="btn btn-primary btn-lg" data-testid="analyze-btn" disabled={!file || analyzing} onClick={analyze}>
              {analyzing ? <><Loader2 className="spinner" /> Analisi in corso...</> : <><Bot size={18} /> Analizza Documento</>}
            </button>
          </div>

          {(analyzing || result) && (
            <div className="glass pad mt2">
              <div className="pipe">
                {PIPE.map((s, i) => (
                  <div className={`pstep ${stage >= i ? "on" : ""}`} key={s}>
                    <div className="pcircle">{stage > i || (result && i <= 3) ? <CheckCircle2 color="var(--success)" /> : i + 1}</div>
                    <div style={{ fontWeight: 700, fontSize: ".85rem" }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {result && <Results result={result} analysisId={analysisId} notify={notify} />}

        <Services />
        <Testimonials />
      </main>

      <Footer onTopup={() => setPricingOpen(true)} />
      {pricingOpen && <PricingModal user={user} onClose={() => setPricingOpen(false)} notify={notify} />}
      <Toast msg={toast} />
    </div>
  );
}

function Header({ credits, onTopup }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo"><span className="dot" /> Docu<span className="grad">Analytics</span> AI</div>
        <nav className="nav">
          <span className="credits-badge" data-testid="credits-badge"><Zap size={15} /> {credits} Crediti</span>
          <button className="btn btn-primary btn-sm" data-testid="topup-btn" onClick={onTopup}><CreditCard size={15} /> Ricarica</button>
        </nav>
      </div>
    </header>
  );
}

function Results({ result, analysisId, notify }) {
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    const question = q; setQ(""); setMsgs((m) => [...m, { r: "u", t: question }]); setLoading(true);
    try {
      const { data } = await axios.post(`${API}/chat`, { user_id: localStorage.getItem("da_uid"), analysis_id: analysisId, question });
      setMsgs((m) => [...m, { r: "a", t: data.answer }]);
    } catch { setMsgs((m) => [...m, { r: "a", t: "Errore nel copilot." }]); }
    finally { setLoading(false); }
  };

  const exportData = (fmt) => {
    let content, mime, name;
    if (fmt === "json") { content = JSON.stringify(result, null, 2); mime = "application/json"; name = "docuanalytics.json"; }
    else { // csv
      const rows = [["Campo", "Valore"], ...(result.fields || []).map((f) => [f.label, f.value])];
      content = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
      mime = "text/csv"; name = "docuanalytics.csv";
    }
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    notify(`Esportato ${fmt.toUpperCase()}`);
  };

  return (
    <section className="section fade" id="results">
      <div className="accent-bar" />
      <h2 className="section-title">Risultati Analisi</h2>
      <p className="section-sub mb1">{result.doc_type} — {result.summary}</p>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <div className="glass pad">
          <div className="flex between aic mb1">
            <strong style={{ fontSize: ".95rem" }}>Dati Estratti</strong>
            <div className="flex gap">
              <button className="btn btn-sm" data-testid="export-csv" onClick={() => exportData("csv")}><Download size={14} /> CSV</button>
              <button className="btn btn-sm" data-testid="export-json" onClick={() => exportData("json")}><Download size={14} /> JSON</button>
            </div>
          </div>
          {(result.fields || []).map((f, i) => (
            <div className="field-row" key={i}><span className="k">{f.label}</span><span className="v">{String(f.value)}</span></div>
          ))}
          {(!result.fields || result.fields.length === 0) && <p style={{ color: "var(--text-muted)" }}>Nessun campo strutturato rilevato.</p>}
        </div>

        <div>
          <div className="glass pad mb1">
            <div className="flex aic gap mb1"><ShieldAlert size={18} color="var(--accent)" /><strong>AI Red-Flag Audit</strong></div>
            {(result.audit || []).map((a, i) => (
              <div className={`audit-item audit-${a.level}`} key={i}>
                {a.level === "error" ? <ShieldAlert size={16} /> : a.level === "warning" ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
                <span>{a.message}</span>
              </div>
            ))}
            {(!result.audit || result.audit.length === 0) && <p style={{ color: "var(--text-muted)", fontSize: ".85rem" }}>Nessuna anomalia rilevata.</p>}
          </div>

          <div className="glass pad">
            <div className="flex aic gap mb1"><MessageSquare size={18} color="#E100FF" /><strong>AI Copilot</strong><span className="badge badge-new">CHAT</span></div>
            <div className="chat-box" data-testid="chat-box">
              {msgs.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: ".82rem" }}>Chiedi qualsiasi cosa sul documento, es. "Qual è il totale da pagare?"</p>}
              {msgs.map((m, i) => <div className={`msg ${m.r}`} key={i}>{m.t}</div>)}
              {loading && <div className="msg a"><Loader2 className="spinner" /></div>}
            </div>
            <div className="flex gap">
              <input className="input" data-testid="chat-input" placeholder="Fai una domanda..." value={q}
                onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
              <button className="btn btn-primary btn-sm" data-testid="chat-send" onClick={ask}><Send size={15} /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Services() {
  const cards = [
    { Icon: Landmark, t: "F24 & Fatture Elettroniche", d: "Quadratura automatica Debito/Credito/Saldo, avviso visto conformità IVA sopra €5.000, controllo IBAN esteri e Prima Nota per Zucchetti/TeamSystem." },
    { Icon: ScrollText, t: "Contratti & Visure Camerali", d: "Rilevamento clausole vessatorie (Art. 1341 c.c.), preavvisi recesso, verifica antiriciclaggio KYC/AML con estrazione REA, soci e amministratori." },
    { Icon: Wallet, t: "Buste Paga & HR", d: "Quadratura Lordo/INPS/IRPEF/Netto, TFR maturato, compliance GDPR & EU AI Act con server 100% in UE e crittografia AES 256-bit." },
  ];
  return (
    <section className="section">
      <div className="accent-bar" />
      <h2 className="section-title">Servizi AI Specialistici per il Tuo Settore</h2>
      <p className="section-sub mb1">Algoritmi addestrati per Commercialisti, Avvocati, Notai e CFO</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {cards.map((c, i) => (
          <div className="glass pad" key={i}>
            <c.Icon size={28} color="var(--accent)" />
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: ".6rem 0 .4rem" }}>{c.t}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: ".85rem", lineHeight: 1.55 }}>{c.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const revs = [
    { n: "Avv. Alessandro Rossi", s: "Studio Legale Rossi & Associati • Milano", t: "Ha rivoluzionato il nostro studio. L'estrazione da contratti e visure è accurata al 99%. Risparmiamo 12 ore a settimana." },
    { n: "Dott.ssa Elena Conti", s: "Conti & Partners • Roma", t: "La quadratura automatica dei saldi F24 e delle fatture ci ha azzerato gli errori di digitazione manuale." },
    { n: "Dott. Marco Bianchi", s: "Studio Tributario Bianchi • Torino", t: "I 3 crediti gratuiti mi hanno convinto. Abbiamo acquistato il Pack Professional: assistenza ed export impeccabili." },
    { n: "Chiara Ferrari", s: "HR Manager • Bologna", t: "Analizzare le buste paga ora richiede 2 secondi. Piattaforma affidabile ed intuitiva." },
  ];
  return (
    <section className="section">
      <div className="accent-bar" />
      <h2 className="section-title">Cosa dicono gli Studi Professionali</h2>
      <p className="section-sub mb1">⭐ 4.9/5 — Basato su 482 recensioni verificate</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {revs.map((r, i) => (
          <div className="glass pad testi" key={i}>
            <div><div className="stars mb1">{[...Array(5)].map((_, k) => <Star key={k} size={14} fill="#ffd600" color="#ffd600" style={{ display: "inline" }} />)}</div>
              <p style={{ fontStyle: "italic", fontSize: ".85rem", lineHeight: 1.5 }}>"{r.t}"</p></div>
            <div className="divider flex between aic wrapf">
              <div><div style={{ fontWeight: 700, fontSize: ".82rem" }}>{r.n}</div><div style={{ color: "var(--text-muted)", fontSize: ".74rem" }}>{r.s}</div></div>
              <span className="badge badge-ok">Verificato</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingModal({ user, onClose, notify }) {
  const [tab, setTab] = useState("stripe");
  const [info, setInfo] = useState(null);
  const [coin, setCoin] = useState("BTC");
  const [selPkg, setSelPkg] = useState("pro");
  const [loading, setLoading] = useState("");

  useEffect(() => { axios.get(`${API}/crypto/info`).then(({ data }) => setInfo(data)).catch(() => {}); }, []);

  const packs = info?.packages?.filter((p) => p.type === "pack") || [];
  const subs = info?.packages?.filter((p) => p.type === "sub") || [];

  const buyStripe = async (id) => {
    setLoading(id);
    try {
      const { data } = await axios.post(`${API}/payments/checkout`, {
        package_id: id, origin_url: window.location.origin, user_id: user.user_id,
      });
      window.location.href = data.checkout_url;
    } catch { notify("Errore nell'avvio del pagamento."); setLoading(""); }
  };

  const orderCrypto = async () => {
    try {
      const { data } = await axios.post(`${API}/crypto/order`, { user_id: user.user_id, package_id: selPkg, coin });
      notify(`Ordine ${data.order_id} registrato. ${data.message}`);
    } catch { notify("Errore ordine crypto."); }
  };

  const Card = (p, pop) => (
    <div className={`glass pad price-card ${pop ? "pop" : ""}`} key={p.id}>
      {pop && <span className="badge badge-info" style={{ position: "absolute", top: 12, right: 12 }}>POPOLARE</span>}
      <div style={{ fontWeight: 800 }}>{p.name}</div>
      <div className="price-amt">€{p.amount.toFixed(0)}{p.type === "sub" && <span>/mese</span>}</div>
      <div className="price-cr">{p.credits >= 99999 ? "Crediti illimitati" : `${p.credits} crediti`}</div>
      <button className="btn btn-primary mt1" data-testid={`buy-${p.id}`} disabled={loading === p.id} onClick={() => buyStripe(p.id)}>
        {loading === p.id ? <Loader2 className="spinner" /> : <><CreditCard size={15} /> Acquista</>}
      </button>
    </div>
  );

  const w = info?.wallets?.[coin];

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal glass pad fade" onClick={(e) => e.stopPropagation()} data-testid="pricing-modal">
        <div className="modal-head">
          <h2 className="section-title">Ricarica Crediti</h2>
          <button className="close-x" data-testid="close-pricing" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="tabs">
          <div className={`tab ${tab === "stripe" ? "active" : ""}`} data-testid="tab-stripe" onClick={() => setTab("stripe")}><CreditCard size={15} style={{ display: "inline", marginRight: 6 }} /> Carta / Stripe</div>
          <div className={`tab ${tab === "crypto" ? "active" : ""}`} data-testid="tab-crypto" onClick={() => setTab("crypto")}><Bitcoin size={15} style={{ display: "inline", marginRight: 6 }} /> Crypto (BTC/USDT)</div>
        </div>

        {tab === "stripe" && (
          <>
            <p className="section-sub mb1">Pacchetti Crediti (pagamento singolo)</p>
            <div className="price-grid mb1">{packs.map((p) => Card(p, p.id === "pro"))}</div>
            <p className="section-sub mb1 mt2">Abbonamenti Studio (ricarica mensile crediti)</p>
            <div className="price-grid">{subs.map((p) => Card(p, p.id === "sub_pro"))}</div>
            <p style={{ color: "var(--text-muted)", fontSize: ".74rem", marginTop: "1rem" }}>Pagamenti sicuri via Stripe. Test: carta 4242 4242 4242 4242, data futura, CVC qualsiasi.</p>
          </>
        )}

        {tab === "crypto" && info && (
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <p className="section-sub mb1">1. Scegli pacchetto</p>
              <select className="input mb1" data-testid="crypto-pkg" value={selPkg} onChange={(e) => setSelPkg(e.target.value)}>
                {info.packages.map((p) => <option key={p.id} value={p.id}>{p.name} — €{p.amount} ({p.credits >= 99999 ? "illimitati" : p.credits + " cr"})</option>)}
              </select>
              <p className="section-sub mb1">2. Scegli valuta</p>
              <div className="tabs">
                <div className={`tab ${coin === "BTC" ? "active" : ""}`} data-testid="coin-btc" onClick={() => setCoin("BTC")}>BTC</div>
                <div className={`tab ${coin === "USDT" ? "active" : ""}`} data-testid="coin-usdt" onClick={() => setCoin("USDT")}>USDT TRC20</div>
              </div>
              <button className="btn btn-accent mt1" data-testid="crypto-order-btn" onClick={orderCrypto}>Registra ordine <ChevronRight size={15} /></button>
            </div>
            <div className="wallet-box">
              <img src={w?.qr} alt="QR" width={200} height={200} />
              <div style={{ fontWeight: 700, marginTop: ".5rem" }}>{w?.label} <span style={{ color: "var(--text-muted)", fontSize: ".75rem" }}>({w?.network})</span></div>
              <div className="addr" data-testid="wallet-address">{w?.address}</div>
              <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(w?.address); notify("Indirizzo copiato"); }}>Copia indirizzo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Footer({ onTopup }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <p style={{ fontWeight: 800 }}>DocuAnalytics Enterprise — AI Document Intelligence</p>
        <p style={{ color: "var(--text-muted)", fontSize: ".82rem", marginTop: ".3rem" }}>Estrazione automatica ad alta precisione per studi legali, notai e commercialisti • Server UE • GDPR</p>
        <div className="flex gap wrapf aic" style={{ justifyContent: "center", marginTop: "1rem" }}>
          <a className="btn btn-sm" href="https://t.me/docuanalytics_ai" target="_blank" rel="noreferrer">Canale Telegram</a>
          <button className="btn btn-primary btn-sm" onClick={onTopup}><CreditCard size={14} /> Ricarica Crediti</button>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
