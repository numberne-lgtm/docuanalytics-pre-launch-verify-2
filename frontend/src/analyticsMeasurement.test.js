import { analyticsChoice, safeAnalyticsLocation, safeReferrer, validPurchase, trackAnalytics, setAnalyticsConsent, trackVerifiedSignup } from "./analyticsMeasurement";
beforeEach(() => { localStorage.clear(); delete window.gtag; });
test("private document URLs are normalized and query/fragment removed", () => {
  expect(safeAnalyticsLocation("https://docuanalytics.online/area/panoramica/private-id?email=a%40b.it#secret")).toBe("https://docuanalytics.online/area/panoramica");
  expect(safeAnalyticsLocation("https://docuanalytics.online/payment/success?session_id=secret")).toBe("https://docuanalytics.online/payment/success");
});
test("only whitelisted marketing parameters survive", () => {
  expect(safeAnalyticsLocation("https://docuanalytics.online/?utm_source=facebook&email=secret&utm_content=post_123#private")).toBe("https://docuanalytics.online/?utm_source=facebook&utm_content=post_123");
  expect(safeReferrer("https://example.com/private?q=secret")).toBe("https://example.com/");
});
test("no consent means no event or script", () => {
  expect(analyticsChoice()).toBe(null);
  expect(trackAnalytics("cta_click", {location:"hero"})).toBe(false);
  expect(trackVerifiedSignup("private-id")).toBe(false);
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
});
test("purchase contract rejects missing IDs and zero values", () => {
  const p = {transaction_id:"da_"+"a".repeat(64), value:19, currency:"EUR", items:[{item_id:"starter",price:19,quantity:1}]};
  expect(validPurchase(p)).toBe(true);
  expect(validPurchase({...p,value:0})).toBe(false);
  expect(validPurchase({...p,transaction_id:"raw_secret"})).toBe(false);
  expect(validPurchase({...p,currency:"USD"})).toBe(false);
});
