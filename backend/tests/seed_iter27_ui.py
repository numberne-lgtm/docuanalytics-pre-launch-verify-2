# Seed/cleanup for iteration 27 UI test (client PDF report, per-client calendar export). Usage: python seed_iter27_ui.py seed|clean
import os, sys, json, uuid, requests
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
F = "/tmp/iter27.json"

if sys.argv[1] == "seed":
    email = f"test_iter27_{uuid.uuid4().hex[:8]}@example.com"
    d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": "TEST iter27"}).json()
    uid, h = d["user"]["user_id"], {"Authorization": f"Bearer {d['token']}"}
    W = lambda p: f"{BASE}/api/workspace{p}"
    c = requests.post(W("/clients"), json={"name": "Rossi SRL", "piva": "22222222222", "cf": "RSSMRA80A01H501U"}, headers=h).json()
    c2 = requests.post(W("/clients"), json={"name": "Bianchi Spa", "piva": "33333333333"}, headers=h).json()
    aid = f"TEST_{uuid.uuid4()}"
    mdb.analyses.insert_one({"analysis_id": aid, "user_id": uid, "filename": "TEST_fattura.pdf", "created_at": "2026-01-05T10:00:00+00:00",
                             "result": {"category": "Fattura", "doc_type": "Fattura TEST", "summary": "s",
                                        "structured": {"customer": {"name": "Rossi SRL", "piva": "P.IVA IT22222222222"}},
                                        "fields": [{"label": "Numero", "value": "FT-77"}], "audit": [{"level": "error", "message": "REDFLAG"}]}})
    requests.get(W("/overview"), headers=h)
    requests.post(W("/deadlines"), json={"label": "TEST_ROSSI_MANUALE", "due_date": "2026-03-15", "client_id": c["client_id"]}, headers=h)
    requests.post(W("/deadlines"), json={"label": "TEST_BIANCHI", "due_date": "2026-04-10", "client_id": c2["client_id"]}, headers=h)
    u = {"email": email, "token": d["token"], "uid": uid, "cid": c["client_id"], "aid": aid,
         "linked": mdb.analyses.find_one({"analysis_id": aid})["client_id"] == c["client_id"]}
    json.dump(u, open(F, "w")); print(json.dumps(u))
else:
    u = json.load(open(F))
    for col in ("analyses", "reminders", "clients", "multi_document_audits"):
        mdb[col].delete_many({"user_id": u["uid"]})
    mdb.users.delete_one({"user_id": u["uid"]}); print("cleaned")
