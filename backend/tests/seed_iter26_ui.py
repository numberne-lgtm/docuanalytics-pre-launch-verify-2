# Seed/cleanup for iteration 26 UI test (notify chips, auto deadline confirm, calendar export, deep audit). Usage: python seed_iter26_ui.py seed|clean
import os, sys, json, uuid, requests
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
F = "/tmp/iter26.json"

if sys.argv[1] == "seed":
    email = f"test_iter26_{uuid.uuid4().hex[:8]}@example.com"
    d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": "TEST iter26"}).json()
    uid = d["user"]["user_id"]
    mdb.users.update_one({"user_id": uid}, {"$set": {"credits": 5}})
    ctr = lambda exp, name, piva, pen: {"category": "contract", "doc_type": "Contratto di fornitura", "summary": "TEST contratto",
        "structured": {"parties": [{"name": name, "role": "Fornitore", "piva_cf": piva}, {"name": "Rossi SRL", "role": "Cliente", "piva_cf": "22222222222"}],
                       "effective_date": "01/01/2025", "expiration_date": exp, "duration": "12 mesi",
                       "penalty_clauses": [{"clause": "Penale ritardo", "description": pen}]},
        "full_text": f"Contratto di fornitura tra {name} e Rossi SRL. Decorrenza 01/01/2025. Scadenza {exp}. Penale ritardo: {pen}.",
        "fields": [], "audit": []}
    u = {"email": email, "token": d["token"], "uid": uid}
    for k, (fn, args) in {"c1": ("TEST_contratto_v1.pdf", ("01/12/2026", "Verdi Spa", "33333333333", "5% del corrispettivo")),
                          "c2": ("TEST_contratto_v2.pdf", ("01/06/2027", "Bianchi Srl", "44444444444", "10% del corrispettivo"))}.items():
        aid = f"TEST_{uuid.uuid4()}"
        mdb.analyses.insert_one({"analysis_id": aid, "user_id": uid, "filename": fn, "created_at": f"2026-01-0{1 if k == 'c1' else 2}T10:00:00+00:00", "result": ctr(*args)})
        u[k] = aid
    rid = str(uuid.uuid4())
    mdb.reminders.insert_one({"reminder_id": rid, "user_id": uid, "email": email, "analysis_id": u["c1"], "kind": "renewal",
                              "due_date": "2026-05-05", "raw_date": "circa 05/05/2026", "label": "TEST rinnovo da verificare", "doc_type": "Contratto",
                              "status": "to_verify", "source": "auto", "client_id": None, "notify_days": [], "sent": [], "active": True,
                              "created_at": "2026-01-01T00:00:00+00:00"})
    u["tv"] = rid
    json.dump(u, open(F, "w")); print(json.dumps(u))
else:
    u = json.load(open(F))
    for c in ("analyses", "reminders", "clients", "multi_document_audits"):
        mdb[c].delete_many({"user_id": u["uid"]})
    mdb.users.delete_one({"user_id": u["uid"]}); print("cleaned")
