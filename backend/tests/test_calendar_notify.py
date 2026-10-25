# Iteration 26: per-deadline notify_days, auto-deadline notify_pref/confirm flow, ICS export, private calendar feed, clean_tech/field_label
import os, sys, re, uuid, hashlib
import pytest, requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
sys.path.insert(0, "/app/backend")
from workspace import core  # noqa: E402

CTR = lambda exp, name, piva: {"category": "contract", "doc_type": "Contratto", "summary": "TEST",
    "structured": {"parties": [{"name": name, "role": "Fornitore", "piva_cf": piva}], "effective_date": "01/01/2025",
                   "expiration_date": exp, "reminders": [{"label": "Termine di recesso", "date": "entro 30 giorni dalla disdetta"}]},
    "fields": [], "audit": []}


def _reg():
    email = f"test_it26_{uuid.uuid4().hex[:8]}@example.com"
    d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": "TEST it26"}).json()
    return {"uid": d["user"]["user_id"], "h": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def u():
    a = _reg()
    mdb.analyses.insert_one({"analysis_id": f"TEST_{uuid.uuid4()}", "user_id": a["uid"], "filename": "TEST_c1.pdf",
                             "created_at": "2026-01-01T10:00:00+00:00", "result": CTR("01/12/2026", "Verdi Spa", "33333333333")})
    yield a
    for c in ("analyses", "reminders", "clients", "multi_document_audits"):
        mdb[c].delete_many({"user_id": a["uid"]})
    mdb.users.delete_one({"user_id": a["uid"]})


@pytest.fixture(scope="module")
def other():
    a = _reg()
    yield a
    mdb.users.delete_one({"user_id": a["uid"]})


def W(p):
    return f"{BASE}/api/workspace{p}"


def _all(u):
    b = requests.get(W("/deadlines"), headers=u["h"]).json()["buckets"]
    return [x for v in b.values() for x in v]


# --- manual deadline notify_days
def test_manual_notify_and_legacy_list(u):
    r = requests.post(W("/deadlines"), headers=u["h"], json={"label": "TEST, rata; IVA", "due_date": "2026-09-10", "notify_days": [0, 15, 15]})
    assert r.status_code == 200 and r.json()["notify_days"] == [15, 0]
    rid = r.json()["reminder_id"]
    legacy = requests.get(f"{BASE}/api/reminders", headers=u["h"]).json()["reminders"]
    assert [x["notify_days"] for x in legacy if x["reminder_id"] == rid] == [[15, 0]]
    assert requests.post(W("/deadlines"), headers=u["h"], json={"label": "x", "due_date": "2026-09-10", "notify_days": [5]}).status_code == 400
    assert requests.patch(W(f"/deadlines/{rid}"), headers=u["h"], json={"notify_days": [-1]}).status_code == 400
    p = requests.patch(W(f"/deadlines/{rid}"), headers=u["h"], json={"notify_days": []})
    assert p.status_code == 200 and p.json()["notify_days"] == []


# --- auto deadline: notify_pref then confirm
def test_auto_deadline_pref_and_confirm(u):
    autos = [x for x in _all(u) if x["source"] == "auto"]
    det = next(x for x in autos if x["status"] == "detected")
    tv = next(x for x in autos if x["status"] == "to_verify")
    assert det["notify_days"] == []
    p = requests.patch(W(f"/deadlines/{det['reminder_id']}"), headers=u["h"], json={"notify_days": [3, 0]})
    assert p.status_code == 200 and p.json()["notify_pref"] == [3, 0] and p.json()["notify_days"] == [] and p.json()["status"] == "detected"
    legacy = requests.get(f"{BASE}/api/reminders", headers=u["h"]).json()["reminders"]
    assert det["reminder_id"] not in [x["reminder_id"] for x in legacy]
    ics = requests.get(W("/calendar.ics"), headers=u["h"]).text
    assert det["reminder_id"] not in ics
    assert requests.post(W(f"/deadlines/{det['reminder_id']}/confirm"), headers=u["h"], json={"notify": True, "notify_days": [5]}).status_code == 400
    # confirm without notify_days -> uses notify_pref
    c = requests.post(W(f"/deadlines/{det['reminder_id']}/confirm"), headers=u["h"], json={"notify": True})
    assert c.status_code == 200 and c.json()["status"] == "confirmed" and c.json()["notify_days"] == [3, 0]
    assert det["reminder_id"] in [x["reminder_id"] for x in requests.get(f"{BASE}/api/reminders", headers=u["h"]).json()["reminders"]]
    # to_verify without date -> confirm 400
    assert requests.post(W(f"/deadlines/{tv['reminder_id']}/confirm"), headers=u["h"], json={"notify": True}).status_code == 400


# --- ICS
def test_ics_content(u):
    r = requests.get(W("/calendar.ics"), headers=u["h"])
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/calendar")
    assert "docuanalytics-scadenze.ics" in r.headers.get("content-disposition", "")
    t = r.text
    assert t.startswith("BEGIN:VCALENDAR\r\n") and t.endswith("END:VCALENDAR\r\n")
    assert "DTSTART;VALUE=DATE:20260910" in t and "DTEND;VALUE=DATE:20260911" in t
    assert "SUMMARY:TEST\\, rata\\; IVA" in t
    assert t.count("BEGIN:VEVENT") == 2  # manual + confirmed auto; to_verify excluded
    assert all(len(l.encode()) <= 75 for l in t.split("\r\n"))
    assert requests.get(W("/calendar.ics")).status_code == 401


# --- feed
def test_feed_lifecycle(u, other):
    assert requests.get(W("/calendar/feed"), headers=u["h"]).json()["active"] is False
    t1 = requests.post(W("/calendar/feed"), headers=u["h"]).json()["token"]
    assert len(t1) == 43
    doc = mdb.users.find_one({"user_id": u["uid"]})["calendar_feed"]
    assert doc["hash"] == hashlib.sha256(t1.encode()).hexdigest() and t1 not in str(doc)
    f = requests.get(W(f"/feed/{t1}.ics"))
    assert f.status_code == 200 and "BEGIN:VEVENT" in f.text
    t2 = requests.post(W("/calendar/feed"), headers=u["h"]).json()["token"]
    assert requests.get(W(f"/feed/{t1}.ics")).status_code == 404
    assert requests.get(W(f"/feed/{t2}.ics")).status_code == 200
    to = requests.post(W("/calendar/feed"), headers=other["h"]).json()["token"]
    fo = requests.get(W(f"/feed/{to}.ics")).text
    assert "BEGIN:VEVENT" not in fo  # other user's feed shows only own (none)
    assert requests.get(W(f"/feed/{'A' * 43}.ics")).status_code == 404
    assert requests.delete(W("/calendar/feed"), headers=u["h"]).json()["active"] is False
    assert requests.get(W(f"/feed/{t2}.ics")).status_code == 404


# --- core unit checks
@pytest.mark.parametrize("src,bad", [
    ('"expiration_date": "01/12/2026"', ["expiration_date", '"', "{"]),
    ("Il campo parties[0].name differisce", ["parties[0]", "["]),
    ('{"due_date":"10/10/2026"}', ["due_date", "{", "}"]),
    ("totals.totale diverso; vat_lines[1].aliquota", ["totals.totale", "vat_lines", "["]),
    ("unknown_field_x vale 3", ["unknown_field_x"]),
])
def test_clean_tech(src, bad):
    out = core.clean_tech(src)
    print(repr(src), "->", repr(out))
    for b in bad:
        assert b not in out


def test_clean_tech_keeps_prose():
    s = "Il contratto scade il 01.12.2026, v. art. 3. Importo 1.000,00 euro. www.example.it"
    out = core.clean_tech(s)
    print(repr(out))
    assert "01.12.2026" in out and "1.000,00" in out


def test_field_label():
    assert core.field_label("parties[0].name") == "Parte 1 › Nome"
    assert core.field_label("expiration_date") == "Data di scadenza"
    assert core.field_label("foo_bar") == "Foo bar"
