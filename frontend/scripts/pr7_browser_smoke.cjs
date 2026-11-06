/* Browser smoke test for the protected priority page using only mocked API traffic.
   Runs against a locally served React production build; no production requests. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const root = path.join(__dirname, "..", "build");
const port = 4177;
const mime = {".js":"application/javascript",".css":"text/css",".html":"text/html",
              ".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon"};
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const relative = pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative || "index.html");
  const safe = file === root || file.startsWith(root + path.sep);
  const target = safe && fs.existsSync(file) && fs.statSync(file).isFile()
    ? file : path.join(root, "index.html");
  res.writeHead(200, {"content-type": mime[path.extname(target)] || "application/octet-stream"});
  fs.createReadStream(target).pipe(res);
});

(async () => {
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport: {width:390,height:844}, acceptDownloads:true});
  const url = `http://127.0.0.1:${port}/area/priorita/document/doc-alice`;
  try {
    await page.goto(url);
    await page.getByTestId("priority-login-required").waitFor();
    assert.match(await page.locator("body").innerText(), /Accesso richiesto/);

    await page.addInitScript(() => localStorage.setItem("da_token", "test-token"));
    await page.route("**/api/workspace/priorities/document/doc-alice", async route =>
      route.fulfill({status:200, contentType:"application/json",
        body:JSON.stringify({item_id:"doc-alice", type:"document",title:"Contratto di prova",
          filename:"alice.pdf",level:"medium",summary:"Sintesi di prova",
          details:["Controllo sintetico"],date:"",status:""})}));
    await page.route("**/api/workspace/priorities/document/doc-alice/qr", async route =>
      route.fulfill({status:200,contentType:"image/png",body:Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9f0A4AAAAASUVORK5CYII=", "base64")}));
    await page.route("**/api/workspace/priorities/document/doc-alice/pdf", async route =>
      route.fulfill({status:200, contentType:"application/pdf",
        headers:{"Content-Disposition":'attachment; filename="docuanalytics-priorita.pdf"'},
        body:Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n")}));
    await page.reload();
    await page.getByText("Contratto di prova").waitFor();
    await page.getByTestId("priority-pdf-download").waitFor();
    const width = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert.ok(width.content <= width.viewport + 2, JSON.stringify(width));
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("priority-pdf-download").click(),
    ]);
    assert.equal(download.suggestedFilename(), "docuanalytics-priorita.pdf");
    console.log("PR7 mobile browser smoke PASS: login gate, protected detail, viewport, PDF download");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
