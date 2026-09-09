import { useRef, useState } from "react";
import { Link } from "wouter";
import {
  Cloud,
  Download,
  Globe,
  Lock,
  RefreshCw,
  RotateCcw,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/i18n/I18nContext";
import { LANGUAGES } from "@/i18n/strings";
import { useStore } from "@/store/StoreContext";
import { UNLOCK_ALL } from "@/lib/edition";
import { syncProvider, currentAccountScope } from "@/lib/sync";
import {ProfileEditor} from "@/components/ProfileEditor";
import {LibraryImport} from "@/components/LibraryImport";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const store = useStore();
  const syncConfigured = syncProvider.isConfigured();
  const [session, setSession] = useState(syncProvider.getSession());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(""),
    [nextPassword, setNextPassword] = useState(""),
    [nextEmail, setNextEmail] = useState("");
  const fr = lang === "fr";

  const authenticate = async () => {
    setBusy(true);
    try {
      const s =
        mode === "in"
          ? await syncProvider.signIn(email, password)
          : await syncProvider.signUp(email, password);
      setSession(s);
      setPassword("");
      // Only this account's cache is synchronized. Guest data stays available after sign-out.
      const accountState = store.activateAccount(currentAccountScope());
      await syncProvider.push(accountState);
      const remote = await syncProvider.pull();
      if (remote) store.applyState(remote);
      toast.success(
        t(mode === "in" ? "toast.signedIn" : "toast.accountCreated")
      );
    } catch {
      // If activation failed, no library from the previous account may be uploaded.
      await syncProvider.signOut();
      setSession(null);
      try {
        store.activateAccount(null);
      } catch {
        /* Keep the unreadable cache intact. */
      }
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
    try {
      store.activateAccount(null);
      await syncProvider.signOut();
      setSession(null);
    } catch {
      toast.error(t("toast.syncFailed"));
    }
  };

  const manageAccount = async (
    action: "password" | "email" | "logout-all" | "delete"
  ) => {
    if (
      action === "delete" &&
      !window.confirm(
        fr
          ? "Supprimer définitivement ce compte et sa bibliothèque synchronisée ? Une copie locale reste disponible dans ce navigateur."
          : "Permanently delete this account and its synced library? A local copy remains available in this browser."
      )
    )
      return;
    setBusy(true);
    try {
      await syncProvider.accountAction(action, {
        current: currentPassword,
        next: nextPassword,
        email: nextEmail,
      });
      if (action === "logout-all" || action === "delete")
        store.activateAccount(null);
      setSession(syncProvider.getSession());
      setCurrentPassword("");
      setNextPassword("");
      toast.success(fr ? "Modification enregistrée." : "Changes saved.");
    } catch {
      toast.error(
        fr
          ? "Modification impossible. Vérifie ton mot de passe et réessaie."
          : "Could not save. Check your password and try again."
      );
    } finally {
      setBusy(false);
    }
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
            <span className="eyebrow pastel-label">
              {t("settings.eyebrow")}
            </span>
            <h1>{t("settings.title")}</h1>
          </div>
        </div>

        <ProfileEditor/>
        <div className="settings-grid">
          <section className="settings-card account-card">
            <h3>
              <User size={16} /> {t("settings.account")}
            </h3>
            {!syncConfigured ? (
              <>
                <p className="settings-value">{t("settings.accountLocal")}</p>
                <button className="heart-button" disabled>
                  {t("settings.signIn")}
                </button>
                <small>{t("settings.signInSoon")}</small>
              </>
            ) : session ? (
              <>
                <p className="settings-value">
                  {t("settings.signedInAs", { email: session.email })}
                </p>
                <div className="settings-actions">
                  <button
                    className="primary-cta full"
                    onClick={syncNow}
                    disabled={busy}
                  >
                    <RefreshCw size={15} className={busy ? "spinning" : ""} />{" "}
                    {t("settings.syncNow")}
                  </button>
                  <button className="ghost" onClick={signOut} disabled={busy}>
                    {t("settings.signOut")}
                  </button>
                </div>
                <small>{t("settings.syncSignedIn")}</small>
                <div className="auth-form" style={{ marginTop: 20 }}>
                  <label>
                    {fr ? "Mot de passe actuel" : "Current password"}
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                    />
                  </label>
                  <label>
                    {fr ? "Nouvelle adresse e-mail" : "New email address"}
                    <input
                      type="email"
                      autoComplete="email"
                      value={nextEmail}
                      onChange={e => setNextEmail(e.target.value)}
                    />
                  </label>
                  <button
                    className="ghost"
                    disabled={busy || !currentPassword || !nextEmail}
                    onClick={() => manageAccount("email")}
                  >
                    {fr ? "Changer l’e-mail" : "Change email"}
                  </button>
                  <label>
                    {fr ? "Nouveau mot de passe" : "New password"}
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={nextPassword}
                      onChange={e => setNextPassword(e.target.value)}
                    />
                  </label>
                  <button
                    className="ghost"
                    disabled={
                      busy || !currentPassword || nextPassword.length < 8
                    }
                    onClick={() => manageAccount("password")}
                  >
                    {fr ? "Changer le mot de passe" : "Change password"}
                  </button>
                  <small>
                    {fr
                      ? "Changer le mot de passe déconnecte les autres sessions."
                      : "Changing your password signs out other sessions."}
                  </small>
                  <button
                    className="ghost"
                    disabled={busy}
                    onClick={() => manageAccount("logout-all")}
                  >
                    {fr
                      ? "Déconnecter tous les appareils"
                      : "Sign out all devices"}
                  </button>
                  <button
                    className="ghost"
                    disabled={busy || !currentPassword}
                    onClick={() => manageAccount("delete")}
                  >
                    {fr ? "Supprimer mon compte" : "Delete my account"}
                  </button>
                </div>
              </>
            ) : (
              <div className="auth-form">
                <input
                  type="email"
                  placeholder={t("settings.email")}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <input
                  type="password"
                  placeholder={t("settings.password")}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={
                    mode === "in" ? "current-password" : "new-password"
                  }
                  onKeyDown={e => e.key === "Enter" && authenticate()}
                />
                <button
                  className="primary-cta full"
                  onClick={authenticate}
                  disabled={busy || !email || !password}
                >
                  {t(
                    mode === "in" ? "settings.signInBtn" : "settings.signUpBtn"
                  )}
                </button>
                <button
                  className="link-btn"
                  onClick={() => setMode(mode === "in" ? "up" : "in")}
                >
                  {t(
                    mode === "in"
                      ? "settings.needAccount"
                      : "settings.haveAccount"
                  )}
                </button>
              </div>
            )}
          </section>

          <section className="settings-card">
            <h3>
              <Globe size={16} /> {t("settings.language")}
            </h3>
            <div className="settings-langs">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  className={l.code === lang ? "on" : ""}
                  onClick={() => setLang(l.code)}
                >
                  <span>{l.flag}</span> {l.label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card">
            <h3>
              <Cloud size={16} /> {t("settings.plan")}
            </h3>
            <div className="settings-line">
              <span>{t("settings.plan")}</span>
              <strong className="plan-badge">
                {UNLOCK_ALL
                  ? t("settings.ownerPlan")
                  : t(`pricing.${store.plan}`)}
              </strong>
            </div>
            <Link href="/pricing" className="heart-button center">
              {t("settings.managePlan")}
            </Link>
          </section>

          <section className="settings-card">
            <h3>
              <Download size={16} /> {t("settings.data")}
            </h3>
            <div className="settings-actions">
              <button
                className="heart-button"
                onClick={() => {
                  store.exportData();
                  toast.success(t("toast.exported"));
                }}
              >
                <Download size={15} /> {t("now.export")}
              </button>
              <LibraryImport />
              <button className="ghost danger" onClick={reset}>
                <RotateCcw size={15} /> {t("settings.reset")}
              </button>
            </div>
          </section>

          <section className="settings-card">
            <h3>
              <Lock size={16} /> {t("settings.privacy")}
            </h3>
            <small>{t("settings.privacyNote")}</small>
          </section>
        </div>
      </main>
    </div>
  );
}
