/* Yomu — tracker home. Vanilla, no build step. */
const api = globalThis.chrome;
const UNLOCK_ALL = typeof DASI_UNLOCK_ALL !== "undefined" ? DASI_UNLOCK_ALL : true;

let items = [], sites = [], notifications = [], lists = [];
let settings = { notifyNew: true, lang: "en", profile: { name: "", avatar: "" } };
let filter = "all", query = "", currentListId = null, view = "home";
let listAddQuery = "";
let listCreationPending=false;
function paintListCreation() {
  for(const id of ["new-list","add-list-inline"]){const button=document.getElementById(id);if(button){button.disabled=listCreationPending;button.setAttribute("aria-busy",String(listCreationPending));}}
}
let spotIdx = 0, spotItems = [], spotTimer = null;
let discover = null, discoverTried = false, discoverLoading = false; // fresh recommendations pulled from the background
let discoCat = "all"; // active Discover category tab (webtoon-style)
let planCycle = "year"; // billing cycle shown on the Plans page ("year" | "month")
let userPlan = null; // "pro" | "lifetime" | null, from the sync backend
const isPro = () => UNLOCK_ALL || userPlan === "pro" || userPlan === "lifetime";
// Premium-sounding subtitle for the profile menu (never "local-first").
const planLabel = () => (UNLOCK_ALL || userPlan === "lifetime" ? "Lifetime" : userPlan === "pro" ? "Pro" : "Yomu");

const NEW_WINDOW = 14 * 24 * 3600 * 1000;
const SOON_WINDOW = 30 * 24 * 3600 * 1000;
const DASI_STORE_URL = "https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS";
const SHARE_TEXT = "Yomu — never lose your spot in any manga, webtoon, anime, series or game. Save & resume in one click.";

/* ---- i18n (en/fr full; others cover the visible shell, fall back to en) --- */
const LANGS = {
  en: { name:"English", home:"Home", library:"Library", lists:"Lists", games:"Games", plans:"Plans", settings:"Settings",
    search:"Search", librarySub:"Everything you saved, kept on this device.", listsSub:"Group your works your way — drag to reorder, pick a cover.",
    continue:"Jump back in", newWeek:"New this week", becauseYouLove:"Because you love {g}", yourGenres:"Your genres", recentlyAdded:"Recently added", sitesTitle:"Your sites",
    resume:"Resume", details:"Details", addByName:"Add by name", welcomeTitle:"Welcome to Yomu", welcomeBody:"Yomu remembers where you stopped in anything you read or watch — manga, webtoons, anime, series, films and games. Open a page, hit save, and resume in one click from here.",
    valSaveT:"Save anywhere", valSaveB:"One click on any site — no more lost bookmarks.", valAllT:"One library for everything", valAllB:"Manga, anime, series, films and games together.", valResumeT:"Resume in a click", valResumeB:"Pick up exactly where you left off, on any device.",
    tracked:"Tracked", reading:"Reading", watching:"Watching", favorites:"Favorites", finished:"Finished",
    all:"All", status:"Status", current:"In progress", planned:"Planned", completed:"Completed", on_hold:"On hold", dropped:"Dropped", markFinished:"Mark finished", markUnfinished:"Mark unfinished", open:"Open", progress:"Progress",  markAll:"Mark all released as seen", unseenN:"{n} unseen", upToDate:"Up to date", rating:"Rating", tags:"Tags", synopsis:"Synopsis", manage:"Manage", editDetails:"Edit details", advanced:"Advanced", removeLib:"Remove from library", showMore:"Show more", showLess:"Show less",
    newList:"New list", cover:"Cover", rename:"Rename", delete:"Delete", inThisList:"In this list", addWorks:"Add works", allLists:"All lists", dragReorder:"drag to reorder",
    viewToggle:"Toggle layout", viewRows:"List", viewGrid:"Grid",
    gamesSub:"Track awaited games — release dates, prices, trailers and pre-registrations.", addGame:"Add a game", title:"Title", platform:"Platform", releaseDate:"Release date", price:"Price", trailer:"Trailer", watchTrailer:"Watch trailer", preRegistered:"Pre-registered", released:"Released", comingSoon:"Coming soon", add:"Add", cancel:"Cancel", free:"Free",
    editProfile:"Edit profile", displayName:"Display name", changePhoto:"Change photo", language:"Language", uiLanguage:"App language", translateLanguage:"Default translation language", account:"Account", email:"Email", changeEmail:"Change email", changePassword:"Change password", currentPassword:"Current password", newPassword:"New password", save:"Save", signedInAs:"Signed in as", notSignedIn:"Not signed in — sync is optional.", newAlerts:"New-episode alerts", integrations:"Integrations & keys", filmsSeries:"Films & series", keyHint:"Optional free API key —", imgTranslate:"Manga image translation", imgTranslateHint:"Optional — a manga-image-translator server URL. See", newAlertsSub:"Flag works with something released you haven't seen.", backup:"Backup", yourLibrary:"Your library", exportRestore:"Export a backup file, or restore one.", export:"Export", import:"Import", importFormats:"From Yomu, Trakt, TV Time, IMDb, Letterboxd, MyAnimeList — JSON, CSV, XML or ZIP. Pick one or several files.", importing:"Importing…", importedN:"Imported {n} titles", importNothing:"No titles found in that file.", importFailed:"Couldn't read that file.", cloudSync:"Cloud sync", cloudSyncSub:"Optional — sign in to sync across devices.", manageSync:"Manage", rateShare:"Rate & share", rateShareSub:"It helps others discover Yomu.", spread:"Spread the word", enjoying:"Enjoying Yomu?",
    plansTitle:"Choose your plan", plansSub:"Free forever for tracking. Go Pro for sync, alerts and more.", unlocked:"Owner edition — every Pro feature is unlocked.", mostPopular:"Most popular", getStarted:"Get started", goPro:"Go Pro", getLifetime:"Get Lifetime", currentPlan:"Current",
    updatesNone:"Nothing new right now", updatesSome:"{n} with something new", updates:"Updates",
    discover:"Discover", discoverSub:"Fresh picks — not in your library yet.", forYou:"Recommended for you", forYouSub:"Based on your tags", trendingManga:"Trending manga & manhwa", popularAnime:"Popular anime right now", newGames:"New game releases", upcomingGames:"Upcoming games", addToLib:"Add to library", refresh:"Refresh", loadingReco:"Finding fresh picks…",
    imgTranslateSub:"Translate the speech bubbles inside manga/webtoon images too — just press Translate. It works automatically, nothing to install.", imgOn:"On", imgKeyLabel:"OCR key (optional)", imgKeyHint:"Free key from ocr.space for higher daily limits.", imgKeyPh:"ocr.space API key", imgServerHint:"Power users: your own image-translation server URL for best quality.", imgServerLabel:"Custom server (optional)", imgTest:"Test", imgTesting:"Testing…", imgOk:"Connected ✓", imgFail:"No response — check the URL.", imgSetup:"", imgCopy:"Copy", imgCopied:"Copied ✓",
    searchPlaceholder:"Search or add by name…", work:"work", works:"works", upcoming:"Upcoming", discoverGames:"Discover games",
    topThisWeek:"Top 10 this week", trendingWebtoons:"Trending webtoons & manhwa", mostAnticipated:"Most wishlisted games on Steam", hotGames:"Steam top sellers", openInNew:"Open", discoverMore:"Discover more",
    catAll:"All", catManhwa:"Manhwa", catManga:"Manga", catManhua:"Manhua", catAnime:"Anime", catKdrama:"K-Drama", catCdrama:"C-Drama", catJdrama:"J-Drama", catSeries:"Series", catGames:"Games",
    categories:"Categories", chooseCats:"Choose which categories show on Home", cast:"Cast",
    changeBanner:"Change banner", bioPh:"Write a short bio…",
    searching:"Searching", searchTitle:"Search", noMatch:"No match — try another spelling or a different language.",
    progHintWatch:"The episode you last watched.", progHintRead:"The chapter you last read.", totalReleased:"Latest available", totalHint:"The newest chapter/episode out — so Yomu can tell you when there's something new.",
    planFreePer:"free forever", planProPer:"or $29.99/yr", planLifePer:"one-time — best value",
    monthly:"Monthly", yearly:"Yearly", save2mo:"Annual plan", perMonthNote:"billed monthly, cancel anytime", perYearNote:"billed yearly — about $2.50/mo",
    planFoot:"Tracking is free forever. Paid tiers fund the optional sync, update alerts and translation engine.",
    freeFeatures:["Unlimited tracking — manga, manhwa, webtoons, anime, series, films, games", "Auto-detect & one-click save, resume anywhere", "Lists, tags, ratings, synopsis, series grouping", "Episode / chapter seen tracking", "Import from MAL, CSV, JSON + backup", "Every UI language", "Page translation — up to 5 pages / day"],
    proFeatures:["Everything in Free", "Optional account sync across devices", "New-episode & game-release alerts (notifications)", "Page translation, subject to provider availability and limits", "Full stats & insights — streaks, trends, forecasts", "Custom list covers & profile (upload, crop, reposition)", "Settings, backups and data export"],
    lifeFeatures:["Everything in Pro, forever", "No subscription, ever", "Founder badge on your profile", "All future updates included", "Support an independent tool"] },
  fr: { name:"Français", home:"Accueil", library:"Bibliothèque", lists:"Listes", games:"Jeux", plans:"Abonnements", settings:"Paramètres",
    search:"Rechercher", librarySub:"Tout ce que tu as enregistré, gardé sur cet appareil.", listsSub:"Classe tes œuvres à ta façon — glisse pour réordonner, choisis une couverture.",
    continue:"Reprendre", newWeek:"Nouveautés de la semaine", becauseYouLove:"Parce que tu aimes {g}", yourGenres:"Tes genres", recentlyAdded:"Ajoutés récemment", sitesTitle:"Tes sites",
    resume:"Reprendre", details:"Détails", addByName:"Ajouter par nom", welcomeTitle:"Bienvenue sur Yomu", welcomeBody:"Yomu retient où tu t'es arrêté dans tout ce que tu lis ou regardes — manga, webtoons, anime, séries, films et jeux. Ouvre une page, clique sur enregistrer, et reprends d'un clic depuis ici.",
    valSaveT:"Enregistre partout", valSaveB:"Un clic sur n'importe quel site — fini les favoris perdus.", valAllT:"Une seule bibliothèque", valAllB:"Manga, anime, séries, films et jeux réunis.", valResumeT:"Reprends d'un clic", valResumeB:"Reprends exactement où tu étais, sur tous tes appareils.",
    tracked:"Suivis", reading:"Lecture", watching:"Visionnage", favorites:"Favoris", finished:"Terminés",
    all:"Tout", status:"Statut", current:"En cours", planned:"Prévu", completed:"Terminé", on_hold:"En pause", dropped:"Abandonné", markFinished:"Marquer terminé", markUnfinished:"Marquer en cours", open:"Ouvrir", progress:"Progression",  markAll:"Tout marquer comme vu", unseenN:"{n} non vus", upToDate:"À jour", rating:"Note", tags:"Tags", synopsis:"Synopsis", manage:"Gérer", editDetails:"Modifier la fiche", advanced:"Avancé", removeLib:"Retirer de la bibliothèque", showMore:"Voir plus", showLess:"Voir moins",
    newList:"Nouvelle liste", cover:"Couverture", rename:"Renommer", delete:"Supprimer", inThisList:"Dans cette liste", addWorks:"Ajouter des œuvres", allLists:"Toutes les listes", dragReorder:"glisser pour réordonner",
    viewToggle:"Changer l'affichage", viewRows:"Liste", viewGrid:"Grille",
    gamesSub:"Suis les jeux attendus — dates de sortie, prix, trailers et préinscriptions.", addGame:"Ajouter un jeu", title:"Titre", platform:"Plateforme", releaseDate:"Date de sortie", price:"Prix", trailer:"Trailer", watchTrailer:"Voir le trailer", preRegistered:"Préinscrit", released:"Sorti", comingSoon:"Bientôt", add:"Ajouter", cancel:"Annuler", free:"Gratuit",
    editProfile:"Modifier le profil", displayName:"Nom affiché", changePhoto:"Changer la photo", language:"Langue", uiLanguage:"Langue de l'appli", translateLanguage:"Langue de traduction par défaut", account:"Compte", email:"E-mail", changeEmail:"Changer l'e-mail", changePassword:"Changer le mot de passe", currentPassword:"Mot de passe actuel", newPassword:"Nouveau mot de passe", save:"Enregistrer", signedInAs:"Connecté en tant que", notSignedIn:"Non connecté — la sync est optionnelle.", newAlerts:"Alertes nouveaux épisodes", integrations:"Intégrations & clés", filmsSeries:"Films & séries", keyHint:"Clé API gratuite optionnelle —", imgTranslate:"Traduction d'images manga", imgTranslateHint:"Optionnel — URL d'un serveur manga-image-translator. Voir", newAlertsSub:"Signale les œuvres avec du contenu sorti que tu n'as pas vu.", backup:"Sauvegarde", yourLibrary:"Ta bibliothèque", exportRestore:"Exporte une sauvegarde, ou restaure-la.", export:"Exporter", import:"Importer", importFormats:"Depuis Yomu, Trakt, TV Time, IMDb, Letterboxd, MyAnimeList — JSON, CSV, XML ou ZIP. Choisis un ou plusieurs fichiers.", importing:"Import en cours…", importedN:"{n} titres importés", importNothing:"Aucun titre trouvé dans ce fichier.", importFailed:"Impossible de lire ce fichier.", cloudSync:"Sync cloud", cloudSyncSub:"Optionnel — connecte-toi pour synchroniser tes appareils.", manageSync:"Gérer", rateShare:"Noter & partager", rateShareSub:"Ça aide les autres à découvrir Yomu.", spread:"Fais passer le mot", enjoying:"Tu aimes Yomu ?",
    plansTitle:"Choisis ton abonnement", plansSub:"Gratuit à vie pour le suivi. Passe Pro pour la sync, les alertes et plus.", unlocked:"Édition propriétaire — toutes les fonctions Pro sont débloquées.", mostPopular:"Le plus populaire", getStarted:"Commencer", goPro:"Passer Pro", getLifetime:"À vie", currentPlan:"Actuel",
    updatesNone:"Rien de nouveau pour l'instant", updatesSome:"{n} avec du nouveau", updates:"Notifications",
    discover:"Découvrir", discoverSub:"Nouveautés à découvrir — pas encore dans ta bibliothèque.", forYou:"Recommandé pour toi", forYouSub:"D'après tes tags", trendingManga:"Manga & manhwa tendances", popularAnime:"Anime populaires en ce moment", newGames:"Nouveaux jeux sortis", upcomingGames:"Jeux à venir", addToLib:"Ajouter à la bibliothèque", refresh:"Actualiser", loadingReco:"Recherche de nouveautés…",
    imgTranslateSub:"Traduit aussi les bulles à l'intérieur des images de manga/webtoon — appuie simplement sur Traduire. Ça marche automatiquement, rien à installer.", imgOn:"Activé", imgKeyLabel:"Clé OCR (optionnel)", imgKeyHint:"Clé gratuite ocr.space pour des limites quotidiennes plus élevées.", imgKeyPh:"clé API ocr.space", imgServerHint:"Utilisateurs avancés : l'URL de ton propre serveur de traduction d'images pour une qualité optimale.", imgServerLabel:"Serveur personnalisé (optionnel)", imgTest:"Tester", imgTesting:"Test…", imgOk:"Connecté ✓", imgFail:"Aucune réponse — vérifie l'URL.", imgSetup:"", imgCopy:"Copier", imgCopied:"Copié ✓",
    searchPlaceholder:"Rechercher ou ajouter par nom…", work:"œuvre", works:"œuvres", upcoming:"À venir", discoverGames:"Découvrir des jeux",
    topThisWeek:"Top 10 de la semaine", trendingWebtoons:"Webtoons & manhwa tendances", mostAnticipated:"Jeux les plus souhaités sur Steam", hotGames:"Meilleures ventes Steam", openInNew:"Ouvrir", discoverMore:"Découvrir plus",
    catAll:"Tout", catManhwa:"Manhwa", catManga:"Manga", catManhua:"Manhua", catAnime:"Anime", catKdrama:"K-Drama", catCdrama:"C-Drama", catJdrama:"J-Drama", catSeries:"Séries", catGames:"Jeux",
    categories:"Catégories", chooseCats:"Choisis les catégories affichées sur l'accueil", cast:"Distribution",
    changeBanner:"Changer la bannière", bioPh:"Écris une petite bio…",
    searching:"Recherche", searchTitle:"Recherche", noMatch:"Aucun résultat — essaie une autre orthographe ou une autre langue.",
    progHintWatch:"Le dernier épisode que tu as regardé.", progHintRead:"Le dernier chapitre que tu as lu.", totalReleased:"Dernier disponible", totalHint:"Le dernier chapitre/épisode sorti — pour que Yomu te prévienne quand il y a du nouveau.",
    planFreePer:"gratuit à vie", planProPer:"ou 29,99 $/an", planLifePer:"paiement unique — meilleure offre",
    monthly:"Mensuel", yearly:"Annuel", save2mo:"Offre annuelle", perMonthNote:"facturé au mois, résiliable à tout moment", perYearNote:"facturé à l'année — environ 2,50 $/mois",
    planFoot:"Le suivi est gratuit à vie. Les offres payantes financent la sync, les alertes de sortie et le moteur de traduction optionnels.",
    freeFeatures:["Suivi illimité — manga, manhwa, webtoons, anime, séries, films, jeux", "Détection auto & enregistrement en un clic, reprise partout", "Listes, tags, notes, synopsis, regroupement de séries", "Suivi des épisodes / chapitres vus", "Import depuis MAL, CSV, JSON + sauvegarde", "Toutes les langues d'interface", "Traduction de page — jusqu'à 5 pages / jour"],
    proFeatures:["Tout ce qu'il y a dans Free", "Synchronisation optionnelle par compte entre appareils", "Alertes nouveaux épisodes & sorties de jeux (notifications)", "Traduction de pages selon les langues, la disponibilité et les limites du fournisseur", "Stats & analyses complètes — séries, tendances, prévisions", "Couvertures de listes & profil personnalisés (upload, recadrage)", "Paramètres, sauvegardes et export des données"],
    lifeFeatures:["Tout ce qu'il y a dans Pro, pour toujours", "Aucun abonnement, jamais", "Badge fondateur sur ton profil", "Toutes les futures mises à jour incluses", "Soutiens un outil indépendant"] },
  es: { name:"Español", home:"Inicio", library:"Biblioteca", lists:"Listas", games:"Juegos", plans:"Planes", settings:"Ajustes", search:"Buscar",
    continue:"Continuar", newWeek:"Novedades de la semana", becauseYouLove:"Porque te gusta {g}", yourGenres:"Tus géneros", recentlyAdded:"Añadidos recientemente",
    resume:"Reanudar", details:"Detalles", welcomeTitle:"Bienvenido a Yomu", tracked:"Seguidos", reading:"Lectura", watching:"Viendo", favorites:"Favoritos", finished:"Terminados", all:"Todo",
    gamesSub:"Sigue juegos esperados — fechas, precios, tráilers y prerregistros.", addGame:"Añadir un juego", plansTitle:"Elige tu plan", plansSub:"Gratis para siempre para el seguimiento. Pro para sync, alertas y más.", mostPopular:"Más popular", goPro:"Hazte Pro", getLifetime:"De por vida", getStarted:"Empezar", currentPlan:"Actual", free:"Gratis", watchTrailer:"Ver tráiler", preRegistered:"Prerregistrado",
    welcomeBody:"Abre cualquier manga, webtoon, anime, serie o juego y guarda en la ventana de Yomu. Aparece aquí.", comingSoon:"Próximamente", add:"Añadir", cancel:"Cancelar", open:"Abrir", markFinished:"Marcar terminado", markUnfinished:"Marcar en curso", released:"Publicados", markAll:"Marcar todo como visto", upToDate:"Al día", unseenN:"{n} sin ver", progress:"Progreso", rating:"Valoración", tags:"Etiquetas", synopsis:"Sinopsis", newList:"Nueva lista", delete:"Eliminar", allLists:"Todas las listas", editProfile:"Editar perfil", backup:"Copia de seguridad", export:"Exportar", import:"Importar", removeLib:"Quitar de la biblioteca", updatesNone:"Nada nuevo por ahora", updatesSome:"{n} con novedades", librarySub:"Todo lo que guardaste, en este dispositivo.", listsSub:"Organiza tus obras a tu manera — arrastra para reordenar, elige una portada.", status:"Estado", current:"En curso", planned:"Pendiente", completed:"Completado", on_hold:"En pausa", dropped:"Abandonado", manage:"Gestionar", showMore:"Ver más", showLess:"Ver menos", cover:"Portada", rename:"Renombrar", inThisList:"En esta lista", addWorks:"Añadir obras", dragReorder:"arrastra para reordenar", viewToggle:"Cambiar diseño", viewRows:"Lista", viewGrid:"Cuadrícula", title:"Título", platform:"Plataforma", releaseDate:"Fecha de lanzamiento", price:"Precio", trailer:"Tráiler", displayName:"Nombre visible", changePhoto:"Cambiar foto", language:"Idioma", uiLanguage:"Idioma de la app", translateLanguage:"Idioma de traducción por defecto", account:"Cuenta", email:"Correo", changeEmail:"Cambiar correo", changePassword:"Cambiar contraseña", currentPassword:"Contraseña actual", newPassword:"Nueva contraseña", save:"Guardar", signedInAs:"Conectado como", notSignedIn:"No conectado — la sync es opcional.", newAlerts:"Alertas de nuevos episodios", newAlertsSub:"Marca las obras con contenido publicado que no has visto.", yourLibrary:"Tu biblioteca", exportRestore:"Exporta una copia, o restáurala.", cloudSync:"Sync en la nube", cloudSyncSub:"Opcional — inicia sesión para sincronizar tus dispositivos.", manageSync:"Gestionar", rateShare:"Valorar y compartir", rateShareSub:"Ayuda a otros a descubrir Yomu.", spread:"Corre la voz", enjoying:"¿Disfrutas de Yomu?", unlocked:"Edición propietario — todas las funciones Pro están desbloqueadas.", updates:"Novedades", addByName:"Añadir por nombre", valSaveT:"Guarda en cualquier sitio", valSaveB:"Un clic en cualquier web — no más marcadores perdidos.", valAllT:"Una biblioteca para todo", valAllB:"Manga, anime, series, películas y juegos juntos.", valResumeT:"Reanuda en un clic", valResumeB:"Continúa justo donde lo dejaste, en cualquier dispositivo." },
  de: { name:"Deutsch", home:"Start", library:"Bibliothek", lists:"Listen", games:"Spiele", plans:"Abos", settings:"Einstellungen", search:"Suchen",
    continue:"Weiterlesen", newWeek:"Neu diese Woche", becauseYouLove:"Weil du {g} magst", yourGenres:"Deine Genres", recentlyAdded:"Kürzlich hinzugefügt",
    resume:"Fortsetzen", details:"Details", welcomeTitle:"Willkommen bei Yomu", tracked:"Verfolgt", reading:"Lesen", watching:"Sehen", favorites:"Favoriten", finished:"Beendet", all:"Alle",
    gamesSub:"Verfolge erwartete Spiele — Release, Preise, Trailer und Vorregistrierungen.", addGame:"Spiel hinzufügen", plansTitle:"Wähle deinen Plan", plansSub:"Für immer gratis fürs lokale Tracking. Pro für Sync, Hinweise und mehr.", mostPopular:"Am beliebtesten", goPro:"Pro werden", getLifetime:"Lebenslang", getStarted:"Loslegen", currentPlan:"Aktuell", free:"Gratis", watchTrailer:"Trailer ansehen", preRegistered:"Vorregistriert",
    welcomeBody:"Öffne ein Manga, Webtoon, Anime, eine Serie oder ein Spiel und speichere im Yomu-Popup. Es landet hier.", comingSoon:"Demnächst", add:"Hinzufügen", cancel:"Abbrechen", open:"Öffnen", markFinished:"Als fertig markieren", markUnfinished:"Als offen markieren", released:"Erschienen", markAll:"Alles als gesehen markieren", upToDate:"Aktuell", unseenN:"{n} ungesehen", progress:"Fortschritt", rating:"Bewertung", tags:"Tags", synopsis:"Zusammenfassung", newList:"Neue Liste", delete:"Löschen", allLists:"Alle Listen", editProfile:"Profil bearbeiten", backup:"Backup", export:"Exportieren", import:"Importieren", removeLib:"Aus Bibliothek entfernen", updatesNone:"Nichts Neues gerade", updatesSome:"{n} mit Neuem", librarySub:"Alles, was du gespeichert hast — auf diesem Gerät.", listsSub:"Ordne deine Werke nach Belieben — zum Umsortieren ziehen, Cover wählen.", status:"Status", current:"Läuft", planned:"Geplant", completed:"Abgeschlossen", on_hold:"Pausiert", dropped:"Abgebrochen", manage:"Verwalten", showMore:"Mehr anzeigen", showLess:"Weniger anzeigen", cover:"Cover", rename:"Umbenennen", inThisList:"In dieser Liste", addWorks:"Werke hinzufügen", dragReorder:"zum Umsortieren ziehen", viewToggle:"Layout wechseln", viewRows:"Liste", viewGrid:"Raster", title:"Titel", platform:"Plattform", releaseDate:"Erscheinungsdatum", price:"Preis", trailer:"Trailer", displayName:"Anzeigename", changePhoto:"Foto ändern", language:"Sprache", uiLanguage:"App-Sprache", translateLanguage:"Standard-Übersetzungssprache", account:"Konto", email:"E-Mail", changeEmail:"E-Mail ändern", changePassword:"Passwort ändern", currentPassword:"Aktuelles Passwort", newPassword:"Neues Passwort", save:"Speichern", signedInAs:"Angemeldet als", notSignedIn:"Nicht angemeldet — Sync ist optional.", newAlerts:"Benachrichtigungen zu neuen Folgen", newAlertsSub:"Markiert Werke mit Veröffentlichtem, das du noch nicht gesehen hast.", yourLibrary:"Deine Bibliothek", exportRestore:"Exportiere ein Backup oder stelle eines wieder her.", cloudSync:"Cloud-Sync", cloudSyncSub:"Optional — melde dich an, um Geräte zu synchronisieren.", manageSync:"Verwalten", rateShare:"Bewerten & teilen", rateShareSub:"Hilf anderen, Yomu zu entdecken.", spread:"Erzähl es weiter", enjoying:"Gefällt dir Yomu?", unlocked:"Besitzer-Edition — alle Pro-Funktionen sind freigeschaltet.", updates:"Neuigkeiten", addByName:"Nach Namen hinzufügen", valSaveT:"Überall speichern", valSaveB:"Ein Klick auf jeder Seite — keine verlorenen Lesezeichen.", valAllT:"Eine Bibliothek für alles", valAllB:"Manga, Anime, Serien, Filme und Spiele zusammen.", valResumeT:"Mit einem Klick fortsetzen", valResumeB:"Genau da weiter, wo du aufgehört hast — auf jedem Gerät." },
  ja: { name:"日本語", home:"ホーム", library:"ライブラリ", lists:"リスト", games:"ゲーム", plans:"プラン", settings:"設定", search:"検索",
    continue:"続きから", newWeek:"今週の新着", becauseYouLove:"{g}が好きだから", yourGenres:"あなたのジャンル", recentlyAdded:"最近追加",
    resume:"再開", details:"詳細", welcomeTitle:"Yomuへようこそ", tracked:"追跡中", reading:"読書", watching:"視聴", favorites:"お気に入り", finished:"完了", all:"すべて",
    gamesSub:"気になるゲームを追跡 — 発売日・価格・トレーラー・事前登録。", addGame:"ゲームを追加", plansTitle:"プランを選択", plansSub:"ローカル管理は永久無料。同期・通知などはProで。", mostPopular:"人気", goPro:"Proにする", getLifetime:"買い切り", getStarted:"はじめる", currentPlan:"現在", free:"無料", watchTrailer:"トレーラー", preRegistered:"事前登録済み",
    welcomeBody:"マンガ・ウェブトゥーン・アニメ・ドラマ・ゲームを開いてYomuのポップアップで保存すると、ここに表示されます。", comingSoon:"近日", add:"追加", cancel:"キャンセル", open:"開く", markFinished:"完了にする", markUnfinished:"未完了にする", released:"配信済み", markAll:"すべて視聴済みにする", upToDate:"最新", unseenN:"未視聴 {n}", progress:"進捗", rating:"評価", tags:"タグ", synopsis:"あらすじ", newList:"新規リスト", delete:"削除", allLists:"すべてのリスト", editProfile:"プロフィール編集", backup:"バックアップ", export:"エクスポート", import:"インポート", removeLib:"ライブラリから削除", updatesNone:"今は新着なし", updatesSome:"新着 {n} 件", librarySub:"保存したものはすべてこの端末に。", listsSub:"自分好みに整理 — ドラッグで並べ替え、カバーを選択。", status:"ステータス", current:"進行中", planned:"予定", completed:"完了", on_hold:"保留", dropped:"中断", manage:"管理", showMore:"もっと見る", showLess:"閉じる", cover:"カバー", rename:"名前を変更", inThisList:"このリスト内", addWorks:"作品を追加", dragReorder:"ドラッグで並べ替え", viewToggle:"表示を切替", viewRows:"リスト", viewGrid:"グリッド", title:"タイトル", platform:"プラットフォーム", releaseDate:"発売日", price:"価格", trailer:"トレーラー", displayName:"表示名", changePhoto:"写真を変更", language:"言語", uiLanguage:"アプリの言語", translateLanguage:"デフォルトの翻訳言語", account:"アカウント", email:"メール", changeEmail:"メールを変更", changePassword:"パスワードを変更", currentPassword:"現在のパスワード", newPassword:"新しいパスワード", save:"保存", signedInAs:"ログイン中", notSignedIn:"未ログイン — 同期は任意です。", newAlerts:"新エピソード通知", newAlertsSub:"未視聴の配信済みがある作品を知らせます。", yourLibrary:"あなたのライブラリ", exportRestore:"バックアップを書き出し、または復元。", cloudSync:"クラウド同期", cloudSyncSub:"任意 — ログインして端末間で同期。", manageSync:"管理", rateShare:"評価と共有", rateShareSub:"Yomuを広めるのに役立ちます。", spread:"広めよう", enjoying:"Yomuは気に入りましたか？", unlocked:"オーナー版 — すべてのPro機能が解放されています。", updates:"お知らせ", addByName:"名前で追加", valSaveT:"どこでも保存", valSaveB:"どのサイトでもワンクリック — ブックマークをもう失わない。", valAllT:"すべてを1つのライブラリに", valAllB:"マンガ・アニメ・ドラマ・映画・ゲームをまとめて。", valResumeT:"ワンクリックで再開", valResumeB:"どの端末でも、続きから正確に。" },
  ko: { name:"한국어", home:"홈", library:"라이브러리", lists:"리스트", games:"게임", plans:"플랜", settings:"설정", search:"검색",
    continue:"이어보기", newWeek:"이번 주 신규", becauseYouLove:"{g}을(를) 좋아해서", yourGenres:"내 장르", recentlyAdded:"최근 추가",
    resume:"계속", details:"상세", welcomeTitle:"Yomu에 오신 걸 환영합니다", tracked:"추적", reading:"읽기", watching:"시청", favorites:"즐겨찾기", finished:"완료", all:"전체",
    gamesSub:"기대되는 게임 추적 — 출시일·가격·트레일러·사전예약.", addGame:"게임 추가", plansTitle:"플랜 선택", plansSub:"로컬 추적은 평생 무료. 동기화·알림 등은 Pro로.", mostPopular:"인기", goPro:"Pro 시작", getLifetime:"평생", getStarted:"시작하기", currentPlan:"현재", free:"무료", watchTrailer:"트레일러", preRegistered:"사전예약됨",
    welcomeBody:"만화·웹툰·애니·드라마·게임을 열고 Yomu 팝업에서 저장하면 여기에 표시됩니다.", comingSoon:"출시 예정", add:"추가", cancel:"취소", open:"열기", markFinished:"완료로 표시", markUnfinished:"미완료로 표시", released:"공개됨", markAll:"모두 봤음으로 표시", upToDate:"최신", unseenN:"미시청 {n}", progress:"진행", rating:"평점", tags:"태그", synopsis:"줄거리", newList:"새 리스트", delete:"삭제", allLists:"모든 리스트", editProfile:"프로필 편집", backup:"백업", export:"내보내기", import:"가져오기", removeLib:"라이브러리에서 제거", updatesNone:"지금은 새 소식 없음", updatesSome:"새 소식 {n}개", librarySub:"저장한 모든 것을 이 기기에 보관.", listsSub:"원하는 대로 정리 — 드래그로 순서 변경, 커버 선택.", status:"상태", current:"진행 중", planned:"예정", completed:"완료", on_hold:"보류", dropped:"중단", manage:"관리", showMore:"더 보기", showLess:"접기", cover:"커버", rename:"이름 변경", inThisList:"이 리스트에", addWorks:"작품 추가", dragReorder:"드래그로 순서 변경", viewToggle:"레이아웃 전환", viewRows:"리스트", viewGrid:"그리드", title:"제목", platform:"플랫폼", releaseDate:"출시일", price:"가격", trailer:"트레일러", displayName:"표시 이름", changePhoto:"사진 변경", language:"언어", uiLanguage:"앱 언어", translateLanguage:"기본 번역 언어", account:"계정", email:"이메일", changeEmail:"이메일 변경", changePassword:"비밀번호 변경", currentPassword:"현재 비밀번호", newPassword:"새 비밀번호", save:"저장", signedInAs:"로그인 계정", notSignedIn:"로그인 안 됨 — 동기화는 선택 사항입니다.", newAlerts:"새 에피소드 알림", newAlertsSub:"안 본 공개분이 있는 작품을 표시합니다.", yourLibrary:"내 라이브러리", exportRestore:"백업을 내보내거나 복원하세요.", cloudSync:"클라우드 동기화", cloudSyncSub:"선택 — 로그인하면 기기 간 동기화.", manageSync:"관리", rateShare:"평가 및 공유", rateShareSub:"다른 사람이 Yomu를 발견하도록 도와줍니다.", spread:"널리 알리기", enjoying:"Yomu가 마음에 드나요?", unlocked:"오너 에디션 — 모든 Pro 기능이 잠금 해제됨.", updates:"알림", addByName:"이름으로 추가", valSaveT:"어디서나 저장", valSaveB:"어떤 사이트에서도 한 번에 — 북마크를 잃지 마세요.", valAllT:"모든 것을 한 라이브러리에", valAllB:"만화·애니·드라마·영화·게임을 한곳에.", valResumeT:"한 번에 이어보기", valResumeB:"어떤 기기에서도 멈춘 곳에서 바로." },
  pt: { name:"Português", home:"Início", library:"Biblioteca", lists:"Listas", games:"Jogos", plans:"Planos", settings:"Definições", search:"Pesquisar",
    continue:"Continuar", newWeek:"Novidades da semana", becauseYouLove:"Porque gostas de {g}", yourGenres:"Os teus géneros", recentlyAdded:"Adicionados recentemente",
    resume:"Retomar", details:"Detalhes", welcomeTitle:"Bem-vindo ao Yomu", tracked:"Seguidos", reading:"Leitura", watching:"A ver", favorites:"Favoritos", finished:"Terminados", all:"Tudo",
    gamesSub:"Segue jogos esperados — lançamentos, preços, trailers e pré-registos.", addGame:"Adicionar jogo", plansTitle:"Escolhe o teu plano", plansSub:"Grátis para sempre no seguimento. Pro para sync, alertas e mais.", mostPopular:"Mais popular", goPro:"Ser Pro", getLifetime:"Vitalício", getStarted:"Começar", currentPlan:"Atual", free:"Grátis", watchTrailer:"Ver trailer", preRegistered:"Pré-registado",
    welcomeBody:"Abre um manga, webtoon, anime, série ou jogo e guarda na janela do Yomu. Aparece aqui.", comingSoon:"Em breve", add:"Adicionar", cancel:"Cancelar", open:"Abrir", markFinished:"Marcar terminado", markUnfinished:"Marcar em curso", released:"Lançados", markAll:"Marcar tudo como visto", upToDate:"Em dia", unseenN:"{n} por ver", progress:"Progresso", rating:"Avaliação", tags:"Etiquetas", synopsis:"Sinopse", newList:"Nova lista", delete:"Eliminar", allLists:"Todas as listas", editProfile:"Editar perfil", backup:"Cópia de segurança", export:"Exportar", import:"Importar", removeLib:"Remover da biblioteca", updatesNone:"Nada de novo por agora", updatesSome:"{n} com novidades", librarySub:"Tudo o que guardaste, neste dispositivo.", listsSub:"Organiza as tuas obras à tua maneira — arrasta para reordenar, escolhe uma capa.", status:"Estado", current:"Em curso", planned:"Planeado", completed:"Concluído", on_hold:"Em pausa", dropped:"Abandonado", manage:"Gerir", showMore:"Ver mais", showLess:"Ver menos", cover:"Capa", rename:"Renomear", inThisList:"Nesta lista", addWorks:"Adicionar obras", dragReorder:"arrasta para reordenar", viewToggle:"Mudar disposição", viewRows:"Lista", viewGrid:"Grelha", title:"Título", platform:"Plataforma", releaseDate:"Data de lançamento", price:"Preço", trailer:"Trailer", displayName:"Nome apresentado", changePhoto:"Mudar foto", language:"Idioma", uiLanguage:"Idioma da app", translateLanguage:"Idioma de tradução padrão", account:"Conta", email:"E-mail", changeEmail:"Mudar e-mail", changePassword:"Mudar palavra-passe", currentPassword:"Palavra-passe atual", newPassword:"Nova palavra-passe", save:"Guardar", signedInAs:"Sessão iniciada como", notSignedIn:"Sem sessão — a sync é opcional.", newAlerts:"Alertas de novos episódios", newAlertsSub:"Assinala obras com conteúdo lançado que não viste.", yourLibrary:"A tua biblioteca", exportRestore:"Exporta uma cópia, ou restaura-a.", cloudSync:"Sync na nuvem", cloudSyncSub:"Opcional — inicia sessão para sincronizar dispositivos.", manageSync:"Gerir", rateShare:"Avaliar e partilhar", rateShareSub:"Ajuda outros a descobrir o Yomu.", spread:"Espalha a palavra", enjoying:"A gostar do Yomu?", unlocked:"Edição de proprietário — todas as funções Pro desbloqueadas.", updates:"Novidades", addByName:"Adicionar por nome", valSaveT:"Guarda em qualquer lado", valSaveB:"Um clique em qualquer site — sem marcadores perdidos.", valAllT:"Uma biblioteca para tudo", valAllB:"Manga, anime, séries, filmes e jogos juntos.", valResumeT:"Retoma num clique", valResumeB:"Continua exatamente onde paraste, em qualquer dispositivo." },
  "zh-CN": { name:"中文（简体）", home:"首页", library:"资料库", lists:"清单", games:"游戏", plans:"订阅", settings:"设置", search:"搜索", librarySub:"你保存的一切，都在此设备上。", listsSub:"按你的方式整理作品 — 拖动排序，选择封面。", continue:"继续观看", newWeek:"本周新增", becauseYouLove:"因为你喜欢 {g}", yourGenres:"你的类型", recentlyAdded:"最近添加", resume:"继续", details:"详情", addByName:"按名称添加", welcomeTitle:"欢迎使用 Yomu", welcomeBody:"Yomu 会记住你在任何阅读或观看内容中停下的位置 — 漫画、条漫、动画、剧集、电影和游戏。打开页面、点击保存，然后从这里一键继续。", valSaveT:"随处保存", valSaveB:"在任意网站一键保存 — 不再丢失书签。", valAllT:"一个资料库容纳一切", valAllB:"漫画、动画、剧集、电影和游戏集于一处。", valResumeT:"一键继续", valResumeB:"在任何设备上精确接着上次的进度。", tracked:"追踪中", reading:"阅读", watching:"观看", favorites:"收藏", finished:"已完成", all:"全部", status:"状态", current:"进行中", planned:"计划中", completed:"已完成", on_hold:"暂停", dropped:"已弃", markFinished:"标记为完成", markUnfinished:"标记为未完成", open:"打开", progress:"进度", released:"已发布", markAll:"全部标记为已看", unseenN:"{n} 个未看", upToDate:"已是最新", rating:"评分", tags:"标签", synopsis:"简介", manage:"管理", removeLib:"从资料库移除", showMore:"展开", showLess:"收起", newList:"新建清单", cover:"封面", rename:"重命名", delete:"删除", inThisList:"在此清单中", addWorks:"添加作品", allLists:"所有清单", dragReorder:"拖动排序", viewToggle:"切换布局", viewRows:"列表", viewGrid:"网格", gamesSub:"追踪期待的游戏 — 发售日期、价格、预告片和预注册。", addGame:"添加游戏", title:"标题", platform:"平台", releaseDate:"发售日期", price:"价格", trailer:"预告片", watchTrailer:"观看预告片", preRegistered:"已预注册", comingSoon:"即将推出", add:"添加", cancel:"取消", free:"免费", editProfile:"编辑资料", displayName:"显示名称", changePhoto:"更换头像", language:"语言", uiLanguage:"应用语言", translateLanguage:"默认翻译语言", account:"账户", email:"邮箱", changeEmail:"更改邮箱", changePassword:"更改密码", currentPassword:"当前密码", newPassword:"新密码", save:"保存", signedInAs:"已登录为", notSignedIn:"未登录 — 同步为可选。", newAlerts:"新剧集提醒", newAlertsSub:"标出有你尚未观看的已发布内容的作品。", backup:"备份", yourLibrary:"你的资料库", exportRestore:"导出备份文件，或恢复备份。", export:"导出", import:"导入", cloudSync:"云同步", cloudSyncSub:"可选 — 登录以在设备间同步。", manageSync:"管理", rateShare:"评分与分享", rateShareSub:"帮助更多人发现 Yomu。", spread:"广而告之", enjoying:"喜欢 Yomu 吗？", plansTitle:"选择你的方案", plansSub:"本地追踪永久免费。升级 Pro 获得同步、提醒等。", unlocked:"所有者版本 — 所有 Pro 功能已解锁。", mostPopular:"最受欢迎", getStarted:"开始使用", goPro:"升级 Pro", getLifetime:"购买终身版", currentPlan:"当前", updatesNone:"暂无新内容", updatesSome:"{n} 项有新内容", updates:"通知" },
};
// Complete translations for the newer UI sections (discover, plans, drawer,
// OCR settings) in the remaining languages, so nothing falls back to English.
// Merged non-destructively: only keys still missing on a language are filled.
const LANG_EXTRA = {
  es: { discover:"Descubrir", forYou:"Recomendado para ti", forYouSub:"Según tus etiquetas", trendingManga:"Manga y manhwa en tendencia", popularAnime:"Anime popular ahora", newGames:"Nuevos lanzamientos", upcomingGames:"Próximos juegos", addToLib:"Añadir a la biblioteca", refresh:"Actualizar", loadingReco:"Buscando novedades…", imgTranslate:"Traducción de imágenes manga", imgTranslateSub:"Traduce los bocadillos dentro de imágenes de manga/webtoon (OCR). Las páginas con texto ya se traducen con un clic; los escaneos en imagen necesitan un pequeño servidor de traducción gratuito — ejecútalo una vez, pega su URL y funciona en todos los lectores.", imgServerLabel:"URL del servidor", imgTest:"Probar", imgTesting:"Probando…", imgOk:"Conectado ✓", imgFail:"Sin respuesta — comprueba la URL y que el servidor esté activo.", imgSetup:"Cómo ejecutar el servidor (gratis, ~2 min)", imgCopy:"Copiar", imgCopied:"Copiado ✓", searchPlaceholder:"Busca o añade por nombre…", work:"obra", works:"obras", upcoming:"Próximamente", discoverGames:"Descubrir juegos", topThisWeek:"Top 10 de la semana", trendingWebtoons:"Webtoons y manhwa en tendencia", mostAnticipated:"Juegos más esperados", hotGames:"Los juegos más grandes ahora", openInNew:"Abrir", discoverMore:"Descubrir más", progHintWatch:"El último episodio que viste.", progHintRead:"El último capítulo que leíste.", totalReleased:"Último disponible", totalHint:"El capítulo/episodio más reciente publicado — para que Yomu te avise cuando haya algo nuevo.", planFreePer:"para siempre", planProPer:"o 29,99 $/año — 2 meses gratis", planLifePer:"pago único — mejor valor", planFoot:"El seguimiento es gratis para siempre. Los planes de pago financian la sync, las alertas y el motor de traducción opcionales.", freeFeatures:["Seguimiento ilimitado — manga, manhwa, webtoons, anime, series, películas, juegos","Detección automática y guardado en un clic, reanuda donde sea","Listas, etiquetas, valoraciones, sinopsis, agrupación de series","Seguimiento de episodios/capítulos vistos","Importa desde MAL, CSV, JSON + copia","Todos los idiomas de la interfaz","Traducción de página — hasta 5 páginas/día"], proFeatures:["Todo lo de Free","Sincronización opcional entre dispositivos","Alertas de nuevos episodios y lanzamientos (notificaciones)","Traducción de página ilimitada, todos los idiomas, motor prioritario","Estadísticas completas — rachas, tendencias, previsiones","Portadas de listas y perfil personalizados (subir, recortar)","Soporte prioritario y funciones anticipadas"], lifeFeatures:["Todo lo de Pro, para siempre","Sin suscripción, nunca","Insignia de fundador en tu perfil","Todas las futuras actualizaciones incluidas","Apoya una herramienta independiente"] },
  de: { discover:"Entdecken", forYou:"Für dich empfohlen", forYouSub:"Basierend auf deinen Tags", trendingManga:"Angesagte Manga & Manhwa", popularAnime:"Beliebte Anime gerade", newGames:"Neue Spiele", upcomingGames:"Kommende Spiele", addToLib:"Zur Bibliothek", refresh:"Aktualisieren", loadingReco:"Suche Neues…", imgTranslate:"Manga-Bildübersetzung", imgTranslateSub:"Übersetzt Sprechblasen in Manga-/Webtoon-Bildern (OCR). Text-Seiten werden schon mit einem Klick übersetzt; Bild-Scanlations brauchen einen kleinen kostenlosen Übersetzungsserver — einmal starten, URL einfügen, und es funktioniert in jedem Reader.", imgServerLabel:"Server-URL", imgTest:"Testen", imgTesting:"Test…", imgOk:"Verbunden ✓", imgFail:"Keine Antwort — prüfe die URL und ob der Server läuft.", imgSetup:"So startest du den Server (gratis, ~2 Min.)", imgCopy:"Kopieren", imgCopied:"Kopiert ✓", searchPlaceholder:"Suchen oder per Name hinzufügen…", work:"Werk", works:"Werke", upcoming:"Demnächst", discoverGames:"Spiele entdecken", topThisWeek:"Top 10 diese Woche", trendingWebtoons:"Angesagte Webtoons & Manhwa", mostAnticipated:"Meisterwartete Spiele", hotGames:"Die größten Spiele gerade", openInNew:"Öffnen", discoverMore:"Mehr entdecken", progHintWatch:"Die zuletzt gesehene Folge.", progHintRead:"Das zuletzt gelesene Kapitel.", totalReleased:"Neuestes verfügbar", totalHint:"Das neueste erschienene Kapitel/Folge — damit Yomu dich bei Neuem benachrichtigt.", planFreePer:"für immer", planProPer:"oder 29,99 $/Jahr — 2 Monate gratis", planLifePer:"einmalig — bester Wert", planFoot:"Lokales Tracking ist für immer gratis und hängt nie von unseren Servern ab. Bezahlpläne finanzieren die optionale Sync, Hinweise und die Übersetzungs-Engine.", freeFeatures:["Unbegrenztes Tracking — Manga, Manhwa, Webtoons, Anime, Serien, Filme, Spiele","Auto-Erkennung & Speichern mit einem Klick, überall fortsetzen","Listen, Tags, Bewertungen, Zusammenfassung, Serien-Gruppierung","Verfolgung gesehener Folgen/Kapitel","Import aus MAL, CSV, JSON + lokales Backup","Alle UI-Sprachen","Seitenübersetzung — bis zu 5 Seiten/Tag"], proFeatures:["Alles aus Free","Optionale Synchronisierung zwischen Geräten","Hinweise zu neuen Folgen & Spiele-Releases (Benachrichtigungen)","Unbegrenzte Seitenübersetzung, alle Sprachen, Prioritäts-Engine","Volle Statistiken — Serien, Trends, Prognosen","Eigene Listen-Cover & Profil (Hochladen, Zuschneiden)","Prioritäts-Support & frühe Funktionen"], lifeFeatures:["Alles aus Pro, für immer","Nie ein Abo","Gründer-Abzeichen im Profil","Alle künftigen Updates inklusive","Unterstütze ein unabhängiges Tool"] },
  ja: { discover:"見つける", forYou:"あなたへのおすすめ", forYouSub:"あなたのタグに基づく", trendingManga:"急上昇の漫画・マンファ", popularAnime:"人気のアニメ", newGames:"新作ゲーム", upcomingGames:"発売予定のゲーム", addToLib:"ライブラリに追加", refresh:"更新", loadingReco:"新着を探しています…", imgTranslate:"漫画画像の翻訳", imgTranslateSub:"漫画・ウェブトゥーン画像内の吹き出しを翻訳（OCR）。テキストのページはワンクリックで翻訳できます。画像スキャンには無料の小さな翻訳サーバーが必要です — 一度起動してURLを貼れば、どのビューアでも動作します。", imgServerLabel:"サーバーURL", imgTest:"テスト", imgTesting:"テスト中…", imgOk:"接続済み ✓", imgFail:"応答なし — URLとサーバーの起動を確認してください。", imgSetup:"サーバーの起動方法（無料・約2分）", imgCopy:"コピー", imgCopied:"コピー済み ✓", searchPlaceholder:"名前で検索または追加…", work:"作品", works:"作品", upcoming:"近日", discoverGames:"ゲームを見つける", topThisWeek:"今週のトップ10", trendingWebtoons:"急上昇のウェブトゥーン・マンファ", mostAnticipated:"最も期待されるゲーム", hotGames:"今最も大きいゲーム", openInNew:"開く", discoverMore:"もっと見つける", progHintWatch:"最後に見た話数。", progHintRead:"最後に読んだ話数。", totalReleased:"最新の公開分", totalHint:"公開された最新の話数 — 新着があればYomuが知らせます。", planFreePer:"永久 — ローカルファースト", planProPer:"または $29.99/年 — 2か月無料", planLifePer:"買い切り — 最もお得", planFoot:"ローカル管理は永久無料で、当社サーバーに依存しません。有料プランは任意の同期・通知・翻訳エンジンを支えます。", freeFeatures:["無制限の管理 — 漫画・マンファ・ウェブトゥーン・アニメ・ドラマ・映画・ゲーム","自動検出とワンクリック保存、どこでも再開","リスト・タグ・評価・あらすじ・シリーズまとめ","視聴/既読の話数管理","MAL・CSV・JSONからのインポート＋ローカルバックアップ","すべてのUI言語","ページ翻訳 — 1日5ページまで"], proFeatures:["Freeのすべて","任意のアカウント同期","新エピソード・ゲーム発売の通知","無制限のページ翻訳、全言語、優先エンジン","詳細な統計 — 連続記録・傾向・予測","カスタムのリストカバーとプロフィール（アップロード・トリミング）","優先サポートと先行機能"], lifeFeatures:["Proのすべて、永久に","サブスクなし","プロフィールに創設者バッジ","今後のすべての更新を含む","独立系・ローカルファーストのツールを支援"] },
  ko: { discover:"탐색", forYou:"맞춤 추천", forYouSub:"내 태그 기반", trendingManga:"인기 만화·웹툰", popularAnime:"지금 인기 애니", newGames:"신작 게임", upcomingGames:"출시 예정 게임", addToLib:"라이브러리에 추가", refresh:"새로고침", loadingReco:"새 추천을 찾는 중…", imgTranslate:"만화 이미지 번역", imgTranslateSub:"만화/웹툰 이미지 속 말풍선을 번역합니다(OCR). 텍스트 페이지는 이미 한 번에 번역됩니다. 이미지 스캔은 작은 무료 번역 서버가 필요합니다 — 한 번 실행하고 URL을 붙여넣으면 모든 뷰어에서 작동합니다.", imgServerLabel:"서버 URL", imgTest:"테스트", imgTesting:"테스트 중…", imgOk:"연결됨 ✓", imgFail:"응답 없음 — URL과 서버 실행 여부를 확인하세요.", imgSetup:"서버 실행 방법(무료, 약 2분)", imgCopy:"복사", imgCopied:"복사됨 ✓", searchPlaceholder:"이름으로 검색하거나 추가…", work:"작품", works:"작품", upcoming:"출시 예정", discoverGames:"게임 탐색", topThisWeek:"이번 주 톱 10", trendingWebtoons:"인기 웹툰·만화", mostAnticipated:"가장 기대되는 게임", hotGames:"지금 가장 큰 게임", openInNew:"열기", discoverMore:"더 탐색", progHintWatch:"마지막으로 본 에피소드.", progHintRead:"마지막으로 읽은 화.", totalReleased:"최신 공개분", totalHint:"공개된 최신 화/에피소드 — 새 소식이 있으면 Yomu가 알려줍니다.", planFreePer:"영원히 — 로컬 우선", planProPer:"또는 연 $29.99 — 2개월 무료", planLifePer:"1회 결제 — 최고의 가치", planFoot:"로컬 추적은 영원히 무료이며 서버에 의존하지 않습니다. 유료 요금제는 선택적 동기화·알림·번역 엔진을 지원합니다.", freeFeatures:["무제한 추적 — 만화·웹툰·애니·드라마·영화·게임","자동 감지 및 원클릭 저장, 어디서나 이어보기","리스트·태그·평점·줄거리·시리즈 묶기","시청/읽은 화 추적","MAL·CSV·JSON 가져오기 + 로컬 백업","모든 UI 언어","페이지 번역 — 하루 5페이지까지"], proFeatures:["Free의 모든 기능","선택적 계정 동기화","새 에피소드·게임 출시 알림","무제한 페이지 번역, 모든 언어, 우선 엔진","전체 통계 — 연속 기록·추세·예측","맞춤 리스트 커버 및 프로필(업로드·자르기)","우선 지원 및 신기능 우선 제공"], lifeFeatures:["Pro의 모든 기능, 영원히","구독 없음","프로필에 창립자 배지","향후 모든 업데이트 포함","독립적이고 로컬 우선인 도구를 후원"] },
  pt: { discover:"Descobrir", forYou:"Recomendado para ti", forYouSub:"Com base nas tuas etiquetas", trendingManga:"Manga e manhwa em alta", popularAnime:"Anime popular agora", newGames:"Novos lançamentos", upcomingGames:"Próximos jogos", addToLib:"Adicionar à biblioteca", refresh:"Atualizar", loadingReco:"A procurar novidades…", imgTranslate:"Tradução de imagens de manga", imgTranslateSub:"Traduz os balões dentro de imagens de manga/webtoon (OCR). As páginas com texto já se traduzem com um clique; os scans em imagem precisam de um pequeno servidor de tradução gratuito — executa-o uma vez, cola o URL e funciona em qualquer leitor.", imgServerLabel:"URL do servidor", imgTest:"Testar", imgTesting:"A testar…", imgOk:"Ligado ✓", imgFail:"Sem resposta — verifica o URL e se o servidor está a correr.", imgSetup:"Como executar o servidor (grátis, ~2 min)", imgCopy:"Copiar", imgCopied:"Copiado ✓", searchPlaceholder:"Pesquisa ou adiciona por nome…", work:"obra", works:"obras", upcoming:"Em breve", discoverGames:"Descobrir jogos", topThisWeek:"Top 10 da semana", trendingWebtoons:"Webtoons e manhwa em alta", mostAnticipated:"Jogos mais aguardados", hotGames:"Os maiores jogos do momento", openInNew:"Abrir", discoverMore:"Descobrir mais", progHintWatch:"O último episódio que viste.", progHintRead:"O último capítulo que leste.", totalReleased:"Último disponível", totalHint:"O capítulo/episódio mais recente lançado — para o Yomu te avisar quando há novidades.", planFreePer:"para sempre", planProPer:"ou 29,99 $/ano — 2 meses grátis", planLifePer:"pagamento único — melhor valor", planFoot:"O seguimento é grátis para sempre. Os planos pagos financiam a sync, os alertas e o motor de tradução opcionais.", freeFeatures:["Seguimento ilimitado — manga, manhwa, webtoons, anime, séries, filmes, jogos","Deteção automática e guardar num clique, retoma em qualquer lado","Listas, etiquetas, avaliações, sinopse, agrupar séries","Seguimento de episódios/capítulos vistos","Importa de MAL, CSV, JSON + cópia","Todos os idiomas da interface","Tradução de página — até 5 páginas/dia"], proFeatures:["Tudo do Free","Sincronização opcional entre dispositivos","Alertas de novos episódios e lançamentos (notificações)","Tradução de página ilimitada, todos os idiomas, motor prioritário","Estatísticas completas — sequências, tendências, previsões","Capas de listas e perfil personalizados (carregar, recortar)","Suporte prioritário e funções antecipadas"], lifeFeatures:["Tudo do Pro, para sempre","Sem subscrição, nunca","Distintivo de fundador no teu perfil","Todas as futuras atualizações incluídas","Apoia uma ferramenta independente"] },
  "zh-CN": { discover:"发现", forYou:"为你推荐", forYouSub:"根据你的标签", trendingManga:"热门漫画和韩漫", popularAnime:"当下热门动画", newGames:"新游戏", upcomingGames:"即将推出的游戏", addToLib:"加入资料库", refresh:"刷新", loadingReco:"正在寻找新内容…", imgTranslate:"漫画图片翻译", imgTranslateSub:"翻译漫画/条漫图片内的对话气泡（OCR）。文字页面已可一键翻译；图片扫描需要一个小型免费翻译服务器 — 运行一次，粘贴其网址，即可在所有阅读器上使用。", imgServerLabel:"服务器网址", imgTest:"测试", imgTesting:"测试中…", imgOk:"已连接 ✓", imgFail:"无响应 — 请检查网址及服务器是否运行。", imgSetup:"如何运行服务器（免费，约2分钟）", imgCopy:"复制", imgCopied:"已复制 ✓", searchPlaceholder:"按名称搜索或添加…", work:"作品", works:"作品", upcoming:"即将推出", discoverGames:"发现游戏", topThisWeek:"本周前 10", trendingWebtoons:"热门条漫和韩漫", mostAnticipated:"最受期待的游戏", hotGames:"当下最大的游戏", openInNew:"打开", discoverMore:"发现更多", progHintWatch:"你最后观看的一集。", progHintRead:"你最后阅读的一话。", totalReleased:"最新可用", totalHint:"已发布的最新话/集 — 以便 Yomu 在有新内容时通知你。", planFreePer:"永久 — 本地优先", planProPer:"或 $29.99/年 — 免费 2 个月", planLifePer:"一次性 — 最超值", planFoot:"本地追踪永久免费，且从不依赖我们的服务器。付费方案用于支持可选的同步、提醒和翻译引擎。", freeFeatures:["无限追踪 — 漫画、韩漫、条漫、动画、剧集、电影、游戏","自动识别、一键保存，随处继续","清单、标签、评分、简介、系列归组","已看/已读话数追踪","从 MAL、CSV、JSON 导入 + 本地备份","所有界面语言","页面翻译 — 每天最多 5 页"], proFeatures:["包含 Free 的全部","可选的账户同步","新剧集和游戏发售提醒（通知）","无限页面翻译、所有语言、优先引擎","完整统计 — 连续天数、趋势、预测","自定义清单封面和资料（上传、裁剪）","优先支持和抢先体验"], lifeFeatures:["永久包含 Pro 全部","永不订阅","个人资料上的创始人徽章","包含所有未来更新","支持一个独立、本地优先的工具"] },
};
for (const code in LANG_EXTRA) { const L = LANGS[code]; if (!L) continue; for (const k in LANG_EXTRA[code]) if (L[k] === undefined) L[k] = LANG_EXTRA[code][k]; }
const DASHBOARD_LOCALES={"en":["Discover today","Your reading, your shows and what’s trending now.","My library","Featured","Explore title","Discover now","Trending now","Recently airing","Your bookmarked reading and streaming sites are collected here. Open a site to continue browsing.","Bookmark a site from the Yomu popup to find it here.","Your collection","Search above to add a title. Use these filters to find what you have saved.","Group your titles into lists, then open a list to manage it.","Your saved titles, lists and favourite sites in one place."],"fr":["À découvrir aujourd’hui","Vos lectures, vos séries et les tendances du moment.","Ma bibliothèque","À la une","Voir la fiche","À découvrir maintenant","Tendances du moment","Diffusion récente","Retrouvez ici les sites de lecture et de streaming ajoutés à vos favoris. Ouvrez un site pour poursuivre votre visite.","Ajoutez un site aux favoris depuis le popup Yomu pour le retrouver ici.","Votre collection","Recherchez une œuvre en haut pour l’ajouter. Utilisez les filtres pour retrouver vos œuvres enregistrées.","Regroupez vos œuvres dans des listes, puis ouvrez une liste pour la gérer.","Vos œuvres enregistrées, vos listes et vos sites favoris au même endroit."],"ja":["今日のおすすめ","読書、視聴中の作品、今のトレンド。","マイライブラリ","注目作品","作品の詳細","作品を探す","今のトレンド","最近の放送","お気に入りに追加した読書・動画サイトがここに表示されます。サイトを開いて閲覧を続けましょう。","Yomuのポップアップからサイトをお気に入りに追加すると、ここに表示されます。","保存した作品","上の検索欄で作品を探して追加できます。フィルターで保存した作品を絞り込めます。","作品をリストにまとめ、リストを開いて管理できます。","保存した作品、リスト、お気に入りのサイトを一か所に。"],"es":["Descubre hoy","Tus lecturas, tus series y las tendencias del momento.","Mi biblioteca","Destacados","Ver detalles","Descubrir ahora","Tendencias actuales","Emisiones recientes","Aquí están tus sitios de lectura y vídeo favoritos. Abre uno para seguir explorando.","Añade un sitio a favoritos desde la ventana de Yomu para verlo aquí.","Tu colección","Busca arriba para añadir una obra. Usa los filtros para encontrar lo que guardaste.","Agrupa tus obras en listas y abre una lista para gestionarla.","Tus obras, listas y sitios favoritos en un solo lugar."],"de":["Heute entdecken","Deine Bücher, Serien und aktuellen Trends.","Meine Bibliothek","Im Fokus","Details ansehen","Jetzt entdecken","Aktuelle Trends","Zuletzt ausgestrahlt","Hier findest du deine bevorzugten Lese- und Streamingseiten. Öffne eine Seite, um weiterzustöbern.","Speichere eine Seite im Yomu-Popup als Favorit, damit sie hier erscheint.","Deine Sammlung","Suche oben nach einem Titel, um ihn hinzuzufügen. Filter helfen beim Wiederfinden.","Ordne deine Titel in Listen und öffne eine Liste zum Bearbeiten.","Gespeicherte Titel, Listen und Lieblingsseiten an einem Ort."],"ko":["오늘의 추천","읽고 보는 작품과 지금의 인기 콘텐츠.","내 라이브러리","주목할 작품","작품 정보","작품 둘러보기","지금 인기","최근 방영","즐겨찾기에 추가한 읽기 및 동영상 사이트를 모았습니다. 사이트를 열어 계속 둘러보세요.","Yomu 팝업에서 사이트를 즐겨찾기에 추가하면 여기에 표시됩니다.","내 컬렉션","위에서 작품을 검색해 추가하세요. 필터로 저장한 작품을 찾을 수 있습니다.","작품을 리스트로 묶고 리스트를 열어 관리하세요.","저장한 작품, 리스트, 즐겨찾는 사이트를 한곳에서."],"pt":["Descobre hoje","As tuas leituras, séries e tendências do momento.","A minha biblioteca","Em destaque","Ver detalhes","Descobrir agora","Tendências atuais","Emissões recentes","Os teus sites favoritos de leitura e vídeo estão aqui. Abre um para continuar.","Adiciona um site aos favoritos na janela do Yomu para o encontrares aqui.","A tua coleção","Pesquisa acima para adicionar uma obra. Usa os filtros para encontrar o que guardaste.","Agrupa as obras em listas e abre uma lista para a gerir.","Obras guardadas, listas e sites favoritos num só lugar."],"zh-CN":["今日推荐","你的阅读、追剧和当下热门作品。","我的资料库","精选作品","查看详情","发现作品","当前热门","最近播出","收藏的阅读和视频网站都在这里。打开网站即可继续浏览。","在 Yomu 弹出窗口中收藏网站，即可在这里找到它。","我的收藏","在上方搜索并添加作品，使用筛选查找已保存的内容。","将作品整理成清单，打开清单即可管理。","在一处查看保存的作品、清单和收藏的网站。"]};
const DASHBOARD_KEYS=["homeToday","homeIntro","myLibrary","featured","exploreTitle","discoverNow","trendingNow","recentlyAiring","sitesHelp","sitesEmpty","collectionTitle","collectionHelp","listsHelp","libraryIntro"];
for(const [code,values] of Object.entries(DASHBOARD_LOCALES)){if(LANGS[code])DASHBOARD_KEYS.forEach((key,index)=>LANGS[code][key]=values[index]);}
for(const [code,value] of Object.entries({en:"Your sites",fr:"Vos sites favoris",ja:"お気に入りのサイト",es:"Tus sitios",de:"Deine Seiten",ko:"즐겨찾는 사이트",pt:"Os teus sites","zh-CN":"收藏的网站"}))if(LANGS[code])LANGS[code].sitesTitle=value;
const LIBRARY_LOCALE_KEYS=["changeBanner","bioPh","sortBy","sortRecent","sortTitle","sortRating","sortRemaining","sortAdded","formatLabel","withoutList","showAll","skipContent"];
const LIBRARY_LOCALES={
  "en": [
    "Change banner",
    "Write a short bio…",
    "Sort by",
    "Recent activity",
    "Title",
    "My rating",
    "Remaining",
    "Recently added",
    "Format",
    "Without an active list",
    "Show all",
    "Skip to content"
  ],
  "fr": [
    "Changer la bannière",
    "Écris une petite bio…",
    "Trier par",
    "Activité récente",
    "Titre",
    "Ma note",
    "À rattraper",
    "Ajout récent",
    "Format",
    "Sans liste active",
    "Tout afficher",
    "Aller au contenu"
  ],
  "ja": [
    "バナーを変更",
    "自己紹介を書く…",
    "並べ替え",
    "最近のアクティビティ",
    "タイトル",
    "自分の評価",
    "未読・未視聴",
    "最近追加した順",
    "形式",
    "リストに未登録",
    "すべて表示",
    "本文へ移動"
  ],
  "es": [
    "Cambiar banner",
    "Escribe una breve biografía…",
    "Ordenar por",
    "Actividad reciente",
    "Título",
    "Mi valoración",
    "Pendiente",
    "Añadido recientemente",
    "Formato",
    "Sin lista activa",
    "Mostrar todo",
    "Ir al contenido"
  ],
  "de": [
    "Banner ändern",
    "Schreibe eine kurze Biografie…",
    "Sortieren nach",
    "Letzte Aktivität",
    "Titel",
    "Meine Bewertung",
    "Noch offen",
    "Zuletzt hinzugefügt",
    "Format",
    "Ohne aktive Liste",
    "Alle anzeigen",
    "Zum Inhalt springen"
  ],
  "ko": [
    "배너 변경",
    "짧은 소개를 작성하세요…",
    "정렬 기준",
    "최근 활동",
    "제목",
    "내 평점",
    "남은 작품",
    "최근 추가",
    "형식",
    "목록에 없는 작품",
    "모두 보기",
    "본문으로 이동"
  ],
  "pt": [
    "Alterar banner",
    "Escreve uma breve biografia…",
    "Ordenar por",
    "Atividade recente",
    "Título",
    "A minha avaliação",
    "Por terminar",
    "Adicionados recentemente",
    "Formato",
    "Sem lista ativa",
    "Mostrar tudo",
    "Ir para o conteúdo"
  ],
  "zh-CN": [
    "更换横幅",
    "写一段简介…",
    "排序方式",
    "最近活动",
    "标题",
    "我的评分",
    "待完成",
    "最近添加",
    "类型",
    "未加入清单",
    "显示全部",
    "跳转到正文"
  ]
};
for(const [code,values] of Object.entries(LIBRARY_LOCALES))LIBRARY_LOCALE_KEYS.forEach((key,index)=>LANGS[code][key]=values[index]);
const DETAIL_LOCALES={
"priceIndicative":["Indicative price — check the store","Prix indicatif — vérifier en boutique","参考価格 — ストアで確認","Precio orientativo — consulta la tienda","Richtpreis — im Store prüfen","참고 가격 — 스토어에서 확인","Preço indicativo — confirmar na loja","参考价格 — 请到商店确认"],
"priceLastKnown":["Last known price — check the store","Dernier prix connu — à vérifier en boutique","前回の価格 — ストアで確認","Último precio conocido — consulta la tienda","Zuletzt bekannter Preis — im Store prüfen","마지막 확인 가격 — 스토어에서 확인","Último preço conhecido — confirmar na loja","上次已知价格 — 请到商店确认"],
"refreshDetails":["Refresh details","Actualiser la fiche","作品情報を更新","Actualizar ficha","Details aktualisieren","작품 정보 새로고침","Atualizar ficha","刷新作品信息"],
"refreshLoading":["Looking up details…","Recherche des informations…","作品情報を取得中…","Buscando información…","Details werden geladen…","정보를 불러오는 중…","A procurar informações…","正在获取信息…"],
"libraryLoading":["Loading your library…","Chargement de ta bibliothèque…","ライブラリを読み込み中…","Cargando tu biblioteca…","Deine Bibliothek wird geladen…","라이브러리를 불러오는 중…","A carregar a tua biblioteca…","正在加载你的书库…"],
"libraryLoadFailed":["Your library could not be loaded. Try refreshing.","Impossible de charger ta bibliothèque. Réessaie avec Actualiser.","ライブラリを読み込めませんでした。更新してください。","No se pudo cargar tu biblioteca. Intenta actualizar.","Deine Bibliothek konnte nicht geladen werden. Bitte aktualisieren.","라이브러리를 불러오지 못했습니다. 새로고침해 주세요.","Não foi possível carregar a tua biblioteca. Tenta atualizar.","无法加载书库，请尝试刷新。"],
"refreshFailed":["Update failed. Try again.","Actualisation impossible. Réessaie.","更新できませんでした。もう一度お試しください。","No se pudo actualizar. Inténtalo de nuevo.","Aktualisierung fehlgeschlagen. Erneut versuchen.","업데이트하지 못했습니다. 다시 시도하세요.","Não foi possível atualizar. Tenta novamente.","更新失败，请重试。"],
"refreshDeferred":["Details received. Finish your edits, then refresh this work again.","Informations reçues. Termine tes modifications, puis actualise à nouveau la fiche.","情報を受信しました。編集を終えてから、もう一度更新してください。","Información recibida. Termina tus cambios y vuelve a actualizar la ficha.","Details erhalten. Beende deine Änderungen und aktualisiere den Eintrag erneut.","정보를 받았습니다. 편집을 마친 뒤 다시 새로고침해 주세요.","Informações recebidas. Termina as alterações e atualiza novamente a ficha.","已收到信息。请完成编辑后再次刷新作品。"],
"refreshNone":["No new details available.","Aucune nouvelle information disponible.","新しい情報はありません。","No hay información nueva.","Keine neuen Informationen verfügbar.","새로운 정보가 없습니다.","Não há informações novas.","暂无新信息。"],
"refreshPartial":["Some details updated; other information is still missing.","Certaines informations ont été actualisées ; d’autres restent manquantes.","一部の情報を更新しました。未取得の情報があります。","Se actualizaron algunos datos; aún falta información.","Einige Details wurden aktualisiert; weitere Angaben fehlen noch.","일부 정보를 업데이트했습니다. 아직 없는 정보가 있습니다.","Alguns dados foram atualizados; ainda faltam informações.","已更新部分信息，仍有信息缺失。"],
"refreshDone":["Details updated.","Fiche actualisée.","作品情報を更新しました。","Ficha actualizada.","Details aktualisiert.","작품 정보를 업데이트했습니다.","Ficha atualizada.","作品信息已更新。"],
"showOnHome":["Show on Home","Réafficher sur l’accueil","ホームに表示","Mostrar en inicio","Auf Startseite anzeigen","홈에 표시","Mostrar no início","在首页显示"],
"hideFromHome":["Hide from Home","Masquer de l’accueil","ホームで非表示","Ocultar del inicio","Auf Startseite ausblenden","홈에서 숨기기","Ocultar do início","从首页隐藏"],

  "publication": [
    "Publication / airing",
    "Publication / diffusion",
    "公開・放送状況",
    "Publicación / emisión",
    "Veröffentlichung / Ausstrahlung",
    "연재 / 방영",
    "Publicação / exibição",
    "出版 / 播出"
  ],
  "seriesEnded": [
    "Series ended",
    "Série terminée",
    "シリーズ完結",
    "Serie finalizada",
    "Serie beendet",
    "시리즈 완결",
    "Série terminada",
    "系列已完结"
  ],
  "workFinished": [
    "Work finished",
    "Œuvre terminée",
    "作品完結",
    "Obra finalizada",
    "Werk abgeschlossen",
    "작품 완결",
    "Obra terminada",
    "作品已完结"
  ],
  "partFinished": [
    "Season or installment finished",
    "Saison ou partie terminée",
    "シーズン・部が完結",
    "Temporada o parte finalizada",
    "Staffel oder Teil beendet",
    "시즌 또는 파트 완결",
    "Temporada ou parte terminada",
    "季或篇章已完结"
  ],
  "endUnspecified": [
    "Ended, scope unspecified",
    "Fin indiquée, portée non précisée",
    "終了（対象範囲不明）",
    "Finalizada, alcance no especificado",
    "Beendet, Umfang unklar",
    "종료됨, 범위 불명",
    "Terminada, âmbito não especificado",
    "已结束，范围未注明"
  ],
  "pubOngoing": [
    "Ongoing",
    "En cours",
    "連載・放送中",
    "En curso",
    "Laufend",
    "연재·방영 중",
    "Em curso",
    "连载 / 播出中"
  ],
  "pubUpcoming": [
    "Upcoming",
    "À venir",
    "公開予定",
    "Próximamente",
    "Demnächst",
    "공개 예정",
    "Em breve",
    "即将推出"
  ],
  "pubHiatus": [
    "On hiatus",
    "En pause",
    "休止中",
    "En pausa",
    "Pausiert",
    "휴재·휴방 중",
    "Em pausa",
    "暂停中"
  ],
  "pubCancelled": [
    "Cancelled",
    "Annulée",
    "中止",
    "Cancelada",
    "Abgebrochen",
    "취소됨",
    "Cancelada",
    "已取消"
  ],
  "pubUnknown": [
    "Status unspecified",
    "Statut non renseigné",
    "状況不明",
    "Estado no especificado",
    "Status unbekannt",
    "상태 미상",
    "Estado não indicado",
    "状态未知"
  ],
  "partNote": [
    "This status applies to this entry. It does not confirm the end of the entire series.",
    "Ce statut concerne cette fiche. Il ne confirme pas la fin de toute la série.",
    "この状況はこの項目にのみ適用されます。シリーズ全体の完結を示すものではありません。",
    "Este estado corresponde a esta ficha. No confirma el final de toda la serie.",
    "Dieser Status gilt für diesen Eintrag. Er bestätigt nicht das Ende der gesamten Serie.",
    "이 상태는 이 항목에만 적용됩니다. 전체 시리즈의 완결을 의미하지 않습니다.",
    "Este estado aplica-se a esta ficha. Não confirma o fim de toda a série.",
    "此状态仅适用于本条目，不代表整个系列已完结。"
  ],
  "endNote": [
    "The source does not specify whether the entire series has ended.",
    "La source ne précise pas si toute la série est terminée.",
    "情報源にはシリーズ全体が完結したかどうかの記載がありません。",
    "La fuente no indica si ha terminado toda la serie.",
    "Die Quelle gibt nicht an, ob die gesamte Serie beendet ist.",
    "출처에서 전체 시리즈의 완결 여부를 명시하지 않았습니다.",
    "A fonte não indica se toda a série terminou.",
    "来源未说明整个系列是否已完结。"
  ],
  "platformsLabel": [
    "Platforms",
    "Plateformes",
    "対応プラットフォーム",
    "Plataformas",
    "Plattformen",
    "플랫폼",
    "Plataformas",
    "平台"
  ],
  "creatorsLabel": [
    "Creators",
    "Auteurs",
    "作者・制作者",
    "Creadores",
    "Urheber",
    "작가·제작자",
    "Criadores",
    "作者 / 创作者"
  ],
  "aliasesLabel": [
    "Alternative titles",
    "Autres titres",
    "別タイトル",
    "Títulos alternativos",
    "Alternative Titel",
    "다른 제목",
    "Títulos alternativos",
    "其他名称"
  ],
  "castLabel": [
    "Cast and characters",
    "Distribution et personnages",
    "出演者・登場人物",
    "Reparto y personajes",
    "Besetzung und Figuren",
    "출연진 및 등장인물",
    "Elenco e personagens",
    "演员与角色"
  ],
  "genresLabel": [
    "Genres and themes",
    "Genres et thèmes",
    "ジャンル・テーマ",
    "Géneros y temas",
    "Genres und Themen",
    "장르 및 주제",
    "Géneros e temas",
    "类型与主题"
  ],
  "loadingDetails": [
    "Loading details",
    "Chargement de la fiche",
    "詳細を読み込み中",
    "Cargando detalles",
    "Details werden geladen",
    "상세 정보 불러오는 중",
    "A carregar detalhes",
    "正在加载详情"
  ],
  "chooseList": [
    "Choose a list",
    "Choisir une liste",
    "リストを選ぶ",
    "Elige una lista",
    "Liste auswählen",
    "목록 선택",
    "Escolhe uma lista",
    "选择清单"
  ],
  "selectList": [
    "Select a list",
    "Sélectionner une liste",
    "リストを選択",
    "Selecciona una lista",
    "Liste auswählen",
    "목록을 선택하세요",
    "Seleciona uma lista",
    "请选择清单"
  ],
  "createList": [
    "Create a list",
    "Créer une liste",
    "リストを作成",
    "Crear una lista",
    "Liste erstellen",
    "목록 만들기",
    "Criar uma lista",
    "创建清单"
  ],
  "listNameLabel": [
    "List name",
    "Nom de la liste",
    "リスト名",
    "Nombre de la lista",
    "Listenname",
    "목록 이름",
    "Nome da lista",
    "清单名称"
  ],
  "addToList": [
    "Add to this list",
    "Ajouter à cette liste",
    "このリストに追加",
    "Añadir a esta lista",
    "Zu dieser Liste hinzufügen",
    "이 목록에 추가",
    "Adicionar a esta lista",
    "加入此清单"
  ],
  "detailsUnavailable": [
    "Additional details are unavailable at the moment.",
    "Les informations supplémentaires sont indisponibles pour le moment.",
    "現在、追加情報を取得できません。",
    "Los detalles adicionales no están disponibles por el momento.",
    "Weitere Details sind momentan nicht verfügbar.",
    "현재 추가 정보를 불러올 수 없습니다.",
    "Os detalhes adicionais estão indisponíveis de momento.",
    "暂时无法获取更多详情。"
  ],
  "seasonsEpisodes": [
    "Seasons and episodes",
    "Saisons et épisodes",
    "シーズンとエピソード",
    "Temporadas y episodios",
    "Staffeln und Folgen",
    "시즌 및 에피소드",
    "Temporadas e episódios",
    "季与集"
  ],
  "specialsLabel": [
    "Specials",
    "Épisodes spéciaux",
    "特別編",
    "Especiales",
    "Sonderfolgen",
    "스페셜",
    "Especiais",
    "特别篇"
  ],
  "seasonLabel": [
    "Season",
    "Saison",
    "シーズン",
    "Temporada",
    "Staffel",
    "시즌",
    "Temporada",
    "季"
  ],
  "seasonNumber": [
    "Season {n}",
    "Saison {n}",
    "シーズン {n}",
    "Temporada {n}",
    "Staffel {n}",
    "시즌 {n}",
    "Temporada {n}",
    "第 {n} 季"
  ],
  "episodesUnavailable": [
    "Episodes are unavailable at the moment.",
    "Les épisodes sont indisponibles pour le moment.",
    "現在、エピソードを取得できません。",
    "Los episodios no están disponibles por el momento.",
    "Folgen sind momentan nicht verfügbar.",
    "현재 에피소드를 불러올 수 없습니다.",
    "Os episódios estão indisponíveis de momento.",
    "暂时无法获取分集信息。"
  ],
  "retryLabel": [
    "Retry",
    "Réessayer",
    "再試行",
    "Reintentar",
    "Erneut versuchen",
    "다시 시도",
    "Tentar novamente",
    "重试"
  ],
  "loadingSeasons": [
    "Loading seasons…",
    "Chargement des saisons…",
    "シーズンを読み込み中…",
    "Cargando temporadas…",
    "Staffeln werden geladen…",
    "시즌 불러오는 중…",
    "A carregar temporadas…",
    "正在加载季信息…"
  ],
  "noSeasons": [
    "No seasons listed yet.",
    "Aucune saison renseignée pour le moment.",
    "シーズン情報はまだありません。",
    "Aún no hay temporadas registradas.",
    "Noch keine Staffeln eingetragen.",
    "등록된 시즌이 없습니다.",
    "Ainda não há temporadas registadas.",
    "暂无季信息。"
  ],
  "dataLabel": [
    "Data: ",
    "Données : ",
    "データ提供：",
    "Datos: ",
    "Daten: ",
    "데이터: ",
    "Dados: ",
    "数据来源："
  ],
  "loadingEpisodes": [
    "Loading episodes…",
    "Chargement des épisodes…",
    "エピソードを読み込み中…",
    "Cargando episodios…",
    "Folgen werden geladen…",
    "에피소드 불러오는 중…",
    "A carregar episódios…",
    "正在加载分集信息…"
  ],
  "episodesCount": [
    "{n} episodes listed",
    "{n} épisodes répertoriés",
    "登録済み {n} 話",
    "{n} episodios registrados",
    "{n} Folgen eingetragen",
    "등록된 에피소드 {n}개",
    "{n} episódios registados",
    "已收录 {n} 集"
  ],
  "episodesExpected": [
    "{n} expected",
    "{n} prévus",
    "予定 {n} 話",
    "{n} previstos",
    "{n} erwartet",
    "예정 {n}개",
    "{n} previstos",
    "预计 {n} 集"
  ],
  "specialLabel": [
    "Special",
    "Spécial",
    "特別編",
    "Especial",
    "Sonderfolge",
    "스페셜",
    "Especial",
    "特别篇"
  ],
  "episodeNumber": [
    "Ep. {n}",
    "Ép. {n}",
    "第 {n} 話",
    "Ep. {n}",
    "Folge {n}",
    "{n}화",
    "Ep. {n}",
    "第 {n} 集"
  ],
  "titleUnannounced": [
    "Title not announced",
    "Titre non communiqué",
    "タイトル未発表",
    "Título no anunciado",
    "Titel noch unbekannt",
    "제목 미공개",
    "Título não anunciado",
    "标题未公布"
  ],
  "noEpisodes": [
    "Episodes for this season have not been listed yet.",
    "Les épisodes de cette saison ne sont pas encore renseignés.",
    "このシーズンのエピソード情報はまだありません。",
    "Aún no hay episodios registrados para esta temporada.",
    "Für diese Staffel sind noch keine Folgen eingetragen.",
    "이 시즌의 에피소드가 아직 등록되지 않았습니다.",
    "Os episódios desta temporada ainda não estão registados.",
    "本季暂无分集信息。"
  ],
  "moreEpisodes": [
    "Show more episodes",
    "Afficher plus d’épisodes",
    "エピソードをもっと見る",
    "Mostrar más episodios",
    "Weitere Folgen anzeigen",
    "에피소드 더 보기",
    "Mostrar mais episódios",
    "显示更多集"
  ]
};
for(const [key,values] of Object.entries(DETAIL_LOCALES))["en","fr","ja","es","de","ko","pt","zh-CN"].forEach((code,index)=>LANGS[code][key]=values[index]);
const SEARCH_LOCALES={
  "mediaType": [
    "Media type",
    "Type d’œuvre",
    "作品の種類",
    "Tipo de obra",
    "Medientyp",
    "작품 유형",
    "Tipo de obra",
    "作品类型"
  ],
  "genreLabel": [
    "Genre",
    "Genre",
    "ジャンル",
    "Género",
    "Genre",
    "장르",
    "Género",
    "类型"
  ],
  "releaseYear": [
    "Release year",
    "Année de sortie",
    "公開年",
    "Año de lanzamiento",
    "Erscheinungsjahr",
    "출시 연도",
    "Ano de lançamento",
    "发行年份"
  ],
  "finishedFilter": [
    "Work / series finished",
    "Œuvre / série terminée",
    "作品・シリーズ完結",
    "Obra / serie finalizada",
    "Werk / Serie beendet",
    "작품 / 시리즈 완결",
    "Obra / série terminada",
    "作品 / 系列已完结"
  ],
  "endingFilter": [
    "Unspecified ending",
    "Fin non précisée",
    "終了範囲不明",
    "Final no especificado",
    "Ende nicht näher angegeben",
    "종료 범위 불명",
    "Fim não especificado",
    "结束范围未注明"
  ],
  "maxPrice": [
    "Maximum price (USD)",
    "Prix maximum (USD)",
    "上限価格（米ドル）",
    "Precio máximo (USD)",
    "Höchstpreis (USD)",
    "최대 가격 (USD)",
    "Preço máximo (USD)",
    "最高价格（美元）"
  ],
  "filtersHint": [
    "Filters apply to the returned results. Unknown dates and publication states remain unspecified.",
    "Filtres appliqués aux résultats reçus. Les dates et états inconnus restent non renseignés.",
    "フィルターは取得済みの結果に適用されます。不明な日付や公開状況は未指定のままです。",
    "Los filtros se aplican a los resultados recibidos. Las fechas y los estados desconocidos quedan sin especificar.",
    "Filter gelten für die erhaltenen Ergebnisse. Unbekannte Daten und Veröffentlichungsstatus bleiben unbestimmt.",
    "필터는 받은 결과에 적용됩니다. 알 수 없는 날짜와 공개 상태는 미상으로 유지됩니다.",
    "Os filtros aplicam-se aos resultados recebidos. Datas e estados desconhecidos permanecem não especificados.",
    "筛选仅应用于已返回的结果。未知日期和发布状态仍保留为未注明。"
  ],
  "clearFilters": [
    "Clear filters",
    "Effacer les filtres",
    "フィルターを解除",
    "Borrar filtros",
    "Filter zurücksetzen",
    "필터 초기화",
    "Limpar filtros",
    "清除筛选"
  ],
  "inLibrary": [
    "In library",
    "Dans la bibliothèque",
    "ライブラリに保存済み",
    "En la biblioteca",
    "In der Bibliothek",
    "라이브러리에 있음",
    "Na biblioteca",
    "已在资料库"
  ],
  "searchRetained": [
    "Received results are kept. Retry to continue.",
    "Les résultats reçus sont conservés. Réessaie pour poursuivre.",
    "取得済みの結果は保持されています。再試行して続けてください。",
    "Se conservan los resultados recibidos. Reintenta para continuar.",
    "Erhaltene Ergebnisse bleiben gespeichert. Erneut versuchen, um fortzufahren.",
    "받은 결과는 유지됩니다. 계속하려면 다시 시도하세요.",
    "Os resultados recebidos são mantidos. Tenta novamente para continuar.",
    "已保留获取的结果。请重试以继续。"
  ],
  "searchCatalogs": [
    "Searching catalogs…",
    "Recherche dans les catalogues…",
    "カタログを検索中…",
    "Buscando en los catálogos…",
    "Kataloge werden durchsucht…",
    "카탈로그 검색 중…",
    "A pesquisar nos catálogos…",
    "正在搜索目录…"
  ],
  "searchPartial": [
    "Some catalogs did not respond. Load more will retry those sources.",
    "Certains catalogues n’ont pas répondu. Charger plus réessaiera ces sources.",
    "一部のカタログから応答がありませんでした。「さらに読み込む」で再試行します。",
    "Algunos catálogos no respondieron. Cargar más volverá a consultar esas fuentes.",
    "Einige Kataloge haben nicht geantwortet. Weitere Ergebnisse laden versucht diese Quellen erneut.",
    "일부 카탈로그가 응답하지 않았습니다. 더 불러오면 해당 출처를 다시 시도합니다.",
    "Alguns catálogos não responderam. Carregar mais tentará essas fontes novamente.",
    "部分目录未响应。加载更多时将重试这些来源。"
  ],
  "searchLimit": [
    "Search limit reached. Refine your search terms to explore other results.",
    "Limite de cette recherche atteinte. Précise les mots recherchés pour explorer d’autres résultats.",
    "検索上限に達しました。検索語を絞り込んで他の結果を探してください。",
    "Se alcanzó el límite de búsqueda. Concreta los términos para explorar otros resultados.",
    "Suchlimit erreicht. Präzisiere die Suchbegriffe, um andere Ergebnisse zu finden.",
    "검색 한도에 도달했습니다. 검색어를 구체화하여 다른 결과를 찾아보세요.",
    "Limite de pesquisa atingido. Refina os termos para explorar outros resultados.",
    "已达到本次搜索上限。请细化关键词以查找其他结果。"
  ],
  "loadingLabel": [
    "Loading…",
    "Chargement…",
    "読み込み中…",
    "Cargando…",
    "Wird geladen…",
    "불러오는 중…",
    "A carregar…",
    "正在加载…"
  ],
  "moreResults": [
    "Load more results",
    "Charger plus de résultats",
    "結果をさらに読み込む",
    "Cargar más resultados",
    "Weitere Ergebnisse laden",
    "결과 더 불러오기",
    "Carregar mais resultados",
    "加载更多结果"
  ],
  "searchUnavailable": [
    "Search unavailable.",
    "Recherche indisponible.",
    "検索を利用できません。",
    "Búsqueda no disponible.",
    "Suche nicht verfügbar.",
    "검색을 사용할 수 없습니다.",
    "Pesquisa indisponível.",
    "搜索暂不可用。"
  ],
  "missingGame": [
    "Can’t find your game?",
    "Vous ne trouvez pas votre jeu ?",
    "ゲームが見つかりませんか？",
    "¿No encuentras tu juego?",
    "Du findest dein Spiel nicht?",
    "게임을 찾을 수 없나요?",
    "Não encontras o teu jogo?",
    "找不到你的游戏？"
  ],
  "manualDetails": [
    "Enter its details manually",
    "Ajouter les informations manuellement",
    "情報を手動で入力",
    "Introducir los detalles manualmente",
    "Details manuell eingeben",
    "정보 직접 입력",
    "Introduzir os detalhes manualmente",
    "手动输入详情"
  ],
  "mediaFilms": [
    "Films",
    "Films",
    "映画",
    "Películas",
    "Filme",
    "영화",
    "Filmes",
    "电影"
  ],
  "mediaUSSeries": [
    "US series",
    "Séries américaines",
    "アメリカのドラマ",
    "Series estadounidenses",
    "US-Serien",
    "미국 시리즈",
    "Séries americanas",
    "美剧"
  ],
  "mediaNovels": [
    "Novels",
    "Romans",
    "小説",
    "Novelas",
    "Romane",
    "소설",
    "Romances",
    "小说"
  ],
  "mediaBooks": [
    "Books",
    "Livres",
    "書籍",
    "Libros",
    "Bücher",
    "도서",
    "Livros",
    "书籍"
  ]
};
for(const [key,values] of Object.entries(SEARCH_LOCALES))["en","fr","ja","es","de","ko","pt","zh-CN"].forEach((code,index)=>LANGS[code][key]=values[index]);
for(const [code,label] of Object.entries({en:"Close",fr:"Fermer",ja:"閉じる",es:"Cerrar",de:"Schließen",ko:"닫기",pt:"Fechar","zh-CN":"关闭"}))LANGS[code].close=label;
const t = (k, p) => { let s = (LANGS[settings.lang] && LANGS[settings.lang][k]) || LANGS.en[k] || k; if (p) for (const key in p) s = s.replace(`{${key}}`, p[key]); return s; };
// Array-valued i18n (plan feature lists), falls back to English.
const tArr = (k) => (LANGS[settings.lang] && LANGS[settings.lang][k]) || LANGS.en[k] || [];
// Target languages for page translation (broad list, matches the popup).
const TR_LANGS = [["en","English"],["fr","Français"],["es","Español"],["de","Deutsch"],["it","Italiano"],["pt","Português"],["nl","Nederlands"],["ru","Русский"],["uk","Українська"],["pl","Polski"],["tr","Türkçe"],["ar","العربية"],["fa","فارسی"],["hi","हिन्दी"],["id","Indonesia"],["vi","Tiếng Việt"],["th","ไทย"],["ja","日本語"],["ko","한국어"],["zh-CN","中文 (简)"],["zh-TW","中文 (繁)"],["fil","Filipino"],["ms","Melayu"],["sv","Svenska"],["no","Norsk"],["da","Dansk"],["fi","Suomi"],["cs","Čeština"],["el","Ελληνικά"],["he","עברית"],["ro","Română"],["hu","Magyar"],["bg","Български"],["sr","Српски"],["hr","Hrvatski"]];

/* ---- SVG icons ---- */
const I = {
  search:'<svg class="ic" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
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
  grid:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  rows:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="4" rx="1.5"/><rect x="3" y="15" width="18" height="4" rx="1.5"/></svg>',
  sliders:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2" class="fill"/><circle cx="8" cy="12" r="2" class="fill"/><circle cx="14" cy="18" r="2" class="fill"/></svg>',
  user:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  gear:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  crown:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/></svg>',
  x:'<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M18.24 2H21.5l-7.5 8.57L22.5 22h-6.6l-5.17-6.76L4.8 22H1.54l8.02-9.17L1.5 2h6.77l4.67 6.18L18.24 2Zm-1.16 18h1.83L7.02 3.9H5.06L17.08 20Z"/></svg>',
  fb:'<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z"/></svg>',
  wa:'<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.97L2 22l5.16-1.35A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 0 1 5.73 13.83A8.1 8.1 0 0 1 7.5 18.8l-.36-.21-3.06.8.82-2.98-.24-.38A8.1 8.1 0 0 1 12.04 3.8Zm-2.9 4.02c-.15 0-.4.06-.6.29-.2.22-.78.76-.78 1.86s.8 2.16.91 2.31c.11.15 1.57 2.5 3.9 3.4 1.94.75 2.34.6 2.76.56.42-.04 1.36-.55 1.55-1.09.19-.53.19-.99.13-1.09-.06-.1-.2-.15-.42-.26-.22-.11-1.36-.67-1.57-.75-.21-.08-.36-.11-.51.11-.15.22-.58.75-.72.9-.13.15-.26.17-.48.06-.22-.11-.94-.35-1.79-1.11-.66-.59-1.11-1.32-1.24-1.54-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.5-1.26-.69-1.72-.18-.44-.36-.38-.5-.39l-.42-.01Z"/></svg>',
  rd:'<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M22 11.6a2.1 2.1 0 0 0-3.55-1.5 10.3 10.3 0 0 0-5.2-1.64l.88-4.15 2.9.62a1.5 1.5 0 1 0 .17-.98l-3.3-.7a.5.5 0 0 0-.59.38l-1 4.7a10.4 10.4 0 0 0-5.32 1.64 2.1 2.1 0 1 0-2.3 3.42 4.2 4.2 0 0 0-.04.66c0 3.3 3.85 5.98 8.6 5.98s8.6-2.68 8.6-5.98a4 4 0 0 0-.04-.65A2.1 2.1 0 0 0 22 11.6ZM7.6 13.1a1.4 1.4 0 1 1 2.8 0 1.4 1.4 0 0 1-2.8 0Zm7.86 3.68c-.98.98-3.9.98-4.9 0a.4.4 0 0 1 .56-.56c.65.64 3.02.65 3.77 0a.4.4 0 1 1 .57.56Zm-.06-2.28a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z"/></svg>',
  link:'<svg class="ic" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
  game:'<svg class="ic" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 12h3M8.5 10.5v3"/><circle cx="15.5" cy="11" r="1" class="fill"/><circle cx="17.5" cy="13" r="1" class="fill"/></svg>',
  book:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></svg>',
  compass:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z" class="fill"/></svg>',
  spark:'<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" class="fill"/><path d="M18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7z" class="fill"/></svg>',
  refresh:'<svg class="ic" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 4v5h-5"/></svg>',
};

const accentFor = (i) => (i.type === "watching" ? "#7E9BE6" : i.type === "game" ? "#E08A4F" : "#5FB79A");
// Human category for a work (Manga / Manhwa / Webtoon / Novel / Anime / Series /
// Film / Book / Game) from its stored format, with a sensible fallback.
function catLabel(i) {
  const f = String(i.format || "").toUpperCase();
  if (i.type === "game" || f === "GAME") return "Game";
  if (f === "WEBTOON") return "Webtoon";
  if (f === "MANHWA") return "Manhwa";
  if (f === "MANHUA") return "Manhua";
  if (f === "MANGA") return "Manga";
  if (f === "NOVEL" || f === "ONE_SHOT" || f === "LIGHT_NOVEL") return "Novel";
  if (f === "BOOK") return "Book";
  if (f === "MOVIE") return "Film";
  if (f === "KDRAMA") return "K-Drama";
  if (f === "CDRAMA") return "C-Drama";
  if (f === "JDRAMA") return "J-Drama";
  if (f === "SERIES") return "Series";
  if (f === "ANIME" || f === "TV" || f === "ONA" || f === "OVA" || f === "SPECIAL" || f === "TV_SHORT") return "Anime";
  return i.type === "reading" ? "Comic" : i.type === "watching" ? "Video" : "Game";
}
const safeColor=(value,fallback="#EDE6FF")=>typeof value==="string"&&/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)?value:fallback;
function safeBackground(value) {
  if(typeof value!=="string")return "background:#EDE6FF";
  const image=/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(value)?value:safeNavigationUrl(value);
  return image?"background-image:url('"+esc(image.replace(/['"\\()\s]/g,c=>"%"+c.charCodeAt(0).toString(16).padStart(2,"0")))+"')":"background:"+safeColor(value);
}
const coverUrl = (i) => i.coverOverride || i.cover || "";
// Current position and how many entries are released — the basis for "unseen".
const currentNum = (i) => (i.type === "watching" ? i.episode || 0 : i.chapter || 0);
const STATUSES = ["current", "planned", "completed", "on_hold", "dropped"];
const itemState = (i) => i.state || ((i.progress || 0) >= 100 ? "completed" : "current");
const unseen = (i) => (i.type === "game" ? 0 : Math.max(0, (i.type==="watching" && i.releaseSeason===(Number(i.season)||1) && Number.isFinite(i.releasedTotal) ? i.releasedTotal : i.total || 0) - currentNum(i)));
// A new release needs a confirmed past date and remaining progress.
function isNew(i,now=Date.now()) {
  if(i.type==="game"||itemState(i)==="dropped")return false;
  const season=Number(i.season)||1,episode=Number(i.episode)||0;
  const recent=Array.isArray(i.recentEpisodes)?i.recentEpisodes:[];
  if(i.type==="watching"&&recent.some(ep=>{
    const at=Number(ep?.at),s=Number(ep?.season),n=Number(ep?.episode);
    return Number.isFinite(at)&&at>0&&at<=now&&now-at<NEW_WINDOW&&Number.isInteger(s)&&s>0&&Number.isInteger(n)&&n>0&&(s>season||s===season&&n>episode);
  }))return true;
  const at=Number(i.lastReleaseAt);
  return unseen(i)>0&&Number.isFinite(at)&&at>0&&at<=now&&now-at<NEW_WINDOW;
}
function homeActivity(source,now=Date.now()) {
  const active=source.filter(i=>!i.homeHidden&&i.type!=="game"&&itemState(i)==="current");
  const catchUp=active.filter(i=>isNew(i,now)).sort((a,b)=>(Number(b.lastReleaseAt)||0)-(Number(a.lastReleaseAt)||0)||unseen(b)-unseen(a));
  const used=new Set(catchUp.map(i=>i.id));
  const resume=active.filter(i=>(currentNum(i)>0||i.type==="watching"&&Number(i.position)>0)&&(i.progress||0)<100)
    .sort((a,b)=>(b.activityAt||b.updatedAt||0)-(a.activityAt||a.updatedAt||0));
  return {resume,catchUp,continuing:resume.filter(i=>!used.has(i.id)).slice(0,12)};
}
const parseDate = (s) => { if (!s) return null; const d = Date.parse(s); return Number.isFinite(d) ? d : null; };
const isSoon = (i) => { const d = parseDate(i.releaseDate); return d && d > Date.now() && d - Date.now() < SOON_WINDOW; };
const isReleased = (i) => { const d = parseDate(i.releaseDate); return i.released || (d && d <= Date.now()); };
const isUpcoming = (i) => { const d = parseDate(i.releaseDate); return d && d > Date.now() && d - Date.now() >= SOON_WINDOW; };

function marker(i) {
  if (i.type === "game") return i.platform || (i.releaseDate ? i.releaseDate : "Game");
  if (i.type === "watching") {
    const watched = Number(i.episode) || 0, total = Number(i.total) || 0;
    const progress = total ? watched + "/" + total + " episodes" : watched ? "Episode " + watched : "";
    return [i.season && "Season " + i.season, progress].filter(Boolean).join(" — ") || i.domain || "";
  }
  const read = Number(i.chapter) || 0, total = Number(i.total) || 0;
  const progress = total ? read + "/" + total + " chapters" : read ? "Chapter " + read : "";
  return [i.volume && "Vol. " + i.volume, progress, i.page && "Page " + i.page].filter(Boolean).join(" — ") || i.domain || "";
}
function relative(ts) {
  if (!ts) return "";
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : `${d} days ago`;
}
function esc(s) { return String(s == null ? "" : s).replace(/\s*·\s*/g," / ").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function initials(s) { return (s || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"; }
// A cover image with a guaranteed graceful fallback. The placeholder letter is
// ALWAYS rendered underneath; the image overlays it and fades in when it loads.
// If it fails (dead host, hotlink block, offline) a global handler hides the
// image so the placeholder shows — never a broken-image icon. No inline
// handlers, so it works under the MV3 extension CSP (script-src 'self').
function covImg(url, fallback) { const alternatives=[...new Set((Array.isArray(fallback)?fallback:[fallback]).filter(value=>typeof value==="string"&&value&&value!==url))].slice(0,3);return url ? `<img class="cov" src="${esc(url)}"${alternatives.length ? ` data-fallback="${esc(alternatives[0])}"${alternatives.length>1?` data-fallbacks="${esc(JSON.stringify(alternatives.slice(1)))}"`:""}` : ""} referrerpolicy="no-referrer" loading="lazy" decoding="async" alt="">` : ""; }
// Inline on* handlers are blocked by the MV3 extension CSP (script-src 'self'),
// so we catch image failures with a single capture-phase listener instead: try a
// fallback source once (e.g. Steam header when the portrait capsule is missing),
// then hide the image so its placeholder shows — never a broken-image icon.
document.addEventListener("error", (e) => {
  const el = e.target;
  if (!el || el.tagName !== "IMG") return;
  // Cast/avatar thumbnails just hide (the initial shows behind them).
  if (!el.classList.contains("cov")) { if (el.closest(".cast-av")) el.classList.add("failed"); return; }
  const fb = el.dataset.fallback;
  if (fb && el.getAttribute("src") !== fb) {
    let remaining=[];try{remaining=JSON.parse(el.dataset.fallbacks||"[]");}catch{}
    el.removeAttribute("data-fallback");el.removeAttribute("data-fallbacks");
    if(Array.isArray(remaining)&&remaining.length){el.dataset.fallback=remaining[0];if(remaining.length>1)el.dataset.fallbacks=JSON.stringify(remaining.slice(1));}
    el.src=fb;return;
  }
  el.classList.add("failed");
}, true);
function coverInner(i, fs) {
  const u = coverUrl(i);
  const ph = `<span class="cover-ph"${fs ? ` style="font-size:${fs}px"` : ""}>${esc((i.title || "?")[0].toUpperCase())}</span>`;
  return ph + covImg(u, i.coverFallback);
}
// Badge label: "+3" when there are unseen released entries, else NEW / Soon.
function flagLabel(i) { const u = unseen(i); if (u > 0) return `+${u}`; if (isNew(i)) return "NEW"; if (isSoon(i)) return t("comingSoon"); return ""; }

let toastT;
function toast(m) { const el = document.getElementById("toast"); el.textContent = m; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1800); }

function saveProfilePatch(patch) {
  const profile={...(settings.profile||{}),...patch};
  return new Promise(resolve=>requestMetadata({type:"SET_SETTINGS",patch:{profile}},r=>{
    if(api.runtime.lastError || r?.ok===false || !r?.settings){toast(settings.lang==="fr"?"Profil non enregistré. Réessaie.":"Profile could not be saved. Try again.");resolve(false);return;}
    settings={...settings,profile:r.settings.profile||settings.profile};paintAvatar();renderProfileMenu();resolve(true);
  }));
}
function refreshOpenItem(id) {
  const drawer=document.getElementById("drawer");
  if(drawer.classList.contains("open") && drawer.dataset.itemId===id)openDrawer(id);
}
function update(id, patch, {retainDraft=false}={}) {
  return new Promise(resolve => requestMetadata({type:"UPDATE_ITEM",id,patch}, r => {
    if (api.runtime.lastError || r?.ok === false || !Array.isArray(r?.items)) {
      toast(settings.lang === "fr" ? "Enregistrement non confirmé. Vérifie la valeur avant de réessayer." : "Save not confirmed. Check the value before retrying.");
      if(!retainDraft)refreshOpenItem(id); resolve(false); return;
    }
    items = r.items; renderAll(); refreshOpenItem(id); resolve(true);
  }));
}

/* ================= HOME ================= */
function topGenres(source=items) {
  const count = {};
  for (const i of source) for (const g of i.tags || []) count[g] = (count[g] || 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
}
function posterHtml(i) {
  const lbl = flagLabel(i);
  const flag = lbl ? `<span class="flag ${isSoon(i) && unseen(i) === 0 ? "soon" : ""}">${esc(lbl)}</span>` : "";
  return `<div class="poster" data-open="${esc(i.id)}" role="button" tabindex="0" aria-label="${esc(t("details")+": "+i.title)}">
    <div class="art" style="background:${safeColor(i.accent,accentFor(i))}"><span class="cat-badge">${esc(catLabel(i))}</span>${coverInner(i, 30)}${flag}
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
/* ---- Discovery: fresh, personalized recommendations (not your library) ---- */
function normTitle(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^0-9a-z぀-ヿ一-鿿가-힯]+/gi, "");
}
function libTitleSet() { return new Set(items.map((i) => normTitle(i.title)).filter(Boolean)); }
// Weight each genre the user actually collects; recent/among-favorites count more.
function tasteTerms(text) {
  const stop=new Set("about after again also avec dans cette comme pour plus leur leurs mais tout une des les est sont elle elles avec his her the and that this from with into when where which their they them then than have been will were story series manga anime".split(" "));
  return [...new Set(String(text||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>3&&!stop.has(w)))].slice(0,100);
}
function tasteGenres(item) {
  return [...new Set([...(Array.isArray(item.genres)?item.genres:[]),...(Array.isArray(item.tags)?item.tags:[]),...(Array.isArray(item.catalogTags)?item.catalogTags:[])].filter(g=>typeof g==="string").map(g=>g.trim().toLowerCase()).filter(Boolean))].slice(0,80);
}
function tasteWeights() {
  const weights={};
  for(const item of items) {
    if(item.homeHidden||itemState(item)==="dropped"||(item.rating&&item.rating<=2))continue;
    if(!item.favorite&&!item.rating&&!currentNum(item))continue;
    const age=(Date.now()-(item.activityAt||item.updatedAt||0))/86400000;
    const strength=(item.favorite?3:1)+(Number(item.rating)||0)/2;
    const factor=strength/(1+Math.max(0,age)/90);
    for(const genre of tasteGenres(item)) {const key="genre:"+genre;weights[key]=(weights[key]||0)+factor*3;}
    for(const term of tasteTerms(item.synopsis))weights[term]=(weights[term]||0)+factor;
  }
  return weights;
}
function scoreTaste(m,weights) {
  let score=0;
  for(const genre of tasteGenres(m))score+=weights["genre:"+genre]||0;
  const terms=tasteTerms(m.synopsis);
  for(const term of terms)score+=(weights[term]||0)/Math.sqrt(Math.max(1,terms.length));
  return score;
}
let discoItems = []; // flat candidate list; cards reference indices into this
function discoBadges(m, opts) {
  const soon = opts.soon ? `<span class="badge-soon">${esc(m.releaseDate || t("comingSoon"))}</span>` : "";
  const price = m.price ? `<span class="badge-price">${esc(m.price)}</span>` : "";
  return { soon, price };
}
function steamArtworkSources(m){
  const supplied=[m.coverFallback,m.cover].filter(value=>typeof value==="string"&&value);
  const candidates=[];
  let app="";
  for(const value of supplied){
    try{
      const url=new URL(value);
      if(url.protocol!=="https:"||url.username||url.password||url.port||!/(^|\.)(steamstatic\.com|steamcdn-a\.akamaihd\.net)$/.test(url.hostname))continue;
      const id=url.pathname.match(/\/(?:steam|store_item_assets\/steam)\/apps\/([1-9]\d{0,14})\//)?.[1];
      if(!id||app&&id!==app)continue;
      app=id;
      if(/\/capsule_231x87\.jpg$/.test(url.pathname)){
        url.pathname=url.pathname.replace(/capsule_231x87\.jpg$/,"capsule_231x87_2x.jpg");
        candidates.push(url.href);
      }else if(/\/(?:header|capsule_616x353)(?:_2x)?\.jpg$/.test(url.pathname))candidates.push(url.href);
    }catch{}
  }
  if(app)candidates.push("https://cdn.cloudflare.steamstatic.com/steam/apps/"+app+"/header.jpg");
  return app?[...new Set([...candidates,...supplied])].slice(0,4):[...new Set([m.cover,m.coverFallback].filter(Boolean))];
}
function discoveryArtwork(m){
  if(m.type!=="game")return covImg(m.cover,m.coverFallback);
  const sources=steamArtworkSources(m);
  return sources.length?covImg(sources[0],sources.slice(1)):"";
}
function discoCard(m, idx, opts = {}) {
  const sub=(m.genres||[]).slice(0,2).join(" — ")||catLabel(m);
  return `<article class="disco ${m.type==="game"?"disco-game":""}"><button class="art" data-preview-disco="${idx}" aria-label="${esc(t("details")+": "+m.title)}"><span class="cover-ph">${esc((m.title||"?")[0])}</span>${discoveryArtwork(m)}</button><h4><button class="link-btn" data-preview-disco="${idx}">${esc(m.title)}</button></h4><small>${esc(sub)}</small>${opts.soon?`<small>${esc(m.releaseDate||t("comingSoon"))}</small>`:""}</article>`;
}
function rankCard(m, idx, rank, opts = {}) { return discoCard(m,idx,opts); }
function rankRow(titleText, list, opts = {}) {
  if (!list.length) return "";
  const base = discoItems.length;
  const top = list.slice(0, 10);
  discoItems.push(...top);
  const cards = top.map((m, i) => rankCard(m, base + i, i + 1, opts)).join("");
  const head = opts.noHead ? "" : `<div class="section-h"><h2>${I.spark} ${esc(titleText)}</h2>${opts.sub ? `<span>${esc(opts.sub)}</span>` : ""}</div>`;
  return `${head}<div class="scroll-x rank-row">${cards}</div>`;
}
// A premium auto-scrolling carousel. Content is duplicated so the marquee loops
// seamlessly; hovering pauses it (and lets you click Add / open).
function discoRow(titleText, list, opts = {}) {
  if (!list.length) return "";
  const base = discoItems.length;
  discoItems.push(...list);
  const cards = list.map((m, i) => discoCard(m, base + i, opts)).join("");
  const dur = Math.max(28, Math.min(90, list.length * 6));
  const head = `<div class="section-h"><h2>${esc(titleText)}${opts.forYou ? ` <span class="reco-tag">${I.spark}</span>` : ""}</h2>${opts.sub ? `<span>${esc(opts.sub)}</span>` : ""}</div>`;
  return `${head}<div class="disco-wrap"><div class="disco-track${opts.rev ? " rev" : ""}" style="--dur:${dur}s">${cards}</div></div>`;
}
// Build the ordered list of discovery categories that actually have content.
// Order matches the user's ask: manga/manhwa/manhua, anime, then dramas &
// series, and games LAST — no duplicated rows on the same subject.
function discoverySavedMatcher(saved) {
  const ids=item=>({...item.externalIds,...(item.anilistId?{anilist:String(item.anilistId)}:{})});
  const titles=item=>[...new Set([item.title,...(Array.isArray(item.alternativeTitles)?item.alternativeTitles:[])].map(normTitle).filter(Boolean))].slice(0,40);
  const index=new Map();
  const keys=item=>[...Object.entries(ids(item)).filter(([,id])=>id).map(([provider,id])=>item.type+":id:"+provider+":"+id),...titles(item).map(t=>item.type+":title:"+t)];
  for(const item of saved)for(const key of keys(item)){if(!index.has(key))index.set(key,[]);index.get(key).push(item);}
  return candidate=>{
    const matches=new Set(keys(candidate).flatMap(key=>index.get(key)||[])),candidateIds=ids(candidate);
    for(const saved of matches){
      const savedIds=ids(saved),shared=Object.keys(candidateIds).filter(key=>savedIds[key]);
      if(shared.some(key=>String(candidateIds[key])!==String(savedIds[key])))continue;
      if(shared.length)return true;
      const a=String(candidate.format||"").toUpperCase(),b=String(saved.format||"").toUpperCase();
      const family=f=>/NOVEL|BOOK/.test(f)?"book":/MANGA|MANHWA|MANHUA|COMIC|WEBTOON/.test(f)?"comic":/MOVIE|FILM/.test(f)?"film":/ANIME|OVA|ONA|TV_SHORT/.test(f)?"anime":/DRAMA|SERIES/.test(f)?"series":"";
      if(family(a)&&family(b)&&family(a)!==family(b))continue;
      if(candidate.year&&saved.year&&Number(candidate.year)!==Number(saved.year))continue;
      return true;
    }
    return false;
  };
}
function homeRecommendations(pools,weights) {
  const groups=new Map(),seen=new Set();
  for(const pool of pools)for(const item of pool.list){
    const key=item.type+":"+normTitle(item.title),score=scoreTaste(item,weights);
    if(score<=0||seen.has(key))continue;
    seen.add(key);
    if(!groups.has(item.type))groups.set(item.type,[]);
    groups.get(item.type).push({item,score});
  }
  const ranked=[...groups.entries()].map(([type,entries])=>({type,entries:entries.sort((a,b)=>b.score-a.score)}))
    .sort((a,b)=>b.entries[0].score-a.entries[0].score);
  const best=ranked[0];
  return best?{type:best.type,items:best.entries.slice(0,12).map(e=>e.item)}:{type:"",items:[]};
}
function discoPools() {
  const saved = discoverySavedMatcher(items);
  const fresh = (arr) => (arr || []).filter((m) => m && m.title && m.cover && !saved(m));
  const pools = [];
  const add = (key, list) => { const l = fresh(list); if (l.length > 0) pools.push({ key, label: t("cat" + key[0].toUpperCase() + key.slice(1)), list: l, game: key === "games" }); };
  add("manhwa", discover.manhwa);
  add("manga", discover.manga);
  add("manhua", discover.manhua);
  add("anime", discover.anime);
  add("kdrama", discover.kdrama);
  add("cdrama", discover.cdrama);
  add("jdrama", discover.jdrama);
  add("series", discover.series);
  add("games", discover.gamesHot && discover.gamesHot.length ? discover.gamesHot : discover.gamesNew);
  // User can hide categories from Home (settings.homeCats = allowed keys). An
  // empty/absent list means "show everything". Never hide all — if the filter
  // would empty Home, fall back to the full set.
  const allow = Array.isArray(settings.homeCats) ? settings.homeCats : null;
  if (allow) return pools.filter(p=>allow.includes(p.key));
  return pools;
}
// The full ordered catalogue of Home categories (for the picker), regardless of
// what currently has content.
const HOME_CAT_KEYS = ["manhwa", "manga", "manhua", "anime", "kdrama", "cdrama", "jdrama", "series", "games"];
function homeCatAllowed(key) { const a = settings.homeCats; return !Array.isArray(a) || a.includes(key); }
function homeFeaturedPools(pools) {
  const chosen=[];
  for(const group of [["manhwa","manga","manhua"],["anime","kdrama","cdrama","jdrama","series"],["games"]]){
    const pool=pools.find(p=>group.includes(p.key));
    if(pool)chosen.push(pool);
  }
  for(const pool of pools)if(chosen.length<3&&!chosen.includes(pool))chosen.push(pool);
  return chosen;
}
let homeCategorySaving=false;
function homeCategoryControls(){
  return '<div class="home-category-chips" role="group" aria-label="'+(settings.lang==="fr"?"Catégories de l’accueil":"Home categories")+'" aria-busy="'+homeCategorySaving+'">'+HOME_CAT_KEYS.map(key=>'<button class="chip-toggle '+(homeCatAllowed(key)?'on':'')+'" data-home-category="'+key+'" aria-pressed="'+homeCatAllowed(key)+'"'+(homeCategorySaving?' disabled':'')+'>'+esc(t("cat"+key[0].toUpperCase()+key.slice(1)))+'</button>').join("")+'</div>';
}
function renderDiscover() {
  if(!discover)return `<div class="section-h"><h2>${settings.lang==="fr"?"Découvrir":"Discover"}</h2>${discoverRefreshButton()}</div>${homeCategoryControls()}<p class="sub" role="status">${discoverTried&&!discoverLoading?(settings.lang==="fr"?"Les tendances sont momentanément indisponibles. Réessaie ou utilise la recherche.":"Trends are temporarily unavailable. Retry or use search."):t("loadingReco")}</p>`;
  discoItems=[];
  const pools=discoPools();
  let out=`<div class="section-h discover-h"><h2>${t("discoverNow")}</h2><div class="disco-h-actions">${discoverRefreshButton()}</div></div>`;
  if(discover.stale)out+='<p class="sub" role="status">'+(settings.lang==="fr"?"Certains catalogues sont indisponibles. Les derniers résultats disponibles sont conservés temporairement.":"Some catalogs are unavailable. Recent cached results are temporarily retained.")+'</p>';
  out+=homeCategoryControls();
  if(!HOME_CAT_KEYS.some(homeCatAllowed))return out+'<p class="sub" role="status">'+(settings.lang==="fr"?"Choisissez au moins une catégorie ci-dessus pour afficher vos découvertes. Votre suivi reste accessible.":"Choose at least one category above to see discoveries. Your activity remains available.")+'</p>';
  if(!pools.length)out+='<p class="sub" role="status">'+(settings.lang==="fr"?"Aucune tendance disponible pour cette sélection.":"No trends available for this selection.")+'</p>';
  const weights=tasteWeights(),recommended=new Set();
  if(Object.keys(weights).length) {
    const selection=homeRecommendations(pools,weights),picks=selection.items;
    for(const pick of picks)recommended.add(pick.type+":"+normTitle(pick.title));
    const labels=settings.lang==="fr"?{reading:"Lectures pour vous",watching:"À regarder pour vous",game:"Jeux pour vous"}:{reading:"Reading for you",watching:"Shows for you",game:"Games for you"};
    if(picks.length)out+=discoRow(labels[selection.type]||t("forYou"),picks,{forYou:true,sub:settings.lang==="fr"?"D’après vos goûts":"Based on your interests"});
  }
  for(const pool of (homeShowAll?pools:homeFeaturedPools(pools)))out+=discoRow(pool.label,pool.list.filter(m=>!recommended.has(m.type+":"+normTitle(m.title))).slice(0,12),{sub:pool.game?"Steam":pool.key==="series"||pool.key.endsWith("drama")?(settings.lang==="fr"?"Diffusions récentes":"Recently airing"):(settings.lang==="fr"?"Tendances du moment":"Trending now")});
  if(pools.length>3)out+='<button class="btn" id="home-more">'+(settings.lang==="fr"?(homeShowAll?"Réduire les catégories":"Voir les autres catégories"):(homeShowAll?"Show fewer categories":"Show more categories"))+'</button>';
  return out;
}
let homeShowAll=false;
function discoverRefreshButton() {
  return `<button class="refresh-btn" data-discover-refresh aria-busy="${discoverLoading}" ${discoverLoading?"disabled":""}>${I.refresh}${discoverLoading?(settings.lang==="fr"?"Actualisation…":"Refreshing…"):t("refresh")}</button>`;
}
function loadDiscover(force) {
  if(discoverLoading)return;
  discoverLoading=true;
  document.querySelectorAll("[data-discover-refresh]").forEach(button=>{
    button.disabled=true;
    button.setAttribute("aria-busy","true");
    button.innerHTML=I.refresh+(settings.lang==="fr"?"Actualisation…":"Refreshing…");
  });
  requestMetadata({ type: "DISCOVER", force: !!force }, (r) => {
    void api.runtime.lastError;
    discoverLoading = false;
    document.querySelectorAll("[data-discover-refresh]").forEach(button=>{
      button.disabled=false;button.setAttribute("aria-busy","false");button.innerHTML=I.refresh+t("refresh");
    });
    discoverTried = true;
    if (r && r.ok && r.data) {
      discover = r.data;
    } else if(discover) {
      const now=Date.now(),retained={...discover,stale:true};
      let usable=false;
      for(const key of ["manga","manhwa","manhua","anime","kdrama","cdrama","jdrama","series","gamesSoon","gamesHot","gamesNew"]){
        const at=Number(discover.categoryUpdatedAt?.[key]??discover.ts);
        if(!Number.isFinite(at)||at>now||now-at>=3*86400000)retained[key]=[];
        if(retained[key]?.length)usable=true;
      }
      discover=usable?retained:null;
    }
    if (view === "home") renderHome();
    else if (view === "games") renderGames();
  });
}
// Fresh game recommendations for the Games tab (upcoming + new on Steam),
// excluding games already tracked.
function renderGamesDiscover() {
  const fr=settings.lang==="fr";
  let out=`<div class="section-h discover-h"><h2>${I.compass} ${t("discoverGames")}</h2>${discoverRefreshButton()}</div>`;
  discoItems = [];
  if(!discover)return out+'<p class="sub" role="status">'+(discoverLoading||!discoverTried?t("loadingReco"):(fr?"Les tendances sont momentanément indisponibles. Réessaie ou recherche un jeu.":"Trends are temporarily unavailable. Retry or search for a game."))+'</p>';
  const saved=discoverySavedMatcher(items);
  const fresh=arr=>(arr||[]).filter(m=>m&&m.title&&!saved(m));
  const soon=fresh(discover.gamesSoon), hot=fresh(discover.gamesHot?.length?discover.gamesHot:discover.gamesNew);
  if(discover.stale)out+='<p class="sub" role="status">'+(fr?"Certains catalogues sont indisponibles. Les derniers résultats disponibles sont conservés temporairement.":"Some catalogs are unavailable. Recent cached results are temporarily retained.")+'</p>';
  if(!soon.length&&!hot.length)return out+'<p class="sub" role="status">'+(fr?"Aucune nouvelle suggestion pour le moment. Tes jeux restent accessibles ci-dessus et la recherche est disponible.":"No new suggestions right now. Your saved games remain available above, and you can still search.")+'</p>';
  out += rankRow(t("mostAnticipated"), soon, { soon: true, sub: "Steam" });
  out += discoRow(t("hotGames"), hot, { rev: true, sub: "Steam" });
  return out;
}
function fitDiscoveryArtwork(image){
  const card=image.closest(".disco-game");
  if(!card||!image.naturalWidth||!image.naturalHeight)return;
  // The row owns a uniform aspect ratio; source dimensions must not resize cards.
  card.closest(".carousel-shell")?.refreshCarousel?.();
}
function enhanceCarousels(root) {
  document.querySelectorAll(root+" .scroll-x,"+root+" .disco-wrap").forEach(track=>{
    if(track.parentElement.classList.contains("carousel-shell"))return;
    const shell=document.createElement("div");shell.className="carousel-shell";
    track.before(shell);shell.append(track);
    const buttons=[];
    for(const direction of [-1,1]) {
      const button=document.createElement("button");button.className="carousel-arrow "+(direction<0?"prev":"next");
      button.type="button";button.hidden=true;
      button.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(direction<0?'M15 5l-7 7 7 7':'M9 5l7 7-7 7')+'"/></svg>';
      button.setAttribute("aria-label",settings.lang==="fr"?(direction<0?"Précédent":"Suivant"):(direction<0?"Previous":"Next"));
      button.onclick=()=>track.scrollBy({left:direction*Math.max(160,track.clientWidth*.85),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
      shell.append(button);buttons.push(button);
    }
    const refresh=()=>{const max=track.scrollWidth-track.clientWidth;buttons[0].hidden=max<=2||track.scrollLeft<=2;buttons[1].hidden=max<=2||track.scrollLeft>=max-2;};
    shell.refreshCarousel=refresh;
    track.addEventListener("scroll",refresh,{passive:true});
    track.addEventListener("load",refresh,true);
    requestAnimationFrame(refresh);
  });
}
window.addEventListener("resize",()=>document.querySelectorAll(".carousel-shell").forEach(shell=>shell.refreshCarousel?.()),{passive:true});
function bindDisco(root = "#view-home") {
  enhanceCarousels(root);
  document.querySelectorAll(root+" .disco-game img.cov").forEach(image=>{if(image.complete)fitDiscoveryArtwork(image);});
  const more=document.querySelector(root+" #home-more");
  if(more)more.onclick=()=>{homeShowAll=!homeShowAll;renderHome();document.querySelector(root+" #home-more")?.focus();};
  document.querySelectorAll(root+" [data-home-category]").forEach(button=>button.onclick=async()=>{
    const key=button.dataset.homeCategory,current=HOME_CAT_KEYS.filter(homeCatAllowed);
    await saveHomeCategories(current.includes(key)?current.filter(x=>x!==key):[...current,key]);
    if(view==="home")document.querySelector(root+' [data-home-category="'+key+'"]')?.focus();
  });
  const rf = document.querySelector(`${root} [data-discover-refresh]`);
  if (rf) rf.onclick = () => loadDiscover(true);
  const cb = document.querySelector(`${root} #disco-cats`);
  if (cb) cb.onclick = (e) => { e.stopPropagation(); openHomeCats(cb); };
  // Category tabs (webtoon-style): clicking filters the ranking in place.
  document.querySelectorAll(`${root} [data-cat]`).forEach((b) => (b.onclick = () => {
    discoCat = b.dataset.cat;
    if (view === "home") renderHome(); else if (view === "games") renderGames();
  }));
  document.querySelectorAll(`${root} [data-preview-disco]`).forEach(el=>{const item=discoItems[Number(el.dataset.previewDisco)];el.onclick=()=>openCatalogPreview(item);});

}
// Home categories use the same explicit set in both controls; [] means none.
let homeCatsMenuEl = null;
function paintHomeCategorySaving() {
  document.querySelectorAll(".home-category-chips,.cats-menu").forEach(group=>{
    group.setAttribute("aria-busy",String(homeCategorySaving));
    group.querySelectorAll("button").forEach(button=>{button.disabled=homeCategorySaving;});
  });
}
async function saveHomeCategories(homeCats) {
  if(homeCategorySaving)return false;
  const wanted=HOME_CAT_KEYS.filter(key=>homeCats.includes(key));
  homeCategorySaving=true;paintHomeCategorySaving();
  try{
    const response=await new Promise(resolve=>requestMetadata({type:"SET_SETTINGS",patch:{homeCats:wanted}},resolve));
    const actual=response?.settings?.homeCats;
    const saved=response?.ok!==false&&Array.isArray(actual)&&actual.length===wanted.length&&wanted.every(key=>actual.includes(key));
    if(saved)settings={...settings,homeCats:[...wanted]};
    else toast(settings.lang==="fr"?"Filtre non enregistré. Réessaie.":"Filter could not be saved. Try again.");
    return saved;
  }finally{
    homeCategorySaving=false;
    if(view==="home")renderHome();
    if(homeCatsMenuEl)paintHomeCatsMenu();
    paintHomeCategorySaving();
  }
}
function closeHomeCats() { if (homeCatsMenuEl) { homeCatsMenuEl.remove(); homeCatsMenuEl = null; document.removeEventListener("click", closeHomeCats); } }
function paintHomeCatsMenu() {
  if(!homeCatsMenuEl)return;
  homeCatsMenuEl.querySelectorAll("[data-cat-toggle]").forEach(button=>{
    const key=button.dataset.catToggle,on=homeCatAllowed(key);
    button.classList.toggle("qa-on",on);button.setAttribute("aria-pressed",String(on));
    button.innerHTML=(on?I.check:I.plus)+" "+esc(t("cat"+key[0].toUpperCase()+key.slice(1)));
  });
  paintHomeCategorySaving();
}
function openHomeCats(anchor) {
  if (homeCatsMenuEl) { closeHomeCats(); return; }
  const m = document.createElement("div");
  m.className = "qa-menu cats-menu";
  m.innerHTML = `<div class="cats-menu-h">${esc(t("chooseCats"))}</div>${HOME_CAT_KEYS.map(key=>'<button type="button" data-cat-toggle="'+key+'"></button>').join("")}<button type="button" data-cat-all>${I.check} ${esc(t("catAll"))}</button>`;
  document.body.appendChild(m);homeCatsMenuEl=m;paintHomeCatsMenu();
  const r=anchor.getBoundingClientRect();
  m.style.top = `${Math.max(8,Math.min(window.innerHeight-m.offsetHeight-8,r.bottom+6))}px`;
  m.style.left = `${Math.max(8,Math.min(window.innerWidth-m.offsetWidth-8,r.right-m.offsetWidth))}px`;
  m.addEventListener("click",e=>e.stopPropagation());
  m.querySelectorAll("[data-cat-toggle]").forEach(button=>button.onclick=async()=>{
    const key=button.dataset.catToggle,current=HOME_CAT_KEYS.filter(homeCatAllowed);
    await saveHomeCategories(current.includes(key)?current.filter(x=>x!==key):[...current,key]);
    if(button.isConnected)button.focus();
  });
  m.querySelector("[data-cat-all]").onclick=async()=>{
    if(await saveHomeCategories(HOME_CAT_KEYS)){if(homeCatsMenuEl===m)closeHomeCats();}
  };
  setTimeout(()=>{if(homeCatsMenuEl===m)document.addEventListener("click",closeHomeCats);},0);
}
function valueStrip() {
  const cards = [
    [I.book, t("valSaveT"), t("valSaveB")],
    [I.game, t("valAllT"), t("valAllB")],
    [I.crown, t("valResumeT"), t("valResumeB")],
  ];
  return `<div class="value-strip">${cards.map(([ic, a, b]) => `<div class="value-card"><span class="vc-ic">${ic}</span><div><b>${esc(a)}</b><small>${esc(b)}</small></div></div>`).join("")}</div>`;
}
function renderHome() {
  clearInterval(spotTimer);
  const fr=settings.lang==="fr",homeItems=items.filter(i=>!i.homeHidden),el=document.getElementById("view-home");
  const {resume,catchUp,continuing}=homeActivity(homeItems);
  const pools=discover?discoPools():[];
  const first=resume[0]||catchUp[0];
  spotItems=first?[{item:first,catalog:false,label:fr?"Reprendre là où vous en étiez":"Pick up where you left off"}]:[];
  const seen=new Set(first?[first.type+":"+normTitle(first.title)]:[]);
  for(const pool of homeFeaturedPools(pools)){
    const candidate=pool.list.find(m=>!seen.has(m.type+":"+normTitle(m.title)));
    if(!candidate)continue;
    seen.add(candidate.type+":"+normTitle(candidate.title));
    spotItems.push({item:candidate,catalog:true,label:(fr?"À découvrir — ":"Discover — ")+pool.label});
    if(spotItems.length>=5)break;
  }
  spotIdx=spotIdx%Math.max(1,spotItems.length);
  const personal=continuing.length||catchUp.length;
  el.innerHTML='<div class="home-heading"><div><h1>'+t("homeToday")+'</h1><p class="sub">'+t("homeIntro")+'</p></div><button class="btn" id="home-library">'+t("myLibrary")+'</button></div>'+
    (spotItems.length?'<section id="spot-wrap" class="home-feature-wrap" aria-label="'+t("featured")+'">'+spotHtml(spotItems[spotIdx])+spotControls()+'</section>':(!items.length?'<div class="home-welcome"><h2>'+t("welcomeTitle")+'</h2><p class="sub">'+(fr?"Explorez les tendances ci-dessous ou recherchez une œuvre avec la barre en haut.":"Explore the trends below or search for a title using the bar above.")+'</p></div>':""))+
    (personal?'<section class="home-personal" aria-label="'+(fr?"Votre suivi":"Your activity")+'">'+row(fr?"À rattraper":"Catch up",catchUp.slice(0,12),fr?"Sorties récentes que vous n’avez pas encore vues ou lues":"Recent releases you have not watched or read yet")+row(t("continue"),continuing)+'</section>':"")+renderDiscover();
  bindHome();bindDisco();startSpot();
}
function spotHtml(entry) {
  if(!entry)return "";
  const i=entry.item,fr=settings.lang==="fr",u=coverUrl(i),catalog=entry.catalog;
  const synopsis=i.synopsis?i.synopsis:catalog?(fr?"Ouvrez la fiche pour en savoir plus et choisir où garder cette découverte.":"Open the details to explore this title and choose where to save it."):marker(i);
  const destination=!catalog&&safeNavigationUrl(i.url);
  return '<article class="home-feature">'+(u?'<div class="home-feature-backdrop" aria-hidden="true">'+covImg(u,i.coverFallback)+'</div>':"")+
    '<div class="home-feature-copy"><span class="home-eyebrow">'+esc(entry.label)+'</span><h2>'+esc(i.title||"Untitled")+'</h2><p class="home-feature-meta">'+esc([catLabel(i),i.year||i.seasonYear,...(i.genres||i.tags||[]).slice(0,2)].filter(Boolean).join(" — "))+'</p><p class="home-feature-synopsis" tabindex="0">'+esc(synopsis)+'</p><div class="spot-cta">'+
    (destination?'<a class="btn-glass" href="'+esc(destination)+'" target="_blank" rel="noopener noreferrer">'+I.play+' '+t("resume")+'</a>':"")+
    '<button class="btn-glass '+(destination?'ghost':'')+'" data-feature-details>'+t("exploreTitle")+'</button></div></div>'+
    (u?'<button class="home-feature-art" data-feature-details aria-label="'+esc(t("details")+": "+i.title)+'">'+covImg(u,i.coverFallback)+'</button>':"")+'</article>';
}

let spotPaused=false;
function spotControls(){
  if(spotItems.length<2)return "";
  const fr=settings.lang==="fr";
  return '<div class="home-feature-controls"><button class="feature-arrow" data-feature-step="-1" aria-label="'+(fr?"Précédent":"Previous")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><div class="feature-dots">'+spotItems.map((entry,index)=>'<button data-dot="'+index+'" aria-label="'+esc(entry.item.title)+'" aria-pressed="'+(index===spotIdx)+'" class="'+(index===spotIdx?'on':'')+'"></button>').join("")+'</div><button class="feature-arrow" data-feature-step="1" aria-label="'+(fr?"Suivant":"Next")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div>';
}
function advanceSpot() {
  const wrap=document.getElementById("spot-wrap");
  if(view!=="home"||document.hidden||spotItems.length<2||!wrap||wrap.matches(":hover")||wrap.contains(document.activeElement)||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  spotIdx=(spotIdx+1)%spotItems.length;refreshSpot();
}
function startSpot(){clearInterval(spotTimer);if(spotItems.length>1)spotTimer=setInterval(advanceSpot,9000);}
function refreshSpot(){
  const wrap=document.getElementById("spot-wrap");if(!wrap||!spotItems.length)return;
  wrap.innerHTML=spotHtml(spotItems[spotIdx])+spotControls();bindHome();
}
function bindHome(){
  enhanceCarousels("#view-home");
  const library=document.getElementById("home-library");if(library)library.onclick=()=>switchView("library");
  document.querySelectorAll("#view-home [data-open]").forEach(n=>n.onclick=()=>openDrawer(n.dataset.open));
  document.querySelectorAll("#view-home [data-feature-details]").forEach(button=>{const entry=spotItems[spotIdx];button.onclick=()=>entry.catalog?openCatalogPreview(entry.item):openDrawer(entry.item.id);});
  document.querySelectorAll("#view-home [data-dot]").forEach(button=>button.onclick=()=>{spotIdx=Number(button.dataset.dot);refreshSpot();document.querySelector('#view-home [data-dot="'+spotIdx+'"]').focus();});
  document.querySelectorAll("#view-home [data-feature-step]").forEach(button=>button.onclick=()=>{const step=Number(button.dataset.featureStep);spotIdx=(spotIdx+step+spotItems.length)%spotItems.length;refreshSpot();document.querySelector('#view-home [data-feature-step="'+step+'"]').focus();});
  const pause=document.getElementById("feature-pause");if(pause)pause.onclick=()=>{spotPaused=!spotPaused;refreshSpot();document.getElementById("feature-pause").focus();};
}

/* ================= LIBRARY ================= */
// Discord-style dashboard header: banner + avatar + editable name & bio.
function renderLibHeader() {
  const el = document.getElementById("lib-header");
  if (!el) return;
  const p = settings.profile || {};
  const name = p.name || "Yomu";
  const banner = p.banner ? safeBackground(p.banner) : "";
  el.innerHTML = `<div class="dash">
    <div class="dash-banner" style="${banner}"><button class="edit-banner" id="dash-edit-banner">${I.image} ${t("changeBanner")}</button></div>
    <div class="dash-body">
      <div class="dash-av" id="dash-av">${p.avatar ? `<img src="${esc(p.avatar)}">` : esc(initials(name))}<span class="cam">${I.image}</span></div>
      <div class="dash-id">
        <h1 id="dash-name" title="${t("rename")}">${esc(name)} <span class="pen">${I.gear}</span></h1>
        <div class="bio ${p.bio ? "" : "empty"}" id="dash-bio" data-ph="${t("bioPh")}">${esc(p.bio || "")}</div>
      </div>
    </div>
  </div>`;
  const saveP = patch => saveProfilePatch(patch).then(saved=>{if(saved)renderLibHeader();return saved;});
  const av = document.getElementById("dash-av");
  if (av) av.onclick = () => openCropper({ shape: "circle", title: t("changePhoto"), initial:p.avatar, onSave: data => saveP({avatar:data}) });
  const eb = document.getElementById("dash-edit-banner");
  if (eb) eb.onclick = () => openCropper({ shape: "banner", title: t("changeBanner"), initial:p.banner, onSave: data => saveP({banner:data}) });
  // Click the name itself to rename it inline (Enter or click-away saves).
  const nameEl = document.getElementById("dash-name");
  if (nameEl) nameEl.onclick = () => {
    if (nameEl.querySelector("input")) return;
    const inp = document.createElement("input"); inp.className = "dash-name-input"; inp.value = name; inp.maxLength = 40;
    nameEl.replaceWith(inp); inp.focus(); inp.select();
    bindInlineProfileEditor(inp,"name",value=>value.trim()||"Yomu");

  };
  const bio = document.getElementById("dash-bio");
  if (bio) bio.onclick = () => {
    if (document.getElementById("dash-bio-ta")) return;
    const ta = document.createElement("textarea"); ta.id = "dash-bio-ta"; ta.className = "dash-bio-input"; ta.value = p.bio || ""; ta.maxLength = 240; ta.placeholder = t("bioPh");
    bio.replaceWith(ta); ta.focus();
    bindInlineProfileEditor(ta,"bio",value=>value.trim());

  };
}
function bindInlineProfileEditor(input,key,normalize) {
  let busy=false,closed=false;
  input.setAttribute("aria-label",key==="name"?t("displayName"):t("bioPh"));
  const status=document.createElement("small");status.setAttribute("role","status");
  const retry=document.createElement("button");retry.type="button";retry.className="link-btn";retry.textContent=t("retryLabel");retry.hidden=true;
  input.after(status,retry);
  const commit=async()=>{
    if(busy||closed||!input.isConnected)return;
    busy=true;input.disabled=true;retry.hidden=true;status.textContent="";
    const saved=await saveProfilePatch({[key]:normalize(input.value)});
    busy=false;
    if(!input.isConnected)return;
    input.disabled=false;
    if(saved){closed=true;renderLibHeader();return;}
    input.setAttribute("aria-invalid","true");retry.hidden=false;
    status.textContent=settings.lang==="fr"?"Enregistrement non confirmé. Texte conservé.":"Save not confirmed. Text retained.";
  };
  retry.onclick=commit;
  input.addEventListener("blur",commit);
  input.addEventListener("keydown",event=>{
    if(event.key==="Enter"&&!(input.tagName==="TEXTAREA"&&event.shiftKey)){event.preventDefault();commit();}
    if(event.key==="Escape"&&!busy){closed=true;renderLibHeader();}
  });
}
function renderStats() {
  const libraryItems = items.filter(i => i.type !== "game");
  const s = [
    [libraryItems.length, t("tracked")],
    [libraryItems.filter((i) => i.type === "reading").length, t("reading")],
    [libraryItems.filter((i) => i.type === "watching").length, t("watching")],
    [libraryItems.filter((i) => i.favorite).length, t("favorites")],
    [libraryItems.filter((i) => itemState(i) === "completed").length, t("finished")],
  ];
  document.getElementById("stats").innerHTML = s.map(([n, l]) => `<div class="chip"><b>${n}</b><span>${l}</span></div>`).join("");
  renderLibraryShortcuts();
}
function renderLibraryShortcuts() {
  const libraryItems=items.filter(i=>i.type!=="game");
  const shortcuts=document.getElementById("library-shortcuts");
  if(shortcuts){
    shortcuts.setAttribute("aria-label",settings.lang==="fr"?"Sections de ma bibliothèque":"Library sections");
    shortcuts.innerHTML=[
      ["collection-title",t("collectionTitle"),libraryItems.length],
      ["library-lists-title",t("lists"),lists.filter(l=>!l.archived).length],
      ["sites-h",t("sitesTitle"),sites.length],
    ].map(([id,label,count])=>'<button type="button" data-library-section="'+id+'"><span>'+esc(label)+'</span><strong>'+count+'</strong></button>').join("");
    shortcuts.querySelectorAll("[data-library-section]").forEach(button=>button.onclick=()=>{
      if(button.dataset.librarySection==="library-lists-title"&&showArchivedLists){showArchivedLists=false;renderLists();}
      const heading=document.getElementById(button.dataset.librarySection);
      if(!heading)return;
      heading.setAttribute("tabindex","-1");heading.focus({preventScroll:true});
      heading.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
    });
  }
}
function renderFilters() {
  const f = [["all", t("all")], ["reading", t("reading")], ["watching", t("watching")], ["favorites", t("favorites")], ["current", t("current")], ["planned", t("planned")], ["completed", t("completed")], ["on_hold", t("on_hold")], ["dropped", t("dropped")]];
  document.getElementById("filters").innerHTML = f.map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${filter === k}" class="${filter === k ? "active" : ""}">${l}</button>`).join("");
}
function cardHtml(i) {
  const rating = i.rating || 0;
  const tags = (i.tags || []).slice(0, 4).map((x) => `<span class="tag">${esc(x)}</span>`).join("");
  return `<article class="card" data-open="${esc(i.id)}">
    <button class="fav ${i.favorite ? "on" : ""}" data-fav="${esc(i.id)}" aria-pressed="${!!i.favorite}" aria-label="${esc(t("favorites")+": "+i.title)}">${I.star}</button>
    <div class="cover" style="background:${safeColor(i.accent,accentFor(i))}">${coverInner(i)}<span class="cat-badge">${esc(catLabel(i))}</span>${flagLabel(i) ? `<span class="new-flag" style="top:auto;bottom:5px">${esc(flagLabel(i))}</span>` : ""}</div>
    <div class="card-body">
      <h3><button class="link-btn" data-open="${esc(i.id)}">${esc(i.title || "Untitled")}</button></h3><p>${esc(marker(i))}${itemState(i) !== "current" ? ` — <b style="color:var(--lav-ink)">${t(itemState(i))}</b>` : ""}</p>
      ${(i.progress || 0) > 0 ? `<div class="bar"><i style="width:${Math.min(100, i.progress)}%;background:${accentFor(i)}"></i></div>` : ""}
      <small>${relative(i.activityAt||i.updatedAt)}</small>
      <div class="rate">${[1,2,3,4,5].map((n) => `<button type="button" data-rate="${esc(i.id)}" data-v="${n}" aria-pressed="${rating===n}" aria-label="${esc((settings.lang==="fr"?"Note ":"Rating ")+n+"/5 : "+i.title)}">${I.star.replace('class="ic fill"', `class="ic fill ${n <= rating ? "on" : ""}"`)}</button>`).join("")}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      <button type="button" class="quick-add" data-quickadd="${esc(i.id)}" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(t("addToList")+": "+i.title)}">${I.plus}<span>${esc(t("addToList"))}</span></button>
    </div>

  </article>`;
}
let libraryFormat="all",libraryUnlisted=false,libraryQuery="";
function libraryCompare(a,b) {
  const title=()=>String(a.title||"").localeCompare(String(b.title||""),settings.lang||"en",{numeric:true,sensitivity:"base"});
  switch(settings.librarySort) {
    case "title":return title();
    case "rating":return (Number(b.rating)||0)-(Number(a.rating)||0)||title();
    case "remaining":return unseen(b)-unseen(a)||title();
    case "added":return (Number(b.createdAt)||0)-(Number(a.createdAt)||0)||title();
    default:return (b.activityAt||b.updatedAt||0)-(a.activityAt||a.updatedAt||0)||title();
  }
}
let librarySortSaving=false;
function renderGrid() {
  const grid = document.getElementById("grid");
  const normalize=value=>String(value||"").normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase().trim();
  const q = normalize(libraryQuery);
  const listed=new Set(lists.filter(l=>!l.archived).flatMap(l=>l.itemIds||[]));
  const list = items.filter((i) => {
    if (i.type === "game") return false;
    if(libraryFormat!=="all"&&String(i.format||"").toUpperCase()!==libraryFormat)return false;
    if(libraryUnlisted&&listed.has(i.id))return false;
    if (filter === "favorites" && !i.favorite) return false;
    if ((filter === "reading" || filter === "watching") && i.type !== filter) return false;
    if (STATUSES.includes(filter) && itemState(i) !== filter) return false;
    if (!q) return true;
    return normalize(`${i.title} ${(i.alternativeTitles || []).join(" ")} ${(i.authors || []).join(" ")} ${marker(i)} ${(i.tags || []).join(" ")}`).includes(q);
  });
  const total=items.filter(i=>i.type!=="game").length;
  const hasFilters=Boolean(libraryQuery)||filter!=="all"||libraryFormat!=="all"||libraryUnlisted;
  const count='<p class="sub library-result-count" style="grid-column:1/-1" role="status">'+list.length+' / '+total+' '+t("tracked")+(hasFilters?' <button class="link-btn" id="reset-library-filters">'+t("showAll")+'</button>':'')+'</p>';
  const formats=[...new Set(items.filter(i=>i.type!=="game").map(i=>String(i.format||"").toUpperCase()).filter(Boolean))].sort();
  // Keep an active filter visible even when its final matching work was removed.
  if(libraryFormat!=="all"&&!formats.includes(libraryFormat))formats.push(libraryFormat);
  const controls='<div style="grid-column:1/-1;display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'+
    '<label style="flex:1;min-width:min(240px,100%)">'+(settings.lang==="fr"?"Rechercher dans ma bibliothèque":"Search my library")+' <input type="search" class="field" id="library-search" value="'+esc(libraryQuery)+'" placeholder="'+(settings.lang==="fr"?"Titre, auteur ou étiquette":"Title, author or tag")+'"></label>'+
    '<label>'+ t("sortBy")+' <select class="field" id="library-sort"'+(librarySortSaving?' disabled aria-busy="true"':'')+'>'+
    [["recent",t("sortRecent")],["title",t("sortTitle")],["rating",t("sortRating")],["remaining",t("sortRemaining")],["added",t("sortAdded")]].map(([v,label])=>'<option value="'+v+'"'+((settings.librarySort||"recent")===v?' selected':'')+'>'+label+'</option>').join("")+'</select></label>'+
    '<label>'+ t("formatLabel")+' <select class="field" id="library-format"><option value="all">'+t("all")+'</option>'+formats.map(v=>'<option value="'+esc(v)+'"'+(libraryFormat===v?' selected':'')+'>'+esc(v)+'</option>').join("")+'</select></label>'+
    '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="library-unlisted"'+(libraryUnlisted?' checked':'')+'>'+ t("withoutList")+'</label></div>';
  const fr=settings.lang==="fr";
  const emptyMessage=total?(fr?"Aucune œuvre ne correspond à ces filtres. Tes œuvres sont toujours dans la bibliothèque.":"No works match these filters. Your works are still in your library."):(fr?"Ajoute ta première lecture ou série en utilisant la recherche en haut de la page.":"Add your first book or show using the search at the top of the page.");
  grid.innerHTML = controls + count + (list.length ? [...list].sort(libraryCompare).map(cardHtml).join("") : '<div class="empty" style="grid-column:1/-1"><p>'+emptyMessage+'</p>'+(!total?'<button class="btn" id="library-start-search">'+t("searchTitle")+'</button>':'')+(!total&&items.some(i=>i.type==="game")?' <button class="btn" id="library-open-games">'+t("games")+'</button>':'')+'</div>');
  const startSearch=document.getElementById("library-start-search");if(startSearch)startSearch.onclick=()=>document.getElementById("q").focus();
  const openGames=document.getElementById("library-open-games");if(openGames)openGames.onclick=()=>switchView("games");
  document.getElementById("library-search").oninput=e=>{
    const input=e.target,start=input.selectionStart,end=input.selectionEnd;
    libraryQuery=input.value;renderGrid();
    const replacement=document.getElementById("library-search");replacement.focus();replacement.setSelectionRange(start,end);
  };
  document.getElementById("library-sort").onchange=async e=>{
    if(librarySortSaving)return;
    const control=e.currentTarget,focused=document.activeElement===control;
    librarySortSaving=true;control.setAttribute("aria-busy","true");
    try{await saveSettingControl("librarySort",control.value,control,value=>{control.value=value||"recent";});}
    finally{
      librarySortSaving=false;
      if(view==="library"){renderGrid();if(focused)document.getElementById("library-sort")?.focus({preventScroll:true});}
    }
  };
  document.getElementById("library-format").onchange=e=>{libraryFormat=e.target.value;renderGrid();document.getElementById("library-format").focus();};
  document.getElementById("library-unlisted").onchange=e=>{libraryUnlisted=e.target.checked;renderGrid();document.getElementById("library-unlisted").focus();};
  const reset=document.getElementById("reset-library-filters");if(reset)reset.onclick=()=>{libraryQuery="";filter="all";libraryFormat="all";libraryUnlisted=false;renderFilters();renderGrid();document.getElementById("library-search").focus();};
}

/* ================= GAMES ================= */
// Always give a working link to the game: its stored store/official URL, else a
// Steam search for the title so the user still lands on the game's page.
function gameStoreButtons(item) {
  const canonical=value=>{const safe=safeStoreLink(value);if(!safe)return "";const url=new URL(safe);const steam=url.pathname.match(/^\/app\/(\d+)/);if(url.hostname==="store.steampowered.com"&&steam)return "https://store.steampowered.com/app/"+steam[1]+"/";url.hash="";return url.href;};
  const links=[...new Set([item.url,...(Array.isArray(item.storeLinks)?item.storeLinks:[])].map(canonical).filter(Boolean))].slice(0,24);
  return links.length?'<div class="game-store-links" style="display:flex;gap:8px;flex-wrap:wrap" aria-label="'+(settings.lang==="fr"?"Boutiques":"Stores")+'">'+links.map(url=>'<a class="btn" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(gameLinkLabel({url}))+' '+I.open+'</a>').join("")+'</div>':"";
}
function gameSourceCredit(item) {
  const id=String(item.externalIds?.rawg||"");
  let source="https://rawg.io/";
  try {const url=new URL(item.url);if(url.origin==="https://rawg.io"&&!url.username&&!url.password&&url.pathname.startsWith("/games/"))source=url.origin+url.pathname;}catch{}
  return /^[1-9]\d{0,14}$/.test(id)?'<p class="field-hint">'+(settings.lang==="fr"?"Données jeux : ":"Game data: ")+'<a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">RAWG</a></p>':"";
}
function gameLinkLabel(i) {
  if (!i.url) return "Steam";
  const host = (i.url.replace(/^https?:\/\//, "").split("/")[0] || "").replace(/^www\./, "");
  if (/steampowered|steamcommunity/.test(host)) return "Steam";
  if (/epicgames/.test(host)) return "Epic";
  if (/gog\.com/.test(host)) return "GOG";
  if (/playstation/.test(host)) return "PlayStation";
  if (/xbox|microsoft/.test(host)) return "Xbox";
  if (/nintendo/.test(host)) return "Nintendo";
  if (host === "apps.apple.com") return "App Store";
  if (host === "play.google.com") return "Google Play";
  return t("open");
}
function gameCardHtml(i) {
  const fr=settings.lang==="fr";
  const genres=[...new Set([...(i.genres||[]),...(i.tags||[])].filter(x=>typeof x==="string"))].slice(0,3);
  return '<article class="game-card"><button class="game-cover" data-open="'+esc(i.id)+'" aria-label="'+esc(t("details")+": "+i.title)+'">'+coverInner(i,24)+'</button><div class="game-body"><h3><button class="link-btn" data-open="'+esc(i.id)+'">'+esc(i.title)+'</button></h3><p class="game-platform">'+esc(i.platform|| (fr?"Jeu vidéo":"Video game"))+'</p><div class="game-genres">'+genres.map(g=>'<span>'+esc(g)+'</span>').join("")+'</div>'+(i.releaseDate?'<p class="game-release">'+esc(i.releaseDate)+(isSoon(i)?" — "+t("comingSoon"):isReleased(i)?" — "+t("released"):"")+'</p>':"")+'</div></article>';
}
function renderGames() {
  const el=document.getElementById("view-games"),fr=settings.lang==="fr",searchResults=document.getElementById("search-results");
  const games=items.filter(i=>i.type==="game").sort((a,b)=>(parseDate(a.releaseDate)||9e15)-(parseDate(b.releaseDate)||9e15));
  el.innerHTML='<div class="section-h" style="margin-top:0"><div><h1 style="margin:0">'+t("games")+'</h1><p class="sub">'+(fr?"Vos jeux, leurs sorties et leurs actualités.":"Your games, upcoming releases and latest news.")+'</p></div><button class="btn" id="search-games">'+I.search+' '+(fr?"Rechercher un jeu":"Find a game")+'</button></div>'+(games.length?'<section aria-label="'+(fr?"Mes jeux":"My games")+'"><h2 class="games-section-title">'+(fr?"Mes jeux":"My games")+' <span>'+games.length+'</span></h2><div class="games-grid">'+games.map(gameCardHtml).join("")+'</div></section>':'<p class="games-empty">'+(fr?"Ouvrez une fiche ci-dessous pour enregistrer un jeu dans la liste de votre choix.":"Open a game below to save it to a list of your choice.")+'</p>')+renderGamesDiscover();
  el.querySelector(".section-h").after(searchResults);
  document.getElementById("search-games").onclick=()=>{searchFacets={kind:"GAME",genre:"all",year:"",release:"all",price:200};document.getElementById("q").focus();};
  bindDisco("#view-games");
  if(!discoverTried)loadDiscover(false);
  el.querySelectorAll("[data-open]").forEach(n=>n.onclick=()=>openDrawer(n.dataset.open));
}
function missingGameAction() {
  return searchFacets.kind==="GAME"?'<div class="search-manual"><p>'+(t("missingGame"))+'</p><button class="link-btn" id="manual-game">'+(t("manualDetails"))+'</button></div>':"";
}
function showGameForm(title="") {
  ++previewRequest;
  const d=document.getElementById("drawer"),fr=settings.lang==="fr";
  delete d.dataset.itemId;
  const field=(id,label,value="",type="text")=>'<label for="'+id+'">'+esc(label)+'</label><input class="field" id="'+id+'" type="'+type+'" value="'+esc(value)+'">';
  d.innerHTML='<div class="drawer-hero"><button class="icon-btn drawer-close" id="manual-close" aria-label="'+esc(t("close"))+'">'+I.close+'</button><h2 class="drawer-title">'+(fr?"Ajouter un jeu":"Add a game")+'</h2><p>'+(fr?"Vérifiez les informations, puis choisissez une liste.":"Review the details, then choose a list.")+'</p></div><form class="drawer-body manual-game-form" id="manual-game-form">'+field("g-title",t("title"),title)+field("g-url",fr?"Lien vers la boutique (facultatif)":"Store link (optional)","","url")+field("g-platform",t("platform"))+field("g-date",t("releaseDate"),"","date")+field("g-cover",fr?"Lien de l’affiche (facultatif)":"Cover URL (optional)","","url")+'<label for="g-synopsis">'+t("synopsis")+'</label><textarea class="field" id="g-synopsis" rows="4"></textarea><p id="manual-error" role="alert"></p><button class="btn primary" type="submit">'+(fr?"Vérifier et choisir une liste":"Review and choose a list")+'</button></form>';
  d.setAttribute("role","dialog");d.setAttribute("aria-modal","true");d.setAttribute("aria-label",fr?"Ajouter un jeu":"Add a game");
  d.classList.add("open");focusDrawer();document.getElementById("scrim").classList.add("open");
  document.getElementById("manual-close").onclick=closeDrawer;
  document.getElementById("g-title").required=true;
  document.getElementById("g-title").focus();
  document.getElementById("manual-game-form").onsubmit=e=>{
    e.preventDefault();
    const value=id=>document.getElementById(id).value.trim(),name=value("g-title"),url=value("g-url"),cover=value("g-cover");
    const fail=message=>{document.getElementById("manual-error").textContent=message;};
    if(!name){document.getElementById("g-title").focus();return;}
    if(url&&!safeStoreLink(url)){fail(fr?"Utilisez un lien HTTPS vers Steam, Epic, GOG, PlayStation, Xbox ou Nintendo.":"Use an HTTPS link to Steam, Epic, GOG, PlayStation, Xbox or Nintendo.");return;}
    if(cover){try{const u=new URL(cover);if(u.protocol!=="https:"||u.username||u.password)throw new Error();}catch{fail(fr?"L’affiche doit utiliser un lien HTTPS valide.":"The cover must use a valid HTTPS URL.");return;}}
    openCatalogPreview({title:name,type:"game",format:"GAME",url,cover,platform:value("g-platform"),releaseDate:value("g-date"),synopsis:value("g-synopsis"),manual:true});
  };
}

/* ================= PLANS ================= */
function renderPlans() {
  const el = document.getElementById("view-plans");
  const feat = (arr) => arr.map((x) => `<li>${I.check} ${esc(x)}</li>`).join("");
  const cur = isPro() ? (userPlan === "lifetime" ? "lifetime" : "pro") : "free";
  const label = (plan, cta) => (UNLOCK_ALL ? (plan === "free" ? "" : t("currentPlan")) : cur === plan ? t("currentPlan") : cta);
  el.innerHTML = `
    <h1>${t("plansTitle")}</h1><p class="sub">${t("plansSub")}</p>
    ${UNLOCK_ALL ? `<div class="unlocked-banner">${I.crown} ${t("unlocked")}</div>` : ""}
    <div class="cycle-toggle" role="tablist">
      <button data-cycle="month" class="${planCycle === "month" ? "on" : ""}">${t("monthly")}</button>
      <button data-cycle="year" class="${planCycle !== "month" ? "on" : ""}">${t("yearly")}</button>
    </div>
    <div class="plan-grid two">
      <div class="plan">
        <h3>Free</h3><div class="price">$0</div><div class="per">${t("planFreePer")}</div>
        <ul>${feat(tArr("freeFeatures"))}</ul>
        <button class="cta" data-plan="free"${cur === "free" || UNLOCK_ALL ? " disabled" : ""}>${label("free", t("getStarted")) || t("currentPlan")}</button>
      </div>
      <div class="plan feat"><span class="ptag">${t("mostPopular")}</span>
        <h3>Pro</h3>
        <div class="price">${planCycle === "month" ? "$3.49<small>/mo</small>" : "$29.99<small>/yr</small>"}</div>
        <div class="per">${planCycle === "month" ? t("perMonthNote") : t("perYearNote")}</div>
        <ul>${feat(tArr("proFeatures"))}</ul>
        <button class="cta" data-plan="pro"${cur === "pro" ? " disabled" : ""}>${label("pro", t("goPro"))}</button>
      </div>
    </div>
    <p class="sub" style="margin-top:18px">${t("planFoot")}</p>`;
  el.querySelectorAll("[data-cycle]").forEach((b) => (b.onclick = () => { planCycle = b.dataset.cycle; renderPlans(); }));
  el.querySelectorAll("[data-plan]").forEach((b) => (b.onclick = () => {
    if (UNLOCK_ALL) { toast(t("unlocked")); return; }
    api.runtime.openOptionsPage();
  }));
}

/* ================= LISTS ================= */
function listCover(l) { return safeBackground(l.cover); }
function isImg(v) { return v && /^https?:|^data:/.test(v); }
let showArchivedLists=false;
function listMembers(list) {
  const byId=new Map(items.map(item=>[item.id,item]));
  return [...new Set(list.itemIds||[])].map(id=>byId.get(id)).filter(Boolean);
}
function renderLists() {
  const strip = document.getElementById("list-strip");
  if (!strip) return;
  renderLibraryShortcuts();
  const fr=settings.lang==="fr";
  const activeCount=lists.filter(l=>!l.archived).length, archivedCount=lists.length-activeCount;
  const visibleLists=lists.filter(l=>Boolean(l.archived)===showArchivedLists);
  const heading=document.getElementById("library-lists-title");
  if(heading)heading.textContent=(showArchivedLists?(fr?"Listes archivées":"Archived lists"):t("lists"))+" ("+visibleLists.length+")";
  const emptyText=showArchivedLists
    ?(fr?"Aucune liste archivée. Archiver une liste la range ici sans supprimer ses œuvres.":"No archived lists. Archiving a list moves it here without deleting its works.")
    :(fr?"Crée une liste pour regrouper tes œuvres par envie, thème ou collection.":"Create a list to group your works by mood, theme or collection.");
  strip.innerHTML = (!visibleLists.length?'<p class="sub list-empty-help" style="flex:1;min-width:160px">'+esc(emptyText)+'</p>':"")+visibleLists.map((l) => { const n = listMembers(l).length; return `<div class="strip-list" data-list="${esc(l.id)}">
      <div class="lc" style="position:relative;${listCover(l)}"><button class="icon-btn" data-delete-list="${esc(l.id)}" aria-label="${esc(t("delete")+" "+l.name)}" style="position:absolute;right:6px;top:6px;z-index:2;background:var(--card)">${I.trash}</button>${isImg(l.cover) ? "" : esc((l.name || "?")[0].toUpperCase())}<span class="cnt">${n}</span></div>
      <button type="button" class="link-btn list-open" aria-label="${esc(t("open")+": "+l.name)}">${esc(l.name)}</button><small>${n} ${n === 1 ? t("work") : t("works")}</small>
    </div>`; }).join("") + `<button class="strip-new" id="new-list" aria-label="${esc(t("newList"))}">${I.plus}</button><button class="btn" id="toggle-archived" aria-label="${fr?'Afficher les listes archivées':'Show archived lists'}" aria-pressed="${showArchivedLists}">${showArchivedLists?(fr?'Voir les listes actives':'Show active lists')+' ('+activeCount+')':(fr?'Voir les archives':'Show archives')+' ('+archivedCount+')'}</button>`;
  strip.querySelectorAll("[data-delete-list]").forEach(button=>button.onclick=e=>{e.stopPropagation();confirmListDelete(button.dataset.deleteList,button);});
  document.getElementById("toggle-archived").onclick=()=>{showArchivedLists=!showArchivedLists;renderLists();document.getElementById("toggle-archived").focus();};
  paintListCreation();
}
function confirmListDelete(id,button) {
document.getElementById("list-delete-confirm")?.remove();
    const list=lists.find(l=>l.id===id);if(!list)return;
    const popup=document.createElement("dialog");popup.id="list-delete-confirm";popup.className="panel";popup.setAttribute("role","alertdialog");
    popup.setAttribute("aria-label",settings.lang==="fr"?"Supprimer la liste":"Delete list");popup.setAttribute("aria-describedby","list-delete-description");
    popup.style.cssText="margin:0;border:0;position:fixed;z-index:1000;padding:18px;width:min(320px,calc(100vw - 32px));left:50%;top:35%;transform:translateX(-50%);box-shadow:0 12px 48px #25213940";
    popup.innerHTML='<b>'+esc(list.name)+'</b><p id="list-delete-description">'+(settings.lang==="fr"?"Supprimer cette liste ? Les œuvres restent dans ta bibliothèque.":"Delete this list? Its works stay in your library.")+'</p><div style="display:flex;gap:8px"><button class="btn" id="list-delete-cancel">'+t("cancel")+'</button><button class="btn danger" id="list-delete-yes">'+t("delete")+'</button></div>';
    const close=()=>{if(!popup.isConnected)return;popup.close();popup.remove();if(button.isConnected&&button.getClientRects().length)button.focus();else document.getElementById("new-list")?.focus();};
    popup.onclick=e=>e.stopPropagation();popup.onkeydown=e=>{
      if(e.key==="Escape"){e.preventDefault();close();return;}
      if(e.key==="Tab"){
        const buttons=[...popup.querySelectorAll("button:not(:disabled)")],first=buttons[0],last=buttons[buttons.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.body.append(popup);popup.showModal();
    document.getElementById("list-delete-cancel").onclick=close;
    document.getElementById("list-delete-yes").onclick=async e=>{
      e.currentTarget.disabled=true;
      const ok=await listMsg("LIST_DELETE",{id:list.id},()=>{if(currentListId===list.id)backToLists();else renderLists();renderGrid();});
      if(ok)close();else if(popup.isConnected)e.target.disabled=false;
    };
    document.getElementById("list-delete-cancel").focus();
}
/* Quick add-to-list menu anchored to a card's + button. */
let qaMenuEl = null, qaMenuCleanup=null;
function closeQuickAdd(restoreFocus=false) {
  if(qaMenuCleanup){qaMenuCleanup(restoreFocus);qaMenuCleanup=null;}
  if(qaMenuEl){qaMenuEl.remove();qaMenuEl=null;}
}
function openQuickAdd(itemId, anchor) {
  closeQuickAdd();
  const build = () => {
    const rows = lists.filter(l=>!l.archived).map((l) => { const on = (l.itemIds || []).includes(itemId); return `<button data-ql="${esc(l.id)}" class="${on ? "qa-on" : ""}">${on ? I.check : I.plus} ${esc(l.name)} <span style="margin-left:auto;color:var(--muted);font-size:11px">${listMembers(l).length}</span></button>`; }).join("");
    return `${rows}<div style="height:1px;background:var(--line);margin:5px 4px"></div><button data-ql-new>${I.plus} ${t("newList")}</button>`;
  };
  const m = document.createElement("div");
  m.className = "qa-menu";
  m.setAttribute("role","dialog");m.setAttribute("aria-label",t("lists"));
  m.innerHTML = build();
  document.body.appendChild(m);
  qaMenuEl = m;
  const position=()=>{
    if(!anchor.isConnected){closeQuickAdd();return;}
    const r=anchor.getBoundingClientRect(),gap=8;
    const viewport=window.visualViewport;
    const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0;
    const width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
    m.style.maxWidth=Math.max(0,width-gap*2)+"px";
    m.style.maxHeight=Math.max(0,Math.min(320,height-gap*2))+"px";
    const below=r.bottom+6,above=r.top-m.offsetHeight-6;
    m.style.left=Math.max(left+gap,Math.min(r.right-m.offsetWidth,left+width-m.offsetWidth-gap))+"px";
    m.style.top=Math.max(top+gap,Math.min(below+m.offsetHeight<=top+height-gap?below:above,top+height-m.offsetHeight-gap))+"px";
  };
  const onScroll=e=>{if(!m.contains(e.target))position();};
  window.addEventListener("resize",position);
  document.addEventListener("scroll",onScroll,true);
  window.visualViewport?.addEventListener("resize",position);
  window.visualViewport?.addEventListener("scroll",position);
  anchor.setAttribute("aria-expanded","true");
  qaMenuCleanup=restore=>{
    window.removeEventListener("resize",position);
    document.removeEventListener("scroll",onScroll,true);
    window.visualViewport?.removeEventListener("resize",position);
    window.visualViewport?.removeEventListener("scroll",position);
    anchor.setAttribute("aria-expanded","false");
    if(restore&&anchor.isConnected)anchor.focus({preventScroll:true});
  };
  m.addEventListener("keydown",e=>{
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeQuickAdd(true);return;}
    const buttons=[...m.querySelectorAll("button:not(:disabled)")],at=buttons.indexOf(document.activeElement);
    if(["ArrowDown","ArrowUp","Home","End"].includes(e.key)){
      e.preventDefault();
      const index=e.key==="Home"?0:e.key==="End"?buttons.length-1:(at+(e.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length;
      buttons[index]?.focus();
    }
    if(e.key==="Tab")setTimeout(()=>{if(qaMenuEl===m&&!m.contains(document.activeElement))closeQuickAdd();},0);
  });
  const rewire = id => { m.innerHTML = build(); wire();position();[...m.querySelectorAll("[data-ql]")].find(b=>b.dataset.ql===id)?.focus({preventScroll:true}); };
  const wire = () => {
    m.querySelectorAll("[data-ql]").forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation();
      const l = lists.find((x) => x.id === b.dataset.ql); if (!l) return;
      const has = (l.itemIds || []).includes(itemId);
      b.disabled=true;
      await changeListMembership(l.id,itemId,!has,true);
      if(m.isConnected)rewire(l.id);
    }));
    const nb = m.querySelector("[data-ql-new]");
    if (nb) nb.onclick = async (e) => {
      e.stopPropagation();const name=(prompt(t("newList"))||"").trim();if(!name)return;
      nb.disabled=true;
      await listMsg("LIST_CREATE",{name,itemIds:[itemId]},()=>{renderLists();});
      if(m.isConnected)rewire();
    };
  };
  wire();position();m.querySelector("button")?.focus({preventScroll:true});
}
let siteRemovalPending=false;
function renderSites() {
  const block = document.getElementById("sites-block");
  const strip = document.getElementById("site-strip");
  if (!block) return;
  renderLibraryShortcuts();
  block.hidden = false;
  const h = document.getElementById("sites-h");
  if (h) h.textContent = t("sitesTitle");
  const help=document.getElementById("sites-help");if(help)help.textContent=t("sitesHelp");
  strip.innerHTML = sites.map((s) => {
    const url = safeNavigationUrl(s.url), name = s.name || s.url || "?";
    const label = '<span class="fav-dot">'+esc(name[0].toUpperCase())+'</span><span>'+esc(name)+'</span>';
    return '<span class="site-chip">'+(url ? '<a class="site-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>' : '<span class="site-link">'+label+'</span>')+
      '<button type="button" class="rm-site" data-rmsite="'+esc(s.id || s.url)+'" aria-label="'+esc(t("delete")+": "+name)+'">'+I.close.replace('class="ic"', 'class="ic" style="width:12px;height:12px"')+'</button></span>';
  }).join("");
  if(!sites.length)strip.innerHTML='<p class="sub">'+esc(t("sitesEmpty"))+'</p>';
  strip.querySelectorAll("[data-rmsite]").forEach(button=>{button.disabled=siteRemovalPending;});
  strip.querySelectorAll("[data-rmsite]").forEach((x) => (x.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    if(siteRemovalPending)return;
    const id = x.dataset.rmsite;
    siteRemovalPending=true;
    strip.querySelectorAll("[data-rmsite]").forEach(button=>{button.disabled=true;});
    requestMetadata({ type: "REMOVE_SITE", id }, (r) => {
      siteRemovalPending=false;
      const error=api.runtime.lastError;
      if(error || r?.ok===false || !Array.isArray(r?.sites)) {
        renderSites();
        toast(settings.lang==="fr"?"Suppression du site non confirmée. Vérifie tes favoris avant de réessayer.":"Site removal not confirmed. Check your saved sites before retrying.");
        return;
      }
      sites = r.sites; renderSites();
    });
  }));
}
function openList(id) { const selected=lists.find(list=>list.id===id);if(selected)showArchivedLists=Boolean(selected.archived); if(currentListId!==id)listAddQuery=""; currentListId = id; document.getElementById("lib-main").hidden = true; document.getElementById("list-detail").hidden = false; renderListDetail(); document.getElementById("back-lists")?.focus({preventScroll:true}); window.scrollTo({ top: 0, behavior: "smooth" }); }
function renderListDetail() {
  const l = lists.find((x) => x.id === currentListId);
  const wrap = document.getElementById("list-detail");
  if (!l) return backToLists();
  const previousSearch=document.getElementById("list-add-search");
  const restoreSearch=previousSearch===document.activeElement;
  const selection=restoreSearch?[previousSearch.selectionStart,previousSearch.selectionEnd]:null;
  const members = listMembers(l);
  const notIn = items.filter((i) => !(l.itemIds || []).includes(i.id));
  const grid = l.view === "grid";
  wrap.innerHTML = `<button class="back-btn" id="back-lists">${I.back} ${t("allLists")}</button>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px">
      <div class="list-cover" style="width:64px;height:64px;border-radius:14px;font-size:24px;${listCover(l)}">${isImg(l.cover) ? "" : esc((l.name || "?")[0].toUpperCase())}</div>
      <div style="flex:1;min-width:180px">
        <input id="list-name" aria-describedby="list-name-status" aria-label="${settings.lang==="fr"?"Nom de la liste":"List name"}" value="${esc(l.name)}" style="font-size:24px;font-weight:800;letter-spacing:-.03em;border:0;border-bottom:2px solid transparent;background:none;width:100%;outline:none;padding:2px 0" />
        <div><span id="list-name-status" class="sub" role="status"></span><button class="link-btn" id="list-name-retry" hidden>${settings.lang==="fr"?"Réessayer":"Retry"}</button></div>
        <small style="color:var(--muted)">${members.length} ${members.length === 1 ? t("work") : t("works")} — ${t("dragReorder")}</small>
      </div>
      <button class="btn" id="list-view-btn" title="${t("viewToggle")}">${grid ? I.rows : I.grid} ${grid ? t("viewRows") : t("viewGrid")}</button>
      <button class="btn" id="list-cover-btn">${I.image} ${t("cover")}</button>
      <button class="btn" id="list-duplicate">${settings.lang==='fr'?'Dupliquer':'Duplicate'}</button><button class="btn" id="list-archive">${l.archived?(settings.lang==='fr'?'Restaurer':'Restore'):(settings.lang==='fr'?'Archiver':'Archive')}</button>
      <button class="btn danger" id="list-del">${I.trash} ${t("delete")}</button>
    </div>
    <div class="section-t">${t("inThisList")}</div>
    ${grid
      ? `<div id="list-items" class="li-grid">${members.length ? members.map((i) => `<div class="li-card" draggable="true" data-id="${esc(i.id)}">
          <div class="li-card-cov" style="background:${safeColor(i.accent,accentFor(i))}">${coverInner(i)}<button class="li-card-rm" data-remove="${esc(i.id)}" aria-label="${esc((settings.lang==="fr"?"Retirer de la liste : ":"Remove from list: ")+i.title)}">${I.close}</button></div>
          <button class="link-btn list-work-title" data-open="${esc(i.id)}">${esc(i.title)}</button><small><span class="cat-inline">${esc(catLabel(i))}</span> ${esc(marker(i))}</small></div>`).join("") : `<p class="empty" style="padding:24px 0">${settings.lang==="fr"?"Cette liste est vide. Ajoute des œuvres ci-dessous.":"This list is empty. Add works below."}</p>`}</div>`
      : `<div id="list-items">${members.length ? members.map((i) => `<div class="li-row" draggable="true" data-id="${esc(i.id)}">
        <span class="grip">${I.grip}</span>
        <div class="li-cover" style="background:${safeColor(i.accent,accentFor(i))}">${coverInner(i)}</div>
        <div style="flex:1;min-width:0"><button class="link-btn list-work-title" data-open="${esc(i.id)}">${esc(i.title)}</button><small><span class="cat-inline">${esc(catLabel(i))}</span> ${esc(marker(i))}</small></div>
        <button class="btn" data-remove="${esc(i.id)}" aria-label="${esc((settings.lang==="fr"?"Retirer de la liste : ":"Remove from list: ")+i.title)}">${settings.lang==="fr"?"Retirer":"Remove"}</button></div>`).join("") : `<p class="empty" style="padding:24px 0">${settings.lang==="fr"?"Cette liste est vide. Ajoute des œuvres ci-dessous.":"This list is empty. Add works below."}</p>`}</div>`}
    ${notIn.length ? `<div class="section-t">${t("addWorks")}</div><p class="sub">${settings.lang==="fr"?"Choisis parmi les œuvres déjà enregistrées dans ta bibliothèque.":"Choose from works already saved in your library."}</p><label for="list-add-search">${settings.lang==="fr"?"Rechercher dans ma bibliothèque":"Search my library"}</label><input class="field" type="search" id="list-add-search" value="${esc(listAddQuery)}" /><p class="sub" id="list-add-count" role="status"></p><div class="chips-wrap" id="list-add-options"></div>` : ""}`;
  const search=document.getElementById("list-add-search");
  if(search) {
    const renderOptions=()=>{
      const normalize=value=>String(value||"").normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase().trim();
      const q=normalize(search.value);
      const matches=notIn.filter(i=>[i.title,...(i.alternativeTitles||[]),...(i.authors||[]),...(i.tags||[])].some(value=>normalize(value).includes(q)));
      const shown=matches.slice(0,50);
      document.getElementById("list-add-count").textContent=shown.length+" / "+matches.length+" "+t("works");
      const options=document.getElementById("list-add-options");
      options.innerHTML=shown.length?shown.map(i=>'<button class="chip-toggle" data-add="'+esc(i.id)+'"><span class="cat-inline">'+esc(catLabel(i))+'</span> '+esc(i.title)+'</button>').join(""):'<p class="sub">'+t("noMatch")+'</p>';
      options.querySelectorAll("[data-add]").forEach(b=>b.onclick=async()=>{
        if(b.disabled)return;
        const hadFocus=document.activeElement===b;b.disabled=true;
        await changeListMembership(l.id,b.dataset.add,true);
        if(b.isConnected)b.disabled=false;
        if(hadFocus&&currentListId===l.id&&document.activeElement===document.body)document.getElementById("list-add-search")?.focus();
      });
    };
    search.oninput=()=>{listAddQuery=search.value;renderOptions();};renderOptions();
    if(restoreSearch){search.focus();search.setSelectionRange(...selection);}
  }
  wireListDetail(l);
}
const pendingListActions=new Set();
function paintListActionPending(id) {
  for(const key of ["list-duplicate","list-archive"]){const button=document.getElementById(key);if(button){button.disabled=pendingListActions.has(id);button.setAttribute("aria-busy",String(button.disabled));}}
}
async function runListAction(list,duplicate) {
  if(pendingListActions.has(list.id))return false;
  pendingListActions.add(list.id);paintListActionPending(list.id);
  const navigation=previewRequest;
  try{
    const response=await new Promise(resolve=>requestMetadata(duplicate?{type:"LIST_DUPLICATE",id:list.id}:{type:"LIST_UPDATE",id:list.id,patch:{archived:!list.archived}},resolve));
    const result=duplicate?response?.list:response?.lists?.find?.(entry=>entry.id===list.id);
    const valid=response?.ok!==false&&Array.isArray(response?.lists)&&result&&typeof result.id==="string"&&result.id&&response.lists.some(entry=>entry.id===result.id)&&(duplicate?result.id!==list.id:result.archived===!list.archived);
    if(!valid){toast(settings.lang==="fr"?"Action non confirmée. Vérifie tes listes avant de réessayer.":"Action not confirmed. Check your lists before retrying.");return false;}
    if(duplicate){
      if(!lists.some(entry=>entry.id===result.id))lists=[...lists,result];
    }else{
      lists=lists.map(entry=>entry.id===list.id?{...entry,archived:result.archived}:entry);
    }
    renderLists();
    if(view==="library"&&currentListId===list.id&&previewRequest===navigation){
      if(duplicate)openList(result.id);else backToLists();
    }
    return true;
  }finally{
    pendingListActions.delete(list.id);
    if(currentListId)paintListActionPending(currentListId);
  }
}
function wireListDetail(l) {
  document.querySelectorAll("#list-items [data-open]").forEach(button=>button.onclick=()=>openDrawer(button.dataset.open));
  document.getElementById("back-lists").onclick = backToLists;
  paintListActionPending(l.id);
  document.getElementById("list-duplicate").onclick=()=>runListAction(l,true);
  document.getElementById("list-archive").onclick=()=>runListAction(l,false);
  const name = document.getElementById("list-name");
  const saveName=async()=>{
    if(name.disabled)return;
    const next=name.value.trim();
    const status=document.getElementById("list-name-status"),retry=document.getElementById("list-name-retry");
    if(!next||next===l.name){name.value=l.name;name.removeAttribute("aria-invalid");status.textContent="";retry.hidden=true;return;}
    name.disabled=true;retry.hidden=true;
    status.textContent=settings.lang==="fr"?"Enregistrement…":"Saving…";
    const saved=await listMsg("LIST_UPDATE",{id:l.id,patch:{name:next}});
    if(!saved&&name.isConnected){
      name.disabled=false;name.setAttribute("aria-invalid","true");
      status.textContent=settings.lang==="fr"?"Nom non enregistré. Tu peux réessayer.":"Name not saved. You can retry.";
      retry.hidden=false;
    }
  };
  name.onchange=saveName;
  document.getElementById("list-name-retry").onclick=saveName;
  document.getElementById("list-view-btn").onclick = async e => {
    const button=e.currentTarget;if(button.disabled)return;
    const focused=document.activeElement===button;button.disabled=true;button.setAttribute("aria-busy","true");
    await listMsg("LIST_UPDATE", { id: l.id, patch: { view: l.view === "grid" ? "rows" : "grid" } });
    if(button.isConnected){button.disabled=false;button.removeAttribute("aria-busy");}
    if(focused&&currentListId===l.id&&document.activeElement===document.body)document.getElementById("list-view-btn")?.focus();
  };
  document.getElementById("list-cover-btn").onclick = () => changeCover((v) => listMsg("LIST_UPDATE", { id: l.id, patch: { cover: v } }), "square");
  document.getElementById("list-del").onclick = e => confirmListDelete(l.id,e.currentTarget);
  document.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => changeListMembership(l.id,b.dataset.remove,false)));
  wireListBulk(l);
  enableDrag(l);
}
function wireListBulk(list) {
  const container=document.getElementById("list-items"), selected=new Set();
  const fr=settings.lang==="fr", destinations=lists.filter(l=>l.id!==list.id&&!l.archived);
  const toolbar=document.createElement("div");toolbar.className="list-bulk";
  toolbar.innerHTML=`<label><input type="checkbox" id="bulk-all"> ${fr?"Tout sélectionner":"Select all"}</label><span id="bulk-count" role="status"></span><select id="bulk-destination" aria-label="${fr?"Liste de destination":"Destination list"}"><option value="">${fr?"Choisir une liste…":"Choose a list…"}</option>${destinations.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("")}</select><button class="btn" id="bulk-copy">${fr?"Copier":"Copy"}</button><button class="btn" id="bulk-move">${fr?"Déplacer":"Move"}</button><button class="btn" id="bulk-remove">${fr?"Retirer de la liste":"Remove from list"}</button><button class="btn" id="bulk-up" aria-label="${fr?"Monter la sélection":"Move selection up"}">↑</button><button class="btn" id="bulk-down" aria-label="${fr?"Descendre la sélection":"Move selection down"}">↓</button>`;
  container.before(toolbar);
  const rows=[...container.querySelectorAll("[data-id]")];let busy=false;
  const refresh=()=>{
    container.inert=busy;
    const all=toolbar.querySelector("#bulk-all");all.checked=rows.length>0&&selected.size===rows.length;all.indeterminate=selected.size>0&&selected.size<rows.length;all.disabled=busy||!rows.length;
    toolbar.querySelector("#bulk-count").textContent=fr?selected.size+" sélectionnée(s)":selected.size+" selected";
    for(const id of ["copy","move"])toolbar.querySelector("#bulk-"+id).disabled=busy||!selected.size||!toolbar.querySelector("#bulk-destination").value;
    toolbar.querySelector("#bulk-remove").disabled=busy||!selected.size;
    const visibleOrder=listMembers(list).map(item=>item.id),index=visibleOrder.indexOf([...selected][0]);
    toolbar.querySelector("#bulk-up").disabled=busy||selected.size!==1||index<=0;
    toolbar.querySelector("#bulk-down").disabled=busy||selected.size!==1||index<0||index>=visibleOrder.length-1;
    toolbar.querySelector("#bulk-destination").disabled=busy||!destinations.length;
    rows.forEach(row=>{const input=row.querySelector(".list-select");input.checked=selected.has(row.dataset.id);input.disabled=busy;row.classList.toggle("selected",input.checked);});
  };
  rows.forEach(row=>{
    const input=document.createElement("input");input.type="checkbox";input.className="list-select";
    const title=items.find(i=>i.id===row.dataset.id)?.title||"";
    input.setAttribute("aria-label",(fr?"Sélectionner ":"Select ")+title);
    input.onclick=e=>e.stopPropagation();input.onchange=()=>{if(input.checked)selected.add(row.dataset.id);else selected.delete(row.dataset.id);refresh();};row.prepend(input);
  });
  toolbar.querySelector("#bulk-all").onchange=e=>{selected.clear();if(e.target.checked)rows.forEach(r=>selected.add(r.dataset.id));refresh();};
  toolbar.querySelector("#bulk-destination").onchange=refresh;
  const act=async action=>{
    if(busy||!selected.size)return;busy=true;refresh();
    const ids=[...selected], source=lists.find(l=>l.id===list.id);
    const destination=lists.find(l=>l.id===toolbar.querySelector("#bulk-destination").value);
    let ok=false;
    if(action==="copy"||action==="move"){
      if(!source||!destination){busy=false;refresh();return;}
      ok=await listMsg("LIST_TRANSFER",{sourceId:source.id,destinationId:destination.id,itemIds:ids,action},()=>{});
    } else if(action==="remove"){
      if(!source){busy=false;refresh();return;}
      ok=await listMsg("LIST_REMOVE_MEMBERS",{id:source.id,itemIds:ids},()=>{});
    }
    if(ok){renderListDetail();toast(fr?"Liste mise à jour":"List updated");}else{busy=false;refresh();}
  };
  for(const action of ["copy","move","remove"])toolbar.querySelector("#bulk-"+action).onclick=()=>act(action);
  const reorder=async direction=>{
    if(busy||selected.size!==1)return;
    const id=[...selected][0],current=lists.find(l=>l.id===list.id);
    if(!current)return;
    const order=listMembers(current).map(item=>item.id),index=order.indexOf(id),next=index+direction;
    if(index<0||next<0||next>=order.length)return;
    busy=true;refresh();[order[index],order[next]]=[order[next],order[index]];
    const ok=await listMsg("LIST_REORDER_ITEMS",{id:list.id,itemIds:order},()=>{});
    if(ok){renderListDetail();const row=[...document.querySelectorAll("#list-items [data-id]")].find(r=>r.dataset.id===id);const checkbox=row?.querySelector(".list-select");if(checkbox){checkbox.click();checkbox.focus();}}else{busy=false;refresh();}
  };
  toolbar.querySelector("#bulk-up").onclick=()=>reorder(-1);toolbar.querySelector("#bulk-down").onclick=()=>reorder(1);
  refresh();
}
function enableDrag(l) {
  const c = document.getElementById("list-items");
  const sel = ".li-row, .li-card";
  const grid = c.classList.contains("li-grid");
  let dragEl = null;
  c.querySelectorAll(sel).forEach((row) => {
    row.addEventListener("dragstart", () => { dragEl = row; row.classList.add("dragging"); });
    row.addEventListener("dragend", () => { row.classList.remove("dragging"); setListItems(l.id, [...c.querySelectorAll(sel)].map((r) => r.dataset.id)); });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragEl || dragEl === row) return;
      const r = row.getBoundingClientRect();
      const after = grid ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      c.insertBefore(dragEl, after ? row.nextSibling : row);
    });
  });
}
let listMembershipQueue=Promise.resolve();
function changeListMembership(id,itemId,adding,silent=false) {
  const operation=listMembershipQueue.then(async()=>{
    // Compute each edit after the preceding save, never from the rendered snapshot.
    const current=lists.find(list=>list.id===id);
    if(!current || (adding&&!items.some(item=>item.id===itemId)))return false;
    const saved=await listMsg("LIST_MEMBERSHIP",{id,itemId,adding},()=>{
      renderLists();if(currentListId===id)renderListDetail();
      const drawer=document.getElementById("drawer");
      if(silent&&drawer.classList.contains("open")&&drawer.dataset.itemId===itemId)refreshOpenItem(itemId);
    });
    return saved;
  });
  listMembershipQueue=operation.catch(()=>false);
  return operation;
}
async function setListItems(id,itemIds) {const saved=await listMsg("LIST_REORDER_ITEMS",{id,itemIds},()=>{});if(currentListId===id)renderListDetail();return saved;}
function listMsg(type, payload, done) {
  return new Promise(resolve => requestMetadata({type,...payload},r=>{
    if(api.runtime.lastError || r?.ok===false || !Array.isArray(r?.lists)){
      toast(r?.error==="metadata_timeout"?(settings.lang==="fr"?"Enregistrement de la liste non confirmé. Vérifie son contenu avant de réessayer.":"List save not confirmed. Check its contents before retrying."):(settings.lang==="fr"?"La liste n’a pas été enregistrée. Réessaie.":"The list could not be saved. Try again.")); resolve(false); return;
    }
    lists=r.lists;
    if(done)done(r);else {renderLists();if(currentListId)renderListDetail();}
    resolve(true);
  }));
}
function backToLists() {
  const previousId=currentListId;
  listAddQuery = ""; currentListId = null;
  document.getElementById("list-detail").hidden = true;
  const main=document.getElementById("lib-main");main.hidden = false;
  renderLists(); renderGrid();
  if(previousId&&main.getClientRects().length){
    const previous=[...document.querySelectorAll("#list-strip [data-list]")].find(node=>node.dataset.list===previousId);
    (previous?.querySelector(".list-open")||document.getElementById("new-list"))?.focus({preventScroll:true});
  }
}

/* ================= DRAWER ================= */
function requestMetadata(message,callback,timeoutMs=15000) {
  let settled=false;
  const finish=response=>{if(settled)return;settled=true;clearTimeout(timer);callback(response);};
  const timer=setTimeout(()=>finish({ok:false,error:"metadata_timeout"}),timeoutMs);
  try {
    api.runtime.sendMessage(message,response=>{
      const error=api.runtime.lastError;
      finish(error?{ok:false,error:"metadata_transport"}:response);
    });
  }catch{finish({ok:false,error:"metadata_transport"});}
}

function openDrawer(id) {
  ++previewRequest;
  document.getElementById("drawer").dataset.itemId=id;
  const i = items.find((x) => x.id === id); if (!i) return;
  const d = document.getElementById("drawer");
  const isWatch = i.type === "watching", isGame = i.type === "game";
  const unit = isWatch ? "Episode" : "Chapter";
  const cur = isWatch ? i.episode || 0 : i.chapter || 0;
  const memberIn = lists.filter((l) => (l.itemIds || []).includes(i.id)).map((l) => l.id);
  d.innerHTML = `
    <div class="drawer-hero">
      <button class="icon-btn drawer-close" id="dr-close" aria-label="${esc(t("close"))}">${I.close}</button>
      <div class="drawer-cover" style="background:${safeColor(i.accent,accentFor(i))}">${coverInner(i, 40)}<button class="change-cover" id="dr-cover" aria-label="${esc(t("changePhoto"))}">${I.image}</button></div>
      <h2 class="drawer-title">${esc(i.title || "Untitled")}</h2>
      <p class="drawer-marker">${esc(marker(i))}${isGame ? "" : " — " + relative(i.activityAt||i.updatedAt)}</p>
    </div>
    <div class="drawer-body">
      ${publicationInformation(i)}
      ${!isGame&&(i.genres?.length||i.catalogTags?.length)?`<div class="section-t">${t("genresLabel")}</div><div class="tags">${[...new Set([...(i.genres||[]),...(i.catalogTags||[])])].filter(x=>typeof x==="string").map(x=>`<span class="tag">${esc(x)}</span>`).join("")}</div>`:""}
      ${Array.isArray(i.authors)&&i.authors.length ? `<div class="section-t">${t("creatorsLabel")}</div><p class="synopsis">${i.authors.filter(x=>typeof x==="string").map(esc).join(" — ")}</p>` : ""}
      ${distinctAlternativeTitles(i).length ? `<div class="section-t">${t("aliasesLabel")}</div><ul class="synopsis">${distinctAlternativeTitles(i).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn" id="dr-refresh-info">${I.refresh} ${t("refreshDetails")}</button><button class="btn" id="dr-home-toggle" aria-pressed="${!!i.homeHidden}">${t(i.homeHidden?"showOnHome":"hideFromHome")}</button></div><p class="field-hint" id="dr-refresh-status" role="status"></p><div id="dr-extra-info"></div>
      ${episodeGuideSlot(i)}
      ${i.synopsis ? `<div class="section-t">${t("synopsis")}</div><p class="synopsis clamp" id="dr-syn">${esc(i.synopsis)}</p><button class="link-btn" id="dr-syn-toggle">${t("showMore")}</button>` : ""}
      ${!isGame && Array.isArray(i.cast) && i.cast.length ? `<div class="section-t">${t("cast")}</div><div class="cast-strip scroll-x">${i.cast.map((c) => `<div class="cast-card"><div class="cast-av"><span class="cast-ph">${esc((c.name || "?")[0].toUpperCase())}</span>${c.image ? `<img src="${esc(c.image)}" alt="" referrerpolicy="no-referrer" loading="lazy" />` : ""}</div><b>${esc(c.name)}</b>${c.character ? `<small>${esc(c.character)}</small>` : ""}${c.role && c.role !== "MAIN" ? `<small>${esc(c.role.toLowerCase())}</small>` : ""}</div>`).join("")}</div>` : ""}
      ${isGame ? `
        <div class="section-t">${t("games")}</div>
        ${Array.isArray(i.genres)&&i.genres.length?`<div class="tags">${i.genres.filter(x=>typeof x==="string").map(x=>`<span class="tag">${esc(x)}</span>`).join("")}</div>`:""}
        <div class="game-meta">${i.platform ? `<span class="meta-pill">${I.game} ${esc(i.platform)}</span>` : ""}${i.releaseDate ? `<span class="meta-pill date">${esc(i.releaseDate)}</span>` : ""}${i.price ? `<span class="meta-pill price" title="${esc(gamePriceNote(i))}">${esc(i.price)}</span>` : ""}</div>
        ${i.price ? `<p class="sub" data-i18n-static>${esc(gamePriceNote(i))}</p>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${embeddedTrailer(i.trailer,i.trailerUrl)}${gameStoreButtons(i)}${gameSourceCredit(i)}<button type="button" class="prereg ${i.preregistered ? "on" : ""}" id="dr-prereg" aria-pressed="${!!i.preregistered}"><span class="box">${i.preregistered ? I.check : ""}</span>${t("preRegistered")}</button></div>`
      : `
        <div class="section-t">${t("progress")}</div>
        <p class="field-hint">${isWatch ? t("progHintWatch") : t("progHintRead")}</p>
        <div class="stepper"><button id="dr-minus" aria-label="−">${I.minus}</button><input id="dr-num" type="number" min="0" value="${cur}" /><button id="dr-plus" aria-label="+">${I.plus}</button><span>${unit}${isWatch && i.season ? ` — Saison ${i.season}` : ""}</span></div>
        <div class="section-t" style="margin-top:14px">${t("totalReleased")}</div>
        <p class="field-hint">${t("totalHint")}</p>
        <div class="released-row"><input id="dr-total" type="number" min="0" value="${i.total || ""}" placeholder="${isWatch ? t("watching") : t("reading")}…" /><span class="rel-hint">${unseen(i) > 0 ? t("unseenN", { n: unseen(i) }) : i.total ? t("upToDate") : ""}</span></div>
        ${episodeGrid(i)}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          ${i.total && unseen(i) > 0 ? `<button class="btn primary" id="dr-markall">${I.check} ${t("markAll")}</button>` : ""}
          ${embeddedTrailer(i.trailerUrl)}
          ${safeNavigationUrl(i.url) ? `<a class="btn" href="${esc(safeNavigationUrl(i.url))}" target="_blank" rel="noreferrer">${I.open} ${t("open")}</a>` : ""}
        </div>`}
      ${isGame ? gameNewsHtml(i)+gameRewardsHtml() : `<div class="section-t">${t("status")}</div>
      <div class="chips-wrap" id="dr-status">${STATUSES.map((s) => `<button class="chip-toggle ${itemState(i) === s ? "on" : ""}" data-status="${s}">${itemState(i) === s ? I.check : ""} ${t(s)}</button>`).join("")}</div>`}
      <div class="section-t">${t("rating")}</div>
      <div class="rate-big" id="dr-rate">${[1,2,3,4,5].map((n) => `<button type="button" data-v="${n}" aria-pressed="${i.rating===n}" aria-label="${esc(t("rating")+" "+n+"/5")}">${I.star.replace('class="ic fill"', `class="ic fill ${n <= (i.rating || 0) ? "on" : ""}"`)}</button>`).join("")}</div>
      <div class="section-t">${t("tags")}</div><div class="tag-edit" id="dr-tags"></div>
      <div class="section-t">${t("lists")}</div>
      <div class="chips-wrap" id="dr-lists">${lists.map((l) => `<button class="chip-toggle ${memberIn.includes(l.id) ? "on" : ""}" data-list="${esc(l.id)}">${memberIn.includes(l.id) ? I.check : I.plus} ${esc(l.name)}</button>`).join("") || `<span style="color:var(--muted);font-size:12px">${t("newList")}…</span>`}</div>
      <div class="section-t">${t("editDetails")}</div>
      <div class="edit-grid">
        <input class="field" id="dr-title" value="${esc(i.title || "")}" placeholder="${t("title")}" />
        <select class="field" id="dr-type">
          <option value="reading" ${i.type === "reading" ? "selected" : ""}>${t("reading")}</option>
          <option value="watching" ${i.type === "watching" ? "selected" : ""}>${t("watching")}</option>
          <option value="game" ${i.type === "game" ? "selected" : ""}>${t("games")}</option>
        </select>
        ${!isGame ? `<input class="field" id="dr-season" type="number" min="0" value="${(isWatch?i.season:i.volume) || ""}" placeholder="${isWatch ? "Season" : "Vol."}" />` : ""}
      </div>
      <div class="section-t">${t("manage")}</div><div class="notification-preferences"><label style="display:flex;gap:8px;align-items:center;margin:12px 0"><input id="dr-notify" type="checkbox" ${i.notifyUpdates!==false?"checked":""}>${settings.lang==="fr"?"Notifications de nouvelles sorties":"New release notifications"}</label>${isGame?`<div class="panel" style="padding:10px 12px"><small>${settings.lang==="fr"?"Choisis précisément les alertes reçues pour ce jeu.":"Choose exactly which alerts you receive for this game."}</small><label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input id="dr-notify-game-updates" type="checkbox" ${i.notifyGameUpdates!==false?"checked":""}>${settings.lang==="fr"?"Mises à jour et patch notes":"Updates and patch notes"}</label><label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input id="dr-notify-game-events" type="checkbox" ${i.notifyGameEvents!==false?"checked":""}>${settings.lang==="fr"?"Événements et annonces":"Events and announcements"}</label><label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input id="dr-notify-game-rewards" type="checkbox" ${i.notifyGameRewards!==false?"checked":""}>${settings.lang==="fr"?"Codes et récompenses":"Codes and rewards"}</label></div>`:""}</div><button class="btn danger" id="dr-remove">${I.trash} ${t("removeLib")}</button>
    </div>`;
  document.getElementById("scrim").classList.add("open");
  d.classList.add("open");focusDrawer();
  wireDrawer(i, isWatch, isGame);
  mountEpisodeGuide(i);
  enhanceCarousels("#drawer");
  // Do not let automatic metadata replace a newer edit or a different drawer.
  if (isGame && !i.gameEnrichedAt && (i.externalIds?.rawg || /store\.steampowered\.com\/app\//.test(i.url || ""))) {
    void enrichOpenGame(i,previewRequest);
  }
}
const pendingGameDetails=new Set();
async function enrichOpenGame(item,requestVersion) {
  if(pendingGameDetails.has(item.id))return;
  pendingGameDetails.add(item.id);
  try{
    const response=await new Promise(resolve=>requestMetadata({type:"GAME_ENRICH",id:item.id},resolve));
    const drawer=document.getElementById("drawer");
    const current=()=>drawer.classList.contains("open")&&drawer.dataset.itemId===item.id&&previewRequest===requestVersion;
    const result=response?.item;
    if(!response?.ok||result?.id!==item.id||result.type!=="game"||!result.gameEnrichedAt){
      if(current()){const status=document.getElementById("dr-refresh-status");if(status)status.textContent=t("refreshFailed");}
      return;
    }
    const index=items.findIndex(value=>value.id===item.id);
    // Storage refreshes and confirmed edits replace the object; keep that newer state.
    if(index<0||items[index]!==item)return;
    items[index]=result;
    const editing=drawer.contains(document.activeElement)&&document.activeElement.matches("input,textarea,select,[contenteditable=true]");
    if(current()&&!editing)openDrawer(item.id);
  }finally{pendingGameDetails.delete(item.id);}
}

// A grid of episode/chapter cells: filled = seen (<= current), empty = unseen.
// Clicking cell N sets your current position to N. Hidden when total is unknown
// or too large to render as a grid (the stepper still covers those).
function episodeGrid(i) {
  const total = i.total || 0;
  if (!total || total > 300) return "";
  const cur = currentNum(i);
  let cells = "";
  for (let n = 1; n <= total; n++) cells += `<button class="ep ${n <= cur ? "seen" : ""}" data-ep="${n}">${n}</button>`;
  return `<div class="ep-grid" id="dr-eps">${cells}</div>`;
}
async function saveDrawerAction(item,patch,control,selector) {
  if(control.disabled)return false;
  const focused=document.activeElement===control;
  const controls=[...document.querySelectorAll(selector)];
  controls.forEach(node=>{node.disabled=true;node.setAttribute("aria-busy","true");});
  const saved=await update(item.id,patch);
  controls.forEach(node=>{if(node.isConnected){node.disabled=false;node.removeAttribute("aria-busy");}});
  const drawer=document.getElementById("drawer");
  if(focused&&drawer.classList.contains("open")&&drawer.dataset.itemId===item.id){
    const replacement=control.id?document.getElementById(control.id):
      [...drawer.querySelectorAll(selector)].find(node=>node.dataset.status===control.dataset.status);
    replacement?.focus({preventScroll:true});
  }
  return saved;
}
function bindDrawerNumber(item,input,makePatch,label,related=[]) {
  if(!input)return;
  input.setAttribute("aria-label",label);
  const status=document.createElement("small");status.id=input.id+"-status";status.setAttribute("role","status");status.style.display="block";
  input.setAttribute("aria-describedby",status.id);
  const retry=document.createElement("button");retry.type="button";retry.className="btn";retry.id=input.id+"-retry";retry.hidden=true;retry.textContent=settings.lang==="fr"?"Réessayer":"Retry";
  const container=input.closest(".stepper,.released-row");
  (container||input).after(status,retry);
  let saving=false;
  const save=async raw=>{
    if(saving)return;
    input.value=String(raw);
    const number=Number(raw);
    if(!Number.isFinite(number)||input.validity.badInput){
      input.setAttribute("aria-invalid","true");status.textContent=settings.lang==="fr"?"Saisis un nombre valide.":"Enter a valid number.";return;
    }
    const value=Math.max(0,Math.round(number)),patch=makePatch(value);
    saving=true;const controls=[input,retry,...related].filter(Boolean);
    controls.forEach(node=>{node.disabled=true;});
    status.textContent=settings.lang==="fr"?"Enregistrement…":"Saving…";
    const saved=await update(item.id,patch,{retainDraft:true});
    saving=false;
    if(!input.isConnected)return;
    controls.forEach(node=>{node.disabled=false;});
    if(!saved){input.setAttribute("aria-invalid","true");retry.hidden=false;status.textContent=settings.lang==="fr"?"Enregistrement non confirmé. Ta saisie est conservée ici.":"Save not confirmed. Your entry is kept here.";}
  };
  input.onchange=()=>save(input.value);
  input.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();void save(input.value);}};
  retry.onclick=()=>save(input.value);
  return save;
}
function wireDrawer(i, isWatch, isGame) {
  document.getElementById("dr-close").onclick = closeDrawer;
    document.getElementById("dr-notify").onchange=e=>saveDrawerAction(i,{notifyUpdates:e.target.checked},e.currentTarget,"#dr-notify");
  if(isGame){
    document.getElementById("dr-notify-game-updates").onchange=e=>saveDrawerAction(i,{notifyGameUpdates:e.target.checked},e.currentTarget,"#dr-notify-game-updates");
    document.getElementById("dr-notify-game-events").onchange=e=>saveDrawerAction(i,{notifyGameEvents:e.target.checked},e.currentTarget,"#dr-notify-game-events");
    document.getElementById("dr-notify-game-rewards").onchange=e=>saveDrawerAction(i,{notifyGameRewards:e.target.checked},e.currentTarget,"#dr-notify-game-rewards");
  }
  document.getElementById("dr-home-toggle").onclick=e=>saveDrawerAction(i,{homeHidden:!i.homeHidden},e.currentTarget,"#dr-home-toggle");
  document.getElementById("dr-refresh-info").onclick=async e=>{
    const button=e.currentTarget,status=document.getElementById("dr-refresh-status");
    if(button.disabled)return;
    const beforeItems=[...items],beforeLists=lists;
    button.disabled=true;status.textContent=t("refreshLoading");
    const r=await new Promise(resolve=>requestMetadata({type:isGame?"GAME_ENRICH":"COMPLETE_ITEM_METADATA",id:i.id,force:true},resolve));
    const drawer=document.getElementById("drawer");
    if(!drawer.classList.contains("open")||drawer.dataset.itemId!==i.id||!button.isConnected)return;
    button.disabled=false;
    if(!r?.ok){status.textContent=t("refreshFailed");return;}
    if(!r.item||(!r.matched&&!["matched","partial"].includes(r.status))){status.textContent=t("refreshNone");return;}
    const merged=r.mergedIds??[];
    const validMerge=Array.isArray(merged)&&merged.every(id=>typeof id==="string");
    const target=items.find(item=>item.id===r.item.id);
    if(!validMerge||r.item.type!==i.type||!target||(r.item.id!==i.id&&!merged.includes(i.id))||merged.includes(r.item.id)||(r.lists!==undefined&&!Array.isArray(r.lists))){
      status.textContent=t("refreshFailed");return;
    }
    const changed=items.length!==beforeItems.length||items.some((item,index)=>item!==beforeItems[index])||lists!==beforeLists;
    const editing=[...drawer.querySelectorAll("input,textarea,select")].some(control=>{
      if(control===document.activeElement)return true;
      if(control.tagName==="SELECT")return [...control.options].some(option=>option.selected!==option.defaultSelected);
      if(control.type==="checkbox"||control.type==="radio")return control.checked!==control.defaultChecked;
      return control.value!==control.defaultValue;
    });
    if(changed||editing){status.textContent=t("refreshDeferred");return;}
    const removed=new Set(merged);
    items=items.filter(item=>!removed.has(item.id)).map(item=>item.id===r.item.id?r.item:item);
    if(r.lists)lists=r.lists;
    renderAll();openDrawer(r.item.id);
    document.getElementById("dr-refresh-status").textContent=t(r.status==="partial"?"refreshPartial":"refreshDone");
    document.getElementById("dr-refresh-info").focus({preventScroll:true});
  };
  const syn = document.getElementById("dr-syn"), synT = document.getElementById("dr-syn-toggle");
  if (synT) synT.onclick = () => { syn.classList.toggle("clamp"); synT.textContent = syn.classList.contains("clamp") ? t("showMore") : t("showLess"); };
  if (!isGame) {
    const num = document.getElementById("dr-num");
    const key = isWatch ? "episode" : "chapter", latestKey = isWatch ? "latestEpisode" : "latestChapter";
    if (i.total) num.max = i.total; // real limit — can't go past what exists
    const minus=document.getElementById("dr-minus"),plus=document.getElementById("dr-plus"),markall=document.getElementById("dr-markall");
    const episodeButtons=[...document.querySelectorAll("#dr-eps [data-ep]")];
    const setNum=bindDrawerNumber(i,num,value=>{
      const n=i.total?Math.min(value,i.total):value;
      return {[key]:n||undefined,[latestKey]:Math.max(i[latestKey]||0,n)||undefined};
    },t("progress"),[minus,plus,markall,...episodeButtons]);
    minus.onclick=()=>setNum((Number(num.value)||0)-1);
    plus.onclick=()=>setNum((Number(num.value)||0)+1);
    episodeButtons.forEach(button=>button.onclick=()=>setNum(Number(button.dataset.ep)));
    if(markall)markall.onclick=()=>setNum(i.total||currentNum(i));
    bindDrawerNumber(i,document.getElementById("dr-total"),value=>({total:value||undefined}),t("totalReleased"));

  } else {
    document.getElementById("dr-prereg").onclick = async e => {
      const button=e.currentTarget;if(button.disabled)return;const focused=document.activeElement===button;button.disabled=true;
      await update(i.id,{preregistered:!i.preregistered});
      const drawer=document.getElementById("drawer");
      if(focused&&drawer.classList.contains("open")&&drawer.dataset.itemId===i.id)document.getElementById("dr-prereg")?.focus({preventScroll:true});
    };
  }
  document.getElementById("dr-cover").onclick = () => changeCover(async (v) => { const saved=await update(i.id, { coverOverride: v }); if(saved)openDrawer(i.id); return saved; });
  document.querySelectorAll("#dr-rate button").forEach(button=>button.onclick=async()=>{
    if(button.disabled)return;
    const v=Number(button.dataset.v),hadFocus=document.activeElement===button;
    document.querySelectorAll("#dr-rate button").forEach(control=>control.disabled=true);
    await update(i.id,{rating:i.rating===v?0:v});
    const drawer=document.getElementById("drawer");
    if(hadFocus&&drawer.classList.contains("open")&&drawer.dataset.itemId===i.id)drawer.querySelector('#dr-rate button[data-v="'+v+'"]')?.focus({preventScroll:true});
  });
  document.querySelectorAll("#dr-status [data-status]").forEach((b) => (b.onclick = () => {
    const s = b.dataset.status; const patch = { state: s };
    if (s === "completed") { patch.progress = 100; patch.status = "completed"; }
    else if (s === "planned") { patch.progress = 0; patch.status = "in_progress"; }
    else patch.status = "in_progress";
    void saveDrawerAction(i,patch,b,"#dr-status [data-status]");
  }));
  if(!i.cast?.length && (i.anilistId||i.externalIds?.anilist||i.externalIds?.tvmaze)) {
    requestMetadata({type:"CATALOG_DETAIL",item:i},response=>{
      if(api.runtime.lastError||!response?.ok||document.getElementById("drawer").dataset.itemId!==i.id)return;
      const extra=document.getElementById("dr-extra-info");
      if(extra)extra.innerHTML=catalogInformation({...response.item,releaseStatus:undefined,synopsis:undefined,authors:[],alternativeTitles:[]});
    });
  }
  renderDrawerTags(i);
  document.querySelectorAll("#dr-lists [data-list]").forEach((b) => (b.onclick = () => { const l = lists.find((x) => x.id === b.dataset.list); if (!l) return; const has = (l.itemIds || []).includes(i.id); b.disabled=true;changeListMembership(l.id,i.id,!has,true).finally(()=>{if(b.isConnected)b.disabled=false;}); }));
  const titleEl = document.getElementById("dr-title");
  if (titleEl) {
    titleEl.setAttribute("aria-label",t("title"));
    titleEl.setAttribute("aria-describedby","dr-title-status");
    const status=document.createElement("small");status.id="dr-title-status";status.setAttribute("role","status");status.style.display="block";
    const retry=document.createElement("button");retry.type="button";retry.id="dr-title-retry";retry.className="btn";retry.hidden=true;retry.textContent=settings.lang==="fr"?"Réessayer":"Retry";
    titleEl.after(status,retry);
    let saving=false;
    const saveTitle=async()=>{
      if(saving)return;
      const value=titleEl.value.trim();
      if(!value){titleEl.setAttribute("aria-invalid","true");status.textContent=settings.lang==="fr"?"Le titre ne peut pas être vide.":"Title cannot be empty.";retry.hidden=true;return;}
      if(value===i.title){titleEl.removeAttribute("aria-invalid");status.textContent="";retry.hidden=true;return;}
      saving=true;titleEl.disabled=true;retry.disabled=true;
      status.textContent=settings.lang==="fr"?"Enregistrement…":"Saving…";
      const saved=await update(i.id,{title:value},{retainDraft:true});
      saving=false;
      if(!titleEl.isConnected)return;
      titleEl.disabled=false;retry.disabled=false;
      if(!saved){
        titleEl.setAttribute("aria-invalid","true");retry.hidden=false;
        status.textContent=settings.lang==="fr"?"Enregistrement non confirmé. Ton titre reste ici pour réessayer.":"Save not confirmed. Your title remains here so you can retry.";
      }
    };
    titleEl.onchange=saveTitle;
    titleEl.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();void saveTitle();}};
    retry.onclick=saveTitle;
  }
  const typeEl = document.getElementById("dr-type");
  if (typeEl) typeEl.onchange = () => saveDrawerAction(i,{type:typeEl.value},typeEl,"#dr-type");
  const seasonEl = document.getElementById("dr-season");
  bindDrawerNumber(i,seasonEl,value=>isWatch?{season:value||undefined}:{volume:value||undefined},isWatch?(settings.lang==="fr"?"Saison":"Season"):(settings.lang==="fr"?"Volume":"Volume"));
  const removeButton=document.getElementById("dr-remove");
  removeButton.onclick = () => {
    if(removeButton.disabled || !confirm(`${t("removeLib")}?`))return;
    removeButton.disabled=true;removeButton.setAttribute("aria-busy","true");
    requestMetadata({type:"REMOVE_ITEM",id:i.id},r=>{
      removeButton.disabled=false;removeButton.removeAttribute("aria-busy");
      if(api.runtime.lastError || r?.ok===false || !Array.isArray(r?.items)){
        toast(settings.lang==="fr"?"Suppression non confirmée. Vérifie ta bibliothèque avant de réessayer.":"Removal not confirmed. Check your library before retrying.");
        return;
      }
      items=r.items;
      if(document.getElementById("drawer").dataset.itemId===i.id)closeDrawer();
      renderAll();
    });
  };
}
function renderDrawerTags(i) {
  const wrap = document.getElementById("dr-tags");
  wrap.innerHTML = (i.tags || []).map((x) => `<span class="tag">${esc(x)} <button type="button" class="rm" data-rm="${esc(x)}" aria-label="${esc(t("delete")+": "+x)}" style="border:0;background:transparent;color:inherit;font:inherit;padding:0 2px;cursor:pointer">✕</button></span>`).join("") + `<button class="tag-add" id="dr-addtag">+ ${t("tags")}</button>`;
  wrap.querySelectorAll("[data-rm]").forEach(button=>button.onclick=async()=>{
    if(button.disabled)return;
    const focused=document.activeElement===button,tag=button.dataset.rm;
    const controls=[...wrap.querySelectorAll("button")],index=controls.indexOf(button);
    controls.forEach(control=>control.disabled=true);
    const saved=await update(i.id,{tags:(i.tags||[]).filter(value=>value!==tag)});
    const drawer=document.getElementById("drawer");
    if(focused&&drawer.classList.contains("open")&&drawer.dataset.itemId===i.id){
      const remaining=[...document.querySelectorAll("#dr-tags [data-rm]")];
      const target=saved?(remaining[index]||document.getElementById("dr-addtag")):remaining.find(control=>control.dataset.rm===tag);
      target?.focus({preventScroll:true});
    }
  });
  document.getElementById("dr-addtag").onclick = () => { const tg = (prompt(t("tags")) || "").trim(); if (tg) update(i.id, { tags: [...new Set([...(i.tags || []), tg])] }); };
}
let drawerReturnFocus=null;
function focusDrawer() {
  const panel=document.getElementById("drawer");
  if(panel.inert){drawerReturnFocus=document.activeElement;panel.inert=false;}
  panel.setAttribute("aria-label",settings.lang==="fr"?"Détails de l’œuvre":"Work details");
  queueMicrotask(()=>{if(panel.classList.contains("open")&&!panel.contains(document.activeElement))(panel.querySelector("button,input,select,textarea,a[href]")||panel).focus();});
}
function closeDrawer() { const panel=document.getElementById("drawer"),wasOpen=panel.classList.contains("open");panel.inert=true;if(wasOpen&&drawerReturnFocus?.isConnected)drawerReturnFocus.focus(); previewRequest++; document.querySelectorAll("#drawer iframe").forEach(el=>el.remove()); document.querySelectorAll("#drawer video").forEach(el=>el.pause()); document.getElementById("scrim").classList.remove("open"); document.getElementById("drawer").classList.remove("open"); }
/* ---- image cropper (upload — zoom — reposition), Discord-style ---- */
// Aspect-aware cropper. The view IS the output shape, so the user sees exactly
// what will be visible (YouTube-style for the wide banner).
let CV_W = 280, CV_H = 280, CT_W = 512, CT_H = 512;
let cropState = null; // { img, zoom, ox, oy, onSave, shape }
function openCropper({ shape = "square", onSave, initial, title, allowClear = false }) {
  cropState = { img: null, zoom: 1, ox: 0, oy: 0, onSave, shape };
  if (shape === "banner") { CV_W = Math.min(460, Math.floor(innerWidth * .94 - 44)); CV_H = Math.round(CV_W / 3); CT_W = 1200; CT_H = 400; }
  else { CV_W = Math.min(280, Math.floor(innerWidth * .94 - 44)); CV_H = CV_W; CT_W = 512; CT_H = 512; }
  const view = document.getElementById("crop-view");
  view.classList.toggle("circle", shape === "circle");
  view.style.width = CV_W + "px"; view.style.height = CV_H + "px";
  const canvas = document.getElementById("crop-canvas");
  canvas.width = CV_W; canvas.height = CV_H; canvas.style.width = CV_W + "px"; canvas.style.height = CV_H + "px";
  document.getElementById("crop-title").textContent = title || "Adjust image";
  document.getElementById("crop-hint").textContent = "Drag to reposition — scroll or use the slider to zoom";
  document.getElementById("crop-zoom").value = 1;
  document.getElementById("crop-scrim").classList.add("open");
  document.getElementById("cropper").classList.add("open");
  document.getElementById("crop-save").disabled = true;
  document.getElementById("crop-remove").hidden = !allowClear;
  document.getElementById("crop-url-row").hidden = !allowClear;
  document.getElementById("crop-url").value = "";
  ["crop-remove","crop-use-url","crop-file","crop-zoom"].forEach(id=>document.getElementById(id).disabled=false);
  clearCanvas();
  if (initial) loadCropImage(initial); else document.getElementById("crop-input").click();
}
function closeCropper() {
  document.getElementById("crop-scrim").classList.remove("open");
  document.getElementById("cropper").classList.remove("open");
  cropState = null;
}
function clearCanvas() {
  const c = document.getElementById("crop-canvas"), x = c.getContext("2d");
  x.clearRect(0, 0, CV_W, CV_H); x.fillStyle = "#F0EEF6"; x.fillRect(0, 0, CV_W, CV_H);
}
function loadCropImage(src) {
  const state = cropState;
  if (!state || state.saving) return;
  state.fileRequest=(state.fileRequest||0)+1;
  const request=state.imageRequest=(state.imageRequest||0)+1;
  state.img=null;clearCanvas();document.getElementById("crop-save").disabled=true;
  const img = new Image();
  img.onload = () => {
    if (cropState !== state || state.imageRequest!==request) return;
    document.getElementById("crop-save").disabled = false;
    const cover = Math.max(CT_W / img.naturalWidth, CT_H / img.naturalHeight);
    cropState.img = img; cropState.cover = cover; cropState.zoom = 1;
    const dw = img.naturalWidth * cover, dh = img.naturalHeight * cover;
    cropState.ox = (CT_W - dw) / 2; cropState.oy = (CT_H - dh) / 2;
    document.getElementById("crop-zoom").value = 1;
    drawCrop();
  };
  img.onerror = () => { if(cropState === state && state.imageRequest===request) document.getElementById("crop-hint").textContent = "This image could not be loaded. Choose another file."; };
  img.src = src;
}
function cropDims() { const s = cropState.cover * cropState.zoom; return { dw: cropState.img.naturalWidth * s, dh: cropState.img.naturalHeight * s }; }
function clampCrop() { const { dw, dh } = cropDims(); cropState.ox = Math.min(0, Math.max(CT_W - dw, cropState.ox)); cropState.oy = Math.min(0, Math.max(CT_H - dh, cropState.oy)); }
function drawCrop() {
  if (!cropState || !cropState.img) return;
  clampCrop();
  const c = document.getElementById("crop-canvas"), x = c.getContext("2d");
  const rx = CV_W / CT_W, ry = CV_H / CT_H, { dw, dh } = cropDims();
  x.clearRect(0, 0, CV_W, CV_H);
  x.drawImage(cropState.img, cropState.ox * rx, cropState.oy * ry, dw * rx, dh * ry);
}
function exportCrop() {
  const c = document.createElement("canvas"); c.width = CT_W; c.height = CT_H;
  const x = c.getContext("2d"); const { dw, dh } = cropDims();
  x.fillStyle = "#fff"; x.fillRect(0, 0, CT_W, CT_H);
  x.drawImage(cropState.img, cropState.ox, cropState.oy, dw, dh);
  return c.toDataURL("image/jpeg", 0.86);
}
(function wireCropper() {
  const view = document.getElementById("crop-view");
  let drag = null;
  const down = (e) => { if (!cropState || !cropState.img) return; const pt = e.touches ? e.touches[0] : e; drag = { x: pt.clientX, y: pt.clientY }; };
  const move = (e) => {
    if (!drag || !cropState || !cropState.img) return;
    const pt = e.touches ? e.touches[0] : e; const bounds = view.getBoundingClientRect(); const rx = CT_W / bounds.width, ry = CT_H / bounds.height;
    cropState.ox += (pt.clientX - drag.x) * rx; cropState.oy += (pt.clientY - drag.y) * ry;
    drag = { x: pt.clientX, y: pt.clientY }; drawCrop(); if (e.cancelable) e.preventDefault();
  };
  const up = () => (drag = null);
  view.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  view.addEventListener("touchstart", down, { passive: true }); view.addEventListener("touchmove", move, { passive: false }); view.addEventListener("touchend", up);
  const zoomAt = (value, x = CT_W / 2, y = CT_H / 2) => {
    if (!cropState?.img) return;
    const before = cropDims(), fx = (x - cropState.ox) / before.dw, fy = (y - cropState.oy) / before.dh;
    cropState.zoom = Math.min(3, Math.max(1, value));
    const after = cropDims();
    cropState.ox = x - fx * after.dw; cropState.oy = y - fy * after.dh;
    document.getElementById("crop-zoom").value = cropState.zoom;
    drawCrop();
  };
  document.getElementById("crop-zoom").addEventListener("input", e => zoomAt(Number(e.target.value)));
  view.addEventListener("wheel", e => {
    if (!cropState?.img) return;
    e.preventDefault();
    const r = view.getBoundingClientRect();
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1);
    zoomAt(cropState.zoom * Math.exp(-Math.max(-200,Math.min(200,delta)) * .002), (e.clientX-r.left)/r.width*CT_W, (e.clientY-r.top)/r.height*CT_H);
  }, {passive:false});
  document.getElementById("crop-file").onclick = () => document.getElementById("crop-input").click();
  document.getElementById("crop-input").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f || !cropState || cropState.saving) return;
    const state=cropState,selection=state.fileRequest=(state.fileRequest||0)+1;
    state.imageRequest=(state.imageRequest||0)+1;
    state.img=null;clearCanvas();document.getElementById("crop-save").disabled=true;
    const current=()=>cropState===state&&state.fileRequest===selection;
    const failed=()=>{
      if(!current())return;
      document.getElementById("crop-hint").textContent=settings.lang==="fr"?"Impossible de lire cette image. Choisis un autre fichier.":"Could not read this image. Choose another file.";
    };
    const rd = new FileReader();
    rd.onload = () => {if(current())loadCropImage(String(rd.result));};
    rd.onerror=failed;rd.onabort=failed;
    try{rd.readAsDataURL(f);}catch{failed();}
  });
  document.getElementById("crop-cancel").onclick = closeCropper;
  const commitCrop = async (clear, imageUrl) => {
    const state=cropState;
    if(!state?.onSave || state.saving || (!clear && !imageUrl && !state.img))return;
    state.saving=true;
    const controls=["crop-save","crop-remove","crop-use-url","crop-file","crop-zoom"].map(id=>document.getElementById(id));
    const previous=controls.map(control=>control.disabled);
    controls.forEach(control=>control.disabled=true);
    const button=document.getElementById("crop-save");
    try {
      const saved=await state.onSave(imageUrl || (clear?"":exportCrop()));
      if(cropState!==state)return;
      if(saved===false){document.getElementById("crop-hint").textContent=settings.lang==="fr"?"Enregistrement non confirmé. Ton cadrage est conservé, tu peux réessayer.":"Save not confirmed. Your crop is retained; you can retry.";return;}
      closeCropper();
    }catch{
      if(cropState!==state)return;
      document.getElementById("crop-hint").textContent="Could not save this image. Try another image.";
      button.disabled=!state.img;
    }finally{
      state.saving=false;
      if(cropState===state){controls.forEach((control,index)=>control.disabled=previous[index]);button.disabled=!state.img;}
    }
  };
  document.getElementById("crop-save").onclick=()=>commitCrop(false);
  document.getElementById("crop-remove").onclick=()=>commitCrop(true);
  document.getElementById("crop-use-url").onclick=()=>{
    const input=document.getElementById("crop-url");
    try {const url=new URL(input.value.trim());if(!["https:","http:"].includes(url.protocol))throw Error();input.setCustomValidity("");commitCrop(false,url.href);}
    catch{input.setCustomValidity("Enter a valid https:// image URL.");input.reportValidity();}
  };
  document.getElementById("crop-url").oninput=e=>e.target.setCustomValidity("");
})();

function changeCover(apply, shape) {
  openCropper({shape:shape||"square",title:t("cover"),onSave:apply,allowClear:true});
}

/* ================= SETTINGS ================= */
function renderSettings() {
  const el = document.getElementById("view-settings");
  const p = settings.profile || {};
  el.innerHTML = `
    <h1>${t("settings")}</h1><p class="sub">${t("editProfile")} — ${t("newAlerts")} — ${t("backup")}</p>
    <div class="section-t">${t("editProfile")}</div>
    <div class="panel"><div class="row">
      <div class="avatar-lg" id="set-avatar">${p.avatar ? `<img src="${esc(p.avatar)}">` : esc(initials(p.name))}</div>
      <div class="grow"><input class="field" id="set-name" aria-describedby="set-name-status" aria-label="${esc(t("displayName"))}" placeholder="${t("displayName")}" value="${esc(p.name || "")}" style="max-width:280px" /><small id="set-name-status" role="status"></small><button type="button" class="link-btn" id="set-name-retry" hidden>${t("retryLabel")}</button></div>
      <button class="btn" id="set-photo">${I.image} ${t("changePhoto")}</button>
    </div></div>
    <div class="section-t">${t("account")}</div>
    <div class="panel" id="account-panel"></div>
    <div class="section-t">${t("language")}</div>
    <div class="panel">
      <div class="row"><div class="grow"><b>${t("uiLanguage")}</b></div>
        <select class="field" id="set-uilang" aria-label="${esc(t("uiLanguage"))}" style="max-width:200px">${Object.entries(LANGS).map(([c, L]) => `<option value="${c}" ${settings.lang === c ? "selected" : ""}>${esc(L.name)}</option>`).join("")}</select></div>
      <div class="row"><div class="grow"><b>${t("translateLanguage")}</b></div>
        <select class="field" id="set-trlang" aria-label="${esc(t("translateLanguage"))}" style="max-width:200px">${TR_LANGS.map(([c, n]) => `<option value="${c}" ${(settings.translateLang || "en") === c ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
    </div>
    <div class="section-t">${t("newAlerts")}</div>
    <div class="panel"><div class="row"><div class="grow"><b>${t("newAlerts")}</b><small>${t("newAlertsSub")}</small></div><button class="switch ${settings.notifyNew ? "on" : ""}" id="sw-notify" role="switch" aria-label="${esc(t("newAlerts"))}" aria-checked="${!!settings.notifyNew}"></button></div></div>
    <div class="panel"><div class="row"><div class="grow"><b>${settings.lang==='fr'?'Suivi automatique des vidéos enregistrées':'Automatically track saved videos'}</b><small>${settings.lang==='fr'?'Après ouverture de Yomu sur le lecteur, conserve la progression pendant la lecture.':'After opening Yomu on the player, keep progress updated while watching.'}</small></div><input id="set-autotrack" type="checkbox" aria-label="${settings.lang==='fr'?'Suivi automatique':'Automatic tracking'}" ${settings.autoTrack!==false?'checked':''}></div></div>
    <div class="section-t">${t("backup")}</div>
    <div class="panel">
      <div class="row"><div class="grow"><b>${t("yourLibrary")}</b><small>${t("exportRestore")} ${settings.lang==="fr"?"Les clés API restent sur cet appareil.":"API keys stay on this device."}</small></div><button class="btn" id="export">${I.image} ${t("export")}</button><button class="btn" id="import">${t("import")}</button><input id="file" type="file" accept=".json,.csv,.xml,.zip,.tsv,application/json,application/zip" multiple hidden aria-label="${t("import")}" /></div>
      <p class="field-hint" style="margin:-2px 2px 0">${t("importFormats")}</p>
      <div class="row"><div class="grow"><b>${settings.lang === "fr" ? "Compléter les fiches" : "Complete missing details"}</b><small id="metadata-status" role="status">${settings.lang === "fr" ? "Rechercher les affiches et descriptions manquantes et regrouper les doublons confirmés." : "Find missing artwork and descriptions and combine confirmed duplicates."}</small></div><button class="btn" id="complete-metadata">${I.refresh} ${settings.lang === "fr" ? "Rechercher" : "Search"}</button></div>
      <div class="row"><div class="grow"><b>${t("cloudSync")}</b><small id="sync-state">${t("cloudSyncSub")}</small></div><button class="btn" id="sync-link">${t("manageSync")}</button></div>
    </div>
    <div class="section-t">${t("enjoying")}</div>
    <div class="panel">
      <div class="row" style="flex-wrap:wrap"><div class="grow"><b>${t("rateShare")}</b><small>${t("rateShareSub")}</small></div><div class="rate-big" id="rate-store"></div></div>
      <div class="row"><div class="grow"><b>${t("spread")}</b></div><div class="share-row" id="share"></div></div>
    </div>
    <div class="section-t">${t("imgTranslate")}</div>
    <div class="panel">
      <div class="row" style="align-items:flex-start"><div class="grow"><b>${t("imgTranslate")}</b><small>${t("imgTranslateSub")}</small></div><span class="ok-pill">${I.check} ${t("imgOn")}</span></div>
    </div>`;
  wireSettings();
  renderMetadataStatus();
}
async function saveSettingControl(key,value,control,paint) {
  if(control.disabled)return;
  control.disabled=true;
  const response=await new Promise(resolve=>requestMetadata({type:"SET_SETTINGS",patch:{[key]:value}},resolve));
  const saved=response?.ok!==false&&response?.settings&&Object.hasOwn(response.settings,key);
  if(saved)settings={...settings,[key]:response.settings[key]};
  if(control.isConnected){paint(settings[key]);control.disabled=false;}
  if(!saved)toast(settings.lang==="fr"?"Enregistrement non confirmé. Vérifie le réglage avant de réessayer.":"Save not confirmed. Check the setting before retrying.");
  return !!saved;
}
function wireSettings() {
  paintImportPending();
  const nameEl = document.getElementById("set-name");
  const saveProfile = patch => saveProfilePatch(patch).then(saved=>{if(saved&&view==="settings")renderSettings();return saved;});
  const retryName=document.getElementById("set-name-retry"),nameStatus=document.getElementById("set-name-status");
  const saveName=async()=>{
    if(nameEl.disabled)return;
    const draft=nameEl.value.trim();
    nameEl.disabled=true;retryName.hidden=true;nameStatus.textContent="";
    const saved=await saveProfilePatch({name:draft});
    if(!nameEl.isConnected)return;
    nameEl.disabled=false;nameEl.setAttribute("aria-invalid",String(!saved));
    if(saved){nameEl.value=settings.profile?.name||"";nameStatus.textContent=settings.lang==="fr"?"Nom enregistré.":"Name saved.";}
    else {retryName.hidden=false;nameStatus.textContent=settings.lang==="fr"?"Enregistrement non confirmé. Ton texte est conservé ici.":"Save not confirmed. Your text is kept here.";}
  };
  nameEl.onchange=saveName;retryName.onclick=saveName;
  const pickPhoto = () => openCropper({ shape: "circle", title: t("changePhoto"), initial:settings.profile?.avatar, onSave: data => saveProfile({avatar:data}) });
  document.getElementById("set-photo").onclick = pickPhoto;
  document.getElementById("set-avatar").onclick = pickPhoto;
  const notification=document.getElementById("sw-notify");
  notification.onclick=()=>saveSettingControl("notifyNew",!settings.notifyNew,notification,paint=>{
    notification.classList.toggle("on",!!paint);notification.setAttribute("aria-checked",String(!!paint));
  });
  document.getElementById("set-autotrack").onchange=e=>{
    const input=e.currentTarget;
    saveSettingControl("autoTrack",input.checked,input,value=>{input.checked=value!==false;});
  };
  const uilang = document.getElementById("set-uilang");
  uilang.onchange = () => {void applyLanguage(uilang.value);};
  paintLanguageSaving();
  const trlang = document.getElementById("set-trlang");
  trlang.onchange = () => saveSettingControl("translateLang",trlang.value,trlang,value=>{trlang.value=value||"en";});
  renderAccountPanel();
  document.getElementById("complete-metadata").onclick = completeMissingMetadata;
  document.getElementById("export").onclick = doExport;
  document.getElementById("import").onclick = () => document.getElementById("file").click();
  document.getElementById("file").addEventListener("change", doImport);
  document.getElementById("sync-link").onclick = () => api.runtime.openOptionsPage();
  buildShare(document.getElementById("share"));
  buildRateStore(document.getElementById("rate-store"));
  api.runtime.sendMessage({ type: "SYNC_STATUS" }, (s) => { void api.runtime.lastError; userPlan = (s && s.plan) || null; const el = document.getElementById("sync-state"); if (s && el) el.textContent = backupLabel(s,settings.lang); });
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


let backupRefreshTimer=null;
function refreshBackupLabels() {
  if(!document.getElementById("sync-state")&&!document.getElementById("account-backup-state"))return;
  api.runtime.sendMessage({type:"SYNC_STATUS"},s=>{
    if(api.runtime.lastError||!s)return;
    for(const id of ["sync-state","account-backup-state"]) {
      const el=document.getElementById(id);
      if(el)el.textContent=backupLabel(s,settings.lang);
    }
  });
}
api.storage.onChanged.addListener((changes,area)=>{
  if(area!=="local"||!Object.keys(changes).some(key=>["dasi.items","dasi.lists","dasi.sites","dasi.notifications","dasi.settings","yomu.tombstones.v1","dasi.sync.meta","dasi.sync.config"].includes(key)))return;
  clearTimeout(backupRefreshTimer);
  backupRefreshTimer=setTimeout(refreshBackupLabels,120);
});

function renderAccountPanel() {
  const el = document.getElementById("account-panel");
  if (!el) return;
  api.runtime.sendMessage({ type: "SYNC_STATUS" }, (s) => {
    void api.runtime.lastError;
    if(!el.isConnected)return;
    userPlan = (s && s.plan) || userPlan;
    if (!s || !s.configured) {
      el.innerHTML = `<div class="row"><div class="grow"><b>${t("notSignedIn")}</b><small>${t("cloudSyncSub")}</small></div><button class="btn primary" id="acc-signin">${t("manageSync")}</button></div>`;
      document.getElementById("acc-signin").onclick = () => api.runtime.openOptionsPage();
      return;
    }
    el.innerHTML = `
      <div class="row"><div class="grow"><b>${esc(s.email || "")}</b><small>${t("signedInAs")} — ${esc(s.plan || "free")}</small><small role="status" id="account-backup-state">${esc(backupLabel(s,settings.lang))}</small></div><button class="btn" id="acc-manage">${t("manageSync")}</button></div>
      <div class="row" style="flex-wrap:wrap;gap:8px"><div class="grow"><b>${t("changeEmail")}</b></div><input class="field" id="acc-email" type="email" placeholder="new@email.com" style="max-width:200px" /><input class="field" id="acc-email-current" type="password" autocomplete="current-password" placeholder="${t("currentPassword")}" style="max-width:150px" /><button class="btn" id="acc-email-btn">${t("save")}</button></div>
      <div class="row" style="flex-wrap:wrap;gap:8px"><div class="grow"><b>${t("changePassword")}</b></div><input class="field" id="acc-pw-cur" type="password" placeholder="${t("currentPassword")}" style="max-width:150px" /><input class="field" id="acc-pw-new" type="password" placeholder="${t("newPassword")}" style="max-width:150px" /><button class="btn" id="acc-pw-btn">${t("save")}</button></div>
      <div class="row"><button class="btn" id="acc-logout-all">${settings.lang==='fr'?'Déconnecter tous les appareils':'Sign out all devices'}</button><button class="btn" id="acc-delete">${settings.lang==='fr'?'Supprimer mon compte':'Delete my account'}</button></div>`;
    document.getElementById('acc-logout-all').onclick=()=>api.runtime.sendMessage({type:'SYNC_LOGOUT_ALL'},r=>{if(r?.ok){api.runtime.sendMessage({type:'GET_STATE'},hydrate);renderAccountPanel();}else toast(r?.error||'Try again');});
    document.getElementById('acc-delete').onclick=()=>{
      const current=document.getElementById('acc-pw-cur').value;
      if(!current){toast(t('currentPassword'));return;}
      if(!confirm(settings.lang==='fr'?'Supprimer définitivement ce compte et ses données synchronisées ? Une copie locale sera conservée.':'Permanently delete this account and its synced data? A local copy will be retained.'))return;
      api.runtime.sendMessage({type:'SYNC_DELETE_ACCOUNT',current},r=>{if(r?.ok){api.runtime.sendMessage({type:'GET_STATE'},hydrate);renderAccountPanel();}else toast(r?.error||'Try again');});
    };
    document.getElementById("acc-manage").onclick = () => api.runtime.openOptionsPage();
    document.getElementById("acc-email-btn").onclick = () => {
      const v = document.getElementById("acc-email").value.trim();
      if (!v) return;
      api.runtime.sendMessage({ type: "SYNC_CHANGE_EMAIL", email: v,current:document.getElementById("acc-email-current").value }, (r) => { void api.runtime.lastError; toast(r && r.ok ? t("changeEmail") + " ✓" : (r && r.error) || "Error"); if (r && r.ok) renderAccountPanel(); });
    };
    document.getElementById("acc-pw-btn").onclick = () => {
      const cur = document.getElementById("acc-pw-cur").value, nw = document.getElementById("acc-pw-new").value;
      if (!nw) return;
      api.runtime.sendMessage({ type: "SYNC_CHANGE_PASSWORD", current: cur, next: nw }, (r) => { void api.runtime.lastError; toast(r && r.ok ? t("changePassword") + " ✓" : (r && r.error) || "Error"); if (r && r.ok) { document.getElementById("acc-pw-cur").value = ""; document.getElementById("acc-pw-new").value = ""; } });
    };
  });
}
function backupSettings(value={}) {
  const result={};
  for(const key of ["notifyNew","lang","autoTrack","translateLang","homeCats","librarySort"])if(Object.hasOwn(value,key))result[key]=value[key];
  if(value.profile&&typeof value.profile==="object")result.profile=Object.fromEntries(["name","bio","avatar","banner","updatedAt"].filter(key=>Object.hasOwn(value.profile,key)).map(key=>[key,value.profile[key]]));
  return result;
}
function doExport() {
  const blob = new Blob([JSON.stringify({ version: 2, items, sites, notifications, lists, settings: backupSettings(settings) }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `yomu-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
}
// Universal import: accepts one or many files (JSON, CSV, XML, ZIP) from Yomu
// or other trackers (Trakt, TV Time, IMDb, Letterboxd, MyAnimeList). Parses
// them locally, then merges the works into the library without wiping it.
let importPending=false;
function paintImportPending() {
  for(const id of ["import","file"]){const control=document.getElementById(id);if(control){control.disabled=importPending;control.setAttribute("aria-busy",String(importPending));}}
}
async function doImport(e) {
  const input=e.target,files=Array.from(input.files||[]);
  if(importPending||!files.length)return;
  importPending=true;paintImportPending();
  try {
    if (!window.YomuImport) { toast(t("importFailed")); return; }
    toast(t("importing"));
    const res = await window.YomuImport.parseFiles(files);
    const warnings=Array.isArray(res.warnings)?res.warnings:[];
    if (!res.count && !res.lists?.length && !res.sites?.length) { toast(t("importNothing")); return; }
    const response=await new Promise(resolve=>requestMetadata({type:"IMPORT_MERGE",payload:res},resolve,45000));
    if(!response?.ok){
      toast(settings.lang==="fr"?"Import non confirmé. Vérifie la bibliothèque avant de réessayer.":"Import not confirmed. Check your library before retrying.");
      return;
    }
    const state=await new Promise(resolve=>requestMetadata({type:"GET_STATE"},resolve));
    if(!state||!["items","lists","sites","notifications"].every(key=>Array.isArray(state[key]))||!state.settings||typeof state.settings!=="object"||Array.isArray(state.settings)){
      toast(settings.lang==="fr"?"Import enregistré. Actualisation impossible ; rouvre la bibliothèque.":"Import saved. Refresh failed; reopen the library.");
      return;
    }
    hydrate(state);
    const count=Number(response.added||0)+Number(response.updated||0);
    toast(t("importedN",{n:count})+(warnings.length?' — '+warnings.join(' — '):''));
  } catch {
    toast(t("importFailed"));
  } finally {
    importPending=false;input.value="";paintImportPending();
  }
}

/* ---- share widgets (reused on the web interface) ---- */
function safeNavigationUrl(value) {
  if(typeof value!=="string"||!value.trim())return "";
  try {const url=new URL(value);return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password?url.href:"";}catch{return "";}
}
const openUrl = (value) => {
  const url=safeNavigationUrl(value);
  if(!url){toast(settings.lang==="fr"?"Ce lien est invalide ou non autorisé.":"This link is invalid or not allowed.");return;}
  return api.tabs.create({url});
};
document.addEventListener("click",event=>{
  const anchor=event.target.closest?.("a[href]");if(!anchor)return;
  const href=anchor.getAttribute("href");if(href?.startsWith("#")&&document.getElementById(href.slice(1)))return;
  if(!safeNavigationUrl(anchor.getAttribute("href"))){event.preventDefault();toast(settings.lang==="fr"?"Ce lien est invalide ou non autorisé.":"This link is invalid or not allowed.");}
},true);
function buildShare(el) {
  if (!el) return;
  el.innerHTML = `<button class="soc x" data-tip="X / Twitter">${I.x}</button><button class="soc fb" data-tip="Facebook">${I.fb}</button><button class="soc wa" data-tip="WhatsApp">${I.wa}</button><button class="soc rd" data-tip="Reddit">${I.rd}</button><button class="soc cp" data-tip="Copy link">${I.link}</button>`;
  const [sx, sf, sw, sr, sc] = el.querySelectorAll(".soc");
  sx.onclick = () => openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(DASI_STORE_URL)}`);
  sf.onclick = () => openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(DASI_STORE_URL)}`);
  sw.onclick = () => openUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(SHARE_TEXT + " " + DASI_STORE_URL)}`);
  sr.onclick = () => openUrl(`https://www.reddit.com/submit?url=${encodeURIComponent(DASI_STORE_URL)}&title=${encodeURIComponent(SHARE_TEXT)}`);
  sc.onclick = async () => { try { await navigator.clipboard.writeText(DASI_STORE_URL);toast(settings.lang==='fr'?'Lien copié':'Link copied'); } catch {toast(settings.lang==='fr'?'Copie impossible. Réessaie.':'Could not copy. Try again.');} };
}
function buildRateStore(el) {
  if(!el)return;
  el.innerHTML=`<a class="btn" href="${DASI_STORE_URL}" target="_blank" rel="noopener noreferrer">${settings.lang==='fr'?'Voir le projet Yomu':'Open the Yomu project'}</a>`;
}

/* ================= chrome (header, nav, menus) ================= */
function paintAvatar() {
  const p = settings.profile || {};
  const av = document.getElementById("avatar");
  av.innerHTML = p.avatar ? `<img src="${esc(p.avatar)}">` : esc(initials(p.name || "Yomu"));
}
function updateNavigationAccessibility() {
  document.title="Yomu — "+t(view==="plans"?"plansTitle":view);
  const fr=settings.lang==="fr";
  document.getElementById("q").setAttribute("aria-label",fr?"Rechercher dans la bibliothèque et les catalogues":"Search your library and catalog");
  document.getElementById("lang-btn").setAttribute("aria-label",fr?"Choisir la langue":"Choose language");
  document.getElementById("nav").setAttribute("aria-label",fr?"Navigation principale":"Main navigation");
  document.getElementById("skip-content").textContent=t("skipContent");
  document.querySelectorAll("#nav button").forEach(button=>{if(button.dataset.v===view)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");});
}
function renderNav() {
  const tabs = [["home", t("home")], ["library", t("library")], ["games", t("games")]];
  document.getElementById("nav").innerHTML = tabs.map(([k, l]) => `<button data-v="${k}" class="${view === k ? "active" : ""}">${l}</button>`).join("");
  updateNavigationAccessibility();
  const goProLabel = document.getElementById("go-pro-label");
  if (goProLabel) goProLabel.textContent = UNLOCK_ALL || isPro() ? t("plans") : t("goPro");
  document.getElementById("lang-code").textContent = (settings.lang || "en").toUpperCase().slice(0, 2);
  const qEl = document.getElementById("q"); if (qEl) qEl.placeholder = t("searchPlaceholder");
  document.querySelectorAll("[data-t]").forEach((n) => (n.textContent = t(n.dataset.t)));
  const addL = document.getElementById("add-list-inline");
  if (addL) addL.innerHTML = `${I.plus} ${t("newList")}`;
}
function renderProfileMenu() {
  const p = settings.profile || {};
  document.getElementById("profile-menu").innerHTML = `
    <div class="menu-head"><div class="avatar">${p.avatar ? `<img src="${esc(p.avatar)}">` : esc(initials(p.name || "Yomu"))}</div><div><b>${esc(p.name || "Your profile")}</b><small>${esc(planLabel())}</small></div></div>
    <div class="sep"></div>
    <button data-go="settings">${I.gear} ${t("settings")}</button>
    <button data-go="plans">${I.crown} ${t("plans")}</button>`;
  document.querySelectorAll("#profile-menu [data-go]").forEach((b) => (b.onclick = () => { closeMenus(); switchView(b.dataset.go); }));
}
let languageSaving=false;
function paintLanguageSaving() {
  document.querySelectorAll("#lang-menu [data-lang],#set-uilang").forEach(control=>{control.disabled=languageSaving;control.setAttribute("aria-busy",String(languageSaving));});
}
function renderLangMenu() {
  document.getElementById("lang-menu").innerHTML = Object.entries(LANGS).map(([code, L]) => `<button class="${settings.lang === code ? "on" : ""}" data-lang="${code}">${esc(L.name)} <span style="margin-left:auto;color:var(--muted);font-size:11px">${code.toUpperCase()}</span></button>`).join("");
  paintLanguageSaving();
  document.querySelectorAll("#lang-menu [data-lang]").forEach((b) => (b.onclick = () => { closeMenus(); void applyLanguage(b.dataset.lang); }));
}
function closeMenus() { document.getElementById("profile-menu").classList.remove("open"); document.getElementById("lang-menu").classList.remove("open"); document.getElementById("notif-menu").classList.remove("open"); }

let notificationMutationQueue=Promise.resolve();
let notificationClearPending=false;
function changeNotifications(type) {
  const operation=notificationMutationQueue.then(()=>new Promise(resolve=>{
    requestMetadata({type},response=>{
      if(api.runtime.lastError || response?.ok===false || !Array.isArray(response?.notifications)){
        toast(settings.lang==="fr"?"Modification des notifications non confirmée. Réessaie.":"Notification change not confirmed. Try again.");
        resolve(false);return;
      }
      notifications=response.notifications;renderBell();renderNotifMenu();resolve(true);
    });
  }));
  notificationMutationQueue=operation.catch(()=>{});
  return operation;
}
function renderNotifMenu() {
  const el = document.getElementById("notif-menu");
  const list = (notifications || []).slice(0, 40);
  el.innerHTML = `<div class="notif-head"><b>${t("updates") || "Updates"}</b>${list.length ? `<button id="notif-clear">${t("delete")}</button>` : ""}</div>` +
    (list.length ? list.map((n) => `<div class="notif-item" data-nitem="${esc(n.itemId || "")}" data-nurl="${esc(n.url || "")}"><span class="dot2 ${n.read ? "read" : ""}"></span><div><b>${esc(n.title || "")}</b><small>${esc(n.message || "")} — ${relative(n.ts)}</small></div></div>`).join("")
      : `<div class="notif-empty">${t("updatesNone")}</div>`);
  const clr = document.getElementById("notif-clear");
  if (clr) {
    clr.disabled=notificationClearPending;
    clr.onclick=async e=>{
      e.stopPropagation();if(notificationClearPending)return;
      notificationClearPending=true;clr.disabled=true;
      try{await changeNotifications("NOTIF_CLEAR");}
      finally{notificationClearPending=false;renderNotifMenu();}
    };
  }
  el.querySelectorAll("[data-nitem]").forEach((row) => (row.onclick = () => {
    closeMenus();
    const id = row.dataset.nitem;
    if (id && items.find((x) => x.id === id)) openDrawer(id);
    else if (row.dataset.nurl) openUrl(row.dataset.nurl);
  }));
}
function renderBell() {
  const unread = (notifications || []).filter((n) => !n.read).length;
  const bell = document.getElementById("bell");
  bell.querySelector(".badge-dot")?.remove();
  if (unread) { const b = document.createElement("span"); b.className = "badge-dot"; b.textContent = unread > 9 ? "9+" : unread; bell.appendChild(b); }
}

async function applyLanguage(code) {
  if(languageSaving||!Object.hasOwn(LANGS,code))return false;
  if(settings.lang===code)return true;
  languageSaving=true;paintLanguageSaving();
  const response=await new Promise(resolve=>requestMetadata({type:"SET_SETTINGS",patch:{lang:code}},resolve));
  languageSaving=false;paintLanguageSaving();
  if(response?.ok===false||response?.settings?.lang!==code){
    const select=document.getElementById("set-uilang");if(select)select.value=settings.lang||"en";
    toast(settings.lang==="fr"?"Changement de langue non confirmé. Réessaie.":"Language change not confirmed. Try again.");
    return false;
  }
  const open=document.getElementById("drawer").classList.contains("open"),savedId=document.getElementById("drawer").dataset.itemId;
  settings={...settings,lang:code};
  document.documentElement.lang = code;
  renderNav(); renderLangMenu(); renderProfileMenu(); renderAll();
  // Re-render whichever view is active so ALL text updates immediately.
  if (view === "games") renderGames();
  else if (view === "plans") renderPlans();
  else if (view === "settings") renderSettings();
  else if (view === "home") renderHome();
  if((view==="library"||view==="games")&&query.trim().length>=2&&document.getElementById("search-results").children.length)renderSearchResults(query.trim());
  if(open){if(savedId)openDrawer(savedId);else if(activeCatalogPreview)openCatalogPreviewResolved(activeCatalogPreview);}
  scheduleCatalogLocalization();
  return true;
}
function switchView(v) {
  ++previewRequest;
  view = v; closeMenus();closeDrawer();
  updateNavigationAccessibility();
  if (v !== "library") { query = ""; const qb = document.getElementById("q"); if (qb) qb.value = ""; clearSearchResults(); }
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("active", s.id === `view-${v}`));
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.v === v));
  if (v === "home") { renderHome(); } else clearInterval(spotTimer);
  if (v === "library") { document.getElementById("lib-main").prepend(document.getElementById("search-results")); currentListId = null; if (!currentListId) { document.getElementById("lib-main").hidden = false; document.getElementById("list-detail").hidden = true; } renderLists(); renderSites(); renderGrid(); }
  if (v === "games") { searchFacets={...searchFacets,kind:"GAME"}; renderGames(); }
  if (v === "plans") renderPlans();
  if (v === "settings") renderSettings();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  renderMetadataStatus();
  renderNav();
  paintAvatar();
  renderLibHeader();
  renderStats();
  renderFilters();
  renderGrid();
  renderLists();
  renderSites();
  if (view === "home") renderHome();
  if (view === "games") renderGames();
  if (view === "plans") renderPlans();
  if (currentListId) renderListDetail();
  renderBell();
}

/* ---- global events ---- */
document.getElementById("nav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { query = ""; document.getElementById("q").value = ""; clearSearchResults(); switchView(b.dataset.v); } });
document.getElementById("brand").onclick = () => { filter = "all"; query = ""; document.getElementById("q").value = ""; clearSearchResults(); switchView("home"); };
document.getElementById("bell").onclick = (e) => {
  e.stopPropagation();
  const menu = document.getElementById("notif-menu");
  const willOpen = !menu.classList.contains("open");
  closeMenus();
  if (willOpen) {
    renderNotifMenu();
    menu.classList.add("open");
    if ((notifications || []).some((n) => !n.read)) void changeNotifications("NOTIF_READ_ALL");
  }
};
document.getElementById("avatar").onclick = (e) => { e.stopPropagation(); closeMenus(); switchView("settings"); };
document.getElementById("lang-btn").onclick = (e) => { e.stopPropagation(); const m = document.getElementById("lang-menu"); const willOpen = !m.classList.contains("open"); closeMenus(); if (willOpen) m.classList.add("open"); };
document.getElementById("go-pro").onclick = () => { clearSearchResults(); switchView("plans"); };
document.addEventListener("click", (e) => { if (!e.target.closest(".top-right")) closeMenus(); if (!e.target.closest(".qa-menu") && !e.target.closest(".quick-add")) closeQuickAdd(); });
document.getElementById("q").addEventListener("input", (e) => {
  clearSearchResults(); query = e.target.value; currentListId = null;
  if (view !== "library" && view !== "games") switchView("library");
  document.getElementById("lib-main").hidden = false; document.getElementById("list-detail").hidden = true;
  renderGrid(); const q = query.trim();
  if (q.length >= 2) {
    document.getElementById("lib-main").classList.add("searching");
    document.getElementById("search-results").innerHTML = '<div class="sr-wrap" role="status"><span class="spinner"></span> '+t("searching")+'…</div>';
    searchTimer = setTimeout(() => catalogSearch(q), 300);
  }
});
document.getElementById("q").addEventListener("keydown", (e) => { if (e.key === "Enter" && query.trim().length >= 2) { if (view !== "library" && view !== "games") switchView("library"); catalogSearch(query.trim()); } });

let searchVersion = 0, searchTimer = null, searchPollTimer = null;
let srCountry = "all";
let searchPageState={pending:false,hasMore:false,cursor:null,partial:false,limited:false,error:false,retryMore:null};
function clearSearchResults() {
  searchVersion++;clearTimeout(searchTimer);clearTimeout(searchPollTimer);lastResults=[];
  searchPageState={pending:false,hasMore:false,cursor:null,partial:false,limited:false,error:false,retryMore:null};
  const el=document.getElementById("search-results");if(el)el.innerHTML="";
  const m=document.getElementById("lib-main");if(m)m.classList.remove("searching");
}
function renderSearchProgress(q) {
  const el=document.getElementById("search-results");if(!el)return;
  let footer=document.getElementById("search-pagination");
  if(!footer){footer=document.createElement("div");footer.id="search-pagination";el.append(footer);}
  const state=searchPageState;
  const status=state.error?(t("searchRetained")):
    state.pending?(t("searchCatalogs")):
    state.partial?(t("searchPartial")):
    state.limited?(t("searchLimit")):"";
  footer.innerHTML='<p id="search-progress" class="sub" role="status">'+esc(status)+'</p>'+
    (state.pending||state.hasMore||state.error?'<button class="btn" id="search-more"'+(state.pending?' disabled aria-busy="true"':'')+'>'+esc(state.pending?(t("loadingLabel")):state.error?(t("retryLabel")):(t("moreResults")))+'</button>':"");
  const button=document.getElementById("search-more");
  if(button)button.onclick=()=>catalogSearch(q,state.error?state.retryMore:state.cursor);
}
function catalogSearch(q,more=null) {
  if(more!==null&&searchPageState.pending)return;
  clearTimeout(searchTimer);clearTimeout(searchPollTimer);
  const version=++searchVersion,deadline=Date.now()+45000;
  const el=document.getElementById("search-results"),main=document.getElementById("lib-main");
  if(main)main.classList.add("searching");
  if(more===null){lastResults=[];el.innerHTML='<div class="sr-wrap" role="status">'+t("searching")+' “'+esc(q)+'”…</div>';srFilter="all";srCountry="all";}
  searchPageState={...searchPageState,pending:true,error:false};
  renderSearchProgress(q);
  let previous=more===null?"":JSON.stringify(lastResults),attempts=0;
  const poll=()=>{if(version!==searchVersion||(view!=="library"&&view!=="games")||query.trim()!==q)return;if(Date.now()>=deadline){searchPageState={...searchPageState,pending:false,error:true,retryMore:more};renderSearchProgress(q);return;}requestMetadata({type:"CATALOG_SEARCH",query:q,progressive:true,retry:attempts===0&&more===null,more},r=>{
    const error=api.runtime.lastError;
    if(version!==searchVersion||(view!=="library"&&view!=="games")||query.trim()!==q)return;
    if(error||!r?.ok||!Array.isArray(r.results)) {
      searchPageState={...searchPageState,pending:false,error:true,retryMore:r?.error==="search_expired"?null:more};
      if(!lastResults.length)el.innerHTML='<div class="sr-wrap">'+(t("searchUnavailable"))+'</div>';
      renderSearchProgress(q);return;
    }
    searchPageState={pending:!!r.pending,hasMore:!!r.hasMore,cursor:r.cursor||null,partial:!!r.partial,limited:!!r.limited,error:false,retryMore:null};
    const results=Array.isArray(r.results)?r.results:[],signature=JSON.stringify(results);
    const focused=document.activeElement?.id;
    if(signature!==previous&&(results.length||!r.pending)){previous=signature;lastResults=results;renderSearchResults(q);}
    else renderSearchProgress(q);
    if(focused?.startsWith("sf-")||focused==="search-more")document.getElementById(focused)?.focus();
    if(r.pending&&++attempts<90){searchPollTimer=setTimeout(poll,500);return;}
    if(r.pending){searchPageState={...searchPageState,pending:false,error:true,retryMore:more};renderSearchProgress(q);}
  },Math.min(15000,Math.max(1,deadline-Date.now())));};
  poll();
}

let lastResults = [];
let srFilter = "all";
const COUNTRY_LABEL = { JP: "Japan", KR: "Korea", CN: "China", TW: "Taiwan", HK: "Hong Kong", US: "USA", GB: "UK", FR: "France" };
let searchFacets={kind:"all",genre:"all",year:"",release:"all",price:200};
function resultKind(m) {
  if(m.type==="game")return "GAME";
  const format=String(m.format||"").toUpperCase();
  if(format==="SERIES"&&m.country==="US")return "US_SERIES";
  return (format==="TV"?"SERIES":format)||String(m.type||"").toUpperCase();
}
function publicationState(m) {
  const status=String(m.releaseStatus||"").trim().toUpperCase();
  if(["HIATUS","ON HIATUS","ON_HIATUS"].includes(status))return "hiatus";
  if(["CANCELLED","CANCELED"].includes(status))return "cancelled";
  if(["FINISHED","ENDED","FINISHED AIRING","FINISHED PUBLISHING"].includes(status))
    return ["work","series"].includes(m.releaseScope)?"finished":m.releaseScope==="installment"?"installment_finished":"finished_unscoped";
  if(["RELEASING","RUNNING","CURRENTLY AIRING","PUBLISHING"].includes(status))return "ongoing";
  if(["NOT_YET_RELEASED","NOT YET AIRED","NOT YET PUBLISHED","UPCOMING","TO BE ANNOUNCED"].includes(status))return "upcoming";
  if(m.type==="game"&&(m.comingSoon===true||m.released===false))return "upcoming";
  return "unknown";
}
function publicationInformation(m) {
  if(!m.releaseStatus)return "";
  const state=publicationState(m);
  const labels={
    finished:m.releaseScope==="series"?(t("seriesEnded")):(t("workFinished")),
    installment_finished:t("partFinished"),
    finished_unscoped:t("endUnspecified"),
    ongoing:t("pubOngoing"),upcoming:t("pubUpcoming"),
    hiatus:t("pubHiatus"),cancelled:t("pubCancelled"),unknown:t("pubUnknown")
  };
  const note=state==="installment_finished"?(t("partNote")):
    state==="finished_unscoped"?(t("endNote")):"";
  return '<section class="publication-facts" data-i18n-static><div class="section-t">'+(t("publication"))+'</div><p>'+esc(labels[state])+'</p>'+(note?'<p class="sub">'+esc(note)+'</p>':"")+'</section>';
}
function resultYear(m) {
  const value=m.year||m.seasonYear||m.releaseDate||m.season;
  const year=String(value||"").match(/(?:19|20|21)\d{2}/);
  return year?year[0]:"";
}
function gamePriceNote(item) {
  const fresh=item.priceStatus==="available"&&Number.isFinite(item.priceCheckedAt)&&
    item.priceCheckedAt<=Date.now()&&Date.now()-item.priceCheckedAt<600000;
  return t(fresh?"priceIndicative":"priceLastKnown");
}
function gamePrice(m) {
  if(m.isFree===true||/^(free(?: to play)?|gratuit)$/i.test(String(m.price||"").trim()))return 0;
  if(Number.isFinite(m.priceAmount)&&m.priceCurrency==="USD")return m.priceAmount;
  const price=String(m.price||"").trim();
  if(!/^\$[\d,.]+$/.test(price))return null;
  const value=Number(price.slice(1).replace(/,/g,""));return Number.isFinite(value)?value:null;
}
function matchesSearchFacets(m) {
  const f=searchFacets;
  if(f.kind!=="all"&&resultKind(m)!==f.kind)return false;
  if(f.genre!=="all"&&!(m.genres||[]).includes(f.genre))return false;
  if(f.year&&resultYear(m)!==f.year)return false;
  if(f.release!=="all"&&publicationState(m)!==f.release)return false;
  if(f.kind==="GAME"&&f.price<200){const price=gamePrice(m);if(price===null||price>f.price)return false;}
  return true;
}
function rankCatalogResults(results,query) {
  const normalize=value=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
  const term=normalize(query),words=[...new Set(term.split(" ").filter(Boolean))];
  const phrase=text=>(" "+text+" ").includes(" "+term+" ");
  const titleScore=value=>{
    const title=normalize(value);if(!term||!title)return 0;
    if(title===term)return 1000;
    if(title.startsWith(term+" "))return 800;
    if(phrase(title))return 600;
    const tokens=new Set(title.split(" ")),matches=words.filter(word=>tokens.has(word)).length;
    return matches===words.length?450:matches?200*matches/words.length:0;
  };
  return results.map((item,index)=>{
    const aliases=Array.isArray(item.alternativeTitles)?item.alternativeTitles:[];
    let score=Math.max(titleScore(item.title),...aliases.map(value=>Math.max(0,titleScore(value)-25)),0);
    if(!score&&term){
      const tags=[item.genres,item.tags,item.catalogTags].flatMap(value=>Array.isArray(value)?value:[]).map(normalize);
      if(tags.some(value=>value===term))score=120;
      else if(phrase(normalize(item.synopsis)))score=60;
    }
    const popularity=Number(item.popularity);
    return {item,index,score,popularity:Number.isFinite(popularity)&&popularity>0?popularity:0};
  }).sort((a,b)=>b.score-a.score||b.popularity-a.popularity||a.index-b.index);
}
function renderSearchResults(q) {
  const el=document.getElementById("search-results"),f=searchFacets;
  const kinds=[...new Set([...lastResults.map(resultKind),...(f.kind!=="all"?[f.kind]:[])])].sort();
  const genres=[...new Set([...lastResults.filter(m=>f.kind==="all"||resultKind(m)===f.kind).flatMap(m=>m.genres||[]),...(f.genre!=="all"?[f.genre]:[])])].sort();
  const labels={GAME:t("games"),MOVIE:t("mediaFilms"),ANIME:t("catAnime"),MANGA:t("catManga"),MANHWA:t("catManhwa"),MANHUA:t("catManhua"),KDRAMA:t("catKdrama"),CDRAMA:t("catCdrama"),JDRAMA:t("catJdrama"),SERIES:t("catSeries"),US_SERIES:t("mediaUSSeries"),NOVEL:t("mediaNovels"),BOOK:t("mediaBooks")};
  const select=(id,label,values,value)=>'<label>'+label+'<select class="field" id="'+id+'"><option value="all">'+t("all")+'</option>'+values.map(([key,name])=>'<option value="'+esc(key)+'"'+(id==="sf-genre"?' data-catalog-text':'')+(value===key?' selected':'')+'>'+esc(name)+'</option>').join("")+'</select></label>';
  const ranked=rankCatalogResults(lastResults,q);
  const shown=ranked.filter(({item})=>matchesSearchFacets(item));
  el.innerHTML='<div class="sr-wrap"><div class="sr-head"><b>'+t("searchTitle")+'</b> — '+esc(q)+' — '+shown.length+'/'+lastResults.length+'</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0">'+
    select("sf-kind",t("mediaType"),kinds.map(k=>[k,labels[k]||k]),f.kind)+
    select("sf-genre",t("genreLabel"),genres.map(g=>[g,g]),f.genre)+
    '<label>'+(t("releaseYear"))+'<input class="field" id="sf-year" type="number" min="1900" max="2199" placeholder="2028" value="'+esc(f.year)+'"></label>'+
    select("sf-release",t("publication"),[["finished",t("finishedFilter")],["installment_finished",t("partFinished")],["finished_unscoped",t("endingFilter")],["ongoing",t("pubOngoing")],["upcoming",t("pubUpcoming")],["hiatus",t("pubHiatus")],["cancelled",t("pubCancelled")],["unknown",t("pubUnknown")]],f.release)+
    '</div>'+(f.kind==="GAME"?'<label>'+(t("maxPrice"))+' <output id="sf-price-label">'+(f.price===200?t("all"):f.price===0?(t("free")):"$"+f.price)+'</output><input id="sf-price" type="range" min="0" max="200" step="5" value="'+f.price+'" style="width:100%"></label>':"")+
    '<p class="sub">'+(t("filtersHint"))+'</p><button class="btn" id="sf-reset"'+(f.kind==="all"&&f.genre==="all"&&!f.year&&f.release==="all"&&f.price===200?' style="display:none"':"")+'>'+(t("clearFilters"))+'</button>'+
    (shown.length?shown.map(({item,index})=>srRow(item,index)).join(""):'<p class="sr-empty">'+t("noMatch")+'</p>')+missingGameAction()+'</div>';
  for(const [id,key] of [["sf-kind","kind"],["sf-genre","genre"],["sf-year","year"],["sf-release","release"],["sf-price","price"]]){
    const field=document.getElementById(id);if(!field)continue;
    field.onchange=()=>{f[key]=key==="price"?Number(field.value):field.value;
      if(key==="kind"&&f.genre!=="all"&&!lastResults.some(m=>(f.kind==="all"||resultKind(m)===f.kind)&&(m.genres||[]).includes(f.genre)))f.genre="all";
      renderSearchResults(q);document.getElementById(id)?.focus();};
    if(key==="year")field.oninput=()=>{f.year=field.value;};
    if(key==="price")field.oninput=()=>{f.price=Number(field.value);document.getElementById("sf-price-label").textContent=field.value==="0"?(t("free")):field.value==="200"?t("all"):"$"+field.value;};
  }
  document.getElementById("sf-reset").onclick=()=>{searchFacets={kind:"all",genre:"all",year:"",release:"all",price:200};renderSearchResults(q);};
  renderSearchProgress(q);
  refreshCatalogSaveLabels(el,lastResults);
  const manual=document.getElementById("manual-game");if(manual)manual.onclick=()=>showGameForm(q);
  el.querySelectorAll("[data-preview]").forEach(button=>button.onclick=()=>openCatalogPreview(lastResults[Number(button.dataset.preview)]));
}
function srRow(m, idx) {
  const tags = (m.genres || []).slice(0, 3).map((g) => `<span class="tag" data-catalog-text>${esc(g)}</span>`).join("");
  const meta = [resultYear(m)].filter(Boolean).join(" — ");
  return `<div class="sr-row">
    <button class="sc" data-preview="${idx}" aria-label="${esc(t("details") + ": " + m.title)}"><span class="cover-ph">${esc((m.title || "?")[0].toUpperCase())}</span>${covImg(m.cover, m.coverFallback)}</button>
    <div class="si"><b><button class="link-btn" data-preview="${idx}">${esc(m.title)}</button><span class="cat">${esc(catLabel(m))}</span></b><small>${esc(meta)}${m.synopsis ? (meta ? " — " : "") + '<span data-catalog-text>' + esc(m.synopsis.slice(0, 90)) + (m.synopsis.length>90?"…":"") + "</span>" : ""}</small><div class="st">${tags}</div></div>
    <button class="btn" data-preview="${idx}" data-saved-label="${idx}">${t("details")}</button>
  </div>`;
}
function refreshCatalogSaveLabels(root,results) {
  const buttons=[...root.querySelectorAll("[data-saved-label]")];
  // The worker accepts 200 identities per message; later pages need their own batch.
  for(let start=0;start<buttons.length;start+=200) {
    const batch=buttons.slice(start,start+200);
    api.runtime.sendMessage({type:"CHECK_EXISTING_BATCH",items:batch.map(button=>results[Number(button.dataset.savedLabel)])},r=>{
      if(api.runtime.lastError||!r?.ok)return;
      batch.forEach((button,index)=>{if(button.isConnected)button.textContent=r.matches?.[index]?(t("inLibrary")):t("details");});
    });
  }
}
function embeddedTrailer(...urls) {
  for(const url of urls) {const html=trailerPlayer(url);if(html)return html;}
  return "";
}
function trailerPlayer(url) {
  if(!url)return "";
  try {
    const parsed=new URL(url);if(parsed.protocol==="http:"&&/(^|\.)(steamstatic\.com|steampowered\.com|akamaihd\.net)$/.test(parsed.hostname))parsed.protocol="https:";if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.port)return "";
    let id="",src="",kind="";
    if(["www.youtube.com","youtube.com","m.youtube.com","www.youtube-nocookie.com","youtube-nocookie.com"].includes(parsed.hostname)) {
      if(parsed.pathname==="/watch")id=parsed.searchParams.get("v")||"";
      else id=parsed.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/)?.[1]||"";
    }
    if(parsed.hostname==="youtu.be")id=parsed.pathname.match(/^\/([\w-]{11})\/?$/)?.[1]||"";
    if(/^[\w-]{11}$/.test(id)){src="https://www.youtube-nocookie.com/embed/"+id;kind="youtube";}
    else if(/\.(mp4|webm)$/i.test(parsed.pathname)){src=parsed.href;kind="video";}
    if(!src)return "";
    const title=esc(t("watchTrailer"));
    return '<section class="detail-trailer"><div class="section-t">'+esc(t("trailer"))+'</div>'+
      (kind==="youtube"?'<iframe src="'+esc(src)+'" title="'+title+'" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>':
      '<video controls playsinline preload="metadata" src="'+esc(src)+'" aria-label="'+title+'"></video>')+'</section>';
  }catch{return "";}
}

function safeStoreLink(value) {
  try {
    const url=new URL(value);
    if(url.protocol!=="https:"||!["store.steampowered.com","store.epicgames.com","www.gog.com","www.playstation.com","store.playstation.com","www.xbox.com","www.nintendo.com","apps.apple.com","play.google.com"].includes(url.hostname)||url.port||url.username||url.password)return "";
    const app=url.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
    if(url.hostname==="store.steampowered.com"&&app)return "https://store.steampowered.com/app/"+app[1]+"/";
    url.hash="";return url.href;
  }catch{return "";}
}

function episodeGuideSlot(item) {
  return item.type==="watching"&&/^[1-9]\d*$/.test(String(item.externalIds?.tvmaze||""))?'<section id="episode-guide" data-i18n-static class="episode-guide" aria-label="'+(t("seasonsEpisodes"))+'"></section>':"";
}
function mountEpisodeGuide(item) {
  const root=document.getElementById("episode-guide");if(!root)return;
  let request=0;
  const active=()=>root.isConnected&&document.getElementById("drawer").classList.contains("open");
  const send=(seasonId)=>new Promise((resolve,reject)=>requestMetadata({type:"CATALOG_EPISODE_GUIDE",item:{type:item.type,externalIds:item.externalIds},seasonId},r=>{if(api.runtime.lastError||!r?.ok)reject(Error("unavailable"));else resolve(r);}));
  const label=s=>(s.number===0?(t("specialsLabel")):t("seasonNumber",{n:s.number}))+(s.name?" — "+s.name:"");
  const fail=(target,retry)=>{
    target.innerHTML='<p class="sub" role="status">'+(t("episodesUnavailable"))+'</p><button class="btn" type="button">'+(t("retryLabel"))+'</button>';
    target.querySelector("button").onclick=retry;
  };
  const load=async()=>{
    const token=++request;
    root.innerHTML='<div class="section-t">'+(t("seasonsEpisodes"))+'</div><p class="sub" role="status">'+(t("loadingSeasons"))+'</p>';
    try {
      const data=await send();if(!active()||token!==request)return;
      const seasons=data.seasons||[];
      if(!seasons.length){root.innerHTML='<p class="sub">'+(t("noSeasons"))+'</p>';return;}
      const selected=seasons.find(s=>s.number===Number(item.season))||seasons[0];
      root.innerHTML='<div class="section-t">'+(t("seasonsEpisodes"))+'</div>'+(seasons.length>1?'<label class="guide-season-label">'+(t("seasonLabel"))+'<select class="field" id="guide-season">'+seasons.map(s=>'<option value="'+esc(s.id)+'"'+(s.id===selected.id?' selected':'')+'>'+esc(label(s))+'</option>').join("")+'</select></label>':'<h3>'+esc(label(selected))+'</h3>')+'<div class="guide-episodes" aria-live="polite"></div><p class="sub guide-source">'+(t("dataLabel"))+'<a href="https://www.tvmaze.com/shows/'+encodeURIComponent(item.externalIds.tvmaze)+'" target="_blank" rel="noopener noreferrer">TVmaze</a></p>';
      const area=root.querySelector(".guide-episodes"),select=root.querySelector("select");
      const choose=async id=>{
        const version=++request;area.setAttribute("aria-busy","true");
        area.innerHTML='<p class="sub">'+(t("loadingEpisodes"))+'</p>';
        try{
          const result=await send(id);if(!active()||version!==request)return;
          area.setAttribute("aria-busy","false");const episodes=result.episodes||[];let visible=40;
          const render=()=>{
            const known=Number.isInteger(result.season.episodeCount)?result.season.episodeCount:null;
            const count=episodes.filter(e=>e.number!==null&&!e.special).length;
            const stats=[t("episodesCount",{n:count})];
            if(known!==null&&known!==count)stats.push(t("episodesExpected",{n:known}));
            const rows=episodes.slice(0,visible).map(e=>{
              const number=e.number===null?(t("specialLabel")):t("episodeNumber",{n:e.number});
              const upcoming=/^\d{4}-\d{2}-\d{2}$/.test(e.airdate)&&e.airdate>new Date().toISOString().slice(0,10);
              const meta=[e.airdate,e.runtime?e.runtime+" min":"",e.special?(t("specialLabel")):"",upcoming?(t("pubUpcoming")):""].filter(Boolean);
              return '<li class="guide-episode"><span class="guide-number">'+esc(number)+'</span><div><b>'+esc(e.name||(t("titleUnannounced")))+'</b>'+(meta.length?'<small>'+meta.map(esc).join(" — ")+'</small>':"")+'</div></li>';
            }).join("");
            area.innerHTML='<p class="sub">'+esc(stats.join(" — "))+'</p>'+(rows?'<ol class="guide-list">'+rows+'</ol>':'<p class="sub">'+(t("noEpisodes"))+'</p>')+(episodes.length>visible?'<button type="button" class="btn guide-more">'+(t("moreEpisodes"))+'</button>':"");
            const more=area.querySelector(".guide-more");if(more)more.onclick=()=>{visible+=40;render();};
          };render();
        }catch{if(active()&&version===request){area.setAttribute("aria-busy","false");fail(area,()=>choose(id));}}
      };
      if(select)select.onchange=()=>choose(select.value);
      choose(selected.id);
    }catch{if(active()&&token===request)fail(root,load);}
  };load();
}

function gameNewsHtml(item) {
  const fr=settings.lang==="fr",now=Date.now(),seen=new Set();
  const news=(Array.isArray(item.news)?item.news:[]).filter(entry=>{
    const time=Number(entry?.publishedAt);
    return entry&&typeof entry.title==="string"&&entry.title.trim()&&Number.isFinite(time)&&time<=now&&time>=now-30*86400000;
  }).sort((a,b)=>b.publishedAt-a.publishedAt).filter(entry=>{
    const id=String(entry.id||entry.title);if(seen.has(id))return false;seen.add(id);return true;
  }).slice(0,6);
  if(!news.length)return "";
  const source=value=>{try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&["steamcommunity.com","store.steampowered.com"].includes(u.hostname)?u.href:"";}catch{return "";}};
  return '<section class="game-news"><div class="section-t">'+(fr?"Actualités récentes — 30 jours":"Recent news — 30 days")+'</div>'+news.map(entry=>{
    const date=new Date(Number(entry.publishedAt)).toLocaleDateString(fr?"fr-FR":"en-US",{day:"numeric",month:"short",year:"numeric"});
    const url=source(entry.url);
    return '<article class="game-news-card"><div class="game-news-meta">'+[entry.category,date].filter(Boolean).map(esc).join(" — ")+'</div><h4>'+esc(entry.title)+'</h4>'+(entry.summary?'<p class="synopsis">'+esc(entry.summary)+'</p>':"")+(url?'<a class="link-btn" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+(fr?"Lire sur Steam":"Read on Steam")+'</a>':"")+'</article>';
  }).join("")+'</section>';
}
function gameRewardsHtml() {
  const fr=settings.lang==="fr";
  return '<section class="game-rewards"><div class="section-t">'+(fr?"Codes et récompenses":"Codes and rewards")+'</div><p class="sub">'+(fr?"Aucun code actif vérifié disponible pour ce jeu pour le moment.":"No verified active codes are available for this game yet.")+'</p></section>';
}
function distinctAlternativeTitles(item){const keyOf=value=>String(value||"").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,"");const seen=new Set([keyOf(item.title)]);return (Array.isArray(item.alternativeTitles)?item.alternativeTitles:[]).filter(value=>{if(typeof value!=="string"||!value.trim())return false;const key=keyOf(value);if(!key||seen.has(key))return false;seen.add(key);return true;});}
function catalogInformation(m) {
  const tags=[...new Set([...(m.genres||[]),...(m.tags||[]),...(m.catalogTags||[])])].filter(x=>typeof x==="string");

  const newsHtml=gameNewsHtml(m);
  const gameFacts=m.type==="game"?'<dl class="game-detail-facts">'+(m.platform?'<dt>'+(t("platformsLabel"))+'</dt><dd>'+esc(m.platform)+'</dd>':"")+(m.releaseDate?'<dt>'+t("releaseDate")+'</dt><dd>'+esc(m.releaseDate)+'</dd>':"")+'</dl>':"";
  return publicationInformation(m)+gameFacts+(tags.length?'<div class="tags">'+tags.map(x=>'<span class="tag">'+esc(x)+'</span>').join("")+'</div>':"")+
    (m.type==="game"&&m.price?'<p class="detail-price">'+esc(m.price)+'</p><p class="sub" data-i18n-static>'+esc(gamePriceNote(m))+'</p>':"")+
    (m.type==="game"?gameStoreButtons(m)+gameSourceCredit(m):"")+
    (m.synopsis?'<div class="section-t">'+t("synopsis")+'</div><p class="synopsis">'+esc(m.synopsis)+'</p>':"")+
    ((m.authors||[]).length?'<div class="section-t">'+(t("creatorsLabel"))+'</div><p>'+m.authors.map(esc).join(" — ")+'</p>':"")+
    (distinctAlternativeTitles(m).length?'<div class="section-t">'+(t("aliasesLabel"))+'</div><ul class="synopsis">'+distinctAlternativeTitles(m).map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>':"")+
    ((m.cast||[]).length?'<div class="section-t">'+(t("castLabel"))+'</div><div class="cast-strip scroll-x">'+m.cast.map(c=>'<div class="cast-card"><div class="cast-av">'+(c.image?'<img src="'+esc(c.image)+'" alt="" loading="lazy">':'')+'</div><b>'+esc(c.name)+'</b><small>'+esc(c.character||c.role||"")+'</small></div>').join("")+'</div>':"")+
    embeddedTrailer(m.trailerUrl,m.trailer)+newsHtml+(m.type==="game"?gameRewardsHtml():"");
}
let previewRequest=0,activeCatalogPreview=null;
function openCatalogPreview(m) {
  if(!m)return;
  const request=++previewRequest;
  // Ask the same engine that saves the work. Title-only UI shortcuts can open
  // a remake or adaptation that the storage engine would correctly separate.
  requestMetadata({type:"CHECK_EXISTING",payload:m},r=>{
    if(request!==previewRequest)return;
    if(!api.runtime.lastError&&r?.existing) {
      const saved=r.existing;
      if(items.some(i=>i.id===saved.id))items=items.map(i=>i.id===saved.id?saved:i);else items=[saved,...items];
      openDrawer(saved.id);return;
    }
    openCatalogPreviewResolved(m);
  },5000);
}
function openCatalogPreviewResolved(m) {
  activeCatalogPreview=m;
  const token=++previewRequest;
  const drawer=document.getElementById("drawer");  delete drawer.dataset.itemId;
  drawer.innerHTML='<div class="drawer-hero"><button id="preview-close" class="icon-btn drawer-close" aria-label="'+esc(t("close")||"Close")+'">'+I.close+'</button><div class="drawer-cover"><span class="cover-ph">'+esc((m.title||"?")[0])+'</span>'+covImg(m.cover,m.coverFallback)+'</div><h2 class="drawer-title">'+esc(m.title)+'</h2><p>'+esc([catLabel(m),m.country,m.year||m.season].filter(Boolean).join(" — "))+'</p></div><div class="drawer-body"><div id="preview-info">'+catalogInformation(m)+'</div>'+episodeGuideSlot(m)+'<p class="sub" id="preview-status" role="status">'+(t("loadingDetails"))+'</p><div class="preview-actions"><label for="preview-list">'+(t("chooseList"))+'</label><select id="preview-list" class="field"><option value="">'+(t("selectList"))+'</option>'+lists.filter(l=>!l.archived).map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>').join("")+'<option value="__new">'+(t("createList"))+'</option></select><input id="preview-list-name" class="field" hidden placeholder="'+(t("listNameLabel"))+'"><button class="btn primary" id="preview-add" disabled>'+(t("addToList"))+'</button></div></div>';
  drawer.setAttribute("role","dialog");drawer.setAttribute("aria-modal","true");drawer.setAttribute("aria-label",m.title);
  drawer.classList.add("open");focusDrawer();document.getElementById("scrim").classList.add("open");
  document.getElementById("preview-close").onclick=closeDrawer;
  const select=document.getElementById("preview-list"),name=document.getElementById("preview-list-name"),button=document.getElementById("preview-add");
  const selection=()=>{name.hidden=select.value!=="__new";button.disabled=!!catalogAddStates.get(button)?.pending||!select.value||(select.value==="__new"&&!name.value.trim());};
  select.onchange=selection;name.oninput=selection;
  button.onclick=()=>addFromCatalog({...m,listId:select.value==="__new"?undefined:select.value,listName:select.value==="__new"?name.value.trim():undefined},button);
  document.getElementById("preview-close").focus();
  mountEpisodeGuide(m);
  if(m.manual){document.getElementById("preview-status").textContent="";return;}
  requestMetadata({type:"CATALOG_DETAIL",item:m},r=>{
    if(token!==previewRequest||!drawer.classList.contains("open")||drawer.dataset.itemId)return;
    const status=document.getElementById("preview-status");
    if(api.runtime.lastError||!r?.ok){if(status)status.textContent=t("detailsUnavailable");return;}
    if(r.item)Object.assign(m,r.item);
    document.getElementById("preview-info").innerHTML=catalogInformation(m);
    enhanceCarousels("#preview-info");
    if(status)status.textContent="";
  });
}
const catalogAddStates=new WeakMap();
async function addFromCatalog(m, btn) {
  const previous=btn?catalogAddStates.get(btn):null;
  if(previous?.pending)return false;
  const navigationToken=previewRequest;
  const destination=JSON.stringify([m.listId||"",m.listName||""]);
  const state=previous?.destination===destination?previous:{destination,saved:null};
  state.pending=true;if(btn)catalogAddStates.set(btn,state);
  const payload = {
    title: m.title, type: m.type || "reading", cover: m.cover || undefined, coverFallback: m.coverFallback || undefined, synopsis: m.synopsis || undefined,
    releaseStatus:m.releaseStatus,releaseScope:m.releaseScope,releaseSource:m.releaseSource,catalogTags:m.catalogTags||m.tags||[],
    trailerUrl:m.trailerUrl, trailer:m.trailer, cast:m.cast, tags:m.tags||[], genres: m.genres || [], total: m.total || undefined, season: m.type === "watching" ? 1 : undefined, year: m.year || m.season, country: m.country, externalIds: m.externalIds, alternativeTitles:m.alternativeTitles, authors:m.authors, anilistId:m.anilistId,
    news:m.type==="game"&&Array.isArray(m.news)?m.news.slice(0,8):undefined,platforms:m.platforms,
    source:m.source,storeLinks:m.type==="game"?[...new Set([m.url,...(Array.isArray(m.storeLinks)?m.storeLinks:[])].map(safeStoreLink).filter(Boolean))].slice(0,24):[],gameEnrichedAt:m.gameEnrichedAt,
    format: m.format || undefined, price: m.price || undefined, priceStatus:m.priceStatus, priceCheckedAt:m.priceCheckedAt, platform: m.platform || undefined, releaseDate: m.releaseDate || undefined,
    url: m.url || "", domain: (m.url && m.url.replace(/^https?:\/\//, "").split("/")[0]) || "catalog", enrichedAt: Date.now(),
  };
  const originalLabel=btn?.innerHTML;
  const controls=btn?.id==="preview-add"?[document.getElementById("preview-list"),document.getElementById("preview-list-name")].filter(Boolean):[];
  controls.forEach(control=>control.disabled=true);
  if(btn){btn.disabled=true;btn.setAttribute("aria-busy","true");btn.textContent=settings.lang==="fr"?"Enregistrement…":"Saving…";}
  const report=message=>{
    const status=btn?.isConnected?document.getElementById("preview-status"):null;
    if(status)status.textContent=message;
    toast(message);
  };
  try{
    if(!state.saved){
      const saved=await new Promise(resolve=>requestMetadata({type:"SAVE_PROGRESS",payload,listId:m.listId||undefined,listName:m.listName||undefined},resolve));
      if(!saved||saved.ok===false||!saved.item?.id){
        if(saved?.item?.id&&saved.error==="list_save_failed"){
          items=[...items.filter(item=>item.id!==saved.item.id),saved.item];renderGrid();renderStats();
          report(settings.lang==="fr"?"Œuvre enregistrée, mais ajout à la liste non confirmé. Réessaie pour l’ajouter à la liste.":"Work saved, but adding it to the list was not confirmed. Retry to add it to the list.");
        }else{
          report(saved?.error==="ambiguous_identity"?(settings.lang==="fr"?"Plusieurs œuvres correspondent. Ouvre la bonne fiche dans ta bibliothèque.":"Several saved works match. Open the correct library entry."):(settings.lang==="fr"?"Enregistrement non confirmé. Vérifie ta bibliothèque avant de réessayer.":"Save not confirmed. Check your library before retrying."));
        }
        return false;
      }
      state.saved=saved.item;
    }
    const snapshot=await new Promise(resolve=>requestMetadata({type:"GET_STATE"},resolve));
    if(snapshot?.ok===false||!Array.isArray(snapshot?.items)||!Array.isArray(snapshot?.lists)||!snapshot.items.some(item=>item.id===state.saved.id)){
      items=[...items.filter(item=>item.id!==state.saved.id),state.saved];renderGrid();renderStats();
      report(settings.lang==="fr"?"Œuvre enregistrée. L’affichage de la bibliothèque n’a pas pu être actualisé ; réessaie pour l’actualiser.":"Work saved. The library display could not be refreshed; retry to refresh it.");
      return false;
    }
    items=snapshot.items;lists=snapshot.lists;
    if(navigationToken!==previewRequest||(btn&&!btn.isConnected)){renderGrid();renderStats();return true;}
    query="";filter="all";document.getElementById("q").value="";clearSearchResults();
    renderAll();switchView(m.type==="game"?"games":"library");
    toast(m.title+" ✓");openDrawer(state.saved.id);
    return true;
  }finally{
    state.pending=false;
    controls.forEach(control=>{if(control.isConnected)control.disabled=false;});
    if(btn?.isConnected){btn.disabled=false;btn.removeAttribute("aria-busy");btn.innerHTML=originalLabel;}
  }
}
document.getElementById("filters").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.f; renderFilters(); renderGrid(); document.querySelector("#filters .active")?.focus(); });
document.getElementById("grid").addEventListener("click", async (e) => {
  const qa = e.target.closest(".quick-add"); if (qa) { e.stopPropagation(); openQuickAdd(qa.dataset.quickadd, qa); return; }
  const action=e.target.closest("[data-fav],[data-rate]");
  if(action) {
    if(action.disabled)return;
    const id=action.dataset.fav||action.dataset.rate,it=items.find(x=>x.id===id);if(!it)return;
    const rating=action.dataset.v,hadFocus=document.activeElement===action;
    action.disabled=true;
    await update(id,rating?{rating:it.rating===Number(rating)?0:Number(rating)}:{favorite:!it.favorite});
    if(action.isConnected)action.disabled=false;
    if(hadFocus&&document.activeElement===document.body) {
      const controls=[...document.querySelectorAll("#grid [data-fav],#grid [data-rate]")];
      const next=controls.find(button=>rating?button.dataset.rate===id&&button.dataset.v===rating:button.dataset.fav===id);
      (next||document.querySelector("#filters .active")||document.getElementById("library-search"))?.focus();
    }
    return;
  }
  const card = e.target.closest("[data-open]"); if (card) openDrawer(card.dataset.open);
});
const newListFlow = async () => {
  if(listCreationPending)return false;
  listCreationPending=true;paintListCreation();
  const navigation=previewRequest,selectedList=currentListId;
  try{
    const response=await new Promise(resolve=>requestMetadata({type:"LIST_CREATE",name:t("newList")},resolve));
    const created=response?.list;
    if(response?.ok===false||!created||typeof created.id!=="string"||!created.id||!Array.isArray(response.lists)||!response.lists.some(list=>list.id===created.id)){
      toast(settings.lang==="fr"?"Création non confirmée. Vérifie tes listes avant de réessayer.":"Creation not confirmed. Check your lists before retrying.");
      return false;
    }
    // Creating a list must not replace other lists edited during the request.
    if(!lists.some(list=>list.id===created.id))lists=[...lists,created];
    renderLists();
    if(view==="library"&&previewRequest===navigation&&currentListId===selectedList){
      openList(created.id);
      const name=document.getElementById("list-name");name?.focus();name?.select();
    }
    return true;
  }finally{listCreationPending=false;paintListCreation();}
};

document.getElementById("list-strip").addEventListener("click", (e) => {
  if (e.target.closest("#new-list")) { newListFlow(); return; }
  const card = e.target.closest("[data-list]"); if (card) openList(card.dataset.list);
});
document.getElementById("add-list-inline").onclick = newListFlow;
document.getElementById("scrim").onclick = closeDrawer;
document.addEventListener("keydown",e=>{if(["Enter"," "].includes(e.key)&&e.target.matches?.('[role="button"][data-open]')){e.preventDefault();e.target.click();}});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeMenus(); if (cropState) closeCropper(); } });
document.getElementById("crop-scrim").onclick = closeCropper;

/* ---- boot ---- */
let storageRefresh = 0, storageRefreshVersion = 0, storageRefreshDirty = false;
let libraryLoadPending=false,libraryLoadVersion=0;
function validLibraryState(state) {
  return !!state&&state.ok!==false&&["items","sites","notifications","lists"].every(key=>Array.isArray(state[key]))&&!!state.settings&&typeof state.settings==="object"&&!Array.isArray(state.settings);
}
function paintLibraryLoad(error=false) {
  const status=document.getElementById("library-load-status"),retry=document.getElementById("library-load-retry");
  status.hidden=!libraryLoadPending&&!error;
  status.setAttribute("aria-busy",String(libraryLoadPending));
  document.getElementById("library-load-message").textContent=t(error?"libraryLoadFailed":"libraryLoading");
  retry.textContent=t("refresh");retry.hidden=!error;retry.disabled=libraryLoadPending;
}
async function loadLibraryState() {
  if(libraryLoadPending)return false;
  libraryLoadPending=true;const version=++libraryLoadVersion;paintLibraryLoad();
  const state=await new Promise(resolve=>requestMetadata({type:"GET_STATE"},resolve));
  if(version!==libraryLoadVersion)return false;
  libraryLoadPending=false;
  if(!validLibraryState(state)){paintLibraryLoad(true);return false;}
  hydrate(state);return true;
}
function hydrate(state) {
  if(!validLibraryState(state)){if(!libraryLoadPending)paintLibraryLoad(true);return false;}
  ++libraryLoadVersion;libraryLoadPending=false;paintLibraryLoad();
  ++storageRefreshVersion; clearTimeout(storageRefresh); storageRefreshDirty = false;
  items = state?.items || []; sites = state?.sites || []; notifications = state?.notifications || [];
  lists = state?.lists || []; settings = { notifyNew: true, lang: "en", profile: { name: "", avatar: "" }, ...(state?.settings || {}) };
  document.documentElement.lang = settings.lang;
  renderNav(); renderAll(); renderLangMenu(); renderProfileMenu();
  if (!discoverTried) loadDiscover(false);
}
document.getElementById("library-load-retry").onclick=()=>{void loadLibraryState();};
void loadLibraryState();
// Background metadata lookups finish after an import. Refresh the open library
// as storage changes so covers and episode totals appear without a page reload.
api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes["dasi.items"]) return;
  const version=++storageRefreshVersion;
  clearTimeout(storageRefresh);
  const change = changes["dasi.items"];
  const signature=item=>JSON.stringify([item.enrichedAt,item.releaseCheckedAt,item.gameEnrichedAt,item.metadataPending,item.metadataStatus]);
  const before=new Map((change.oldValue||[]).map(item=>[item.id,signature(item)]));
  if(!storageRefreshDirty && !(change.newValue||[]).some(item=>before.get(item.id)!==signature(item))&&(change.oldValue||[]).length===(change.newValue||[]).length)return;
  // Progress edits invalidate old snapshots but must not discard pending metadata.
  storageRefreshDirty = true;
  storageRefresh = setTimeout(() => api.runtime.sendMessage({ type: "GET_STATE" }, state => {
    const error=api.runtime.lastError;
    if (error || version!==storageRefreshVersion || !Array.isArray(state?.items)) return;
    storageRefreshDirty = false;
    items = state.items;
    if (Array.isArray(state.lists)) lists = state.lists;
    // Preserve selected list rows, open editors, profile and navigation state.
    renderMetadataStatus();
    renderGrid();
    renderStats();
    if (view === "home" && !currentListId) renderHome();
    if (view === "games" && !document.querySelector("#game-form input")) renderGames();
  }), 120);
});

document.addEventListener("load", (event) => { const im=event.target; if(im instanceof HTMLImageElement && im.matches("img.cov")) {im.classList.toggle("landscape", im.naturalWidth > im.naturalHeight * 1.2);fitDiscoveryArtwork(im);} }, true);

let completingMetadata = false, metadataQueueError = "";
function renderMetadataStatus() {
  const fr=settings.lang==="fr", pending=items.filter(i=>i.metadataPending).length;
  const unresolved=items.filter(i=>["failed","not_found","ambiguous","partial"].includes(i.metadataStatus?.state)&&!i.metadataPending).length;
  const missing=items.filter(i=>!i.metadataPending&&(!coverUrl(i)||!i.synopsis||i.identityVersion!==1)).length;
  const message=pending?(fr?pending+(pending===1?" fiche en cours de recherche. Tu peux continuer à utiliser Yomu.":" fiches en cours de recherche. Tu peux continuer à utiliser Yomu."):pending+(pending===1?" work is being completed. You can keep using Yomu.":" works are being completed. You can keep using Yomu.")):
    unresolved?(fr?unresolved+(unresolved===1?" fiche reste incomplète ou sans correspondance certaine.":" fiches restent incomplètes ou sans correspondance certaine."):unresolved+(unresolved===1?" work still has missing details or an uncertain match.":" works still have missing details or an uncertain match.")):
    missing?(fr?missing+(missing===1?" fiche peut être complétée.":" fiches peuvent être complétées."):missing+(missing===1?" work can be checked for missing details.":" works can be checked for missing details.")):
    (fr?"Les affiches et descriptions disponibles sont enregistrées.":"Available artwork and descriptions are saved.");
  const label=document.getElementById("metadata-status");if(label)label.textContent=metadataQueueError||message;
  const button=document.getElementById("complete-metadata");
  if(button){button.disabled=completingMetadata;button.textContent=fr?"Rechercher les informations":"Find missing details";}
  const banner=document.getElementById("library-metadata-status");
  if(banner){
    banner.hidden=!(pending||unresolved||metadataQueueError);
    banner.innerHTML='<span role="status">'+esc(metadataQueueError||message)+'</span>'+((unresolved||missing||metadataQueueError)?'<button class="btn sm" id="retry-library-metadata">'+(t("retryLabel"))+'</button>':"");
    const retry=document.getElementById("retry-library-metadata");if(retry){retry.disabled=completingMetadata;retry.onclick=completeMissingMetadata;}
  }
}
async function completeMissingMetadata() {
  if(completingMetadata)return;
  completingMetadata=true;metadataQueueError="";renderMetadataStatus();
  try {
    const response=await new Promise((resolve,reject)=>requestMetadata({type:"QUEUE_MISSING_METADATA"},result=>{
      if(!result?.ok)reject(new Error("metadata_unavailable"));else resolve(result);
    }));
    if(Array.isArray(response.items))items=response.items;
  } catch {
    metadataQueueError=settings.lang==="fr"?"La recherche n’a pas pu être confirmée. Réessaie dans un instant.":"The search could not be confirmed. Please try again shortly.";
  } finally {
    completingMetadata=false;renderMetadataStatus();
  }
}

// Refresh visible discovery as its provider cache expires.
setInterval(()=>{if(document.visibilityState==="visible"&&(view==="home"||view==="games"))loadDiscover(false);},30*60*1000);


/* Translate display-only catalog text. Stored provider data and official titles stay intact. */
const catalogLocaleCache=new Map(),catalogLocaleFailures=new Map();
let catalogLocaleTimer=null,catalogLocaleBusy=false;
function scheduleCatalogLocalization(){clearTimeout(catalogLocaleTimer);catalogLocaleTimer=setTimeout(localizeVisibleCatalog,120);}
function requestCatalogTranslation(texts,target,timeoutMs=15000){
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>finish(null),timeoutMs);
    try{api.runtime.sendMessage({type:"DASI_MT",texts,target},response=>{
      const error=api.runtime.lastError;
      finish(error?null:response);
    });}catch{finish(null);}
  });
}
async function localizeVisibleCatalog(){
  if(catalogLocaleBusy)return;
  const language=settings.lang||"en";
  if(language==="en")return;
  const selectors="[data-catalog-text],.home-feature-synopsis,.home-feature-meta,.home-eyebrow,p.synopsis,.tags > .tag,.disco > small,.section-t,#episode-guide h3,#episode-guide .sub";
  const nodes=[...document.querySelectorAll(selectors)].filter(node=>{
    const visible=node.tagName==="OPTION"?node.closest("select"):node;
    if(!visible)return false;
    const rect=visible.getBoundingClientRect();
    return rect.width&&rect.height&&rect.bottom>0&&rect.top<innerHeight+300&&!visible.closest("[hidden],[data-i18n-static]");
  });
  const jobs=[];
  for(const node of nodes){
    const source=node.dataset.catalogSource||node.textContent.trim();if(!source||source.length>20000)continue;
    node.dataset.catalogSource=source;
    const key=language+"\n"+source;
    if(catalogLocaleCache.has(key)){
      const text=catalogLocaleCache.get(key);if(node.textContent!==text)node.textContent=text;
      node.dataset.translationState="translated";continue;
    }
    if((catalogLocaleFailures.get(key)||0)>Date.now())continue;
    jobs.push({node,source,key});if(jobs.length>=8)break;
  }
  if(!jobs.length)return;
  catalogLocaleBusy=true;
  try{
    const unique=[...new Set(jobs.map(job=>job.source))];
    const pieces=[],ranges=unique.map(source=>{
      const start=pieces.length;
      let rest=source;
      while(rest.length>3000){let cut=rest.lastIndexOf(" ",3000);if(cut<1500)cut=3000;pieces.push(rest.slice(0,cut));rest=rest.slice(cut);}
      pieces.push(rest);return {source,start,end:pieces.length};
    });
    const response=await requestCatalogTranslation(pieces,language);
    if(!response?.ok||!Array.isArray(response.translations)||response.translations.length!==pieces.length||response.translations.some(text=>typeof text!=="string"||!text.trim()))throw Error("translation_unavailable");
    for(const range of ranges){
      const key=language+"\n"+range.source,value=response.translations.slice(range.start,range.end).join(" ");
      while(catalogLocaleCache.size>=500)catalogLocaleCache.delete(catalogLocaleCache.keys().next().value);
      catalogLocaleCache.set(key,value);
    }
    if(settings.lang===language)for(const job of jobs)if(job.node.isConnected&&job.node.dataset.catalogSource===job.source){job.node.textContent=catalogLocaleCache.get(job.key);job.node.dataset.translationState="translated";}
  }catch{
    for(const job of jobs){catalogLocaleFailures.set(job.key,Date.now()+60000);if(job.node.isConnected)job.node.dataset.translationState="original";}
    while(catalogLocaleFailures.size>500)catalogLocaleFailures.delete(catalogLocaleFailures.keys().next().value);
  }finally{catalogLocaleBusy=false;scheduleCatalogLocalization();}
}
new MutationObserver(scheduleCatalogLocalization).observe(document.getElementById("main-content"),{childList:true,subtree:true});
new MutationObserver(scheduleCatalogLocalization).observe(document.getElementById("drawer"),{childList:true,subtree:true});
document.addEventListener("scroll",scheduleCatalogLocalization,true);
scheduleCatalogLocalization();
