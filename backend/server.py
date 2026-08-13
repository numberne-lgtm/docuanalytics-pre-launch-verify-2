import os
import re
import json
import base64
import asyncio
import tempfile
import logging
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import FastAPI, APIRouter, HTTPException, Request, Header
from dotenv import load_dotenv, dotenv_values
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
# The .env file is the source of truth for this app's own secrets. The platform
# injects a shared default STRIPE_API_KEY (sk_test_emergent) at the OS level which
# load_dotenv does NOT override, so read Stripe key from the file explicitly to
# ensure the user's own account key is used.
_ENV_FILE = dotenv_values(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("docuanalytics")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
STRIPE_API_KEY = _ENV_FILE.get('STRIPE_API_KEY') or os.environ.get('STRIPE_API_KEY')
BTC_ADDRESS = os.environ.get('BTC_ADDRESS', '')
USDT_TRC20_ADDRESS = os.environ.get('USDT_TRC20_ADDRESS', '')

# PayPal (REST v2). Credentials live only in backend .env.
PAYPAL_MODE = (_ENV_FILE.get('PAYPAL_MODE') or os.environ.get('PAYPAL_MODE') or 'live').strip().lower()
PAYPAL_CLIENT_ID = _ENV_FILE.get('PAYPAL_CLIENT_ID') or os.environ.get('PAYPAL_CLIENT_ID')
PAYPAL_SECRET = _ENV_FILE.get('PAYPAL_SECRET') or os.environ.get('PAYPAL_SECRET')
PAYPAL_WEBHOOK_ID = _ENV_FILE.get('PAYPAL_WEBHOOK_ID') or os.environ.get('PAYPAL_WEBHOOK_ID')
PAYPAL_BASE = "https://api-m.paypal.com" if PAYPAL_MODE == "live" else "https://api-m.sandbox.paypal.com"

# Admin token for manual credit grants (test/support). Set ADMIN_TOKEN in .env.
ADMIN_TOKEN = _ENV_FILE.get('ADMIN_TOKEN') or os.environ.get('ADMIN_TOKEN')

FREE_CREDITS = 3

# Server-side catalog (amounts in EUR, float). Never trust the client.
PACKAGES = {
    "starter":       {"name": "Pack Starter",       "credits": 50,    "amount": 19.0,  "type": "pack"},
    "pro":           {"name": "Pack Professional",   "credits": 200,   "amount": 49.0,  "type": "pack"},
    "enterprise":    {"name": "Pack Enterprise",     "credits": 1000,  "amount": 149.0, "type": "pack"},
    "sub_single":    {"name": "Studio Single",       "credits": 100,   "amount": 29.0,  "type": "sub"},
    "sub_pro":       {"name": "Studio Pro",          "credits": 500,   "amount": 99.0,  "type": "sub"},
    "sub_unlimited": {"name": "Enterprise Unlimited", "credits": 99999, "amount": 299.0, "type": "sub"},
}

DOC_LABELS = {
    "fattura": "Fattura / Fattura Elettronica",
    "contratto": "Contratto Legale",
    "visura": "Visura Camerale",
    "f24": "Modello F24",
    "busta_paga": "Busta Paga / Cedolino",
    "auto": "Documento generico",
}

app = FastAPI()
api = APIRouter(prefix="/api")


# ---------------- Models ----------------
class SessionReq(BaseModel):
    user_id: Optional[str] = None


class AnalyzeReq(BaseModel):
    user_id: str
    doc_type: str = "auto"
    filename: str
    mime_type: str
    file_base64: str


class ChatReq(BaseModel):
    user_id: str
    analysis_id: str
    question: str


class CheckoutReq(BaseModel):
    package_id: str
    origin_url: str
    user_id: str


class CryptoOrderReq(BaseModel):
    user_id: str
    package_id: str
    coin: str


# ---------------- Helpers ----------------
async def get_or_create_user(user_id: Optional[str]):
    if user_id:
        u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if u:
            return u
    new_id = user_id or str(uuid.uuid4())
    u = {"user_id": new_id, "credits": FREE_CREDITS, "email": None,
         "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(dict(u))
    return {k: v for k, v in u.items() if k != "_id"}


async def add_credits(user_id: str, amount: int):
    await db.users.update_one({"user_id": user_id}, {"$inc": {"credits": amount}}, upsert=False)


def _extract_json(text: str):
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    raw = m.group(1) if m else None
    if not raw:
        m2 = re.search(r"(\{.*\})", text, re.DOTALL)
        raw = m2.group(1) if m2 else None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


# ---------------- Routes ----------------
@api.get("/")
async def root():
    return {"message": "DocuAnalytics AI API", "status": "ok"}


@api.post("/session")
async def session(req: SessionReq):
    u = await get_or_create_user(req.user_id)
    return {"user_id": u["user_id"], "credits": u["credits"], "email": u.get("email")}


@api.get("/session/{user_id}")
async def get_session(user_id: str):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "User not found")
    return {"user_id": u["user_id"], "credits": u["credits"], "email": u.get("email")}


@api.post("/analyze")
async def analyze(req: AnalyzeReq):
    u = await db.users.find_one({"user_id": req.user_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "User not found")
    if u["credits"] <= 0:
        raise HTTPException(402, "Crediti insufficienti. Ricarica per continuare.")

    mime = (req.mime_type or "").lower()
    allowed = ("image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf")
    if mime and not mime.startswith("image/") and mime not in allowed:
        raise HTTPException(400, "Formato non supportato. Usa PDF, JPG, PNG.")
    raw_b64 = req.file_base64.split(",")[-1]
    if len(raw_b64) > 14_000_000:  # ~10MB
        raise HTTPException(413, "File troppo grande (max 10MB).")

    label = DOC_LABELS.get(req.doc_type, DOC_LABELS["auto"])
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
    except Exception as e:
        raise HTTPException(500, f"AI library error: {e}")

    # write temp file for Gemini file input (supports images + pdf)
    suffix = os.path.splitext(req.filename)[1] or ".bin"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    resp = ""
    try:
        tmp.write(base64.b64decode(raw_b64))
        tmp.flush()
        tmp.close()

        prompt = f"""Sei un assistente AI esperto in analisi documentale per studi legali e commercialisti italiani.
Analizza questo documento (tipo indicato: {label}).
Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, con questa struttura:
{{
  "doc_type": "tipo di documento rilevato (es. Fattura, Contratto, Visura, F24, Busta Paga)",
  "summary": "riassunto in 1-2 frasi in italiano",
  "fields": [{{"label": "nome campo", "value": "valore estratto"}}],
  "audit": [{{"level": "ok|warning|error", "message": "esito controllo/red-flag in italiano"}}],
  "full_text": "testo completo estratto dal documento"
}}
Estrai tutti i dati chiave (importi, date, partite IVA, IBAN, parti coinvolte, codici tributo, saldi, totali).
Nella sezione audit, esegui controlli di quadratura (es. saldo F24, netto busta paga), segnala clausole vessatorie, IBAN esteri, visto di conformità IVA sopra 5.000 euro, o eventuali anomalie."""

        file_content = FileContentWithMimeType(file_path=tmp.name, mime_type=req.mime_type)
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"analyze-{uuid.uuid4()}",
                       system_message="Estrai dati strutturati dai documenti e rispondi solo in JSON valido.").with_model("gemini", "gemini-2.5-flash")
        resp = await chat.send_message(UserMessage(text=prompt, file_contents=[file_content]))
    except Exception as e:
        logger.exception("analyze failed")
        raise HTTPException(500, f"Analisi non riuscita: {e}")
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass

    text = resp if isinstance(resp, str) else str(resp)
    data = _extract_json(text) or {
        "doc_type": label, "summary": text[:300],
        "fields": [], "audit": [{"level": "warning", "message": "Estrazione parziale"}],
        "full_text": text,
    }

    await db.users.update_one({"user_id": req.user_id}, {"$inc": {"credits": -1}})
    u2 = await db.users.find_one({"user_id": req.user_id}, {"_id": 0})

    analysis_id = str(uuid.uuid4())
    await db.analyses.insert_one({
        "analysis_id": analysis_id, "user_id": req.user_id, "doc_type": req.doc_type,
        "filename": req.filename, "result": data,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"analysis_id": analysis_id, "result": data, "credits": u2["credits"]}


@api.post("/chat")
async def chat_copilot(req: ChatReq):
    a = await db.analyses.find_one({"analysis_id": req.analysis_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Analisi non trovata")
    if a.get("user_id") != req.user_id:
        raise HTTPException(403, "Accesso negato")
    context = a["result"].get("full_text") or json.dumps(a["result"], ensure_ascii=False)
    resp = ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"chat-{req.analysis_id}",
                       system_message=f"Sei un copilot AI. Rispondi in italiano basandoti SOLO su questo documento:\n\n{context[:12000]}").with_model("gemini", "gemini-2.5-flash")
        resp = await chat.send_message(UserMessage(text=req.question))
    except Exception as e:
        raise HTTPException(500, f"Copilot error: {e}")
    return {"answer": resp if isinstance(resp, str) else str(resp)}


# ---------------- Payments (raw Stripe SDK; account uses Managed Payments) ----------------
import stripe
stripe.api_key = STRIPE_API_KEY
STRIPE_MANAGED_PAYMENTS_VERSION = "2026-02-25.preview"


def _create_stripe_session(pkg, req):
    is_sub = pkg["type"] == "sub"
    price_data = {
        "currency": "eur",
        "unit_amount": int(round(pkg["amount"] * 100)),
        "product_data": {
            "name": f"DocuAnalytics AI — {pkg['name']}",
            "tax_code": "txcd_10103001" if is_sub else "txcd_10000000",
        },
    }
    if is_sub:
        price_data["recurring"] = {"interval": "month"}

    sub_meta = {"user_id": req.user_id, "package_id": req.package_id, "credits": str(pkg["credits"])}
    kwargs = dict(
        mode="subscription" if is_sub else "payment",
        line_items=[{"price_data": price_data, "quantity": 1}],
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/payment/cancel",
        metadata=sub_meta,
    )
    if is_sub:
        # metadata on the subscription so renewal invoices can be attributed & credited
        kwargs["subscription_data"] = {"metadata": sub_meta}

    # Managed Payments: enable explicitly with the required preview API version.
    # Fall back to account defaults if the preview version/param is unavailable.
    try:
        return stripe.checkout.Session.create(
            **kwargs,
            managed_payments={"enabled": True},
            stripe_version=STRIPE_MANAGED_PAYMENTS_VERSION,
        )
    except stripe.error.StripeError as e:
        logger.warning(f"managed_payments explicit call failed ({e}); using account defaults")
        return stripe.checkout.Session.create(**kwargs)


@api.post("/payments/checkout")
async def checkout(req: CheckoutReq, request: Request):
    pkg = PACKAGES.get(req.package_id)
    if not pkg:
        raise HTTPException(400, "Pacchetto non valido")
    if not (req.origin_url.startswith("https://") or req.origin_url.startswith("http://localhost")):
        raise HTTPException(400, "origin_url non valido")
    session = None
    try:
        session = _create_stripe_session(pkg, req)
    except Exception as e:
        logger.exception("stripe checkout failed")
        raise HTTPException(500, f"Errore checkout: {e}")

    pkg = PACKAGES.get(req.package_id)
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": req.user_id, "package_id": req.package_id,
        "credits": pkg["credits"], "amount": pkg["amount"], "currency": "eur",
        "is_subscription": pkg["type"] == "sub",
        "status": "initiated", "payment_status": "pending", "credited": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


async def _record_subscription(record, sub_id, customer_id):
    """Persist an active subscription for management & renewal crediting."""
    if not sub_id:
        return
    pkg = PACKAGES.get(record["package_id"], {})
    await db.subscriptions.update_one(
        {"subscription_id": sub_id},
        {"$set": {
            "subscription_id": sub_id, "customer_id": customer_id,
            "user_id": record["user_id"], "package_id": record["package_id"],
            "package_name": pkg.get("name"), "credits": record["credits"],
            "amount": record["amount"], "status": "active",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def _credit_if_paid(record):
    """Idempotently grant credits when a transaction is paid."""
    if record.get("payment_status") == "paid" and not record.get("credited"):
        res = await db.payment_transactions.update_one(
            {"session_id": record["session_id"], "credited": {"$ne": True}},
            {"$set": {"credited": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        if res.modified_count == 1:
            await add_credits(record["user_id"], int(record["credits"]))


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Transazione non trovata")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "stripe_subscription_id": s.get("subscription"),
                              "stripe_customer_id": s.get("customer"),
                              "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
                if record.get("is_subscription"):
                    await _record_subscription(record, s.get("subscription"), s.get("customer"))
        except Exception as e:
            logger.warning(f"status check error: {e}")
    await _credit_if_paid(record)
    u = await db.users.find_one({"user_id": record["user_id"]}, {"_id": 0})
    return {"session_id": session_id, "status": record["status"],
            "payment_status": record["payment_status"],
            "is_subscription": record.get("is_subscription", False),
            "credits_added": record["credits"] if record.get("payment_status") == "paid" else 0,
            "user_credits": u["credits"] if u else None}


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = _ENV_FILE.get("STRIPE_WEBHOOK_SECRET") or os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        if secret:
            event = stripe.Webhook.construct_event(payload, sig, secret)
        else:
            event = json.loads(payload.decode())
    except Exception as e:
        logger.warning(f"webhook parse error: {e}")
        raise HTTPException(400, "Invalid webhook")
    obj = event.get("data", {}).get("object", {})
    etype = event.get("type")

    if etype in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        sid = obj.get("id")
        # Authoritative re-check against Stripe before crediting (protects against spoofed/unsigned events).
        try:
            s = stripe.checkout.Session.retrieve(sid)
            if not (s.payment_status == "paid" or s.status == "complete"):
                return {"status": "ignored"}
        except Exception:
            return {"status": "ignored"}
        await db.payment_transactions.update_one(
            {"session_id": sid, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": "paid",
                      "stripe_subscription_id": s.get("subscription"),
                      "stripe_customer_id": s.get("customer"),
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        record = await db.payment_transactions.find_one({"session_id": sid}, {"_id": 0})
        if record:
            await _credit_if_paid(record)
            if record.get("is_subscription"):
                await _record_subscription(record, s.get("subscription"), s.get("customer"))

    elif etype == "invoice.payment_succeeded":
        # Recurring renewal -> top up monthly credits (skip the first invoice which is handled above).
        if obj.get("billing_reason") == "subscription_cycle":
            sub_id = obj.get("subscription")
            try:
                sub = stripe.Subscription.retrieve(sub_id)
                meta = sub.get("metadata", {}) or {}
                uid, credits = meta.get("user_id"), int(meta.get("credits", 0) or 0)
                if uid and credits:
                    await add_credits(uid, credits)
                    await db.subscriptions.update_one(
                        {"subscription_id": sub_id},
                        {"$set": {"status": "active", "last_renewal": datetime.now(timezone.utc).isoformat()}},
                    )
            except Exception as e:
                logger.warning(f"renewal credit error: {e}")

    elif etype in ("customer.subscription.deleted", "customer.subscription.canceled"):
        await db.subscriptions.update_one(
            {"subscription_id": obj.get("id")},
            {"$set": {"status": "canceled", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    return {"status": "ok"}


class SubCancelReq(BaseModel):
    user_id: str
    subscription_id: str


@api.get("/subscriptions/{user_id}")
async def list_subscriptions(user_id: str):
    subs = await db.subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(50)

    def _enrich(sdoc):
        item = {"subscription_id": sdoc["subscription_id"], "package_name": sdoc.get("package_name"),
                "credits": sdoc.get("credits"), "amount": sdoc.get("amount"), "status": sdoc.get("status"),
                "provider": sdoc.get("provider", "stripe"),
                "cancel_at_period_end": sdoc.get("cancel_at_period_end", False)}
        if sdoc.get("provider") == "paypal":
            return item
        try:
            live = stripe.Subscription.retrieve(sdoc["subscription_id"])
            item["status"] = live.get("status", sdoc.get("status"))
            item["cancel_at_period_end"] = live.get("cancel_at_period_end", False)
            item["current_period_end"] = live.get("current_period_end")
        except Exception:
            pass
        return item

    # Run blocking Stripe calls off the event loop, in parallel.
    out = await asyncio.gather(*[asyncio.to_thread(_enrich, s) for s in subs]) if subs else []
    return {"subscriptions": list(out)}


@api.post("/subscriptions/cancel")
async def cancel_subscription(req: SubCancelReq):
    sdoc = await db.subscriptions.find_one({"subscription_id": req.subscription_id}, {"_id": 0})
    if not sdoc:
        raise HTTPException(404, "Abbonamento non trovato")
    if sdoc.get("user_id") != req.user_id:
        raise HTTPException(403, "Accesso negato")
    if sdoc.get("provider") == "paypal":
        try:
            token = await _paypal_token()
            async with httpx.AsyncClient(timeout=30) as c:
                await c.post(f"{PAYPAL_BASE}/v1/billing/subscriptions/{req.subscription_id}/cancel",
                             json={"reason": "User requested cancellation"}, headers=_pp_headers(token))
        except Exception as e:
            logger.warning(f"paypal cancel error: {e}")
        await db.subscriptions.update_one(
            {"subscription_id": req.subscription_id},
            {"$set": {"status": "canceled", "cancel_at_period_end": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
        return {"status": "canceled", "message": "Abbonamento PayPal annullato."}
    try:
        stripe.Subscription.modify(req.subscription_id, cancel_at_period_end=True)
    except Exception as e:
        raise HTTPException(500, f"Errore annullamento: {e}")
    await db.subscriptions.update_one(
        {"subscription_id": req.subscription_id},
        {"$set": {"status": "canceling", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"status": "canceling", "message": "L'abbonamento resterà attivo fino a fine periodo, poi non si rinnoverà."}


# ---------------- Crypto (manual settlement) ----------------
@api.get("/crypto/info")
async def crypto_info():
    def qr(data):
        return f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={data}"
    return {
        "packages": [{"id": k, **v} for k, v in PACKAGES.items()],
        "wallets": {
            "BTC": {"label": "Bitcoin (BTC)", "address": BTC_ADDRESS, "qr": qr(BTC_ADDRESS), "network": "Bitcoin"},
            "USDT": {"label": "USDT (TRC20)", "address": USDT_TRC20_ADDRESS, "qr": qr(USDT_TRC20_ADDRESS), "network": "Tron TRC20"},
        },
    }


@api.post("/crypto/order")
async def crypto_order(req: CryptoOrderReq):
    pkg = PACKAGES.get(req.package_id)
    if not pkg:
        raise HTTPException(400, "Pacchetto non valido")
    order_id = str(uuid.uuid4())[:8].upper()
    await db.crypto_orders.insert_one({
        "order_id": order_id, "user_id": req.user_id, "package_id": req.package_id,
        "coin": req.coin, "amount_eur": pkg["amount"], "credits": pkg["credits"],
        "status": "awaiting_payment", "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"order_id": order_id, "status": "awaiting_payment",
            "message": "Ordine registrato. Invia l'importo all'indirizzo indicato e conserva la ricevuta: i crediti verranno accreditati dopo la conferma della transazione on-chain."}


class PaypalOrderReq(BaseModel):
    user_id: str
    package_id: str


class PaypalCaptureReq(BaseModel):
    order_id: str


async def _paypal_token():
    if not (PAYPAL_CLIENT_ID and PAYPAL_SECRET):
        raise HTTPException(500, "PayPal non configurato")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{PAYPAL_BASE}/v1/oauth2/token",
                         auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
                         data={"grant_type": "client_credentials"},
                         headers={"Accept": "application/json"})
    if r.status_code != 200:
        logger.error(f"paypal token error {r.status_code}: {r.text}")
        raise HTTPException(400, "PayPal auth fallita (verifica credenziali/modalità Sandbox-Live)")
    return r.json()["access_token"]


@api.get("/paypal/config")
async def paypal_config():
    return {"enabled": bool(PAYPAL_CLIENT_ID and PAYPAL_SECRET),
            "client_id": PAYPAL_CLIENT_ID or "", "mode": PAYPAL_MODE, "currency": "EUR"}


@api.post("/paypal/order")
async def paypal_order(req: PaypalOrderReq):
    pkg = PACKAGES.get(req.package_id)
    if not pkg:
        raise HTTPException(400, "Pacchetto non valido")
    if pkg["type"] != "pack":
        raise HTTPException(400, "PayPal è disponibile solo per i pacchetti a pagamento singolo")
    token = await _paypal_token()
    body = {"intent": "CAPTURE", "purchase_units": [{
        "reference_id": req.package_id, "description": pkg["name"],
        "amount": {"currency_code": "EUR", "value": f'{pkg["amount"]:.2f}'}}]}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{PAYPAL_BASE}/v2/checkout/orders", json=body,
                         headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    if r.status_code not in (200, 201):
        logger.error(f"paypal order error {r.status_code}: {r.text}")
        raise HTTPException(400, "Errore nella creazione dell'ordine PayPal")
    order_id = r.json()["id"]
    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one({
        "session_id": order_id, "provider": "paypal", "user_id": req.user_id,
        "package_id": req.package_id, "credits": pkg["credits"], "amount": pkg["amount"],
        "currency": "eur", "is_subscription": False, "status": "initiated",
        "payment_status": "pending", "credited": False, "created_at": now, "updated_at": now})
    return {"order_id": order_id}


@api.post("/paypal/capture")
async def paypal_capture(req: PaypalCaptureReq):
    record = await db.payment_transactions.find_one({"session_id": req.order_id, "provider": "paypal"}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Ordine non trovato")
    if record.get("payment_status") == "paid":
        u = await db.users.find_one({"user_id": record["user_id"]}, {"_id": 0})
        return {"status": "paid", "credits_added": 0, "user_credits": u["credits"] if u else None}
    token = await _paypal_token()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{PAYPAL_BASE}/v2/checkout/orders/{req.order_id}/capture",
                         headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        data = r.json()
    except Exception:
        data = {}
    status = data.get("status")
    if r.status_code in (200, 201) and status == "COMPLETED":
        await db.payment_transactions.update_one(
            {"session_id": req.order_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": "paid",
                      "paypal_capture": data.get("id"),
                      "updated_at": datetime.now(timezone.utc).isoformat()}})
        record = await db.payment_transactions.find_one({"session_id": req.order_id}, {"_id": 0})
        await _credit_if_paid(record)
        u = await db.users.find_one({"user_id": record["user_id"]}, {"_id": 0})
        return {"status": "paid", "credits_added": record["credits"], "user_credits": u["credits"] if u else None}
    logger.error(f"paypal capture not completed {r.status_code}: {r.text}")
    return {"status": status or "pending", "credits_added": 0}


class PaypalSubReq(BaseModel):
    package_id: str


class PaypalSubActivateReq(BaseModel):
    user_id: str
    package_id: str
    subscription_id: str


def _pp_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _paypal_ensure_product(token):
    doc = await db.paypal_plans.find_one({"_id": f"product_{PAYPAL_MODE}"})
    if doc:
        return doc["product_id"]
    body = {"name": "DocuAnalytics AI", "type": "SERVICE", "category": "SOFTWARE"}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{PAYPAL_BASE}/v1/catalogs/products", json=body, headers=_pp_headers(token))
    if r.status_code not in (200, 201):
        logger.error(f"paypal product error {r.status_code}: {r.text}")
        raise HTTPException(400, "Errore creazione prodotto PayPal")
    pid = r.json()["id"]
    await db.paypal_plans.insert_one({"_id": f"product_{PAYPAL_MODE}", "product_id": pid})
    return pid


async def _paypal_ensure_plan(package_id):
    pkg = PACKAGES.get(package_id)
    if not pkg or pkg["type"] != "sub":
        raise HTTPException(400, "Pacchetto abbonamento non valido")
    key = f"plan_{PAYPAL_MODE}_{package_id}"
    doc = await db.paypal_plans.find_one({"_id": key})
    if doc:
        return doc["plan_id"]
    token = await _paypal_token()
    product_id = await _paypal_ensure_product(token)
    body = {
        "product_id": product_id, "name": f'{pkg["name"]} (mensile)',
        "billing_cycles": [{
            "frequency": {"interval_unit": "MONTH", "interval_count": 1},
            "tenure_type": "REGULAR", "sequence": 1, "total_cycles": 0,
            "pricing_scheme": {"fixed_price": {"value": f'{pkg["amount"]:.2f}', "currency_code": "EUR"}},
        }],
        "payment_preferences": {"auto_bill_outstanding": True, "setup_fee_failure_action": "CONTINUE", "payment_failure_threshold": 1},
    }
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{PAYPAL_BASE}/v1/billing/plans", json=body, headers=_pp_headers(token))
    if r.status_code not in (200, 201):
        logger.error(f"paypal plan error {r.status_code}: {r.text}")
        raise HTTPException(400, "Errore creazione piano PayPal")
    plan_id = r.json()["id"]
    await db.paypal_plans.insert_one({"_id": key, "plan_id": plan_id, "package_id": package_id})
    return plan_id


@api.post("/paypal/subscription/plan")
async def paypal_sub_plan(req: PaypalSubReq):
    if not (PAYPAL_CLIENT_ID and PAYPAL_SECRET):
        raise HTTPException(500, "PayPal non configurato")
    plan_id = await _paypal_ensure_plan(req.package_id)
    return {"plan_id": plan_id, "package_id": req.package_id}


@api.post("/paypal/subscription/activate")
async def paypal_sub_activate(req: PaypalSubActivateReq):
    pkg = PACKAGES.get(req.package_id)
    if not pkg or pkg["type"] != "sub":
        raise HTTPException(400, "Pacchetto abbonamento non valido")
    token = await _paypal_token()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{PAYPAL_BASE}/v1/billing/subscriptions/{req.subscription_id}", headers=_pp_headers(token))
    if r.status_code != 200:
        logger.error(f"paypal sub fetch error {r.status_code}: {r.text}")
        raise HTTPException(400, "Impossibile verificare l'abbonamento PayPal")
    status = r.json().get("status")
    if status not in ("ACTIVE", "APPROVED"):
        return {"status": status or "pending", "credits_added": 0}
    now = datetime.now(timezone.utc).isoformat()
    await db.subscriptions.update_one(
        {"subscription_id": req.subscription_id},
        {"$set": {"subscription_id": req.subscription_id, "provider": "paypal", "user_id": req.user_id,
                  "package_id": req.package_id, "package_name": pkg["name"], "credits": pkg["credits"],
                  "amount": pkg["amount"], "status": "active", "cancel_at_period_end": False, "updated_at": now},
         "$setOnInsert": {"created_at": now}}, upsert=True)
    granted = 0
    if not await db.payment_transactions.find_one({"session_id": f"pp_sub_{req.subscription_id}"}):
        await db.payment_transactions.insert_one({
            "session_id": f"pp_sub_{req.subscription_id}", "provider": "paypal", "subscription_id_ref": req.subscription_id,
            "user_id": req.user_id, "package_id": req.package_id, "credits": pkg["credits"], "amount": pkg["amount"],
            "is_subscription": True, "kind": "activation", "status": "completed", "payment_status": "paid",
            "credited": True, "created_at": now, "updated_at": now})
        await add_credits(req.user_id, int(pkg["credits"]))
        granted = pkg["credits"]
    u = await db.users.find_one({"user_id": req.user_id}, {"_id": 0})
    return {"status": "active", "credits_added": granted, "user_credits": u["credits"] if u else None}


@api.post("/webhook/paypal")
async def paypal_webhook(request: Request):
    payload = await request.json()
    event = payload.get("event_type", "")
    resource = payload.get("resource", {}) or {}
    if event == "PAYMENT.SALE.COMPLETED":
        sub_id = resource.get("billing_agreement_id")
        sale_id = resource.get("id")
        if sub_id and sale_id:
            sdoc = await db.subscriptions.find_one({"subscription_id": sub_id, "provider": "paypal"}, {"_id": 0})
            if sdoc and not await db.payment_transactions.find_one({"session_id": f"pp_sale_{sale_id}"}):
                prior = await db.payment_transactions.count_documents({"subscription_id_ref": sub_id, "kind": "sale"})
                now = datetime.now(timezone.utc).isoformat()
                credit = prior >= 1  # first sale already covered by activation
                await db.payment_transactions.insert_one({
                    "session_id": f"pp_sale_{sale_id}", "provider": "paypal", "subscription_id_ref": sub_id,
                    "user_id": sdoc["user_id"], "package_id": sdoc.get("package_id"), "credits": sdoc.get("credits"),
                    "is_subscription": True, "kind": "sale", "status": "completed", "payment_status": "paid",
                    "credited": credit, "created_at": now, "updated_at": now})
                if credit:
                    await add_credits(sdoc["user_id"], int(sdoc.get("credits", 0) or 0))
    elif event in ("BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.SUSPENDED"):
        sub_id = resource.get("id")
        if sub_id:
            await db.subscriptions.update_one({"subscription_id": sub_id, "provider": "paypal"},
                                              {"$set": {"status": "canceled", "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "ok"}


class AdminGrantReq(BaseModel):
    email: str
    credits: int


@api.post("/admin/grant-credits")
async def admin_grant_credits(req: AdminGrantReq, x_admin_token: str = Header(None)):
    if not ADMIN_TOKEN:
        raise HTTPException(503, "Admin non configurato")
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(401, "Token admin non valido")
    if req.credits <= 0 or req.credits > 100000:
        raise HTTPException(400, "Numero di crediti non valido")
    email = req.email.strip().lower()
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u:
        raise HTTPException(404, "Utente non trovato")
    await add_credits(u["user_id"], int(req.credits))
    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one({
        "session_id": f"admin_{uuid.uuid4().hex}", "provider": "admin", "user_id": u["user_id"],
        "credits": req.credits, "amount": 0, "is_subscription": False, "kind": "admin_grant",
        "status": "completed", "payment_status": "paid", "credited": True, "created_at": now, "updated_at": now})
    nu = await db.users.find_one({"user_id": u["user_id"]}, {"_id": 0})
    return {"email": email, "credits_added": req.credits, "new_balance": nu["credits"]}


@api.get("/packages")
async def packages():
    return {"packages": [{"id": k, **v} for k, v in PACKAGES.items()]}


# ---------------- Auth (JWT email/password) + Referral ----------------
import bcrypt
import jwt as pyjwt

JWT_SECRET = _ENV_FILE.get("JWT_SECRET") or os.environ.get("JWT_SECRET", "change-me")
JWT_ALG = "HS256"
REFERRAL_BONUS = 5


def _hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def _verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def _make_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def _gen_ref_code() -> str:
    return uuid.uuid4().hex[:8].upper()


def _public_user(u: dict) -> dict:
    return {"user_id": u["user_id"], "email": u.get("email"), "name": u.get("name"),
            "credits": u.get("credits", 0), "referral_code": u.get("referral_code")}


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "Non autenticato")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessione scaduta")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Token non valido")
    u = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
    if not u:
        raise HTTPException(401, "Utente non trovato")
    return u


class RegisterReq(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    user_id: Optional[str] = None   # anonymous uuid to upgrade (preserves credits)
    ref: Optional[str] = None       # referral code of the inviter


class LoginReq(BaseModel):
    email: str
    password: str


@api.post("/auth/register")
async def register(req: RegisterReq):
    email = req.email.strip().lower()
    if "@" not in email or len(req.password) < 6:
        raise HTTPException(400, "Email non valida o password troppo corta (min 6 caratteri).")
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email già registrata. Accedi.")

    ref_code = _gen_ref_code()
    now = datetime.now(timezone.utc).isoformat()

    # Upgrade the existing anonymous user (keeps its credits) if provided & not yet an account.
    existing = None
    if req.user_id:
        existing = await db.users.find_one({"user_id": req.user_id}, {"_id": 0})
        if existing and existing.get("email"):
            existing = None  # already an account -> create a fresh one instead

    if existing:
        await db.users.update_one({"user_id": req.user_id}, {"$set": {
            "email": email, "password_hash": _hash_pw(req.password),
            "name": req.name or email.split("@")[0], "referral_code": ref_code,
            "updated_at": now}})
        user_id = req.user_id
    else:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "user_id": user_id, "email": email, "password_hash": _hash_pw(req.password),
            "name": req.name or email.split("@")[0], "credits": FREE_CREDITS,
            "referral_code": ref_code, "created_at": now})

    # Referral bonus: +5 to both, once, if a valid inviter code is provided.
    if req.ref:
        inviter = await db.users.find_one({"referral_code": req.ref.strip().upper()}, {"_id": 0})
        if inviter and inviter["user_id"] != user_id:
            await add_credits(inviter["user_id"], REFERRAL_BONUS)
            await add_credits(user_id, REFERRAL_BONUS)
            await db.users.update_one({"user_id": user_id}, {"$set": {"referred_by": inviter["user_id"]}})
            await db.referrals.insert_one({"inviter": inviter["user_id"], "invitee": user_id,
                                           "bonus": REFERRAL_BONUS, "created_at": now})

    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"token": _make_token(user_id, email), "user": _public_user(u)}


@api.post("/auth/login")
async def login(req: LoginReq):
    email = req.email.strip().lower()
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u or not u.get("password_hash") or not _verify_pw(req.password, u["password_hash"]):
        raise HTTPException(401, "Email o password errati.")
    if not u.get("referral_code"):
        code = _gen_ref_code()
        await db.users.update_one({"user_id": u["user_id"]}, {"$set": {"referral_code": code}})
        u["referral_code"] = code
    return {"token": _make_token(u["user_id"], email), "user": _public_user(u)}


@api.get("/auth/me")
async def auth_me(request: Request):
    u = await get_current_user(request)
    return {"user": _public_user(u)}


@api.get("/referral/{user_id}")
async def referral_info(user_id: str):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(404, "Utente non trovato")
    code = u.get("referral_code")
    if not code:
        code = _gen_ref_code()
        await db.users.update_one({"user_id": user_id}, {"$set": {"referral_code": code}})
    count = await db.referrals.count_documents({"inviter": user_id})
    return {"referral_code": code, "invited_count": count, "bonus_per_invite": REFERRAL_BONUS}




app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
