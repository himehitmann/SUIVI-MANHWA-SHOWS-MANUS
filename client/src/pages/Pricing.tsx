import { useState } from "react";
import { Check, Cloud, Infinity as InfinityIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/i18n/I18nContext";
import { useStore } from "@/store/StoreContext";
import type { Plan } from "@/lib/types";

interface Tier {
  plan: Plan;
  icon: typeof Sparkles;
  price: { monthly: string; yearly: string };
  featured?: boolean;
  features: string[];
}

const tiers: Tier[] = [
  {
    plan: "free",
    icon: Sparkles,
    price: { monthly: "$0", yearly: "$0" },
    features: [
      "Unlimited local library",
      "Universal detection on any site",
      "Add works manually + online title search",
      "Import from MyAnimeList, CSV & JSON",
      "Custom lists & drag-and-drop",
      "Video speed & Picture-in-Picture",
      "Export / import backups",
    ],
  },
  {
    plan: "pro",
    icon: Cloud,
    price: { monthly: "$2.99", yearly: "$24.99" },
    featured: true,
    features: [
      "Everything in Free",
      "Encrypted cloud sync across all devices",
      "New chapter & episode alerts",
      "Reading calendar & statistics",
      "Unlimited devices",
      "Priority support",
    ],
  },
  {
    plan: "lifetime",
    icon: InfinityIcon,
    price: { monthly: "$49", yearly: "$49" },
    features: [
      "Everything in Pro, forever",
      "One payment, all future updates",
      "No subscription to manage",
      "Founder badge",
    ],
  },
];

export default function Pricing() {
  const { t } = useI18n();
  const store = useStore();
  const [yearly, setYearly] = useState(true);

  const ctaLabel = (plan: Plan) => (plan === "free" ? t("pricing.cta.free") : plan === "pro" ? t("pricing.cta.pro") : t("pricing.cta.lifetime"));

  return (
    <div className="dasi-app">
      <AppHeader />
      <main className="dasi-main">
        <div className="pricing-head">
          <span className="eyebrow pastel-label">{t("pricing.eyebrow")}</span>
          <h1>{t("pricing.title")}</h1>
          <p>{t("pricing.subtitle")}</p>
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
            const price = tier.plan === "lifetime" ? tier.price.monthly : yearly ? tier.price.yearly : tier.price.monthly;
            const suffix =
              tier.plan === "free" ? "" : tier.plan === "lifetime" ? ` ${t("pricing.once")}` : yearly ? t("pricing.perYear") : t("pricing.perMonth");
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
                  onClick={() => {
                    store.setPlan(tier.plan);
                    toast.success(ctaLabel(tier.plan));
                  }}
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
      </main>
    </div>
  );
}
