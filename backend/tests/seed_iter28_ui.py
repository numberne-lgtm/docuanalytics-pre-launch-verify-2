# Seed/cleanup for iteration 28 UI test (client email, send report, digest settings, client reminder toggle). Usage: python seed_iter28_ui.py seed|clean
import os, sys, json, uuid, requests
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
F = "/tmp/iter28.json"

if sys.argv[1] == "seed":
    email = f"test_iter28_{uuid.uuid4().hex[:8]}@example.com"
    d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": "TEST iter28"}).json()
    uid, h = d["user"]["user_id"], {"Authorization": f"Bearer {d['token']}"}
    W = lambda p: f"{BASE}/api/workspace{p}"
    c = requests.post(W("/clients"), json={"name": "Rossi SRL", "piva": "22222222222", "email": "cliente@example.com"}, headers=h).json()
    c2 = requests.post(W("/clients"), json={"name": "Bianchi Spa", "piva": "33333333333"}, headers=h).json()
    d1 = requests.post(W("/deadlines"), json={"label": "TEST_ROSSI_F24", "due_date": "2026-12-15", "client_id": c["client_id"], "notify_days": [3]}, headers=h).json()
    d2 = requests.post(W("/deadlines"), json={"label": "TEST_NOCLIENT", "due_date": "2026-12-20", "notify_days": [3]}, headers=h).json()
    u = {"email": email, "token": d["token"], "uid": uid, "cid": c["client_id"], "cid2": c2["client_id"], "d1": d1["reminder_id"], "d2": d2["reminder_id"]}
    json.dump(u, open(F, "w")); print(json.dumps(u))
else:
    u = json.load(open(F))
    for col in ("analyses", "reminders", "clients", "email_log"):
        mdb[col].delete_many({"user_id": u["uid"]})
    mdb.users.delete_one({"user_id": u["uid"]}); print("cleaned")
