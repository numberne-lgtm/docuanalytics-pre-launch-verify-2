"""Workspace API: Cliente 360, Risk Dashboard, automatic deadlines (on existing reminders), Multi-Document Audit."""
import json
import re
import uuid
import hmac
import asyncio
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import core

logger = logging.getLogger("docuanalytics.workspace")
RISK_ORDER = {"high": 0, "medium": 1, "low": 2}


def _now():
    return datetime.now(timezone.utc).isoformat()


class ClientReq(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    piva: Optional[str] = ""
    cf: Optional[str] = ""
    email: Optional[str] = ""
    from_analysis_id: Optional[str] = None


class ClientPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    piva: Optional[str] = None
    cf: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)


class AssignReq(BaseModel):
    client_id: Optional[str] = None


class DeadlineReq(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)
    due_date: str
    kind: Optional[str] = "other"
    analysis_id: Optional[str] = None
    client_id: Optional[str] = None
    notify_days: Optional[List[int]] = None
    notify_client: bool = False


class DeadlinePatch(BaseModel):
    label: Optional[str] = Field(None, max_length=200)
    due_date: Optional[str] = None
    kind: Optional[str] = None
    notify_days: Optional[List[int]] = None
    notify_client: Optional[bool] = None


class ConfirmReq(BaseModel):
    notify: bool = True
    notify_days: Optional[List[int]] = None


NOTIFY_CHOICES = (30, 15, 7, 3, 1, 0)


def _notify(days):
    if any(d not in NOTIFY_CHOICES for d in days):
        raise HTTPException(400, "Giorni di avviso non validi.")
    return sorted(set(days), reverse=True)


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def _email(v):
    v = (v or "").strip().lower()
    if v and not EMAIL_RE.match(v):
        raise HTTPException(400, "Indirizzo email non valido.")
    return v


class ReportSendReq(BaseModel):
    to: Optional[str] = None
    message: Optional[str] = Field(None, max_length=1500)


class SettingsReq(BaseModel):
    weekly_digest: bool


class AuditReq(BaseModel):
    analysis_ids: List[str] = Field(..., min_length=2, max_length=10)


def build_workspace_router(db, get_current_user, llm_key, default_notify_days, send_email, cron_secret, app_url) -> APIRouter:
    r = APIRouter(prefix="/api/workspace")

    async def _user(request: Request) -> dict:
        u = await get_current_user(request)
        if not u.get("email"):
            raise HTTPException(403, "Area riservata agli utenti registrati.")
        return u

    async def _analysis(uid, aid):
        a = await db.analyses.find_one({"analysis_id": aid, "user_id": uid}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Documento non trovato")
        return a

    async def _client(uid, cid):
        c = await db.clients.find_one({"client_id": cid, "user_id": uid}, {"_id": 0})
        if not c:
            raise HTTPException(404, "Cliente non trovato")
        return c

    async def _link(uid, aid, cid, how):
        await db.analyses.update_one({"analysis_id": aid, "user_id": uid},
                                     {"$set": {"client_id": cid, "client_link": {"status": how, "at": _now()}}})
        await db.reminders.update_many({"analysis_id": aid, "user_id": uid}, {"$set": {"client_id": cid}})

    async def _sync(u):
        uid = u["user_id"]
        clients = [c async for c in db.clients.find({"user_id": uid}, {"_id": 0})]
        async for a in db.analyses.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(500):
            res = a.get("result") or {}
            upd = {}
            if not a.get("ws_synced"):
                upd.update({"ws_synced": True, "risk_level": core.doc_risk(res)})
                for d in core.deadlines(res):
                    key = {"user_id": uid, "analysis_id": a["analysis_id"], "kind": d["kind"],
                           "due_date": d["due_date"] or "", "raw_date": d["raw_date"]}
                    if await db.reminders.find_one(key):
                        continue
                    await db.reminders.insert_one({
                        **key, "reminder_id": str(uuid.uuid4()), "email": u["email"], "label": d["label"],
                        "doc_type": res.get("doc_type") or a.get("doc_type") or "", "status": d["status"],
                        "source": "auto", "client_id": a.get("client_id"), "notify_days": [], "sent": [],
                        "active": True, "created_at": _now()})
            if not a.get("client_id") and not (a.get("client_link") or {}).get("status") == "unlinked":
                hits = {c["client_id"] for s in core.subjects(res) if (c := core.match_client(s, clients))}
                if len(hits) == 1:
                    await _link(uid, a["analysis_id"], hits.pop(), "auto")
            if upd:
                await db.analyses.update_one({"analysis_id": a["analysis_id"]}, {"$set": upd})

    def _doc_out(a, clients_by_id):
        res = a.get("result") or {}
        return {"analysis_id": a["analysis_id"], "filename": a.get("filename"), "doc_type": res.get("doc_type") or a.get("doc_type"),
                "category": core.category(res), "summary": res.get("summary", ""), "created_at": a.get("created_at"),
                "risk_level": a.get("risk_level") or core.doc_risk(res),
                "flags": [x for x in res.get("audit") or [] if x.get("level") in ("warning", "error")],
                "client_id": a.get("client_id"), "client_name": (clients_by_id.get(a.get("client_id")) or {}).get("name"),
                "client_link": (a.get("client_link") or {}).get("status")}

    def _dl_out(rm):
        dl = core.days_left(rm.get("due_date"))
        status = rm.get("status") or "confirmed"
        return {k: rm.get(k) for k in ("reminder_id", "label", "due_date", "raw_date", "kind", "analysis_id", "client_id",
                                       "doc_type", "source", "notify_days")} | {"notify_pref": rm.get("notify_pref"), "notify_client": bool(rm.get("notify_client")),
            "status": status, "days_left": dl, "kind_label": core.KIND_LABEL.get(rm.get("kind") or "other", "Scadenza"),
            "priority": core.deadline_priority(dl, status)}

    async def _deadlines(uid, flt=None):
        q = {"user_id": uid, "active": True, **(flt or {})}
        return [_dl_out(x) async for x in db.reminders.find(q, {"_id": 0}).sort("due_date", 1)]

    def _buckets(dls):
        b = {"today": [], "next7": [], "next30": [], "overdue": [], "to_verify": [], "later": []}
        for d in dls:
            dl = d["days_left"]
            if d["status"] == "to_verify" or dl is None:
                b["to_verify"].append(d)
            elif dl < 0:
                b["overdue"].append(d)
            elif dl == 0:
                b["today"].append(d)
            elif dl <= 7:
                b["next7"].append(d)
            elif dl <= 30:
                b["next30"].append(d)
            else:
                b["later"].append(d)
        return b

    @r.post("/sync")
    async def sync(request: Request):
        u = await _user(request)
        await _sync(u)
        return {"ok": True}

    @r.get("/overview")
    async def overview(request: Request):
        u = await _user(request)
        uid = u["user_id"]
        await _sync(u)
        clients = {c["client_id"]: c async for c in db.clients.find({"user_id": uid}, {"_id": 0})}
        docs = [_doc_out(a, clients) async for a in db.analyses.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(500)]
        dls = await _deadlines(uid)
        b = _buckets(dls)
        prio = []
        for d in docs:
            if d["risk_level"] != "low":
                prio.append({"type": "document", "level": d["risk_level"], "analysis_id": d["analysis_id"], "client_id": d["client_id"],
                             "client_name": d["client_name"], "title": d["doc_type"] or d["filename"],
                             "detail": (d["flags"][0]["message"] if d["flags"] else "Da verificare")[:160], "days_left": None})
        for x in b["overdue"] + b["today"] + b["next7"] + b["next30"] + b["to_verify"]:
            lvl = "high" if (x["days_left"] is not None and x["days_left"] <= 7 and x["status"] != "to_verify") else "medium"
            prio.append({"type": "deadline", "level": lvl, "analysis_id": x["analysis_id"], "client_id": x["client_id"],
                         "client_name": (clients.get(x["client_id"]) or {}).get("name"), "title": x["label"],
                         "detail": x["kind_label"] + (" — da verificare" if x["status"] == "to_verify" else ""),
                         "days_left": x["days_left"], "reminder_id": x["reminder_id"]})
        prio.sort(key=lambda p: (RISK_ORDER[p["level"]], p["days_left"] if p["days_left"] is not None else 9999))
        return {"counts": {"documents": len(docs), "no_issues": sum(d["risk_level"] == "low" for d in docs),
                           "to_verify": sum(d["risk_level"] == "medium" for d in docs),
                           "high": sum(d["risk_level"] == "high" for d in docs),
                           "upcoming": len(b["today"]) + len(b["next7"]) + len(b["next30"]), "overdue": len(b["overdue"]),
                           "deadlines_to_verify": len(b["to_verify"]), "clients": len(clients),
                           "unassigned": sum(not d["client_id"] for d in docs)},
                "priorities": prio[:30]}

    @r.get("/documents")
    async def documents(request: Request):
        u = await _user(request)
        clients = {c["client_id"]: c async for c in db.clients.find({"user_id": u["user_id"]}, {"_id": 0})}
        return {"documents": [_doc_out(a, clients) async for a in db.analyses.find({"user_id": u["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(500)]}

    @r.get("/documents/{aid}")
    async def document(aid: str, request: Request):
        u = await _user(request)
        a = await _analysis(u["user_id"], aid)
        res = a.get("result") or {}
        clients = {c["client_id"]: c async for c in db.clients.find({"user_id": u["user_id"]}, {"_id": 0})}
        return {**_doc_out(a, clients), "fields": res.get("fields") or [], "audit": res.get("audit") or [],
                "deadlines": await _deadlines(u["user_id"], {"analysis_id": aid})}

    @r.get("/documents/{aid}/candidates")
    async def candidates(aid: str, request: Request):
        u = await _user(request)
        a = await _analysis(u["user_id"], aid)
        clients = [c async for c in db.clients.find({"user_id": u["user_id"]}, {"_id": 0})]
        out = []
        for i, s in enumerate(core.subjects(a.get("result") or {})):
            m = core.match_client(s, clients)
            out.append({**s, "index": i, "match": {"client_id": m["client_id"], "name": m["name"]} if m else None})
        return {"subjects": out, "current_client_id": a.get("client_id")}

    @r.post("/documents/{aid}/assign")
    async def assign(aid: str, req: AssignReq, request: Request):
        u = await _user(request)
        await _analysis(u["user_id"], aid)
        if req.client_id:
            await _client(u["user_id"], req.client_id)
            await _link(u["user_id"], aid, req.client_id, "manual")
        else:
            await db.analyses.update_one({"analysis_id": aid, "user_id": u["user_id"]},
                                         {"$set": {"client_id": None, "client_link": {"status": "unlinked", "at": _now()}}})
            await db.reminders.update_many({"analysis_id": aid, "user_id": u["user_id"]}, {"$set": {"client_id": None}})
        return {"ok": True}

    @r.get("/clients")
    async def list_clients(request: Request):
        u = await _user(request)
        uid = u["user_id"]
        docs = [a async for a in db.analyses.find({"user_id": uid, "client_id": {"$ne": None}}, {"_id": 0, "client_id": 1, "risk_level": 1, "result.audit": 1})]
        out = []
        async for c in db.clients.find({"user_id": uid}, {"_id": 0}).sort("name", 1):
            mine = [a for a in docs if a.get("client_id") == c["client_id"]]
            lv = min((a.get("risk_level") or core.doc_risk(a.get("result") or {}) for a in mine), key=lambda x: RISK_ORDER[x], default="low")
            out.append({**c, "documents": len(mine), "risk_level": lv})
        return {"clients": out}

    @r.post("/clients")
    async def create_client(req: ClientReq, request: Request):
        u = await _user(request)
        uid = u["user_id"]
        piva, cf = core.norm_id(req.piva), core.norm_id(req.cf)
        for k, v in (("piva", piva), ("cf", cf)):
            if v and await db.clients.find_one({"user_id": uid, k: v}):
                raise HTTPException(409, "Esiste già un cliente con questo identificativo.")
        extra = {}
        if req.from_analysis_id:
            a = await _analysis(uid, req.from_analysis_id)
            for s in core.subjects(a.get("result") or {}):
                if (piva and s["piva"] == piva) or (cf and s["cf"] == cf) or core.norm_name(s["name"]) == core.norm_name(req.name):
                    extra = s.get("extra") or {}
                    break
        c = {"client_id": str(uuid.uuid4()), "user_id": uid, "name": req.name.strip(), "piva": piva, "cf": cf, "email": _email(req.email),
             "registry": extra, "notes": "", "created_at": _now()}
        await db.clients.insert_one(dict(c))
        if req.from_analysis_id:
            await _link(uid, req.from_analysis_id, c["client_id"], "manual")
        await _sync(u)
        return c

    @r.get("/clients/{cid}")
    async def client_360(cid: str, request: Request):
        u = await _user(request)
        uid = u["user_id"]
        c = await _client(uid, cid)
        docs_raw = [a async for a in db.analyses.find({"user_id": uid, "client_id": cid}, {"_id": 0}).sort("created_at", -1)]
        docs = [_doc_out(a, {cid: c}) for a in docs_raw]
        registry = dict(c.get("registry") or {})
        for a in docs_raw:
            for s in core.subjects(a.get("result") or {}):
                if s.get("extra") and ((c["piva"] and s["piva"] == c["piva"]) or (c["cf"] and s["cf"] == c["cf"])):
                    registry = {**s["extra"], **registry}
        risks = [{"analysis_id": d["analysis_id"], "doc_type": d["doc_type"], "filename": d["filename"], **f}
                 for d in docs for f in d["flags"]]
        dls = await _deadlines(uid, {"client_id": cid})
        activity = sorted([{"at": d["created_at"], "text": f"Documento analizzato: {d['doc_type'] or d['filename']}", "analysis_id": d["analysis_id"]} for d in docs]
                          + [{"at": c["created_at"], "text": "Cliente creato"}], key=lambda x: x["at"] or "", reverse=True)
        lv = min((d["risk_level"] for d in docs), key=lambda x: RISK_ORDER[x], default="low")
        if any(d["days_left"] is not None and d["days_left"] < 0 for d in dls):
            lv = "high"
        return {"client": {**c, "registry": registry}, "risk_level": lv, "documents": docs, "risks": risks,
                "deadlines": dls, "to_verify": [d for d in docs if d["risk_level"] == "medium"], "activity": activity[:50]}

    @r.patch("/clients/{cid}")
    async def patch_client(cid: str, req: ClientPatch, request: Request):
        u = await _user(request)
        await _client(u["user_id"], cid)
        upd = {k: (core.norm_id(v) if k in ("piva", "cf") else _email(v) if k == "email" else v.strip()) for k, v in req.model_dump().items() if v is not None}
        if upd.get("email") == "" and "email" in upd:
            await db.reminders.update_many({"user_id": u["user_id"], "client_id": cid}, {"$set": {"notify_client": False}})
        if "name" in upd and not upd["name"]:
            raise HTTPException(400, "Il nome non può essere vuoto.")
        for k in ("piva", "cf"):
            if upd.get(k) and await db.clients.find_one({"user_id": u["user_id"], k: upd[k], "client_id": {"$ne": cid}}):
                raise HTTPException(409, "Esiste già un cliente con questo identificativo.")
        if upd:
            await db.clients.update_one({"client_id": cid, "user_id": u["user_id"]}, {"$set": upd})
        return await _client(u["user_id"], cid)

    @r.delete("/clients/{cid}")
    async def delete_client(cid: str, request: Request):
        u = await _user(request)
        await _client(u["user_id"], cid)
        unlink = {"$set": {"client_id": None, "client_link": {"status": "unlinked", "at": _now()}}}
        await db.analyses.update_many({"user_id": u["user_id"], "client_id": cid}, unlink)
        await db.reminders.update_many({"user_id": u["user_id"], "client_id": cid}, {"$set": {"client_id": None}})
        await db.clients.delete_one({"client_id": cid, "user_id": u["user_id"]})
        return {"ok": True}

    @r.get("/deadlines")
    async def deadlines(request: Request):
        u = await _user(request)
        await _sync(u)
        return {"buckets": _buckets(await _deadlines(u["user_id"]))}

    @r.post("/deadlines")
    async def create_deadline(req: DeadlineReq, request: Request):
        u = await _user(request)
        iso, _ = core.parse_date(req.due_date)
        if not iso:
            raise HTTPException(400, "Data non valida.")
        if req.analysis_id:
            await _analysis(u["user_id"], req.analysis_id)
        if req.client_id:
            await _client(u["user_id"], req.client_id)
        doc = {"reminder_id": str(uuid.uuid4()), "user_id": u["user_id"], "email": u["email"], "analysis_id": req.analysis_id,
               "client_id": req.client_id, "doc_type": "", "label": req.label.strip(), "due_date": iso, "kind": req.kind or "other",
               "status": "confirmed", "source": "manual", "sent": [], "active": True,
               "notify_client": bool(req.notify_client and req.client_id),
               "notify_days": _notify(req.notify_days) if req.notify_days is not None else list(default_notify_days),
               "created_at": _now()}
        await db.reminders.insert_one(dict(doc))
        return _dl_out(doc)

    async def _own_deadline(uid, rid):
        x = await db.reminders.find_one({"reminder_id": rid, "user_id": uid, "active": True}, {"_id": 0})
        if not x:
            raise HTTPException(404, "Scadenza non trovata")
        return x

    @r.patch("/deadlines/{rid}")
    async def patch_deadline(rid: str, req: DeadlinePatch, request: Request):
        u = await _user(request)
        x = await _own_deadline(u["user_id"], rid)
        upd = {k: v for k, v in {"label": req.label, "kind": req.kind}.items() if v}
        if req.notify_client is not None:
            if req.notify_client and not x.get("client_id"):
                raise HTTPException(400, "Collega prima la scadenza a un cliente.")
            upd["notify_client"] = req.notify_client
        if req.notify_days is not None:
            upd["notify_days" if (x.get("status") or "confirmed") == "confirmed" else "notify_pref"] = _notify(req.notify_days)
        if req.due_date is not None:
            iso, _ = core.parse_date(req.due_date)
            if not iso:
                raise HTTPException(400, "Data non valida.")
            upd.update({"due_date": iso, "sent": []})
        await db.reminders.update_one({"reminder_id": rid}, {"$set": {**upd, "edited_at": _now()}})
        return _dl_out(await _own_deadline(u["user_id"], rid))

    @r.post("/deadlines/{rid}/confirm")
    async def confirm_deadline(rid: str, req: ConfirmReq, request: Request):
        u = await _user(request)
        x = await _own_deadline(u["user_id"], rid)
        if not x.get("due_date"):
            raise HTTPException(400, "Inserisci prima una data certa.")
        await db.reminders.update_one({"reminder_id": rid}, {"$set": {
            "status": "confirmed", "confirmed_at": _now(), "notify_days": (_notify(req.notify_days) if req.notify_days is not None else (x["notify_pref"] if x.get("notify_pref") is not None else list(default_notify_days))) if req.notify else []}})
        return _dl_out(await _own_deadline(u["user_id"], rid))

    @r.delete("/deadlines/{rid}")
    async def delete_deadline(rid: str, request: Request):
        u = await _user(request)
        await _own_deadline(u["user_id"], rid)
        await db.reminders.update_one({"reminder_id": rid}, {"$set": {"active": False, "removed_at": _now()}})
        return {"ok": True}

    async def _audit_docs(uid, ids):
        docs = []
        for i, aid in enumerate(dict.fromkeys(ids)):
            a = await _analysis(uid, aid)
            res = a.get("result") or {}
            docs.append({"ref": f"Documento {chr(65 + i)}", "analysis_id": aid, "filename": a.get("filename"),
                         "category": core.category(res), "doc_type": res.get("doc_type"), "result": res})
        if len(docs) < 2:
            raise HTTPException(400, "Seleziona almeno 2 documenti diversi.")
        return docs

    @r.post("/audits")
    async def create_audit(req: AuditReq, request: Request):
        u = await _user(request)
        docs = await _audit_docs(u["user_id"], req.analysis_ids)
        out = core.compare(docs)
        audit = {"audit_id": str(uuid.uuid4()), "user_id": u["user_id"], "created_at": _now(),
                 "documents": [{k: d[k] for k in ("ref", "analysis_id", "filename", "category", "doc_type")} for d in docs],
                 "deterministic": out, "deep": None, "note": "Pagina/sezione non disponibili: i dati provengono dall'estrazione strutturata."}
        await db.multi_document_audits.insert_one(dict(audit))
        audit.pop("user_id")
        return audit

    @r.get("/audits")
    async def list_audits(request: Request):
        u = await _user(request)
        return {"audits": [a async for a in db.multi_document_audits.find({"user_id": u["user_id"]}, {"_id": 0, "user_id": 0, "deterministic": 0, "deep": 0}).sort("created_at", -1).limit(30)]}

    @r.get("/audits/{audit_id}")
    async def get_audit(audit_id: str, request: Request):
        u = await _user(request)
        a = await db.multi_document_audits.find_one({"audit_id": audit_id, "user_id": u["user_id"]}, {"_id": 0, "user_id": 0})
        if not a:
            raise HTTPException(404, "Confronto non trovato")
        return a

    @r.post("/audits/{audit_id}/deep")
    async def deep_audit(audit_id: str, request: Request):
        u = await _user(request)
        a = await db.multi_document_audits.find_one({"audit_id": audit_id, "user_id": u["user_id"]}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Confronto non trovato")
        if a.get("deep"):
            return {"deep": a["deep"], "credits": u.get("credits", 0)}
        lock = await db.multi_document_audits.find_one_and_update(
            {"audit_id": audit_id, "user_id": u["user_id"], "deep": None,
             "$or": [{"deep_status": {"$ne": "running"}},
                     {"deep_started": {"$lt": (datetime.now(timezone.utc) - timedelta(minutes=3)).isoformat()}}]},
            {"$set": {"deep_status": "running", "deep_started": _now()}})
        if not lock:
            raise HTTPException(409, "Analisi approfondita già in corso.")
        paid = await db.users.find_one_and_update({"user_id": u["user_id"], "credits": {"$gt": 0}}, {"$inc": {"credits": -1}})
        if not paid:
            await db.multi_document_audits.update_one({"audit_id": audit_id}, {"$unset": {"deep_status": ""}})
            raise HTTPException(402, "Crediti insufficienti per l'analisi approfondita.")

        async def _refund():
            await db.users.update_one({"user_id": u["user_id"]}, {"$inc": {"credits": 1}})
            await db.multi_document_audits.update_one({"audit_id": audit_id}, {"$unset": {"deep_status": ""}})

        try:
            docs = await _audit_docs(u["user_id"], [d["analysis_id"] for d in a["documents"]])
        except HTTPException:
            await _refund()
            raise
        payload = [{"ref": d["ref"], "file": d["filename"], "tipo": d["doc_type"], "dati": core.labeled(d["result"]),
                    "testo": (d["result"].get("full_text") or "")[:3000]} for d in docs]
        prompt = ("Confronta questi documenti di uno studio professionale e individua SOLO contraddizioni o differenze sostanziali "
                  "supportate dai dati forniti (es. modifiche tra versioni di contratto, clausole diverse, importi o date incoerenti). "
                  "Non inventare norme, rischi o dati. Rispondi SOLO con JSON: {\"findings\":[{\"level\":\"Possibile anomalia|Da verificare\","
                  "\"description\":\"...\",\"sources\":[{\"ref\":\"Documento A\",\"excerpt\":\"citazione breve\"}]}]}. "
                  "Scrivi description ed excerpt in italiano chiaro per un professionista: usa le etichette dei dati così come fornite "
                  "(es. 'Data di scadenza', 'Parte 1 › Nome'), mai nomi tecnici, chiavi JSON, underscore o parentesi quadre. "
                  "L'excerpt deve essere una frase leggibile (es. 'Data di scadenza: 01/12/2025'). "
                  "Se non trovi nulla restituisci findings vuoto.\n\n" + json.dumps(payload, ensure_ascii=False)[:30000])
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = LlmChat(api_key=llm_key, session_id=f"mdaudit-{audit_id}",
                           system_message="Sei un revisore documentale prudente. Rispondi solo in JSON valido.").with_model("gemini", "gemini-2.5-flash")
            resp = await chat.send_message(UserMessage(text=prompt))
            text = resp if isinstance(resp, str) else str(resp)
            start, end = text.find("{"), text.rfind("}")
            data = json.loads(text[start:end + 1]) if start >= 0 else {"findings": []}
        except Exception as e:
            logger.exception(f"deep audit: {e}")
            await _refund()
            raise HTTPException(503, "Analisi approfondita non disponibile. Nessun credito scalato.")
        refs = {d["ref"] for d in docs}
        findings = []
        for f in data.get("findings", []) if isinstance(data, dict) else []:
            if not isinstance(f, dict):
                continue
            srcs = [{"ref": x["ref"], "excerpt": core.clean_tech(x.get("excerpt"))[:400]}
                    for x in f.get("sources") or [] if isinstance(x, dict) and x.get("ref") in refs]
            if srcs:
                findings.append({"level": str(f.get("level", "Da verificare"))[:40],
                                 "description": core.clean_tech(f.get("description"))[:600], "sources": srcs})
        deep = {"findings": findings[:30], "model": "gemini-2.5-flash", "at": _now(), "disclaimer": "Risultati AI da verificare: non sostituiscono il professionista."}
        await db.multi_document_audits.update_one({"audit_id": audit_id}, {"$set": {"deep": deep}, "$unset": {"deep_status": ""}})
        u2 = await db.users.find_one({"user_id": u["user_id"]}, {"_id": 0, "credits": 1})
        return {"deep": deep, "credits": u2.get("credits", 0)}

    async def _ics_for(uid, cid=None):
        clients = {c["client_id"]: c["name"] async for c in db.clients.find({"user_id": uid}, {"_id": 0, "client_id": 1, "name": 1})}
        q = {"user_id": uid, "active": True, "due_date": {"$nin": [None, ""]},
             "$or": [{"source": {"$ne": "auto"}}, {"status": "confirmed"}]}
        if cid:
            q["client_id"] = cid
        ev = []
        async for x in db.reminders.find(q, {"_id": 0}).sort("due_date", 1):
            desc = " · ".join(v for v in (core.KIND_LABEL.get(x.get("kind") or "other", ""), x.get("doc_type"),
                                          f"Cliente: {clients[x['client_id']]}" if x.get("client_id") in clients else "") if v)
            ev.append({**x, "description": f"{desc}\nDocuAnalytics AI — da verificare con il professionista."})
        name = f"DocuAnalytics — {clients.get(cid, 'Cliente')}" if cid else "DocuAnalytics — Scadenze"
        fname = f"scadenze-{core.slug(clients.get(cid, 'cliente'))}.ics" if cid else "docuanalytics-scadenze.ics"
        return Response(core.ics(ev, name), media_type="text/calendar; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="{fname}"', "Cache-Control": "no-store"})

    def _hash(token):
        return hashlib.sha256(token.encode()).hexdigest()

    async def _feed_target(request, cid):
        u = await _user(request)
        if cid:
            await _client(u["user_id"], cid)
            return u, db.clients, {"client_id": cid, "user_id": u["user_id"]}
        return u, db.users, {"user_id": u["user_id"]}

    async def _feed_status(request, cid=None):
        _, coll, flt = await _feed_target(request, cid)
        f = (await coll.find_one(flt, {"_id": 0, "calendar_feed": 1}) or {}).get("calendar_feed") or {}
        return {"active": bool(f.get("hash")), "created_at": f.get("created_at")}

    async def _feed_create(request, cid=None):
        _, coll, flt = await _feed_target(request, cid)
        token = secrets.token_urlsafe(32)
        await coll.update_one(flt, {"$set": {"calendar_feed": {"hash": _hash(token), "created_at": _now()}}})
        return {"token": token, "active": True}

    async def _feed_revoke(request, cid=None):
        _, coll, flt = await _feed_target(request, cid)
        await coll.update_one(flt, {"$unset": {"calendar_feed": ""}})
        return {"active": False}

    @r.get("/calendar.ics")
    async def calendar_download(request: Request):
        u = await _user(request)
        return await _ics_for(u["user_id"])

    @r.get("/calendar/feed")
    async def feed_status(request: Request):
        return await _feed_status(request)

    @r.post("/calendar/feed")
    async def feed_create(request: Request):
        return await _feed_create(request)

    @r.delete("/calendar/feed")
    async def feed_revoke(request: Request):
        return await _feed_revoke(request)

    @r.get("/clients/{cid}/calendar.ics")
    async def client_calendar_download(cid: str, request: Request):
        u = await _user(request)
        await _client(u["user_id"], cid)
        return await _ics_for(u["user_id"], cid)

    @r.get("/clients/{cid}/calendar/feed")
    async def client_feed_status(cid: str, request: Request):
        return await _feed_status(request, cid)

    @r.post("/clients/{cid}/calendar/feed")
    async def client_feed_create(cid: str, request: Request):
        return await _feed_create(request, cid)

    @r.delete("/clients/{cid}/calendar/feed")
    async def client_feed_revoke(cid: str, request: Request):
        return await _feed_revoke(request, cid)

    @r.get("/feed/{token}.ics")
    async def feed_public(token: str):
        if len(token) < 40:
            raise HTTPException(404, "Not found")
        h = _hash(token)
        u = await db.users.find_one({"calendar_feed.hash": h}, {"_id": 0, "user_id": 1})
        if u:
            return await _ics_for(u["user_id"])
        c = await db.clients.find_one({"calendar_feed.hash": h}, {"_id": 0, "user_id": 1, "client_id": 1})
        if not c:
            raise HTTPException(404, "Not found")
        return await _ics_for(c["user_id"], c["client_id"])

    @r.get("/clients/{cid}/report.pdf")
    async def client_report(cid: str, request: Request):
        u = await _user(request)
        uid = u["user_id"]
        c = await _client(uid, cid)
        docs = [a async for a in db.analyses.find({"user_id": uid, "client_id": cid}, {"_id": 0}).sort("created_at", -1)]
        dls = [d for d in await _deadlines(uid, {"client_id": cid}) if d["status"] == "confirmed" and d["due_date"]]
        pdf = core.client_report_pdf(c, docs, dls, u.get("name") or u.get("email") or "")
        return Response(pdf, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="report-{core.slug(c["name"])}.pdf"', "Cache-Control": "no-store"})


    async def _sent_today(uid, kind):
        since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        return await db.email_log.count_documents({"user_id": uid, "kind": kind, "at": {"$gte": since}})

    @r.post("/clients/{cid}/report/send")
    async def client_report_send(cid: str, req: ReportSendReq, request: Request):
        u = await _user(request)
        uid = u["user_id"]
        c = await _client(uid, cid)
        to = _email(req.to) or c.get("email")
        if not to:
            raise HTTPException(400, "Inserisci l'email del cliente.")
        if await _sent_today(uid, "client_report") >= 20:
            raise HTTPException(429, "Limite giornaliero di invii raggiunto (20). Riprova domani.")
        docs = [a async for a in db.analyses.find({"user_id": uid, "client_id": cid}, {"_id": 0}).sort("created_at", -1)]
        dls = [d for d in await _deadlines(uid, {"client_id": cid}) if d["status"] == "confirmed" and d["due_date"]]
        sender = u.get("name") or u["email"]
        pdf = core.client_report_pdf(c, docs, dls, sender)
        note = (req.message or "").strip()
        html = ("<div style=\"font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#152033\">"
                f"<h2 style=\"color:#315efb\">Riepilogo documenti e scadenze</h2><p>Gentile {core.esc(c['name'])},</p>"
                + (f"<p style=\"white-space:pre-line\">{core.esc(note)}</p>" if note else
                   "<p>in allegato trova il riepilogo dei documenti e delle scadenze confermate.</p>")
                + f"<p>Inviato da {core.esc(sender)} tramite DocuAnalytics AI. Per domande rispondi a questa email.</p>"
                "<p style=\"font-size:12px;color:#667085\">I dati sono estratti automaticamente dai documenti e vanno verificati sugli originali.</p></div>")
        ok = await send_email(to, f"Riepilogo documenti e scadenze — {c['name']}", html, reply_to=u["email"],
                              attachments=[{"filename": f"report-{core.slug(c['name'])}.pdf", "content": list(pdf)}],
                              kind="client_report", user_id=uid)
        if not ok:
            last = await db.email_log.find_one({"user_id": uid, "kind": "client_report"}, sort=[("at", -1)])
            raise HTTPException(400, "Indirizzo non consentito per l'invio." if (last or {}).get("status") == "skipped_reserved_domain"
                                else "Invio non riuscito. Riprova tra poco.")
        if not c.get("email"):
            await db.clients.update_one({"client_id": cid, "user_id": uid}, {"$set": {"email": to}})
        await db.clients.update_one({"client_id": cid, "user_id": uid}, {"$set": {"last_report_sent": {"to": to, "at": _now()}}})
        return {"ok": True, "to": to}

    @r.get("/settings")
    async def get_settings(request: Request):
        u = await _user(request)
        return {"weekly_digest": bool(u.get("weekly_digest")), "email": u["email"]}

    @r.put("/settings")
    async def put_settings(req: SettingsReq, request: Request):
        u = await _user(request)
        await db.users.update_one({"user_id": u["user_id"]}, {"$set": {"weekly_digest": req.weekly_digest}})
        return {"weekly_digest": req.weekly_digest, "email": u["email"]}

    async def _digest(u):
        uid = u["user_id"]
        await _sync(u)
        clients = {c["client_id"]: c["name"] async for c in db.clients.find({"user_id": uid}, {"_id": 0, "client_id": 1, "name": 1})}
        dls = await _deadlines(uid)
        week = [d for d in dls if d["days_left"] is not None and 0 <= d["days_left"] <= 7 and d["status"] != "to_verify"]
        overdue = [d for d in dls if d["days_left"] is not None and d["days_left"] < 0 and d["status"] == "confirmed"]
        unsure = [d for d in dls if d["status"] == "to_verify"]
        docs = [_doc_out(a, {}) async for a in db.analyses.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(500)]
        check = [d for d in docs if d["risk_level"] in ("high", "medium")]
        check.sort(key=lambda d: RISK_ORDER[d["risk_level"]])
        return core.digest_html(week, overdue, unsure, check[:15], len(check), clients, app_url)

    async def _send_digest(u, kind="weekly_digest"):
        html = await _digest(u)
        return await send_email(u["email"], "Il tuo riepilogo settimanale — DocuAnalytics AI", html, kind=kind, user_id=u["user_id"])

    @r.post("/digest/preview")
    async def digest_preview(request: Request):
        u = await _user(request)
        if await _sent_today(u["user_id"], "digest_preview") >= 5:
            raise HTTPException(429, "Limite di anteprime raggiunto per oggi.")
        if not await _send_digest(u, "digest_preview"):
            raise HTTPException(400, "Invio non riuscito per questo indirizzo.")
        return {"ok": True, "to": u["email"]}

    async def _run_weekly(run_id):
        week = datetime.now(timezone.utc).strftime("%G-W%V")
        async for u in db.users.find({"weekly_digest": True, "email": {"$nin": [None, ""]}}, {"_id": 0}):
            lock = await db.users.update_one({"user_id": u["user_id"], "last_digest_week": {"$ne": week}},
                                             {"$set": {"last_digest_week": week}})
            if not lock.modified_count:
                continue
            try:
                await _send_digest(u)
            except Exception as e:
                logger.exception(f"weekly digest {u['user_id']}: {e}")
        await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"done_at": _now()}})

    @r.post("/cron/weekly-digest")
    async def cron_weekly_digest(request: Request):
        # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
        auth = request.headers.get("authorization") or ""
        if not cron_secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], cron_secret):
            raise HTTPException(401, "Unauthorized")
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            raise HTTPException(400, "Invalid body")
        run_id = request.headers.get("x-webhook-id") or body.get("run_id") or str(uuid.uuid4())
        res = await db.cron_runs.update_one({"run_id": run_id}, {"$setOnInsert": {"run_id": run_id, "job": "weekly-digest", "at": _now()}}, upsert=True)
        if res.upserted_id is not None:
            asyncio.create_task(_run_weekly(run_id))
        return {"accepted": True, "duplicate": res.upserted_id is None}

    return r
