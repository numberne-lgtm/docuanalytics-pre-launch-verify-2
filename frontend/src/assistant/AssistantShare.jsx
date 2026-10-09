import { useEffect, useRef, useState } from "react";
import { FaWhatsapp, FaFacebookF, FaLinkedinIn, FaInstagram, FaTiktok } from "react-icons/fa";
import { Share2, Link2, Download, Check, X } from "lucide-react";

const BASE = "https://docuanalytics.online/assistant";
const QR_FILE = "/assistant-qr/docuanalytics-assistant-qr.png?v=3";
const link = (src) => `${BASE}?utm_source=${src}&utm_medium=share&utm_campaign=assistant_launch`;
const popup = (url) => window.open(url, "_blank", "noopener,noreferrer,width=640,height=640");

async function nativeShare(src, msg) {
  if (!navigator.share) return false;
  const data = { title: "DocuAnalytics AI", text: msg, url: link(src) };
  try {
    const blob = await fetch(QR_FILE).then((r) => r.blob());
    const file = new File([blob], "docuanalytics-assistant-qr.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) data.files = [file];
  } catch { /* share without image */ }
  try { await navigator.share(data); return true; } catch (e) { return e?.name === "AbortError"; }
}

export const AssistantShare = ({ t }) => {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef();
  const msg = t("share_msg");

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const copy = (src = "copy") => navigator.clipboard?.writeText(link(src)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  const viaNative = async (src) => { setManual(null); if (!(await nativeShare(src, msg))) setManual(src); };

  const items = [
    ["whatsapp", "WhatsApp", FaWhatsapp, "#25d366", () => popup(`https://wa.me/?text=${encodeURIComponent(`${msg} ${link("whatsapp")}`)}`)],
    ["facebook", "Facebook", FaFacebookF, "#1877f2", () => popup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link("facebook"))}`)],
    ["linkedin", "LinkedIn", FaLinkedinIn, "#0a66c2", () => popup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link("linkedin"))}`)],
    ["instagram", "Instagram", FaInstagram, "#e1306c", () => viaNative("instagram")],
    ["tiktok", "TikTok", FaTiktok, "#ffffff", () => viaNative("tiktok")],
  ];

  return (
    <div className="sh-wrap" ref={ref}>
      <button className="btn btn-lg btn-ghost sh-trigger" onClick={() => { setOpen(!open); setManual(null); }} aria-expanded={open} data-testid="share-btn">
        <Share2 size={17} /> {t("share_btn")}
      </button>
      {open && (
        <div className="sh-menu" role="menu" data-testid="share-menu">
          <div className="sh-head"><b>{t("share_btn")}</b><button className="sh-x" onClick={() => setOpen(false)} aria-label="Chiudi" data-testid="share-close"><X size={16} /></button></div>
          <div className="sh-grid">
            {items.map(([id, label, Icon, color, fn]) => (
              <button key={id} className="sh-item" onClick={fn} data-testid={`share-${id}`}>
                <span className="sh-ic" style={{ color }}><Icon size={20} /></span>{label}
              </button>
            ))}
            <button className="sh-item" onClick={() => copy()} data-testid="share-copy">
              <span className="sh-ic">{copied ? <Check size={20} color="var(--success)" /> : <Link2 size={20} />}</span>{copied ? t("share_copied") : t("share_copy")}
            </button>
          </div>
          {manual && (
            <div className="sh-manual" data-testid="share-manual">
              <p>{t("share_manual")}</p>
              <div className="sh-row">
                <button className="btn btn-sm" onClick={() => copy(manual)} data-testid="share-manual-copy"><Link2 size={14} /> {copied ? t("share_copied") : t("share_copy")}</button>
                <a className="btn btn-sm" href={QR_FILE} download="docuanalytics-assistant-qr.png" data-testid="share-manual-qr"><Download size={14} /> {t("share_dl")}</a>
              </div>
            </div>
          )}
          <a className="sh-dl" href={QR_FILE} download="docuanalytics-assistant-qr.png" data-testid="share-download-qr"><Download size={14} /> {t("share_dl")}</a>
        </div>
      )}
    </div>
  );
};
