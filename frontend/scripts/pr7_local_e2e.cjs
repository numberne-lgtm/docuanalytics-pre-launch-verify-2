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
  await page.getByRole("button", { name: "Solo necessari", exact: true }).click();
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

    // Keyboard/pointer accessibility smoke on the Risk Dashboard.
    const priorityList = page.getByTestId("priorities-list");
    const priorityButtons = priorityList.locator("[data-ws-nav-target]");
    const count = await priorityButtons.count();
    assert(count > 0, "At least one synthetic priority should be selectable");
    const priorityTone = await priorityList.locator("[data-ws-nav-row]").first().evaluate(el => ({
      className: el.className,
      border: getComputedStyle(el.querySelector(".ws-priority-open")).borderLeftColor,
      inset: getComputedStyle(el.querySelector(".ws-priority-open")).boxShadow,
    }));
    assert.match(priorityTone.className, /ws-tone-(high|medium|low)/, "Priority must have a semantic risk color");
    assert(priorityTone.inset.includes("inset"), "Priority color stripe must be visible");
    await priorityButtons.first().dispatchEvent("mousedown");
    await priorityButtons.first().focus();
    assert(await priorityList.locator('[data-ws-selected="true"]').count() >= 1);
    if (count > 1) {
      await page.keyboard.press("ArrowDown");
      assert(await priorityButtons.nth(1).evaluate(el => el === document.activeElement));
      await page.keyboard.press("ArrowUp");
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "priority-0");
    }
    await priorityButtons.first().click();
    if (await page.getByTestId("doc-panel").count()) {
      const dialog = page.getByRole("dialog");
      assert.equal(await dialog.getAttribute("aria-modal"), "true");
      await page.keyboard.press("Escape");
      await page.getByTestId("doc-panel").waitFor({ state: "detached" });
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "priority-0");
    }

    const globalSearch = page.getByTestId("workspace-global-search");
    await globalSearch.fill("contratto-fittizio-a");
    await page.getByTestId("workspace-search-results").getByRole("button").first().waitFor();
    assert(await globalSearch.evaluate(el => el === document.activeElement));
    await globalSearch.fill("");

    const token = await page.evaluate(() => localStorage.getItem("da_token"));
    const blocked = await page.request.post(origin + "/api/workspace/copilot/ask", {
      headers: { Authorization: "Bearer " + token },
      data: { question: "Test sintetico", consent_to_ai: true }
    });
    assert.equal(blocked.status(), 503, "Paid Copilot must be unavailable locally");

    await page.goto(origin + "/#upload");
    await page.getByTestId("user-badge").waitFor();
    await page.getByTestId("file-input").setInputFiles({
      name: "contratto-flusso-area.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n")
    });
    const [uploadResponse] = await Promise.all([
      page.waitForResponse(response => response.url() === origin + "/api/pr7-staging/analyze"),
      page.getByTestId("analyze-btn").click(),
    ]);
    assert.equal(uploadResponse.status(), 200);
    const { analysis_id: newDoc } = await uploadResponse.json();
    await page.getByTestId("results-workspace-link").click();
    await page.waitForURL(origin + "/area/documenti/" + newDoc);
    const documents = page.getByTestId("documents-view");
    const highlighted = documents.getByTestId(`doc-${newDoc}`);
    await highlighted.waitFor();
    assert(await highlighted.evaluate(el => el.classList.contains("ws-doc-highlight")));
    // Operational workflow: search, human review state, filters, without altering AI risk.
    const beforeReview = await page.request.get(origin + "/api/workspace/documents/" + newDoc, {
      headers: { Authorization: "Bearer " + token }
    });
    assert.equal(beforeReview.status(), 200);
    const originalRisk = (await beforeReview.json()).risk_level;
    const reviewSelect = documents.getByTestId(`review-state-${newDoc}`);
    const [savedReview] = await Promise.all([
      page.waitForResponse(resp => resp.url() === origin + "/api/workspace/documents/" + newDoc + "/review-state" && resp.request().method() === "PUT"),
      reviewSelect.selectOption("in_progress"),
    ]);
    assert.equal(savedReview.status(), 200);
    const afterReview = await page.request.get(origin + "/api/workspace/documents/" + newDoc, {
      headers: { Authorization: "Bearer " + token }
    });
    assert.equal(afterReview.status(), 200);
    assert.equal((await afterReview.json()).review_status, "in_progress");
    assert.equal((await afterReview.json()).risk_level, originalRisk);
    page.once("dialog", dialog => dialog.accept());
    const [verifiedResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url() === origin + "/api/workspace/documents/" + newDoc + "/review-state" && resp.request().method() === "PUT"),
      documents.getByTestId(`review-state-${newDoc}`).selectOption("verified"),
    ]);
    assert.equal(verifiedResponse.status(), 200);
    const verifiedDoc = await page.request.get(origin + "/api/workspace/documents/" + newDoc, {
      headers: { Authorization: "Bearer " + token }
    });
    assert.equal((await verifiedDoc.json()).review_status, "verified");
    assert.equal((await verifiedDoc.json()).risk_level, originalRisk, "Human verification must preserve AI risk");
    await documents.getByTestId("documents-filter").selectOption("verified");
    await highlighted.waitFor();
    await documents.getByTestId("documents-filter").selectOption("pending");
    assert.equal(await highlighted.count(), 0);
    await documents.getByTestId("documents-filter").selectOption("all");
    await documents.getByTestId("documents-search").fill("contratto-flusso-area.pdf");
    await highlighted.waitFor();
    assert(await documents.getByTestId("documents-search").evaluate(el => el === document.activeElement), "Filtering must not steal search input focus");
    await documents.getByTestId("documents-search").fill("");
    const [resetReview] = await Promise.all([
      page.waitForResponse(resp => resp.url() === origin + "/api/workspace/documents/" + newDoc + "/review-state" && resp.request().method() === "PUT"),
      documents.getByTestId(`review-state-${newDoc}`).selectOption("to_review"),
    ]);
    assert.equal(resetReview.status(), 200);
    await documents.getByTestId("doc-pr7-analysis-a").waitFor();
    assert.equal(await page.getByTestId("doc-panel").count(), 0, "The list stays visible without opening the detail panel");
    const highlightedTitle = highlighted.getByTestId(`doc-open-${newDoc}`);
    await highlightedTitle.focus();
    assert(await highlightedTitle.evaluate(el => el === document.activeElement), "The selected document must be keyboard focusable after filtering");
    await highlightedTitle.press("ArrowDown");
    const originalTitle = documents.getByTestId("doc-open-pr7-analysis-a");
    assert(await originalTitle.evaluate(el => el === document.activeElement));
    await originalTitle.press("ArrowUp");
    assert(await highlightedTitle.evaluate(el => el === document.activeElement));
    await highlightedTitle.press("Enter");
    await page.getByTestId("doc-panel").getByText("contratto-flusso-area.pdf", { exact: true }).waitFor();

    await page.reload();
    await highlighted.waitFor();
    assert(await highlighted.evaluate(el => el.classList.contains("ws-doc-highlight")));
    await page.goto(origin + "/area");
    await page.getByTestId("ws-nav-documents").click();
    await highlightedTitle.click();
    const panel = page.getByTestId("doc-panel");
    await panel.getByText("contratto-flusso-area.pdf", { exact: true }).waitFor();
    await page.keyboard.press("ArrowDown");
    await panel.getByText("contratto-fittizio-a.pdf", { exact: true }).waitFor();
    await panel.getByTestId("doc-panel-close").click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "doc-open-pr7-analysis-a");
    await page.keyboard.press("ArrowUp");
    assert(await highlightedTitle.evaluate(el => el === document.activeElement));
    await documents.getByTestId(`doc-select-${newDoc}`).click();
    await page.keyboard.press("ArrowDown");
    assert(await originalTitle.evaluate(el => el === document.activeElement));
    assert(await documents.getByTestId(`doc-select-${newDoc}`).isChecked());

    const headers = { Authorization: "Bearer " + token };
    const clientResponse = await page.request.post(origin + "/api/workspace/clients", { headers, data: { name: "Zeta test tastiera" } });
    assert.equal(clientResponse.status(), 200);
    const { client_id: secondClient } = await clientResponse.json();
    await page.getByTestId("ws-nav-clients").click();
    const originalClient = page.getByTestId("client-pr7-client-a");
    const addedClient = page.getByTestId(`client-${secondClient}`);
    await originalClient.click();
    await page.getByTestId("client-back").click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "client-pr7-client-a");
    await page.keyboard.press("ArrowDown");
    assert(await addedClient.evaluate(el => el === document.activeElement));
    await page.keyboard.press("Enter");
    await page.getByTestId("client-name").filter({ hasText: "Zeta test tastiera" }).waitFor();
    // Returning to the client list must restore the originating row.
    await page.getByTestId("client-back").click();
    await page.waitForFunction(id => document.activeElement?.getAttribute("data-testid") === id, `client-${secondClient}`);
    await page.keyboard.press("ArrowUp");
    assert(await originalClient.evaluate(el => el === document.activeElement));
    await page.keyboard.press("ArrowDown");
    assert(await addedClient.evaluate(el => el === document.activeElement));
    await page.getByTestId("ws-nav-deadlines").click();
    const deadlines = page.getByTestId("deadlines-view");
    await deadlines.waitFor();
    await deadlines.getByTestId("deadline-tab-later").click();
    const deadlineRow = deadlines.getByTestId("deadline-pr7-deadline-a");
    await deadlineRow.waitFor();
    await deadlineRow.focus();
    assert(await deadlineRow.evaluate(el => document.activeElement === el));
    await page.keyboard.press("ArrowDown");
    assert(await deadlineRow.evaluate(el => document.activeElement === el), "End of list must remain keyboard-safe");
    await page.getByTestId("ws-nav-clients").click();

    assert.equal((await page.request.delete(origin + "/api/workspace/clients/" + secondClient, { headers })).status(), 200);

    const cleanup = await page.request.delete(origin + "/api/workspace/documents/" + newDoc, {
      headers: { Authorization: "Bearer " + token }
    });
    assert.equal(cleanup.status(), 200);

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
      const crossReview = await other.request.put(origin + "/api/workspace/documents/pr7-analysis-a/review-state", {
        headers: { Authorization: "Bearer " + btoken },
        data: { status: "verified" }
      });
      assert.equal(crossReview.status(), 404, "Cross-account human review writes must be denied");
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
