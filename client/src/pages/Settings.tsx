import { useRef } from "react";
import { Link } from "wouter";
import { Cloud, Download, Globe, Lock, RotateCcw, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/i18n/I18nContext";
import { LANGUAGES } from "@/i18n/strings";
import { useStore } from "@/store/StoreContext";
import { currentSyncStatus } from "@/lib/sync";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const store = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const syncStatus = currentSyncStatus();

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      if (store.importData(text)) toast.success(t("toast.imported"));
      else toast.error(t("toast.importFailed"));
    });
    e.target.value = "";
  };

  const reset = () => {
    if (window.confirm(t("settings.resetConfirm"))) {
      store.reset();
      toast.success(t("settings.resetDone"));
    }
  };

  return (
    <div className="dasi-app">
      <AppHeader />
      <main className="dasi-main settings-main">
        <div className="welcome">
          <div>
            <span className="eyebrow pastel-label">{t("settings.eyebrow")}</span>
            <h1>{t("settings.title")}</h1>
          </div>
        </div>

        <div className="settings-grid">
          <section className="settings-card">
            <h3><User size={16} /> {t("settings.account")}</h3>
            <p className="settings-value">{t("settings.accountLocal")}</p>
            <button className="heart-button" disabled>{t("settings.signIn")}</button>
            <small>{t("settings.signInSoon")}</small>
          </section>

          <section className="settings-card">
            <h3><Cloud size={16} /> {t("settings.sync")}</h3>
            <div className="settings-line">
              <span>{t("settings.syncStatus")}</span>
              <strong className={`sync-badge ${syncStatus}`}>
                {syncStatus === "offline" ? t("settings.syncOffline") : t("settings.syncUnavailable")}
              </strong>
            </div>
          </section>

          <section className="settings-card">
            <h3><Globe size={16} /> {t("settings.language")}</h3>
            <div className="settings-langs">
              {LANGUAGES.map((l) => (
                <button key={l.code} className={l.code === lang ? "on" : ""} onClick={() => setLang(l.code)}>
                  <span>{l.flag}</span> {l.label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card">
            <h3><Cloud size={16} /> {t("settings.plan")}</h3>
            <div className="settings-line">
              <span>{t("settings.plan")}</span>
              <strong className="plan-badge">{t(`pricing.${store.plan}`)}</strong>
            </div>
            <Link href="/pricing" className="heart-button center">{t("settings.managePlan")}</Link>
          </section>

          <section className="settings-card">
            <h3><Download size={16} /> {t("settings.data")}</h3>
            <div className="settings-actions">
              <button className="heart-button" onClick={() => { store.exportData(); toast.success(t("toast.exported")); }}>
                <Download size={15} /> {t("now.export")}
              </button>
              <button className="heart-button" onClick={() => fileInput.current?.click()}>
                <Upload size={15} /> {t("now.import")}
              </button>
              <button className="ghost danger" onClick={reset}>
                <RotateCcw size={15} /> {t("settings.reset")}
              </button>
              <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onImport} />
            </div>
          </section>

          <section className="settings-card">
            <h3><Lock size={16} /> {t("settings.privacy")}</h3>
            <small>{t("settings.privacyNote")}</small>
          </section>
        </div>
      </main>
    </div>
  );
}
