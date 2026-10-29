import json, sys, random, requests
from datetime import date, timedelta
from PIL import Image, ImageDraw

API = open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split()[0]
J = {"Content-Type": "application/json"}
step = sys.argv[1]
if step == "setup":
    r = requests.post(f"{API}/api/auth/register", json={"email": "nunberne@gmail.com", "password": "Prova-" + str(random.randint(10**6, 10**7))}).json()
    tok, uid = r["token"], r["user"]["user_id"]
    H = {"Authorization": f"Bearer {tok}"}
    print("registered", r["user"]["email"])
    print("studio", requests.put(f"{API}/api/workspace/studio", json={"name": "Studio Test DocuAnalytics", "address": "Via di Prova 1, 98051 Barcellona P.G. (ME)",
                                                                       "phone": "+39 000 0000000", "email": "nunberne@gmail.com", "website": "docuanalytics.online"}, headers=H).status_code)
    im = Image.new("RGB", (360, 100), (10, 16, 34)); d = ImageDraw.Draw(im); d.rectangle([12, 12, 88, 88], fill=(47, 107, 255)); d.text((105, 40), "STUDIO TEST", fill="white")
    im.save("/tmp/studio_logo.png")
    print("logo", requests.post(f"{API}/api/workspace/studio/logo", files={"file": ("logo.png", open("/tmp/studio_logo.png", "rb"), "image/png")}, headers=H).status_code)
    c = requests.post(f"{API}/api/workspace/clients", json={"name": "Cliente di Prova SRL", "piva": "22222222222", "email": "nunberne@gmail.com"}, headers=H).json()
    due = (date.today() + timedelta(days=3)).isoformat()
    dl = requests.post(f"{API}/api/workspace/deadlines", json={"label": "TEST Pagamento fattura n. 45", "due_date": due, "client_id": c["client_id"],
                                                               "notify_days": [3], "notify_client": True}, headers=H).json()
    p = requests.patch(f"{API}/api/workspace/deadlines/{dl['reminder_id']}", json={"client_message": "Gentile cliente, questo è un promemoria di PROVA inviato da DocuAnalytics AI (test preview)."}, headers=H)
    print("deadline", due, p.status_code, p.json().get("notify_client"))
    json.dump({"tok": tok, "uid": uid, "cid": c["client_id"], "rid": dl["reminder_id"]}, open("/app/memory/.mailtest.json", "w"))
else:
    s = json.load(open("/app/memory/.mailtest.json")); H = {"Authorization": f"Bearer {s['tok']}"}
    if step == "report":
        r = requests.post(f"{API}/api/workspace/clients/{s['cid']}/report/send", json={"message": "Buongiorno,\nin allegato il report di PROVA (test preview DocuAnalytics AI)."}, headers=H)
        print("report", r.status_code, r.text[:200])
    elif step == "digest":
        r = requests.post(f"{API}/api/workspace/digest/preview", headers=H); print("digest", r.status_code, r.text[:200])
    elif step == "log":
        print(json.dumps(requests.get(f"{API}/api/workspace/clients/{s['cid']}/emails", headers=H).json(), ensure_ascii=False, indent=1))
