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
  expect(sessionStorage.getItem("da_ads_registration_new-user")).toBe("sent");
});

test("revoking consent disables further registration measurement", () => {
  setAdsMeasurementConsent(true);
  setAdsMeasurementConsent(false);
  expect(adsConsentGranted()).toBe(false);
  expect(trackAdsRegistration("after-revocation")).toBe(false);
});
