"""LOCAL-ONLY PR #7 staging shell.

This imports the actual workspace router, uses an isolated synthetic Mongo database,
and refuses external billing/AI/email routes. It is NOT the full production server.
It must never be hosted publicly or connected to a production DB.
"""
import os
import re
import secrets
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from workspace.router import build_workspace_router

if os.environ.get("APP_ENV") != "test" or os.environ.get("PR7_LOCAL_STAGING") != "1":
    raise RuntimeError("PR7 local staging requires APP_ENV=test and PR7_LOCAL_STAGING=1")

for forbidden in ("EMERGENT_LLM_KEY", "STRIPE_API_KEY", "PAYPAL_SECRET", "RESEND_API_KEY"):
    if os.environ.get(forbidden):
        raise RuntimeError("External integration keys are forbidden in PR7 local staging")

mongo_uri = os.environ.get("STAGING_MONGO_URI", "mongodb://mongo:27017")
if mongo_uri not in (
    "mongodb://mongo:27017",
    "mongodb://127.0.0.1:27017",
    "mongodb://localhost:27017",
):
    raise RuntimeError("Only a local MongoDB service is permitted")

PUBLIC_ORIGIN = "http://127.0.0.1:8765"
DB_NAME = "pr7_synthetic_local_only"
USER_A = "pr7-synthetic-user-a"
USER_B = "pr7-synthetic-user-b"
DEMO_PASSWORD = "synthetic-local-only"  # Public fake credentials, never a real secret
DEMO_EMAILS = {
    "studio-a@demo.invalid": USER_A,
    "studio-b@demo.invalid": USER_B,
}

client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=2500)
db = client[DB_NAME]
sessions = {}
app = FastAPI(title="PR7 local synthetic staging", docs_url=None, redoc_url=None)

# Permit only the account-owned, local-only workspace operations under test.
# Everything else fails closed; in particular: billing, email, deep audit,
# object storage, real LLM, public calendar tokens, and background scheduler.
SAFE_WORKSPACE = {
    "GET": [
        r"/overview", r"/documents", r"/documents/[A-Za-z0-9-]{1,128}",
        r"/clients", r"/clients/[A-Za-z0-9-]{1,128}", r"/deadlines",
        r"/deadlines/review", r"/calendar\.ics", r"/settings",
        r"/priorities/(?:document|deadline)/[A-Za-z0-9-]{1,128}",
        r"/priorities/(?:document|deadline)/[A-Za-z0-9-]{1,128}/(?:qr|pdf)",
    ],
    "PUT": [
        r"/priorities/read-state",
        r"/deadlines/[A-Za-z0-9-]{1,128}/operational",
    ],
    "POST": [r"/deadlines/[A-Za-z0-9-]{1,128}/confirm"],
}


@app.middleware("http")
async def deny_external_or_unreviewed_calls(request, call_next):
    if request.url.path.startswith("/api/workspace"):
        suffix = request.url.path[len("/api/workspace"):]
        if not any(re.fullmatch(pattern, suffix)
                   for pattern in SAFE_WORKSPACE.get(request.method, [])):
            return JSONResponse({"detail": "Non disponibile nello staging locale sintetico."}, status_code=503)
    elif request.url.path.startswith("/api/") and request.url.path not in (
        "/api/auth/login", "/api/auth/me", "/api/session", "/api/pr7-staging/status"
    ) and not re.fullmatch(r"/api/session/[A-Za-z0-9-]{1,128}", request.url.path):
        return JSONResponse({"detail": "Servizio esterno disattivato in staging."}, status_code=503)
    return await call_next(request)


async def authenticated_user(request: Request):
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    uid = sessions.get(token)
    if not uid:
        raise HTTPException(401, "Accesso richiesto allo staging locale")
    return {
        "user_id": uid,
        "email": next(k for k, v in DEMO_EMAILS.items() if v == uid),
        "credits": 0,
        "name": "Studio sintetico A" if uid == USER_A else "Studio sintetico B",
    }


async def disabled_email(*args, **kwargs):
    raise HTTPException(503, "Invio email disattivato nello staging sintetico")


app.include_router(build_workspace_router(
    db, authenticated_user, None, [30, 7, 1], disabled_email, None, PUBLIC_ORIGIN
))


class LocalLogin(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login")
async def local_login(payload: LocalLogin):
    uid = DEMO_EMAILS.get(payload.email.strip().lower())
    if not uid or not secrets.compare_digest(payload.password, DEMO_PASSWORD):
        raise HTTPException(401, "Credenziali sintetiche non valide")
    token = secrets.token_urlsafe(32)
    sessions[token] = uid
    return {"token": token, "user": await _user_details(uid)}


async def _user_details(uid):
    return {
        "user_id": uid, "email": next(k for k, v in DEMO_EMAILS.items() if v == uid),
        "name": "Studio sintetico A" if uid == USER_A else "Studio sintetico B",
        "credits": 0,
    }


@app.get("/api/auth/me")
async def local_me(request: Request):
    uid = (await authenticated_user(request))["user_id"]
    return {"user": await _user_details(uid)}


@app.post("/api/session")
async def anonymous_session():
    return {"user_id": "pr7-local-anonymous", "credits": 0}


@app.get("/api/session/{uid}")
async def local_session(uid: str, request: Request):
    user = await authenticated_user(request)
    if uid != user["user_id"]:
        raise HTTPException(404, "Sessione non trovata")
    return await _user_details(uid)


@app.get("/api/pr7-staging/status")
async def local_status():
    return {"environment": "synthetic-local", "billable_integrations": False,
            "data": "synthetic-only", "mongo": "local-service"}


@app.on_event("startup")
async def seed_only_synthetic_data():
    # Deterministic fixture IDs, kept inside the isolated DB, never a copy of production.
    for label, uid in (("A", USER_A), ("B", USER_B)):
        cid = f"pr7-client-{label.lower()}"
        aid = f"pr7-analysis-{label.lower()}"
        rid = f"pr7-deadline-{label.lower()}"
        await db.users.update_one(
            {"user_id": uid},
            {"$setOnInsert": {"user_id": uid, "email": f"studio-{label.lower()}@demo.invalid",
                              "credits": 0, "name": f"Studio sintetico {label}"}},
            upsert=True,
        )
        await db.clients.update_one(
            {"user_id": uid, "client_id": cid},
            {"$setOnInsert": {"user_id": uid, "client_id": cid,
                              "name": f"Cliente fittizio {label}", "piva": "", "cf": "",
                              "email": "", "created_at": "2026-11-06T10:00:00Z"}},
            upsert=True,
        )
        await db.analyses.update_one(
            {"user_id": uid, "analysis_id": aid},
            {"$setOnInsert": {
                "user_id": uid, "analysis_id": aid, "client_id": cid,
                "filename": f"contratto-fittizio-{label.lower()}.pdf",
                "created_at": "2026-11-06T10:10:00Z",
                "ws_synced": True, "risk_level": "medium",
                "result": {"doc_type": "Contratto sintetico",
                           "summary": f"Documento inventato per Studio {label}. Nessun dato reale.",
                           "audit": [{"level": "warning",
                                      "message": "Controllare la data della scadenza fittizia."}],
                           "fields": [{"label": "Tipo", "value": "Dato sintetico"}]}}},
            upsert=True,
        )
        await db.reminders.update_one(
            {"user_id": uid, "reminder_id": rid},
            {"$setOnInsert": {"user_id": uid, "reminder_id": rid, "client_id": cid,
                              "analysis_id": aid, "label": f"Scadenza sintetica {label}",
                              "due_date": "2027-01-15", "status": "confirmed",
                              "confirmed_at": "2026-11-06T10:15:00Z",
                              "source": "manual", "kind": "other", "active": True,
                              "notify_days": [], "sent": [], "email": ""}},
            upsert=True,
        )


@app.on_event("shutdown")
async def close_local_db():
    client.close()


# Serve the same React production build used in normal browser tests.
# API routes above take precedence. No public bind: Docker Compose binds 127.0.0.1.
WEB_ROOT = Path(__file__).parent / "build"


@app.get("/{full_path:path}", include_in_schema=False)
async def local_frontend(full_path: str):
    if not WEB_ROOT.joinpath("index.html").is_file():
        raise HTTPException(503, "Frontend non compilato")
    target = (WEB_ROOT / full_path).resolve()
    if target.is_file() and target.is_relative_to(WEB_ROOT.resolve()):
        return FileResponse(target)
    return FileResponse(WEB_ROOT / "index.html")
