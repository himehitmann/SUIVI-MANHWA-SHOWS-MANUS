import { useRef, useState } from "react";
import { Link } from "wouter";
import { Cloud, Download, Globe, Lock, RefreshCw, RotateCcw, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/i18n/I18nContext";
import { LANGUAGES } from "@/i18n/strings";
import { useStore } from "@/store/StoreContext";
import { UNLOCK_ALL } from "@/lib/edition";
import { syncProvider } from "@/lib/sync";
import { parseImport } from "@/lib/importers";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const store = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const syncConfigured = syncProvider.isConfigured();
  const [session, setSession] = useState(syncProvider.getSession());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);

  const authenticate = async () => {
    setBusy(true);
    try {
      const s = mode === "in" ? await syncProvider.signIn(email, password) : await syncProvider.signUp(email, password);
      setSession(s);
      setPassword("");
      // Push local FIRST so the server merges anything saved before signing in
      // (guest progress) into the account, then pull the merged result. This is
      // what makes "started without an account, sign in later" never lose data.
      await syncProvider.push(store.snapshot());
      const remote = await syncProvider.pull();
      if (remote) store.applyState(remote);
      toast.success(t(mode === "in" ? "toast.signedIn" : "toast.accountCreated"));
    } catch {
      toast.error(t("toast.authFailed"));
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      await syncProvider.push(store.snapshot());
      const remote = await syncProvider.pull();
      if (remote) store.applyState(remote);
      toast.success(t("toast.synced"));
    } catch {
      toast.error(t("toast.syncFailed"));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await syncProvider.signOut();
    setSession(null);
  };

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const res = parseImport(text);
      if (res.format === "dasi" && store.importData(text)) {
        toast.success(t("toast.imported"));
      } else if (res.items.length > 0) {
        const n = store.importItems(res.items);
        toast.success(t("toast.imported.n", { n, format: res.format.toUpperCase() }));
      } else {
        toast.error(t("toast.importEmpty"));
      }
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
          <section className="settings-card account-card">
            <h3><User size={16} /> {t("settings.account")}</h3>
            {!syncConfigured ? (
              <>
                <p className="settings-value">{t("settings.accountLocal")}</p>
                <button className="heart-button" disabled>{t("settings.signIn")}</button>
                <small>{t("settings.signInSoon")}</small>
              </>
            ) : session ? (
              <>
                <p className="settings-value">{t("settings.signedInAs", { email: session.email })}</p>
                <div className="settings-actions">
                  <button className="primary-cta full" onClick={syncNow} disabled={busy}>
                    <RefreshCw size={15} className={busy ? "spinning" : ""} /> {t("settings.syncNow")}
                  </button>
                  <button className="ghost" onClick={signOut} disabled={busy}>{t("settings.signOut")}</button>
                </div>
                <small>{t("settings.syncSignedIn")}</small>
              </>
            ) : (
              <div className="auth-form">
                <input type="email" placeholder={t("settings.email")} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <input type="password" placeholder={t("settings.password")} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} onKeyDown={(e) => e.key === "Enter" && authenticate()} />
                <button className="primary-cta full" onClick={authenticate} disabled={busy || !email || !password}>
                  {t(mode === "in" ? "settings.signInBtn" : "settings.signUpBtn")}
                </button>
                <button className="link-btn" onClick={() => setMode(mode === "in" ? "up" : "in")}>
                  {t(mode === "in" ? "settings.needAccount" : "settings.haveAccount")}
                </button>
              </div>
            )}
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
              <strong className="plan-badge">{UNLOCK_ALL ? t("settings.ownerPlan") : t(`pricing.${store.plan}`)}</strong>
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
