import { useState } from "react";
import { Check, Copy, Star } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

/** Chrome Web Store listing — swap once the extension is published. */
const STORE_URL = "https://chromewebstore.google.com/detail/yomu";
const TEXT = "Yomu — never lose your spot in any manga, webtoon, anime or series. Save & resume in one click.";

const open = (u: string) => window.open(u, "_blank", "noopener,noreferrer");

// Brand glyphs as clean inline SVG so the share row looks intentional, not
// like a set of stray emoji.
const IconX = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M18.24 2H21.5l-7.5 8.57L22.5 22h-6.6l-5.17-6.76L4.8 22H1.54l8.02-9.17L1.5 2h6.77l4.67 6.18L18.24 2Zm-1.16 18h1.83L7.02 3.9H5.06L17.08 20Z" /></svg>
);
const IconFacebook = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" /></svg>
);
const IconWhatsApp = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.97L2 22l5.16-1.35A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 0 1 5.73 13.83A8.1 8.1 0 0 1 7.5 18.8l-.36-.21-3.06.8.82-2.98-.24-.38A8.1 8.1 0 0 1 12.04 3.8Zm-2.9 4.02c-.15 0-.4.06-.6.29-.2.22-.78.76-.78 1.86s.8 2.16.91 2.31c.11.15 1.57 2.5 3.9 3.4 1.94.75 2.34.6 2.76.56.42-.04 1.36-.55 1.55-1.09.19-.53.19-.99.13-1.09-.06-.1-.2-.15-.42-.26-.22-.11-1.36-.67-1.57-.75-.21-.08-.36-.11-.51.11-.15.22-.58.75-.72.9-.13.15-.26.17-.48.06-.22-.11-.94-.35-1.79-1.11-.66-.59-1.11-1.32-1.24-1.54-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.5-1.26-.69-1.72-.18-.44-.36-.38-.5-.39l-.42-.01Z" /></svg>
);
const IconReddit = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M22 11.6a2.1 2.1 0 0 0-3.55-1.5 10.3 10.3 0 0 0-5.2-1.64l.88-4.15 2.9.62a1.5 1.5 0 1 0 .17-.98l-3.3-.7a.5.5 0 0 0-.59.38l-1 4.7a10.4 10.4 0 0 0-5.32 1.64 2.1 2.1 0 1 0-2.3 3.42 4.2 4.2 0 0 0-.04.66c0 3.3 3.85 5.98 8.6 5.98s8.6-2.68 8.6-5.98a4 4 0 0 0-.04-.65A2.1 2.1 0 0 0 22 11.6ZM7.6 13.1a1.4 1.4 0 1 1 2.8 0 1.4 1.4 0 0 1-2.8 0Zm7.86 3.68c-.98.98-3.9.98-4.9 0a.4.4 0 0 1 .56-.56c.65.64 3.02.65 3.77 0a.4.4 0 1 1 .57.56Zm-.06-2.28a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z" /></svg>
);

/** Rate + social-share row, reused across the web app. */
export function ShareBar() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard?.writeText(STORE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="share-bar">
      <span className="share-bar-label">{t("share.title")}</span>
      <div className="share-bar-btns">
        <a className="share-chip rate" href={STORE_URL} target="_blank" rel="noreferrer">
          <Star size={14} fill="currentColor" /> {t("share.rate")}
        </a>
        <button className="share-chip" aria-label="X" title="X" onClick={() => open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(TEXT)}&url=${encodeURIComponent(STORE_URL)}`)}><IconX /></button>
        <button className="share-chip" aria-label="Facebook" title="Facebook" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(STORE_URL)}`)}><IconFacebook /></button>
        <button className="share-chip" aria-label="WhatsApp" title="WhatsApp" onClick={() => open(`https://api.whatsapp.com/send?text=${encodeURIComponent(TEXT + " " + STORE_URL)}`)}><IconWhatsApp /></button>
        <button className="share-chip" aria-label="Reddit" title="Reddit" onClick={() => open(`https://www.reddit.com/submit?url=${encodeURIComponent(STORE_URL)}&title=${encodeURIComponent(TEXT)}`)}><IconReddit /></button>
        <button className="share-chip" aria-label={t("share.copy")} title={t("share.copy")} onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
      </div>
    </div>
  );
}
