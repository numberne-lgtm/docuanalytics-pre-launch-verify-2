/* PR #7 browser + REAL local synthetic backend integration.
 * No API mocks. Only an isolated MongoDB, synthetic login and workspace router.
 * Run against 127.0.0.1:8765, NEVER the live website.
 */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const origin = "http://127.0.0.1:8765";
const priorityPath = "/area/priorita/document/pr7-analysis-a";
const deadlinePath = "/area/priorita/deadline/pr7-deadline-a";
const browserPath = process.env.PR7_CHROME_PATH || "/usr/bin/google-chrome";

async function loginFromPriority(page, path, email) {
  await page.goto(origin + path);
  await page.getByTestId("priority-login-required").waitFor({ timeout: 20000 });
  const href = await page.getByTestId("priority-login-required").locator("a").getAttribute("href");
  assert(href.includes("return_to="), "The priority URL must survive login");
  await page.getByTestId("priority-login-required").locator("a").click();
  await page.getByTestId("auth-modal").waitFor({ timeout: 20000 });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill("synthetic-local-only");
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(origin + path, { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const page = await browser.newPage({ viewport: {width: 390, height: 844}, acceptDownloads: true });
  // Block cross-origin browser requests. Staging must not call analytics or external services.
  for (const p of [page]) {
    await p.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin && url.protocol !== "data:" && url.protocol !== "blob:") {
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
  }
  try {
    const check = await page.request.get(origin + "/api/pr7-staging/status");
    assert.equal(check.status(), 200);
    assert.equal((await check.json()).billable_integrations, false);
    await loginFromPriority(page, priorityPath, "studio-a@demo.invalid");

    await page.getByText("Contratto sintetico").first().waitFor();
    await page.getByTestId("priority-pdf-download").waitFor();
    const qr = await page.locator('img[alt="QR per aprire questa scheda protetta"]');
    await qr.waitFor();
    assert(await qr.evaluate(img => img.naturalWidth > 0), "Decoded QR image did not render");
    const view = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    assert(view.document <= view.viewport + 2, JSON.stringify(view));

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.getByTestId("priority-pdf-download").click(),
    ]);
    assert.equal(download.suggestedFilename(), "docuanalytics-priorita.pdf");
    const pdf = await page.request.get(origin + "/api/workspace/priorities/document/pr7-analysis-a/pdf", {
      headers: { Authorization: "Bearer " + await page.evaluate(() => localStorage.getItem("da_token")) }
    });
    assert.equal(pdf.status(), 200);
    assert((await pdf.body()).subarray(0, 5).equals(Buffer.from("%PDF-")));

    await page.goto(origin + "/area");
    await page.getByTestId("workspace-page").waitFor();
    await page.getByTestId("risk-dashboard").waitFor();
    assert(await page.getByTestId("priorities-list").getByTestId("priority-0").count() > 0);
    const priorityReadButton = page.getByTestId("priority-read-0");
    // The test may run after an API smoke with shared synthetic fixtures.
    // Guarantee a known state before testing the UI transition.
    if (await priorityReadButton.getByText("Già letta").count()) {
      await priorityReadButton.click();
      await priorityReadButton.getByText("Non letta").waitFor();
    }
    await priorityReadButton.click();
    await priorityReadButton.getByText("Già letta").waitFor();
    await page.reload();
    await page.getByTestId("priority-read-0").getByText("Già letta").waitFor();

    const token = await page.evaluate(() => localStorage.getItem("da_token"));
    const blocked = await page.request.post(origin + "/api/workspace/copilot/ask", {
      headers: { Authorization: "Bearer " + token },
      data: { question: "Test sintetico", consent_to_ai: true }
    });
    assert.equal(blocked.status(), 503, "Paid Copilot must be unavailable locally");

    const other = await browser.newPage({ viewport: {width: 390, height: 844} });
    await other.route("**/*", route => {
      const url = new URL(route.request().url());
      return url.origin === origin || url.protocol === "data:" || url.protocol === "blob:"
        ? route.continue() : route.abort("blockedbyclient");
    });
    try {
      await loginFromPriority(other, "/area/priorita/document/pr7-analysis-b", "studio-b@demo.invalid");
      const btoken = await other.evaluate(() => localStorage.getItem("da_token"));
      const cross = await other.request.get(origin + "/api/workspace/priorities/document/pr7-analysis-a", {
        headers: { Authorization: "Bearer " + btoken }
      });
      assert.equal(cross.status(), 404, "Cross-account access must be denied");
      await other.goto(origin + priorityPath);
      await other.getByText("Contratto sintetico").first().waitFor({ state:"detached", timeout: 10000 }).catch(() => {});
      await other.getByRole("alert").waitFor({ timeout: 10000 });
    } finally {
      await other.close();
    }
    console.log("PR7 REAL LOCAL E2E PASS: login -> dashboard -> persisted read state -> QR/PDF -> 2 accounts -> 503 AI");
  } finally {
    await page.close();
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
