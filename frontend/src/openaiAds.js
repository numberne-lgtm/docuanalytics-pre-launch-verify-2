// OpenAI Ads browser conversion tracking. No measurement without explicit opt-in.
// See https://developers.openai.com/ads/measurement-pixel
const PIXEL_ID = "LvESpKkY56Q3FFYMKnxDuY";
const CONSENT_KEY = "da_ads_measurement_consent";
let initialized = false;
const measured = new Set();

export function adsConsentGranted() {
  try { return localStorage.getItem(CONSENT_KEY) === "yes"; } catch { return false; }
}
export function adsConsentChosen() {
  try { return localStorage.getItem(CONSENT_KEY) !== null; } catch { return false; }
}
export function initAdsPixel() {
  if (typeof window === "undefined" || !adsConsentGranted()) return false;
  if (initialized) return true;
  if (!window.oaiq) {
    const q = function () { q.q.push(arguments); };
    q.q = [];
    window.oaiq = q;
    window.oaiq("consent", false);
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
    document.head.appendChild(script);
  }
  window.oaiq("consent", false);
  window.oaiq("init", { pixelId: PIXEL_ID });
  window.oaiq("consent", true);
  initialized = true;
  return true;
}
export function setAdsMeasurementConsent(granted) {
  try { localStorage.setItem(CONSENT_KEY, granted ? "yes" : "no"); } catch { return; }
  if (granted) initAdsPixel();
  else if (window.oaiq) window.oaiq("consent", false);
}
export function trackAdsRegistration(userId) {
  if (!userId || !initAdsPixel()) return false;
  const id = "registration_" + String(userId);
  if (measured.has(id)) return false;
  try { if (localStorage.getItem("da_ads_" + id) === "sent") return false; } catch { /* storage unavailable */ }
  window.oaiq("measure", "registration_completed", { type: "customer_action" }, { event_id: id });
  measured.add(id);
  try { localStorage.setItem("da_ads_" + id, "sent"); } catch { /* storage unavailable */ }
  return true;
}
