import { useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, BookOpen, Sparkles, CreditCard } from "lucide-react";

const SITE = "https://docuanalytics.online";
const DEFAULT_DESC = "Analisi documenti automatica con Intelligenza Artificiale: carica fatture, contratti, visure camerali ed F24 ed estrai i dati in 2 secondi. OCR, audit anti-errore e copilot AI per commercialisti, avvocati e notai.";
const DEFAULT_TITLE = "DocuAnalytics AI — Analisi Documenti con Intelligenza Artificiale | Fatture, F24, Contratti";

/* ---------------- SEO content hub (IT — mercato target: professionisti italiani) ---------------- */
export const ARTICLES = [
  {
    slug: "analisi-fatture-elettroniche-ai",
    title: "Analisi delle fatture elettroniche con l'AI: come estrarre i dati in 2 secondi",
    desc: "Guida pratica per commercialisti: come usare l'Intelligenza Artificiale per leggere fatture elettroniche, estrarre imponibile, IVA, IBAN e totali ed evitare errori di quadratura.",
    date: "2026-06-02",
    read: "6 min",
    tag: "Fatture",
    excerpt: "Dall'upload del file all'estrazione automatica di imponibile, IVA e IBAN: come l'AI azzera la digitazione manuale e segnala le anomalie prima che diventino un problema.",
    body: [
      { h: null, p: ["L'inserimento manuale dei dati delle fatture è una delle attività più ripetitive e a rischio errore in uno studio. Un'AI di document intelligence come DocuAnalytics legge il documento (PDF o immagine), lo classifica come fattura ed estrae automaticamente tutti i campi chiave in pochi secondi."] },
      { h: "Quali dati estrae l'AI da una fattura", p: ["Il modello riconosce e struttura i dati indipendentemente dal layout del fornitore:"], li: ["Numero e data della fattura", "Cedente/prestatore e cessionario/committente con P.IVA e codice fiscale", "Imponibile, aliquota e importo IVA, totale documento", "IBAN e modalità di pagamento", "Scadenze e condizioni di pagamento"] },
      { h: "Quadratura automatica e controllo anti-errore", p: ["Oltre all'estrazione, l'AI verifica la coerenza aritmetica: imponibile + IVA = totale. Se il documento non quadra, ricevi un avviso immediato. Il sistema segnala anche IBAN esteri e importi anomali, utili per i controlli antiriciclaggio."] },
      { h: "Dall'estrazione al gestionale", p: ["I dati estratti si esportano in CSV o JSON, pronti per l'importazione in gestionali come Zucchetti, TeamSystem o Datev, riducendo drasticamente i tempi di Prima Nota."] },
      { h: "Come iniziare", p: ["Carica la tua prima fattura e ottieni l'estrazione completa in 2 secondi. Hai 3 crediti gratuiti per provare senza registrazione."] },
    ],
  },
  {
    slug: "controllo-quadratura-f24",
    title: "Controllo e quadratura del Modello F24: guida per commercialisti",
    desc: "Come verificare automaticamente codici tributo, importi e saldi di un F24 con l'Intelligenza Artificiale, individuando squadrature e il visto di conformità IVA sopra i 5.000 €.",
    date: "2026-06-04",
    read: "5 min",
    tag: "F24",
    excerpt: "Codici tributo, saldi Debito/Credito e visto di conformità: come l'AI controlla un F24 e ti avvisa prima dell'invio.",
    body: [
      { h: null, p: ["Il Modello F24 concentra molte informazioni critiche in poco spazio. Un errore in un codice tributo o in un saldo può generare sanzioni. L'AI legge l'F24 ed esegue i controlli al posto tuo."] },
      { h: "Cosa verifica l'AI su un F24", li: ["Estrazione di codici tributo, importi a debito e a credito, periodo di riferimento", "Quadratura Debito / Credito / Saldo finale con avviso in caso di squadratura", "Rilevamento del visto di conformità obbligatorio per crediti IVA superiori a 5.000 €", "Controllo della coerenza tra sezioni (Erario, INPS, Regioni, IMU)"] },
      { h: "Perché conta la quadratura automatica", p: ["Il controllo manuale dei saldi è lento e soggetto a distrazioni. L'audit anti-errore integrato confronta i totali e segnala immediatamente ogni incoerenza, così puoi correggere prima dell'invio telematico."] },
      { h: "Integrazione nel flusso di lavoro", p: ["I dati dell'F24 possono essere esportati e archiviati insieme al resto della documentazione del cliente. Ogni analisi include anche il Copilot AI, a cui puoi chiedere in linguaggio naturale: \"Qual è il saldo finale?\"."] },
      { h: "Prova subito", p: ["Carica un F24 e verifica la quadratura in automatico. I primi 3 controlli sono gratuiti."] },
    ],
  },
  {
    slug: "clausole-vessatorie-contratti-ai",
    title: "Clausole vessatorie nei contratti (Art. 1341 c.c.): individuarle con l'AI",
    desc: "Guida per avvocati e studi legali: come l'Intelligenza Artificiale rileva clausole vessatorie, termini di recesso e scadenze critiche nei contratti, con riepilogo in linguaggio chiaro.",
    date: "2026-06-06",
    read: "6 min",
    tag: "Contratti",
    excerpt: "Individuazione automatica delle clausole vessatorie ex Art. 1341 c.c., preavvisi e scadenze: l'AI legge il contratto e ti segnala i rischi.",
    body: [
      { h: null, p: ["Rileggere ogni contratto per intero è dispendioso. Un'AI addestrata sul linguaggio giuridico individua le clausole potenzialmente vessatorie e i punti di attenzione, lasciando al professionista il giudizio finale."] },
      { h: "Cosa rileva l'AI in un contratto", li: ["Clausole potenzialmente vessatorie ai sensi dell'Art. 1341 c.c.", "Parti, oggetto, durata, corrispettivi e termini di recesso", "Preavvisi e scadenze contrattuali critiche", "Rinnovi taciti e penali"] },
      { h: "Riepilogo in linguaggio chiaro", p: ["L'AI genera una sintesi comprensibile delle clausole complesse, utile per confronti rapidi con il cliente. Con il Copilot puoi chiedere: \"Esiste una clausola di recesso anticipato?\" e ottenere la risposta con il riferimento al testo."] },
      { h: "Privacy e conformità", p: ["I documenti sono trattati su server 100% in UE con crittografia AES 256-bit, nel rispetto del GDPR e dell'EU AI Act — un requisito imprescindibile per gli studi legali."] },
      { h: "Inizia l'analisi", p: ["Carica un contratto e ricevi l'elenco dei punti di attenzione in pochi secondi, con 3 crediti gratuiti."] },
    ],
  },
  {
    slug: "visure-camerali-antiriciclaggio-kyc-aml",
    title: "Visure camerali e antiriciclaggio (KYC/AML): estrazione dati automatica",
    desc: "Come estrarre automaticamente REA, P.IVA, soci, amministratori e titolare effettivo da una visura camerale per le verifiche antiriciclaggio (KYC/AML) con l'Intelligenza Artificiale.",
    date: "2026-06-08",
    read: "5 min",
    tag: "Visure",
    excerpt: "REA, soci, amministratori e titolare effettivo: come l'AI accelera le verifiche KYC/AML a partire dalla visura camerale.",
    body: [
      { h: null, p: ["Le verifiche antiriciclaggio richiedono di identificare rapidamente la compagine societaria e il titolare effettivo. L'AI estrae questi dati direttamente dalla visura camerale, riducendo i tempi dell'adeguata verifica."] },
      { h: "Dati estratti dalla visura", li: ["Numero REA, P.IVA/codice fiscale, sede legale, capitale sociale e PEC", "Elenco soci con relative quote", "Amministratori e poteri di firma", "Stato attività e procedure in corso"] },
      { h: "Supporto alle verifiche KYC/AML", p: ["Il sistema evidenzia gli elementi utili all'individuazione del titolare effettivo e segnala anomalie. Resta sempre responsabilità del professionista la valutazione finale del rischio."] },
      { h: "Archiviazione e coerenza dei dati", p: ["I dati estratti si esportano in CSV/JSON e possono essere confrontati con altri documenti del fascicolo cliente per verificarne la coerenza."] },
      { h: "Prova la demo", p: ["Carica una visura e ottieni l'estrazione strutturata della compagine societaria. I primi 3 documenti sono gratuiti."] },
    ],
  },
];

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
  el.setAttribute("href", href);
}
function injectJsonLd(id, obj) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = id; document.head.appendChild(el); }
  el.textContent = JSON.stringify(obj);
}
function useSeo({ title, description, canonical, jsonLd }) {
  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertCanonical(canonical);
    if (jsonLd) injectJsonLd("ld-blog", jsonLd);
    window.scrollTo(0, 0);
    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta("name", "description", DEFAULT_DESC);
      upsertMeta("property", "og:title", "DocuAnalytics AI — Analisi Documenti Automatica con AI per Studi e Aziende");
      upsertMeta("property", "og:description", "Classificazione ed estrazione dati automatica da fatture, F24, visure e contratti in 2 secondi. Prova subito con 3 crediti gratis.");
      upsertMeta("property", "og:url", SITE + "/");
      upsertCanonical(SITE + "/");
      const ld = document.getElementById("ld-blog");
      if (ld) ld.remove();
    };
  }, [title, description, canonical, jsonLd]);
}

function BlogChrome({ children }) {
  return (
    <div className="App">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo" data-testid="blog-logo-home" style={{ textDecoration: "none", color: "inherit" }}>
            <img src="/logo.png" alt="DocuAnalytics AI" className="logo-img" /> Docu<span className="grad">Analytics</span> AI
          </Link>
          <nav className="nav">
            <Link to="/" className="btn btn-sm btn-ghost" data-testid="blog-nav-home"><ArrowLeft size={15} /> Home</Link>
            <Link to="/" className="btn btn-primary btn-sm" data-testid="blog-nav-cta"><Sparkles size={15} /> Prova gratis</Link>
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="footer">
        <div className="wrap">
          <p style={{ fontWeight: 800 }}>DocuAnalytics AI — Guide per Studi Professionali</p>
          <p style={{ color: "var(--text-muted)", fontSize: ".82rem", marginTop: ".3rem" }}>Approfondimenti su analisi documenti, fatture, F24, contratti e visure con Intelligenza Artificiale.</p>
          <div className="flex gap wrapf aic" style={{ justifyContent: "center", marginTop: "1rem" }}>
            <Link to="/blog" className="btn btn-sm btn-ghost"><BookOpen size={14} /> Tutte le guide</Link>
            <Link to="/" className="btn btn-primary btn-sm"><CreditCard size={14} /> Vai all'app</Link>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: ".72rem", marginTop: "1.2rem" }}>© {new Date().getFullYear()} DocuAnalytics AI · Tutti i diritti riservati</p>
        </div>
      </footer>
    </div>
  );
}

export function BlogIndex() {
  useSeo({
    title: "Blog e Guide AI per Commercialisti, Avvocati e Notai | DocuAnalytics AI",
    description: "Guide pratiche sull'analisi documenti con Intelligenza Artificiale: fatture elettroniche, controllo F24, clausole vessatorie nei contratti e antiriciclaggio da visure camerali.",
    canonical: SITE + "/blog",
    jsonLd: {
      "@context": "https://schema.org", "@type": "Blog",
      "name": "Blog e Guide — DocuAnalytics AI", "url": SITE + "/blog",
      "blogPost": ARTICLES.map((a) => ({ "@type": "BlogPosting", "headline": a.title, "url": `${SITE}/blog/${a.slug}`, "datePublished": a.date, "description": a.desc })),
    },
  });
  return (
    <BlogChrome>
      <section className="hero fade" style={{ paddingBottom: "1.5rem" }}>
        <div className="hero-badges mb1"><span className="badge badge-info">GUIDE & RISORSE</span></div>
        <h1>Blog e Guide<br /><span className="grad">Document Intelligence AI</span></h1>
        <p>Approfondimenti pratici per commercialisti, avvocati e notai: come usare l'Intelligenza Artificiale per analizzare fatture, F24, contratti e visure camerali.</p>
      </section>

      <section className="section" data-testid="blog-list">
        <div className="accent-bar" />
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          {ARTICLES.map((a) => (
            <Link key={a.slug} to={`/blog/${a.slug}`} data-testid={`blog-card-${a.slug}`}
              className="glass pad blog-card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <div className="flex aic gap mb1">
                <span className="badge badge-info">{a.tag}</span>
                <span className="flex aic gap" style={{ color: "var(--text-muted)", fontSize: ".74rem" }}><Clock size={13} /> {a.read}</span>
              </div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.3, margin: ".2rem 0 .5rem" }}>{a.title}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: ".86rem", lineHeight: 1.55 }}>{a.excerpt}</p>
              <span className="flex aic gap grad" style={{ fontWeight: 700, fontSize: ".85rem", marginTop: ".8rem" }}>Leggi la guida <ArrowRight size={15} /></span>
            </Link>
          ))}
        </div>
      </section>
    </BlogChrome>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const article = ARTICLES.find((a) => a.slug === slug);

  useSeo({
    title: article ? `${article.title} | DocuAnalytics AI` : DEFAULT_TITLE,
    description: article ? article.desc : DEFAULT_DESC,
    canonical: `${SITE}/blog/${slug}`,
    jsonLd: article ? {
      "@context": "https://schema.org", "@type": "BlogPosting",
      "headline": article.title, "description": article.desc,
      "datePublished": article.date, "dateModified": article.date,
      "author": { "@type": "Organization", "name": "DocuAnalytics AI" },
      "publisher": { "@type": "Organization", "name": "DocuAnalytics AI", "logo": { "@type": "ImageObject", "url": SITE + "/logo.png" } },
      "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE}/blog/${slug}` },
      "image": SITE + "/og-image.png",
    } : null,
  });

  if (!article) {
    return (
      <BlogChrome>
        <section className="section center" data-testid="blog-not-found" style={{ paddingTop: "3rem" }}>
          <h1>Guida non trovata</h1>
          <p className="section-sub mb1">La risorsa che cerchi non esiste o è stata spostata.</p>
          <button className="btn btn-primary" onClick={() => navigate("/blog")}><BookOpen size={16} /> Tutte le guide</button>
        </section>
      </BlogChrome>
    );
  }

  return (
    <BlogChrome>
      <article className="section fade article-body" data-testid="blog-article">
        <Link to="/blog" className="flex aic gap" data-testid="article-back" style={{ color: "var(--text-muted)", fontSize: ".82rem", textDecoration: "none", marginBottom: "1rem" }}>
          <ArrowLeft size={14} /> Tutte le guide
        </Link>
        <div className="flex aic gap mb1">
          <span className="badge badge-info">{article.tag}</span>
          <span className="flex aic gap" style={{ color: "var(--text-muted)", fontSize: ".74rem" }}><Clock size={13} /> {article.read} di lettura</span>
        </div>
        <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.6rem)", lineHeight: 1.2 }}>{article.title}</h1>
        <p className="section-sub" style={{ marginTop: ".6rem", marginBottom: "1.5rem" }}>{article.excerpt}</p>

        {article.body.map((sec, i) => (
          <div key={i} className="mb1">
            {sec.h && <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "1.4rem 0 .6rem" }}>{sec.h}</h2>}
            {(sec.p || []).map((para, j) => (
              <p key={j} style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: ".7rem" }}>{para}</p>
            ))}
            {sec.li && (
              <div style={{ marginTop: ".2rem" }}>
                {sec.li.map((item, k) => (
                  <div className="flex gap" key={k} style={{ alignItems: "flex-start", marginBottom: ".5rem" }}>
                    <CheckCircle2 size={17} color="var(--success)" style={{ flexShrink: 0, marginTop: 3 }} />
                    <span style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="glass pad mt2 flex aic gap wrapf" style={{ justifyContent: "space-between", border: "1px solid #00d2ff44" }}>
          <span className="flex aic gap"><Sparkles size={20} color="var(--accent)" /> Prova DocuAnalytics AI: 3 crediti gratis, nessuna carta richiesta.</span>
          <Link to="/" className="btn btn-primary" data-testid="article-cta"><CreditCard size={16} /> Analizza un documento <ArrowRight size={15} /></Link>
        </div>

        <div className="mt2">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: ".8rem" }}>Altre guide</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3).map((a) => (
              <Link key={a.slug} to={`/blog/${a.slug}`} className="glass pad blog-card" data-testid={`related-${a.slug}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <span className="badge badge-info mb1" style={{ display: "inline-block" }}>{a.tag}</span>
                <div style={{ fontWeight: 700, fontSize: ".92rem", lineHeight: 1.35 }}>{a.title}</div>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </BlogChrome>
  );
}
