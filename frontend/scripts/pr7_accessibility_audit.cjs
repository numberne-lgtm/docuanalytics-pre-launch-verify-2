/* Synthetic-only accessibility audit, no real credentials, production, or paid APIs.
 * Uses WCAG 2.2 A/AA automated checks; manual screen reader and legal review still required.
 */
const { chromium } = require("playwright");
const axe = require("axe-core");
const fs = require("node:fs");
const origin = "http://127.0.0.1:8765";
const browserPath = process.env.PR7_CHROME_PATH || "/usr/bin/google-chrome";
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const context = await browser.newContext({ bypassCSP: true, viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const findings = [];
  await page.route("**/*", route => {
    const u = new URL(route.request().url());
    return u.origin === origin || ["data:", "blob:"].includes(u.protocol)
      ? route.continue() : route.abort("blockedbyclient");
  });
  const check = async (name) => {
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
      rules: { "color-contrast": { enabled: true } }
    }));
    findings.push({
      view: name,
      violations: result.violations.map(v => ({
        id: v.id, impact: v.impact, description: v.description, help: v.help,
        nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })).slice(0, 12)
      })),
      incomplete: result.incomplete.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length })),
      passed: result.passes.length
    });
  };
  try {
    await page.goto(origin + "/area");
    await page.getByRole("button", { name: "Solo necessari", exact: true }).click();
    await page.getByTestId("workspace-login").click();
    await page.getByTestId("auth-modal").waitFor();
    await page.getByTestId("auth-email").fill("studio-a@demo.invalid");
    await page.getByTestId("auth-password").fill("synthetic-local-only");
    await page.getByTestId("auth-submit").click();
    await page.getByTestId("workspace-page").waitFor();
    await page.getByTestId("risk-dashboard").waitFor();
    await page.getByTestId("priorities-list").locator("[data-ws-nav-row]").first().waitFor();
    await check("Risk Dashboard / Priorità");
    await page.getByTestId("priority-0").click();
    await page.getByTestId("doc-panel").waitFor();
    await check("Dettaglio documento (dialogo)");
    await page.keyboard.press("Escape");
    await page.getByTestId("doc-panel").waitFor({state: "detached"});
    await page.getByTestId("ws-nav-clients").click();
    await page.getByTestId("client-pr7-client-a").waitFor();
    await check("Clienti");
    await page.getByTestId("client-pr7-client-a").click();
    await page.getByTestId("client-360").waitFor();
    await check("Scheda cliente");
    await page.getByTestId("client-back").click();
    await page.getByTestId("ws-nav-documents").click();
    await page.getByTestId("doc-pr7-analysis-a").waitFor();
    await check("Documenti");
    await page.getByTestId("ws-nav-deadlines").click();
    await page.getByTestId("deadlines-view").waitFor();
    await page.getByTestId("deadline-tab-later").click();
    await page.getByTestId("deadline-pr7-deadline-a").waitFor();
    await check("Scadenze");
    await page.getByTestId("deadline-tab-review").click();
    await page.getByTestId("historical-review").waitFor();
    await check("Revisione scadenze");
    fs.writeFileSync("/tmp/pr7-accessibility-report.json", JSON.stringify({
      standard: "WCAG 2.2 A/AA (automated subset) plus best practice",
      tool: "axe-core", syntheticOnly: true, findings
    }, null, 2));
    const total = findings.reduce((n, x) => n + x.violations.length, 0);
    for (const v of findings) {
      console.log("A11Y", v.view, v.violations.map(x => x.id + ":" + x.impact).join(",") || "0 reported violations");
    }
    console.log("Automated audit done:", findings.length, "views,", total, "rule violations. See artifact for details.");
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
