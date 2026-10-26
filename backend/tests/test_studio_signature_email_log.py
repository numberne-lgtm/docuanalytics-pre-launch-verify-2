# Iteration 29: studio signature (GET/PUT /studio, logo upload/get/delete in Object Storage), client email history
# (/clients/{cid}/emails), deadline client_message, client reminder pipeline with signature. No AI, no real sends.
import os, sys, uuid, time, struct, zlib, subprocess, asyncio
from datetime import datetime, timedelta, timezone
import pytest, requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
sys.path.insert(0, "/app/backend")


def W(p):
    return f"{BASE}/api/workspace{p}"


def png_bytes(w=4, h=4):
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


PNG = png_bytes()


def _reg(tag="it29"):
    email = f"test_{tag}_{uuid.uuid4().hex[:8]}@example.com"
    d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": "TEST it29"}).json()
    return {"uid": d["user"]["user_id"], "email": email, "h": {"Authorization": f"Bearer {d['token']}"}}


def _cleanup(a):
    for c in ("analyses", "reminders", "clients", "email_log", "files"):
        mdb[c].delete_many({"user_id": a["uid"]})
    mdb.users.delete_one({"user_id": a["uid"]})


@pytest.fixture(scope="module")
def u():
    a = _reg(); yield a; _cleanup(a)


@pytest.fixture(scope="module")
def other():
    a = _reg(); yield a; _cleanup(a)


# --- studio profile
def test_studio_get_put(u):
    r = requests.get(W("/studio"), headers=u["h"]); assert r.status_code == 200
    assert r.json() == {"name": "", "address": "", "phone": "", "email": "", "website": "", "has_logo": False}
    body = {"name": "TEST Studio Rossi", "address": "Via Roma 1, Milano", "phone": "+39 02 123", "email": "Info@Studio.IT", "website": "studio.it"}
    r = requests.put(W("/studio"), headers=u["h"], json=body); assert r.status_code == 200
    d = requests.get(W("/studio"), headers=u["h"]).json()
    assert d["name"] == "TEST Studio Rossi" and d["email"] == "info@studio.it" and d["website"] == "studio.it" and d["has_logo"] is False


def test_studio_invalid(u):
    assert requests.put(W("/studio"), headers=u["h"], json={"email": "nope"}).status_code == 400
    assert requests.put(W("/studio"), headers=u["h"], json={"name": "x" * 121}).status_code == 422
    assert requests.get(W("/studio")).status_code == 401
    # invalid email must not wipe saved data
    assert requests.get(W("/studio"), headers=u["h"]).json()["name"] == "TEST Studio Rossi"


# --- logo
def test_logo_validation(u):
    f = lambda n, b, t: {"file": (n, b, t)}
    r = requests.post(W("/studio/logo"), headers=u["h"], files=f("a.txt", b"hello", "text/plain"))
    assert r.status_code == 400 and "PNG" in r.json()["detail"]
    r = requests.post(W("/studio/logo"), headers=u["h"], files=f("a.png", b"not an image", "image/png"))
    assert r.status_code == 400 and r.json()["detail"] == "File immagine non valido."
    r = requests.post(W("/studio/logo"), headers=u["h"], files=f("big.png", b"\x89PNG" + b"0" * 1_000_100, "image/png"))
    assert r.status_code == 400 and "1 MB" in r.json()["detail"]
    assert requests.post(W("/studio/logo"), files=f("a.png", PNG, "image/png")).status_code == 401


def test_logo_upload_get_replace_delete(u, other):
    r = requests.post(W("/studio/logo"), headers=u["h"], files={"file": ("logo.png", PNG, "image/png")})
    assert r.status_code == 200, r.text
    assert requests.get(W("/studio"), headers=u["h"]).json()["has_logo"] is True
    g = requests.get(W("/studio/logo"), headers=u["h"])
    assert g.status_code == 200 and g.content == PNG and g.headers["content-type"].startswith("image/png")
    assert requests.get(W("/studio/logo")).status_code == 401
    assert requests.get(W("/studio/logo"), headers=other["h"]).status_code == 404
    first = mdb.users.find_one({"user_id": u["uid"]})["studio"]["logo_path"]
    assert u["uid"] in first
    # replace with jpeg -> old soft-deleted
    jpg = b"\xff\xd8\xff\xe0" + b"\x00" * 50 + b"\xff\xd9"
    assert requests.post(W("/studio/logo"), headers=u["h"], files={"file": ("l.jpg", jpg, "image/jpeg")}).status_code == 200
    files = list(mdb.files.find({"user_id": u["uid"], "kind": "studio_logo"}, {"_id": 0}))
    assert len(files) == 2
    assert next(x for x in files if x["storage_path"] == first)["is_deleted"] is True
    assert sum(1 for x in files if not x["is_deleted"]) == 1
    g = requests.get(W("/studio/logo"), headers=u["h"]); assert g.content == jpg and "jpeg" in g.headers["content-type"]
    # delete
    assert requests.delete(W("/studio/logo"), headers=u["h"]).json() == {"has_logo": False}
    assert requests.get(W("/studio"), headers=u["h"]).json()["has_logo"] is False
    assert requests.get(W("/studio/logo"), headers=u["h"]).status_code == 404
    assert all(x["is_deleted"] for x in mdb.files.find({"user_id": u["uid"], "kind": "studio_logo"}))
    # re-upload png for later tests
    assert requests.post(W("/studio/logo"), headers=u["h"], files={"file": ("logo.png", PNG, "image/png")}).status_code == 200


# --- signature helpers against running DB
def test_signature_helpers(u, other):
    from motor.motor_asyncio import AsyncIOMotorClient
    from workspace import studio
    key = os.environ.get("EMERGENT_LLM_KEY")

    async def run():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        return await studio.client_signature(db, key, u["uid"]), await studio.client_signature(db, key, other["uid"])
    (sig, att), (sig2, att2) = asyncio.run(run())
    assert "TEST Studio Rossi" in sig and "<img src='cid:studio-logo'" in sig and "info@studio.it" in sig
    assert len(att) == 1 and att[0]["content_id"] == "studio-logo" and bytes(att[0]["content"]) == PNG and att[0]["filename"] == "logo.png"
    assert sig2 == "" and att2 == []
    nolog = studio.signature_html({"name": "A<b>"}, False)
    assert "cid:" not in nolog and "A&lt;b&gt;" in nolog


# --- report send + email history
def test_report_send_and_history(u, other):
    c = requests.post(W("/clients"), headers=u["h"], json={"name": "TEST Hist Srl", "email": "cliente@example.com"}).json()
    cid = c["client_id"]; u["cid"] = cid
    assert requests.get(W(f"/clients/{cid}/emails"), headers=u["h"]).json() == {"emails": []}
    r = requests.post(W(f"/clients/{cid}/report/send"), headers=u["h"], json={})
    assert r.status_code == 400 and r.json()["detail"] == "Indirizzo non consentito per l'invio."
    e = requests.get(W(f"/clients/{cid}/emails"), headers=u["h"]).json()["emails"]
    assert len(e) == 1 and e[0]["kind"] == "Report PDF" and e[0]["to"] == "cliente@example.com"
    assert e[0]["status_label"] == "Non inviata (indirizzo di prova)" and "TEST Hist Srl" in e[0]["subject"]
    assert requests.get(W(f"/clients/{cid}/emails"), headers=other["h"]).status_code == 404
    assert requests.get(W(f"/clients/{cid}/emails")).status_code == 401


# --- deadline client_message
def test_deadline_client_message(u):
    cid = requests.post(W("/clients"), headers=u["h"], json={"name": "TEST Msg Srl", "email": "m@example.com"}).json()["client_id"]
    d = requests.post(W("/deadlines"), headers=u["h"], json={"label": "TEST_MSG", "due_date": "2026-12-15", "client_id": cid, "notify_days": [3]})
    assert d.status_code == 200, d.text
    d = d.json(); print(d)
    rid = d.get("reminder_id") or d.get("deadline", {}).get("reminder_id")
    r = requests.patch(W(f"/deadlines/{rid}"), headers=u["h"], json={"notify_client": True, "client_message": "  Ciao, porta i documenti  "})
    assert r.status_code == 200, r.text
    b = requests.get(W("/deadlines"), headers=u["h"]).json()["buckets"]
    allx = [y for v in (b.values() if isinstance(b, dict) else b) for y in (v if isinstance(v, list) else v.get("items", v.get("deadlines", [])))]
    x = next(x for x in allx if x["reminder_id"] == rid)
    assert x["client_message"] == "Ciao, porta i documenti" and x["notify_client"] is True
    assert requests.patch(W(f"/deadlines/{rid}"), headers=u["h"], json={"client_message": "x" * 501}).status_code == 422
    assert requests.patch(W(f"/deadlines/{rid}"), headers=u["h"], json={"client_message": "x" * 500}).status_code == 200


def test_client_reminder_html():
    import server
    h = server._client_reminder_html("F24", "15/12/2026", 3, "me@x.it", "Ciao <test>", "<div>SIG</div>")
    assert "Ciao &lt;test&gt;" in h and "<div>SIG</div>" in h and "tra 3 giorni" in h
    assert "white-space:pre-line" not in server._client_reminder_html("F24", "15/12/2026", 0, "me@x.it")


# --- reminder pipeline on startup
def test_client_reminder_pipeline(u):
    uid = u["uid"]
    cid = f"TEST_cli_{uuid.uuid4().hex[:6]}"
    mdb.clients.insert_one({"client_id": cid, "user_id": uid, "name": "TEST Rem Cli", "email": "c@example.com", "piva": "", "cf": ""})
    due = (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat()
    rid = "TEST_r29_" + uid[:6]
    mdb.reminders.insert_one({"reminder_id": rid, "user_id": uid, "email": u["email"], "label": "TEST rem29", "due_date": due, "kind": "other",
                              "client_id": cid, "notify_days": [3], "sent": [], "active": True, "status": "confirmed", "source": "manual",
                              "notify_client": True, "client_message": "Ciao test", "created_at": "2026-01-01"})
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    logs = []
    for _ in range(30):
        time.sleep(2)
        logs = list(mdb.email_log.find({"user_id": uid, "kind": "client_reminder", "client_id": cid}, {"_id": 0}))
        if logs:
            break
    time.sleep(2)
    logs = list(mdb.email_log.find({"user_id": uid, "kind": "client_reminder", "client_id": cid}, {"_id": 0}))
    assert len(logs) == 1, logs
    assert logs[0]["status"] == "skipped_reserved_domain" and logs[0]["subject"] == "Promemoria scadenza: TEST rem29" and logs[0]["to"] == "c@example.com"
    for _ in range(20):
        try:
            if requests.get(f"{BASE}/api/", timeout=5).status_code < 500:
                break
        except Exception:
            pass
        time.sleep(2)
    e = requests.get(W(f"/clients/{cid}/emails"), headers=u["h"]).json()["emails"]
    assert len(e) == 1 and e[0]["kind"] == "Avviso scadenza" and e[0]["status_label"] == "Non inviata (indirizzo di prova)"
    mdb.reminders.delete_one({"reminder_id": rid})
