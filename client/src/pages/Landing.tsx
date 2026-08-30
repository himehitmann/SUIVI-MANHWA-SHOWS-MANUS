import { Link } from "wouter";
import { BookOpen, Cloud, Gauge, GraduationCap, Lock, MousePointerClick, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ShareBar } from "@/components/ShareBar";
import { useI18n } from "@/i18n/I18nContext";
import type { StringKey } from "@/i18n/strings";

const STORE_URL = "https://chromewebstore.google.com/detail/dasi";

const FEATURES: { icon: typeof Sparkles; key: string }[] = [
  { icon: MousePointerClick, key: "f1" },
  { icon: BookOpen, key: "f2" },
  { icon: Gauge, key: "f3" },
  { icon: GraduationCap, key: "f4" },
  { icon: Cloud, key: "f5" },
  { icon: Lock, key: "f6" },
];

/** Public marketing / landing page — the product's front door (English-first). */
export default function Landing() {
  const { t } = useI18n();
  return (
    <div className="dasi-app">
      <AppHeader />
      <main className="dasi-main land">
        {/* Hero */}
        <section className="land-hero">
          <span className="eyebrow pastel-label">{t("land.eyebrow")}</span>
          <h1>{t("land.title")}</h1>
          <p className="land-sub">{t("land.subtitle")}</p>
          <div className="land-cta">
            <a className="primary-cta" href={STORE_URL} target="_blank" rel="noreferrer">
              <Sparkles size={16} /> {t("land.ctaGet")}
            </a>
            <Link href="/pricing" className="heart-button">{t("land.ctaPlans")}</Link>
          </div>
          <div className="land-badges">
            <span>✨ {t("land.badgeLocal")}</span>
            <span>⚡ {t("land.badgeOneClick")}</span>
            <span>🌍 {t("land.badgeUniversal")}</span>
          </div>
        </section>

        {/* Problem → solution */}
        <section className="land-problem">
          <div>
            <span className="eyebrow">{t("land.problemEyebrow")}</span>
            <h2>{t("land.problemTitle")}</h2>
            <p>{t("land.problemBody")}</p>
          </div>
        </section>

        {/* Features */}
        <section className="land-features">
          <span className="eyebrow">{t("land.featuresEyebrow")}</span>
          <h2>{t("land.featuresTitle")}</h2>
          <div className="land-grid">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div key={key} className="land-card">
                <span className="land-ico"><Icon size={20} /></span>
                <strong>{t(`land.${key}t` as StringKey)}</strong>
                <p>{t(`land.${key}b` as StringKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="land-steps">
          <span className="eyebrow">{t("land.stepsEyebrow")}</span>
          <h2>{t("land.stepsTitle")}</h2>
          <div className="land-steprow">
            {["s1", "s2", "s3"].map((s, i) => (
              <div key={s} className="land-step">
                <span className="land-num">{i + 1}</span>
                <strong>{t(`land.${s}t` as StringKey)}</strong>
                <p>{t(`land.${s}b` as StringKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why Dasi */}
        <section className="land-why">
          <span className="eyebrow">{t("land.whyEyebrow")}</span>
          <h2>{t("land.whyTitle")}</h2>
          <ul>
            <li>{t("land.why1")}</li>
            <li>{t("land.why2")}</li>
            <li>{t("land.why3")}</li>
            <li>{t("land.why4")}</li>
          </ul>
        </section>

        {/* Plans teaser */}
        <section className="land-plans">
          <h2>{t("land.plansTitle")}</h2>
          <p>{t("land.plansBody")}</p>
          <Link href="/pricing" className="primary-cta">{t("land.ctaPlans")}</Link>
        </section>

        <ShareBar />
        <p className="land-foot">{t("land.foot")}</p>
      </main>
    </div>
  );
}
