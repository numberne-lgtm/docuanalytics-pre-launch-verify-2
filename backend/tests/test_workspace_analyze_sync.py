# Workspace: real /api/analyze (1 LLM call) -> appears in /api/workspace/documents with ws sync + auto-link by P.IVA
import os, io, base64, uuid, time
import requests
from PIL import Image, ImageDraw
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _png():
    im = Image.new("RGB", (900, 700), "white")
    d = ImageDraw.Draw(im)
    lines = ["FATTURA N. 77 del 10/10/2026", "Fornitore: Beta Servizi Srl  P.IVA 11122233344",
             "Cliente: Gamma Test SRL  P.IVA 55566677788", "Descrizione: consulenza  imponibile 1.000,00",
             "IVA 22% 220,00   Totale 1.220,00 EUR", "Data scadenza pagamento: 30/11/2026", "IBAN IT60X0542811101000000123456"]
    for i, l in enumerate(lines):
        d.text((40, 40 + i * 60), l, fill="black")
    im = im.resize((1800, 1400))
    b = io.BytesIO(); im.save(b, "PNG")
    return base64.b64encode(b.getvalue()).decode()


def test_analyze_then_workspace_sync():
    email = f"test_wsan_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345"})
    assert r.status_code == 200, r.text
    tok, uid = r.json()["token"], r.json()["user"]["user_id"]
    H = {"Authorization": f"Bearer {tok}"}
    try:
        c = requests.post(f"{BASE}/api/workspace/clients", json={"name": "Gamma Test SRL", "piva": "IT55566677788"}, headers=H)
        assert c.status_code == 200, c.text
        cid = c.json()["client_id"]
        t0 = time.time()
        a = requests.post(f"{BASE}/api/analyze", json={"user_id": uid, "filename": "TEST_fattura.png", "mime_type": "image/png",
                                                     "file_base64": _png()}, headers=H, timeout=180)
        print("analyze", a.status_code, round(time.time() - t0, 1), "s", a.text[:300])
        assert a.status_code == 200, a.text
        ov = requests.get(f"{BASE}/api/workspace/overview", headers=H).json()
        print("overview counts", ov["counts"])
        docs = requests.get(f"{BASE}/api/workspace/documents", headers=H).json()["documents"]
        assert len(docs) == 1
        d = docs[0]
        print("doc", d)
        an = mdb.analyses.find_one({"analysis_id": d["analysis_id"]}, {"_id": 0, "ws_synced": 1, "client_id": 1, "result.structured": 1})
        print("db", an)
        assert an.get("ws_synced") is True
        assert d["client_id"] == cid, "auto-link by P.IVA failed"
        assert d["client_link"] == "auto"
        dl = requests.get(f"{BASE}/api/workspace/deadlines", headers=H).json()["buckets"]
        print("deadlines", {k: [(x["label"], x["due_date"], x["status"]) for x in v] for k, v in dl.items() if v})
    finally:
        mdb.analyses.delete_many({"user_id": uid}); mdb.reminders.delete_many({"user_id": uid})
        mdb.clients.delete_many({"user_id": uid}); mdb.users.delete_one({"user_id": uid})
