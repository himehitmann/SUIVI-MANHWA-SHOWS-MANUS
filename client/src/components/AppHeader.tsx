import {useStore} from "@/store/StoreContext";
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
  const {profile}=useStore();
  const { t, lang } = useI18n();
  const [location] = useLocation();
  const isLibrary = location === "/" || location.startsWith("/list");
  const nav: { href: string; label: string; active: boolean }[] = [
    { href: "/", label: t("nav.library"), active: isLibrary },
    { href: "/search", label:lang==="fr"?"Rechercher":"Search",active:location==="/search" },
    { href: "/learn", label: t("nav.learn"), active: location === "/learn" },
    { href: "/collections", label: t("nav.collections"), active: location === "/collections" },
    { href: "/pricing", label: t("nav.pricing"), active: location === "/pricing" },
  ];

  return (
    <header className="dasi-header">
      <Link href="/" className="dasi-brand">
        <DasiLogo />
        <span className="shine">Yomu</span>
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
          {profile?.avatar?<img src={profile.avatar} alt="" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}}/>:(profile?.name?.[0]||"Y")}
        </Link>
      </div>
    </header>
  );
}
