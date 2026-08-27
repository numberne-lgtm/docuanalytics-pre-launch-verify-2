import { useEffect, useState, useRef, useCallback, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";
import {
  Upload, Zap, CreditCard, FileText, ScrollText, Building2, Landmark, Wallet,
  Bot, ShieldAlert, MessageSquare, Star, CheckCircle2, X, Send, Loader2,
  Download, ChevronRight, Bitcoin, LogIn, LogOut, User, Gift, BookOpen,
  Sparkles, Copy, Play, Lock, Facebook, Linkedin, Youtube, Globe,
  ShieldCheck, Trash2, BadgeCheck, Ban, ChevronDown,
  Clock, AlertTriangle, Search, Rocket, Scale, FileSignature, TrendingUp,
  Users, Briefcase, Files, Server, ArrowRight, Mail
} from "lucide-react";
import { BlogIndex, BlogPost } from "./Blog";
import { MT, MARK, SECTORS } from "./content";

/* string -> lucide icon map for data-driven marketing sections */
const ICONS = {
  Clock, AlertTriangle, Search, Rocket, Upload, Zap, Landmark, Scale,
  FileSignature, TrendingUp, Users, Briefcase, Files, Server, Ban, Trash2,
  BadgeCheck, Lock, ShieldCheck, FileText, ScrollText, Building2, Wallet,
};

/* smooth-scroll to a homepage section id (accounts for sticky header) */
const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};
/* lightweight GA4 event helper (no-op if gtag not present) */
const track = (event, params = {}) => { try { if (window.gtag) window.gtag("event", event, params); } catch (e) { /* noop */ } };

/* Hero A/B test: assign a sticky 50/50 variant, persisted in localStorage */
function useHeroVariant() {
  const [v] = useState(() => {
    let x = localStorage.getItem("da_hero_ab");
    if (x !== "A" && x !== "B") { x = Math.random() < 0.5 ? "A" : "B"; localStorage.setItem("da_hero_ab", x); }
    return x;
  });
  return v;
}

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ---------------- i18n ---------------- */
const LANGS = [
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];
const T = {
  it: {
    credits: "Crediti", topup: "Ricarica", login: "Accedi", invite: "Invita", logout: "Esci",
    hero_kicker: "DOCUMENT INTELLIGENCE ENTERPRISE",
    hero_t1: "Analisi Documenti con", hero_t2: "Intelligenza Artificiale",
    hero_sub: "Carica fatture, contratti, visure ed F24. L'AI li classifica ed estrae automaticamente tutti i dati chiave in pochi secondi, con audit anti-errore integrato.",
    up_title: "Carica Documento", up_sub: "Trascina un file o scegli il tipo di documento per l'analisi immediata",
    up_drop: "Trascina qui il tuo documento", up_hint: "PDF, JPG, PNG — Max 10MB",
    analyze: "Analizza Documento", analyzing: "Analisi in corso...",
    results_title: "Risultati Analisi",
    feat_title: "Nuove Funzionalità Avanzate", feat_sub: "Non solo estrazione dati: intelligenza che protegge il tuo studio",
    serv_title: "Servizi AI Specialistici per il Tuo Settore", serv_sub: "Algoritmi addestrati per Commercialisti, Avvocati, Notai e CFO",
    guide_btn: "Guida Completa ai Servizi Enterprise",
    tut_title: "Come Funziona — Tutorial", tut_sub: "Guarda la demo animata: analizza il tuo primo documento in meno di un minuto",
    ref_title: "Invita un collega, guadagnate entrambi", ref_sub_a: "Per ogni collega che si registra con il tuo link ricevete", ref_sub_b: "+5 crediti a testa", ref_sub_c: ". Senza limiti.",
    ref_cta_in: "Ottieni il tuo link invito", ref_cta_out: "Accedi e invita",
    testi_title: "Cosa dicono gli Studi Professionali", testi_sub: "4.9/5 — Basato su 482 recensioni verificate",
    foot_desc: "Estrazione automatica ad alta precisione per studi legali, notai e commercialisti • Server UE • GDPR",
    foot_guide: "Guida ai servizi", foot_topup: "Ricarica Crediti",
    pric_title: "Ricarica Crediti", tab_card: "Carta / Stripe", tab_crypto: "Crypto (BTC/USDT)",
    auth_login: "Accedi", auth_register: "Crea account", lang_label: "Lingua",
    auth_submit_reg: "Registrati (+3 crediti gratis)", auth_pw_ph: "Password (min 6 caratteri)", auth_name_ph: "Nome (es. Studio Rossi)", auth_helper: "Registrandoti salvi i tuoi crediti e puoi accedere da qualsiasi dispositivo.", auth_bonus: "🎁 Invito valido: riceverai +5 crediti bonus!",
    ex_data: "Dati Estratti", no_fields: "Nessun campo strutturato rilevato.", no_anom: "Nessuna anomalia rilevata.", chat_empty: "Chiedi qualsiasi cosa sul documento, es. \"Qual è il totale da pagare?\"", chat_ph: "Fai una domanda...", exported: "Esportato", verified: "Verificato",
    pop: "POPOLARE", buy: "Acquista", per_month: "/mese", unlim_cr: "Crediti illimitati", cr: "crediti", your_subs: "I tuoi abbonamenti", cancelling: "in cancellazione", cancel: "Annulla", packs_ttl: "Pacchetti Crediti (pagamento singolo)", subs_ttl: "Abbonamenti Studio (rinnovo mensile automatico dei crediti)", stripe_note: "Pagamenti sicuri via Stripe (Managed Payments, IVA gestita da Stripe).", cr_step1: "1. Scegli pacchetto", cr_step2: "2. Scegli valuta", cr_order: "Registra ordine", copy_addr: "Copia indirizzo", unlim: "illimitati", cr_short: "cr",
    ref_ttl: "Invita e guadagna", ref_desc_a: "Condividi il tuo link: tu e il tuo collega ricevete", ref_desc_b: "+5 crediti", ref_desc_c: "quando lui si registra.", copy_link: "Copia link", invited_lbl: "Colleghi invitati", earned_lbl: "Crediti guadagnati", ref_share: "Analizza i tuoi documenti con l'AI, provalo gratis:",
    guide_ttl: "Guida Completa ai Servizi Enterprise", guide_sub: "Tutto ciò che DocuAnalytics AI estrae e verifica per te, categoria per categoria.", guide_foot: "Ogni analisi include l'AI Red-Flag Audit e il Copilot interattivo.", start_now: "Inizia ora",
    rights: "Tutti i diritti riservati", blog_link: "Guide",
    n_credits_out: "Crediti esauriti. Ricarica per continuare.", n_pay_cancel: "Pagamento annullato.", n_disconnected: "Disconnesso.", n_pay_verify: "Verifica pagamento in corso...", n_analyze_fail: "Analisi non riuscita.", n_copilot_err: "Errore nel copilot.", n_addr_copied: "Indirizzo copiato", n_link_copied: "Link copiato!", n_pay_start_err: "Errore nell'avvio del pagamento.", n_crypto_err: "Errore ordine crypto.", n_cancel_ok: "Abbonamento in cancellazione.", n_cancel_err: "Errore annullamento abbonamento.", n_welcome: "Benvenuto", n_login_ok: "Accesso effettuato ✅",
    n_pay_ok: "✅ Pagamento riuscito! Crediti aggiunti:", n_sub_ok: "✅ Abbonamento attivo! Crediti/mese:", n_renew: "Rinnovo automatico.", n_pay_pending: "Verifica in corso, i crediti appariranno a breve.", n_pay_fail: "Pagamento non completato.", auth_err: "Errore. Riprova.",
    priv_banner: "I tuoi documenti non vengono mai memorizzati. Ogni file viene elaborato in tempo reale e cancellato immediatamente dopo l'analisi: nessun dato resta sui nostri server.",
    badge_nostore: "Documenti non memorizzati", badge_delete: "Cancellazione immediata post-analisi", badge_gdpr: "Conforme al GDPR", badge_https: "Trasmissione cifrata HTTPS", badge_noshare: "Nessuna condivisione con terze parti",
    faq_title: "Domande frequenti", faq_q1: "I miei documenti sono al sicuro? Chi può accedervi?", faq_a1: "I tuoi documenti sono completamente al sicuro. DocuAnalytics non memorizza alcun file: ogni documento viene elaborato in tempo reale e cancellato permanentemente al termine dell'analisi, senza lasciare alcuna traccia sui nostri server. Nessun operatore umano né sistema automatico conserva o accede ai tuoi file. Pienamente conforme al GDPR.",
    faq_q2: "Quanto costa? Ci sono piani gratuiti?", faq_a2: "Puoi iniziare gratis con 3 crediti inclusi, senza carta di credito. Successivamente scegli tra pacchetti a pagamento singolo (da 19€) o abbonamenti mensili per studi con crediti ricorrenti. Paghi solo ciò che usi.",
    faq_q3: "Quali tipi di file e documenti posso analizzare?", faq_a3: "Puoi caricare PDF, JPG e PNG fino a 10 MB. DocuAnalytics riconosce fatture elettroniche, F24, contratti, visure camerali, buste paga e documenti generici, con estrazione dati e audit anti-errore.",
    faq_q4: "Quanto tempo richiede l'analisi di un documento?", faq_a4: "In media circa 2 secondi. L'AI classifica il documento, estrae tutti i campi chiave e genera l'audit e le risposte del Copilot quasi istantaneamente.",
    pp_onetime: "Pacchetti", pp_subs: "Abbonamenti",
  },
  en: {
    credits: "Credits", topup: "Top up", login: "Sign in", invite: "Invite", logout: "Log out",
    hero_kicker: "ENTERPRISE DOCUMENT INTELLIGENCE",
    hero_t1: "Document Analysis with", hero_t2: "Artificial Intelligence",
    hero_sub: "Upload invoices, contracts, company records and tax forms. The AI classifies them and automatically extracts all key data in seconds, with a built-in error-check audit.",
    up_title: "Upload Document", up_sub: "Drag a file or pick a document type for instant analysis",
    up_drop: "Drag your document here", up_hint: "PDF, JPG, PNG — Max 10MB",
    analyze: "Analyze Document", analyzing: "Analyzing...",
    results_title: "Analysis Results",
    feat_title: "Advanced New Features", feat_sub: "Beyond data extraction: intelligence that protects your practice",
    serv_title: "Specialized AI Services for Your Sector", serv_sub: "Algorithms trained for Accountants, Lawyers, Notaries and CFOs",
    guide_btn: "Full Guide to Enterprise Services",
    tut_title: "How It Works — Tutorial", tut_sub: "Watch the animated demo: analyze your first document in under a minute",
    ref_title: "Invite a colleague, you both earn", ref_sub_a: "For every colleague who signs up with your link you both get", ref_sub_b: "+5 credits each", ref_sub_c: ". No limits.",
    ref_cta_in: "Get your invite link", ref_cta_out: "Sign in to invite",
    testi_title: "What Professional Firms Say", testi_sub: "4.9/5 — Based on 482 verified reviews",
    foot_desc: "High-precision automatic extraction for law firms, notaries and accountants • EU servers • GDPR",
    foot_guide: "Services guide", foot_topup: "Buy Credits",
    pric_title: "Buy Credits", tab_card: "Card / Stripe", tab_crypto: "Crypto (BTC/USDT)",
    auth_login: "Sign in", auth_register: "Create account", lang_label: "Language",
    auth_submit_reg: "Sign up (+3 free credits)", auth_pw_ph: "Password (min 6 characters)", auth_name_ph: "Name (e.g. Rossi Firm)", auth_helper: "By signing up you keep your credits and can log in from any device.", auth_bonus: "🎁 Valid invite: you will get +5 bonus credits!",
    ex_data: "Extracted Data", no_fields: "No structured field detected.", no_anom: "No anomalies detected.", chat_empty: "Ask anything about the document, e.g. \"What's the total to pay?\"", chat_ph: "Ask a question...", exported: "Exported", verified: "Verified",
    pop: "POPULAR", buy: "Buy", per_month: "/month", unlim_cr: "Unlimited credits", cr: "credits", your_subs: "Your subscriptions", cancelling: "cancelling", cancel: "Cancel", packs_ttl: "Credit Packs (one-time payment)", subs_ttl: "Firm Subscriptions (automatic monthly credit renewal)", stripe_note: "Secure payments via Stripe (Managed Payments, VAT handled by Stripe).", cr_step1: "1. Choose package", cr_step2: "2. Choose currency", cr_order: "Place order", copy_addr: "Copy address", unlim: "unlimited", cr_short: "cr",
    ref_ttl: "Invite and earn", ref_desc_a: "Share your link: you and your colleague both get", ref_desc_b: "+5 credits", ref_desc_c: "when they sign up.", copy_link: "Copy link", invited_lbl: "Colleagues invited", earned_lbl: "Credits earned", ref_share: "Analyze your documents with AI, try it free:",
    guide_ttl: "Full Guide to Enterprise Services", guide_sub: "Everything DocuAnalytics AI extracts and verifies for you, category by category.", guide_foot: "Every analysis includes the AI Red-Flag Audit and the interactive Copilot.", start_now: "Start now",
    rights: "All rights reserved", blog_link: "Guides",
    n_credits_out: "Out of credits. Top up to continue.", n_pay_cancel: "Payment cancelled.", n_disconnected: "Logged out.", n_pay_verify: "Verifying payment...", n_analyze_fail: "Analysis failed.", n_copilot_err: "Copilot error.", n_addr_copied: "Address copied", n_link_copied: "Link copied!", n_pay_start_err: "Error starting payment.", n_crypto_err: "Crypto order error.", n_cancel_ok: "Subscription cancelling.", n_cancel_err: "Subscription cancel error.", n_welcome: "Welcome", n_login_ok: "Signed in ✅",
    n_pay_ok: "✅ Payment successful! Credits added:", n_sub_ok: "✅ Subscription active! Credits/month:", n_renew: "Automatic renewal.", n_pay_pending: "Verification in progress, credits will appear shortly.", n_pay_fail: "Payment not completed.", auth_err: "Error. Please try again.",
    priv_banner: "Your documents are never stored. Every file is processed in real time and deleted immediately after the analysis: no data remains on our servers.",
    badge_nostore: "Documents not stored", badge_delete: "Instant deletion after analysis", badge_gdpr: "GDPR compliant", badge_https: "Encrypted HTTPS transmission", badge_noshare: "No third-party sharing",
    faq_title: "Frequently asked questions", faq_q1: "Are my documents safe? Who can access them?", faq_a1: "Your documents are completely safe. DocuAnalytics does not store any file: every document is processed in real time and permanently deleted at the end of the analysis, leaving no trace on our servers. No human operator or automated system keeps or accesses your files. Fully GDPR compliant.",
    faq_q2: "How much does it cost? Is there a free plan?", faq_a2: "You can start for free with 3 included credits, no credit card required. After that, choose one-time packs (from €19) or monthly firm subscriptions with recurring credits. You only pay for what you use.",
    faq_q3: "Which file types and documents can I analyze?", faq_a3: "You can upload PDF, JPG and PNG files up to 10 MB. DocuAnalytics recognizes e-invoices, tax forms, contracts, company records, payslips and generic documents, with data extraction and error-check audit.",
    faq_q4: "How long does it take to analyze a document?", faq_a4: "About 2 seconds on average. The AI classifies the document, extracts all key fields and generates the audit and Copilot answers almost instantly.",
    pp_onetime: "Packs", pp_subs: "Subscriptions",
  },
  es: {
    credits: "Créditos", topup: "Recargar", login: "Acceder", invite: "Invitar", logout: "Salir",
    hero_kicker: "INTELIGENCIA DOCUMENTAL EMPRESARIAL",
    hero_t1: "Análisis de Documentos con", hero_t2: "Inteligencia Artificial",
    hero_sub: "Sube facturas, contratos, registros mercantiles y modelos fiscales. La IA los clasifica y extrae automáticamente todos los datos clave en segundos, con auditoría antierrores integrada.",
    up_title: "Subir Documento", up_sub: "Arrastra un archivo o elige el tipo de documento para un análisis inmediato",
    up_drop: "Arrastra aquí tu documento", up_hint: "PDF, JPG, PNG — Máx 10MB",
    analyze: "Analizar Documento", analyzing: "Analizando...",
    results_title: "Resultados del Análisis",
    feat_title: "Nuevas Funciones Avanzadas", feat_sub: "Más que extracción de datos: inteligencia que protege tu despacho",
    serv_title: "Servicios de IA Especializados para tu Sector", serv_sub: "Algoritmos entrenados para Contables, Abogados, Notarios y directores financieros",
    guide_btn: "Guía Completa de Servicios Enterprise",
    tut_title: "Cómo Funciona — Tutorial", tut_sub: "Mira la demo animada: analiza tu primer documento en menos de un minuto",
    ref_title: "Invita a un colega, ganáis los dos", ref_sub_a: "Por cada colega que se registre con tu enlace recibís", ref_sub_b: "+5 créditos cada uno", ref_sub_c: ". Sin límites.",
    ref_cta_in: "Obtén tu enlace de invitación", ref_cta_out: "Accede e invita",
    testi_title: "Lo que dicen los despachos profesionales", testi_sub: "4.9/5 — Basado en 482 reseñas verificadas",
    foot_desc: "Extracción automática de alta precisión para bufetes, notarías y asesorías • Servidores UE • RGPD",
    foot_guide: "Guía de servicios", foot_topup: "Comprar Créditos",
    pric_title: "Comprar Créditos", tab_card: "Tarjeta / Stripe", tab_crypto: "Cripto (BTC/USDT)",
    auth_login: "Acceder", auth_register: "Crear cuenta", lang_label: "Idioma",
    auth_submit_reg: "Registrarse (+3 créditos gratis)", auth_pw_ph: "Contraseña (mín 6 caracteres)", auth_name_ph: "Nombre (p. ej. Despacho Rossi)", auth_helper: "Al registrarte conservas tus créditos y puedes acceder desde cualquier dispositivo.", auth_bonus: "🎁 Invitación válida: recibirás +5 créditos de bonificación!",
    ex_data: "Datos Extraídos", no_fields: "No se detectó ningún campo estructurado.", no_anom: "No se detectaron anomalías.", chat_empty: "Pregunta lo que quieras sobre el documento, p. ej. \"¿Cuál es el total a pagar?\"", chat_ph: "Haz una pregunta...", exported: "Exportado", verified: "Verificado",
    pop: "POPULAR", buy: "Comprar", per_month: "/mes", unlim_cr: "Créditos ilimitados", cr: "créditos", your_subs: "Tus suscripciones", cancelling: "cancelando", cancel: "Cancelar", packs_ttl: "Packs de Créditos (pago único)", subs_ttl: "Suscripciones de Despacho (renovación mensual automática de créditos)", stripe_note: "Pagos seguros vía Stripe (Managed Payments, IVA gestionado por Stripe).", cr_step1: "1. Elige el paquete", cr_step2: "2. Elige la moneda", cr_order: "Registrar pedido", copy_addr: "Copiar dirección", unlim: "ilimitados", cr_short: "cr",
    ref_ttl: "Invita y gana", ref_desc_a: "Comparte tu enlace: tú y tu colega recibís", ref_desc_b: "+5 créditos", ref_desc_c: "cuando él se registra.", copy_link: "Copiar enlace", invited_lbl: "Colegas invitados", earned_lbl: "Créditos ganados", ref_share: "Analiza tus documentos con IA, pruébalo gratis:",
    guide_ttl: "Guía Completa de Servicios Enterprise", guide_sub: "Todo lo que DocuAnalytics AI extrae y verifica por ti, categoría por categoría.", guide_foot: "Cada análisis incluye la Auditoría de Alertas con IA y el Copilot interactivo.", start_now: "Empezar ahora",
    rights: "Todos los derechos reservados", blog_link: "Guías",
    n_credits_out: "Créditos agotados. Recarga para continuar.", n_pay_cancel: "Pago cancelado.", n_disconnected: "Sesión cerrada.", n_pay_verify: "Verificando el pago...", n_analyze_fail: "El análisis ha fallado.", n_copilot_err: "Error en el copilot.", n_addr_copied: "Dirección copiada", n_link_copied: "¡Enlace copiado!", n_pay_start_err: "Error al iniciar el pago.", n_crypto_err: "Error en el pedido cripto.", n_cancel_ok: "Suscripción en cancelación.", n_cancel_err: "Error al cancelar la suscripción.", n_welcome: "Bienvenido", n_login_ok: "Sesión iniciada ✅",
    n_pay_ok: "✅ ¡Pago realizado! Créditos añadidos:", n_sub_ok: "✅ ¡Suscripción activa! Créditos/mes:", n_renew: "Renovación automática.", n_pay_pending: "Verificación en curso, los créditos aparecerán pronto.", n_pay_fail: "Pago no completado.", auth_err: "Error. Inténtalo de nuevo.",
    priv_banner: "Tus documentos nunca se almacenan. Cada archivo se procesa en tiempo real y se elimina de inmediato tras el análisis: ningún dato permanece en nuestros servidores.",
    badge_nostore: "Documentos no almacenados", badge_delete: "Eliminación inmediata tras el análisis", badge_gdpr: "Conforme al RGPD", badge_https: "Transmisión cifrada HTTPS", badge_noshare: "Sin compartir con terceros",
    faq_title: "Preguntas frecuentes", faq_q1: "¿Mis documentos están seguros? ¿Quién puede acceder a ellos?", faq_a1: "Tus documentos están completamente seguros. DocuAnalytics no almacena ningún archivo: cada documento se procesa en tiempo real y se elimina permanentemente al finalizar el análisis, sin dejar rastro en nuestros servidores. Ningún operador humano ni sistema automático conserva o accede a tus archivos. Totalmente conforme al RGPD.",
    faq_q2: "¿Cuánto cuesta? ¿Hay un plan gratuito?", faq_a2: "Puedes empezar gratis con 3 créditos incluidos, sin tarjeta. Después elige packs de pago único (desde 19€) o suscripciones mensuales para despachos con créditos recurrentes. Solo pagas lo que usas.",
    faq_q3: "¿Qué tipos de archivos y documentos puedo analizar?", faq_a3: "Puedes subir archivos PDF, JPG y PNG de hasta 10 MB. DocuAnalytics reconoce facturas electrónicas, modelos fiscales, contratos, registros mercantiles, nóminas y documentos genéricos, con extracción de datos y auditoría antierrores.",
    faq_q4: "¿Cuánto tarda el análisis de un documento?", faq_a4: "Unos 2 segundos de media. La IA clasifica el documento, extrae todos los campos clave y genera la auditoría y las respuestas del Copilot casi al instante.",
    pp_onetime: "Packs", pp_subs: "Suscripciones",
  },
  de: {
    credits: "Guthaben", topup: "Aufladen", login: "Anmelden", invite: "Einladen", logout: "Abmelden",
    hero_kicker: "ENTERPRISE DOCUMENT INTELLIGENCE",
    hero_t1: "Dokumentenanalyse mit", hero_t2: "Künstlicher Intelligenz",
    hero_sub: "Laden Sie Rechnungen, Verträge, Handelsregisterauszüge und Steuerformulare hoch. Die KI klassifiziert sie und extrahiert automatisch alle wichtigen Daten in Sekunden – mit integriertem Fehler-Audit.",
    up_title: "Dokument hochladen", up_sub: "Datei ziehen oder Dokumenttyp für die sofortige Analyse wählen",
    up_drop: "Dokument hierher ziehen", up_hint: "PDF, JPG, PNG — max. 10 MB",
    analyze: "Dokument analysieren", analyzing: "Analyse läuft...",
    results_title: "Analyseergebnisse",
    feat_title: "Neue erweiterte Funktionen", feat_sub: "Mehr als Datenextraktion: Intelligenz, die Ihre Kanzlei schützt",
    serv_title: "Spezialisierte KI-Dienste für Ihre Branche", serv_sub: "Algorithmen für Steuerberater, Anwälte, Notare und CFOs",
    guide_btn: "Vollständiger Leitfaden zu Enterprise-Diensten",
    tut_title: "So funktioniert's — Tutorial", tut_sub: "Sehen Sie die animierte Demo: analysieren Sie Ihr erstes Dokument in unter einer Minute",
    ref_title: "Laden Sie eine Kollegin ein – beide profitieren", ref_sub_a: "Für jede Person, die sich mit Ihrem Link registriert, erhalten Sie beide", ref_sub_b: "+5 Guthaben je", ref_sub_c: ". Ohne Limit.",
    ref_cta_in: "Einladungslink erhalten", ref_cta_out: "Anmelden und einladen",
    testi_title: "Was Fachkanzleien sagen", testi_sub: "4.9/5 — Basierend auf 482 verifizierten Bewertungen",
    foot_desc: "Hochpräzise automatische Extraktion für Kanzleien, Notare und Steuerberater • EU-Server • DSGVO",
    foot_guide: "Service-Leitfaden", foot_topup: "Guthaben kaufen",
    pric_title: "Guthaben kaufen", tab_card: "Karte / Stripe", tab_crypto: "Krypto (BTC/USDT)",
    auth_login: "Anmelden", auth_register: "Konto erstellen", lang_label: "Sprache",
    auth_submit_reg: "Registrieren (+3 Gratis-Guthaben)", auth_pw_ph: "Passwort (min. 6 Zeichen)", auth_name_ph: "Name (z. B. Kanzlei Rossi)", auth_helper: "Mit der Registrierung behalten Sie Ihr Guthaben und können sich von jedem Gerät anmelden.", auth_bonus: "🎁 Gültige Einladung: Sie erhalten +5 Bonus-Guthaben!",
    ex_data: "Extrahierte Daten", no_fields: "Kein strukturiertes Feld erkannt.", no_anom: "Keine Anomalien erkannt.", chat_empty: "Fragen Sie alles zum Dokument, z. B. \"Wie hoch ist der zu zahlende Betrag?\"", chat_ph: "Stellen Sie eine Frage...", exported: "Exportiert", verified: "Verifiziert",
    pop: "BELIEBT", buy: "Kaufen", per_month: "/Monat", unlim_cr: "Unbegrenztes Guthaben", cr: "Guthaben", your_subs: "Ihre Abonnements", cancelling: "wird gekündigt", cancel: "Kündigen", packs_ttl: "Guthaben-Pakete (Einmalzahlung)", subs_ttl: "Kanzlei-Abos (automatische monatliche Guthaben-Verlängerung)", stripe_note: "Sichere Zahlungen über Stripe (Managed Payments, USt. von Stripe verwaltet).", cr_step1: "1. Paket wählen", cr_step2: "2. Währung wählen", cr_order: "Bestellung erfassen", copy_addr: "Adresse kopieren", unlim: "unbegrenzt", cr_short: "Gh",
    ref_ttl: "Einladen und verdienen", ref_desc_a: "Teilen Sie Ihren Link: Sie und Ihr Kollege erhalten beide", ref_desc_b: "+5 Guthaben", ref_desc_c: "wenn er sich registriert.", copy_link: "Link kopieren", invited_lbl: "Eingeladene Kollegen", earned_lbl: "Verdientes Guthaben", ref_share: "Analysieren Sie Ihre Dokumente mit KI, kostenlos testen:",
    guide_ttl: "Vollständiger Leitfaden zu Enterprise-Diensten", guide_sub: "Alles, was DocuAnalytics AI für Sie extrahiert und prüft, Kategorie für Kategorie.", guide_foot: "Jede Analyse umfasst das KI-Red-Flag-Audit und den interaktiven Copilot.", start_now: "Jetzt starten",
    rights: "Alle Rechte vorbehalten", blog_link: "Ratgeber",
    n_credits_out: "Guthaben aufgebraucht. Bitte aufladen.", n_pay_cancel: "Zahlung abgebrochen.", n_disconnected: "Abgemeldet.", n_pay_verify: "Zahlung wird überprüft...", n_analyze_fail: "Analyse fehlgeschlagen.", n_copilot_err: "Copilot-Fehler.", n_addr_copied: "Adresse kopiert", n_link_copied: "Link kopiert!", n_pay_start_err: "Fehler beim Starten der Zahlung.", n_crypto_err: "Fehler bei Krypto-Bestellung.", n_cancel_ok: "Abonnement wird gekündigt.", n_cancel_err: "Fehler bei Abo-Kündigung.", n_welcome: "Willkommen", n_login_ok: "Angemeldet ✅",
    n_pay_ok: "✅ Zahlung erfolgreich! Guthaben gutgeschrieben:", n_sub_ok: "✅ Abo aktiv! Guthaben/Monat:", n_renew: "Automatische Verlängerung.", n_pay_pending: "Überprüfung läuft, das Guthaben erscheint in Kürze.", n_pay_fail: "Zahlung nicht abgeschlossen.", auth_err: "Fehler. Bitte erneut versuchen.",
    priv_banner: "Ihre Dokumente werden niemals gespeichert. Jede Datei wird in Echtzeit verarbeitet und unmittelbar nach der Analyse gelöscht: keine Daten verbleiben auf unseren Servern.",
    badge_nostore: "Dokumente nicht gespeichert", badge_delete: "Sofortige Löschung nach der Analyse", badge_gdpr: "DSGVO-konform", badge_https: "Verschlüsselte HTTPS-Übertragung", badge_noshare: "Keine Weitergabe an Dritte",
    faq_title: "Häufige Fragen", faq_q1: "Sind meine Dokumente sicher? Wer kann darauf zugreifen?", faq_a1: "Ihre Dokumente sind vollständig sicher. DocuAnalytics speichert keine Datei: Jedes Dokument wird in Echtzeit verarbeitet und nach Abschluss der Analyse dauerhaft gelöscht, ohne Spuren auf unseren Servern zu hinterlassen. Kein menschlicher Bediener und kein automatisches System speichert oder greift auf Ihre Dateien zu. Vollständig DSGVO-konform.",
    faq_q2: "Was kostet es? Gibt es einen kostenlosen Plan?", faq_a2: "Sie können kostenlos mit 3 enthaltenen Guthaben starten, ohne Kreditkarte. Danach wählen Sie Einmal-Pakete (ab 19 €) oder monatliche Kanzlei-Abos mit wiederkehrendem Guthaben. Sie zahlen nur, was Sie nutzen.",
    faq_q3: "Welche Dateitypen und Dokumente kann ich analysieren?", faq_a3: "Sie können PDF-, JPG- und PNG-Dateien bis 10 MB hochladen. DocuAnalytics erkennt E-Rechnungen, Steuerformulare, Verträge, Registerauszüge, Gehaltsabrechnungen und generische Dokumente, mit Datenextraktion und Fehler-Audit.",
    faq_q4: "Wie lange dauert die Analyse eines Dokuments?", faq_a4: "Im Durchschnitt etwa 2 Sekunden. Die KI klassifiziert das Dokument, extrahiert alle wichtigen Felder und erstellt Audit und Copilot-Antworten nahezu sofort.",
    pp_onetime: "Pakete", pp_subs: "Abos",
  },
  fr: {
    credits: "Crédits", topup: "Recharger", login: "Se connecter", invite: "Inviter", logout: "Déconnexion",
    hero_kicker: "DOCUMENT INTELLIGENCE ENTREPRISE",
    hero_t1: "Analyse de Documents avec", hero_t2: "Intelligence Artificielle",
    hero_sub: "Importez factures, contrats, extraits Kbis et formulaires fiscaux. L'IA les classe et extrait automatiquement toutes les données clés en quelques secondes, avec audit anti-erreur intégré.",
    up_title: "Importer un document", up_sub: "Glissez un fichier ou choisissez le type de document pour une analyse immédiate",
    up_drop: "Glissez votre document ici", up_hint: "PDF, JPG, PNG — Max 10 Mo",
    analyze: "Analyser le document", analyzing: "Analyse en cours...",
    results_title: "Résultats de l'analyse",
    feat_title: "Nouvelles fonctionnalités avancées", feat_sub: "Au-delà de l'extraction : une intelligence qui protège votre cabinet",
    serv_title: "Services IA spécialisés pour votre secteur", serv_sub: "Algorithmes entraînés pour experts-comptables, avocats, notaires et directeurs financiers",
    guide_btn: "Guide complet des services Enterprise",
    tut_title: "Comment ça marche — Tutoriel", tut_sub: "Regardez la démo animée : analysez votre premier document en moins d'une minute",
    ref_title: "Invitez un confrère, gagnez tous les deux", ref_sub_a: "Pour chaque confrère qui s'inscrit avec votre lien, vous recevez", ref_sub_b: "+5 crédits chacun", ref_sub_c: ". Sans limite.",
    ref_cta_in: "Obtenez votre lien d'invitation", ref_cta_out: "Connectez-vous pour inviter",
    testi_title: "Ce que disent les cabinets", testi_sub: "4.9/5 — Sur la base de 482 avis vérifiés",
    foot_desc: "Extraction automatique haute précision pour cabinets d'avocats, notaires et experts-comptables • Serveurs UE • RGPD",
    foot_guide: "Guide des services", foot_topup: "Acheter des crédits",
    pric_title: "Acheter des crédits", tab_card: "Carte / Stripe", tab_crypto: "Crypto (BTC/USDT)",
    auth_login: "Se connecter", auth_register: "Créer un compte", lang_label: "Langue",
    auth_submit_reg: "S'inscrire (+3 crédits gratuits)", auth_pw_ph: "Mot de passe (min 6 caractères)", auth_name_ph: "Nom (ex. Cabinet Rossi)", auth_helper: "En vous inscrivant, vous conservez vos crédits et pouvez vous connecter depuis n'importe quel appareil.", auth_bonus: "🎁 Invitation valide : vous recevrez +5 crédits bonus !",
    ex_data: "Données Extraites", no_fields: "Aucun champ structuré détecté.", no_anom: "Aucune anomalie détectée.", chat_empty: "Posez n'importe quelle question sur le document, ex. « Quel est le total à payer ? »", chat_ph: "Posez une question...", exported: "Exporté", verified: "Vérifié",
    pop: "POPULAIRE", buy: "Acheter", per_month: "/mois", unlim_cr: "Crédits illimités", cr: "crédits", your_subs: "Vos abonnements", cancelling: "en cours de résiliation", cancel: "Résilier", packs_ttl: "Packs de Crédits (paiement unique)", subs_ttl: "Abonnements Cabinet (renouvellement mensuel automatique des crédits)", stripe_note: "Paiements sécurisés via Stripe (Managed Payments, TVA gérée par Stripe).", cr_step1: "1. Choisissez le pack", cr_step2: "2. Choisissez la devise", cr_order: "Enregistrer la commande", copy_addr: "Copier l'adresse", unlim: "illimités", cr_short: "cr",
    ref_ttl: "Invitez et gagnez", ref_desc_a: "Partagez votre lien : vous et votre confrère recevez", ref_desc_b: "+5 crédits", ref_desc_c: "lorsqu'il s'inscrit.", copy_link: "Copier le lien", invited_lbl: "Confrères invités", earned_lbl: "Crédits gagnés", ref_share: "Analysez vos documents avec l'IA, essayez gratuitement :",
    guide_ttl: "Guide complet des services Enterprise", guide_sub: "Tout ce que DocuAnalytics AI extrait et vérifie pour vous, catégorie par catégorie.", guide_foot: "Chaque analyse inclut l'audit d'alertes IA et le Copilot interactif.", start_now: "Commencer",
    rights: "Tous droits réservés", blog_link: "Guides",
    n_credits_out: "Crédits épuisés. Rechargez pour continuer.", n_pay_cancel: "Paiement annulé.", n_disconnected: "Déconnecté.", n_pay_verify: "Vérification du paiement...", n_analyze_fail: "Échec de l'analyse.", n_copilot_err: "Erreur du copilot.", n_addr_copied: "Adresse copiée", n_link_copied: "Lien copié !", n_pay_start_err: "Erreur au démarrage du paiement.", n_crypto_err: "Erreur de commande crypto.", n_cancel_ok: "Abonnement en cours de résiliation.", n_cancel_err: "Erreur de résiliation de l'abonnement.", n_welcome: "Bienvenue", n_login_ok: "Connexion réussie ✅",
    n_pay_ok: "✅ Paiement réussi ! Crédits ajoutés :", n_sub_ok: "✅ Abonnement actif ! Crédits/mois :", n_renew: "Renouvellement automatique.", n_pay_pending: "Vérification en cours, les crédits apparaîtront bientôt.", n_pay_fail: "Paiement non terminé.", auth_err: "Erreur. Réessayez.",
    priv_banner: "Vos documents ne sont jamais stockés. Chaque fichier est traité en temps réel et supprimé immédiatement après l'analyse : aucune donnée ne reste sur nos serveurs.",
    badge_nostore: "Documents non stockés", badge_delete: "Suppression immédiate après analyse", badge_gdpr: "Conforme au RGPD", badge_https: "Transmission chiffrée HTTPS", badge_noshare: "Aucun partage avec des tiers",
    faq_title: "Questions fréquentes", faq_q1: "Mes documents sont-ils en sécurité ? Qui peut y accéder ?", faq_a1: "Vos documents sont totalement en sécurité. DocuAnalytics ne stocke aucun fichier : chaque document est traité en temps réel et définitivement supprimé à la fin de l'analyse, sans laisser aucune trace sur nos serveurs. Aucun opérateur humain ni système automatique ne conserve ni n'accède à vos fichiers. Entièrement conforme au RGPD.",
    faq_q2: "Combien ça coûte ? Y a-t-il une offre gratuite ?", faq_a2: "Vous pouvez commencer gratuitement avec 3 crédits inclus, sans carte bancaire. Ensuite, choisissez des packs à paiement unique (à partir de 19 €) ou des abonnements mensuels pour cabinets avec crédits récurrents. Vous ne payez que ce que vous utilisez.",
    faq_q3: "Quels types de fichiers et de documents puis-je analyser ?", faq_a3: "Vous pouvez importer des fichiers PDF, JPG et PNG jusqu'à 10 Mo. DocuAnalytics reconnaît les factures électroniques, formulaires fiscaux, contrats, extraits Kbis, bulletins de paie et documents génériques, avec extraction de données et audit anti-erreur.",
    faq_q4: "Combien de temps prend l'analyse d'un document ?", faq_a4: "Environ 2 secondes en moyenne. L'IA classe le document, extrait tous les champs clés et génère l'audit et les réponses du Copilot presque instantanément.",
    pp_onetime: "Packs", pp_subs: "Abonnements",
  },
};
const I18nContext = createContext({ lang: "it", t: (k) => k, change: () => {} });
function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q && ["it", "en", "es", "de", "fr"].includes(q)) { localStorage.setItem("da_lang", q); return q; }
    return localStorage.getItem("da_lang") || "it";
  });
  const t = useCallback((k) => (T[lang] && T[lang][k]) || (MT[lang] && MT[lang][k]) || T.it[k] || MT.it[k] || k, [lang]);
  const change = useCallback((l) => { setLang(l); localStorage.setItem("da_lang", l); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <I18nContext.Provider value={{ lang, t, change }}>{children}</I18nContext.Provider>;
}
const useI18n = () => useContext(I18nContext);

/* ---------------- Content translations (arrays) ---------------- */
const CONTENT = {
  it: {
    docTypes: { fattura: "Fattura", contratto: "Contratto", visura: "Visura", f24: "F24", busta_paga: "Busta Paga" },
    pipe: ["Parsing", "Classificazione", "Estrazione", "Validazione"],
    services: [
      { t: "F24 & Fatture Elettroniche", d: "Quadratura automatica Debito/Credito/Saldo, avviso visto conformità IVA sopra €5.000, controllo IBAN esteri e Prima Nota per Zucchetti/TeamSystem." },
      { t: "Contratti & Visure Camerali", d: "Rilevamento clausole vessatorie (Art. 1341 c.c.), preavvisi recesso, verifica antiriciclaggio KYC/AML con estrazione REA, soci e amministratori." },
      { t: "Buste Paga & HR", d: "Quadratura Lordo/INPS/IRPEF/Netto, TFR maturato, compliance GDPR & EU AI Act con server 100% in UE e crittografia AES 256-bit." },
    ],
    features: [
      { tag: "AUDIT", t: "Rilevatore Red-Flag AI", d: "Un secondo cervello AI che controlla i tuoi documenti e segnala automaticamente i rischi prima che diventino un problema.", points: ["Quadratura automatica di F24, fatture e buste paga (Debito/Credito/Netto)", "Allerta clausole vessatorie nei contratti (Art. 1341 c.c.)", "Rilevamento IBAN esteri e anomalie antiriciclaggio (AML)", "Avviso visto di conformità IVA per crediti superiori a €5.000"] },
      { tag: "COPILOT", t: "Copilot Interattivo", d: "Fai domande in linguaggio naturale sui tuoi documenti e ricevi risposte immediate, come un assistente esperto sempre disponibile.", points: ["Chiedi \"Qual è il totale da pagare?\" e ottieni la risposta all'istante", "Riepiloghi e spiegazioni di clausole complesse in italiano semplice", "Confronto tra documenti e verifica dei dati chiave", "Basato su AI Gemini, risposte contestuali solo sul tuo documento"] },
    ],
    tutorial: [
      { t: "Carica il documento", d: "Trascina o seleziona una fattura, un F24, un contratto, una visura o una busta paga (PDF, JPG, PNG)." },
      { t: "Scegli il tipo (opzionale)", d: "Seleziona la categoria del documento per un'estrazione ancora più precisa, oppure lascia che l'AI la rilevi da sola." },
      { t: "Analizza con l'AI", d: "In circa 2 secondi ottieni tutti i dati strutturati (importi, date, P.IVA, IBAN, totali) e l'audit anti-errore." },
      { t: "Chiedi al Copilot", d: "Fai domande sul documento in linguaggio naturale e ricevi risposte immediate e contestuali." },
      { t: "Esporta i dati", d: "Scarica i risultati in CSV o JSON, pronti per il tuo gestionale (Zucchetti, TeamSystem, ecc.)." },
    ],
    testimonials: [
      { n: "Avv. Alessandro Rossi", s: "Studio Legale Rossi & Associati • Milano", t: "Ha rivoluzionato il nostro studio. L'estrazione da contratti e visure è accurata al 99%. Risparmiamo 12 ore a settimana." },
      { n: "Dott.ssa Elena Conti", s: "Conti & Partners • Roma", t: "La quadratura automatica dei saldi F24 e delle fatture ci ha azzerato gli errori di digitazione manuale." },
      { n: "Dott. Marco Bianchi", s: "Studio Tributario Bianchi • Torino", t: "I 3 crediti gratuiti mi hanno convinto. Abbiamo acquistato il Pack Professional: assistenza ed export impeccabili." },
      { n: "Chiara Ferrari", s: "HR Manager • Bologna", t: "Analizzare le buste paga ora richiede 2 secondi. Piattaforma affidabile ed intuitiva." },
    ],
    guide: [
      { t: "F24 & Fatture Elettroniche", items: ["Estrazione automatica di codici tributo, importi, scadenze e saldi", "Quadratura Debito / Credito / Saldo finale con avviso in caso di squadratura", "Rilevamento visto di conformità per crediti IVA superiori a €5.000", "Controllo IBAN esteri e Prima Nota per Zucchetti / TeamSystem / Datev"] },
      { t: "Contratti & Documenti Legali", items: ["Individuazione clausole vessatorie (Art. 1341 c.c.)", "Estrazione parti, oggetto, durata, corrispettivi e termini di recesso", "Segnalazione preavvisi e scadenze contrattuali critiche", "Riepilogo in linguaggio chiaro delle clausole complesse"] },
      { t: "Visure Camerali", items: ["Estrazione numero REA, P.IVA, sede, capitale sociale e PEC", "Elenco soci, amministratori e poteri di firma", "Verifiche antiriciclaggio (KYC / AML) e titolare effettivo", "Stato attività e procedure in corso"] },
      { t: "Buste Paga & HR", items: ["Quadratura Lordo / INPS / IRPEF / Netto in busta", "Calcolo e verifica TFR maturato", "Compliance GDPR ed EU AI Act con dati trattati 100% in UE", "Crittografia AES 256-bit dei documenti"] },
    ],
    demo: ["1. Carica il documento", "2. Analisi con l'Intelligenza Artificiale", "3. Dati estratti automaticamente", "4. AI Red-Flag Audit", "5. Chiedi all'AI Copilot"],
    demoData: { file: "Fattura_128_2026.pdf", up: "caricato · 214 KB", f: [["Numero", "128/2026"], ["Imponibile", "1.000,00 €"], ["IVA 22%", "220,00 €"], ["Totale", "1.220,00 €"], ["IBAN", "IT60X0542811101…"]], a: ["Quadratura IVA corretta (1.000 + 220 = 1.220 €)", "IBAN italiano valido", "Scadenza pagamento tra 15 giorni"], q: "Qual è il totale da pagare?", ans: ["Il totale da pagare è ", "1.220,00 €", ", con scadenza 30/04/2026."] },
  },
  en: {
    docTypes: { fattura: "Invoice", contratto: "Contract", visura: "Company Record", f24: "Tax Form", busta_paga: "Payslip" },
    pipe: ["Parsing", "Classification", "Extraction", "Validation"],
    services: [
      { t: "Tax Forms & E-Invoices", d: "Automatic Debit/Credit/Balance reconciliation, VAT compliance alerts above €5,000, foreign IBAN checks and ledger export for accounting software." },
      { t: "Contracts & Company Records", d: "Detection of unfair clauses, notice/withdrawal terms, AML/KYC checks with extraction of registration number, shareholders and directors." },
      { t: "Payslips & HR", d: "Gross/Contributions/Tax/Net reconciliation, accrued severance, GDPR & EU AI Act compliance with 100% EU servers and AES 256-bit encryption." },
    ],
    features: [
      { tag: "AUDIT", t: "AI Red-Flag Detector", d: "A second AI brain that checks your documents and automatically flags risks before they become a problem.", points: ["Automatic reconciliation of tax forms, invoices and payslips", "Unfair-clause alerts in contracts", "Foreign IBAN and anti-money-laundering (AML) anomaly detection", "VAT compliance alert for credits above €5,000"] },
      { tag: "COPILOT", t: "Interactive Copilot", d: "Ask questions about your documents in natural language and get instant answers, like an expert assistant always available.", points: ["Ask \"What's the total to pay?\" and get the answer instantly", "Summaries and explanations of complex clauses in plain language", "Compare documents and verify key data", "Powered by Gemini AI, answers based only on your document"] },
    ],
    tutorial: [
      { t: "Upload the document", d: "Drag or select an invoice, tax form, contract, company record or payslip (PDF, JPG, PNG)." },
      { t: "Choose the type (optional)", d: "Select the document category for even more precise extraction, or let the AI detect it automatically." },
      { t: "Analyze with AI", d: "In about 2 seconds get all structured data (amounts, dates, VAT numbers, IBAN, totals) and the error-check audit." },
      { t: "Ask the Copilot", d: "Ask questions about the document in natural language and get instant, contextual answers." },
      { t: "Export the data", d: "Download results as CSV or JSON, ready for your accounting software." },
    ],
    testimonials: [
      { n: "Alessandro Rossi, Esq.", s: "Rossi & Partners Law Firm • Milan", t: "It transformed our firm. Extraction from contracts and records is 99% accurate. We save 12 hours a week." },
      { n: "Elena Conti, CPA", s: "Conti & Partners • Rome", t: "Automatic reconciliation of tax and invoice balances eliminated our manual data-entry errors." },
      { n: "Marco Bianchi, CPA", s: "Bianchi Tax Firm • Turin", t: "The 3 free credits won me over. We bought the Professional Pack: flawless support and export." },
      { n: "Chiara Ferrari", s: "HR Manager • Bologna", t: "Analyzing payslips now takes 2 seconds. Reliable and intuitive platform." },
    ],
    guide: [
      { t: "Tax Forms & E-Invoices", items: ["Automatic extraction of tax codes, amounts, due dates and balances", "Debit / Credit / Final balance reconciliation with mismatch alerts", "Compliance-visa detection for VAT credits above €5,000", "Foreign IBAN checks and ledger export for accounting software"] },
      { t: "Contracts & Legal Documents", items: ["Detection of unfair clauses", "Extraction of parties, subject, duration, fees and withdrawal terms", "Alerts on critical notices and contract deadlines", "Plain-language summary of complex clauses"] },
      { t: "Company Records", items: ["Extraction of registration number, VAT, office, share capital and certified email", "List of shareholders, directors and signing powers", "AML / KYC checks and beneficial owner", "Business status and ongoing proceedings"] },
      { t: "Payslips & HR", items: ["Gross / Contributions / Tax / Net reconciliation", "Accrued severance calculation and check", "GDPR & EU AI Act compliance, data processed 100% in the EU", "AES 256-bit document encryption"] },
    ],
    demo: ["1. Upload the document", "2. Analysis with Artificial Intelligence", "3. Data extracted automatically", "4. AI Red-Flag Audit", "5. Ask the AI Copilot"],
    demoData: { file: "Invoice_128_2026.pdf", up: "uploaded · 214 KB", f: [["Number", "128/2026"], ["Taxable", "€1,000.00"], ["VAT 22%", "€220.00"], ["Total", "€1,220.00"], ["IBAN", "IT60X0542811101…"]], a: ["VAT reconciliation correct (1,000 + 220 = 1,220 €)", "Valid Italian IBAN", "Payment due in 15 days"], q: "What's the total to pay?", ans: ["The total to pay is ", "€1,220.00", ", due on 30/04/2026."] },
  },
  es: {
    docTypes: { fattura: "Factura", contratto: "Contrato", visura: "Registro Mercantil", f24: "Modelo Fiscal", busta_paga: "Nómina" },
    pipe: ["Análisis", "Clasificación", "Extracción", "Validación"],
    services: [
      { t: "Modelos Fiscales y Facturas", d: "Cuadre automático Debe/Haber/Saldo, avisos de cumplimiento de IVA por encima de 5.000 €, control de IBAN extranjeros y exportación contable." },
      { t: "Contratos y Registros Mercantiles", d: "Detección de cláusulas abusivas, plazos de preaviso/desistimiento, verificación AML/KYC con extracción de datos registrales, socios y administradores." },
      { t: "Nóminas y RR. HH.", d: "Cuadre Bruto/Cotizaciones/IRPF/Neto, finiquito acumulado, cumplimiento RGPD y EU AI Act con servidores 100% en la UE y cifrado AES 256 bits." },
    ],
    features: [
      { tag: "AUDIT", t: "Detector de Alertas con IA", d: "Un segundo cerebro de IA que revisa tus documentos y señala automáticamente los riesgos antes de que sean un problema.", points: ["Cuadre automático de modelos fiscales, facturas y nóminas", "Alerta de cláusulas abusivas en contratos", "Detección de IBAN extranjeros y anomalías antiblanqueo (AML)", "Aviso de cumplimiento de IVA para créditos superiores a 5.000 €"] },
      { tag: "COPILOT", t: "Copilot Interactivo", d: "Haz preguntas sobre tus documentos en lenguaje natural y recibe respuestas al instante, como un asistente experto siempre disponible.", points: ["Pregunta \"¿Cuál es el total a pagar?\" y obtén la respuesta al instante", "Resúmenes y explicaciones de cláusulas complejas en lenguaje claro", "Comparación de documentos y verificación de datos clave", "Con IA Gemini, respuestas basadas solo en tu documento"] },
    ],
    tutorial: [
      { t: "Sube el documento", d: "Arrastra o selecciona una factura, modelo fiscal, contrato, registro mercantil o nómina (PDF, JPG, PNG)." },
      { t: "Elige el tipo (opcional)", d: "Selecciona la categoría del documento para una extracción aún más precisa, o deja que la IA la detecte sola." },
      { t: "Analiza con IA", d: "En unos 2 segundos obtienes todos los datos estructurados (importes, fechas, NIF, IBAN, totales) y la auditoría antierrores." },
      { t: "Pregunta al Copilot", d: "Haz preguntas sobre el documento en lenguaje natural y recibe respuestas inmediatas y contextuales." },
      { t: "Exporta los datos", d: "Descarga los resultados en CSV o JSON, listos para tu software contable." },
    ],
    testimonials: [
      { n: "Alessandro Rossi", s: "Bufete Rossi & Asociados • Milán", t: "Transformó nuestro despacho. La extracción de contratos y registros es 99% precisa. Ahorramos 12 horas a la semana." },
      { n: "Elena Conti", s: "Conti & Partners • Roma", t: "El cuadre automático de saldos fiscales y facturas eliminó nuestros errores de introducción manual." },
      { n: "Marco Bianchi", s: "Asesoría Tributaria Bianchi • Turín", t: "Los 3 créditos gratis me convencieron. Compramos el Pack Professional: soporte y exportación impecables." },
      { n: "Chiara Ferrari", s: "Responsable de RR. HH. • Bolonia", t: "Analizar nóminas ahora tarda 2 segundos. Plataforma fiable e intuitiva." },
    ],
    guide: [
      { t: "Modelos Fiscales y Facturas", items: ["Extracción automática de códigos, importes, vencimientos y saldos", "Cuadre Debe / Haber / Saldo final con aviso de descuadre", "Detección de visado de conformidad para créditos de IVA superiores a 5.000 €", "Control de IBAN extranjeros y exportación contable"] },
      { t: "Contratos y Documentos Legales", items: ["Identificación de cláusulas abusivas", "Extracción de partes, objeto, duración, importes y desistimiento", "Avisos de preavisos y vencimientos contractuales críticos", "Resumen en lenguaje claro de cláusulas complejas"] },
      { t: "Registros Mercantiles", items: ["Extracción de número registral, NIF, sede, capital social y email certificado", "Lista de socios, administradores y poderes de firma", "Verificaciones AML / KYC y titular real", "Estado de actividad y procedimientos en curso"] },
      { t: "Nóminas y RR. HH.", items: ["Cuadre Bruto / Cotizaciones / IRPF / Neto", "Cálculo y verificación del finiquito acumulado", "Cumplimiento RGPD y EU AI Act, datos tratados 100% en la UE", "Cifrado AES 256 bits de los documentos"] },
    ],
    demo: ["1. Sube el documento", "2. Análisis con Inteligencia Artificial", "3. Datos extraídos automáticamente", "4. Auditoría de alertas con IA", "5. Pregunta al Copilot de IA"],
    demoData: { file: "Factura_128_2026.pdf", up: "subido · 214 KB", f: [["Número", "128/2026"], ["Base", "1.000,00 €"], ["IVA 22%", "220,00 €"], ["Total", "1.220,00 €"], ["IBAN", "IT60X0542811101…"]], a: ["Cuadre de IVA correcto (1.000 + 220 = 1.220 €)", "IBAN italiano válido", "Vencimiento del pago en 15 días"], q: "¿Cuál es el total a pagar?", ans: ["El total a pagar es ", "1.220,00 €", ", con vencimiento 30/04/2026."] },
  },
  de: {
    docTypes: { fattura: "Rechnung", contratto: "Vertrag", visura: "Handelsregister", f24: "Steuerformular", busta_paga: "Gehaltsabrechnung" },
    pipe: ["Parsing", "Klassifizierung", "Extraktion", "Validierung"],
    services: [
      { t: "Steuerformulare & E-Rechnungen", d: "Automatischer Soll/Haben/Saldo-Abgleich, USt-Compliance-Hinweise über 5.000 €, Prüfung ausländischer IBAN und Buchungsexport." },
      { t: "Verträge & Handelsregisterauszüge", d: "Erkennung unzulässiger Klauseln, Kündigungsfristen, AML/KYC-Prüfung mit Extraktion von Registernummer, Gesellschaftern und Geschäftsführern." },
      { t: "Gehaltsabrechnungen & HR", d: "Brutto/Beiträge/Steuer/Netto-Abgleich, aufgelaufene Abfindung, DSGVO- & EU-AI-Act-Konformität mit 100% EU-Servern und AES-256-Bit-Verschlüsselung." },
    ],
    features: [
      { tag: "AUDIT", t: "KI-Red-Flag-Detektor", d: "Ein zweites KI-Gehirn, das Ihre Dokumente prüft und Risiken automatisch meldet, bevor sie zum Problem werden.", points: ["Automatischer Abgleich von Steuerformularen, Rechnungen und Abrechnungen", "Warnung vor unzulässigen Klauseln in Verträgen", "Erkennung ausländischer IBAN und Geldwäsche-Anomalien (AML)", "USt-Compliance-Hinweis für Guthaben über 5.000 €"] },
      { tag: "COPILOT", t: "Interaktiver Copilot", d: "Stellen Sie Fragen zu Ihren Dokumenten in natürlicher Sprache und erhalten Sie sofort Antworten – wie ein stets verfügbarer Experte.", points: ["Fragen Sie \"Wie hoch ist der zu zahlende Betrag?\" und erhalten Sie sofort die Antwort", "Zusammenfassungen und Erklärungen komplexer Klauseln in einfacher Sprache", "Dokumentenvergleich und Prüfung wichtiger Daten", "Basierend auf Gemini-KI, Antworten nur zu Ihrem Dokument"] },
    ],
    tutorial: [
      { t: "Dokument hochladen", d: "Ziehen oder wählen Sie eine Rechnung, ein Steuerformular, einen Vertrag, einen Registerauszug oder eine Abrechnung (PDF, JPG, PNG)." },
      { t: "Typ wählen (optional)", d: "Wählen Sie die Dokumentkategorie für eine noch präzisere Extraktion, oder lassen Sie die KI sie automatisch erkennen." },
      { t: "Mit KI analysieren", d: "In etwa 2 Sekunden erhalten Sie alle strukturierten Daten (Beträge, Daten, USt-IdNr., IBAN, Summen) und das Fehler-Audit." },
      { t: "Den Copilot fragen", d: "Stellen Sie Fragen zum Dokument in natürlicher Sprache und erhalten Sie sofortige, kontextbezogene Antworten." },
      { t: "Daten exportieren", d: "Laden Sie die Ergebnisse als CSV oder JSON herunter, bereit für Ihre Buchhaltungssoftware." },
    ],
    testimonials: [
      { n: "RA Alessandro Rossi", s: "Kanzlei Rossi & Partner • Mailand", t: "Es hat unsere Kanzlei revolutioniert. Die Extraktion aus Verträgen und Auszügen ist zu 99% genau. Wir sparen 12 Stunden pro Woche." },
      { n: "StB Elena Conti", s: "Conti & Partner • Rom", t: "Der automatische Abgleich von Steuer- und Rechnungssalden hat unsere manuellen Eingabefehler eliminiert." },
      { n: "StB Marco Bianchi", s: "Steuerkanzlei Bianchi • Turin", t: "Die 3 Gratis-Guthaben haben mich überzeugt. Wir haben das Professional-Paket gekauft: tadelloser Support und Export." },
      { n: "Chiara Ferrari", s: "HR-Managerin • Bologna", t: "Die Analyse von Abrechnungen dauert jetzt 2 Sekunden. Zuverlässige und intuitive Plattform." },
    ],
    guide: [
      { t: "Steuerformulare & E-Rechnungen", items: ["Automatische Extraktion von Steuercodes, Beträgen, Fristen und Salden", "Soll / Haben / Endsaldo-Abgleich mit Warnung bei Abweichung", "Erkennung des Konformitätsvermerks für USt-Guthaben über 5.000 €", "Prüfung ausländischer IBAN und Buchungsexport"] },
      { t: "Verträge & Rechtsdokumente", items: ["Erkennung unzulässiger Klauseln", "Extraktion von Parteien, Gegenstand, Laufzeit, Entgelten und Kündigung", "Warnungen zu kritischen Fristen und Vertragsterminen", "Zusammenfassung komplexer Klauseln in einfacher Sprache"] },
      { t: "Handelsregisterauszüge", items: ["Extraktion von Registernummer, USt-IdNr., Sitz, Stammkapital und zertifizierter E-Mail", "Liste der Gesellschafter, Geschäftsführer und Zeichnungsbefugnisse", "AML- / KYC-Prüfungen und wirtschaftlich Berechtigter", "Geschäftsstatus und laufende Verfahren"] },
      { t: "Gehaltsabrechnungen & HR", items: ["Brutto / Beiträge / Steuer / Netto-Abgleich", "Berechnung und Prüfung der aufgelaufenen Abfindung", "DSGVO- & EU-AI-Act-Konformität, Daten zu 100% in der EU verarbeitet", "AES-256-Bit-Verschlüsselung der Dokumente"] },
    ],
    demo: ["1. Dokument hochladen", "2. Analyse mit Künstlicher Intelligenz", "3. Daten automatisch extrahiert", "4. KI-Red-Flag-Audit", "5. Den KI-Copilot fragen"],
    demoData: { file: "Rechnung_128_2026.pdf", up: "hochgeladen · 214 KB", f: [["Nummer", "128/2026"], ["Netto", "1.000,00 €"], ["USt. 22%", "220,00 €"], ["Summe", "1.220,00 €"], ["IBAN", "IT60X0542811101…"]], a: ["USt.-Abgleich korrekt (1.000 + 220 = 1.220 €)", "Gültige italienische IBAN", "Zahlung fällig in 15 Tagen"], q: "Wie hoch ist der zu zahlende Betrag?", ans: ["Der zu zahlende Betrag ist ", "1.220,00 €", ", fällig am 30.04.2026."] },
  },
  fr: {
    docTypes: { fattura: "Facture", contratto: "Contrat", visura: "Extrait Kbis", f24: "Formulaire Fiscal", busta_paga: "Bulletin de Paie" },
    pipe: ["Analyse", "Classification", "Extraction", "Validation"],
    services: [
      { t: "Formulaires Fiscaux & Factures", d: "Rapprochement automatique Débit/Crédit/Solde, alertes de conformité TVA au-delà de 5 000 €, contrôle des IBAN étrangers et export comptable." },
      { t: "Contrats & Extraits Kbis", d: "Détection des clauses abusives, préavis/rétractation, vérification AML/KYC avec extraction du numéro d'immatriculation, associés et dirigeants." },
      { t: "Bulletins de Paie & RH", d: "Rapprochement Brut/Cotisations/Impôt/Net, indemnités acquises, conformité RGPD & EU AI Act avec serveurs 100% UE et chiffrement AES 256 bits." },
    ],
    features: [
      { tag: "AUDIT", t: "Détecteur d'Alertes IA", d: "Un second cerveau IA qui vérifie vos documents et signale automatiquement les risques avant qu'ils ne deviennent un problème.", points: ["Rapprochement automatique des formulaires fiscaux, factures et bulletins", "Alerte des clauses abusives dans les contrats", "Détection des IBAN étrangers et anomalies anti-blanchiment (AML)", "Alerte de conformité TVA pour les crédits supérieurs à 5 000 €"] },
      { tag: "COPILOT", t: "Copilot Interactif", d: "Posez des questions sur vos documents en langage naturel et obtenez des réponses immédiates, comme un expert toujours disponible.", points: ["Demandez « Quel est le total à payer ? » et obtenez la réponse instantanément", "Résumés et explications des clauses complexes en langage clair", "Comparaison de documents et vérification des données clés", "Propulsé par l'IA Gemini, réponses basées uniquement sur votre document"] },
    ],
    tutorial: [
      { t: "Importez le document", d: "Glissez ou sélectionnez une facture, un formulaire fiscal, un contrat, un extrait Kbis ou un bulletin (PDF, JPG, PNG)." },
      { t: "Choisissez le type (facultatif)", d: "Sélectionnez la catégorie du document pour une extraction encore plus précise, ou laissez l'IA la détecter seule." },
      { t: "Analysez avec l'IA", d: "En environ 2 secondes, obtenez toutes les données structurées (montants, dates, n° TVA, IBAN, totaux) et l'audit anti-erreur." },
      { t: "Interrogez le Copilot", d: "Posez des questions sur le document en langage naturel et obtenez des réponses immédiates et contextuelles." },
      { t: "Exportez les données", d: "Téléchargez les résultats en CSV ou JSON, prêts pour votre logiciel comptable." },
    ],
    testimonials: [
      { n: "Me Alessandro Rossi", s: "Cabinet Rossi & Associés • Milan", t: "Cela a révolutionné notre cabinet. L'extraction des contrats et extraits est précise à 99%. Nous gagnons 12 heures par semaine." },
      { n: "Elena Conti, Expert-comptable", s: "Conti & Partners • Rome", t: "Le rapprochement automatique des soldes fiscaux et des factures a éliminé nos erreurs de saisie manuelle." },
      { n: "Marco Bianchi, Expert-comptable", s: "Cabinet Fiscal Bianchi • Turin", t: "Les 3 crédits gratuits m'ont convaincu. Nous avons acheté le Pack Professional : support et export impeccables." },
      { n: "Chiara Ferrari", s: "Responsable RH • Bologne", t: "Analyser les bulletins prend désormais 2 secondes. Plateforme fiable et intuitive." },
    ],
    guide: [
      { t: "Formulaires Fiscaux & Factures", items: ["Extraction automatique des codes, montants, échéances et soldes", "Rapprochement Débit / Crédit / Solde final avec alerte en cas d'écart", "Détection du visa de conformité pour les crédits de TVA supérieurs à 5 000 €", "Contrôle des IBAN étrangers et export comptable"] },
      { t: "Contrats & Documents Juridiques", items: ["Identification des clauses abusives", "Extraction des parties, objet, durée, honoraires et rétractation", "Alertes sur les préavis et échéances contractuelles critiques", "Résumé en langage clair des clauses complexes"] },
      { t: "Extraits Kbis", items: ["Extraction du numéro d'immatriculation, TVA, siège, capital social et email certifié", "Liste des associés, dirigeants et pouvoirs de signature", "Vérifications AML / KYC et bénéficiaire effectif", "Statut de l'activité et procédures en cours"] },
      { t: "Bulletins de Paie & RH", items: ["Rapprochement Brut / Cotisations / Impôt / Net", "Calcul et vérification des indemnités acquises", "Conformité RGPD & EU AI Act, données traitées 100% dans l'UE", "Chiffrement AES 256 bits des documents"] },
    ],
    demo: ["1. Importez le document", "2. Analyse avec l'Intelligence Artificielle", "3. Données extraites automatiquement", "4. Audit d'alertes IA", "5. Interrogez le Copilot IA"],
    demoData: { file: "Facture_128_2026.pdf", up: "importé · 214 KB", f: [["Numéro", "128/2026"], ["Base HT", "1 000,00 €"], ["TVA 22%", "220,00 €"], ["Total", "1 220,00 €"], ["IBAN", "IT60X0542811101…"]], a: ["Rapprochement TVA correct (1 000 + 220 = 1 220 €)", "IBAN italien valide", "Paiement dû dans 15 jours"], q: "Quel est le total à payer ?", ans: ["Le total à payer est ", "1 220,00 €", ", échéance le 30/04/2026."] },
  },
};
const useContent = () => CONTENT[useI18n().lang] || CONTENT.it;
const useMark = () => MARK[useI18n().lang] || MARK.it;

function LanguageSwitcher() {
  const { lang, change } = useI18n();
  const [open, setOpen] = useState(false);
  const cur = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <div className="lang-wrap" data-testid="lang-switcher">
      <button className="btn btn-sm btn-ghost" data-testid="lang-toggle" onClick={() => setOpen((o) => !o)}>
        <Globe size={15} /> {cur.flag} <span className="lang-code">{cur.code.toUpperCase()}</span>
      </button>
      {open && (
        <div className="lang-menu" onMouseLeave={() => setOpen(false)}>
          {LANGS.map((l) => (
            <div key={l.code} className={`lang-item ${l.code === lang ? "on" : ""}`} data-testid={`lang-${l.code}`}
              onClick={() => { change(l.code); setOpen(false); }}>
              <span>{l.flag}</span> {l.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Social links reali dell'utente. Instagram/X rimossi finché non forniti (niente link morti).
const SOCIALS = [
  { name: "Facebook", Icon: Facebook, url: "https://www.facebook.com/FrancescoEllee" },
  { name: "LinkedIn", Icon: Linkedin, url: "https://www.linkedin.com/in/francesco-e-l-l-e-20058920b/" },
  { name: "YouTube", Icon: Youtube, url: "https://www.youtube.com/@MisteriSvelatix" },
];

const DOC_TYPES = [
  { id: "fattura", Icon: FileText },
  { id: "contratto", Icon: ScrollText },
  { id: "visura", Icon: Building2 },
  { id: "f24", Icon: Landmark },
  { id: "busta_paga", Icon: Wallet },
];

const SECTOR_SLUGS = ["commercialisti", "avvocati", "notai", "cfo", "hr"];

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
  const { t } = useI18n();
  const content = useContent();
  const heroAB = useHeroVariant();
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
  const openPricing = (src) => { track("view_pricing", { src: src || "unknown" }); setPricingOpen(true); };

  useEffect(() => { track("experiment_impression", { experiment: "hero_title", variant: heroAB }); }, [heroAB]);

  useEffect(() => {
    const h = window.location.hash;
    if (h && h.length > 1) setTimeout(() => scrollToId(h.slice(1)), 450);
  }, []);

  useEffect(() => {
    const langs = ["it", "en", "es", "de", "fr"];
    const links = [];
    const add = (hl, href) => { const l = document.createElement("link"); l.rel = "alternate"; l.hreflang = hl; l.href = href; l.setAttribute("data-hl", "1"); document.head.appendChild(l); links.push(l); };
    langs.forEach((l) => add(l, l === "it" ? "https://docuanalytics.online/" : `https://docuanalytics.online/?lang=${l}`));
    add("x-default", "https://docuanalytics.online/");
    return () => links.forEach((l) => l.remove());
  }, []);

  useEffect(() => {
    // handle payment return
    const p = new URLSearchParams(window.location.search);
    if (window.location.pathname === "/payment/success" && p.get("session_id")) {
      pollPayment(p.get("session_id"));
    } else if (window.location.pathname === "/payment/cancel") {
      notify(t("n_pay_cancel"));
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const pollPayment = async (sid, tries = 0) => {
    notify(t("n_pay_verify"));
    try {
      const { data } = await axios.get(`${API}/payments/status/${sid}`);
      if (data.payment_status === "paid") {
        refresh();
        track("purchase", { method: "stripe", credits: data.credits_added, subscription: !!data.is_subscription });
        notify(data.is_subscription
          ? `${t("n_sub_ok")} +${data.credits_added}. ${t("n_renew")}`
          : `${t("n_pay_ok")} +${data.credits_added}`);
        window.history.replaceState({}, "", "/");
        return;
      }
      if (data.payment_status === "expired" || data.payment_status === "failed") {
        notify(t("n_pay_fail")); window.history.replaceState({}, "", "/"); return;
      }
    } catch (e) { console.error("payment status poll error", e); }
    if (tries < 6) setTimeout(() => pollPayment(sid, tries + 1), 2000);
    else { notify(t("n_pay_pending")); window.history.replaceState({}, "", "/"); }
  };

  const onFile = (f) => { if (f) { setFile(f); setResult(null); } };
  const toBase64 = (f) => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f);
  });

  const analyze = async () => {
    if (!file) return;
    if (user.credits <= 0) { notify(t("n_credits_out")); openPricing("credits_out"); return; }
    setAnalyzing(true); setResult(null); setStage(0);
    const timers = [0, 1, 2, 3].map((i) => setTimeout(() => setStage(i), i * 700));
    try {
      const b64 = await toBase64(file);
      const { data } = await axios.post(`${API}/analyze`, {
        user_id: user.user_id, doc_type: docType, filename: file.name,
        mime_type: file.type || "application/octet-stream", file_base64: b64,
      });
      setResult(data.result); setAnalysisId(data.analysis_id);
      track("document_analyzed", { doc_type: data.result?.doc_type || docType });
      setUser((u) => ({ ...u, credits: data.credits }));
      setStage(3);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      const msg = e?.response?.data?.detail || t("n_analyze_fail");
      notify(msg);
      if (e?.response?.status === 402) setPricingOpen(true);
    } finally {
      timers.forEach(clearTimeout); setAnalyzing(false);
    }
  };

  return (
    <div className="App">
      <Header credits={user.credits} authed={authed} user={user}
        onTopup={() => openPricing("header")} onAuth={() => setAuthOpen(true)}
        onReferral={() => setRefOpen(true)} onLogout={() => { logout(); notify(t("n_disconnected")); }} />

      <main className="wrap">
        {/* Hero */}
        <section className="hero fade">
          <div className="hero-badges mb1"><span className="badge badge-info">{t("hero_kicker")}</span></div>
          <h1 data-testid="hero-h1" data-variant={heroAB}>
            {heroAB === "B" ? t("hero_h1a_b") : t("hero_h1a")}<br />
            <span className="grad">{heroAB === "B" ? t("hero_h1b_b") : t("hero_h1b")}</span>
          </h1>
          <p>{t("hero_sub2")}</p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" data-testid="hero-cta-try"
              onClick={() => { track("cta_click", { location: "hero", hero_variant: heroAB }); scrollToId("upload"); }}>
              <Bot size={18} /> {t("cta_try")}
            </button>
            <button className="btn btn-lg btn-ghost" data-testid="hero-cta-how"
              onClick={() => scrollToId("come-funziona")}>
              {t("cta_how")} <ChevronRight size={16} />
            </button>
          </div>
          <div className="hero-free" data-testid="hero-free-note"><CheckCircle2 size={15} color="var(--success)" /> {t("free_note")}</div>
          <div className="hero-rating" data-testid="hero-rating">
            <span className="stars">{[...Array(5)].map((_, k) => <Star key={k} size={14} fill="#ffd600" color="#ffd600" style={{ display: "inline" }} />)}</span>
            <span>{t("rating_line")}</span>
          </div>
          <div className="hero-badges">
            {DOC_TYPES.map(({ id, Icon }) => (
              <span className="hero-badge flex aic gap" key={id}><Icon size={15} /> {content.docTypes[id]}</span>
            ))}
          </div>
        </section>

        {/* Privacy banner + trust badges */}
        <div className="privacy-banner fade" data-testid="privacy-banner">
          <ShieldCheck size={22} className="pb-ic" />
          <span>{t("priv_banner")}</span>
        </div>
        <div className="trust-badges" data-testid="trust-badges">
          <div className="trust-badge"><Lock size={16} /> <span>{t("badge_nostore")}</span></div>
          <div className="trust-badge"><Trash2 size={16} /> <span>{t("badge_delete")}</span></div>
          <div className="trust-badge"><BadgeCheck size={16} /> <span>{t("badge_gdpr")}</span></div>
          <div className="trust-badge"><ShieldCheck size={16} /> <span>{t("badge_https")}</span></div>
          <div className="trust-badge"><Ban size={16} /> <span>{t("badge_noshare")}</span></div>
        </div>

        {/* Upload */}
        <section className="section" id="upload">
          <div className="accent-bar" />
          <h2 className="section-title">{t("up_title")}</h2>
          <p className="section-sub mb1">{t("up_sub")}</p>

          <div className="chips mb1">
            {DOC_TYPES.map(({ id, Icon }) => (
              <div key={id} className={`chip flex aic gap ${docType === id ? "active" : ""}`}
                data-testid={`chip-${id}`} onClick={() => setDocType(docType === id ? "auto" : id)}>
                <Icon size={15} /> {content.docTypes[id]}
              </div>
            ))}
          </div>

          <div className={`upload ${drag ? "drag" : ""}`} data-testid="upload-zone"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}>
            <Upload className="ic" />
            <p style={{ fontWeight: 700, fontSize: "1.05rem" }}>{file ? file.name : t("up_drop")}</p>
            <p style={{ color: "var(--text-muted)", fontSize: ".85rem", marginTop: ".3rem" }}>{t("up_hint")}</p>
            <input ref={inputRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png"
              data-testid="file-input" onChange={(e) => onFile(e.target.files[0])} />
          </div>

          <div className="center mt2">
            <button className="btn btn-primary btn-lg" data-testid="analyze-btn" disabled={!file || analyzing} onClick={analyze}>
              {analyzing ? <><Loader2 className="spinner" /> {t("analyzing")}</> : <><Bot size={18} /> {t("analyze")}</>}
            </button>
          </div>

          {(analyzing || result) && (
            <div className="glass pad mt2">
              <div className="pipe">
                {content.pipe.map((s, i) => (
                  <div className={`pstep ${stage >= i ? "on" : ""}`} key={s}>
                    <div className="pcircle">{stage > i || (result && i <= 3) ? <CheckCircle2 color="var(--success)" /> : i + 1}</div>
                    <div style={{ fontWeight: 700, fontSize: ".85rem" }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {result && <Results result={result} analysisId={analysisId} notify={notify}
          credits={user.credits} onTopup={() => openPricing("after_analysis")}
          onAgain={() => { setFile(null); setResult(null); setStage(-1); scrollToId("upload"); }} />}

        <BenefitsStrip />
        <HowItWorks onCta={() => scrollToId("upload")} />
        <DocTypesSection onCta={() => scrollToId("upload")} />
        <RedFlagSection onCta={() => scrollToId("upload")} />
        <CopilotSection onCta={() => scrollToId("upload")} />
        <SectorsSection onCta={() => scrollToId("upload")} />
        <Services onGuide={() => setGuideOpen(true)} />
        <Tutorials />
        <SecuritySection />
        <Testimonials />
        <PricingPreview onBuy={() => openPricing("pricing_section")} />
        <Faq />
        <TrialCTA onCta={() => { track("cta_click", { location: "final" }); scrollToId("upload"); }} />
        <ReferralBanner authed={authed} onInvite={() => (authed ? setRefOpen(true) : setAuthOpen(true))} />
      </main>

      <Footer onTopup={() => openPricing("footer")} onGuide={() => setGuideOpen(true)} />
      {pricingOpen && <PricingModal user={user} onClose={() => setPricingOpen(false)} notify={notify} />}
      {authOpen && <AuthModal user={user} onClose={() => setAuthOpen(false)} onAuthed={login} notify={notify} />}
      {refOpen && <ReferralModal user={user} onClose={() => setRefOpen(false)} notify={notify} />}
      {guideOpen && <ServicesGuideModal onClose={() => setGuideOpen(false)} />}
      <Toast msg={toast} />
    </div>
  );
}

function Header({ credits, authed, user, onTopup, onAuth, onReferral, onLogout }) {
  const { t } = useI18n();
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo"><img src="/logo.png" alt="DocuAnalytics AI" className="logo-img" /> Docu<span className="grad">Analytics</span> AI</div>
        <nav className="nav">
          <button className="btn btn-sm btn-ghost nav-anchor" data-testid="nav-how" onClick={() => scrollToId("come-funziona")}>{t("nav_how")}</button>
          <button className="btn btn-sm btn-ghost nav-anchor" data-testid="nav-price" onClick={() => scrollToId("prezzi")}>{t("nav_price")}</button>
          <Link to="/blog" className="btn btn-sm btn-ghost" data-testid="nav-blog"><BookOpen size={15} /> {t("blog_link")}</Link>
          <LanguageSwitcher />
          <span className="credits-badge" data-testid="credits-badge"><Zap size={15} /> {credits} {t("credits")}</span>
          <button className="btn btn-primary btn-sm" data-testid="topup-btn" onClick={onTopup}><CreditCard size={15} /> {t("topup")}</button>
          {authed ? (
            <>
              <button className="btn btn-sm" data-testid="referral-btn" onClick={onReferral}><Gift size={15} /> {t("invite")}</button>
              <span className="btn btn-sm btn-ghost" data-testid="user-badge" title={user.email}><User size={15} /> {user.name || "Account"}</span>
              <button className="btn btn-sm" data-testid="logout-btn" onClick={onLogout}><LogOut size={15} /></button>
            </>
          ) : (
            <button className="btn btn-accent btn-sm" data-testid="auth-btn" onClick={onAuth}><LogIn size={15} /> {t("login")}</button>
          )}
        </nav>
      </div>
    </header>
  );
}

function Results({ result, analysisId, notify, credits, onTopup, onAgain }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const fieldsN = (result.fields || []).length;
  const checksN = (result.audit || []).length;

  const ask = async () => {
    if (!q.trim()) return;
    const question = q; setQ(""); setMsgs((m) => [...m, { r: "u", t: question }]); setLoading(true);
    try {
      const { data } = await axios.post(`${API}/chat`, { user_id: localStorage.getItem("da_uid"), analysis_id: analysisId, question });
      setMsgs((m) => [...m, { r: "a", t: data.answer }]);
      track("copilot_used", {});
    } catch { setMsgs((m) => [...m, { r: "a", t: t("n_copilot_err") }]); }
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
    notify(`${t("exported")} ${fmt.toUpperCase()}`);
  };

  return (
    <section className="section fade" id="results">
      <div className="accent-bar" />
      <h2 className="section-title">{t("results_title")}</h2>
      <p className="section-sub mb1">{result.doc_type} — {result.summary}</p>

      <div className="wow-bar" data-testid="wow-bar">
        <CheckCircle2 size={20} color="var(--success)" />
        <strong>{t("wow_done")}</strong>
        <span className="wow-chip"><Sparkles size={13} /> {fieldsN} {t("wow_fields")}</span>
        <span className="wow-chip"><ShieldCheck size={13} /> {checksN} {t("wow_checks")}</span>
      </div>

      <div className="results-grid">
        <div className="glass pad">
          <div className="flex between aic mb1">
            <strong style={{ fontSize: ".95rem" }}>{t("ex_data")}</strong>
            <div className="flex gap">
              <button className="btn btn-sm" data-testid="export-csv" onClick={() => exportData("csv")}><Download size={14} /> CSV</button>
              <button className="btn btn-sm" data-testid="export-json" onClick={() => exportData("json")}><Download size={14} /> JSON</button>
            </div>
          </div>
          {(result.fields || []).map((f, i) => (
            <div className="field-row" key={i}><span className="k">{f.label}</span><span className="v">{String(f.value)}</span></div>
          ))}
          {(!result.fields || result.fields.length === 0) && <p style={{ color: "var(--text-muted)" }}>{t("no_fields")}</p>}
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
            {(!result.audit || result.audit.length === 0) && <p style={{ color: "var(--text-muted)", fontSize: ".85rem" }}>{t("no_anom")}</p>}
          </div>

          <div className="glass pad">
            <div className="flex aic gap mb1"><MessageSquare size={18} color="#E100FF" /><strong>AI Copilot</strong><span className="badge badge-new">CHAT</span></div>
            <div className="chat-box" data-testid="chat-box">
              {msgs.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: ".82rem" }}>{t("chat_empty")}</p>}
              {msgs.map((m, i) => <div className={`msg ${m.r}`} key={i}>{m.t}</div>)}
              {loading && <div className="msg a"><Loader2 className="spinner" /></div>}
            </div>
            <div className="flex gap">
              <input className="input" data-testid="chat-input" placeholder={t("chat_ph")} value={q}
                onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
              <button className="btn btn-primary btn-sm" data-testid="chat-send" onClick={ask}><Send size={15} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="after-cta glass pad" data-testid="after-analysis-cta">
        <div>
          <strong style={{ fontSize: "1rem" }}>{t("after_title")}</strong>
          <p className="section-sub" style={{ marginTop: ".2rem" }}>
            {credits > 0 ? t("after_left").replace("{n}", credits) : t("after_out")}
          </p>
        </div>
        <div className="flex gap wrapf">
          <button className="btn btn-primary" data-testid="analyze-again-btn" onClick={onAgain}>
            <Upload size={16} /> {t("after_again")}
          </button>
          <button className="btn btn-accent" data-testid="after-buy-btn" onClick={onTopup}>
            <CreditCard size={16} /> {t("price_buy")}
          </button>
        </div>
      </div>
    </section>
  );
}

function BenefitsStrip() {
  const m = useMark();
  return (
    <section className="section" id="benefici">
      <div className="benefit-grid">
        {m.benefits.map((b) => {
          const Icon = ICONS[b.icon] || Clock;
          return (
            <div className="glass pad benefit-card" key={b.t} data-testid="benefit-card">
              <Icon size={24} color="var(--accent)" />
              <h3 className="doc-t" style={{ marginTop: ".6rem" }}>{b.t}</h3>
              <p className="doc-d">{b.d}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HowItWorks({ onCta }) {
  const { t } = useI18n();
  const m = useMark();
  return (
    <section className="section" id="come-funziona">
      <div className="accent-bar" />
      <h2 className="section-title">{t("how_title")}</h2>
      <p className="section-sub mb1">{t("how_sub")}</p>
      <div className="how-grid">
        {m.how.map((s) => {
          const Icon = ICONS[s.icon] || Upload;
          return (
            <div className="glass pad how-card" key={s.n} data-testid={`how-step-${s.n}`}>
              <span className="how-num">{s.n}</span>
              <Icon size={26} color="var(--accent)" />
              <h3 className="how-t">{s.t}</h3>
              <p className="how-d">{s.d}</p>
            </div>
          );
        })}
      </div>
      <div className="center mt2">
        <button className="btn btn-primary btn-lg" data-testid="how-cta" onClick={onCta}><Bot size={17} /> {t("cta_try")}</button>
      </div>
    </section>
  );
}

const DOC_ICONS = { fattura: FileText, f24: Landmark, contratto: ScrollText, visura: Building2, busta_paga: Wallet, altri: Files };

function DocTypesSection({ onCta }) {
  const { t } = useI18n();
  const m = useMark();
  return (
    <section className="section" id="documenti">
      <div className="accent-bar" />
      <h2 className="section-title">{t("doc_title")}</h2>
      <p className="section-sub mb1">{t("doc_sub")}</p>
      <div className="doc-grid">
        {m.docs.map((d) => {
          const Icon = DOC_ICONS[d.key] || Files;
          return (
            <div className="glass pad doc-card sector-card" key={d.key} data-testid={`doc-card-${d.key}`} onClick={onCta}>
              <div className="doc-ic"><Icon size={22} color="var(--accent)" /></div>
              <h3 className="doc-t">{d.t}</h3>
              <p className="doc-d">{d.d}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RedFlagSection({ onCta }) {
  const { t } = useI18n();
  const m = useMark();
  const content = useContent();
  const f = content.features[0]; // AUDIT (translated points)
  return (
    <section className="section" id="red-flag">
      <div className="accent-bar" />
      <div className="split">
        <div className="split-txt">
          <span className="badge badge-new mb1" style={{ display: "inline-block" }}>{t("rf_kicker")}</span>
          <h2 className="section-title" style={{ marginTop: ".5rem" }}>{t("rf_title")}</h2>
          <p className="section-sub mb1">{t("rf_sub")}</p>
          <div className="point-list">
            {f.points.map((p) => (
              <div className="point" key={p}><CheckCircle2 size={16} color="var(--success)" /><span>{p}</span></div>
            ))}
          </div>
          <button className="btn btn-primary mt2" data-testid="rf-cta" onClick={onCta}><ShieldAlert size={16} /> {t("cta_try_short")}</button>
        </div>
        <div className="split-vis glass pad" data-testid="rf-visual">
          <div className="flex aic gap mb1"><ShieldAlert size={18} color="var(--accent)" /><strong>{t("rf_finds")}</strong></div>
          {m.rfFinds.map((x, i) => (
            <div className={`audit-item ${i % 3 === 2 ? "audit-warning" : "audit-ok"}`} key={x}>
              {i % 3 === 2 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}<span>{x}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CopilotSection({ onCta }) {
  const { t } = useI18n();
  const m = useMark();
  const content = useContent();
  const f = content.features[1]; // COPILOT
  return (
    <section className="section" id="copilot">
      <div className="accent-bar" />
      <div className="split reverse">
        <div className="split-vis glass pad" data-testid="cop-visual">
          <div className="flex aic gap mb1"><MessageSquare size={18} color="#E100FF" /><strong>{t("cop_examples_ttl")}</strong></div>
          <div className="cop-examples">
            {m.copExamples.map((q) => (
              <div className="cop-q" key={q} onClick={onCta} data-testid="cop-example"><MessageSquare size={13} /> {q}</div>
            ))}
          </div>
        </div>
        <div className="split-txt">
          <span className="badge badge-info mb1" style={{ display: "inline-block" }}>{t("cop_kicker")}</span>
          <h2 className="section-title" style={{ marginTop: ".5rem" }}>{t("cop_title")}</h2>
          <p className="section-sub mb1">{t("cop_sub")}</p>
          <div className="point-list">
            {f.points.map((p) => (
              <div className="point" key={p}><CheckCircle2 size={16} color="var(--success)" /><span>{p}</span></div>
            ))}
          </div>
          <button className="btn btn-primary mt2" data-testid="cop-cta" onClick={onCta}><MessageSquare size={16} /> {t("cop_cta")}</button>
        </div>
      </div>
    </section>
  );
}

function SectorsSection({ onCta }) {
  const { t } = useI18n();
  const m = useMark();
  const navigate = useNavigate();
  return (
    <section className="section" id="settori">
      <div className="accent-bar" />
      <h2 className="section-title">{t("sct_title")}</h2>
      <p className="section-sub mb1">{t("sct_sub")}</p>
      <div className="doc-grid">
        {m.sectors.map((s) => {
          const Icon = ICONS[s.icon] || Briefcase;
          const clickable = SECTOR_SLUGS.includes(s.slug);
          return (
            <div className="glass pad sector-card" key={s.slug} data-testid={`sector-card-${s.slug}`}
              onClick={() => clickable ? navigate(`/${s.slug}`) : onCta()}>
              <div className="doc-ic"><Icon size={22} color="var(--accent)" /></div>
              <h3 className="doc-t">{s.t}</h3>
              <p className="doc-d">{s.d}</p>
              <span className="sector-link">{clickable ? t("sct_cta") : t("cta_try_short")} <ArrowRight size={14} /></span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SecuritySection() {
  const { t } = useI18n();
  const m = useMark();
  return (
    <section className="section" id="sicurezza">
      <div className="accent-bar" />
      <span className="badge badge-info" style={{ display: "inline-block" }}>{t("secp_kicker")}</span>
      <h2 className="section-title" style={{ marginTop: ".5rem" }}>{t("secp_title")}</h2>
      <p className="section-sub mb1">{t("secp_sub")}</p>
      <div className="sec-grid">
        {m.security.map((s) => {
          const Icon = ICONS[s.icon] || ShieldCheck;
          return (
            <div className="glass pad sec-card" key={s.t} data-testid="security-card">
              <div className="doc-ic"><Icon size={20} color="#a78bfa" /></div>
              <h3 className="doc-t">{s.t}</h3>
              <p className="doc-d">{s.d}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PricingPreview({ onBuy }) {
  const { t } = useI18n();
  const [pkgs, setPkgs] = useState([]);
  useEffect(() => { axios.get(`${API}/crypto/info`).then(({ data }) => setPkgs(data.packages || [])).catch(() => {}); }, []);
  const packs = pkgs.filter((p) => p.type === "pack");
  const subs = pkgs.filter((p) => p.type === "sub");
  const row = (p, pop) => (
    <div className={`glass pad price-card ${pop ? "pop" : ""}`} key={p.id} data-testid={`preview-plan-${p.id}`}>
      {pop && <span className="badge badge-info" style={{ position: "absolute", top: 12, right: 12 }}>{t("price_recommended")}</span>}
      <div style={{ fontWeight: 800 }}>{p.name}</div>
      <div className="price-amt">€{p.amount.toFixed(0)}{p.type === "sub" && <span className="per">{t("per_month")}</span>}</div>
      <div className="price-cr">{p.credits >= 99999 ? t("unlim_cr") : `${p.credits} ${t("cr")}`}</div>
      <button className="btn btn-primary mt1" data-testid={`preview-buy-${p.id}`} onClick={onBuy}><CreditCard size={15} /> {t("price_buy")}</button>
    </div>
  );
  return (
    <section className="section" id="prezzi">
      <div className="accent-bar" />
      <h2 className="section-title">{t("price_title")}</h2>
      <p className="section-sub mb1">{t("price_sub")}</p>
      {packs.length > 0 && <>
        <p className="section-sub mb1 mt1" style={{ fontWeight: 700 }}>{t("price_packs")}</p>
        <div className="price-grid mb1">{packs.map((p) => row(p, p.id === "pro"))}</div>
      </>}
      {subs.length > 0 && <>
        <p className="section-sub mb1 mt2" style={{ fontWeight: 700 }}>{t("price_subs")}</p>
        <div className="price-grid">{subs.map((p) => row(p, p.id === "sub_pro"))}</div>
      </>}
      <div className="center mt2">
        <button className="btn btn-accent" data-testid="pricing-preview-all" onClick={onBuy}>{t("price_all")} <ChevronRight size={15} /></button>
      </div>
    </section>
  );
}

function TrialCTA({ onCta }) {
  const { t } = useI18n();
  return (
    <section className="section" id="prova">
      <div className="glass pad final-cta" data-testid="final-cta">
        <Sparkles size={34} color="var(--accent)" />
        <h2 className="section-title mt1">{t("final_title")}</h2>
        <p className="section-sub mb1">{t("final_sub")}</p>
        <div className="hero-free" style={{ justifyContent: "center" }}>
          <CheckCircle2 size={15} color="var(--success)" /> {t("trial_l1")} · {t("trial_l2")}
        </div>
        <button className="btn btn-primary btn-lg mt1" data-testid="trial-cta" onClick={onCta}><Bot size={18} /> {t("trial_cta")}</button>
      </div>
    </section>
  );
}

function Services({ onGuide }) {
  const { t } = useI18n();
  const content = useContent();
  const icons = [Landmark, ScrollText, Wallet];
  return (
    <section className="section" id="servizi">
      <div className="accent-bar" />
      <h2 className="section-title">{t("serv_title")}</h2>
      <p className="section-sub mb1">{t("serv_sub")}</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {content.services.map((c, i) => {
          const Icon = icons[i] || Landmark;
          return (
            <div className="glass pad" key={c.t}>
              <Icon size={28} color="var(--accent)" />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: ".6rem 0 .4rem" }}>{c.t}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: ".85rem", lineHeight: 1.55 }}>{c.d}</p>
            </div>
          );
        })}
      </div>
      <div className="center mt2">
        <button className="btn btn-accent" data-testid="open-guide-btn" onClick={onGuide}><BookOpen size={16} /> {t("guide_btn")}</button>
      </div>
    </section>
  );
}

function DemoPlayer() {
  const c = useContent();
  const d = c.demoData;
  const SCENES = [
    { title: c.demo[0], render: () => (
      <div className="demo-doc fade">
        <FileText size={30} color="var(--accent)" />
        <div>
          <div style={{ fontWeight: 700 }}>{d.file}</div>
          <div style={{ color: "var(--text-muted)", fontSize: ".78rem" }}>{d.up}</div>
        </div>
        <span className="badge badge-ok" style={{ marginLeft: "auto" }}>OK</span>
      </div>
    ) },
    { title: c.demo[1], render: () => (
      <div className="demo-pipe">
        {c.pipe.map((s, i) => (
          <div className="demo-pstep" key={s} style={{ animationDelay: `${i * 0.4}s` }}>
            <div className="demo-pcircle"><CheckCircle2 size={16} color="var(--success)" /></div>
            <span>{s}</span>
          </div>
        ))}
      </div>
    ) },
    { title: c.demo[2], render: () => (
      <div style={{ width: "100%" }}>
        {d.f.map(([k, v], i) => (
          <div className="demo-field fade" key={k} style={{ animationDelay: `${i * 0.18}s` }}>
            <span style={{ color: "var(--text-muted)" }}>{k}</span><strong>{v}</strong>
          </div>
        ))}
      </div>
    ) },
    { title: c.demo[3], render: () => (
      <div style={{ width: "100%" }}>
        <div className="demo-audit audit-ok fade"><CheckCircle2 size={15} /> {d.a[0]}</div>
        <div className="demo-audit audit-ok fade" style={{ animationDelay: ".2s" }}><CheckCircle2 size={15} /> {d.a[1]}</div>
        <div className="demo-audit audit-warning fade" style={{ animationDelay: ".4s" }}><ShieldAlert size={15} /> {d.a[2]}</div>
      </div>
    ) },
    { title: c.demo[4], render: () => (
      <div className="demo-chat">
        <div className="msg u fade">{d.q}</div>
        <div className="msg a fade" style={{ animationDelay: ".5s" }}>{d.ans[0]}<strong>{d.ans[1]}</strong>{d.ans[2]}</div>
      </div>
    ) },
  ];
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const tm = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), 3000);
    return () => clearTimeout(tm);
  }, [scene, playing, SCENES.length]);
  const cur = SCENES[scene];
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
        {SCENES.map((_, i) => (
          <span key={i} className={`demo-dot ${i === scene ? "on" : ""}`} onClick={() => setScene(i)} data-testid={`demo-dot-${i}`} />
        ))}
      </div>
    </div>
  );
}

function Tutorials() {
  const { t } = useI18n();
  const content = useContent();
  return (
    <section className="section" id="tutorial">
      <div className="accent-bar" />
      <div className="flex aic gap mb1"><h2 className="section-title">{t("tut_title")}</h2><Play size={20} color="var(--accent)" /></div>
      <p className="section-sub mb1">{t("tut_sub")}</p>

      <DemoPlayer />

      <div className="grid mt2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        {content.tutorial.map((s, i) => (
          <div className="glass pad" key={s.t}>
            <div className="pcircle" style={{ margin: "0 0 .6rem", width: 40, height: 40, borderColor: "var(--accent)" }}>{i + 1}</div>
            <h4 style={{ fontWeight: 800, fontSize: ".98rem", marginBottom: ".3rem" }}>{s.t}</h4>
            <p style={{ color: "var(--text-secondary)", fontSize: ".84rem", lineHeight: 1.5 }}>{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReferralBanner({ authed, onInvite }) {
  const { t } = useI18n();
  return (
    <section className="section">
      <div className="glass pad" style={{ textAlign: "center", border: "1px solid #00d2ff44" }}>
        <Gift size={34} color="var(--accent)" />
        <h2 className="section-title mt1">{t("ref_title")}</h2>
        <p className="section-sub mb1">{t("ref_sub_a")} <strong style={{ color: "var(--accent)" }}>{t("ref_sub_b")}</strong>{t("ref_sub_c")}</p>
        <button className="btn btn-primary" data-testid="referral-cta" onClick={onInvite}>
          <Gift size={16} /> {authed ? t("ref_cta_in") : t("ref_cta_out")}
        </button>
      </div>
    </section>
  );
}

function Testimonials() {
  const { t } = useI18n();
  const content = useContent();
  const revs = content.testimonials;
  return (
    <section className="section">
      <div className="accent-bar" />
      <h2 className="section-title">{t("testi_title")}</h2>
      <p className="section-sub mb1">⭐ {t("testi_sub")}</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {revs.map((r, i) => (
          <div className="glass pad testi" key={i}>
            <div><div className="stars mb1">{[...Array(5)].map((_, k) => <Star key={k} size={14} fill="#ffd600" color="#ffd600" style={{ display: "inline" }} />)}</div>
              <p style={{ fontStyle: "italic", fontSize: ".85rem", lineHeight: 1.5 }}>"{r.t}"</p></div>
            <div className="divider flex between aic wrapf">
              <div><div style={{ fontWeight: 700, fontSize: ".82rem" }}>{r.n}</div><div style={{ color: "var(--text-muted)", fontSize: ".74rem" }}>{r.s}</div></div>
              <span className="badge badge-ok">{t("verified")}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaypalCheckout({ user, packs, subs, notify, onClose }) {
  const { t } = useI18n();
  const { refresh } = useUser();
  const [cfg, setCfg] = useState(null);
  const [ppMode, setPpMode] = useState("packs");
  const [selPack, setSelPack] = useState("pro");
  const [selSub, setSelSub] = useState("sub_pro");
  const [readyCap, setReadyCap] = useState(false);
  const [readySub, setReadySub] = useState(false);
  const capRef = useRef(null);
  const subRef = useRef(null);
  const selPackRef = useRef(selPack);
  selPackRef.current = selPack;

  useEffect(() => { axios.get(`${API}/paypal/config`).then(({ data }) => setCfg(data)).catch(() => setCfg({ enabled: false })); }, []);

  useEffect(() => {
    if (!cfg?.enabled || !cfg.client_id) return;
    if (window.paypal) { setReadyCap(true); return; }
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${cfg.client_id}&currency=EUR&intent=capture&components=buttons`;
    s.onload = () => setReadyCap(true); s.onerror = () => notify(t("n_pay_start_err"));
    document.body.appendChild(s);
  }, [cfg]); // eslint-disable-line

  useEffect(() => {
    if (!cfg?.enabled || !cfg.client_id) return;
    if (window.paypalSub) { setReadySub(true); return; }
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${cfg.client_id}&vault=true&intent=subscription&components=buttons`;
    s.setAttribute("data-namespace", "paypalSub");
    s.onload = () => setReadySub(true); s.onerror = () => {};
    document.body.appendChild(s);
  }, [cfg]); // eslint-disable-line

  useEffect(() => {
    if (ppMode !== "packs" || !readyCap || !window.paypal || !capRef.current) return;
    capRef.current.innerHTML = "";
    const b = window.paypal.Buttons({
      style: { color: "gold", shape: "pill", label: "paypal", height: 45 },
      createOrder: async () => { track("begin_checkout", { method: "paypal", plan: selPackRef.current }); const { data } = await axios.post(`${API}/paypal/order`, { user_id: user.user_id, package_id: selPackRef.current }); return data.order_id; },
      onApprove: async (d) => { try { const { data: res } = await axios.post(`${API}/paypal/capture`, { order_id: d.orderID }); if (res.status === "paid") { track("purchase", { method: "paypal", credits: res.credits_added }); notify(`${t("n_pay_ok")} +${res.credits_added}`); refresh(); onClose(); } else notify(t("n_pay_fail")); } catch { notify(t("n_pay_fail")); } },
      onError: () => notify(t("n_pay_start_err")),
    });
    if (b.isEligible && !b.isEligible()) return;
    b.render(capRef.current).catch(() => {});
    return () => { try { b.close(); } catch (e) { /* noop */ } };
  }, [ppMode, readyCap]); // eslint-disable-line

  useEffect(() => {
    if (ppMode !== "subs" || !readySub || !window.paypalSub || !subRef.current) return;
    let closed = false; let btn = null;
    subRef.current.innerHTML = "";
    (async () => {
      let planId;
      try { const { data } = await axios.post(`${API}/paypal/subscription/plan`, { package_id: selSub }); planId = data.plan_id; }
      catch { notify(t("n_pay_start_err")); return; }
      if (closed) return;
      btn = window.paypalSub.Buttons({
        style: { color: "blue", shape: "pill", label: "subscribe", height: 45 },
        createSubscription: (d, actions) => actions.subscription.create({ plan_id: planId }),
        onApprove: async (d) => { try { const { data: res } = await axios.post(`${API}/paypal/subscription/activate`, { user_id: user.user_id, package_id: selSub, subscription_id: d.subscriptionID }); if (res.status === "active") { track("purchase", { method: "paypal_sub", credits: res.credits_added }); notify(`${t("n_sub_ok")} +${res.credits_added}. ${t("n_renew")}`); refresh(); onClose(); } else notify(t("n_pay_fail")); } catch { notify(t("n_pay_fail")); } },
        onError: () => notify(t("n_pay_start_err")),
      });
      if (btn.isEligible && !btn.isEligible()) return;
      btn.render(subRef.current).catch(() => {});
    })();
    return () => { closed = true; try { btn && btn.close(); } catch (e) { /* noop */ } };
  }, [ppMode, readySub, selSub]); // eslint-disable-line

  if (cfg && !cfg.enabled) return <p className="section-sub" data-testid="paypal-disabled">PayPal non disponibile al momento.</p>;
  return (
    <div data-testid="paypal-panel">
      <div className="tabs" style={{ marginBottom: ".8rem" }}>
        <div className={`tab ${ppMode === "packs" ? "active" : ""}`} data-testid="pp-mode-packs" onClick={() => setPpMode("packs")}>{t("pp_onetime")}</div>
        <div className={`tab ${ppMode === "subs" ? "active" : ""}`} data-testid="pp-mode-subs" onClick={() => setPpMode("subs")}>{t("pp_subs")}</div>
      </div>
      {cfg?.mode === "sandbox" && <p style={{ color: "#ffb020", fontSize: ".74rem", marginBottom: ".4rem" }}>⚠️ Modalità test PayPal (Sandbox) — nessun pagamento reale.</p>}
      {ppMode === "packs" ? (
        <>
          <p className="section-sub mb1">{t("cr_step1")}</p>
          <select className="input mb1" data-testid="paypal-pkg" value={selPack} onChange={(e) => setSelPack(e.target.value)}>
            {packs.map((p) => <option key={p.id} value={p.id}>{p.name} — €{p.amount} ({p.credits} {t("cr_short")})</option>)}
          </select>
          <div ref={capRef} data-testid="paypal-buttons" style={{ marginTop: ".6rem", minHeight: 50 }} />
        </>
      ) : (
        <>
          <p className="section-sub mb1">{t("cr_step1")}</p>
          <select className="input mb1" data-testid="paypal-sub-pkg" value={selSub} onChange={(e) => setSelSub(e.target.value)}>
            {subs.map((p) => <option key={p.id} value={p.id}>{p.name} — €{p.amount}{t("per_month")} ({p.credits >= 99999 ? t("unlim") : p.credits + " " + t("cr_short")})</option>)}
          </select>
          <div ref={subRef} data-testid="paypal-sub-buttons" style={{ marginTop: ".6rem", minHeight: 50 }} />
        </>
      )}
    </div>
  );
}

function PricingModal({ user, onClose, notify }) {
  const { t } = useI18n();
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
      notify(data.message || t("n_cancel_ok")); loadSubs();
    } catch { notify(t("n_cancel_err")); }
  };

  const packPkgs = info?.packages?.filter((p) => p.type === "pack") || [];
  const subPkgs = info?.packages?.filter((p) => p.type === "sub") || [];

  const buyStripe = async (id) => {
    setLoading(id);
    track("begin_checkout", { method: "stripe", plan: id });
    try {
      const { data } = await axios.post(`${API}/payments/checkout`, {
        package_id: id, origin_url: window.location.origin, user_id: user.user_id,
      });
      window.location.href = data.checkout_url;
    } catch { notify(t("n_pay_start_err")); setLoading(""); }
  };

  const orderCrypto = async () => {
    try {
      const { data } = await axios.post(`${API}/crypto/order`, { user_id: user.user_id, package_id: selPkg, coin });
      notify(`${data.order_id} — ${data.message}`);
    } catch { notify(t("n_crypto_err")); }
  };

  const Card = (p, pop) => (
    <div className={`glass pad price-card ${pop ? "pop" : ""}`} key={p.id}>
      {pop && <span className="badge badge-info" style={{ position: "absolute", top: 12, right: 12 }}>{t("pop")}</span>}
      <div style={{ fontWeight: 800 }}>{p.name}</div>
      <div className="price-amt">€{p.amount.toFixed(0)}{p.type === "sub" && <span className="per">{t("per_month")}</span>}</div>
      <div className="price-cr">{p.credits >= 99999 ? t("unlim_cr") : `${p.credits} ${t("cr")}`}</div>
      <button className="btn btn-primary mt1" data-testid={`buy-${p.id}`} disabled={loading === p.id} onClick={() => buyStripe(p.id)}>
        {loading === p.id ? <Loader2 className="spinner" /> : <><CreditCard size={15} /> {t("buy")}</>}
      </button>
    </div>
  );

  const w = info?.wallets?.[coin];

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal glass pad fade" onClick={(e) => e.stopPropagation()} data-testid="pricing-modal">
        <div className="modal-head">
          <h2 className="section-title">{t("pric_title")}</h2>
          <button className="close-x" data-testid="close-pricing" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="tabs">
          <div className={`tab ${tab === "stripe" ? "active" : ""}`} data-testid="tab-stripe" onClick={() => setTab("stripe")}><CreditCard size={15} style={{ display: "inline", marginRight: 6 }} /> {t("tab_card")}</div>
          <div className={`tab ${tab === "crypto" ? "active" : ""}`} data-testid="tab-crypto" onClick={() => setTab("crypto")}><Bitcoin size={15} style={{ display: "inline", marginRight: 6 }} /> {t("tab_crypto")}</div>
          <div className={`tab ${tab === "paypal" ? "active" : ""}`} data-testid="tab-paypal" onClick={() => setTab("paypal")}><Wallet size={15} style={{ display: "inline", marginRight: 6 }} /> PayPal</div>
        </div>

        {tab === "stripe" && (
          <>
            {subs.length > 0 && (
              <div className="glass pad mb1" data-testid="active-subs" style={{ border: "1px solid #00e67644" }}>
                <strong style={{ fontSize: ".9rem" }}>{t("your_subs")}</strong>
                {subs.map((s) => (
                  <div className="flex between aic wrapf" key={s.subscription_id} style={{ marginTop: ".5rem", gap: ".5rem" }}>
                    <span style={{ fontSize: ".82rem" }}>
                      {s.package_name} — €{s.amount}{t("per_month")}
                      <span className={`badge ${s.status === "active" ? "badge-ok" : "badge-info"}`} style={{ marginLeft: 8 }}>
                        {s.cancel_at_period_end ? t("cancelling") : s.status}
                      </span>
                    </span>
                    {!s.cancel_at_period_end && s.status === "active" && (
                      <button className="btn btn-sm" data-testid={`cancel-sub-${s.subscription_id}`} onClick={() => cancelSub(s.subscription_id)}>{t("cancel")}</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="section-sub mb1">{t("packs_ttl")}</p>
            <div className="price-grid mb1">{packPkgs.map((p) => Card(p, p.id === "pro"))}</div>
            <p className="section-sub mb1 mt2">{t("subs_ttl")}</p>
            <div className="price-grid">{subPkgs.map((p) => Card(p, p.id === "sub_pro"))}</div>
            <p style={{ color: "var(--text-muted)", fontSize: ".74rem", marginTop: "1rem" }}>{t("stripe_note")}</p>
          </>
        )}

        {tab === "crypto" && info && (
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <p className="section-sub mb1">{t("cr_step1")}</p>
              <select className="input mb1" data-testid="crypto-pkg" value={selPkg} onChange={(e) => setSelPkg(e.target.value)}>
                {info.packages.map((p) => <option key={p.id} value={p.id}>{p.name} — €{p.amount} ({p.credits >= 99999 ? t("unlim") : p.credits + " " + t("cr_short")})</option>)}
              </select>
              <p className="section-sub mb1">{t("cr_step2")}</p>
              <div className="tabs">
                <div className={`tab ${coin === "BTC" ? "active" : ""}`} data-testid="coin-btc" onClick={() => setCoin("BTC")}>BTC</div>
                <div className={`tab ${coin === "USDT" ? "active" : ""}`} data-testid="coin-usdt" onClick={() => setCoin("USDT")}>USDT TRC20</div>
              </div>
              <button className="btn btn-accent mt1" data-testid="crypto-order-btn" onClick={orderCrypto}>{t("cr_order")} <ChevronRight size={15} /></button>
            </div>
            <div className="wallet-box">
              <img src={w?.qr} alt="QR" width={200} height={200} />
              <div style={{ fontWeight: 700, marginTop: ".5rem" }}>{w?.label} <span style={{ color: "var(--text-muted)", fontSize: ".75rem" }}>({w?.network})</span></div>
              <div className="addr" data-testid="wallet-address">{w?.address}</div>
              <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(w?.address); notify(t("n_addr_copied")); }}>{t("copy_addr")}</button>
            </div>
          </div>
        )}

        {tab === "paypal" && (
          <PaypalCheckout user={user} packs={packPkgs} subs={subPkgs} notify={notify} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function Faq() {
  const { t } = useI18n();
  const items = [
    { q: t("faq_q1"), a: t("faq_a1") },
    { q: t("faq_q2"), a: t("faq_a2") },
    { q: t("faq_q3"), a: t("faq_a3") },
    { q: t("faq_q4"), a: t("faq_a4") },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="section" id="faq">
      <div className="accent-bar" />
      <div className="flex aic gap mb1"><h2 className="section-title">{t("faq_title")}</h2><ShieldCheck size={20} color="var(--accent)" /></div>
      <div className="faq-list">
        {items.map((it, i) => (
          <div className={`glass faq-item ${open === i ? "open" : ""}`} key={i} data-testid={`faq-item-${i}`}>
            <button className="faq-q" data-testid={`faq-q-${i}`} onClick={() => setOpen((o) => (o === i ? -1 : i))}>
              <span>{it.q}</span>
              <ChevronDown size={20} className="faq-chevron" />
            </button>
            {open === i && <p className="faq-a" data-testid={`faq-a-${i}`}>{it.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer({ onTopup, onGuide }) {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="flex aic gap" style={{ justifyContent: "center", marginBottom: ".4rem" }}>
          <img src="/logo.png" alt="DocuAnalytics AI" className="logo-img" />
          <p style={{ fontWeight: 800 }}>DocuAnalytics Enterprise — AI Document Intelligence</p>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: ".82rem", marginTop: ".3rem" }}>{t("foot_desc")}</p>

        <div className="socials" data-testid="social-links">
          {SOCIALS.map(({ name, Icon, url }) => (
            <a key={name} className="social-btn" href={url} target="_blank" rel="noreferrer"
              aria-label={name} title={name} data-testid={`social-${name.toLowerCase().split(" ")[0]}`}>
              <Icon size={18} />
            </a>
          ))}
        </div>

        <div className="flex gap wrapf aic" style={{ justifyContent: "center", marginTop: "1rem" }}>
          <Link to="/blog" className="btn btn-sm btn-ghost" data-testid="footer-blog"><BookOpen size={14} /> {t("blog_link")}</Link>
          <button className="btn btn-sm btn-ghost" onClick={onGuide}><BookOpen size={14} /> {t("foot_guide")}</button>
          <a className="btn btn-sm btn-ghost" href="mailto:docuanalitics@gmail.com" data-testid="footer-contact"><Mail size={14} /> {t("contact")}</a>
          <button className="btn btn-primary btn-sm" onClick={onTopup}><CreditCard size={14} /> {t("foot_topup")}</button>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: ".72rem", marginTop: "1.2rem" }}>© {new Date().getFullYear()} DocuAnalytics AI · {t("rights")}</p>
      </div>
    </footer>
  );
}

function AuthModal({ user, onClose, onAuthed, notify }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fmtErr = (d) => (typeof d === "string" ? d : Array.isArray(d) ? d.map((e) => e.msg || "").join(" ") : t("auth_err"));

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      if (mode === "register") {
        const { data } = await axios.post(`${API}/auth/register`, {
          email, password, name, user_id: user.user_id, ref: localStorage.getItem("da_ref") || undefined,
        });
        onAuthed(data.token, data.user); notify(`${t("n_welcome")}, ${data.user.name}! 🎉`); onClose();
        track("sign_up", { method: "email", hero_variant: localStorage.getItem("da_hero_ab") || "A" });
      } else {
        const { data } = await axios.post(`${API}/auth/login`, { email, password });
        onAuthed(data.token, data.user); notify(t("n_login_ok")); onClose();
        track("login", { method: "email" });
      }
    } catch (e) {
      setErr(fmtErr(e?.response?.data?.detail) || t("auth_err"));
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal glass pad fade" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} data-testid="auth-modal">
        <div className="modal-head">
          <h2 className="section-title flex aic gap"><Lock size={20} /> {mode === "login" ? t("auth_login") : t("auth_register")}</h2>
          <button className="close-x" data-testid="close-auth" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="tabs">
          <div className={`tab ${mode === "login" ? "active" : ""}`} data-testid="tab-login" onClick={() => setMode("login")}>{t("auth_login")}</div>
          <div className={`tab ${mode === "register" ? "active" : ""}`} data-testid="tab-register" onClick={() => setMode("register")}>{t("auth_register")}</div>
        </div>
        {mode === "register" && (
          <input className="input mb1" data-testid="auth-name" placeholder={t("auth_name_ph")} value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className="input mb1" data-testid="auth-email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input mb1" data-testid="auth-password" type="password" placeholder={t("auth_pw_ph")} value={password}
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        {mode === "register" && localStorage.getItem("da_ref") && (
          <p className="badge badge-ok mb1" style={{ display: "block" }}>{t("auth_bonus")}</p>
        )}
        {err && <p style={{ color: "var(--error)", fontSize: ".82rem", marginBottom: ".6rem" }} data-testid="auth-error">{err}</p>}
        <button className="btn btn-primary" style={{ width: "100%" }} data-testid="auth-submit" disabled={loading} onClick={submit}>
          {loading ? <Loader2 className="spinner" /> : mode === "login" ? t("auth_login") : t("auth_submit_reg")}
        </button>
        <p style={{ color: "var(--text-muted)", fontSize: ".76rem", marginTop: ".8rem", textAlign: "center" }}>
          {t("auth_helper")}
        </p>
      </div>
    </div>
  );
}

function ReferralModal({ user, onClose, notify }) {
  const { t } = useI18n();
  const [info, setInfo] = useState(null);
  useEffect(() => { axios.get(`${API}/referral/${user.user_id}`).then(({ data }) => setInfo(data)).catch(() => {}); }, [user.user_id]);
  const link = info ? `${window.location.origin}/?ref=${info.referral_code}` : "";
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal glass pad fade" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()} data-testid="referral-modal">
        <div className="modal-head">
          <h2 className="section-title flex aic gap"><Gift size={20} /> {t("ref_ttl")}</h2>
          <button className="close-x" data-testid="close-referral" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="section-sub mb1">{t("ref_desc_a")} <strong style={{ color: "var(--accent)" }}>{t("ref_desc_b")}</strong> {t("ref_desc_c")}</p>
        <div className="addr" data-testid="referral-link">{link || "..."}</div>
        <div className="flex gap wrapf">
          <button className="btn btn-primary btn-sm" data-testid="copy-referral" onClick={() => { navigator.clipboard.writeText(link); notify(t("n_link_copied")); }}><Copy size={14} /> {t("copy_link")}</button>
          <a className="btn btn-sm" href={`https://wa.me/?text=${encodeURIComponent(t("ref_share") + " " + link)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="btn btn-sm" href={`https://t.me/share/url?url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">Telegram</a>
        </div>
        {info && <p className="mt2" style={{ fontSize: ".85rem" }}>{t("invited_lbl")}: <strong style={{ color: "var(--accent)" }} data-testid="invited-count">{info.invited_count}</strong> · {t("earned_lbl")}: <strong>{info.invited_count * info.bonus_per_invite}</strong></p>}
      </div>
    </div>
  );
}

const GUIDE_ICONS = [Landmark, ScrollText, Building2, Wallet];

function ServicesGuideModal({ onClose }) {
  const { t } = useI18n();
  const content = useContent();
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal glass pad fade" onClick={(e) => e.stopPropagation()} data-testid="guide-modal">
        <div className="modal-head">
          <h2 className="section-title flex aic gap"><BookOpen size={20} /> {t("guide_ttl")}</h2>
          <button className="close-x" data-testid="close-guide" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="section-sub mb1">{t("guide_sub")}</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          {content.guide.map((g, i) => {
            const Icon = GUIDE_ICONS[i] || Landmark;
            return (
              <div className="glass pad" key={g.t}>
                <div className="flex aic gap mb1"><Icon size={24} color="var(--accent)" /><strong>{g.t}</strong></div>
                {g.items.map((it) => (
                  <div className="flex gap" key={it} style={{ alignItems: "flex-start", marginBottom: ".4rem" }}>
                    <CheckCircle2 size={15} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: ".84rem", color: "var(--text-secondary)" }}>{it}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="glass pad mt2 flex aic gap wrapf" style={{ justifyContent: "space-between" }}>
          <span className="flex aic gap"><Sparkles size={18} color="var(--accent)" /> {t("guide_foot")}</span>
          <button className="btn btn-primary btn-sm" data-testid="guide-close-cta" onClick={onClose}>{t("start_now")} <ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function SectorLanding({ slug }) {
  const { t, lang } = useI18n();
  const m = useMark();
  const navigate = useNavigate();
  const data = (SECTORS[lang] || SECTORS.it)[slug];
  const sect = m.sectors.find((s) => s.slug === slug);

  useEffect(() => {
    if (!data) return;
    const prevTitle = document.title;
    document.title = data.meta_title;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta ? meta.getAttribute("content") : null;
    if (meta) meta.setAttribute("content", data.meta_desc);
    window.scrollTo(0, 0);
    track("view_item", { item_category: "sector", sector: slug });
    return () => { document.title = prevTitle; if (meta && prevDesc) meta.setAttribute("content", prevDesc); };
  }, [slug, lang, data]);

  if (!data || !sect) return <Navigate to="/" replace />;
  const Icon = ICONS[sect.icon] || Briefcase;
  const goTry = () => { track("cta_click", { location: "sector_hero", sector: slug }); navigate(`/?src=${slug}#upload`); };

  return (
    <div className="App">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo" data-testid="sl-logo" style={{ textDecoration: "none", color: "inherit" }}>
            <img src="/logo.png" alt="DocuAnalytics AI" className="logo-img" /> Docu<span className="grad">Analytics</span> AI
          </Link>
          <nav className="nav">
            <Link to="/" className="btn btn-sm btn-ghost" data-testid="sl-back">{t("sl_back")}</Link>
            <LanguageSwitcher />
            <button className="btn btn-primary btn-sm" data-testid="sl-nav-try" onClick={goTry}><Bot size={14} /> {t("cta_try_short")}</button>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <section className="hero fade" data-testid="sl-hero">
          <div className="hero-badges mb1"><span className="badge badge-info">{t("sl_for")} {sect.t}</span></div>
          <h1 data-testid="sl-h1">{sect.t}<br /><span className="grad">{sect.d}</span></h1>
          <p className="sl-problem">{data.problem}</p>
          <p className="sl-solution">{data.solution}</p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" data-testid="sl-cta-try" onClick={goTry}><Bot size={18} /> {t("cta_try")}</button>
          </div>
          <div className="hero-free"><CheckCircle2 size={15} color="var(--success)" /> {t("free_note")}</div>
          <div className="hero-rating"><span className="stars">{[...Array(5)].map((_, k) => <Star key={k} size={14} fill="#ffd600" color="#ffd600" style={{ display: "inline" }} />)}</span><span>{t("rating_line")}</span></div>
        </section>

        <section className="section" data-testid="sl-usecases">
          <div className="accent-bar" />
          <div className="split">
            <div className="split-txt">
              <h2 className="section-title">{t("sl_usecases")}</h2>
              <div className="point-list mt1">
                {data.useCases.map((u) => <div className="point" key={u}><CheckCircle2 size={16} color="var(--success)" /><span>{u}</span></div>)}
              </div>
            </div>
            <div className="split-txt">
              <h2 className="section-title">{t("sl_benefits")}</h2>
              <div className="point-list mt1">
                {data.benefits.map((b) => <div className="point" key={b}><Sparkles size={16} color="var(--accent)" /><span>{b}</span></div>)}
              </div>
            </div>
          </div>
          <div className="glass pad mt2 sl-example" data-testid="sl-example">
            <div className="flex aic gap mb1"><Icon size={22} color="var(--accent)" /><strong>{t("sl_example")}</strong></div>
            <p className="doc-d" style={{ fontSize: ".95rem" }}>{data.example}</p>
            <button className="btn btn-primary mt1" data-testid="sl-example-cta" onClick={goTry}><Bot size={15} /> {t("cta_try_short")}</button>
          </div>
        </section>

        <SecuritySection />
        <Testimonials />

        <section className="section" data-testid="sl-other">
          <h2 className="section-title mb1">{t("sl_other")}</h2>
          <div className="doc-grid">
            {m.sectors.filter((s) => s.slug !== slug && SECTOR_SLUGS.includes(s.slug)).map((s) => {
              const SI = ICONS[s.icon] || Briefcase;
              return (
                <div className="glass pad sector-card" key={s.slug} data-testid={`sl-other-${s.slug}`} onClick={() => navigate(`/${s.slug}`)}>
                  <div className="doc-ic"><SI size={22} color="var(--accent)" /></div>
                  <h3 className="doc-t">{s.t}</h3>
                  <p className="doc-d">{s.d}</p>
                  <span className="sector-link">{t("sct_cta")} <ArrowRight size={14} /></span>
                </div>
              );
            })}
          </div>
        </section>

        <TrialCTA onCta={goTry} />
      </main>

      <Footer onTopup={() => navigate("/?src=" + slug + "#prezzi")} onGuide={() => navigate("/")} />
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          {SECTOR_SLUGS.map((s) => <Route key={s} path={`/${s}`} element={<SectorLanding slug={s} />} />)}
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
export default App;
