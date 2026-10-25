# Seed/cleanup for iteration 25 UI test (credits pill, audit labels, DateField). Usage: python seed_iter25_ui.py seed|clean
import os, sys, json, uuid, requests
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
F = "/tmp/iter25.json"

def an(uid, name, created, result):
    aid = f"TEST_{uuid.uuid4()}"
    mdb.analyses.insert_one({"analysis_id": aid, "user_id": uid, "filename": name, "created_at": created, "result": result})
    return aid

if sys.argv[1] == "seed":
    email = f"test_iter25_{uuid.uuid4().hex[:8]}@example.com"
    d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345", "name": "TEST iter25"}).json()
    uid = d["user"]["user_id"]
    mdb.users.update_one({"user_id": uid}, {"$set": {"credits": 7}})
    ctr = lambda exp, name, piva, extra: {"category": "contract", "doc_type": "Contratto", "summary": "TEST contratto",
        "structured": {"parties": [{"name": name, "role": "Fornitore", "piva_cf": piva}], "effective_date": "01/01/2025",
                       "expiration_date": exp, "duration": "12 mesi", "invoice_number": extra,
                       "reminders": [{"label": "Termine di recesso", "date": "entro 30 giorni dalla disdetta"}]},
        "full_text": f"Contratto di fornitura tra {name} e Rossi SRL. Scadenza {exp}. Penale 10%.",
        "fields": [], "audit": [{"level": "ok", "message": "ok"}]}
    u = {"email": email, "password": "Test12345", "token": d["token"], "uid": uid}
    u["c1"] = an(uid, "TEST_contratto_v1.pdf", "2026-01-01T10:00:00+00:00", ctr("01/12/2026", "Verdi Spa", "33333333333", "A-1"))
    u["c2"] = an(uid, "TEST_contratto_v2.pdf", "2026-01-02T10:00:00+00:00", ctr("01/06/2027", "Verdi Spa Srl", "44444444444", "A-2"))
    inv = lambda tot, num: {"category": "invoice", "doc_type": "Fattura", "summary": "TEST fattura",
        "structured": {"supplier": {"name": "Beta Servizi Srl", "piva": "11111111111"}, "customer": {"name": "Rossi SRL", "piva": "22222222222"},
                       "document": {"number": num, "date": "10/01/2026"}, "totals": {"imponibile": "1000", "imposta": "220", "totale": tot}},
        "fields": [{"label": "Data scadenza pagamento", "value": "entro il 10/04/2027 circa"}], "audit": []}
    u["i1"] = an(uid, "TEST_fatt1.pdf", "2026-01-03T10:00:00+00:00", inv("1220", "1"))
    u["i2"] = an(uid, "TEST_fatt2.pdf", "2026-01-04T10:00:00+00:00", inv("1500", "2"))
    json.dump(u, open(F, "w")); print(json.dumps(u))
else:
    u = json.load(open(F))
    for c in ("analyses", "reminders", "clients", "multi_document_audits"):
        mdb[c].delete_many({"user_id": u["uid"]})
    mdb.users.delete_one({"user_id": u["uid"]}); print("cleaned")
