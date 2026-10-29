# Seed a fresh user with a contract analysis + an 'other' analysis for UI testing of Crea promemoria
import os, uuid, json, requests
from datetime import datetime, timezone
from pymongo import MongoClient
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"').rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
email = f"test_remui_{uuid.uuid4().hex[:6]}@example.com"
d = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "secret123", "name": "TEST UI"}).json()
uid = d["user"]["user_id"]
now = datetime.now(timezone.utc).isoformat()
a1, a2 = str(uuid.uuid4()), str(uuid.uuid4())
db.analyses.insert_many([
    {"analysis_id": a1, "user_id": uid, "doc_type": "contract", "filename": "TEST_contratto.pdf", "created_at": now, "ai_provider": "gemini",
     "result": {"doc_type": "Contratto", "category": "contract", "summary": "Contratto di servizio TEST", "fields": [{"label": "Scadenza", "value": "30/09/2027"}],
                "audit": [{"level": "ok", "message": "ok"}], "structured": {"parties": [], "expiration_date": "30/09/2027"}, "full_text": "x"}},
    {"analysis_id": a2, "user_id": uid, "doc_type": "auto", "filename": "TEST_altro.pdf", "created_at": now, "ai_provider": "gemini",
     "result": {"doc_type": "Lettera", "category": "other", "summary": "Lettera generica TEST", "fields": [{"label": "Mittente", "value": "Mario"}], "audit": [], "structured": {}, "full_text": "x"}},
])
print(json.dumps({"email": email, "token": d["token"], "uid": uid, "a1": a1, "a2": a2}))
