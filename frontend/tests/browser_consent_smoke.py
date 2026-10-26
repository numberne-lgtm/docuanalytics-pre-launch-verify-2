"""Real Chromium smoke test of the built frontend's Ads consent UI.

Localhost-only app; all external requests are aborted. No live ads, backend,
email, user accounts, or production traffic.
"""
import asyncio
import functools
import http.server
import threading
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 18765


async def main():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / "build"))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()
            external_requests = []

            async def intercept(route):
                if route.request.url.startswith(f"http://127.0.0.1:{PORT}/"):
                    await route.continue_()
                else:
                    external_requests.append(route.request.url)
                    await route.abort()

            await page.route("**/*", intercept)
            await page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded")
            consent = page.get_by_role("group", name="Consenso alla misurazione pubblicitaria")
            await consent.wait_for(timeout=20000)
            assert not any("bzrcdn.openai.com" in url for url in external_requests), external_requests
            await consent.get_by_role("button", name="Rifiuta").click()
            assert await page.evaluate("localStorage.getItem('da_ads_measurement_consent')") == "no"
            assert not any("bzrcdn.openai.com" in url for url in external_requests), external_requests
            await page.get_by_role("button", name="Modifica preferenze").click()
            await page.get_by_role("group", name="Consenso alla misurazione pubblicitaria").get_by_role(
                "button", name="Accetta").click()
            assert await page.evaluate("localStorage.getItem('da_ads_measurement_consent')") == "yes"
            await page.wait_for_function(
                "() => !!document.querySelector('script[src*=\"bzrcdn.openai.com\"]')",
                timeout=10000)
            assert any("bzrcdn.openai.com" in url for url in external_requests), external_requests
            await page.get_by_role("button", name="Modifica preferenze").click()
            await page.get_by_role("group", name="Consenso alla misurazione pubblicitaria").get_by_role(
                "button", name="Rifiuta").click()
            assert await page.evaluate("localStorage.getItem('da_ads_measurement_consent')") == "no"
            await context.close()
            await browser.close()
            print("PASS: Chromium consent reject / opt-in / revoke; external requests blocked")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    asyncio.run(main())
