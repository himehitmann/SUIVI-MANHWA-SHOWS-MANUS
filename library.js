/* Dasi — local-first tracker home. Vanilla, no build step. */
const api = globalThis.chrome;
const UNLOCK_ALL = typeof DASI_UNLOCK_ALL !== "undefined" ? DASI_UNLOCK_ALL : true;

let items = [], sites = [], notifications = [], lists = [];
let settings = { notifyNew: true, lang: "en", profile: { name: "", avatar: "" } };
let filter = "all", query = "", currentListId = null, view = "home";
let spotIdx = 0, spotItems = [], spotTimer = null;

const NEW_WINDOW = 14 * 24 * 3600 * 1000;
const SOON_WINDOW = 30 * 24 * 3600 * 1000;
const DASI_STORE_URL = "https://chromewebstore.google.com/detail/dasi";
const SHARE_TEXT = "Dasi — never lose your spot in any manga, webtoon, anime, series or game. Save & resume in one click.";

/* ---- i18n (en/fr full; others cover the visible shell, fall back to en) --- */
const LANGS = {
  en: { name:"English", home:"Home", library:"Library", lists:"Lists", games:"Games", plans:"Plans", settings:"Settings",
    search:"Search", librarySub:"Everything you saved, kept on this device.", listsSub:"Group your works your way — drag to reorder, pick a cover.",
    continue:"Jump back in", newWeek:"New this week", becauseYouLove:"Because you love {g}", yourGenres:"Your genres", recentlyAdded:"Recently added",
    resume:"Resume", details:"Details", welcomeTitle:"Welcome to Dasi", welcomeBody:"Open any manga, webtoon, anime, series or game and hit save in the Dasi popup. It lands here — beautifully.",
    tracked:"Tracked", reading:"Reading", watching:"Watching", favorites:"Favorites", finished:"Finished",
    all:"All", markFinished:"Mark finished", markUnfinished:"Mark unfinished", open:"Open", progress:"Progress", rating:"Rating", tags:"Tags", synopsis:"Synopsis", manage:"Manage", removeLib:"Remove from library", showMore:"Show more", showLess:"Show less",
    newList:"New list", cover:"Cover", rename:"Rename", delete:"Delete", inThisList:"In this list", addWorks:"Add works", allLists:"All lists", dragReorder:"drag to reorder",
    gamesSub:"Track awaited games — release dates, prices, trailers and pre-registrations.", addGame:"Add a game", title:"Title", platform:"Platform", releaseDate:"Release date", price:"Price", trailer:"Trailer", watchTrailer:"Watch trailer", preRegistered:"Pre-registered", released:"Released", comingSoon:"Coming soon", add:"Add", cancel:"Cancel", free:"Free",
    editProfile:"Edit profile", displayName:"Display name", changePhoto:"Change photo", newAlerts:"New-episode alerts", newAlertsSub:"Flag works with something released you haven't seen.", backup:"Backup", yourLibrary:"Your library", exportRestore:"Export a backup file, or restore one.", export:"Export", import:"Import", cloudSync:"Cloud sync", cloudSyncSub:"Optional — sign in to sync across devices.", manageSync:"Manage", rateShare:"Rate & share", rateShareSub:"It helps others discover Dasi.", spread:"Spread the word", enjoying:"Enjoying Dasi?",
    plansTitle:"Choose your plan", plansSub:"Free forever for local tracking. Go Pro for sync, alerts and more.", unlocked:"Owner edition — every Pro feature is unlocked.", mostPopular:"Most popular", getStarted:"Get started", goPro:"Go Pro", getLifetime:"Get Lifetime", currentPlan:"Current",
    updatesNone:"Nothing new right now", updatesSome:"{n} with something new" },
  fr: { name:"Français", home:"Accueil", library:"Bibliothèque", lists:"Listes", games:"Jeux", plans:"Abonnements", settings:"Paramètres",
    search:"Rechercher", librarySub:"Tout ce que tu as enregistré, gardé sur cet appareil.", listsSub:"Classe tes œuvres à ta façon — glisse pour réordonner, choisis une couverture.",
    continue:"Reprendre", newWeek:"Nouveautés de la semaine", becauseYouLove:"Parce que tu aimes {g}", yourGenres:"Tes genres", recentlyAdded:"Ajoutés récemment",
    resume:"Reprendre", details:"Détails", welcomeTitle:"Bienvenue sur Dasi", welcomeBody:"Ouvre un manga, webtoon, anime, série ou jeu et clique sur enregistrer dans la bulle Dasi. Ça arrive ici — élégamment.",
    tracked:"Suivis", reading:"Lecture", watching:"Visionnage", favorites:"Favoris", finished:"Terminés",
    all:"Tout", markFinished:"Marquer terminé", markUnfinished:"Marquer en cours", open:"Ouvrir", progress:"Progression", rating:"Note", tags:"Tags", synopsis:"Synopsis", manage:"Gérer", removeLib:"Retirer de la bibliothèque", showMore:"Voir plus", showLess:"Voir moins",
    newList:"Nouvelle liste", cover:"Couverture", rename:"Renommer", delete:"Supprimer", inThisList:"Dans cette liste", addWorks:"Ajouter des œuvres", allLists:"Toutes les listes", dragReorder:"glisser pour réordonner",
    gamesSub:"Suis les jeux attendus — dates de sortie, prix, trailers et préinscriptions.", addGame:"Ajouter un jeu", title:"Titre", platform:"Plateforme", releaseDate:"Date de sortie", price:"Prix", trailer:"Trailer", watchTrailer:"Voir le trailer", preRegistered:"Préinscrit", released:"Sorti", comingSoon:"Bientôt", add:"Ajouter", cancel:"Annuler", free:"Gratuit",
    editProfile:"Modifier le profil", displayName:"Nom affiché", changePhoto:"Changer la photo", newAlerts:"Alertes nouveaux épisodes", newAlertsSub:"Signale les œuvres avec du contenu sorti que tu n'as pas vu.", backup:"Sauvegarde", yourLibrary:"Ta bibliothèque", exportRestore:"Exporte une sauvegarde, ou restaure-la.", export:"Exporter", import:"Importer", cloudSync:"Sync cloud", cloudSyncSub:"Optionnel — connecte-toi pour synchroniser tes appareils.", manageSync:"Gérer", rateShare:"Noter & partager", rateShareSub:"Ça aide les autres à découvrir Dasi.", spread:"Fais passer le mot", enjoying:"Tu aimes Dasi ?",
    plansTitle:"Choisis ton abonnement", plansSub:"Gratuit à vie pour le suivi local. Passe Pro pour la sync, les alertes et plus.", unlocked:"Édition propriétaire — toutes les fonctions Pro sont débloquées.", mostPopular:"Le plus populaire", getStarted:"Commencer", goPro:"Passer Pro", getLifetime:"À vie", currentPlan:"Actuel",
    updatesNone:"Rien de nouveau pour l'instant", updatesSome:"{n} avec du nouveau" },
  es: { name:"Español", home:"Inicio", library:"Biblioteca", lists:"Listas", games:"Juegos", plans:"Planes", settings:"Ajustes", search:"Buscar",
    continue:"Continuar", newWeek:"Novedades de la semana", becauseYouLove:"Porque te gusta {g}", yourGenres:"Tus géneros", recentlyAdded:"Añadidos recientemente",
    resume:"Reanudar", details:"Detalles", welcomeTitle:"Bienvenido a Dasi", tracked:"Seguidos", reading:"Lectura", watching:"Viendo", favorites:"Favoritos", finished:"Terminados", all:"Todo",
    gamesSub:"Sigue juegos esperados — fechas, precios, tráilers y prerregistros.", addGame:"Añadir un juego", plansTitle:"Elige tu plan", mostPopular:"Más popular", goPro:"Hazte Pro", getLifetime:"De por vida", free:"Gratis", watchTrailer:"Ver tráiler", preRegistered:"Prerregistrado" },
  de: { name:"Deutsch", home:"Start", library:"Bibliothek", lists:"Listen", games:"Spiele", plans:"Abos", settings:"Einstellungen", search:"Suchen",
    continue:"Weiterlesen", newWeek:"Neu diese Woche", becauseYouLove:"Weil du {g} magst", yourGenres:"Deine Genres", recentlyAdded:"Kürzlich hinzugefügt",
    resume:"Fortsetzen", details:"Details", welcomeTitle:"Willkommen bei Dasi", tracked:"Verfolgt", reading:"Lesen", watching:"Sehen", favorites:"Favoriten", finished:"Beendet", all:"Alle",
    gamesSub:"Verfolge erwartete Spiele — Release, Preise, Trailer und Vorregistrierungen.", addGame:"Spiel hinzufügen", plansTitle:"Wähle deinen Plan", mostPopular:"Am beliebtesten", goPro:"Pro werden", getLifetime:"Lebenslang", free:"Gratis", watchTrailer:"Trailer ansehen", preRegistered:"Vorregistriert" },
  ja: { name:"日本語", home:"ホーム", library:"ライブラリ", lists:"リスト", games:"ゲーム", plans:"プラン", settings:"設定", search:"検索",
    continue:"続きから", newWeek:"今週の新着", becauseYouLove:"{g}が好きだから", yourGenres:"あなたのジャンル", recentlyAdded:"最近追加",
    resume:"再開", details:"詳細", welcomeTitle:"Dasiへようこそ", tracked:"追跡中", reading:"読書", watching:"視聴", favorites:"お気に入り", finished:"完了", all:"すべて",
    gamesSub:"気になるゲームを追跡 — 発売日・価格・トレーラー・事前登録。", addGame:"ゲームを追加", plansTitle:"プランを選択", mostPopular:"人気", goPro:"Proにする", getLifetime:"買い切り", free:"無料", watchTrailer:"トレーラー", preRegistered:"事前登録済み" },
  ko: { name:"한국어", home:"홈", library:"라이브러리", lists:"리스트", games:"게임", plans:"플랜", settings:"설정", search:"검색",
    continue:"이어보기", newWeek:"이번 주 신규", becauseYouLove:"{g}을(를) 좋아해서", yourGenres:"내 장르", recentlyAdded:"최근 추가",
    resume:"계속", details:"상세", welcomeTitle:"Dasi에 오신 걸 환영합니다", tracked:"추적", reading:"읽기", watching:"시청", favorites:"즐겨찾기", finished:"완료", all:"전체",
    gamesSub:"기대되는 게임 추적 — 출시일·가격·트레일러·사전예약.", addGame:"게임 추가", plansTitle:"플랜 선택", mostPopular:"인기", goPro:"Pro 시작", getLifetime:"평생", free:"무료", watchTrailer:"트레일러", preRegistered:"사전예약됨" },
  pt: { name:"Português", home:"Início", library:"Biblioteca", lists:"Listas", games:"Jogos", plans:"Planos", settings:"Definições", search:"Pesquisar",
    continue:"Continuar", newWeek:"Novidades da semana", becauseYouLove:"Porque gostas de {g}", yourGenres:"Os teus géneros", recentlyAdded:"Adicionados recentemente",
    resume:"Retomar", details:"Detalhes", welcomeTitle:"Bem-vindo ao Dasi", tracked:"Seguidos", reading:"Leitura", watching:"A ver", favorites:"Favoritos", finished:"Terminados", all:"Tudo",
    gamesSub:"Segue jogos esperados — lançamentos, preços, trailers e pré-registos.", addGame:"Adicionar jogo", plansTitle:"Escolhe o teu plano", mostPopular:"Mais popular", goPro:"Ser Pro", getLifetime:"Vitalício", free:"Grátis", watchTrailer:"Ver trailer", preRegistered:"Pré-registado" },
};
const t = (k, p) => { let s = (LANGS[settings.lang] && LANGS[settings.lang][k]) || LANGS.en[k] || k; if (p) for (const key in p) s = s.replace(`{${key}}`, p[key]); return s; };

/* ---- SVG icons ---- */
const I = {
  star:'<svg class="ic fill" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.9 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  close:'<svg class="ic" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  open:'<svg class="ic" viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></svg>',
  play:'<svg class="ic fill" viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  plus:'<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus:'<svg class="ic" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  trash:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>',
  check:'<svg class="ic" viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></svg>',
  grip:'<svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4" class="fill"/><circle cx="9" cy="12" r="1.4" class="fill"/><circle cx="9" cy="18" r="1.4" class="fill"/><circle cx="15" cy="6" r="1.4" class="fill"/><circle cx="15" cy="12" r="1.4" class="fill"/><circle cx="15" cy="18" r="1.4" class="fill"/></svg>',
  back:'<svg class="ic" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  image:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 20"/></svg>',
  user:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  gear:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  crown:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/></svg>',
  x:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 4l16 16M20 4 4 20"/></svg>',
  fb:'<svg class="ic" viewBox="0 0 24 24"><path d="M14 8h2V5h-2c-2 0-3 1.3-3 3v2H9v3h2v6h3v-6h2l1-3h-3V8.5c0-.3.2-.5.5-.5z" fill="currentColor" stroke="none"/></svg>',
  wa:'<svg class="ic" viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path d="M8.5 8.5c-.3 0-.6.1-.8.5s-.7 1-.7 1.8 1 2.2 1.2 2.4 1.9 3 4.6 4c2.2.8 2.2.5 2.6.5s1.3-.5 1.5-1 .2-1 .1-1.1l-1.6-.8c-.2-.1-.5-.2-.7.1l-.7.8c-.1.2-.3.2-.5.1a5.6 5.6 0 0 1-2.8-2.6c-.1-.3 0-.4.1-.6l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.1-.3-.3-.3-.5-.3z" fill="currentColor" stroke="none"/></svg>',
  rd:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><circle cx="9" cy="13" r="1" class="fill"/><circle cx="15" cy="13" r="1" class="fill"/><path d="M9 16.5c1.7 1 4.3 1 6 0"/><circle cx="16.5" cy="6" r="1.2" class="fill"/><path d="M16 6.5 15 11"/></svg>',
  link:'<svg class="ic" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
  game:'<svg class="ic" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 12h3M8.5 10.5v3"/><circle cx="15.5" cy="11" r="1" class="fill"/><circle cx="17.5" cy="13" r="1" class="fill"/></svg>',
  book:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></svg>',
};

const accentFor = (i) => (i.type === "watching" ? "#7E9BE6" : i.type === "game" ? "#E08A4F" : "#5FB79A");
const coverUrl = (i) => i.coverOverride || i.cover || "";
const isNew = (i) => Date.now() - (i.updatedAt || 0) < NEW_WINDOW && (i.progress || 0) < 100 && i.type !== "game";
const parseDate = (s) => { if (!s) return null; const d = Date.parse(s); return Number.isFinite(d) ? d : null; };
const isSoon = (i) => { const d = parseDate(i.releaseDate); return d && d > Date.now() && d - Date.now() < SOON_WINDOW; };
const isReleased = (i) => { const d = parseDate(i.releaseDate); return i.released || (d && d <= Date.now()); };

function marker(i) {
  if (i.type === "game") return i.platform || (i.releaseDate ? i.releaseDate : "Game");
  const parts = i.type === "watching"
    ? [i.season && `${t("watching") ? "" : ""}Season ${i.season}`, i.episode && `Episode ${i.episode}`]
    : [i.volume && `Vol. ${i.volume}`, i.chapter && `Chapter ${i.chapter}`, i.page && `Page ${i.page}`];
  return parts.filter(Boolean).join(" · ") || i.domain || "";
}
function relative(ts) {
  if (!ts) return "";
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : `${d} days ago`;
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function initials(s) { return (s || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"; }
function coverInner(i, fs) { const u = coverUrl(i); return u ? `<img src="${esc(u)}" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span${fs ? ` style="font-size:${fs}px"` : ""}>${esc((i.title || "?")[0].toUpperCase())}</span>`; }

let toastT;
function toast(m) { const el = document.getElementById("toast"); el.textContent = m; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1800); }

function update(id, patch) {
  const it = items.find((x) => x.id === id);
  if (it) Object.assign(it, patch);
  renderAll();
  api.runtime.sendMessage({ type: "UPDATE_ITEM", id, patch }, (r) => { if (r?.items) { items = r.items; renderAll(); } });
}

/* ================= HOME ================= */
function topGenres() {
  const count = {};
  for (const i of items) for (const g of i.tags || []) count[g] = (count[g] || 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
}
function posterHtml(i) {
  const flag = isNew(i) ? `<span class="flag">${t("newWeek").split(" ")[0].toUpperCase()}</span>` : isSoon(i) ? `<span class="flag soon">${t("comingSoon")}</span>` : "";
  return `<div class="poster" data-open="${i.id}">
    <div class="art" style="background:${i.accent || accentFor(i)}">${coverInner(i, 30)}${flag}
      ${(i.progress || 0) > 0 && (i.progress || 0) < 100 ? `<div class="prog"><i style="width:${i.progress}%;background:${accentFor(i)}"></i></div>` : ""}
    </div>
    <h4>${esc(i.title || "Untitled")}</h4><small>${esc(marker(i))}</small>
  </div>`;
}
function row(titleText, list, extra) {
  if (!list.length) return "";
  return `<div class="section-h"><h2>${esc(titleText)}</h2>${extra ? `<span>${esc(extra)}</span>` : ""}</div>
    <div class="scroll-x">${list.map(posterHtml).join("")}</div>`;
}
function renderHome() {
  const el = document.getElementById("view-home");
  if (!items.length) {
    el.innerHTML = `<div class="onboard"><div class="big"><i></i></div><h2>${t("welcomeTitle")}</h2><p>${t("welcomeBody")}</p></div>`;
    return;
  }
  const inProgress = items.filter((i) => i.type !== "game" && (i.progress || 0) < 100).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const news = items.filter(isNew).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const soon = items.filter((i) => i.type === "game" && isSoon(i));
  const recent = [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 12);
  const genres = topGenres();
  const topG = genres[0]?.[0];
  const reco = topG ? items.filter((i) => (i.tags || []).includes(topG)).sort((a, b) => (b.rating || 0) - (a.rating || 0)) : [];

  spotItems = [...news, ...soon, ...inProgress].filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx).slice(0, 6);
  if (!spotItems.length) spotItems = recent.slice(0, 4);

  el.innerHTML = `
    <div id="spot-wrap">${spotHtml(spotItems[spotIdx % Math.max(1, spotItems.length)])}${spotItems.length > 1 ? `<div class="dots" id="dots">${spotItems.map((_, i) => `<i class="${i === spotIdx % spotItems.length ? "on" : ""}" data-dot="${i}"></i>`).join("")}</div>` : ""}</div>
    ${row(t("continue"), inProgress.slice(0, 14))}
    ${row(t("newWeek"), news.slice(0, 14))}
    ${topG && reco.length > 1 ? row(t("becauseYouLove", { g: topG }), reco.slice(0, 14)) : ""}
    ${genres.length ? `<div class="section-h"><h2>${t("yourGenres")}</h2></div><div class="genres">${genres.slice(0, 10).map(([g, n]) => `<span class="genre" data-genre="${esc(g)}">${esc(g)} <b>${n}</b></span>`).join("")}</div>` : ""}
    ${row(t("recentlyAdded"), recent)}
  `;
  bindHome();
  startSpot();
}
function spotHtml(i) {
  if (!i) return "";
  const u = coverUrl(i);
  const badges = [
    i.type === "game" ? `<span class="pill game">${I.game} ${esc(i.platform || t("games"))}</span>` : "",
    isNew(i) ? `<span class="pill new">${t("newWeek")}</span>` : "",
    isSoon(i) ? `<span class="pill soon">${t("comingSoon")}</span>` : "",
  ].filter(Boolean).join("");
  return `<div class="spot" data-open="${i.id}">
    ${u ? `<div class="spot-bg" style="background-image:url('${esc(u)}')"></div>` : `<div class="spot-fallback"></div>`}
    <div class="spot-grad"></div>
    <div class="spot-inner">
      <div class="spot-badges">${badges || `<span class="pill">${esc((i.type === "watching" ? t("watching") : i.type === "game" ? t("games") : t("reading")))}</span>`}</div>
      <h2>${esc(i.title || "Untitled")}</h2>
      <p>${esc(i.synopsis ? i.synopsis.slice(0, 120) + (i.synopsis.length > 120 ? "…" : "") : marker(i))}</p>
      <div class="spot-cta">
        ${i.url ? `<a class="btn-glass" href="${esc(i.url)}" target="_blank" rel="noreferrer" data-stop>${I.play} ${t("resume")}</a>` : ""}
        <button class="btn-glass ghost" data-details="${i.id}">${t("details")}</button>
      </div>
    </div>
  </div>`;
}
function startSpot() {
  clearInterval(spotTimer);
  if (spotItems.length < 2) return;
  spotTimer = setInterval(() => { if (view !== "home") return; spotIdx = (spotIdx + 1) % spotItems.length; refreshSpot(); }, 6000);
}
function refreshSpot() {
  const wrap = document.getElementById("spot-wrap");
  if (!wrap) return;
  wrap.innerHTML = `${spotHtml(spotItems[spotIdx % spotItems.length])}${spotItems.length > 1 ? `<div class="dots" id="dots">${spotItems.map((_, i) => `<i class="${i === spotIdx % spotItems.length ? "on" : ""}" data-dot="${i}"></i>`).join("")}</div>` : ""}`;
  bindHome();
}
function bindHome() {
  document.querySelectorAll("#view-home [data-open]").forEach((n) => (n.onclick = (e) => { if (!e.target.closest("[data-stop],[data-details]")) openDrawer(n.dataset.open); }));
  document.querySelectorAll("#view-home [data-details]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openDrawer(b.dataset.details); }));
  document.querySelectorAll("#view-home [data-dot]").forEach((d) => (d.onclick = (e) => { e.stopPropagation(); spotIdx = Number(d.dataset.dot); refreshSpot(); }));
  document.querySelectorAll("#view-home [data-genre]").forEach((g) => (g.onclick = () => { query = g.dataset.genre; document.getElementById("q").value = query; switchView("library"); renderGrid(); }));
}

/* ================= LIBRARY ================= */
function renderStats() {
  const s = [
    [items.filter((i) => i.type !== "game").length, t("tracked")],
    [items.filter((i) => i.type === "reading").length, t("reading")],
    [items.filter((i) => i.type === "watching").length, t("watching")],
    [items.filter((i) => i.favorite).length, t("favorites")],
    [items.filter((i) => (i.progress || 0) >= 100).length, t("finished")],
  ];
  document.getElementById("stats").innerHTML = s.map(([n, l]) => `<div class="chip"><b>${n}</b><span>${l}</span></div>`).join("");
}
function renderFilters() {
  const f = [["all", t("all")], ["reading", t("reading")], ["watching", t("watching")], ["favorites", t("favorites")]];
  document.getElementById("filters").innerHTML = f.map(([k, l]) => `<button data-f="${k}" class="${filter === k ? "active" : ""}">${l}</button>`).join("");
}
function cardHtml(i) {
  const rating = i.rating || 0;
  const tags = (i.tags || []).slice(0, 4).map((x) => `<span class="tag">${esc(x)}</span>`).join("");
  return `<article class="card" data-open="${i.id}">
    <button class="fav ${i.favorite ? "on" : ""}" data-fav="${i.id}">${I.star}</button>
    <div class="cover" style="background:${i.accent || accentFor(i)}">${coverInner(i)}${isNew(i) ? '<span class="new-flag">NEW</span>' : ""}</div>
    <div class="card-body">
      <h3>${esc(i.title || "Untitled")}</h3><p>${esc(marker(i))}</p>
      ${(i.progress || 0) > 0 ? `<div class="bar"><i style="width:${Math.min(100, i.progress)}%;background:${accentFor(i)}"></i></div>` : ""}
      <small>${relative(i.updatedAt)}</small>
      <div class="rate">${[1,2,3,4,5].map((n) => `<span data-rate="${i.id}" data-v="${n}">${I.star.replace('class="ic fill"', `class="ic fill ${n <= rating ? "on" : ""}"`)}</span>`).join("")}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
    </div>
  </article>`;
}
function renderGrid() {
  const grid = document.getElementById("grid");
  const q = query.toLowerCase();
  const list = items.filter((i) => {
    if (i.type === "game") return false;
    if (filter === "favorites" && !i.favorite) return false;
    if ((filter === "reading" || filter === "watching") && i.type !== filter) return false;
    if (!q) return true;
    return `${i.title} ${marker(i)} ${(i.tags || []).join(" ")}`.toLowerCase().includes(q);
  });
  grid.innerHTML = list.length ? [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(cardHtml).join("") : `<p class="empty">${t("welcomeBody")}</p>`;
}

/* ================= GAMES ================= */
function gameCardHtml(i) {
  const released = isReleased(i), soon = isSoon(i);
  return `<div class="game-card">
    <div class="game-cover">${coverInner(i, 24)}</div>
    <div class="game-body">
      <h3>${esc(i.title)}</h3>
      <div class="game-meta">
        ${i.platform ? `<span class="meta-pill">${I.game} ${esc(i.platform)}</span>` : ""}
        ${i.releaseDate ? `<span class="meta-pill date">${esc(i.releaseDate)}${soon ? " · " + t("comingSoon") : released ? " · " + t("released") : ""}</span>` : ""}
        ${i.price ? `<span class="meta-pill price">${esc(i.price)}</span>` : ""}
      </div>
      <div class="game-actions">
        ${i.trailer ? `<a class="btn" href="${esc(i.trailer)}" target="_blank" rel="noreferrer">${I.play} ${t("watchTrailer")}</a>` : ""}
        ${i.url ? `<a class="btn" href="${esc(i.url)}" target="_blank" rel="noreferrer">${I.open} ${t("open")}</a>` : ""}
        <label class="prereg ${i.preregistered ? "on" : ""}" data-prereg="${i.id}"><span class="box">${i.preregistered ? I.check : ""}</span>${t("preRegistered")}</label>
        <button class="btn danger" data-rmgame="${i.id}">${I.trash}</button>
      </div>
    </div>
  </div>`;
}
function renderGames() {
  const el = document.getElementById("view-games");
  const games = items.filter((i) => i.type === "game").sort((a, b) => (parseDate(a.releaseDate) || 9e15) - (parseDate(b.releaseDate) || 9e15));
  el.innerHTML = `
    <div class="section-h" style="margin-top:0"><h1 style="margin:0">${t("games")}</h1><button class="btn primary" id="add-game">${I.plus} ${t("addGame")}</button></div>
    <p class="sub">${t("gamesSub")}</p>
    <div id="game-form"></div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">${games.length ? games.map(gameCardHtml).join("") : `<p class="empty">${t("gamesSub")}</p>`}</div>`;
  document.getElementById("add-game").onclick = showGameForm;
  el.querySelectorAll("[data-prereg]").forEach((l) => (l.onclick = () => { const it = items.find((x) => x.id === l.dataset.prereg); if (it) update(it.id, { preregistered: !it.preregistered }); }));
  el.querySelectorAll("[data-rmgame]").forEach((b) => (b.onclick = () => { if (confirm("Remove this game?")) api.runtime.sendMessage({ type: "REMOVE_ITEM", id: b.dataset.rmgame }, (r) => { items = r?.items || items; renderAll(); }); }));
}
function showGameForm() {
  const f = document.getElementById("game-form");
  f.innerHTML = `<div class="panel" style="padding:18px 20px;margin-bottom:16px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <input class="field" id="g-title" placeholder="${t("title")} *" style="grid-column:1/-1" />
      <input class="field" id="g-platform" placeholder="${t("platform")}" />
      <input class="field" id="g-date" placeholder="${t("releaseDate")} (e.g. 2026-11-20)" />
      <input class="field" id="g-price" placeholder="${t("price")}" />
      <input class="field" id="g-trailer" placeholder="${t("trailer")} URL" />
      <input class="field" id="g-cover" placeholder="${t("cover")} URL" style="grid-column:1/-1" />
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn primary" id="g-save">${t("add")}</button>
      <button class="btn" id="g-cancel">${t("cancel")}</button>
    </div></div>`;
  document.getElementById("g-cancel").onclick = () => (f.innerHTML = "");
  document.getElementById("g-save").onclick = () => {
    const title = document.getElementById("g-title").value.trim();
    if (!title) { document.getElementById("g-title").focus(); return; }
    const payload = {
      title, type: "game", url: "",
      platform: document.getElementById("g-platform").value.trim() || undefined,
      releaseDate: document.getElementById("g-date").value.trim() || undefined,
      price: document.getElementById("g-price").value.trim() || undefined,
      trailer: document.getElementById("g-trailer").value.trim() || undefined,
      cover: document.getElementById("g-cover").value.trim() || undefined,
      domain: "manual",
    };
    api.runtime.sendMessage({ type: "SAVE_PROGRESS", payload }, () => { api.runtime.sendMessage({ type: "GET_STATE" }, hydrate); toast(t("add") + " ✓"); });
  };
}

/* ================= PLANS ================= */
function renderPlans() {
  const el = document.getElementById("view-plans");
  const feat = (arr) => arr.map((x) => `<li>${I.check} ${esc(x)}</li>`).join("");
  el.innerHTML = `
    <h1>${t("plansTitle")}</h1><p class="sub">${t("plansSub")}</p>
    ${UNLOCK_ALL ? `<div class="unlocked-banner">${I.crown} ${t("unlocked")}</div>` : ""}
    <div class="plan-grid">
      <div class="plan">
        <h3>Free</h3><div class="price">$0</div><div class="per">forever</div>
        <ul>${feat(["Local tracking, unlimited works", "Manual add + imports", "Lists, tags, ratings", "Games watchlist"])}</ul>
        <button class="cta" data-plan="free">${UNLOCK_ALL ? t("currentPlan") : t("getStarted")}</button>
      </div>
      <div class="plan feat"><span class="ptag">${t("mostPopular")}</span>
        <h3>Pro</h3><div class="price">$2.99<small>/mo</small></div><div class="per">or $24.99/yr</div>
        <ul>${feat(["Everything in Free", "Encrypted multi-device sync", "New-episode & release alerts", "Full stats & insights", "Priority new features"])}</ul>
        <button class="cta" data-plan="pro">${UNLOCK_ALL ? t("currentPlan") : t("goPro")}</button>
      </div>
      <div class="plan">
        <h3>Lifetime</h3><div class="price">$49</div><div class="per">one-time</div>
        <ul>${feat(["Everything in Pro", "Forever, no subscription", "Founder badge", "All future updates"])}</ul>
        <button class="cta" data-plan="lifetime">${UNLOCK_ALL ? t("currentPlan") : t("getLifetime")}</button>
      </div>
    </div>`;
  el.querySelectorAll("[data-plan]").forEach((b) => (b.onclick = () => {
    if (UNLOCK_ALL) { toast(t("unlocked")); return; }
    api.runtime.openOptionsPage();
  }));
}

/* ================= LISTS ================= */
function listCover(l) { return l.cover && /^https?:|^data:/.test(l.cover) ? `background-image:url('${esc(l.cover)}')` : `background:${esc(l.cover || "#EDE6FF")}`; }
function isImg(v) { return v && /^https?:|^data:/.test(v); }
function renderLists() {
  const grid = document.getElementById("list-grid");
  grid.innerHTML = lists.map((l) => `<div class="list-card" data-list="${l.id}">
      <div class="list-cover" style="${listCover(l)}">${isImg(l.cover) ? "" : esc((l.name || "?")[0].toUpperCase())}</div>
      <div class="list-meta"><b>${esc(l.name)}</b><span>${(l.itemIds || []).length} work${(l.itemIds || []).length === 1 ? "" : "s"}</span></div>
    </div>`).join("") + `<button class="list-card new-list" id="new-list">${I.plus}<span>${t("newList")}</span></button>`;
}
function openList(id) { currentListId = id; document.getElementById("lists-index").hidden = true; document.getElementById("list-detail").hidden = false; renderListDetail(); }
function renderListDetail() {
  const l = lists.find((x) => x.id === currentListId);
  const wrap = document.getElementById("list-detail");
  if (!l) return backToLists();
  const members = (l.itemIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
  const notIn = items.filter((i) => !(l.itemIds || []).includes(i.id));
  wrap.innerHTML = `<button class="back-btn" id="back-lists">${I.back} ${t("allLists")}</button>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px">
      <div class="list-cover" style="width:64px;height:64px;border-radius:14px;font-size:24px;${listCover(l)}">${isImg(l.cover) ? "" : esc((l.name || "?")[0].toUpperCase())}</div>
      <div style="flex:1;min-width:180px">
        <input id="list-name" value="${esc(l.name)}" style="font-size:24px;font-weight:800;letter-spacing:-.03em;border:0;border-bottom:2px solid transparent;background:none;width:100%;outline:none;padding:2px 0" />
        <small style="color:var(--muted)">${members.length} work${members.length === 1 ? "" : "s"} · ${t("dragReorder")}</small>
      </div>
      <button class="btn" id="list-cover-btn">${I.image} ${t("cover")}</button>
      <button class="btn danger" id="list-del">${I.trash} ${t("delete")}</button>
    </div>
    <div class="section-t">${t("inThisList")}</div>
    <div id="list-items">${members.length ? members.map((i) => `<div class="li-row" draggable="true" data-id="${i.id}">
        <span class="grip">${I.grip}</span>
        <div class="li-cover" style="background:${i.accent || accentFor(i)}">${coverInner(i)}</div>
        <div style="flex:1;min-width:0"><b>${esc(i.title)}</b><small>${esc(marker(i))}</small></div>
        <button class="btn danger" data-remove="${i.id}">${t("delete")}</button></div>`).join("") : `<p class="empty" style="padding:24px 0">—</p>`}</div>
    ${notIn.length ? `<div class="section-t">${t("addWorks")}</div><div class="chips-wrap">${notIn.map((i) => `<button class="chip-toggle" data-add="${i.id}">${I.plus} ${esc(i.title)}</button>`).join("")}</div>` : ""}`;
  wireListDetail(l);
}
function wireListDetail(l) {
  document.getElementById("back-lists").onclick = backToLists;
  const name = document.getElementById("list-name");
  name.onchange = () => listMsg("LIST_UPDATE", { id: l.id, patch: { name: name.value.trim() || "Untitled" } });
  document.getElementById("list-cover-btn").onclick = () => changeCover((v) => listMsg("LIST_UPDATE", { id: l.id, patch: { cover: v } }));
  document.getElementById("list-del").onclick = () => { if (confirm(`${t("delete")} "${l.name}"?`)) listMsg("LIST_DELETE", { id: l.id }, backToLists); };
  document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => setListItems(l.id, [...(l.itemIds || []), b.dataset.add])));
  document.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => setListItems(l.id, (l.itemIds || []).filter((x) => x !== b.dataset.remove))));
  enableDrag(l);
}
function enableDrag(l) {
  const c = document.getElementById("list-items");
  let dragEl = null;
  c.querySelectorAll(".li-row").forEach((row) => {
    row.addEventListener("dragstart", () => { dragEl = row; row.classList.add("dragging"); });
    row.addEventListener("dragend", () => { row.classList.remove("dragging"); setListItems(l.id, [...c.querySelectorAll(".li-row")].map((r) => r.dataset.id), true); });
    row.addEventListener("dragover", (e) => { e.preventDefault(); const after = e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2; if (dragEl && dragEl !== row) c.insertBefore(dragEl, after ? row.nextSibling : row); });
  });
}
function setListItems(id, itemIds, silent) {
  const l = lists.find((x) => x.id === id); if (l) l.itemIds = itemIds;
  api.runtime.sendMessage({ type: "LIST_SET_ITEMS", id, itemIds }, (r) => { if (r?.lists) lists = r.lists; if (!silent) renderListDetail(); });
  if (!silent) renderListDetail();
}
function listMsg(type, payload, done) { api.runtime.sendMessage({ type, ...payload }, (r) => { if (r?.lists) lists = r.lists; if (done) done(); else { renderLists(); if (currentListId) renderListDetail(); } }); }
function backToLists() { currentListId = null; document.getElementById("list-detail").hidden = true; document.getElementById("lists-index").hidden = false; renderLists(); }

/* ================= DRAWER ================= */
function openDrawer(id) {
  const i = items.find((x) => x.id === id); if (!i) return;
  const d = document.getElementById("drawer");
  const isWatch = i.type === "watching", isGame = i.type === "game";
  const unit = isWatch ? "Episode" : "Chapter";
  const cur = isWatch ? i.episode || 0 : i.chapter || 0;
  const memberIn = lists.filter((l) => (l.itemIds || []).includes(i.id)).map((l) => l.id);
  d.innerHTML = `
    <div class="drawer-hero">
      <button class="icon-btn drawer-close" id="dr-close">${I.close}</button>
      <div class="drawer-cover" style="background:${i.accent || accentFor(i)}">${coverInner(i, 40)}<button class="change-cover" id="dr-cover">${I.image}</button></div>
      <h2 class="drawer-title">${esc(i.title || "Untitled")}</h2>
      <p class="drawer-marker">${esc(marker(i))}${isGame ? "" : " · " + relative(i.updatedAt)}</p>
    </div>
    <div class="drawer-body">
      ${i.synopsis ? `<div class="section-t">${t("synopsis")}</div><p class="synopsis clamp" id="dr-syn">${esc(i.synopsis)}</p><button class="link-btn" id="dr-syn-toggle">${t("showMore")}</button>` : ""}
      ${isGame ? `
        <div class="section-t">${t("games")}</div>
        <div class="game-meta">${i.platform ? `<span class="meta-pill">${I.game} ${esc(i.platform)}</span>` : ""}${i.releaseDate ? `<span class="meta-pill date">${esc(i.releaseDate)}</span>` : ""}${i.price ? `<span class="meta-pill price">${esc(i.price)}</span>` : ""}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${i.trailer ? `<a class="btn" href="${esc(i.trailer)}" target="_blank" rel="noreferrer">${I.play} ${t("watchTrailer")}</a>` : ""}${i.url ? `<a class="btn" href="${esc(i.url)}" target="_blank" rel="noreferrer">${I.open} ${t("open")}</a>` : ""}<label class="prereg ${i.preregistered ? "on" : ""}" id="dr-prereg"><span class="box">${i.preregistered ? I.check : ""}</span>${t("preRegistered")}</label></div>`
      : `
        <div class="section-t">${t("progress")}</div>
        <div class="stepper"><button id="dr-minus">${I.minus}</button><input id="dr-num" type="number" min="0" value="${cur}" /><button id="dr-plus">${I.plus}</button><span>${unit}${isWatch && i.season ? ` · Season ${i.season}` : ""}</span></div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn ${(i.progress || 0) >= 100 ? "" : "primary"}" id="dr-done">${I.check} ${(i.progress || 0) >= 100 ? t("markUnfinished") : t("markFinished")}</button><a class="btn" href="${esc(i.url || "#")}" target="_blank" rel="noreferrer">${I.open} ${t("open")}</a></div>`}
      <div class="section-t">${t("rating")}</div>
      <div class="rate-big" id="dr-rate">${[1,2,3,4,5].map((n) => `<span data-v="${n}">${I.star.replace('class="ic fill"', `class="ic fill ${n <= (i.rating || 0) ? "on" : ""}"`)}</span>`).join("")}</div>
      <div class="section-t">${t("tags")}</div><div class="tag-edit" id="dr-tags"></div>
      <div class="section-t">${t("lists")}</div>
      <div class="chips-wrap" id="dr-lists">${lists.map((l) => `<button class="chip-toggle ${memberIn.includes(l.id) ? "on" : ""}" data-list="${l.id}">${memberIn.includes(l.id) ? I.check : I.plus} ${esc(l.name)}</button>`).join("") || `<span style="color:var(--muted);font-size:12px">${t("newList")}…</span>`}</div>
      <div class="section-t">${t("manage")}</div><button class="btn danger" id="dr-remove">${I.trash} ${t("removeLib")}</button>
    </div>`;
  document.getElementById("scrim").classList.add("open");
  d.classList.add("open");
  wireDrawer(i, isWatch, isGame);
}
function wireDrawer(i, isWatch, isGame) {
  document.getElementById("dr-close").onclick = closeDrawer;
  const syn = document.getElementById("dr-syn"), synT = document.getElementById("dr-syn-toggle");
  if (synT) synT.onclick = () => { syn.classList.toggle("clamp"); synT.textContent = syn.classList.contains("clamp") ? t("showMore") : t("showLess"); };
  if (!isGame) {
    const num = document.getElementById("dr-num");
    const key = isWatch ? "episode" : "chapter", latestKey = isWatch ? "latestEpisode" : "latestChapter";
    const setNum = (v) => { const n = Math.max(0, Math.round(Number(v) || 0)); num.value = n; const p = { [key]: n || undefined }; p[latestKey] = Math.max(i[latestKey] || 0, n) || undefined; update(i.id, p); };
    document.getElementById("dr-minus").onclick = () => setNum((Number(num.value) || 0) - 1);
    document.getElementById("dr-plus").onclick = () => setNum((Number(num.value) || 0) + 1);
    num.onchange = () => setNum(num.value);
    document.getElementById("dr-done").onclick = () => { const done = (i.progress || 0) >= 100; update(i.id, { progress: done ? 0 : 100, status: done ? "in_progress" : "completed" }); setTimeout(() => openDrawer(i.id), 30); };
  } else {
    document.getElementById("dr-prereg").onclick = () => { update(i.id, { preregistered: !i.preregistered }); setTimeout(() => openDrawer(i.id), 30); };
  }
  document.getElementById("dr-cover").onclick = () => changeCover((v) => { update(i.id, { coverOverride: v }); setTimeout(() => openDrawer(i.id), 30); });
  document.querySelectorAll("#dr-rate span").forEach((s) => (s.onclick = () => { const v = Number(s.dataset.v); update(i.id, { rating: i.rating === v ? 0 : v }); setTimeout(() => openDrawer(i.id), 30); }));
  renderDrawerTags(i);
  document.querySelectorAll("#dr-lists [data-list]").forEach((b) => (b.onclick = () => { const l = lists.find((x) => x.id === b.dataset.list); if (!l) return; const has = (l.itemIds || []).includes(i.id); setListItemsSilent(l.id, has ? l.itemIds.filter((x) => x !== i.id) : [...(l.itemIds || []), i.id]); setTimeout(() => openDrawer(i.id), 30); }));
  document.getElementById("dr-remove").onclick = () => { if (!confirm(`${t("removeLib")}?`)) return; api.runtime.sendMessage({ type: "REMOVE_ITEM", id: i.id }, (r) => { items = r?.items || items.filter((x) => x.id !== i.id); closeDrawer(); renderAll(); }); };
}
function renderDrawerTags(i) {
  const wrap = document.getElementById("dr-tags");
  wrap.innerHTML = (i.tags || []).map((x) => `<span class="tag">${esc(x)} <span class="rm" data-rm="${esc(x)}">✕</span></span>`).join("") + `<button class="tag-add" id="dr-addtag">+ ${t("tags")}</button>`;
  wrap.querySelectorAll("[data-rm]").forEach((s) => (s.onclick = () => update(i.id, { tags: (i.tags || []).filter((x) => x !== s.dataset.rm) })));
  document.getElementById("dr-addtag").onclick = () => { const tg = (prompt(t("tags")) || "").trim(); if (tg) update(i.id, { tags: [...new Set([...(i.tags || []), tg])] }); };
}
function setListItemsSilent(id, itemIds) { const l = lists.find((x) => x.id === id); if (l) l.itemIds = itemIds; api.runtime.sendMessage({ type: "LIST_SET_ITEMS", id, itemIds }, (r) => { if (r?.lists) lists = r.lists; }); }
function closeDrawer() { document.getElementById("scrim").classList.remove("open"); document.getElementById("drawer").classList.remove("open"); }
function changeCover(apply) {
  const c = prompt("Cover — paste an image URL, type 'upload' to pick a file, or leave blank to clear:", "");
  if (c === null) return;
  if (c.trim().toLowerCase() === "upload") { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => apply(String(r.result)); r.readAsDataURL(f); }; inp.click(); return; }
  apply(c.trim());
}

/* ================= SETTINGS ================= */
function renderSettings() {
  const el = document.getElementById("view-settings");
  const p = settings.profile || {};
  el.innerHTML = `
    <h1>${t("settings")}</h1><p class="sub">${t("editProfile")} · ${t("newAlerts")} · ${t("backup")}</p>
    <div class="section-t">${t("editProfile")}</div>
    <div class="panel"><div class="row">
      <div class="avatar-lg" id="set-avatar">${p.avatar ? `<img src="${esc(p.avatar)}">` : esc(initials(p.name))}</div>
      <div class="grow"><input class="field" id="set-name" placeholder="${t("displayName")}" value="${esc(p.name || "")}" style="max-width:280px" /></div>
      <button class="btn" id="set-photo">${I.image} ${t("changePhoto")}</button>
    </div></div>
    <div class="section-t">${t("newAlerts")}</div>
    <div class="panel"><div class="row"><div class="grow"><b>${t("newAlerts")}</b><small>${t("newAlertsSub")}</small></div><button class="switch ${settings.notifyNew ? "on" : ""}" id="sw-notify"></button></div></div>
    <div class="section-t">${t("backup")}</div>
    <div class="panel">
      <div class="row"><div class="grow"><b>${t("yourLibrary")}</b><small>${t("exportRestore")}</small></div><button class="btn" id="export">${I.image} ${t("export")}</button><button class="btn" id="import">${t("import")}</button><input id="file" type="file" accept="application/json,.json" /></div>
      <div class="row"><div class="grow"><b>${t("cloudSync")}</b><small id="sync-state">${t("cloudSyncSub")}</small></div><button class="btn" id="sync-link">${t("manageSync")}</button></div>
    </div>
    <div class="section-t">${t("enjoying")}</div>
    <div class="panel">
      <div class="row" style="flex-wrap:wrap"><div class="grow"><b>${t("rateShare")}</b><small>${t("rateShareSub")}</small></div><div class="rate-big" id="rate-store"></div></div>
      <div class="row"><div class="grow"><b>${t("spread")}</b></div><div class="share-row" id="share"></div></div>
    </div>`;
  wireSettings();
}
function wireSettings() {
  const nameEl = document.getElementById("set-name");
  const saveProfile = (patch) => { settings.profile = { ...(settings.profile || {}), ...patch }; api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { profile: settings.profile } }, (r) => { if (r?.settings) settings = r.settings; paintAvatar(); }); };
  nameEl.onchange = () => saveProfile({ name: nameEl.value.trim() });
  const pickPhoto = () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { saveProfile({ avatar: String(r.result) }); renderSettings(); }; r.readAsDataURL(f); }; inp.click(); };
  document.getElementById("set-photo").onclick = pickPhoto;
  document.getElementById("set-avatar").onclick = pickPhoto;
  document.getElementById("sw-notify").onclick = () => { settings.notifyNew = !settings.notifyNew; document.getElementById("sw-notify").classList.toggle("on", settings.notifyNew); api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { notifyNew: settings.notifyNew } }, (r) => { if (r?.settings) settings = r.settings; }); };
  document.getElementById("export").onclick = doExport;
  document.getElementById("import").onclick = () => document.getElementById("file").click();
  document.getElementById("file").addEventListener("change", doImport);
  document.getElementById("sync-link").onclick = () => api.runtime.openOptionsPage();
  buildShare(document.getElementById("share"));
  buildRateStore(document.getElementById("rate-store"));
  api.runtime.sendMessage({ type: "SYNC_STATUS" }, (s) => { void api.runtime.lastError; const el = document.getElementById("sync-state"); if (s && s.configured && el) el.textContent = s.meta && s.meta.lastError ? "Signed in — sync needs attention" : `Synced as ${s.email || "you"}`; });
}
function doExport() {
  const blob = new Blob([JSON.stringify({ version: 2, items, sites, notifications, lists, settings }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `dasi-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
}
function doImport(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  file.text().then((text) => { try { const parsed = JSON.parse(text); if (!Array.isArray(parsed.items)) throw 0; api.runtime.sendMessage({ type: "IMPORT_STATE", payload: parsed }, () => { items = parsed.items; sites = parsed.sites || sites; lists = parsed.lists || lists; renderAll(); toast("✓"); }); } catch { alert("Invalid backup file"); } });
  e.target.value = "";
}

/* ---- share widgets (reused on the web interface) ---- */
const openUrl = (u) => api.tabs.create({ url: u });
function buildShare(el) {
  if (!el) return;
  el.innerHTML = `<button class="soc x">${I.x}</button><button class="soc fb">${I.fb}</button><button class="soc wa">${I.wa}</button><button class="soc rd">${I.rd}</button><button class="soc cp">${I.link}</button>`;
  const [sx, sf, sw, sr, sc] = el.querySelectorAll(".soc");
  sx.onclick = () => openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(DASI_STORE_URL)}`);
  sf.onclick = () => openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(DASI_STORE_URL)}`);
  sw.onclick = () => openUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(SHARE_TEXT + " " + DASI_STORE_URL)}`);
  sr.onclick = () => openUrl(`https://www.reddit.com/submit?url=${encodeURIComponent(DASI_STORE_URL)}&title=${encodeURIComponent(SHARE_TEXT)}`);
  sc.onclick = () => { try { navigator.clipboard?.writeText(DASI_STORE_URL); } catch {} toast("Link copied"); };
}
function buildRateStore(el) {
  if (!el) return;
  el.innerHTML = [1,2,3,4,5].map((n) => `<span data-v="${n}">${I.star}</span>`).join("");
  const stars = [...el.querySelectorAll("span")];
  const paint = (n) => stars.forEach((s, idx) => s.querySelector(".ic").classList.toggle("on", idx < n));
  stars.forEach((s) => (s.onmouseenter = () => paint(Number(s.dataset.v))));
  el.onmouseleave = () => paint(0);
  el.onclick = () => { paint(5); setTimeout(() => openUrl(DASI_STORE_URL), 350); };
}

/* ================= chrome (header, nav, menus) ================= */
function paintAvatar() {
  const p = settings.profile || {};
  const av = document.getElementById("avatar");
  av.innerHTML = p.avatar ? `<img src="${esc(p.avatar)}">` : esc(initials(p.name || "Dasi"));
}
function renderNav() {
  const tabs = [["home", t("home")], ["library", t("library")], ["lists", t("lists")], ["games", t("games")], ["plans", t("plans")]];
  document.getElementById("nav").innerHTML = tabs.map(([k, l]) => `<button data-v="${k}" class="${view === k ? "active" : ""}">${l}</button>`).join("");
  document.getElementById("q").placeholder = t("search");
  document.getElementById("lang-code").textContent = (settings.lang || "en").toUpperCase();
  document.querySelectorAll("[data-t]").forEach((n) => (n.textContent = t(n.dataset.t)));
}
function renderProfileMenu() {
  const p = settings.profile || {};
  document.getElementById("profile-menu").innerHTML = `
    <div class="menu-head"><div class="avatar">${p.avatar ? `<img src="${esc(p.avatar)}">` : esc(initials(p.name || "Dasi"))}</div><div><b>${esc(p.name || "Your profile")}</b><small>Local-first</small></div></div>
    <div class="sep"></div>
    <button data-go="settings">${I.user} ${t("editProfile")}</button>
    <button data-go="settings">${I.gear} ${t("settings")}</button>
    <button data-go="plans">${I.crown} ${t("plans")}</button>`;
  document.querySelectorAll("#profile-menu [data-go]").forEach((b) => (b.onclick = () => { closeMenus(); switchView(b.dataset.go); }));
}
function renderLangMenu() {
  document.getElementById("lang-menu").innerHTML = Object.entries(LANGS).map(([code, L]) => `<button class="${settings.lang === code ? "on" : ""}" data-lang="${code}">${esc(L.name)} <span style="margin-left:auto;color:var(--muted);font-size:11px">${code.toUpperCase()}</span></button>`).join("");
  document.querySelectorAll("#lang-menu [data-lang]").forEach((b) => (b.onclick = () => {
    settings.lang = b.dataset.lang; closeMenus();
    api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { lang: settings.lang } }, (r) => { if (r?.settings) settings = r.settings; });
    document.documentElement.lang = settings.lang; renderNav(); renderAll();
  }));
}
function closeMenus() { document.getElementById("profile-menu").classList.remove("open"); document.getElementById("lang-menu").classList.remove("open"); }

function switchView(v) {
  view = v; closeMenus();
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("active", s.id === `view-${v}`));
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.v === v));
  if (v === "home") { renderHome(); } else clearInterval(spotTimer);
  if (v === "games") renderGames();
  if (v === "plans") renderPlans();
  if (v === "settings") renderSettings();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  renderNav();
  paintAvatar();
  renderStats();
  renderFilters();
  renderGrid();
  renderLists();
  if (view === "home") renderHome();
  if (view === "games") renderGames();
  if (view === "plans") renderPlans();
  if (currentListId) renderListDetail();
  const newCount = items.filter(isNew).length;
  const bell = document.getElementById("bell");
  bell.querySelector(".badge-dot")?.remove();
  if (newCount) { const b = document.createElement("span"); b.className = "badge-dot"; b.textContent = newCount; bell.appendChild(b); }
}

/* ---- global events ---- */
document.getElementById("nav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) switchView(b.dataset.v); });
document.getElementById("brand").onclick = () => { filter = "all"; query = ""; document.getElementById("q").value = ""; switchView("home"); };
document.getElementById("bell").onclick = () => { const n = items.filter(isNew).length; switchView("home"); toast(n ? t("updatesSome", { n }) : t("updatesNone")); };
document.getElementById("avatar").onclick = (e) => { e.stopPropagation(); document.getElementById("lang-menu").classList.remove("open"); document.getElementById("profile-menu").classList.toggle("open"); };
document.getElementById("lang-btn").onclick = (e) => { e.stopPropagation(); document.getElementById("profile-menu").classList.remove("open"); document.getElementById("lang-menu").classList.toggle("open"); };
document.addEventListener("click", (e) => { if (!e.target.closest(".top-right")) closeMenus(); });
document.getElementById("q").addEventListener("input", (e) => { query = e.target.value; if (view !== "library") switchView("library"); renderGrid(); });
document.getElementById("filters").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.f; renderFilters(); renderGrid(); });
document.getElementById("grid").addEventListener("click", (e) => {
  const fav = e.target.closest(".fav"); if (fav) { const it = items.find((x) => x.id === fav.dataset.fav); if (it) update(it.id, { favorite: !it.favorite }); return; }
  const rate = e.target.closest("[data-rate]"); if (rate) { const it = items.find((x) => x.id === rate.dataset.rate); const v = Number(rate.dataset.v); update(rate.dataset.rate, { rating: it && it.rating === v ? 0 : v }); return; }
  const card = e.target.closest("[data-open]"); if (card) openDrawer(card.dataset.open);
});
document.getElementById("list-grid").addEventListener("click", (e) => {
  if (e.target.closest("#new-list")) { listMsg("LIST_CREATE", { name: t("newList") }, () => { renderLists(); const last = lists[lists.length - 1]; if (last) openList(last.id); }); return; }
  const card = e.target.closest("[data-list]"); if (card) openList(card.dataset.list);
});
document.getElementById("scrim").onclick = closeDrawer;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeMenus(); } });

/* ---- boot ---- */
function hydrate(state) {
  items = state?.items || []; sites = state?.sites || []; notifications = state?.notifications || [];
  lists = state?.lists || []; settings = { notifyNew: true, lang: "en", profile: { name: "", avatar: "" }, ...(state?.settings || {}) };
  document.documentElement.lang = settings.lang;
  renderNav(); renderAll(); renderLangMenu(); renderProfileMenu();
}
api.runtime.sendMessage({ type: "GET_STATE" }, hydrate);
