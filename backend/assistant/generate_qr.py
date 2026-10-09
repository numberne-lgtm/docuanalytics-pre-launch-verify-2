"""Generate QR codes (PNG + SVG) and UTM share links for the public assistant page."""
import sys
import base64
import io
from pathlib import Path
import segno
from PIL import Image

BASE_URL = "https://docuanalytics.online/assistant"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "assistant-qr"
LOGO = ROOT / "frontend" / "public" / "docuanalytics-ai-logo.png"
# Official palette from frontend/src/App.css (:root --primary) and manifest.json theme_color
BRAND_PRIMARY = "#2f6bff"
BRAND_NAVY = "#0a1022"
LIGHT = "#ffffff"
COLORS = dict(dark=BRAND_PRIMARY, finder_dark=BRAND_NAVY, alignment_dark=BRAND_NAVY, light=LIGHT)
PNG_SCALE = 40
SVG_SCALE = 10
BORDER = 4
LOGO_RATIO = 0.2
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
    qr.save(str(path), kind="png", scale=PNG_SCALE, border=BORDER, **COLORS)
    img = Image.open(path).convert("RGBA")
    logo = Image.open(LOGO).convert("RGBA")
    side = int(img.size[0] * LOGO_RATIO)
    logo.thumbnail((side, side))
    m = PNG_SCALE
    pad = Image.new("RGBA", (logo.size[0] + 2 * m, logo.size[1] + 2 * m), LIGHT)
    pad.paste(logo, (m, m), logo)
    img.paste(pad, ((img.size[0] - pad.size[0]) // 2, (img.size[1] - pad.size[1]) // 2))
    img.convert("RGB").save(path, optimize=True, dpi=(300, 300))


def branded_svg(qr, path):
    qr.save(str(path), kind="svg", scale=SVG_SCALE, border=BORDER, xmldecl=False, **COLORS)
    total = (qr.symbol_size(scale=SVG_SCALE, border=BORDER))[0]
    side = total * LOGO_RATIO
    pad = SVG_SCALE
    x = (total - side) / 2
    buf = io.BytesIO()
    lg = Image.open(LOGO).convert("RGBA")
    lg.thumbnail((360, 360))
    lg.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    overlay = (f'<rect x="{x - pad}" y="{x - pad}" width="{side + 2 * pad}" height="{side + 2 * pad}" fill="{LIGHT}"/>'
               f'<image x="{x}" y="{x}" width="{side}" height="{side}" preserveAspectRatio="xMidYMid meet" '
               f'href="data:image/png;base64,{b64}"/>')
    svg = path.read_text(encoding="utf-8")
    path.write_text(svg.replace("</svg>", overlay + "</svg>"), encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    lines = [f"Pagina assistente: {BASE_URL}", ""]
    for name, (src, med) in CHANNELS.items():
        url = link(src, med)
        qr = segno.make(url, error="h")
        branded_svg(qr, OUT / f"docuanalytics-assistant-{name}.svg")
        branded_png(qr, OUT / f"docuanalytics-assistant-{name}.png")
        lines.append(f"{name}: {url}")
    (OUT / "links.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    sys.exit(main())
