import { Bot, ArrowRight, ScanLine, MessageCircle, Download, Link2, Copy, Check } from "lucide-react";
import "./assistant.css";
import { useState } from "react";
import { AssistantShare, BASE, QR_FILE, copyQrImage } from "./AssistantShare";

const QR_SRC = "/assistant-qr/docuanalytics-assistant-qr-web.png?v=3";

export const AssistantPromo = ({ t }) => (
  <section className="section" id="assistente" data-testid="assistant-promo">
    <div className="glass ap-card">
      <div className="ap-text">
        <span className="ap-kicker"><Bot size={14} /> {t("ap_kicker")}</span>
        <h2 className="section-title" data-testid="assistant-promo-title">{t("ap_title")}</h2>
        <p className="section-sub">{t("ap_desc")}</p>
        <ul className="ap-points">
          <li><MessageCircle size={14} /> {t("ap_p1")}</li>
          <li><MessageCircle size={14} /> {t("ap_p2")}</li>
          <li><MessageCircle size={14} /> {t("ap_p3")}</li>
        </ul>
        <a className="btn btn-primary btn-lg ap-btn" href="/assistant?utm_source=site&utm_medium=home_section" data-testid="assistant-promo-btn">
          <Bot size={18} /> {t("ap_btn")} <ArrowRight size={16} />
        </a>
        <AssistantShare t={t} />
      </div>
      <figure className="ap-qr" data-testid="assistant-promo-qr">
        <img src={QR_SRC} alt="QR code https://docuanalytics.online/assistant" width="200" height="200" loading="lazy" />
        <figcaption><ScanLine size={13} /> {t("ap_qr_hint")}</figcaption>

        <QrActions t={t} />
      </figure>
    </div>
  </section>
);

function QrActions({ t }) {
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2200); };
  const dl = () => { const a = document.createElement("a"); a.href = QR_FILE; a.download = "docuanalytics-assistant-qr.png"; a.click(); };
  const copyLink = () => navigator.clipboard?.writeText(BASE).then(() => flash(t("share_copied")));
  const copyQr = async () => { if (await copyQrImage()) flash(t("qr_copied")); else { dl(); flash(t("qr_copy_fail")); } };
  return (
    <div className="ap-qr-actions" data-testid="assistant-qr-actions">
      <button onClick={copyLink} data-testid="qr-copy-link"><Link2 size={13} /> {t("ap_copy_link")}</button>
      <button onClick={copyQr} data-testid="qr-copy-image"><Copy size={13} /> {t("qr_copy")}</button>
      <a href={QR_FILE} download="docuanalytics-assistant-qr.png" data-testid="assistant-promo-qr-download"><Download size={13} /> {t("ap_dl_png")}</a>
      <a href="/assistant-qr/docuanalytics-assistant-qr.svg?v=3" download="docuanalytics-assistant-qr.svg" data-testid="qr-download-svg"><Download size={13} /> {t("ap_dl_svg")}</a>
      {msg && <span className="ap-qr-msg" role="status" data-testid="qr-action-msg"><Check size={12} /> {msg}</span>}
    </div>
  );
}

export const AssistantNudge = ({ t, slug }) => (
  <div className="ap-nudge" data-testid="assistant-nudge">
    <span><Bot size={16} /> {t("ap_nudge")}</span>
    <a className="btn btn-sm btn-ghost" href={`/assistant?utm_source=site&utm_medium=sector&utm_campaign=${slug}`} data-testid="assistant-nudge-btn">
      {t("ap_btn")} <ArrowRight size={14} />
    </a>
  </div>
);
