# Perf probe (report-only): /api/workspace/sync + /overview latency with N synthetic analyses. Run: python tests/perf_workspace_sync.py 500
import os, sys, time, uuid
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
N = int(sys.argv[1]) if len(sys.argv) > 1 else 500

email = f"test_perf_{uuid.uuid4().hex[:8]}@example.com"
r = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Test12345"}).json()
tok, uid = r["token"], r["user"]["user_id"]
H = {"Authorization": f"Bearer {tok}"}
try:
    for i in range(5):
        requests.post(f"{BASE}/api/workspace/clients", json={"name": f"TEST C{i}", "piva": f"{i:011d}"}, headers=H)
    docs = [{"analysis_id": f"TEST_{uuid.uuid4()}", "user_id": uid, "filename": f"TEST_{i}.pdf",
             "created_at": f"2026-01-01T00:{i // 60 % 60:02d}:{i % 60:02d}+00:00",
             "result": {"category": "invoice", "doc_type": "Fattura",
                        "structured": {"supplier": {"name": f"S{i}", "piva": f"9{i:010d}"}, "customer": {"name": f"C{i % 7}", "piva": f"{i % 7:011d}"}, "total": str(i)},
                        "fields": [{"label": "Data scadenza pagamento", "value": f"{1 + i % 28:02d}/0{1 + i % 9}/2027"}],
                        "audit": [{"level": ["ok", "warning", "error"][i % 3], "message": "x"}]}} for i in range(N)]
    mdb.analyses.insert_many(docs)
    for label, m, ep in (("sync#1 (first, creates deadlines)", "post", "sync"), ("sync#2", "post", "sync"),
                         ("overview", "get", "overview"), ("deadlines", "get", "deadlines"), ("documents", "get", "documents"), ("clients", "get", "clients")):
        t0 = time.time(); rr = getattr(requests, m)(f"{BASE}/api/workspace/{ep}", headers=H, timeout=300)
        print(f"{label}: {time.time() - t0:.2f}s status={rr.status_code} bytes={len(rr.content)}")
    print("reminders created:", mdb.reminders.count_documents({"user_id": uid}), "analyses:", N)
finally:
    for c in ("analyses", "reminders", "clients"):
        mdb[c].delete_many({"user_id": uid})
    mdb.users.delete_one({"user_id": uid})
