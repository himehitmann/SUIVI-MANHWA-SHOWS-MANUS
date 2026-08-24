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
  };
  if (map[code]) return map[code];
  if (/^http_\d+/.test(code || "")) return "Couldn't reach the backend. Check the URL.";
  if (/^push_\d+/.test(code || "")) return "Sync upload failed. Try again.";
  return "Something went wrong. Check the backend URL and try again.";
}

async function render() {
  const s = await send({ type: "SYNC_STATUS" });
  if (s.configured) {
    $("signed-out").classList.add("hidden");
    $("signed-in").classList.remove("hidden");
    $("who").textContent = s.email || "Signed in";
    $("plan").textContent = (s.plan || "free").toUpperCase();
    $("endpoint").textContent = (s.apiUrl || "").replace(/^https?:\/\//, "");
    $("lastsync").textContent = fmtTime(s.meta && s.meta.lastSyncAt);
    if (s.meta && s.meta.lastError) showMsg($("msg-in"), errorText(s.meta.lastError), "err");
  } else {
    $("signed-in").classList.add("hidden");
    $("signed-out").classList.remove("hidden");
    // Prefill last-used backend URL for convenience.
    if (s.apiUrl) $("apiUrl").value = s.apiUrl;
  }
}

async function authenticate(type) {
  const apiUrl = $("apiUrl").value.trim();
  const email = $("email").value.trim();
  const password = $("password").value;
  clearMsg($("msg-out"));
  if (!apiUrl) return showMsg($("msg-out"), "Enter your backend URL.", "err");
  if (!email || !password) return showMsg($("msg-out"), "Enter your email and password.", "err");

  $("signin").disabled = true;
  $("signup").disabled = true;
  const resp = await send({ type, payload: { apiUrl, email, password } });
  $("signin").disabled = false;
  $("signup").disabled = false;

  if (!resp.ok) return showMsg($("msg-out"), errorText(resp.error), "err");
  await render();
  if (resp.warn) showMsg($("msg-in"), "Signed in, but the first sync failed: " + errorText(resp.warn), "err");
  else if (resp.result) showMsg($("msg-in"), `Synced — ${resp.result.items} works in your library.`, "ok");
}

document.addEventListener("DOMContentLoaded", () => {
  render();

  $("signin").addEventListener("click", () => authenticate("SYNC_SIGN_IN"));
  $("signup").addEventListener("click", () => authenticate("SYNC_SIGN_UP"));

  $("syncnow").addEventListener("click", async () => {
    clearMsg($("msg-in"));
    $("syncnow").disabled = true;
    const resp = await send({ type: "SYNC_NOW" });
    $("syncnow").disabled = false;
    if (resp.ok) showMsg($("msg-in"), `Synced — ${resp.result.items} works, ${resp.result.sites} sites.`, "ok");
    else showMsg($("msg-in"), errorText(resp.error), "err");
    render();
  });

  $("signout").addEventListener("click", async () => {
    await send({ type: "SYNC_SIGN_OUT" });
    render();
  });
});
