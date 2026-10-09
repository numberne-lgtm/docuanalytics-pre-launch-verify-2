"""Generate QR codes (PNG + SVG) and UTM share links for the public assistant page."""
import sys
from pathlib import Path
import segno
from PIL import Image

BASE_URL = "https://docuanalytics.online/assistant"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "assistant-qr"
LOGO = ROOT / "frontend" / "public" / "docuanalytics-ai-logo.png"
CHANNELS = {
    "qr": ("qr", "offline"),
    "linkedin": ("linkedin", "social"),
    "facebook": ("facebook", "social"),
    "instagram": ("instagram", "social"),
    "brochure": ("brochure", "print"),
    "presentazione": ("presentazione", "slide"),
}


def link(source, medium, campaign="assistant_launch"):
    return f"{BASE_URL}?utm_source={source}&utm_medium={medium}&utm_campaign={campaign}"


def branded_png(qr, path):
    qr.save(str(path), kind="png", scale=24, border=3, dark="#0b1b3f", light="#ffffff")
    img = Image.open(path).convert("RGBA")
    logo = Image.open(LOGO).convert("RGBA")
    side = img.size[0] // 5
    logo.thumbnail((side, side))
    pad = Image.new("RGBA", (logo.size[0] + 24, logo.size[1] + 24), "white")
    pad.paste(logo, (12, 12), logo)
    img.paste(pad, ((img.size[0] - pad.size[0]) // 2, (img.size[1] - pad.size[1]) // 2))
    img.convert("RGB").save(path, optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    lines = [f"Pagina assistente: {BASE_URL}", ""]
    for name, (src, med) in CHANNELS.items():
        url = link(src, med)
        qr = segno.make(url, error="h")
        qr.save(str(OUT / f"docuanalytics-assistant-{name}.svg"), scale=10, border=3, dark="#0b1b3f")
        branded_png(qr, OUT / f"docuanalytics-assistant-{name}.png")
        lines.append(f"{name}: {url}")
    (OUT / "links.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    sys.exit(main())
