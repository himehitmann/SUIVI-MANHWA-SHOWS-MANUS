/*
 * Options page — configure optional cloud sync for the extension.
 *
 * All network/auth work happens in the service worker (background.js) so tokens
 * never live in this page's scope; here we only send messages and render state.
 */
const api = globalThis.chrome;
const $ = (id) => document.getElementById(id);

const send = (message) =>
  new Promise((resolve) => api.runtime.sendMessage(message, (resp) => {
    void api.runtime.lastError;
    resolve(resp || {});
  }));

function showMsg(el, text, kind) {
  el.textContent = text;
  el.className = `msg show ${kind}`;
}
function clearMsg(el) {
  el.className = "msg";
}

function fmtTime(ts) {
  if (!ts) return "Never synced";
  const d = new Date(ts);
  return "Last synced " + d.toLocaleString();
}

function errorText(code) {
  const map = {
    invalid_email: "That email doesn't look right.",
    weak_password: "Password must be at least 8 characters.",
    email_taken: "An account with that email already exists — sign in instead.",
    invalid_credentials: "Wrong email or password.",
    not_signed_in: "Sign in first.",
    unauthorized: "Session expired — sign in again.",
    session_expired: "Session expired — sign in again. Your saved library is retained.",
    quota_exceeded: "Backup quota reached. Your changes remain on this device; try again later.",
    sync_conflict: "Another device updated your library. Sync again to merge the changes.",
    network_error: "Connection unavailable. Your changes remain on this device.",
    account_action_unavailable: "This account action is not available for this backup provider yet.",
    transfer_preview_required: "Review the local library again before copying.",
    guest_library_changed: "The local library changed. Review it again before copying.",
    account_changed: "The account changed during this operation. Try again.",
  };
  if (map[code]) return map[code];
  if (/^http_\d+/.test(code || "")) return "Couldn't reach the backend. Check the URL.";
  if (/^push_\d+/.test(code || "")) return "Sync upload failed. Try again.";
  return "Something went wrong. Check the backend URL and try again.";
}

function backupLabel(s, lang=s.lang) {
  const fr=lang==='fr';
  return ({
    local_only:fr?'Sur cet appareil uniquement — sauvegarde en ligne non activée':'On this device only — online backup is not enabled',
    pending:fr?'Modifications en attente de sauvegarde en ligne':'Changes waiting for online backup',
    saved:fr?'Modifications sauvegardées en ligne':'Changes saved online',
    error:fr?'Sauvegarde non confirmée — réessayer':'Backup not confirmed — try again',
  })[s.state] || (fr?'Sauvegarde non confirmée':'Backup not confirmed');
}

let guestPreview=null, guestBusy=false, guestLang="en";
async function render() {
  const s = await send({ type: "SYNC_STATUS" });
  guestLang=s.lang||"en";
  const fr=guestLang==="fr";
  $("forgot-password").textContent=fr?"Mot de passe oublié ?":"Forgot password?";
  $("guest-import-title").textContent=fr?"Bibliothèque enregistrée sans compte":"Library saved without an account";
  $("guest-import-help").textContent=fr?"Copier les œuvres, listes et sites favoris dans ce compte. La bibliothèque locale d’origine reste conservée. La sauvegarde en ligne est confirmée séparément.":"Copy works, lists and saved sites into this account. Your original local library is retained. Online backup is confirmed separately.";
  $("guest-preview").textContent=fr?"Voir ce qui sera copié":"Review what to copy";
  $("guest-confirm").textContent=fr?"Copier dans ce compte":"Copy into this account";
  if (s.configured) {
    $("signed-out").classList.add("hidden");
    $("signed-in").classList.remove("hidden");
    $("who").textContent = s.email || "Signed in";
    $("plan").textContent = (s.plan || "free").toUpperCase();
    $("endpoint").textContent = s.provider==="firebase" ? "Firebase — "+s.projectId : (s.apiUrl || "").replace(/^https?:\/\//, "");
    $("lastsync").textContent = backupLabel(s) + (s.meta?.lastSyncAt ? " — " + fmtTime(s.meta.lastSyncAt) : "");
    if (s.meta && s.meta.lastError) showMsg($("msg-in"), errorText(s.meta.lastError), "err");
    else showMsg($("msg-in"),backupLabel(s),s.state==="saved"?"ok":"");
  } else {
    $("signed-in").classList.add("hidden");
    $("signed-out").classList.remove("hidden");
    // Prefill last-used backend URL for convenience.
    if (s.apiUrl) $("apiUrl").value = s.apiUrl;
  }
}

// Sync endpoint is baked in so users never type a URL. Set this once at
// deploy time (the hosted Yomu sync API). Empty = sync not configured.
const DEFAULT_SYNC_API = "";
// Public project configuration only; keep null until rules and recovery are verified.
const DEFAULT_FIREBASE_CONFIG = null;

async function authenticate(type) {
  const apiUrl = ($("apiUrl").value.trim() || DEFAULT_SYNC_API);
  const email = $("email").value.trim();
  const password = $("password").value;
  clearMsg($("msg-out"));
  if (!apiUrl && !DEFAULT_FIREBASE_CONFIG) return showMsg($("msg-out"), "Cloud sync isn't available yet — everything still works on this device.", "err");
  if (!email || !password) return showMsg($("msg-out"), "Enter your email and password.", "err");

  $("signin").disabled = true;
  $("signup").disabled = true;
  const resp = await send({ type, payload: { apiUrl, email, password, ...(DEFAULT_FIREBASE_CONFIG ? {firebase:DEFAULT_FIREBASE_CONFIG} : {}) } });
  $("signin").disabled = false;
  $("signup").disabled = false;

  if (!resp.ok) return showMsg($("msg-out"), errorText(resp.error), "err");
  await render();
  if (resp.warn) showMsg($("msg-in"), "Signed in, but the first sync failed: " + errorText(resp.warn), "err");
  else if (resp.result) { const status=await send({type:"SYNC_STATUS"}); showMsg($("msg-in"),backupLabel(status),status.state==="saved"?"ok":""); }
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  api.storage.onChanged.addListener((_changes,area)=>{if(area==="local")render();});

  $("guest-preview").addEventListener("click",async()=>{
    if(guestBusy)return;
    guestBusy=true;$("guest-preview").disabled=true;
    guestPreview=null;$("guest-confirm").classList.add("hidden");
    const result=await send({type:"SYNC_PREVIEW_GUEST_IMPORT"});
    guestBusy=false;$("guest-preview").disabled=false;
    if(!result.ok){$("guest-summary").textContent=errorText(result.error);return;}
    const fr=guestLang==="fr";
    $("guest-summary").textContent=fr
      ? result.items+" œuvres, "+result.lists+" listes et "+result.sites+" sites à copier vers "+result.email+"."
      : result.items+" works, "+result.lists+" lists and "+result.sites+" sites to copy into "+result.email+".";
    if(result.items+result.lists+result.sites){guestPreview=result;$("guest-confirm").classList.remove("hidden");}
  });
  $("guest-confirm").addEventListener("click",async()=>{
    if(guestBusy||!guestPreview)return;
    guestBusy=true;$("guest-confirm").disabled=true;
    const result=await send({type:"SYNC_IMPORT_GUEST",token:guestPreview.token});
    guestPreview=null;guestBusy=false;$("guest-confirm").disabled=false;$("guest-confirm").classList.add("hidden");
    $("guest-summary").textContent=result.ok
      ? (guestLang==="fr"?"Copie ajoutée au compte sur cet appareil. Vérifie l’état de sauvegarde ci-dessus avant de désinstaller.":"Copy added to the account on this device. Check the backup status above before uninstalling.")
      : errorText(result.error);
    await render();
  });

  $("forgot-password").addEventListener("click",async()=>{
    const fr=guestLang==="fr",button=$("forgot-password"),message=$("recovery-message");
    if(!DEFAULT_FIREBASE_CONFIG){message.textContent=fr?"La récupération du compte sera disponible après l’activation de la sauvegarde en ligne.":"Account recovery will be available once online backup is configured.";return;}
    const email=$("email").value.trim();
    if(!email){message.textContent=fr?"Saisis ton adresse e-mail ci-dessus.":"Enter your email address above.";return;}
    button.disabled=true;
    const result=await send({type:"SYNC_PASSWORD_RESET",payload:{firebase:DEFAULT_FIREBASE_CONFIG,email}});
    button.disabled=false;
    message.textContent=result.ok
      ? (fr?"Si un compte correspond à cette adresse, un lien de réinitialisation sera envoyé. Vérifie aussi les courriers indésirables.":"If an account matches this address, a reset link will be sent. Check your spam folder too.")
      : result.error==="rate_limited"
        ? (fr?"Attends une minute avant de réessayer.":"Wait a minute before trying again.")
        : result.error==="invalid_email"
          ? (fr?"Vérifie ton adresse e-mail.":"Check your email address.")
          : (fr?"La demande n’a pas pu être confirmée. Réessaie plus tard.":"The request could not be confirmed. Try again later.");
  });

  $("signin").addEventListener("click", () => authenticate("SYNC_SIGN_IN"));
  $("signup").addEventListener("click", () => authenticate("SYNC_SIGN_UP"));

  $("syncnow").addEventListener("click", async () => {
    clearMsg($("msg-in"));
    $("syncnow").disabled = true;
    const resp = await send({ type: "SYNC_NOW" });
    $("syncnow").disabled = false;
    if (resp.ok) { const status=await send({type:"SYNC_STATUS"}); showMsg($("msg-in"),backupLabel(status),status.state==="saved"?"ok":""); }
    else showMsg($("msg-in"), errorText(resp.error), "err");
    render();
  });

  $("signout").addEventListener("click", async () => {
    const result=await send({ type: "SYNC_SIGN_OUT" });
    if(!result.ok)return showMsg($("msg-in"),errorText(result.error),"err");
    render();
  });
});
