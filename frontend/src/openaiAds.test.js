import { adsConsentChosen, adsConsentGranted, initAdsPixel, setAdsMeasurementConsent, trackAdsRegistration } from "./openaiAds";

beforeEach(() => {
  localStorage.clear();
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
