import { useEffect, useState, useRef, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Upload, Zap, CreditCard, FileText, ScrollText, Building2, Landmark, Wallet,
  Bot, ShieldAlert, MessageSquare, Star, CheckCircle2, X, Send, Loader2,
  Download, ChevronRight, Bitcoin, LogIn, LogOut, User, Gift, BookOpen,
  Sparkles, Copy, Play, Lock, Facebook, Instagram, Linkedin, Youtube, Twitter, Send as Telegram
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Social links — sostituisci gli URL con i tuoi profili reali quando li crei.
const SOCIALS = [
  { name: "LinkedIn", Icon: Linkedin, url: "https://www.linkedin.com/company/docuanalytics-ai" },
  { name: "Facebook", Icon: Facebook, url: "https://www.facebook.com/lampone.francesco" },
  { name: "Instagram", Icon: Instagram, url: "https://www.instagram.com/docuanalytics.ai" },
  { name: "X (Twitter)", Icon: Twitter, url: "https://x.com/docuanalytics_ai" },
  { name: "YouTube", Icon: Youtube, url: "https://www.youtube.com/@docuanalytics-ai" },
  { name: "Telegram", Icon: Telegram, url: "https://t.me/docuanalytics_ai" },
];

const DOC_TYPES = [
  { id: "fattura", label: "Fattura", Icon: FileText },
  { id: "contratto", label: "Contratto", Icon: ScrollText },
  { id: "visura", label: "Visura", Icon: Building2 },
  { id: "f24", label: "F24", Icon: Landmark },
  { id: "busta_paga", label: "Busta Paga", Icon: Wallet },
];
const PIPE = ["Parsing", "Classificazione", "Estrazione", "Validazione"];

function useUser() {
  const [user, setUser] = useState({ user_id: null, credits: 0, email: null });
  const [authed, setAuthed] = useState(false);

  const initAnon = useCallback(() => {
    const uid = localStorage.getItem("da_uid");
    axios.post(`${API}/session`, { user_id: uid }).then(({ data }) => {
      localStorage.setItem("da_uid", data.user_id);
      setUser(data); setAuthed(false);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // capture referral code from URL (?ref=CODE)
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("da_ref", ref);

    const token = localStorage.getItem("da_token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios.get(`${API}/auth/me`).then(({ data }) => {
        localStorage.setItem("da_uid", data.user.user_id);
        setUser(data.user); setAuthed(true);
      }).catch(() => {
        localStorage.removeItem("da_token");
        delete axios.defaults.headers.common["Authorization"];
        initAnon();
      });
    } else initAnon();
  }, [initAnon]);

  const refresh = useCallback(() => {
    const uid = localStorage.getItem("da_uid");
    if (uid) axios.get(`${API}/session/${uid}`).then(({ data }) => setUser((u) => ({ ...u, ...data }))).catch(() => {});
  }, []);

  const login = useCallback((token, userObj) => {
    localStorage.setItem("da_token", token);
    localStorage.setItem("da_uid", userObj.user_id);
    localStorage.removeItem("da_ref");
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(userObj); setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("da_token");
    localStorage.removeItem("da_uid");
    delete axios.defaults.headers.common["Authorization"];
    setAuthed(false);
    initAnon();
  }, [initAnon]);

  return { user, setUser, refresh, authed, login, logout };
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast" data-testid="toast">{msg}</div>;
}

function Home() {
  const { user, setUser, refresh, authed, login, logout } = useUser();
  const [docType, setDocType] = useState("auto");
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [stage, setStage] = useState(-1); // pipeline
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState("");
  const inputRef = useRef();

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 6000); };

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
        notify(data.is_subscription
          ? `✅ Abbonamento attivo! +${data.credits_added} crediti/mese. Rinnovo automatico.`
          : `✅ Pagamento riuscito! +${data.credits_added} crediti aggiunti.`);
        window.history.replaceState({}, "", "/");
        return;
      }
      if (data.payment_status === "expired" || data.payment_status === "failed") {
        notify("Pagamento non completato."); window.history.replaceState({}, "", "/"); return;
      }
    } catch (e) { console.error("payment status poll error", e); }
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
      <Header credits={user.credits} authed={authed} user={user}
        onTopup={() => setPricingOpen(true)} onAuth={() => setAuthOpen(true)}
        onReferral={() => setRefOpen(true)} onLogout={() => { logout(); notify("Disconnesso."); }} />

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

        <NewFeatures />
        <Services onGuide={() => setGuideOpen(true)} />
        <Tutorials />
        <ReferralBanner authed={authed} onInvite={() => (authed ? setRefOpen(true) : setAuthOpen(true))} />
        <Testimonials />
      </main>

      <Footer onTopup={() => setPricingOpen(true)} onGuide={() => setGuideOpen(true)} />
      {pricingOpen && <PricingModal user={user} onClose={() => setPricingOpen(false)} notify={notify} />}
      {authOpen && <AuthModal user={user} onClose={() => setAuthOpen(false)} onAuthed={login} notify={notify} />}
      {refOpen && <ReferralModal user={user} onClose={() => setRefOpen(false)} notify={notify} />}
      {guideOpen && <ServicesGuideModal onClose={() => setGuideOpen(false)} />}
      <Toast msg={toast} />
    </div>
  );
}

function Header({ credits, authed, user, onTopup, onAuth, onReferral, onLogout }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo"><img src="/logo.png" alt="DocuAnalytics AI" className="logo-img" /> Docu<span className="grad">Analytics</span> AI</div>
        <nav className="nav">
          <span className="credits-badge" data-testid="credits-badge"><Zap size={15} /> {credits} Crediti</span>
          <button className="btn btn-primary btn-sm" data-testid="topup-btn" onClick={onTopup}><CreditCard size={15} /> Ricarica</button>
          {authed ? (
            <>
              <button className="btn btn-sm" data-testid="referral-btn" onClick={onReferral}><Gift size={15} /> Invita</button>
              <span className="btn btn-sm btn-ghost" data-testid="user-badge" title={user.email}><User size={15} /> {user.name || "Account"}</span>
              <button className="btn btn-sm" data-testid="logout-btn" onClick={onLogout}><LogOut size={15} /></button>
            </>
          ) : (
            <button className="btn btn-accent btn-sm" data-testid="auth-btn" onClick={onAuth}><LogIn size={15} /> Accedi</button>
          )}
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

function Services({ onGuide }) {
  const cards = [
    { Icon: Landmark, t: "F24 & Fatture Elettroniche", d: "Quadratura automatica Debito/Credito/Saldo, avviso visto conformità IVA sopra €5.000, controllo IBAN esteri e Prima Nota per Zucchetti/TeamSystem." },
    { Icon: ScrollText, t: "Contratti & Visure Camerali", d: "Rilevamento clausole vessatorie (Art. 1341 c.c.), preavvisi recesso, verifica antiriciclaggio KYC/AML con estrazione REA, soci e amministratori." },
    { Icon: Wallet, t: "Buste Paga & HR", d: "Quadratura Lordo/INPS/IRPEF/Netto, TFR maturato, compliance GDPR & EU AI Act con server 100% in UE e crittografia AES 256-bit." },
  ];
  return (
    <section className="section" id="servizi">
      <div className="accent-bar" />
      <h2 className="section-title">Servizi AI Specialistici per il Tuo Settore</h2>
      <p className="section-sub mb1">Algoritmi addestrati per Commercialisti, Avvocati, Notai e CFO</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {cards.map((c) => (
          <div className="glass pad" key={c.t}>
            <c.Icon size={28} color="var(--accent)" />
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: ".6rem 0 .4rem" }}>{c.t}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: ".85rem", lineHeight: 1.55 }}>{c.d}</p>
          </div>
        ))}
      </div>
      <div className="center mt2">
        <button className="btn btn-accent" data-testid="open-guide-btn" onClick={onGuide}><BookOpen size={16} /> Guida Completa ai Servizi Enterprise</button>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    Icon: ShieldAlert, tag: "AUDIT", t: "Rilevatore Red-Flag AI",
    d: "Un secondo cervello AI che controlla i tuoi documenti e segnala automaticamente i rischi prima che diventino un problema.",
    points: [
      "Quadratura automatica di F24, fatture e buste paga (Debito/Credito/Netto)",
      "Allerta clausole vessatorie nei contratti (Art. 1341 c.c.)",
      "Rilevamento IBAN esteri e anomalie antiriciclaggio (AML)",
      "Avviso visto di conformità IVA per crediti superiori a €5.000",
    ],
  },
  {
    Icon: MessageSquare, tag: "COPILOT", t: "Copilot Interattivo",
    d: "Fai domande in linguaggio naturale sui tuoi documenti e ricevi risposte immediate, come un assistente esperto sempre disponibile.",
    points: [
      "Chiedi \"Qual è il totale da pagare?\" e ottieni la risposta all'istante",
      "Riepiloghi e spiegazioni di clausole complesse in italiano semplice",
      "Confronto tra documenti e verifica dei dati chiave",
      "Basato su AI Gemini, risposte contestuali solo sul tuo documento",
    ],
  },
];

function NewFeatures() {
  return (
    <section className="section" id="funzionalita">
      <div className="accent-bar" />
      <div className="flex aic gap mb1"><h2 className="section-title">Nuove Funzionalità Avanzate</h2><span className="badge badge-new">NEW</span></div>
      <p className="section-sub mb1">Non solo estrazione dati: intelligenza che protegge il tuo studio</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        {FEATURES.map((f) => (
          <div className="glass pad" key={f.t}>
            <div className="flex aic gap mb1"><f.Icon size={26} color="var(--accent)" /><span className="badge badge-info">{f.tag}</span></div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: ".4rem 0" }}>{f.t}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: ".88rem", lineHeight: 1.55, marginBottom: ".6rem" }}>{f.d}</p>
            {f.points.map((p) => (
              <div className="flex gap" key={p} style={{ alignItems: "flex-start", marginBottom: ".4rem" }}>
                <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: ".84rem", color: "var(--text-secondary)" }}>{p}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

const TUTORIAL_STEPS = [
  { n: 1, t: "Carica il documento", d: "Trascina o seleziona una fattura, un F24, un contratto, una visura o una busta paga (PDF, JPG, PNG)." },
  { n: 2, t: "Scegli il tipo (opzionale)", d: "Seleziona la categoria del documento per un'estrazione ancora più precisa, oppure lascia che l'AI la rilevi da sola." },
  { n: 3, t: "Analizza con l'AI", d: "In circa 2 secondi ottieni tutti i dati strutturati (importi, date, P.IVA, IBAN, totali) e l'audit anti-errore." },
  { n: 4, t: "Chiedi al Copilot", d: "Fai domande sul documento in linguaggio naturale e ricevi risposte immediate e contestuali." },
  { n: 5, t: "Esporta i dati", d: "Scarica i risultati in CSV o JSON, pronti per il tuo gestionale (Zucchetti, TeamSystem, ecc.)." },
];

const DEMO_SCENES = [
  {
    title: "1. Carica il documento",
    render: () => (
      <div className="demo-doc fade">
        <FileText size={30} color="var(--accent)" />
        <div>
          <div style={{ fontWeight: 700 }}>Fattura_128_2026.pdf</div>
          <div style={{ color: "var(--text-muted)", fontSize: ".78rem" }}>caricato · 214 KB</div>
        </div>
        <span className="badge badge-ok" style={{ marginLeft: "auto" }}>OK</span>
      </div>
    ),
  },
  {
    title: "2. Analisi con l'Intelligenza Artificiale",
    render: () => (
      <div className="demo-pipe">
        {["Parsing", "Classificazione", "Estrazione", "Validazione"].map((s, i) => (
          <div className="demo-pstep" key={s} style={{ animationDelay: `${i * 0.4}s` }}>
            <div className="demo-pcircle"><CheckCircle2 size={16} color="var(--success)" /></div>
            <span>{s}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "3. Dati estratti automaticamente",
    render: () => (
      <div style={{ width: "100%" }}>
        {[["Numero", "128/2026"], ["Imponibile", "1.000,00 €"], ["IVA 22%", "220,00 €"], ["Totale", "1.220,00 €"], ["IBAN", "IT60X0542811101…"]].map(([k, v], i) => (
          <div className="demo-field fade" key={k} style={{ animationDelay: `${i * 0.18}s` }}>
            <span style={{ color: "var(--text-muted)" }}>{k}</span><strong>{v}</strong>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "4. AI Red-Flag Audit",
    render: () => (
      <div style={{ width: "100%" }}>
        <div className="demo-audit audit-ok fade"><CheckCircle2 size={15} /> Quadratura IVA corretta (1.000 + 220 = 1.220 €)</div>
        <div className="demo-audit audit-ok fade" style={{ animationDelay: ".2s" }}><CheckCircle2 size={15} /> IBAN italiano valido</div>
        <div className="demo-audit audit-warning fade" style={{ animationDelay: ".4s" }}><ShieldAlert size={15} /> Scadenza pagamento tra 15 giorni</div>
      </div>
    ),
  },
  {
    title: "5. Chiedi all'AI Copilot",
    render: () => (
      <div className="demo-chat">
        <div className="msg u fade">Qual è il totale da pagare?</div>
        <div className="msg a fade" style={{ animationDelay: ".5s" }}>Il totale da pagare è <strong>1.220,00 €</strong>, con scadenza 30/04/2026.</div>
      </div>
    ),
  },
];

function DemoPlayer() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setScene((s) => (s + 1) % DEMO_SCENES.length), 3000);
    return () => clearTimeout(t);
  }, [scene, playing]);
  const cur = DEMO_SCENES[scene];
  return (
    <div className="glass demo-player" data-testid="tutorial-video">
      <div className="demo-chrome">
        <span className="dotc r" /><span className="dotc y" /><span className="dotc g" />
        <span className="demo-url">docuanalytics.online — Demo</span>
        <button className="demo-play" data-testid="demo-playpause" onClick={() => setPlaying((p) => !p)}>
          {playing ? "❚❚" : <Play size={14} />}
        </button>
      </div>
      <div className="demo-stage" key={scene}>
        <div className="demo-scene-title">{cur.title}</div>
        <div className="demo-scene-body">{cur.render()}</div>
      </div>
      <div className="demo-progress">
        {DEMO_SCENES.map((_, i) => (
          <span key={i} className={`demo-dot ${i === scene ? "on" : ""}`} onClick={() => setScene(i)} data-testid={`demo-dot-${i}`} />
        ))}
      </div>
    </div>
  );
}

function Tutorials() {
  return (
    <section className="section" id="tutorial">
      <div className="accent-bar" />
      <div className="flex aic gap mb1"><h2 className="section-title">Come Funziona — Tutorial</h2><Play size={20} color="var(--accent)" /></div>
      <p className="section-sub mb1">Guarda la demo animata: analizza il tuo primo documento in meno di un minuto</p>

      <DemoPlayer />

      <div className="grid mt2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        {TUTORIAL_STEPS.map((s) => (
          <div className="glass pad" key={s.n}>
            <div className="pcircle" style={{ margin: "0 0 .6rem", width: 40, height: 40, borderColor: "var(--accent)" }}>{s.n}</div>
            <h4 style={{ fontWeight: 800, fontSize: ".98rem", marginBottom: ".3rem" }}>{s.t}</h4>
            <p style={{ color: "var(--text-secondary)", fontSize: ".84rem", lineHeight: 1.5 }}>{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReferralBanner({ authed, onInvite }) {
  return (
    <section className="section">
      <div className="glass pad" style={{ textAlign: "center", border: "1px solid #00d2ff44" }}>
        <Gift size={34} color="var(--accent)" />
        <h2 className="section-title mt1">Invita un collega, guadagnate entrambi</h2>
        <p className="section-sub mb1">Per ogni collega che si registra con il tuo link ricevete <strong style={{ color: "var(--accent)" }}>+5 crediti a testa</strong>. Senza limiti.</p>
        <button className="btn btn-primary" data-testid="referral-cta" onClick={onInvite}>
          <Gift size={16} /> {authed ? "Ottieni il tuo link invito" : "Accedi e invita"}
        </button>
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
  const [subs, setSubs] = useState([]);

  const loadSubs = useCallback(() => {
    if (user.user_id) axios.get(`${API}/subscriptions/${user.user_id}`).then(({ data }) => setSubs(data.subscriptions || [])).catch(() => {});
  }, [user.user_id]);

  useEffect(() => { axios.get(`${API}/crypto/info`).then(({ data }) => setInfo(data)).catch(() => {}); loadSubs(); }, [loadSubs]);

  const cancelSub = async (id) => {
    try {
      const { data } = await axios.post(`${API}/subscriptions/cancel`, { user_id: user.user_id, subscription_id: id });
      notify(data.message || "Abbonamento in cancellazione."); loadSubs();
    } catch { notify("Errore annullamento abbonamento."); }
  };

  const packPkgs = info?.packages?.filter((p) => p.type === "pack") || [];
  const subPkgs = info?.packages?.filter((p) => p.type === "sub") || [];

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
            {subs.length > 0 && (
              <div className="glass pad mb1" data-testid="active-subs" style={{ border: "1px solid #00e67644" }}>
                <strong style={{ fontSize: ".9rem" }}>I tuoi abbonamenti</strong>
                {subs.map((s) => (
                  <div className="flex between aic wrapf" key={s.subscription_id} style={{ marginTop: ".5rem", gap: ".5rem" }}>
                    <span style={{ fontSize: ".82rem" }}>
                      {s.package_name} — €{s.amount}/mese
                      <span className={`badge ${s.status === "active" ? "badge-ok" : "badge-info"}`} style={{ marginLeft: 8 }}>
                        {s.cancel_at_period_end ? "in cancellazione" : s.status}
                      </span>
                    </span>
                    {!s.cancel_at_period_end && s.status === "active" && (
                      <button className="btn btn-sm" data-testid={`cancel-sub-${s.subscription_id}`} onClick={() => cancelSub(s.subscription_id)}>Annulla</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="section-sub mb1">Pacchetti Crediti (pagamento singolo)</p>
            <div className="price-grid mb1">{packPkgs.map((p) => Card(p, p.id === "pro"))}</div>
            <p className="section-sub mb1 mt2">Abbonamenti Studio (rinnovo mensile automatico dei crediti)</p>
            <div className="price-grid">{subPkgs.map((p) => Card(p, p.id === "sub_pro"))}</div>
            <p style={{ color: "var(--text-muted)", fontSize: ".74rem", marginTop: "1rem" }}>Pagamenti sicuri via Stripe (Managed Payments, IVA gestita da Stripe). Test: carta 4242 4242 4242 4242, data futura, CVC qualsiasi.</p>
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

function Footer({ onTopup, onGuide }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="flex aic gap" style={{ justifyContent: "center", marginBottom: ".4rem" }}>
          <img src="/logo.png" alt="DocuAnalytics AI" className="logo-img" />
          <p style={{ fontWeight: 800 }}>DocuAnalytics Enterprise — AI Document Intelligence</p>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: ".82rem", marginTop: ".3rem" }}>Estrazione automatica ad alta precisione per studi legali, notai e commercialisti • Server UE • GDPR</p>

        <div className="socials" data-testid="social-links">
          {SOCIALS.map(({ name, Icon, url }) => (
            <a key={name} className="social-btn" href={url} target="_blank" rel="noreferrer"
              aria-label={name} title={name} data-testid={`social-${name.toLowerCase().split(" ")[0]}`}>
              <Icon size={18} />
            </a>
          ))}
        </div>

        <div className="flex gap wrapf aic" style={{ justifyContent: "center", marginTop: "1rem" }}>
          <button className="btn btn-sm btn-ghost" onClick={onGuide}><BookOpen size={14} /> Guida ai servizi</button>
          <button className="btn btn-primary btn-sm" onClick={onTopup}><CreditCard size={14} /> Ricarica Crediti</button>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: ".72rem", marginTop: "1.2rem" }}>© {new Date().getFullYear()} DocuAnalytics AI · Tutti i diritti riservati</p>
      </div>
    </footer>
  );
}

function AuthModal({ user, onClose, onAuthed, notify }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fmtErr = (d) => (typeof d === "string" ? d : Array.isArray(d) ? d.map((e) => e.msg || "").join(" ") : "Errore. Riprova.");

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      if (mode === "register") {
        const { data } = await axios.post(`${API}/auth/register`, {
          email, password, name, user_id: user.user_id, ref: localStorage.getItem("da_ref") || undefined,
        });
        onAuthed(data.token, data.user); notify(`Benvenuto, ${data.user.name}! 🎉`); onClose();
      } else {
        const { data } = await axios.post(`${API}/auth/login`, { email, password });
        onAuthed(data.token, data.user); notify("Accesso effettuato ✅"); onClose();
      }
    } catch (e) {
      setErr(fmtErr(e?.response?.data?.detail) || "Errore. Riprova.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal glass pad fade" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} data-testid="auth-modal">
        <div className="modal-head">
          <h2 className="section-title flex aic gap"><Lock size={20} /> {mode === "login" ? "Accedi" : "Crea account"}</h2>
          <button className="close-x" data-testid="close-auth" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="tabs">
          <div className={`tab ${mode === "login" ? "active" : ""}`} data-testid="tab-login" onClick={() => setMode("login")}>Accedi</div>
          <div className={`tab ${mode === "register" ? "active" : ""}`} data-testid="tab-register" onClick={() => setMode("register")}>Registrati</div>
        </div>
        {mode === "register" && (
          <input className="input mb1" data-testid="auth-name" placeholder="Nome (es. Studio Rossi)" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className="input mb1" data-testid="auth-email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input mb1" data-testid="auth-password" type="password" placeholder="Password (min 6 caratteri)" value={password}
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        {mode === "register" && localStorage.getItem("da_ref") && (
          <p className="badge badge-ok mb1" style={{ display: "block" }}>🎁 Invito valido: riceverai +5 crediti bonus!</p>
        )}
        {err && <p style={{ color: "var(--error)", fontSize: ".82rem", marginBottom: ".6rem" }} data-testid="auth-error">{err}</p>}
        <button className="btn btn-primary" style={{ width: "100%" }} data-testid="auth-submit" disabled={loading} onClick={submit}>
          {loading ? <Loader2 className="spinner" /> : mode === "login" ? "Accedi" : "Registrati (+3 crediti gratis)"}
        </button>
        <p style={{ color: "var(--text-muted)", fontSize: ".76rem", marginTop: ".8rem", textAlign: "center" }}>
          Registrandoti salvi i tuoi crediti e puoi accedere da qualsiasi dispositivo.
        </p>
      </div>
    </div>
  );
}

function ReferralModal({ user, onClose, notify }) {
  const [info, setInfo] = useState(null);
  useEffect(() => { axios.get(`${API}/referral/${user.user_id}`).then(({ data }) => setInfo(data)).catch(() => {}); }, [user.user_id]);
  const link = info ? `${window.location.origin}/?ref=${info.referral_code}` : "";
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal glass pad fade" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()} data-testid="referral-modal">
        <div className="modal-head">
          <h2 className="section-title flex aic gap"><Gift size={20} /> Invita e guadagna</h2>
          <button className="close-x" data-testid="close-referral" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="section-sub mb1">Condividi il tuo link: tu e il tuo collega ricevete <strong style={{ color: "var(--accent)" }}>+5 crediti</strong> quando lui si registra.</p>
        <div className="addr" data-testid="referral-link">{link || "..."}</div>
        <div className="flex gap wrapf">
          <button className="btn btn-primary btn-sm" data-testid="copy-referral" onClick={() => { navigator.clipboard.writeText(link); notify("Link copiato!"); }}><Copy size={14} /> Copia link</button>
          <a className="btn btn-sm" href={`https://wa.me/?text=${encodeURIComponent("Analizza i tuoi documenti con l'AI, provalo gratis: " + link)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="btn btn-sm" href={`https://t.me/share/url?url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">Telegram</a>
        </div>
        {info && <p className="mt2" style={{ fontSize: ".85rem" }}>Colleghi invitati: <strong style={{ color: "var(--accent)" }} data-testid="invited-count">{info.invited_count}</strong> · Crediti guadagnati: <strong>{info.invited_count * info.bonus_per_invite}</strong></p>}
      </div>
    </div>
  );
}

const GUIDE_SECTIONS = [
  { Icon: Landmark, t: "F24 & Fatture Elettroniche", items: [
    "Estrazione automatica di codici tributo, importi, scadenze e saldi",
    "Quadratura Debito / Credito / Saldo finale con avviso in caso di squadratura",
    "Rilevamento visto di conformità per crediti IVA superiori a €5.000",
    "Controllo IBAN esteri e generazione Prima Nota per Zucchetti / TeamSystem / Datev",
  ]},
  { Icon: ScrollText, t: "Contratti & Documenti Legali", items: [
    "Individuazione clausole vessatorie ai sensi dell'Art. 1341 c.c.",
    "Estrazione parti, oggetto, durata, corrispettivi e termini di recesso",
    "Segnalazione preavvisi e scadenze contrattuali critiche",
    "Riepilogo in linguaggio chiaro delle clausole complesse",
  ]},
  { Icon: Building2, t: "Visure Camerali", items: [
    "Estrazione numero REA, P.IVA, sede, capitale sociale e PEC",
    "Elenco soci, amministratori e poteri di firma",
    "Verifiche antiriciclaggio (KYC / AML) e titolare effettivo",
    "Stato attività e procedure in corso",
  ]},
  { Icon: Wallet, t: "Buste Paga & HR", items: [
    "Quadratura Lordo / Contributi INPS / IRPEF / Netto in busta",
    "Calcolo e verifica TFR maturato",
    "Compliance GDPR ed EU AI Act con dati trattati 100% in UE",
    "Crittografia AES 256-bit dei documenti",
  ]},
];

function ServicesGuideModal({ onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal glass pad fade" onClick={(e) => e.stopPropagation()} data-testid="guide-modal">
        <div className="modal-head">
          <h2 className="section-title flex aic gap"><BookOpen size={20} /> Guida Completa ai Servizi Enterprise</h2>
          <button className="close-x" data-testid="close-guide" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="section-sub mb1">Tutto ciò che DocuAnalytics AI estrae e verifica per te, categoria per categoria.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          {GUIDE_SECTIONS.map((g) => (
            <div className="glass pad" key={g.t}>
              <div className="flex aic gap mb1"><g.Icon size={24} color="var(--accent)" /><strong>{g.t}</strong></div>
              {g.items.map((it) => (
                <div className="flex gap" key={it} style={{ alignItems: "flex-start", marginBottom: ".4rem" }}>
                  <CheckCircle2 size={15} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: ".84rem", color: "var(--text-secondary)" }}>{it}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="glass pad mt2 flex aic gap wrapf" style={{ justifyContent: "space-between" }}>
          <span className="flex aic gap"><Sparkles size={18} color="var(--accent)" /> Ogni analisi include l'AI Red-Flag Audit e il Copilot interattivo.</span>
          <button className="btn btn-primary btn-sm" data-testid="guide-close-cta" onClick={onClose}>Inizia ora <ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
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
