import { useState } from "react";
import { Check, Cloud, Star } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ShareBar } from "@/components/ShareBar";
import { useI18n } from "@/i18n/I18nContext";
import { useStore } from "@/store/StoreContext";
import { UNLOCK_ALL } from "@/lib/edition";
import { checkoutUrl } from "@/lib/checkout";
import { syncProvider } from "@/lib/sync";
import type { Plan } from "@/lib/types";

interface Tier {
  plan: Plan;
  icon: typeof Star;
  price: { monthly: string; yearly: string };
  featured?: boolean;
  features: string[];
}

const tiers: Tier[] = [
  {
    plan: "free",
    icon: Star,
    price: { monthly: "$0", yearly: "$0" },
    features: [
      "Unlimited library — manga, webtoons, anime, series, films & games",
      "One-click save & resume on any site",
      "Import from Trakt, TV Time, IMDb, Letterboxd & MyAnimeList",
      "Custom lists, tags, ratings & drag-and-drop",
      "Built-in page & image translation",
      "Video speed & Picture-in-Picture",
      "Export / import backups",
    ],
  },
  {
    plan: "pro",
    icon: Cloud,
    price: { monthly: "$3.49", yearly: "$29.99" },
    featured: true,
    features: [
      "Everything in Free",
      "Encrypted cloud sync across unlimited devices",
      "New chapter, episode & release alerts",
      "Full stats — streaks, trends, calendar & forecasts",
      "Unlimited translation, every language",
      "Custom list covers & profile",
      "Priority support & early features",
    ],
  },
];

export default function Pricing() {
  const { t } = useI18n();
  const store = useStore();
  const [yearly, setYearly] = useState(true);

  const ctaLabel = (plan: Plan) => (plan === "free" ? t("pricing.cta.free") : t("pricing.cta.pro"));

  const subscribe = (plan: Plan) => {
    if (plan === "free") {
      store.setPlan("free");
      return;
    }
    // Real payment path: redirect to the configured hosted checkout, tagging the
    // account so the backend webhook can grant the plan.
    const session = syncProvider.getSession();
    const url = checkoutUrl(plan, yearly, { userId: session?.userId, email: session?.email });
    if (url) {
      window.location.href = url;
      return;
    }
    // No checkout configured (dev / unlocked owner build): local plan toggle.
    store.setPlan(plan);
    toast.success(ctaLabel(plan));
  };

  return (
    <div className="dasi-app">
      <AppHeader />
      <main className="dasi-main">
        <div className="pricing-head">
          <span className="eyebrow pastel-label">{t("pricing.eyebrow")}</span>
          <h1>{t("pricing.title")}</h1>
          <p>{t("pricing.subtitle")}</p>
          {UNLOCK_ALL && <div className="owner-banner">{t("pricing.ownerUnlocked")}</div>}
          <div className="billing-toggle" role="tablist">
            <button className={!yearly ? "active" : ""} onClick={() => setYearly(false)} role="tab" aria-selected={!yearly}>
              {t("pricing.billing.monthly")}
            </button>
            <button className={yearly ? "active" : ""} onClick={() => setYearly(true)} role="tab" aria-selected={yearly}>
              {t("pricing.billing.yearly")} <em>{t("pricing.yearlyNote")}</em>
            </button>
          </div>
        </div>

        <div className="pricing-grid">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isCurrent = store.plan === tier.plan;
            const price = yearly ? tier.price.yearly : tier.price.monthly;
            const suffix = tier.plan === "free" ? "" : yearly ? t("pricing.perYear") : t("pricing.perMonth");
            return (
              <div key={tier.plan} className={`pricing-card ${tier.featured ? "featured" : ""} ${isCurrent ? "current" : ""}`}>
                {tier.featured && <span className="pricing-flag">{t("pricing.pro")}</span>}
                <div className="pricing-icon" style={{ color: tier.featured ? "#6CBE9E" : "#9B86DA" }}>
                  <Icon size={20} />
                </div>
                <h3>{t(`pricing.${tier.plan}`)}</h3>
                <div className="pricing-price">
                  <strong>{price}</strong>
                  <span>{suffix}</span>
                </div>
                <ul>
                  {tier.features.map((f) => (
                    <li key={f}>
                      <Check size={15} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={tier.featured ? "primary-cta full" : "heart-button full"}
                  disabled={isCurrent}
                  onClick={() => subscribe(tier.plan)}
                >
                  {isCurrent ? t("pricing.cta.free") : ctaLabel(tier.plan)}
                </button>
              </div>
            );
          })}
        </div>

        <div className="account-note">
          <div>
            <span className="eyebrow">{t("account.eyebrow")}</span>
            <p>{t("account.syncNote")}</p>
          </div>
        </div>

        <ShareBar />
      </main>
    </div>
  );
}
