# FASE 1 final smoke: Cliente 360, Risk Dashboard, Scadenze, Multi-Doc Audit, deep-audit credits, isolation, legacy regression
import os, io, json, time, uuid, base64, asyncio
import concurrent.futures as cf
import pytest
from datetime import date, timedelta
D20 = (date.today() + timedelta(days=20))
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WS = f"{BASE}/api/workspace"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEEP = os.environ.get("KEEP_SMOKE_DATA") == "1"   # keep user A data for UI testing
REAL_AI = os.environ.get("SMOKE_REAL_AI", "1") == "1"


def H(t):
    return {"Authorization": f"Bearer {t}"}


def register(prefix):
    email = f"test_{prefix.lower()}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": f"TEST {prefix}"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "password": "Test12345", "token": d["token"], "uid": d["user"]["user_id"]}


def _an(uid, name, created, result):
    aid = f"TEST_{uuid.uuid4()}"
    mdb.analyses.insert_one({"analysis_id": aid, "user_id": uid, "filename": name, "created_at": created, "result": result})
    return aid


@pytest.fixture(scope="module")
def A():
    u = register("smokeA")
    uid = u["uid"]
    mdb.users.update_one({"user_id": uid}, {"$set": {"credits": 5}})
    inv = lambda tot, audit, scad: {"category": "invoice", "doc_type": "Fattura", "summary": "TEST fattura",
                                   "structured": {"supplier": {"name": "Beta Servizi Srl", "piva": "11111111111"},
                                                  "customer": {"name": "Rossi SRL", "piva": "IT22222222222"}, "total": tot},
                                   "fields": [{"label": "Data scadenza pagamento", "value": scad}], "audit": audit}
    u["inv1"] = _an(uid, "TEST_fatt1.pdf", "2026-01-01T10:00:00+00:00", inv("1.220,00", [{"level": "ok", "message": "ok"}], D20.strftime("%d/%m/%Y")))
    u["inv2"] = _an(uid, "TEST_fatt2.pdf", "2026-01-02T10:00:00+00:00",
                    inv("1.500,00", [{"level": "warning", "message": "IVA da verificare"}], "entro il 10/04/2027 circa"))
    u["ctr"] = _an(uid, "TEST_contratto.pdf", "2026-01-03T10:00:00+00:00",
                   {"category": "contract", "doc_type": "Contratto", "summary": "TEST contratto",
                    "structured": {"parties": [{"name": "Verdi Spa", "role": "Fornitore", "piva_cf": "33333333333"}],
                                   "effective_date": "01/01/2025", "expiration_date": "01/12/2025",
                                   "reminders": [{"label": "Termine di recesso", "date": "entro 30 giorni dalla disdetta"}]},
                    "fields": [], "audit": [{"level": "error", "message": "Clausola penale anomala"}]})
    yield u
    if KEEP:
        json.dump(u, open("/tmp/smoke_A.json", "w"))
        return
    for c in ("analyses", "reminders", "clients", "multi_document_audits"):
        mdb[c].delete_many({"user_id": uid})
    mdb.users.delete_one({"user_id": uid})


@pytest.fixture(scope="module")
def B():
    u = register("smokeB")
    mdb.users.update_one({"user_id": u["uid"]}, {"$set": {"credits": 0}})
    u["b1"] = _an(u["uid"], "TEST_b1.pdf", "2026-01-01T00:00:00+00:00", {"category": "invoice", "structured": {"total": "1"}, "fields": [], "audit": []})
    u["b2"] = _an(u["uid"], "TEST_b2.pdf", "2026-01-02T00:00:00+00:00", {"category": "invoice", "structured": {"total": "2"}, "fields": [], "audit": []})
    yield u
    for c in ("analyses", "reminders", "clients", "multi_document_audits"):
        mdb[c].delete_many({"user_id": u["uid"]})
    mdb.users.delete_one({"user_id": u["uid"]})


def deadlines_all(tok):
    b = requests.get(f"{WS}/deadlines", headers=H(tok)).json()["buckets"]
    return b, [x for v in b.values() for x in v]


# --- Risk dashboard + auto deadlines ---
class TestDashboard:
    def test_overview_counts_consistent_and_deterministic(self, A):
        t0 = time.time(); ov = requests.get(f"{WS}/overview", headers=H(A["token"])); print("overview", round(time.time() - t0, 2), "s")
        assert ov.status_code == 200
        ov = ov.json(); c = ov["counts"]
        docs = requests.get(f"{WS}/documents", headers=H(A["token"])).json()["documents"]
        lv = {d["analysis_id"]: d["risk_level"] for d in docs}
        assert lv == {A["inv1"]: "low", A["inv2"]: "medium", A["ctr"]: "high"}
        b, _ = deadlines_all(A["token"])
        assert c["documents"] == len(docs) == 3 and c["no_issues"] == 1 and c["to_verify"] == 1 and c["high"] == 1
        assert c["upcoming"] == len(b["today"]) + len(b["next7"]) + len(b["next30"])
        assert c["overdue"] == len(b["overdue"]) == 1
        assert c["deadlines_to_verify"] == len(b["to_verify"]) == 2
        ov2 = requests.get(f"{WS}/overview", headers=H(A["token"])).json()
        assert ov2 == ov, "overview not deterministic"

    def test_priorities_sorted(self, A):
        pr = requests.get(f"{WS}/overview", headers=H(A["token"])).json()["priorities"]
        order = {"high": 0, "medium": 1, "low": 2}
        keys = [(order[p["level"]], p["days_left"] if p["days_left"] is not None else 9999) for p in pr]
        assert keys == sorted(keys)
        assert pr[0]["level"] == "high"
        assert any(p["type"] == "document" and p["analysis_id"] == A["ctr"] for p in pr)

    def test_auto_deadline_statuses(self, A):
        _, al = deadlines_all(A["token"])
        auto = {x["analysis_id"] + "|" + x["kind"]: x for x in al if x["source"] == "auto"}
        p1 = next(x for x in al if x["analysis_id"] == A["inv1"])
        assert p1["status"] == "detected" and p1["due_date"] == D20.isoformat()
        p2 = next(x for x in al if x["analysis_id"] == A["inv2"])
        assert p2["status"] == "to_verify"
        rec = next(x for x in al if x["analysis_id"] == A["ctr"] and x["kind"] == "withdrawal")
        assert rec["status"] == "to_verify" and rec["due_date"] in (None, "")
        assert len(auto) == 4  # inv1, inv2, contract validity, contract withdrawal


# --- Scadenze: legacy reminders + email eligibility ---
class TestDeadlines:
    def test_unconfirmed_auto_not_in_legacy_nor_email(self, A):
        _, al = deadlines_all(A["token"])
        auto_ids = {x["reminder_id"] for x in al if x["source"] == "auto"}
        leg = requests.get(f"{BASE}/api/reminders", headers=H(A["token"])).json()["reminders"]
        assert not auto_ids & {x["reminder_id"] for x in leg}
        for r in mdb.reminders.find({"reminder_id": {"$in": list(auto_ids)}}):
            assert r["notify_days"] == [], "unconfirmed auto deadline eligible for email"

    def test_confirm_without_date_400_then_edit_confirm(self, A):
        _, al = deadlines_all(A["token"])
        rec = next(x for x in al if x["analysis_id"] == A["ctr"] and x["kind"] == "withdrawal")
        rid = rec["reminder_id"]
        r = requests.post(f"{WS}/deadlines/{rid}/confirm", json={"notify": True}, headers=H(A["token"]))
        assert r.status_code == 400
        r = requests.patch(f"{WS}/deadlines/{rid}", json={"due_date": "2027-09-30", "label": "TEST recesso"}, headers=H(A["token"]))
        assert r.status_code == 200 and r.json()["due_date"] == "2027-09-30" and r.json()["label"] == "TEST recesso"
        assert requests.patch(f"{WS}/deadlines/{rid}", json={"due_date": "boh"}, headers=H(A["token"])).status_code == 400
        assert rid not in {x["reminder_id"] for x in requests.get(f"{BASE}/api/reminders", headers=H(A["token"])).json()["reminders"]}
        r = requests.post(f"{WS}/deadlines/{rid}/confirm", json={"notify": True}, headers=H(A["token"]))
        assert r.status_code == 200 and r.json()["status"] == "confirmed"
        assert len(mdb.reminders.find_one({"reminder_id": rid})["notify_days"]) > 0
        assert rid in {x["reminder_id"] for x in requests.get(f"{BASE}/api/reminders", headers=H(A["token"])).json()["reminders"]}

    def test_manual_create_link_delete(self, A):
        cl = requests.post(f"{WS}/clients", json={"name": "TEST Manuale Srl"}, headers=H(A["token"])).json()
        r = requests.post(f"{WS}/deadlines", json={"label": "TEST manuale", "due_date": "2027-06-30", "analysis_id": A["ctr"], "client_id": cl["client_id"]}, headers=H(A["token"]))
        assert r.status_code == 200 and r.json()["status"] == "confirmed" and r.json()["source"] == "manual"
        rid = r.json()["reminder_id"]
        assert requests.post(f"{WS}/deadlines", json={"label": "x", "due_date": "nope"}, headers=H(A["token"])).status_code == 400
        assert requests.post(f"{WS}/deadlines", json={"label": "x", "due_date": "2027-06-30", "client_id": "nope"}, headers=H(A["token"])).status_code == 404
        c360 = requests.get(f"{WS}/clients/{cl['client_id']}", headers=H(A["token"])).json()
        assert any(d["reminder_id"] == rid for d in c360["deadlines"])
        doc = requests.get(f"{WS}/documents/{A['ctr']}", headers=H(A["token"])).json()
        assert any(d["reminder_id"] == rid for d in doc["deadlines"])
        assert requests.delete(f"{WS}/deadlines/{rid}", headers=H(A["token"])).status_code == 200
        _, al = deadlines_all(A["token"])
        assert rid not in {x["reminder_id"] for x in al}
        requests.delete(f"{WS}/clients/{cl['client_id']}", headers=H(A["token"]))

    def test_legacy_reminders_crud(self, A):
        r = requests.post(f"{BASE}/api/reminders", json={"user_id": A["uid"], "label": "TEST legacy", "due_date": "2027-03-01"}, headers=H(A["token"]))
        assert r.status_code == 200, r.text
        rid = r.json()["reminder_id"]
        assert rid in {x["reminder_id"] for x in requests.get(f"{BASE}/api/reminders", headers=H(A["token"])).json()["reminders"]}
        assert requests.delete(f"{BASE}/api/reminders/{rid}", headers=H(A["token"])).status_code == 200
        assert rid not in {x["reminder_id"] for x in requests.get(f"{BASE}/api/reminders", headers=H(A["token"])).json()["reminders"]}


# --- Cliente 360 ---
class TestClients:
    def test_no_autolink_on_different_or_name_only(self, A):
        r = requests.post(f"{WS}/clients", json={"name": "Verdi Spa", "piva": "33333333334"}, headers=H(A["token"]))
        assert r.status_code == 200
        cid = r.json()["client_id"]
        r2 = requests.post(f"{WS}/clients", json={"name": "Beta Servizi Srl"}, headers=H(A["token"]))  # name-only
        assert r2.status_code == 200
        docs = requests.get(f"{WS}/documents", headers=H(A["token"])).json()["documents"]
        assert all(d["client_id"] is None for d in docs), docs
        requests.delete(f"{WS}/clients/{cid}", headers=H(A["token"]))
        requests.delete(f"{WS}/clients/{r2.json()['client_id']}", headers=H(A["token"]))

    def test_exact_piva_autolink_and_duplicate(self, A):
        r = requests.post(f"{WS}/clients", json={"name": "Rossi SRL", "piva": "IT 22222222222", "cf": "RSSMRA80A01H501U"}, headers=H(A["token"]))
        assert r.status_code == 200, r.text
        c = r.json(); A["rossi"] = c["client_id"]
        assert c["piva"] == "22222222222" and c["cf"] == "RSSMRA80A01H501U"
        assert requests.post(f"{WS}/clients", json={"name": "Altro", "piva": "22222222222"}, headers=H(A["token"])).status_code == 409
        assert requests.post(f"{WS}/clients", json={"name": "Altro", "cf": "rssmra80a01h501u"}, headers=H(A["token"])).status_code == 409
        docs = {d["analysis_id"]: d for d in requests.get(f"{WS}/documents", headers=H(A["token"])).json()["documents"]}
        assert docs[A["inv1"]]["client_id"] == c["client_id"] and docs[A["inv1"]]["client_link"] == "auto"
        assert docs[A["inv2"]]["client_id"] == c["client_id"]
        assert docs[A["ctr"]]["client_id"] is None
        c360 = requests.get(f"{WS}/clients/{c['client_id']}", headers=H(A["token"])).json()
        assert {d["analysis_id"] for d in c360["documents"]} == {A["inv1"], A["inv2"]}
        assert c360["client"]["name"] == "Rossi SRL"

    def test_nested_structured_autolink(self, A):
        """Regression: AI sometimes returns structured={"invoice": {...}} -> must still auto-link (fixed in core.structured)."""
        aid = _an(A["uid"], "TEST_nested.pdf", "2026-01-04T10:00:00+00:00",
                  {"category": "invoice", "doc_type": "Fattura", "structured": {"invoice": {"customer": {"name": "Rossi SRL", "piva": "22222222222"}}},
                   "fields": [], "audit": []})
        requests.get(f"{WS}/overview", headers=H(A["token"]))
        d = requests.get(f"{WS}/documents/{aid}", headers=H(A["token"])).json()
        mdb.analyses.delete_one({"analysis_id": aid})
        assert d["client_id"] == A["rossi"] and d["client_link"] == "auto"

    def test_manual_assign_unassign_keeps_history(self, A):
        cid = A["rossi"]
        assert requests.post(f"{WS}/documents/{A['ctr']}/assign", json={"client_id": cid}, headers=H(A["token"])).status_code == 200
        c360 = requests.get(f"{WS}/clients/{cid}", headers=H(A["token"])).json()
        assert A["ctr"] in {d["analysis_id"] for d in c360["documents"]}
        assert requests.post(f"{WS}/documents/{A['ctr']}/assign", json={"client_id": None}, headers=H(A["token"])).status_code == 200
        requests.post(f"{WS}/sync", headers=H(A["token"]))
        c360 = requests.get(f"{WS}/clients/{cid}", headers=H(A["token"])).json()
        assert A["ctr"] not in {d["analysis_id"] for d in c360["documents"]}
        hist = requests.get(f"{BASE}/api/analyses", params={"user_id": A["uid"]}, headers=H(A["token"])).json()
        items = hist.get("items") or hist.get("analyses") or hist
        assert A["ctr"] in json.dumps(items)
        # unassign of auto-linked doc must not be re-linked by sync
        requests.post(f"{WS}/documents/{A['inv2']}/assign", json={"client_id": None}, headers=H(A["token"]))
        requests.get(f"{WS}/overview", headers=H(A["token"]))
        d = requests.get(f"{WS}/documents/{A['inv2']}", headers=H(A["token"])).json()
        assert d["client_id"] is None
        requests.post(f"{WS}/documents/{A['inv2']}/assign", json={"client_id": cid}, headers=H(A["token"]))

    def test_delete_client_keeps_docs_and_deadlines(self, A):
        c = requests.post(f"{WS}/clients", json={"name": "TEST Delete Srl", "piva": "44444444444"}, headers=H(A["token"])).json()
        requests.post(f"{WS}/documents/{A['ctr']}/assign", json={"client_id": c["client_id"]}, headers=H(A["token"]))
        _, al = deadlines_all(A["token"])
        assert any(x["analysis_id"] == A["ctr"] and x["client_id"] == c["client_id"] for x in al)
        assert requests.delete(f"{WS}/clients/{c['client_id']}", headers=H(A["token"])).status_code == 200
        assert requests.get(f"{WS}/clients/{c['client_id']}", headers=H(A["token"])).status_code == 404
        d = requests.get(f"{WS}/documents/{A['ctr']}", headers=H(A["token"]))
        assert d.status_code == 200 and d.json()["client_id"] is None
        _, al = deadlines_all(A["token"])
        ctr_dl = [x for x in al if x["analysis_id"] == A["ctr"]]
        assert ctr_dl and all(x["client_id"] is None for x in ctr_dl)


# --- Multi-Document Audit (deterministic) ---
class TestAudit:
    def test_audit_2_and_3_docs(self, A):
        for ids, refs in (([A["inv1"], A["inv2"]], {"Documento A", "Documento B"}),
                          ([A["inv1"], A["inv2"], A["ctr"]], {"Documento A", "Documento B", "Documento C"})):
            r = requests.post(f"{WS}/audits", json={"analysis_ids": ids}, headers=H(A["token"]))
            assert r.status_code == 200, r.text
            a = r.json()
            assert {d["ref"] for d in a["documents"]} == refs
            det = a["deterministic"]
            assert set(det) == {"consistent", "differences", "anomalies", "to_verify"}
            assert det["differences"] and det["consistent"]
            txt = json.dumps(det).lower()
            assert "pagina" not in txt and '"page"' not in txt
            for sec in det.values():
                for it in sec:
                    for v in it.get("values", []):
                        assert v["ref"] in refs
        assert requests.post(f"{WS}/audits", json={"analysis_ids": [A["inv1"], A["inv1"]]}, headers=H(A["token"])).status_code == 400
        assert requests.post(f"{WS}/audits", json={"analysis_ids": [A["inv1"]]}, headers=H(A["token"])).status_code == 422


# --- Isolation ---
class TestIsolation:
    def test_b_cannot_touch_a(self, A, B):
        tb, ta = H(B["token"]), H(A["token"])
        cid = A.get("rossi") or requests.get(f"{WS}/clients", headers=ta).json()["clients"][0]["client_id"]
        _, al = deadlines_all(A["token"])
        rid = al[0]["reminder_id"]
        aud = requests.post(f"{WS}/audits", json={"analysis_ids": [A["inv1"], A["inv2"]]}, headers=ta).json()["audit_id"]
        calls = [("get", f"/documents/{A['inv1']}", None), ("get", f"/documents/{A['inv1']}/candidates", None),
                 ("post", f"/documents/{A['inv1']}/assign", {"client_id": None}), ("get", f"/clients/{cid}", None),
                 ("patch", f"/clients/{cid}", {"name": "HACK"}), ("delete", f"/clients/{cid}", None),
                 ("patch", f"/deadlines/{rid}", {"label": "HACK"}), ("post", f"/deadlines/{rid}/confirm", {"notify": True}),
                 ("delete", f"/deadlines/{rid}", None), ("get", f"/audits/{aud}", None), ("post", f"/audits/{aud}/deep", None),
                 ("post", "/audits", {"analysis_ids": [A["inv1"], A["inv2"]]}),
                 ("post", f"/documents/{B['b1']}/assign", {"client_id": cid}),
                 ("post", "/deadlines", {"label": "x", "due_date": "2026-05-01", "analysis_id": A["inv1"]})]
        bad = []
        for m, p, body in calls:
            r = getattr(requests, m)(f"{WS}{p}", headers=tb, **({"json": body} if body is not None else {}))
            if r.status_code not in (403, 404):
                bad.append((m, p, r.status_code))
        assert not bad, bad
        # A's data intact
        assert requests.get(f"{WS}/clients/{cid}", headers=ta).json()["client"]["name"] != "HACK"
        assert requests.get(f"{WS}/documents/{A['inv1']}", headers=ta).json()["client_id"] == cid
        # B's lists contain none of A's data
        blob = json.dumps([requests.get(f"{WS}/{x}", headers=tb).json() for x in ("documents", "clients", "deadlines", "audits", "overview")])
        assert A["inv1"] not in blob and cid not in blob and rid not in blob and "Rossi" not in blob
        # anon
        assert requests.get(f"{WS}/overview").status_code == 401


# --- Deep AI audit credits ---
class TestDeep:
    def test_zero_credits_402(self, B):
        a = requests.post(f"{WS}/audits", json={"analysis_ids": [B["b1"], B["b2"]]}, headers=H(B["token"])).json()
        r = requests.post(f"{WS}/audits/{a['audit_id']}/deep", headers=H(B["token"]))
        assert r.status_code == 402
        assert mdb.users.find_one({"user_id": B["uid"]})["credits"] == 0
        au = mdb.multi_document_audits.find_one({"audit_id": a["audit_id"]})
        assert au["deep"] is None and "deep_status" not in au

    def test_refund_on_ai_failure_inprocess(self, B):
        """In-process app with the real router; LlmChat monkeypatched to raise (no app code change, no real AI)."""
        import sys
        sys.path.insert(0, "/app/backend")
        import httpx
        from fastapi import FastAPI, HTTPException
        from motor.motor_asyncio import AsyncIOMotorClient
        import emergentintegrations.llm.chat as chatmod
        from workspace.router import build_workspace_router
        a = requests.post(f"{WS}/audits", json={"analysis_ids": [B["b1"], B["b2"]]}, headers=H(B["token"])).json()
        mdb.users.update_one({"user_id": B["uid"]}, {"$set": {"credits": 2}})

        class Boom:
            def __init__(self, *a, **k): pass
            def with_model(self, *a): return self
            async def send_message(self, *a, **k): raise RuntimeError("simulated AI failure")

        orig = chatmod.LlmChat
        chatmod.LlmChat = Boom

        async def run():
            mdb_async = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

            async def cur(req):
                return await mdb_async.users.find_one({"user_id": B["uid"]}, {"_id": 0})
            app = FastAPI()
            app.include_router(build_workspace_router(mdb_async, cur, "fake", [7, 1]))
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
                return await c.post(f"/api/workspace/audits/{a['audit_id']}/deep")
        try:
            r = asyncio.run(run())
        finally:
            chatmod.LlmChat = orig
        assert r.status_code == 503, r.text
        assert mdb.users.find_one({"user_id": B["uid"]})["credits"] == 2, "credit not refunded"
        au = mdb.multi_document_audits.find_one({"audit_id": a["audit_id"]})
        assert au["deep"] is None and "deep_status" not in au
        mdb.users.update_one({"user_id": B["uid"]}, {"$set": {"credits": 0}})

    @pytest.mark.skipif(not REAL_AI, reason="real AI disabled")
    def test_concurrent_deep_one_credit(self, A):
        a = requests.post(f"{WS}/audits", json={"analysis_ids": [A["inv1"], A["inv2"]]}, headers=H(A["token"])).json()
        before = mdb.users.find_one({"user_id": A["uid"]})["credits"]
        url = f"{WS}/audits/{a['audit_id']}/deep"
        t0 = time.time()
        with cf.ThreadPoolExecutor(2) as ex:
            rs = list(ex.map(lambda _: requests.post(url, headers=H(A["token"]), timeout=180), range(2)))
        codes = sorted(r.status_code for r in rs)
        print("deep concurrent", codes, round(time.time() - t0, 1), "s", [r.text[:400] for r in rs])
        assert codes == [200, 409], codes
        assert mdb.users.find_one({"user_id": A["uid"]})["credits"] == before - 1
        ok = next(r for r in rs if r.status_code == 200).json()
        for f in ok["deep"]["findings"]:
            assert f["sources"] and all(s["ref"] in ("Documento A", "Documento B") for s in f["sources"])
        r3 = requests.post(url, headers=H(A["token"]))
        assert r3.status_code == 200
        assert mdb.users.find_one({"user_id": A["uid"]})["credits"] == before - 1


# --- Legacy regression ---
class TestLegacy:
    def test_packages_prices(self):
        p = {x["id"]: x["amount"] for x in requests.get(f"{BASE}/api/packages").json()["packages"]}
        assert sorted(p.values()) == [19.0, 29.0, 49.0, 99.0, 149.0, 299.0]

    def test_login_me_referral(self, A):
        r = requests.post(f"{BASE}/api/auth/login", json={"email": A["email"], "password": A["password"]})
        assert r.status_code == 200 and r.json()["user"]["email"] == A["email"]
        assert requests.post(f"{BASE}/api/auth/login", json={"email": A["email"], "password": "wrongpw"}).status_code in (400, 401)
        me = requests.get(f"{BASE}/api/auth/me", headers=H(A["token"])).json()["user"]
        assert isinstance(me["credits"], int)
        ref = requests.get(f"{BASE}/api/referral/{A['uid']}", headers=H(A["token"]))
        assert ref.status_code == 200 and ref.json()["referral_code"]

    def test_checkout_session_url(self, A):
        r = requests.post(f"{BASE}/api/payments/checkout", json={"package_id": "starter", "origin_url": BASE, "user_id": A["uid"]}, headers=H(A["token"]))
        assert r.status_code == 200, r.text
        assert "url" in r.text and "stripe.com" in r.text, r.text[:300]

    @pytest.mark.skipif(not REAL_AI, reason="real AI disabled")
    def test_real_analyze_autolink(self, A):
        from PIL import Image, ImageDraw
        im = Image.new("RGB", (900, 600), "white"); d = ImageDraw.Draw(im)
        for i, l in enumerate(["FATTURA N. 12 del 05/01/2026", "Fornitore: Beta Servizi Srl  P.IVA 11111111111",
                               "Cliente: Rossi SRL  P.IVA IT22222222222", "Imponibile 1.000,00  IVA 22% 220,00  Totale 1.220,00 EUR",
                               "Data scadenza pagamento: 28/02/2026"]):
            d.text((40, 40 + i * 70), l, fill="black")
        im = im.resize((1800, 1200)); b = io.BytesIO(); im.save(b, "PNG")
        before = mdb.users.find_one({"user_id": A["uid"]})["credits"]
        t0 = time.time()
        r = requests.post(f"{BASE}/api/analyze", json={"user_id": A["uid"], "filename": "TEST_real_fattura.png", "mime_type": "image/png",
                                                       "file_base64": base64.b64encode(b.getvalue()).decode()}, headers=H(A["token"]), timeout=180)
        print("analyze", r.status_code, round(time.time() - t0, 1), "s", r.text[:300])
        assert r.status_code == 200, r.text
        aid = r.json().get("analysis_id") or (r.json().get("analysis") or {}).get("analysis_id")
        assert mdb.users.find_one({"user_id": A["uid"]})["credits"] == before - 1
        hist = json.dumps(requests.get(f"{BASE}/api/analyses", params={"user_id": A["uid"]}, headers=H(A["token"])).json())
        assert "TEST_real_fattura.png" in hist
        requests.get(f"{WS}/overview", headers=H(A["token"]))  # /area dashboard triggers sync first
        docs = requests.get(f"{WS}/documents", headers=H(A["token"])).json()["documents"]
        d = next(x for x in docs if x["filename"] == "TEST_real_fattura.png")
        print("real doc", d, "aid", aid)
        assert d["client_name"] == "Rossi SRL" and d["client_link"] == "auto"
        A["real"] = d["analysis_id"]

    def test_perf_sync_overview(self, A):
        for ep, m in (("sync", "post"), ("overview", "get"), ("deadlines", "get"), ("documents", "get")):
            t0 = time.time(); r = getattr(requests, m)(f"{WS}/{ep}", headers=H(A["token"])); dt = time.time() - t0
            print(f"PERF {ep}: {dt*1000:.0f} ms status {r.status_code}")
            assert r.status_code == 200 and dt < 5
