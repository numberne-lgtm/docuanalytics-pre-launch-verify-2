# Iteration 28: client email + report send, weekly digest settings/preview/cron, client deadline reminders (email_log based, no real sends)
import os, sys, uuid, time, subprocess
from datetime import datetime, timedelta, timezone
import pytest, requests, yaml
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SECRET = os.environ["WEBHOOK_CRON_SECRET"]
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
sys.path.insert(0, "/app/backend")
from workspace import core  # noqa: E402

RUN_IDS = []


def W(p):
    return f"{BASE}/api/workspace{p}"


def _reg(tag="it28"):
    email = f"test_{tag}_{uuid.uuid4().hex[:8]}@example.com"
    d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": "TEST it28"}).json()
    return {"uid": d["user"]["user_id"], "email": email, "h": {"Authorization": f"Bearer {d['token']}"}}


def _cleanup(a):
    for c in ("analyses", "reminders", "clients", "email_log"):
        mdb[c].delete_many({"user_id": a["uid"]})
    mdb.users.delete_one({"user_id": a["uid"]})


@pytest.fixture(scope="module")
def u():
    a = _reg(); yield a; _cleanup(a)


@pytest.fixture(scope="module")
def other():
    a = _reg(); yield a; _cleanup(a)


@pytest.fixture(scope="module", autouse=True)
def _cron_cleanup():
    yield
    mdb.cron_runs.delete_many({"run_id": {"$in": RUN_IDS}})


def _log(uid, kind):
    return list(mdb.email_log.find({"user_id": uid, "kind": kind}, {"_id": 0}))


# --- client email field
def test_client_email_validation_and_clear(u):
    assert requests.post(W("/clients"), headers=u["h"], json={"name": "TEST Bad", "email": "nope"}).status_code == 400
    c = requests.post(W("/clients"), headers=u["h"], json={"name": "TEST Rossi Srl", "email": "Cliente@Example.com"}).json()
    assert c["email"] == "cliente@example.com"
    cid = c["client_id"]
    assert requests.patch(W(f"/clients/{cid}"), headers=u["h"], json={"email": "x@y"}).status_code == 400
    due = (datetime.now(timezone.utc).date() + timedelta(days=20)).isoformat()
    d = requests.post(W("/deadlines"), headers=u["h"], json={"label": "TEST F24", "due_date": due, "client_id": cid, "notify_days": [3], "notify_client": True}).json()
    assert d["notify_client"] is True
    assert requests.patch(W(f"/clients/{cid}"), headers=u["h"], json={"email": ""}).status_code == 200
    assert mdb.reminders.find_one({"reminder_id": d["reminder_id"]})["notify_client"] is False
    assert requests.get(W(f"/clients/{cid}"), headers=u["h"]).json()["client"]["email"] == ""
    mdb.clients.delete_one({"client_id": cid}); mdb.reminders.delete_one({"reminder_id": d["reminder_id"]})


# --- notify_client requires client
def test_notify_client_without_client_400(u):
    due = (datetime.now(timezone.utc).date() + timedelta(days=20)).isoformat()
    d = requests.post(W("/deadlines"), headers=u["h"], json={"label": "TEST nocli", "due_date": due, "notify_client": True}).json()
    assert d["notify_client"] is False
    r = requests.patch(W(f"/deadlines/{d['reminder_id']}"), headers=u["h"], json={"notify_client": True})
    assert r.status_code == 400 and "cliente" in r.json()["detail"]


# --- report send
def test_report_send_reserved_auth_rate(u, other):
    cid = requests.post(W("/clients"), headers=u["h"], json={"name": "TEST Report Spa", "email": "cliente@example.com"}).json()["client_id"]
    r = requests.post(W(f"/clients/{cid}/report/send"), headers=u["h"], json={"message": "Ciao <b>x</b>"})
    assert r.status_code == 400 and r.json()["detail"] == "Indirizzo non consentito per l'invio."
    logs = _log(u["uid"], "client_report")
    assert len(logs) == 1 and logs[0]["status"] == "skipped_reserved_domain" and logs[0]["to"] == "cliente@example.com"
    assert "last_report_sent" not in mdb.clients.find_one({"client_id": cid})
    assert requests.post(W(f"/clients/{cid}/report/send"), headers=u["h"], json={"to": "bad"}).status_code == 400
    assert requests.post(W(f"/clients/{cid}/report/send"), headers=other["h"], json={}).status_code == 404
    assert requests.post(W(f"/clients/{cid}/report/send"), json={}).status_code == 401
    assert requests.post(W(f"/clients/{cid}/report/send"), headers=u["h"], json={"message": "x" * 1501}).status_code == 422
    # no email on client -> 400
    cid2 = requests.post(W("/clients"), headers=u["h"], json={"name": "TEST NoMail"}).json()["client_id"]
    r = requests.post(W(f"/clients/{cid2}/report/send"), headers=u["h"], json={})
    assert r.status_code == 400 and "email" in r.json()["detail"]
    # rate limit 20/day
    now = datetime.now(timezone.utc).isoformat()
    mdb.email_log.insert_many([{"kind": "client_report", "user_id": u["uid"], "to": "TEST@example.com", "status": "skipped_reserved_domain", "at": now} for _ in range(19)])
    r = requests.post(W(f"/clients/{cid}/report/send"), headers=u["h"], json={})
    assert r.status_code == 429
    mdb.email_log.delete_many({"user_id": u["uid"], "kind": "client_report"})


# --- settings + preview
def test_settings_and_preview(u):
    assert requests.get(W("/settings"), headers=u["h"]).json() == {"weekly_digest": False, "email": u["email"]}
    assert requests.put(W("/settings"), headers=u["h"], json={"weekly_digest": True}).json()["weekly_digest"] is True
    assert requests.get(W("/settings"), headers=u["h"]).json()["weekly_digest"] is True
    assert requests.put(W("/settings"), headers=u["h"], json={}).status_code == 422
    assert requests.get(W("/settings")).status_code == 401
    r = requests.post(W("/digest/preview"), headers=u["h"])
    assert r.status_code == 400 and r.json()["detail"] == "Invio non riuscito per questo indirizzo."
    assert [x["status"] for x in _log(u["uid"], "digest_preview")] == ["skipped_reserved_domain"]
    now = datetime.now(timezone.utc).isoformat()
    mdb.email_log.insert_many([{"kind": "digest_preview", "user_id": u["uid"], "to": "x", "status": "x", "at": now} for _ in range(4)])
    assert requests.post(W("/digest/preview"), headers=u["h"]).status_code == 429
    mdb.email_log.delete_many({"user_id": u["uid"], "kind": "digest_preview"})
    requests.put(W("/settings"), headers=u["h"], json={"weekly_digest": False})


# --- cron endpoint
def test_cron_weekly_digest(u, other):
    url = W("/cron/weekly-digest")
    assert requests.post(url).status_code == 401
    assert requests.post(url, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert requests.post(url, headers={"Authorization": SECRET}).status_code == 401
    requests.put(W("/settings"), headers=u["h"], json={"weekly_digest": True})
    requests.put(W("/settings"), headers=other["h"], json={"weekly_digest": False})
    mdb.email_log.delete_many({"user_id": {"$in": [u["uid"], other["uid"]]}, "kind": "weekly_digest"})
    rid = f"TEST_run_{uuid.uuid4().hex[:8]}"; RUN_IDS.append(rid)
    h = {"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": rid}
    r = requests.post(url, headers=h, json={})
    assert r.status_code == 200 and r.json() == {"accepted": True, "duplicate": False}
    time.sleep(4)
    assert mdb.cron_runs.find_one({"run_id": rid}).get("done_at")
    assert [x["status"] for x in _log(u["uid"], "weekly_digest")] == ["skipped_reserved_domain"]
    assert _log(other["uid"], "weekly_digest") == []
    assert mdb.users.find_one({"user_id": u["uid"]})["last_digest_week"] == datetime.now(timezone.utc).strftime("%G-W%V")
    r = requests.post(url, headers=h, json={})
    assert r.json() == {"accepted": True, "duplicate": True}
    rid2 = f"TEST_run_{uuid.uuid4().hex[:8]}"; RUN_IDS.append(rid2)
    assert requests.post(url, headers={"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": rid2}).json()["duplicate"] is False
    time.sleep(3)
    assert len(_log(u["uid"], "weekly_digest")) == 1
    # non-JSON / list body
    rid3 = f"TEST_run_{uuid.uuid4().hex[:8]}"; RUN_IDS.append(rid3)
    assert requests.post(url, headers={"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": rid3}, json=[1]).status_code == 400
    requests.put(W("/settings"), headers=u["h"], json={"weekly_digest": False})


# --- crons.yml
def test_crons_yml():
    y = yaml.safe_load(open("/app/.emergent/crons.yml"))
    assert len(y["crons"]) == 1
    c = y["crons"][0]
    assert (c["name"], c["cron"], c["timezone"], c["method"]) == ("weekly-digest", "0 8 * * 1", "Europe/Rome", "POST")
    assert c["endpoint"] == "{{BASE_URL}}/api/workspace/cron/weekly-digest"


# --- digest html builder
def test_digest_html_sections():
    today = datetime.now(timezone.utc).date()
    week = [{"due_date": (today + timedelta(days=3)).isoformat(), "label": "F24 <IVA>", "client_id": "c1", "status": "confirmed"}]
    over = [{"due_date": (today - timedelta(days=2)).isoformat(), "label": "Rata", "client_id": None, "status": "confirmed"}]
    unsure = [{"due_date": None, "label": "x", "status": "to_verify"}]
    docs = [{"risk_level": "high", "doc_type": "Contratto", "filename": "a.pdf", "flags": [{"message": "Firma mancante"}]}]
    h = core.digest_html(week, over, unsure, docs, 20, {"c1": "Rossi & Co"}, "https://app")
    for s in ("Scadenze dei prossimi 7 giorni (1)", "Scadenze superate (1)", "Date da verificare (1)", "Documenti da verificare (20)"):
        assert s in h
    assert "F24 &lt;IVA&gt;" in h and "Rossi &amp; Co" in h and "Firma mancante" in h and "altri 19 documenti" in h
    assert "https://app/area" in h
    e = core.digest_html([], [], [], [], 0, {}, "https://app")
    assert e.count("Nessuna.") == 4


# --- client reminder via _check_reminders on backend startup
def test_client_reminder_on_startup(u):
    uid = u["uid"]
    cid = f"TEST_cli_{uuid.uuid4().hex[:6]}"
    mdb.clients.insert_one({"client_id": cid, "user_id": uid, "name": "TEST Cli", "email": "cliente@example.com", "piva": "", "cf": ""})
    due = (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat()
    base = {"user_id": uid, "email": u["email"], "label": "TEST rem", "due_date": due, "kind": "other", "client_id": cid,
            "notify_days": [3], "sent": [], "active": True, "created_at": "2026-01-01"}
    ok_id, off_id, unconf_id = "TEST_r_ok_" + uid[:6], "TEST_r_off_" + uid[:6], "TEST_r_unc_" + uid[:6]
    mdb.reminders.insert_many([
        {**base, "reminder_id": ok_id, "status": "confirmed", "source": "manual", "notify_client": True},
        {**base, "reminder_id": off_id, "status": "confirmed", "source": "manual", "notify_client": False},
        {**base, "reminder_id": unconf_id, "status": "to_verify", "source": "auto", "notify_days": [], "notify_pref": [3], "notify_client": True},
    ])
    mdb.email_log.delete_many({"user_id": uid, "kind": "client_reminder"})
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    for _ in range(30):
        time.sleep(2)
        try:
            if requests.get(f"{BASE}/api/", timeout=5).status_code < 500 and _log(uid, "client_reminder"):
                break
        except Exception:
            pass
    time.sleep(2)
    logs = _log(uid, "client_reminder")
    assert len(logs) == 1, logs
    assert logs[0]["to"] == "cliente@example.com" and logs[0]["status"] == "skipped_reserved_domain"
    r = mdb.reminders.find_one({"reminder_id": ok_id})
    assert r.get("sent_client", []) == []
    mdb.reminders.delete_many({"reminder_id": {"$in": [ok_id, off_id, unconf_id]}})
    mdb.clients.delete_one({"client_id": cid})
