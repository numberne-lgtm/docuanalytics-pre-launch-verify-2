# TEMPORARY sandbox-only webhook signature probe. No DB access. Remove after test.
import json
import time
from pathlib import Path

import httpx
from dotenv import dotenv_values
from fastapi import APIRouter, Request

SANDBOX = "https://api-m.sandbox.paypal.com"
ENV_PATH = Path(__file__).parent / ".env"
OUT_DIR = Path("/app/export/paypal_probe")
HDRS = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"]

router = APIRouter(prefix="/api/paypal-sandbox")


@router.post("/webhook-probe")
async def webhook_probe(request: Request):
    raw = (await request.body()).decode("utf-8")
    env = dotenv_values(ENV_PATH)
    cid, sec, wid = env.get("PAYPAL_SANDBOX_CLIENT_ID"), env.get("PAYPAL_SANDBOX_SECRET"), env.get("PAYPAL_SANDBOX_WEBHOOK_ID")
    h = {k: request.headers.get(k, "") for k in HDRS}
    status = "NOT_CONFIGURED"
    if cid and sec and wid and all(h.values()):
        async with httpx.AsyncClient(timeout=30) as c:
            tok = (await c.post(f"{SANDBOX}/v1/oauth2/token", auth=(cid.strip(), sec.strip()),
                                data={"grant_type": "client_credentials"})).json().get("access_token")
            meta = {"auth_algo": h["paypal-auth-algo"], "cert_url": h["paypal-cert-url"],
                    "transmission_id": h["paypal-transmission-id"], "transmission_sig": h["paypal-transmission-sig"],
                    "transmission_time": h["paypal-transmission-time"], "webhook_id": wid.strip()}
            body = json.dumps(meta)[:-1] + ', "webhook_event": ' + raw + "}"
            r = await c.post(f"{SANDBOX}/v1/notifications/verify-webhook-signature", content=body,
                             headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
            status = r.json().get("verification_status", f"HTTP_{r.status_code}") if r.status_code == 200 else f"HTTP_{r.status_code}"
    OUT_DIR.mkdir(mode=0o700, exist_ok=True)
    try:
        etype = json.loads(raw).get("event_type")
    except Exception:
        etype = None
    f = OUT_DIR / f"{int(time.time() * 1000)}.json"
    f.write_text(json.dumps({"verification_status": status, "event_type": etype, "headers": h, "raw_body": raw}))
    f.chmod(0o600)
    return {"received": True, "verification_status": status}
