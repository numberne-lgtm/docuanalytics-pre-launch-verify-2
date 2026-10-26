# Seed/cleanup for iteration 29 UI test (studio signature/logo, client email history, deadline client message). Usage: python seed_iter29_ui.py seed|clean
import os, sys, json, uuid, requests
from pymongo import MongoClient
from dotenv import load_dotenv
sys.path.insert(0, os.path.dirname(__file__))
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
F = "/tmp/iter29.json"

if sys.argv[1] == "seed":
    from test_studio_signature_email_log import png_bytes
    open("/tmp/logo29.png", "wb").write(png_bytes(40, 20))
    open("/tmp/fake29.png", "wb").write(b"this is not a png")
    email = f"test_iter29_{uuid.uuid4().hex[:8]}@example.com"
    d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": "TEST iter29"}).json()
    uid, h = d["user"]["user_id"], {"Authorization": f"Bearer {d['token']}"}
    W = lambda p: f"{BASE}/api/workspace{p}"
    c = requests.post(W("/clients"), json={"name": "Rossi SRL", "piva": "22222222222", "email": "cliente@example.com"}, headers=h).json()
    c2 = requests.post(W("/clients"), json={"name": "Bianchi Spa", "piva": "33333333333"}, headers=h).json()
    d1 = requests.post(W("/deadlines"), json={"label": "TEST_ROSSI_F24", "due_date": "2026-12-15", "client_id": c["client_id"], "notify_days": [3]}, headers=h).json()
    u = {"email": email, "token": d["token"], "uid": uid, "cid": c["client_id"], "cid2": c2["client_id"], "d1": d1["reminder_id"]}
    json.dump(u, open(F, "w")); print(json.dumps(u))
else:
    u = json.load(open(F))
    for col in ("analyses", "reminders", "clients", "email_log", "files"):
        mdb[col].delete_many({"user_id": u["uid"]})
    mdb.users.delete_one({"user_id": u["uid"]}); print("cleaned")
