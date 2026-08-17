import { Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/i18n/I18nContext";
import { DasiLogo } from "./DasiLogo";
import { LanguageSwitch } from "./LanguageSwitch";
import { Notifications } from "./Notifications";

interface Props {
  query?: string;
  onQuery?: (value: string) => void;
}

/** Global top bar: brand, primary nav, search, language, notifications, profile. */
export function AppHeader({ query, onQuery }: Props) {
  const { t } = useI18n();
  const [location] = useLocation();
  const isLibrary = location === "/" || location.startsWith("/list");
  const nav: { href: string; label: string; active: boolean }[] = [
    { href: "/", label: t("nav.library"), active: isLibrary },
    { href: "/collections", label: t("nav.collections"), active: location === "/collections" },
    { href: "/pricing", label: t("nav.pricing"), active: location === "/pricing" },
  ];

  return (
    <header className="dasi-header">
      <Link href="/" className="dasi-brand">
        <DasiLogo />
        <span className="shine">Dasi</span>
      </Link>
      <nav>
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={n.active ? "active" : ""}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        {onQuery && (
          <div className="header-search">
            <Search size={16} />
            <input
              value={query ?? ""}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              aria-label={t("search.placeholder")}
            />
          </div>
        )}
        <LanguageSwitch />
        <Notifications />
        <Link href="/settings" className="profile" aria-label={t("nav.settings")}>
          H
        </Link>
      </div>
    </header>
  );
}
