// GA4 opt-in only. Never use this module for advertising consent.
const ID = "G-ZQ2FJJKY2H";
const KEY = "da_ga4_analytics_consent";
const MARKETING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const SAFE_VALUE = /^[a-zA-Z0-9_-]{1,100}$/;
const PUBLIC_PATH = /^\/(commercialisti|consulenti-del-lavoro|avvocati|imprese|pmi|professionisti|blog|assistant|area|payment\/success|payment\/cancel)$/;
let loaded = false;
let lastPageKey = null;
let lastPage = "";
const sent = new Set();

export function analyticsChoice() {
  try { const value = window.localStorage.getItem(KEY); return value === "yes" || value === "no" ? value : null; } catch { return null; }
}

export function safeAnalyticsLocation(raw, base) {
  try {
    const u = new URL(raw, base);
    if (!/^https?:$/.test(u.protocol)) return "";
    let path = u.pathname;
    if (/^\/area\/panoramica(?:\/|$)/.test(path)) path = "/area/panoramica";
    else if (/^\/area\//.test(path)) path = "/area";
    else if (/^\/blog\//.test(path)) path = "/blog/article";
    else if (path !== "/" && !PUBLIC_PATH.test(path)) path = "/other";
    const clean = new URL(path, u.origin);
    if (path === "/" || PUBLIC_PATH.test(path) || path === "/blog/article") {
      if (!/^\/(area|payment|assistant)(\/|$)/.test(path)) {
        for (const key of MARKETING_KEYS) {
          const value = u.searchParams.get(key);
          if (value && SAFE_VALUE.test(value)) clean.searchParams.set(key, value);
        }
      }
    }
    return clean.href;
  } catch { return ""; }
}

export function safeReferrer(raw) {
  try {
    const u = new URL(raw);
    return /^https?:$/.test(u.protocol) ? u.origin + "/" : "";
  } catch { return ""; }
}

function setup() {
  if (analyticsChoice() !== "yes") return false;
  window["ga-disable-" + ID] = false;
  if (loaded) return true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("consent", "default", {analytics_storage:"denied", ad_storage:"denied", ad_user_data:"denied", ad_personalization:"denied"});
  window.gtag("consent", "update", {analytics_storage:"granted", ad_storage:"denied", ad_user_data:"denied", ad_personalization:"denied"});
  window.gtag("js", new Date());
  window.gtag("config", ID, {
    send_page_view:false, allow_google_signals:false, allow_ad_personalization_signals:false,
    page_location:safeAnalyticsLocation(window.location.href), page_referrer:safeReferrer(document.referrer),
    page_title:"DocuAnalytics"
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  script.referrerPolicy = "no-referrer";
  document.head.appendChild(script);
  loaded = true;
  return true;
}

export function setAnalyticsConsent(granted) {
  try { window.localStorage.setItem(KEY, granted ? "yes" : "no"); } catch { return false; }
  if (!granted) {
    window["ga-disable-" + ID] = true;
    if (loaded && window.gtag) window.gtag("consent", "update", {analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"});
    lastPageKey = null;
    lastPage = "";
    // Best-effort removal of first-party GA cookies; no other app cookies are touched.
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (name === "_ga" || name.startsWith("_ga_")) {
        document.cookie = name + "=; Max-Age=0; Path=/; SameSite=Lax";
        document.cookie = name + "=; Max-Age=0; Path=/; Domain=" + window.location.hostname + "; SameSite=Lax";
      }
    }
  } else if (loaded && window.gtag) {
    window["ga-disable-" + ID] = false;
    window.gtag("consent", "update", {analytics_storage:"granted",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"});
  }
  return true;
}

export function trackAnalyticsPage(key) {
  if (!setup() || lastPageKey === key) return false;
  const page = safeAnalyticsLocation(window.location.href);
  if (!page) return false;
  const ref = lastPage || safeReferrer(document.referrer);
  window.gtag("set", {page_location:page, page_referrer:ref, page_title:"DocuAnalytics"});
  window.gtag("event", "page_view", {page_location:page, page_referrer:ref, page_title:"DocuAnalytics", send_to:ID});
  lastPage = page;
  lastPageKey = key;
  return true;
}

const PARAMS = {
  view_pricing:["src"], experiment_impression:["experiment","variant"],
  document_analyzed:["doc_type"], model_compared:["model"],
  cta_click:["location","hero_variant","sector"], copilot_used:[],
  begin_checkout:["method","plan"], sign_up:["method","hero_variant"],
  login:["method"], view_item:["item_category","sector"]
};

export function validPurchase(p) {
  return !!p && typeof p.transaction_id === "string" && /^da_[a-f0-9]{64}$/.test(p.transaction_id)
    && Number.isFinite(p.value) && p.value > 0 && p.currency === "EUR"
    && Array.isArray(p.items) && p.items.length === 1 && SAFE_VALUE.test(p.items[0].item_id || "")
    && p.items[0].quantity === 1 && p.items[0].price === p.value;
}

export function trackAnalytics(event, params = {}) {
  try {
    if (event === "purchase") {
      if (!validPurchase(params) || sent.has(params.transaction_id)) return false;
    } else if (!Object.prototype.hasOwnProperty.call(PARAMS, event)) return false;
    if (!setup()) return false;
    const safe = {};
    if (event === "purchase") {
      safe.transaction_id = params.transaction_id;
      safe.value = params.value;
      safe.currency = params.currency;
      safe.items = [{item_id:params.items[0].item_id, price:params.value, quantity:1}];
    } else {
      for (const key of PARAMS[event]) {
        const value = params[key];
        // No arbitrary text, identifiers, document names, email or file contents.
        if (key === "doc_type") continue;
        if (typeof value === "string" && SAFE_VALUE.test(value)) safe[key] = value;
      }
    }
    const page = safeAnalyticsLocation(window.location.href);
    window.gtag("event", event, {...safe, page_location:page, page_referrer:lastPage || safeReferrer(document.referrer), page_title:"DocuAnalytics", send_to:ID});
    if (event === "purchase") sent.add(params.transaction_id);
    return true;
  } catch { return false; }
}
