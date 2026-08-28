from PIL import Image, ImageDraw

W, H = 1000, 760
img = Image.new("RGB", (W, H), (250, 250, 248))
d = ImageDraw.Draw(img)

lines = [
    "FATTURA N. 2026/00147   -   Data: 12/03/2026",
    "",
    "Fornitore: ALFA SERVIZI SRL",
    "Via Roma 12, 20121 Milano (MI)",
    "Partita IVA: 00743110157",
    "Codice Fiscale: 00743110157",
    "",
    "Cliente: BETA COSTRUZIONI SPA",
    "Corso Italia 45, 00187 Roma (RM)",
    "Partita IVA: 12345678903",
    "",
    "Descrizione: Consulenza tecnica marzo 2026",
    "Quantita: 10   Prezzo unitario: 150,00 EUR",
    "",
    "Imponibile: 1.500,00 EUR",
    "IVA 22%: 330,00 EUR",
    "TOTALE DOCUMENTO: 1.830,00 EUR",
    "",
    "Modalita di pagamento: Bonifico bancario",
    "IBAN: IT60X0542811101000000123456",
    "Scadenza: 11/04/2026",
]

y = 30
for ln in lines:
    d.text((40, y), ln, fill=(15, 15, 30))
    y += 30

# visual features
d.rectangle([20, 10, W - 20, H - 10], outline=(80, 80, 140), width=3)
d.line([40, 70, W - 60, 70], fill=(120, 120, 200), width=2)
d.rectangle([700, 30, 950, 130], outline=(200, 80, 60), width=2)
d.text((720, 70), "LOGO ALFA", fill=(200, 80, 60))
img.save("/tmp/fattura_export.png")
print("saved")
