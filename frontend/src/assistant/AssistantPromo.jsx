import { Bot, ArrowRight, ScanLine, MessageCircle, Download } from "lucide-react";
import "./assistant.css";
import { AssistantShare } from "./AssistantShare";

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
        <a className="ap-qr-dl" href={QR_SRC.replace("-web", "")} download="docuanalytics-assistant-qr.png" data-testid="assistant-promo-qr-download"><Download size={12} /> {t("share_dl")}</a>
      </figure>
    </div>
  </section>
);

export const AssistantNudge = ({ t, slug }) => (
  <div className="ap-nudge" data-testid="assistant-nudge">
    <span><Bot size={16} /> {t("ap_nudge")}</span>
    <a className="btn btn-sm btn-ghost" href={`/assistant?utm_source=site&utm_medium=sector&utm_campaign=${slug}`} data-testid="assistant-nudge-btn">
      {t("ap_btn")} <ArrowRight size={14} />
    </a>
  </div>
);
