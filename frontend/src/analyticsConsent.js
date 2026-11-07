const KEY = "da_analytics_consent_v1";
const TAG = "G-ZQ2FJJKY2H";
const SCRIPT_ID = "docuanalytics-analytics";
const PUBLIC_HOSTS = ["docuanalytics.online", "www.docuanalytics.online"];
export const PREFERENCES_EVENT = "docuanalytics:cookie-preferences";

export function readAnalyticsChoice() {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

export function applyAnalyticsChoice(choice) {
  const allowed = choice === "accepted" && PUBLIC_HOSTS.includes(window.location.hostname);
  window[`ga-disable-${TAG}`] = !allowed;
  if (!allowed) {
    for (const entry of document.cookie.split(";")) {
      const name = entry.split("=")[0].trim();
      if (!/^_ga(?:_[A-Z0-9]+)?$/.test(name)) continue;
      document.cookie = `${name}=; Max-Age=0; Path=/`;
      if (PUBLIC_HOSTS.includes(window.location.hostname)) {
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=docuanalytics.online`;
      }
    }
    return;
  }
  if (document.getElementById(SCRIPT_ID)) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", TAG, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${TAG}`;
  document.head.appendChild(script);
}

export function saveAnalyticsChoice(choice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // A browser that blocks storage can still apply the choice for this visit.
  }
  applyAnalyticsChoice(choice);
}
