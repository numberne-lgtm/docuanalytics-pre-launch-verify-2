"""Admin privacy tools: GDPR deletion requests (dry-run by default) and retention simulation."""
import os
import hmac
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

IDENTITY_METHODS = {
    "email_from_account_address": "Richiesta ricevuta dall'indirizzo email dell'account",
    "authenticated_session": "Richiesta inviata dall'utente autenticato nella piattaforma",
    "verified_document": "Identità verificata con documento (conservato fuori dalla piattaforma)",
}
CONTENT_COLLECTIONS = {"analyses": "user_id", "reminders": "user_id", "email_verifications": "user_id"}
KEPT_COLLECTIONS = {"payment_transactions": "user_id", "subscriptions": "user_id", "crypto_orders": "user_id"}
ANON_FIELDS = ["email", "password_hash", "name", "picture", "signup_ip", "referral_code"]


def _enabled() -> bool:
    return (os.environ.get("ADMIN_DELETION_ENABLED") or "false").strip().lower() == "true"


def _ehash(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


def _mask(email: str) -> str:
    name, _, dom = email.partition("@")
    return f"{name[:2]}***@{dom}" if dom else "***"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LookupReq(BaseModel):
    email: str = Field(..., max_length=200)


class CreateReq(BaseModel):
    account_email: str = Field(..., max_length=200)
    requester_email: str = Field(..., max_length=200)
    identity_method: str
    identity_reference: str = Field(..., min_length=3, max_length=200)
    attest: bool


class ExecuteReq(BaseModel):
    confirm_email: str = Field(..., max_length=200)
    confirm_phrase: str
    dry_run: bool = True


def build_privacy_router(db, admin_token: Optional[str]) -> APIRouter:
    router = APIRouter(prefix="/api/admin/privacy")

    def _auth(tok: Optional[str]) -> str:
        if not admin_token:
            raise HTTPException(503, "Admin non configurato")
        if not (tok and hmac.compare_digest(tok, admin_token)):
            raise HTTPException(401, "Token admin non valido")
        return hashlib.sha256(tok.encode()).hexdigest()[:10]

    async def _audit(action: str, admin: str, request_id: Optional[str] = None, **extra):
        await db.privacy_audit_log.insert_one({"log_id": str(uuid.uuid4()), "action": action, "admin": admin,
                                               "request_id": request_id, "at": _now(), **extra})

    async def _counts(uid: str) -> dict:
        out = {}
        for col, key in {**CONTENT_COLLECTIONS, **KEPT_COLLECTIONS}.items():
            out[col] = await db[col].count_documents({key: uid})
        out["referrals"] = await db.referrals.count_documents({"$or": [{"inviter": uid}, {"invitee": uid}]})
        return out

    async def _user(email: str) -> Optional[dict]:
        return await db.users.find_one({"email": email.strip().lower()}, {"_id": 0, "password_hash": 0})

    @router.get("/config")
    async def config(x_admin_token: str = Header(None)):
        _auth(x_admin_token)
        return {"deletion_enabled": _enabled(), "identity_methods": IDENTITY_METHODS}

    @router.post("/lookup")
    async def lookup(req: LookupReq, x_admin_token: str = Header(None)):
        admin = _auth(x_admin_token)
        u = await _user(req.email)
        await _audit("lookup", admin, email_hash=_ehash(req.email), found=bool(u))
        if not u:
            return {"found": False}
        active_sub = await db.subscriptions.count_documents({"user_id": u["user_id"], "status": "active"})
        return {"found": True, "email_masked": _mask(u["email"]), "auth_provider": u.get("auth_provider") or "email",
                "created_at": u.get("created_at"), "credits": u.get("credits", 0),
                "active_subscriptions": active_sub, "counts": await _counts(u["user_id"])}

    @router.post("/requests")
    async def create_request(req: CreateReq, x_admin_token: str = Header(None)):
        admin = _auth(x_admin_token)
        if req.identity_method not in IDENTITY_METHODS:
            raise HTTPException(400, "Metodo di verifica identità non valido.")
        if not req.attest:
            raise HTTPException(400, "Devi confermare di aver verificato l'identità del richiedente.")
        if req.account_email.strip().lower() != req.requester_email.strip().lower():
            raise HTTPException(400, "L'email del richiedente non coincide con l'email dell'account: identità non verificata.")
        u = await _user(req.account_email)
        if not u:
            raise HTTPException(404, "Nessun account con questa email.")
        rid = str(uuid.uuid4())
        await db.privacy_requests.insert_one({
            "request_id": rid, "user_id": u["user_id"], "email_hash": _ehash(u["email"]),
            "email_masked": _mask(u["email"]), "identity_method": req.identity_method,
            "identity_reference": req.identity_reference.strip(), "status": "verified",
            "created_at": _now(), "created_by": admin})
        await _audit("request_created", admin, rid, identity_method=req.identity_method)
        return {"request_id": rid, "status": "verified", "email_masked": _mask(u["email"])}

    @router.get("/requests")
    async def list_requests(x_admin_token: str = Header(None)):
        _auth(x_admin_token)
        rows = [r async for r in db.privacy_requests.find({}, {"_id": 0, "user_id": 0, "email_hash": 0})
                .sort("created_at", -1).limit(100)]
        return {"requests": rows}

    @router.post("/requests/{request_id}/execute")
    async def execute(request_id: str, req: ExecuteReq, x_admin_token: str = Header(None)):
        admin = _auth(x_admin_token)
        r = await db.privacy_requests.find_one({"request_id": request_id}, {"_id": 0})
        if not r:
            raise HTTPException(404, "Richiesta non trovata.")
        if r["status"] == "completed":
            raise HTTPException(409, "Richiesta già eseguita.")
        if _ehash(req.confirm_email) != r["email_hash"]:
            raise HTTPException(400, "L'email di conferma non corrisponde alla richiesta.")
        if req.confirm_phrase.strip() != "ELIMINA":
            raise HTTPException(400, "Digita ELIMINA per confermare.")
        uid = r["user_id"]
        counts = await _counts(uid)
        active_sub = await db.subscriptions.count_documents({"user_id": uid, "status": "active"})
        plan = {"delete": {k: counts[k] for k in [*CONTENT_COLLECTIONS, "referrals"]},
                "keep_for_fiscal_obligations": {k: counts[k] for k in KEPT_COLLECTIONS},
                "anonymize_user_fields": ANON_FIELDS, "active_subscriptions": active_sub}
        if req.dry_run:
            await _audit("dry_run", admin, request_id, plan=plan)
            return {"dry_run": True, "executed": False, "plan": plan}
        if not _enabled():
            await _audit("execute_blocked", admin, request_id, reason="deletion_disabled")
            raise HTTPException(403, "Cancellazione reale disabilitata in questo ambiente (ADMIN_DELETION_ENABLED=false).")
        if active_sub:
            raise HTTPException(409, "L'utente ha un abbonamento attivo: annullalo prima di procedere.")
        for col, key in CONTENT_COLLECTIONS.items():
            await db[col].delete_many({key: uid})
        await db.referrals.delete_many({"$or": [{"inviter": uid}, {"invitee": uid}]})
        await db.users.update_one({"user_id": uid}, {"$unset": {f: "" for f in ANON_FIELDS},
                                                     "$set": {"deleted_at": _now(), "credits": 0, "status": "deleted"}})
        await db.privacy_requests.update_one({"request_id": request_id},
                                             {"$set": {"status": "completed", "completed_at": _now()}})
        await _audit("executed", admin, request_id, plan=plan)
        return {"dry_run": False, "executed": True, "plan": plan}

    @router.get("/log")
    async def log(x_admin_token: str = Header(None)):
        _auth(x_admin_token)
        rows = [r async for r in db.privacy_audit_log.find({}, {"_id": 0, "email_hash": 0}).sort("at", -1).limit(200)]
        return {"log": rows}

    @router.get("/retention-simulation")
    async def retention_simulation(analyses_months: int = 24, inactive_months: int = 24,
                                   x_admin_token: str = Header(None)):
        """Read-only: counts what a retention policy WOULD affect. Never deletes."""
        admin = _auth(x_admin_token)
        if not (1 <= analyses_months <= 120 and 1 <= inactive_months <= 120):
            raise HTTPException(400, "Periodi ammessi: 1-120 mesi.")
        now = datetime.now(timezone.utc)
        a_cut = (now - timedelta(days=30 * analyses_months)).isoformat()
        i_cut = (now - timedelta(days=30 * inactive_months)).isoformat()
        old_analyses = await db.analyses.count_documents({"created_at": {"$lt": a_cut}})
        total_analyses = await db.analyses.count_documents({})
        last_activity = [{"$group": {"_id": "$user_id", "last": {"$max": "$created_at"}}}]
        last = {d["_id"]: d["last"] async for d in db.analyses.aggregate(last_activity)}
        inactive_accounts = anon_inactive = total_accounts = 0
        async for u in db.users.find({"status": {"$ne": "deleted"}}, {"_id": 0, "user_id": 1, "email": 1,
                                                                       "created_at": 1, "updated_at": 1}):
            seen = max(filter(None, [u.get("created_at"), u.get("updated_at"), last.get(u["user_id"])]), default="")
            stale = seen < i_cut
            if u.get("email"):
                total_accounts += 1
                inactive_accounts += stale
            else:
                anon_inactive += stale
        res = {"simulation_only": True, "analyses_months": analyses_months, "inactive_months": inactive_months,
               "analyses_older_than_period": old_analyses, "analyses_total": total_analyses,
               "registered_accounts_inactive": inactive_accounts, "registered_accounts_total": total_accounts,
               "anonymous_sessions_inactive": anon_inactive}
        await _audit("retention_simulation", admin, params={"analyses_months": analyses_months,
                                                            "inactive_months": inactive_months})
        return res

    return router
