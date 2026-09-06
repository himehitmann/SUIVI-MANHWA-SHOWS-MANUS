import { useI18n } from "@/i18n/I18nContext";

/** Chrome Web Store listing — swap once the extension is published. */
const STORE_URL = "https://chromewebstore.google.com/detail/yomu";
const TEXT = "Yomu — never lose your spot in any manga, webtoon, anime or series. Save & resume in one click.";

const open = (u: string) => window.open(u, "_blank", "noopener,noreferrer");

/** Rate + social-share row, reused across the web app. */
export function ShareBar() {
  const { t } = useI18n();
  const copy = () => {
    try {
      navigator.clipboard?.writeText(STORE_URL);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="share-bar">
      <span className="share-bar-label">{t("share.title")}</span>
      <div className="share-bar-btns">
        <a className="share-chip rate" href={STORE_URL} target="_blank" rel="noreferrer">★★★★★ {t("share.rate")}</a>
        <button className="share-chip" title="X" onClick={() => open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(TEXT)}&url=${encodeURIComponent(STORE_URL)}`)}>𝕏</button>
        <button className="share-chip" title="Facebook" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(STORE_URL)}`)}>f</button>
        <button className="share-chip" title="WhatsApp" onClick={() => open(`https://api.whatsapp.com/send?text=${encodeURIComponent(TEXT + " " + STORE_URL)}`)}>✆</button>
        <button className="share-chip" title="Reddit" onClick={() => open(`https://www.reddit.com/submit?url=${encodeURIComponent(STORE_URL)}&title=${encodeURIComponent(TEXT)}`)}>r/</button>
        <button className="share-chip" title={t("share.copy")} onClick={copy}>🔗</button>
      </div>
    </div>
  );
}
