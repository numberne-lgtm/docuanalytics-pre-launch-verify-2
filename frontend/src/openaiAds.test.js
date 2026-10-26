import { adsConsentChosen, adsConsentGranted, initAdsPixel, setAdsMeasurementConsent, trackAdsRegistration } from "./openaiAds";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete window.oaiq;
  document.querySelectorAll('script[src*="bzrcdn.openai.com"]').forEach(el => el.remove());
});

test("advertising measurement requires explicit opt-in", () => {
  expect(adsConsentChosen()).toBe(false);
  expect(adsConsentGranted()).toBe(false);
  expect(initAdsPixel()).toBe(false);
  expect(trackAdsRegistration("u1")).toBe(false);
});

test("rejecting advertising measurement keeps tracking disabled", () => {
  setAdsMeasurementConsent(false);
  expect(adsConsentChosen()).toBe(true);
  expect(adsConsentGranted()).toBe(false);
  expect(trackAdsRegistration("u2")).toBe(false);
});

test("opt-in initializes measurement and tracks a completed registration once", () => {
  setAdsMeasurementConsent(true);
  expect(adsConsentGranted()).toBe(true);
  expect(typeof window.oaiq).toBe("function");
  expect(trackAdsRegistration("new-user")).toBe(true);
  expect(trackAdsRegistration("new-user")).toBe(false);
  expect(localStorage.getItem("da_ads_registration_new-user")).toBe("sent");
});

test("revoking consent disables further registration measurement", () => {
  setAdsMeasurementConsent(true);
  setAdsMeasurementConsent(false);
  expect(adsConsentGranted()).toBe(false);
  expect(trackAdsRegistration("after-revocation")).toBe(false);
});

test("registration conversion stays deduplicated after browser session storage resets", () => {
  setAdsMeasurementConsent(true);
  expect(trackAdsRegistration("persistent-user")).toBe(true);
  sessionStorage.clear();
  expect(trackAdsRegistration("persistent-user")).toBe(false);
  expect(localStorage.getItem("da_ads_registration_persistent-user")).toBe("sent");
});

test("verified registration sends the expected conversion payload to the SDK queue", () => {
  setAdsMeasurementConsent(true);
  expect(trackAdsRegistration("verified-synthetic-user")).toBe(true);
  const calls = window.oaiq.q.map(args => Array.from(args));
  const measurements = calls.filter(args => args[0] === "measure");
  expect(measurements).toHaveLength(1);
  expect(measurements[0]).toEqual([
    "measure", "registration_completed", { type: "customer_action" },
    { event_id: "registration_verified-synthetic-user" },
  ]);
});

test("no advertising script or conversion is created when consent is rejected", () => {
  setAdsMeasurementConsent(false);
  expect(trackAdsRegistration("rejected-synthetic-user")).toBe(false);
  expect(document.querySelectorAll('script[src*="bzrcdn.openai.com"]')).toHaveLength(0);
  expect(localStorage.getItem("da_ads_registration_rejected-synthetic-user")).toBeNull();
});


test("verified login does not measure without consent, then measures once after opt-in", () => {
  const syntheticVerifiedLogin = { user: { user_id: "late-consent-user" }, recently_verified_registration: true };
  const measureFromVerifiedLogin = data =>
    data.recently_verified_registration && trackAdsRegistration(data.user?.user_id);
  expect(measureFromVerifiedLogin(syntheticVerifiedLogin)).toBe(false);
  expect(document.querySelectorAll('script[src*="bzrcdn.openai.com"]')).toHaveLength(0);
  setAdsMeasurementConsent(true);
  expect(measureFromVerifiedLogin(syntheticVerifiedLogin)).toBe(true);
  expect(measureFromVerifiedLogin(syntheticVerifiedLogin)).toBe(false);
  const measures = window.oaiq.q.map(args => Array.from(args)).filter(args => args[0] === "measure");
  expect(measures).toHaveLength(1);
  expect(measures[0][3]).toEqual({ event_id: "registration_late-consent-user" });
});

test("unverified and old verified login flags never generate a registration conversion", () => {
  setAdsMeasurementConsent(true);
  const measureFromLogin = data =>
    data.recently_verified_registration && trackAdsRegistration(data.user?.user_id);
  expect(measureFromLogin({ user: { user_id: "unverified-login" }, recently_verified_registration: false })).toBe(false);
  expect(measureFromLogin({ user: { user_id: "expired-verification" }, recently_verified_registration: false })).toBe(false);
  const measures = window.oaiq.q.map(args => Array.from(args)).filter(args => args[0] === "measure");
  expect(measures).toHaveLength(0);
});

test("revoking consent between verified logins prevents a second conversion", () => {
  setAdsMeasurementConsent(true);
  expect(trackAdsRegistration("first-consented-user")).toBe(true);
  setAdsMeasurementConsent(false);
  expect(trackAdsRegistration("second-revoked-user")).toBe(false);
  const measures = window.oaiq.q.map(args => Array.from(args)).filter(args => args[0] === "measure");
  expect(measures).toHaveLength(1);
  expect(localStorage.getItem("da_ads_registration_second-revoked-user")).toBeNull();
});

test("re-granting consent does not replay a previously measured registration", () => {
  setAdsMeasurementConsent(true);
  expect(trackAdsRegistration("consent-cycle-user")).toBe(true);
  setAdsMeasurementConsent(false);
  setAdsMeasurementConsent(true);
  expect(trackAdsRegistration("consent-cycle-user")).toBe(false);
  const measures = window.oaiq.q.map(args => Array.from(args)).filter(args => args[0] === "measure");
  expect(measures).toHaveLength(1);
});

test("a missing user ID never produces an advertising conversion", () => {
  setAdsMeasurementConsent(true);
  expect(trackAdsRegistration(undefined)).toBe(false);
  expect(trackAdsRegistration(null)).toBe(false);
  expect(trackAdsRegistration("")).toBe(false);
  const measures = window.oaiq.q.map(args => Array.from(args)).filter(args => args[0] === "measure");
  expect(measures).toHaveLength(0);
});
