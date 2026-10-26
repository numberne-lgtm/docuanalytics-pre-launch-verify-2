"""Studio profile (signature + logo) for client-facing emails. Logo stored in Emergent Object Storage."""
import os
import asyncio
import requests

from . import core

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "docuanalytics"
LOGO_CID = "studio-logo"
_key = None


def _init(llm_key, force=False):
    global _key
    if _key and not force:
        return _key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": llm_key}, timeout=30)
    resp.raise_for_status()
    _key = resp.json()["storage_key"]
    return _key


def _call(llm_key, method, path, **kw):
    for force in (False, True):
        resp = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": _init(llm_key, force), **kw.pop("headers", {})}, timeout=60, **kw)
        if resp.status_code != 404 or force:
            resp.raise_for_status()
            return resp


async def put_logo(llm_key, path, data, content_type):
    r = await asyncio.to_thread(_call, llm_key, "PUT", path, headers={"Content-Type": content_type}, data=data)
    return r.json()["path"]


async def get_logo(llm_key, path):
    r = await asyncio.to_thread(_call, llm_key, "GET", path)
    return r.content


def signature_html(st: dict, with_logo: bool) -> str:
    if not st or not any(st.get(k) for k in ("name", "address", "phone", "email", "website")) and not with_logo:
        return ""
    lines = [core.esc(st.get(k)) for k in ("address", "phone", "email", "website") if st.get(k)]
    logo = f"<img src='cid:{LOGO_CID}' alt='' style='max-height:56px;max-width:180px;display:block;margin-bottom:6px'/>" if with_logo else ""
    return ("<div style='margin-top:18px;padding-top:12px;border-top:1px solid #e4e7ec;font-family:Arial,sans-serif;font-size:13px;color:#475467'>"
            f"{logo}" + (f"<b style='color:#152033'>{core.esc(st.get('name'))}</b><br/>" if st.get("name") else "")
            + "<br/>".join(lines) + "</div>")


async def client_signature(db, llm_key, user_id):
    """Returns (signature_html, attachments) for emails sent to clients on behalf of user_id."""
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "studio": 1}) or {}
    st = u.get("studio") or {}
    att = []
    if st.get("logo_path"):
        try:
            data = await get_logo(llm_key, st["logo_path"])
            ext = "png" if st.get("logo_type") == "image/png" else "jpg"
            att = [{"filename": f"logo.{ext}", "content": list(data), "content_id": LOGO_CID, "content_type": st.get("logo_type")}]
        except Exception:
            att = []
    return signature_html(st, bool(att)), att
