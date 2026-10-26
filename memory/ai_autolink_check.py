import io, json, time, base64, random, requests
from PIL import Image, ImageDraw, ImageFont

API = open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split()[0]
email = f"t_ai_{random.randint(1, 99999)}@example.com"
r = requests.post(f"{API}/api/auth/register", json={"email": email, "password": "Test12345"}).json()
tok, uid = r["token"], r["user"]["user_id"]
H = {"Authorization": f"Bearer {tok}"}
print("user", email, "credits", r["user"].get("credits"))
c = requests.post(f"{API}/api/workspace/clients", json={"name": "Rossi SRL", "piva": "22222222222"}, headers=H).json()
c2 = requests.post(f"{API}/api/workspace/clients", json={"name": "Verdi Spa", "piva": "33333333333"}, headers=H).json()
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 34)
except Exception:
    font = None


def doc(lines, fmt):
    im = Image.new("RGB", (1700, 1100), "white"); d = ImageDraw.Draw(im)
    for i, l in enumerate(lines):
        d.text((60, 60 + i * 70), l, fill="black", font=font)
    b = io.BytesIO()
    if fmt == "pdf":
        im.save(b, "PDF"); return b.getvalue(), "application/pdf"
    im.save(b, "PNG"); return b.getvalue(), "image/png"


docs = [
    ("TEST_fattura_rossi.png", ["FATTURA N. 45 del 10/09/2026", "Fornitore: Beta Servizi Srl  P.IVA 11111111111",
                                "Cliente: Rossi SRL  P.IVA IT22222222222", "Imponibile 1.000,00  IVA 22% 220,00",
                                "Totale 1.220,00 EUR", "Scadenza pagamento: 30/11/2026"], "png"),
    ("TEST_contratto_verdi.pdf", ["CONTRATTO DI FORNITURA SERVIZI", "Tra: Alfa Consulting Srl P.IVA 44444444444",
                                  "e: Verdi Spa P.IVA 33333333333", "Decorrenza: 01/10/2026", "Scadenza: 30/09/2027",
                                  "Preavviso disdetta: 60 giorni"], "pdf"),
]
for name, lines, fmt in docs:
    data, mime = doc(lines, fmt)
    t0 = time.time()
    a = requests.post(f"{API}/api/analyze", json={"user_id": uid, "filename": name, "mime_type": mime,
                                                  "file_base64": base64.b64encode(data).decode()}, headers=H, timeout=180)
    res = a.json().get("result", {}) if a.ok else {}
    s = res.get("structured")
    print(name, a.status_code, round(time.time() - t0, 1), "s | category:", repr(res.get("category")),
          "| structured type:", type(s).__name__, "| keys:", list(s.keys())[:8] if isinstance(s, dict) else str(s)[:80])
requests.get(f"{API}/api/workspace/overview", headers=H)
for d in requests.get(f"{API}/api/workspace/documents", headers=H).json()["documents"]:
    print("DOC", d["filename"], "-> client:", d["client_name"], "| link:", d["client_link"], "| category:", d["category"])
dl = requests.get(f"{API}/api/workspace/deadlines", headers=H).json()["buckets"]
print("deadlines", {k: [(x["label"], x["due_date"], x["status"]) for x in v] for k, v in dl.items() if v})
hist = requests.get(f"{API}/api/analyses", params={"user_id": uid}, headers=H).json()["analyses"]
print("history", [h["filename"] for h in hist])
json.dump({"email": email, "uid": uid}, open("/app/memory/.ai_test_user.json", "w"))
