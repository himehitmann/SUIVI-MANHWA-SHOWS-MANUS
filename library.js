/* Dasi — local-first tracker home. Vanilla, no build step. */
const api = globalThis.chrome;
const UNLOCK_ALL = typeof DASI_UNLOCK_ALL !== "undefined" ? DASI_UNLOCK_ALL : true;

let items = [], sites = [], notifications = [], lists = [];
let settings = { notifyNew: true, lang: "en", profile: { name: "", avatar: "" } };
let filter = "all", query = "", currentListId = null, view = "home";
let spotIdx = 0, spotItems = [], spotTimer = null;
let userPlan = null; // "pro" | "lifetime" | null, from the sync backend
const isPro = () => UNLOCK_ALL || userPlan === "pro" || userPlan === "lifetime";

const NEW_WINDOW = 14 * 24 * 3600 * 1000;
const SOON_WINDOW = 30 * 24 * 3600 * 1000;
const DASI_STORE_URL = "https://chromewebstore.google.com/detail/dasi";
const SHARE_TEXT = "Dasi — never lose your spot in any manga, webtoon, anime, series or game. Save & resume in one click.";

/* ---- i18n (en/fr full; others cover the visible shell, fall back to en) --- */
const LANGS = {
  en: { name:"English", home:"Home", library:"Library", lists:"Lists", games:"Games", plans:"Plans", settings:"Settings",
    search:"Search", librarySub:"Everything you saved, kept on this device.", listsSub:"Group your works your way — drag to reorder, pick a cover.",
    continue:"Jump back in", newWeek:"New this week", becauseYouLove:"Because you love {g}", yourGenres:"Your genres", recentlyAdded:"Recently added", sitesTitle:"Your sites",
    resume:"Resume", details:"Details", addByName:"Add by name", welcomeTitle:"Welcome to Dasi", welcomeBody:"Dasi remembers where you stopped in anything you read or watch — manga, webtoons, anime, series, films and games. Open a page, hit save, and resume in one click from here.",
    valSaveT:"Save anywhere", valSaveB:"One click on any site — no more lost bookmarks.", valAllT:"One library for everything", valAllB:"Manga, anime, series, films and games together.", valResumeT:"Resume in a click", valResumeB:"Pick up exactly where you left off, on any device.",
    tracked:"Tracked", reading:"Reading", watching:"Watching", favorites:"Favorites", finished:"Finished",
    all:"All", status:"Status", current:"In progress", planned:"Planned", completed:"Completed", on_hold:"On hold", dropped:"Dropped", markFinished:"Mark finished", markUnfinished:"Mark unfinished", open:"Open", progress:"Progress", released:"Released", markAll:"Mark all released as seen", unseenN:"{n} unseen", upToDate:"Up to date", rating:"Rating", tags:"Tags", synopsis:"Synopsis", manage:"Manage", editDetails:"Edit details", removeLib:"Remove from library", showMore:"Show more", showLess:"Show less",
    newList:"New list", cover:"Cover", rename:"Rename", delete:"Delete", inThisList:"In this list", addWorks:"Add works", allLists:"All lists", dragReorder:"drag to reorder",
    gamesSub:"Track awaited games — release dates, prices, trailers and pre-registrations.", addGame:"Add a game", title:"Title", platform:"Platform", releaseDate:"Release date", price:"Price", trailer:"Trailer", watchTrailer:"Watch trailer", preRegistered:"Pre-registered", released:"Released", comingSoon:"Coming soon", add:"Add", cancel:"Cancel", free:"Free",
    editProfile:"Edit profile", displayName:"Display name", changePhoto:"Change photo", language:"Language", uiLanguage:"App language", translateLanguage:"Default translation language", account:"Account", email:"Email", changeEmail:"Change email", changePassword:"Change password", currentPassword:"Current password", newPassword:"New password", save:"Save", signedInAs:"Signed in as", notSignedIn:"Not signed in — sync is optional.", newAlerts:"New-episode alerts", newAlertsSub:"Flag works with something released you haven't seen.", backup:"Backup", yourLibrary:"Your library", exportRestore:"Export a backup file, or restore one.", export:"Export", import:"Import", cloudSync:"Cloud sync", cloudSyncSub:"Optional — sign in to sync across devices.", manageSync:"Manage", rateShare:"Rate & share", rateShareSub:"It helps others discover Dasi.", spread:"Spread the word", enjoying:"Enjoying Dasi?",
    plansTitle:"Choose your plan", plansSub:"Free forever for local tracking. Go Pro for sync, alerts and more.", unlocked:"Owner edition — every Pro feature is unlocked.", mostPopular:"Most popular", getStarted:"Get started", goPro:"Go Pro", getLifetime:"Get Lifetime", currentPlan:"Current",
    updatesNone:"Nothing new right now", updatesSome:"{n} with something new", updates:"Updates" },
  fr: { name:"Français", home:"Accueil", library:"Bibliothèque", lists:"Listes", games:"Jeux", plans:"Abonnements", settings:"Paramètres",
    search:"Rechercher", librarySub:"Tout ce que tu as enregistré, gardé sur cet appareil.", listsSub:"Classe tes œuvres à ta façon — glisse pour réordonner, choisis une couverture.",
    continue:"Reprendre", newWeek:"Nouveautés de la semaine", becauseYouLove:"Parce que tu aimes {g}", yourGenres:"Tes genres", recentlyAdded:"Ajoutés récemment", sitesTitle:"Tes sites",
    resume:"Reprendre", details:"Détails", addByName:"Ajouter par nom", welcomeTitle:"Bienvenue sur Dasi", welcomeBody:"Dasi retient où tu t'es arrêté dans tout ce que tu lis ou regardes — manga, webtoons, anime, séries, films et jeux. Ouvre une page, clique sur enregistrer, et reprends d'un clic depuis ici.",
    valSaveT:"Enregistre partout", valSaveB:"Un clic sur n'importe quel site — fini les favoris perdus.", valAllT:"Une seule bibliothèque", valAllB:"Manga, anime, séries, films et jeux réunis.", valResumeT:"Reprends d'un clic", valResumeB:"Reprends exactement où tu étais, sur tous tes appareils.",
    tracked:"Suivis", reading:"Lecture", watching:"Visionnage", favorites:"Favoris", finished:"Terminés",
    all:"Tout", status:"Statut", current:"En cours", planned:"Prévu", completed:"Terminé", on_hold:"En pause", dropped:"Abandonné", markFinished:"Marquer terminé", markUnfinished:"Marquer en cours", open:"Ouvrir", progress:"Progression", released:"Sortis", markAll:"Tout marquer comme vu", unseenN:"{n} non vus", upToDate:"À jour", rating:"Note", tags:"Tags", synopsis:"Synopsis", manage:"Gérer", editDetails:"Modifier la fiche", removeLib:"Retirer de la bibliothèque", showMore:"Voir plus", showLess:"Voir moins",
    newList:"Nouvelle liste", cover:"Couverture", rename:"Renommer", delete:"Supprimer", inThisList:"Dans cette liste", addWorks:"Ajouter des œuvres", allLists:"Toutes les listes", dragReorder:"glisser pour réordonner",
    gamesSub:"Suis les jeux attendus — dates de sortie, prix, trailers et préinscriptions.", addGame:"Ajouter un jeu", title:"Titre", platform:"Plateforme", releaseDate:"Date de sortie", price:"Prix", trailer:"Trailer", watchTrailer:"Voir le trailer", preRegistered:"Préinscrit", released:"Sorti", comingSoon:"Bientôt", add:"Ajouter", cancel:"Annuler", free:"Gratuit",
    editProfile:"Modifier le profil", displayName:"Nom affiché", changePhoto:"Changer la photo", language:"Langue", uiLanguage:"Langue de l'appli", translateLanguage:"Langue de traduction par défaut", account:"Compte", email:"E-mail", changeEmail:"Changer l'e-mail", changePassword:"Changer le mot de passe", currentPassword:"Mot de passe actuel", newPassword:"Nouveau mot de passe", save:"Enregistrer", signedInAs:"Connecté en tant que", notSignedIn:"Non connecté — la sync est optionnelle.", newAlerts:"Alertes nouveaux épisodes", newAlertsSub:"Signale les œuvres avec du contenu sorti que tu n'as pas vu.", backup:"Sauvegarde", yourLibrary:"Ta bibliothèque", exportRestore:"Exporte une sauvegarde, ou restaure-la.", export:"Exporter", import:"Importer", cloudSync:"Sync cloud", cloudSyncSub:"Optionnel — connecte-toi pour synchroniser tes appareils.", manageSync:"Gérer", rateShare:"Noter & partager", rateShareSub:"Ça aide les autres à découvrir Dasi.", spread:"Fais passer le mot", enjoying:"Tu aimes Dasi ?",
    plansTitle:"Choisis ton abonnement", plansSub:"Gratuit à vie pour le suivi local. Passe Pro pour la sync, les alertes et plus.", unlocked:"Édition propriétaire — toutes les fonctions Pro sont débloquées.", mostPopular:"Le plus populaire", getStarted:"Commencer", goPro:"Passer Pro", getLifetime:"À vie", currentPlan:"Actuel",
    updatesNone:"Rien de nouveau pour l'instant", updatesSome:"{n} avec du nouveau", updates:"Notifications" },
  es: { name:"Español", home:"Inicio", library:"Biblioteca", lists:"Listas", games:"Juegos", plans:"Planes", settings:"Ajustes", search:"Buscar",
    continue:"Continuar", newWeek:"Novedades de la semana", becauseYouLove:"Porque te gusta {g}", yourGenres:"Tus géneros", recentlyAdded:"Añadidos recientemente",
    resume:"Reanudar", details:"Detalles", welcomeTitle:"Bienvenido a Dasi", tracked:"Seguidos", reading:"Lectura", watching:"Viendo", favorites:"Favoritos", finished:"Terminados", all:"Todo",
    gamesSub:"Sigue juegos esperados — fechas, precios, tráilers y prerregistros.", addGame:"Añadir un juego", plansTitle:"Elige tu plan", plansSub:"Gratis para siempre para el seguimiento local. Pro para sync, alertas y más.", mostPopular:"Más popular", goPro:"Hazte Pro", getLifetime:"De por vida", getStarted:"Empezar", currentPlan:"Actual", free:"Gratis", watchTrailer:"Ver tráiler", preRegistered:"Prerregistrado",
    welcomeBody:"Abre cualquier manga, webtoon, anime, serie o juego y guarda en la ventana de Dasi. Aparece aquí.", comingSoon:"Próximamente", add:"Añadir", cancel:"Cancelar", open:"Abrir", markFinished:"Marcar terminado", markUnfinished:"Marcar en curso", released:"Publicados", markAll:"Marcar todo como visto", upToDate:"Al día", unseenN:"{n} sin ver", progress:"Progreso", rating:"Valoración", tags:"Etiquetas", synopsis:"Sinopsis", newList:"Nueva lista", delete:"Eliminar", allLists:"Todas las listas", editProfile:"Editar perfil", backup:"Copia de seguridad", export:"Exportar", import:"Importar", removeLib:"Quitar de la biblioteca", updatesNone:"Nada nuevo por ahora", updatesSome:"{n} con novedades", librarySub:"Todo lo que guardaste, en este dispositivo.", listsSub:"Organiza tus obras a tu manera — arrastra para reordenar, elige una portada.", status:"Estado", current:"En curso", planned:"Pendiente", completed:"Completado", on_hold:"En pausa", dropped:"Abandonado", manage:"Gestionar", showMore:"Ver más", showLess:"Ver menos", cover:"Portada", rename:"Renombrar", inThisList:"En esta lista", addWorks:"Añadir obras", dragReorder:"arrastra para reordenar", title:"Título", platform:"Plataforma", releaseDate:"Fecha de lanzamiento", price:"Precio", trailer:"Tráiler", displayName:"Nombre visible", changePhoto:"Cambiar foto", language:"Idioma", uiLanguage:"Idioma de la app", translateLanguage:"Idioma de traducción por defecto", account:"Cuenta", email:"Correo", changeEmail:"Cambiar correo", changePassword:"Cambiar contraseña", currentPassword:"Contraseña actual", newPassword:"Nueva contraseña", save:"Guardar", signedInAs:"Conectado como", notSignedIn:"No conectado — la sync es opcional.", newAlerts:"Alertas de nuevos episodios", newAlertsSub:"Marca las obras con contenido publicado que no has visto.", yourLibrary:"Tu biblioteca", exportRestore:"Exporta una copia, o restáurala.", cloudSync:"Sync en la nube", cloudSyncSub:"Opcional — inicia sesión para sincronizar tus dispositivos.", manageSync:"Gestionar", rateShare:"Valorar y compartir", rateShareSub:"Ayuda a otros a descubrir Dasi.", spread:"Corre la voz", enjoying:"¿Disfrutas de Dasi?", unlocked:"Edición propietario — todas las funciones Pro están desbloqueadas.", updates:"Novedades", addByName:"Añadir por nombre", valSaveT:"Guarda en cualquier sitio", valSaveB:"Un clic en cualquier web — no más marcadores perdidos.", valAllT:"Una biblioteca para todo", valAllB:"Manga, anime, series, películas y juegos juntos.", valResumeT:"Reanuda en un clic", valResumeB:"Continúa justo donde lo dejaste, en cualquier dispositivo." },
  de: { name:"Deutsch", home:"Start", library:"Bibliothek", lists:"Listen", games:"Spiele", plans:"Abos", settings:"Einstellungen", search:"Suchen",
    continue:"Weiterlesen", newWeek:"Neu diese Woche", becauseYouLove:"Weil du {g} magst", yourGenres:"Deine Genres", recentlyAdded:"Kürzlich hinzugefügt",
    resume:"Fortsetzen", details:"Details", welcomeTitle:"Willkommen bei Dasi", tracked:"Verfolgt", reading:"Lesen", watching:"Sehen", favorites:"Favoriten", finished:"Beendet", all:"Alle",
    gamesSub:"Verfolge erwartete Spiele — Release, Preise, Trailer und Vorregistrierungen.", addGame:"Spiel hinzufügen", plansTitle:"Wähle deinen Plan", plansSub:"Für immer gratis fürs lokale Tracking. Pro für Sync, Hinweise und mehr.", mostPopular:"Am beliebtesten", goPro:"Pro werden", getLifetime:"Lebenslang", getStarted:"Loslegen", currentPlan:"Aktuell", free:"Gratis", watchTrailer:"Trailer ansehen", preRegistered:"Vorregistriert",
    welcomeBody:"Öffne ein Manga, Webtoon, Anime, eine Serie oder ein Spiel und speichere im Dasi-Popup. Es landet hier.", comingSoon:"Demnächst", add:"Hinzufügen", cancel:"Abbrechen", open:"Öffnen", markFinished:"Als fertig markieren", markUnfinished:"Als offen markieren", released:"Erschienen", markAll:"Alles als gesehen markieren", upToDate:"Aktuell", unseenN:"{n} ungesehen", progress:"Fortschritt", rating:"Bewertung", tags:"Tags", synopsis:"Zusammenfassung", newList:"Neue Liste", delete:"Löschen", allLists:"Alle Listen", editProfile:"Profil bearbeiten", backup:"Backup", export:"Exportieren", import:"Importieren", removeLib:"Aus Bibliothek entfernen", updatesNone:"Nichts Neues gerade", updatesSome:"{n} mit Neuem", librarySub:"Alles, was du gespeichert hast — auf diesem Gerät.", listsSub:"Ordne deine Werke nach Belieben — zum Umsortieren ziehen, Cover wählen.", status:"Status", current:"Läuft", planned:"Geplant", completed:"Abgeschlossen", on_hold:"Pausiert", dropped:"Abgebrochen", manage:"Verwalten", showMore:"Mehr anzeigen", showLess:"Weniger anzeigen", cover:"Cover", rename:"Umbenennen", inThisList:"In dieser Liste", addWorks:"Werke hinzufügen", dragReorder:"zum Umsortieren ziehen", title:"Titel", platform:"Plattform", releaseDate:"Erscheinungsdatum", price:"Preis", trailer:"Trailer", displayName:"Anzeigename", changePhoto:"Foto ändern", language:"Sprache", uiLanguage:"App-Sprache", translateLanguage:"Standard-Übersetzungssprache", account:"Konto", email:"E-Mail", changeEmail:"E-Mail ändern", changePassword:"Passwort ändern", currentPassword:"Aktuelles Passwort", newPassword:"Neues Passwort", save:"Speichern", signedInAs:"Angemeldet als", notSignedIn:"Nicht angemeldet — Sync ist optional.", newAlerts:"Benachrichtigungen zu neuen Folgen", newAlertsSub:"Markiert Werke mit Veröffentlichtem, das du noch nicht gesehen hast.", yourLibrary:"Deine Bibliothek", exportRestore:"Exportiere ein Backup oder stelle eines wieder her.", cloudSync:"Cloud-Sync", cloudSyncSub:"Optional — melde dich an, um Geräte zu synchronisieren.", manageSync:"Verwalten", rateShare:"Bewerten & teilen", rateShareSub:"Hilf anderen, Dasi zu entdecken.", spread:"Erzähl es weiter", enjoying:"Gefällt dir Dasi?", unlocked:"Besitzer-Edition — alle Pro-Funktionen sind freigeschaltet.", updates:"Neuigkeiten", addByName:"Nach Namen hinzufügen", valSaveT:"Überall speichern", valSaveB:"Ein Klick auf jeder Seite — keine verlorenen Lesezeichen.", valAllT:"Eine Bibliothek für alles", valAllB:"Manga, Anime, Serien, Filme und Spiele zusammen.", valResumeT:"Mit einem Klick fortsetzen", valResumeB:"Genau da weiter, wo du aufgehört hast — auf jedem Gerät." },
  ja: { name:"日本語", home:"ホーム", library:"ライブラリ", lists:"リスト", games:"ゲーム", plans:"プラン", settings:"設定", search:"検索",
    continue:"続きから", newWeek:"今週の新着", becauseYouLove:"{g}が好きだから", yourGenres:"あなたのジャンル", recentlyAdded:"最近追加",
    resume:"再開", details:"詳細", welcomeTitle:"Dasiへようこそ", tracked:"追跡中", reading:"読書", watching:"視聴", favorites:"お気に入り", finished:"完了", all:"すべて",
    gamesSub:"気になるゲームを追跡 — 発売日・価格・トレーラー・事前登録。", addGame:"ゲームを追加", plansTitle:"プランを選択", plansSub:"ローカル管理は永久無料。同期・通知などはProで。", mostPopular:"人気", goPro:"Proにする", getLifetime:"買い切り", getStarted:"はじめる", currentPlan:"現在", free:"無料", watchTrailer:"トレーラー", preRegistered:"事前登録済み",
    welcomeBody:"マンガ・ウェブトゥーン・アニメ・ドラマ・ゲームを開いてDasiのポップアップで保存すると、ここに表示されます。", comingSoon:"近日", add:"追加", cancel:"キャンセル", open:"開く", markFinished:"完了にする", markUnfinished:"未完了にする", released:"配信済み", markAll:"すべて視聴済みにする", upToDate:"最新", unseenN:"未視聴 {n}", progress:"進捗", rating:"評価", tags:"タグ", synopsis:"あらすじ", newList:"新規リスト", delete:"削除", allLists:"すべてのリスト", editProfile:"プロフィール編集", backup:"バックアップ", export:"エクスポート", import:"インポート", removeLib:"ライブラリから削除", updatesNone:"今は新着なし", updatesSome:"新着 {n} 件", librarySub:"保存したものはすべてこの端末に。", listsSub:"自分好みに整理 — ドラッグで並べ替え、カバーを選択。", status:"ステータス", current:"進行中", planned:"予定", completed:"完了", on_hold:"保留", dropped:"中断", manage:"管理", showMore:"もっと見る", showLess:"閉じる", cover:"カバー", rename:"名前を変更", inThisList:"このリスト内", addWorks:"作品を追加", dragReorder:"ドラッグで並べ替え", title:"タイトル", platform:"プラットフォーム", releaseDate:"発売日", price:"価格", trailer:"トレーラー", displayName:"表示名", changePhoto:"写真を変更", language:"言語", uiLanguage:"アプリの言語", translateLanguage:"デフォルトの翻訳言語", account:"アカウント", email:"メール", changeEmail:"メールを変更", changePassword:"パスワードを変更", currentPassword:"現在のパスワード", newPassword:"新しいパスワード", save:"保存", signedInAs:"ログイン中", notSignedIn:"未ログイン — 同期は任意です。", newAlerts:"新エピソード通知", newAlertsSub:"未視聴の配信済みがある作品を知らせます。", yourLibrary:"あなたのライブラリ", exportRestore:"バックアップを書き出し、または復元。", cloudSync:"クラウド同期", cloudSyncSub:"任意 — ログインして端末間で同期。", manageSync:"管理", rateShare:"評価と共有", rateShareSub:"Dasiを広めるのに役立ちます。", spread:"広めよう", enjoying:"Dasiは気に入りましたか？", unlocked:"オーナー版 — すべてのPro機能が解放されています。", updates:"お知らせ", addByName:"名前で追加", valSaveT:"どこでも保存", valSaveB:"どのサイトでもワンクリック — ブックマークをもう失わない。", valAllT:"すべてを1つのライブラリに", valAllB:"マンガ・アニメ・ドラマ・映画・ゲームをまとめて。", valResumeT:"ワンクリックで再開", valResumeB:"どの端末でも、続きから正確に。" },
  ko: { name:"한국어", home:"홈", library:"라이브러리", lists:"리스트", games:"게임", plans:"플랜", settings:"설정", search:"검색",
    continue:"이어보기", newWeek:"이번 주 신규", becauseYouLove:"{g}을(를) 좋아해서", yourGenres:"내 장르", recentlyAdded:"최근 추가",
    resume:"계속", details:"상세", welcomeTitle:"Dasi에 오신 걸 환영합니다", tracked:"추적", reading:"읽기", watching:"시청", favorites:"즐겨찾기", finished:"완료", all:"전체",
    gamesSub:"기대되는 게임 추적 — 출시일·가격·트레일러·사전예약.", addGame:"게임 추가", plansTitle:"플랜 선택", plansSub:"로컬 추적은 평생 무료. 동기화·알림 등은 Pro로.", mostPopular:"인기", goPro:"Pro 시작", getLifetime:"평생", getStarted:"시작하기", currentPlan:"현재", free:"무료", watchTrailer:"트레일러", preRegistered:"사전예약됨",
    welcomeBody:"만화·웹툰·애니·드라마·게임을 열고 Dasi 팝업에서 저장하면 여기에 표시됩니다.", comingSoon:"출시 예정", add:"추가", cancel:"취소", open:"열기", markFinished:"완료로 표시", markUnfinished:"미완료로 표시", released:"공개됨", markAll:"모두 봤음으로 표시", upToDate:"최신", unseenN:"미시청 {n}", progress:"진행", rating:"평점", tags:"태그", synopsis:"줄거리", newList:"새 리스트", delete:"삭제", allLists:"모든 리스트", editProfile:"프로필 편집", backup:"백업", export:"내보내기", import:"가져오기", removeLib:"라이브러리에서 제거", updatesNone:"지금은 새 소식 없음", updatesSome:"새 소식 {n}개", librarySub:"저장한 모든 것을 이 기기에 보관.", listsSub:"원하는 대로 정리 — 드래그로 순서 변경, 커버 선택.", status:"상태", current:"진행 중", planned:"예정", completed:"완료", on_hold:"보류", dropped:"중단", manage:"관리", showMore:"더 보기", showLess:"접기", cover:"커버", rename:"이름 변경", inThisList:"이 리스트에", addWorks:"작품 추가", dragReorder:"드래그로 순서 변경", title:"제목", platform:"플랫폼", releaseDate:"출시일", price:"가격", trailer:"트레일러", displayName:"표시 이름", changePhoto:"사진 변경", language:"언어", uiLanguage:"앱 언어", translateLanguage:"기본 번역 언어", account:"계정", email:"이메일", changeEmail:"이메일 변경", changePassword:"비밀번호 변경", currentPassword:"현재 비밀번호", newPassword:"새 비밀번호", save:"저장", signedInAs:"로그인 계정", notSignedIn:"로그인 안 됨 — 동기화는 선택 사항입니다.", newAlerts:"새 에피소드 알림", newAlertsSub:"안 본 공개분이 있는 작품을 표시합니다.", yourLibrary:"내 라이브러리", exportRestore:"백업을 내보내거나 복원하세요.", cloudSync:"클라우드 동기화", cloudSyncSub:"선택 — 로그인하면 기기 간 동기화.", manageSync:"관리", rateShare:"평가 및 공유", rateShareSub:"다른 사람이 Dasi를 발견하도록 도와줍니다.", spread:"널리 알리기", enjoying:"Dasi가 마음에 드나요?", unlocked:"오너 에디션 — 모든 Pro 기능이 잠금 해제됨.", updates:"알림", addByName:"이름으로 추가", valSaveT:"어디서나 저장", valSaveB:"어떤 사이트에서도 한 번에 — 북마크를 잃지 마세요.", valAllT:"모든 것을 한 라이브러리에", valAllB:"만화·애니·드라마·영화·게임을 한곳에.", valResumeT:"한 번에 이어보기", valResumeB:"어떤 기기에서도 멈춘 곳에서 바로." },
  pt: { name:"Português", home:"Início", library:"Biblioteca", lists:"Listas", games:"Jogos", plans:"Planos", settings:"Definições", search:"Pesquisar",
    continue:"Continuar", newWeek:"Novidades da semana", becauseYouLove:"Porque gostas de {g}", yourGenres:"Os teus géneros", recentlyAdded:"Adicionados recentemente",
    resume:"Retomar", details:"Detalhes", welcomeTitle:"Bem-vindo ao Dasi", tracked:"Seguidos", reading:"Leitura", watching:"A ver", favorites:"Favoritos", finished:"Terminados", all:"Tudo",
    gamesSub:"Segue jogos esperados — lançamentos, preços, trailers e pré-registos.", addGame:"Adicionar jogo", plansTitle:"Escolhe o teu plano", plansSub:"Grátis para sempre no seguimento local. Pro para sync, alertas e mais.", mostPopular:"Mais popular", goPro:"Ser Pro", getLifetime:"Vitalício", getStarted:"Começar", currentPlan:"Atual", free:"Grátis", watchTrailer:"Ver trailer", preRegistered:"Pré-registado",
    welcomeBody:"Abre um manga, webtoon, anime, série ou jogo e guarda na janela do Dasi. Aparece aqui.", comingSoon:"Em breve", add:"Adicionar", cancel:"Cancelar", open:"Abrir", markFinished:"Marcar terminado", markUnfinished:"Marcar em curso", released:"Lançados", markAll:"Marcar tudo como visto", upToDate:"Em dia", unseenN:"{n} por ver", progress:"Progresso", rating:"Avaliação", tags:"Etiquetas", synopsis:"Sinopse", newList:"Nova lista", delete:"Eliminar", allLists:"Todas as listas", editProfile:"Editar perfil", backup:"Cópia de segurança", export:"Exportar", import:"Importar", removeLib:"Remover da biblioteca", updatesNone:"Nada de novo por agora", updatesSome:"{n} com novidades", librarySub:"Tudo o que guardaste, neste dispositivo.", listsSub:"Organiza as tuas obras à tua maneira — arrasta para reordenar, escolhe uma capa.", status:"Estado", current:"Em curso", planned:"Planeado", completed:"Concluído", on_hold:"Em pausa", dropped:"Abandonado", manage:"Gerir", showMore:"Ver mais", showLess:"Ver menos", cover:"Capa", rename:"Renomear", inThisList:"Nesta lista", addWorks:"Adicionar obras", dragReorder:"arrasta para reordenar", title:"Título", platform:"Plataforma", releaseDate:"Data de lançamento", price:"Preço", trailer:"Trailer", displayName:"Nome apresentado", changePhoto:"Mudar foto", language:"Idioma", uiLanguage:"Idioma da app", translateLanguage:"Idioma de tradução padrão", account:"Conta", email:"E-mail", changeEmail:"Mudar e-mail", changePassword:"Mudar palavra-passe", currentPassword:"Palavra-passe atual", newPassword:"Nova palavra-passe", save:"Guardar", signedInAs:"Sessão iniciada como", notSignedIn:"Sem sessão — a sync é opcional.", newAlerts:"Alertas de novos episódios", newAlertsSub:"Assinala obras com conteúdo lançado que não viste.", yourLibrary:"A tua biblioteca", exportRestore:"Exporta uma cópia, ou restaura-a.", cloudSync:"Sync na nuvem", cloudSyncSub:"Opcional — inicia sessão para sincronizar dispositivos.", manageSync:"Gerir", rateShare:"Avaliar e partilhar", rateShareSub:"Ajuda outros a descobrir o Dasi.", spread:"Espalha a palavra", enjoying:"A gostar do Dasi?", unlocked:"Edição de proprietário — todas as funções Pro desbloqueadas.", updates:"Novidades", addByName:"Adicionar por nome", valSaveT:"Guarda em qualquer lado", valSaveB:"Um clique em qualquer site — sem marcadores perdidos.", valAllT:"Uma biblioteca para tudo", valAllB:"Manga, anime, séries, filmes e jogos juntos.", valResumeT:"Retoma num clique", valResumeB:"Continua exatamente onde paraste, em qualquer dispositivo." },
  "zh-CN": { name:"中文（简体）", home:"首页", library:"资料库", lists:"清单", games:"游戏", plans:"订阅", settings:"设置", search:"搜索", librarySub:"你保存的一切，都在此设备上。", listsSub:"按你的方式整理作品 — 拖动排序，选择封面。", continue:"继续观看", newWeek:"本周新增", becauseYouLove:"因为你喜欢 {g}", yourGenres:"你的类型", recentlyAdded:"最近添加", resume:"继续", details:"详情", addByName:"按名称添加", welcomeTitle:"欢迎使用 Dasi", welcomeBody:"Dasi 会记住你在任何阅读或观看内容中停下的位置 — 漫画、条漫、动画、剧集、电影和游戏。打开页面、点击保存，然后从这里一键继续。", valSaveT:"随处保存", valSaveB:"在任意网站一键保存 — 不再丢失书签。", valAllT:"一个资料库容纳一切", valAllB:"漫画、动画、剧集、电影和游戏集于一处。", valResumeT:"一键继续", valResumeB:"在任何设备上精确接着上次的进度。", tracked:"追踪中", reading:"阅读", watching:"观看", favorites:"收藏", finished:"已完成", all:"全部", status:"状态", current:"进行中", planned:"计划中", completed:"已完成", on_hold:"暂停", dropped:"已弃", markFinished:"标记为完成", markUnfinished:"标记为未完成", open:"打开", progress:"进度", released:"已发布", markAll:"全部标记为已看", unseenN:"{n} 个未看", upToDate:"已是最新", rating:"评分", tags:"标签", synopsis:"简介", manage:"管理", removeLib:"从资料库移除", showMore:"展开", showLess:"收起", newList:"新建清单", cover:"封面", rename:"重命名", delete:"删除", inThisList:"在此清单中", addWorks:"添加作品", allLists:"所有清单", dragReorder:"拖动排序", gamesSub:"追踪期待的游戏 — 发售日期、价格、预告片和预注册。", addGame:"添加游戏", title:"标题", platform:"平台", releaseDate:"发售日期", price:"价格", trailer:"预告片", watchTrailer:"观看预告片", preRegistered:"已预注册", comingSoon:"即将推出", add:"添加", cancel:"取消", free:"免费", editProfile:"编辑资料", displayName:"显示名称", changePhoto:"更换头像", language:"语言", uiLanguage:"应用语言", translateLanguage:"默认翻译语言", account:"账户", email:"邮箱", changeEmail:"更改邮箱", changePassword:"更改密码", currentPassword:"当前密码", newPassword:"新密码", save:"保存", signedInAs:"已登录为", notSignedIn:"未登录 — 同步为可选。", newAlerts:"新剧集提醒", newAlertsSub:"标出有你尚未观看的已发布内容的作品。", backup:"备份", yourLibrary:"你的资料库", exportRestore:"导出备份文件，或恢复备份。", export:"导出", import:"导入", cloudSync:"云同步", cloudSyncSub:"可选 — 登录以在设备间同步。", manageSync:"管理", rateShare:"评分与分享", rateShareSub:"帮助更多人发现 Dasi。", spread:"广而告之", enjoying:"喜欢 Dasi 吗？", plansTitle:"选择你的方案", plansSub:"本地追踪永久免费。升级 Pro 获得同步、提醒等。", unlocked:"所有者版本 — 所有 Pro 功能已解锁。", mostPopular:"最受欢迎", getStarted:"开始使用", goPro:"升级 Pro", getLifetime:"购买终身版", currentPlan:"当前", updatesNone:"暂无新内容", updatesSome:"{n} 项有新内容", updates:"通知" },
};
const t = (k, p) => { let s = (LANGS[settings.lang] && LANGS[settings.lang][k]) || LANGS.en[k] || k; if (p) for (const key in p) s = s.replace(`{${key}}`, p[key]); return s; };
// Target languages for page translation (broad list, matches the popup).
const TR_LANGS = [["en","English"],["fr","Français"],["es","Español"],["de","Deutsch"],["it","Italiano"],["pt","Português"],["nl","Nederlands"],["ru","Русский"],["uk","Українська"],["pl","Polski"],["tr","Türkçe"],["ar","العربية"],["fa","فارسی"],["hi","हिन्दी"],["id","Indonesia"],["vi","Tiếng Việt"],["th","ไทย"],["ja","日本語"],["ko","한국어"],["zh-CN","中文 (简)"],["zh-TW","中文 (繁)"],["fil","Filipino"],["ms","Melayu"],["sv","Svenska"],["no","Norsk"],["da","Dansk"],["fi","Suomi"],["cs","Čeština"],["el","Ελληνικά"],["he","עברית"],["ro","Română"],["hu","Magyar"],["bg","Български"],["sr","Српски"],["hr","Hrvatski"]];

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
// Current position and how many entries are released — the basis for "unseen".
const currentNum = (i) => (i.type === "watching" ? i.episode || 0 : i.chapter || 0);
const STATUSES = ["current", "planned", "completed", "on_hold", "dropped"];
const itemState = (i) => i.state || ((i.progress || 0) >= 100 ? "completed" : "current");
const unseen = (i) => (i.type === "game" ? 0 : Math.max(0, (i.total || 0) - currentNum(i)));
// "New for you": you have unseen released entries, OR it changed recently.
const isNew = (i) => i.type !== "game" && (i.progress || 0) < 100 && (unseen(i) > 0 || Date.now() - (i.updatedAt || 0) < NEW_WINDOW);
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
// Badge label: "+3" when there are unseen released entries, else NEW / Soon.
function flagLabel(i) { const u = unseen(i); if (u > 0) return `+${u}`; if (isNew(i)) return "NEW"; if (isSoon(i)) return t("comingSoon"); return ""; }

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
  const lbl = flagLabel(i);
  const flag = lbl ? `<span class="flag ${isSoon(i) && unseen(i) === 0 ? "soon" : ""}">${esc(lbl)}</span>` : "";
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
function valueStrip() {
  const cards = [
    [I.book, t("valSaveT"), t("valSaveB")],
    [I.game, t("valAllT"), t("valAllB")],
    [I.crown, t("valResumeT"), t("valResumeB")],
  ];
  return `<div class="value-strip">${cards.map(([ic, a, b]) => `<div class="value-card"><span class="vc-ic">${ic}</span><div><b>${esc(a)}</b><small>${esc(b)}</small></div></div>`).join("")}</div>`;
}
function renderHome() {
  const el = document.getElementById("view-home");
  if (!items.length) {
    el.innerHTML = `<div class="onboard"><div class="big"><i></i></div><h2>${t("welcomeTitle")}</h2><p>${t("welcomeBody")}</p>
      <button class="btn primary" id="onb-search" style="margin-top:18px">${I.plus} ${t("addByName")}</button></div>${valueStrip()}`;
    bindHome();
    const ob = document.getElementById("onb-search");
    if (ob) ob.onclick = () => { switchView("library"); document.getElementById("q").focus(); };
    return;
  }
  // Each work appears in at most ONE row (no duplicates across the home).
  const used = new Set();
  const take = (list, n) => { const out = []; for (const i of list) { if (out.length >= n) break; if (!used.has(i.id)) { used.add(i.id); out.push(i); } } return out; };

  const inProgress = items.filter((i) => i.type !== "game" && itemState(i) === "current" && (i.progress || 0) < 100).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const newsAll = items.filter(isNew).sort((a, b) => unseen(b) - unseen(a) || (b.updatedAt || 0) - (a.updatedAt || 0));
  const soon = items.filter((i) => i.type === "game" && isSoon(i));
  const genres = topGenres();
  const topG = genres[0] && genres[0][1] >= 2 ? genres[0][0] : null;
  const recoAll = topG ? items.filter((i) => (i.tags || []).includes(topG)).sort((a, b) => (b.rating || 0) - (a.rating || 0)) : [];
  const recentAll = [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  spotItems = [...newsAll, ...soon, ...inProgress].filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx).slice(0, 6);
  if (!spotItems.length) spotItems = recentAll.slice(0, 4);

  const rNew = take(newsAll, 14);        // actionable: something you haven't seen
  const rContinue = take(inProgress, 14); // in progress, not already shown as new
  const rReco = topG ? take(recoAll, 14) : [];
  const rRecent = take(recentAll, 14);

  el.innerHTML = `
    <div id="spot-wrap">${spotHtml(spotItems[spotIdx % Math.max(1, spotItems.length)])}${spotItems.length > 1 ? `<div class="dots" id="dots">${spotItems.map((_, i) => `<i class="${i === spotIdx % spotItems.length ? "on" : ""}" data-dot="${i}"></i>`).join("")}</div>` : ""}</div>
    ${row(t("newWeek"), rNew)}
    ${row(t("continue"), rContinue)}
    ${rReco.length ? row(t("becauseYouLove", { g: topG }), rReco) : ""}
    ${genres.length ? `<div class="section-h"><h2>${t("yourGenres")}</h2></div><div class="genres">${genres.slice(0, 10).map(([g, n]) => `<span class="genre" data-genre="${esc(g)}">${esc(g)} <b>${n}</b></span>`).join("")}</div>` : ""}
    ${row(t("recentlyAdded"), rRecent)}
    ${items.length < 4 ? valueStrip() : ""}
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
  const f = [["all", t("all")], ["reading", t("reading")], ["watching", t("watching")], ["favorites", t("favorites")], ["planned", t("planned")], ["completed", t("completed")], ["on_hold", t("on_hold")], ["dropped", t("dropped")]];
  document.getElementById("filters").innerHTML = f.map(([k, l]) => `<button data-f="${k}" class="${filter === k ? "active" : ""}">${l}</button>`).join("");
}
function cardHtml(i) {
  const rating = i.rating || 0;
  const tags = (i.tags || []).slice(0, 4).map((x) => `<span class="tag">${esc(x)}</span>`).join("");
  return `<article class="card" data-open="${i.id}">
    <button class="fav ${i.favorite ? "on" : ""}" data-fav="${i.id}">${I.star}</button>
    <div class="cover" style="background:${i.accent || accentFor(i)}">${coverInner(i)}${flagLabel(i) ? `<span class="new-flag">${esc(flagLabel(i))}</span>` : ""}</div>
    <div class="card-body">
      <h3>${esc(i.title || "Untitled")}</h3><p>${esc(marker(i))}${itemState(i) !== "current" ? ` · <b style="color:var(--lav-ink)">${t(itemState(i))}</b>` : ""}</p>
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
    if (STATUSES.includes(filter) && itemState(i) !== filter) return false;
    if (!q) return true;
    return `${i.title} ${marker(i)} ${(i.tags || []).join(" ")}`.toLowerCase().includes(q);
  });
  grid.innerHTML = list.length ? [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(cardHtml).join("") : `<p class="empty">${t("welcomeBody")}</p>`;
}

/* ================= GAMES ================= */
function gameCardHtml(i) {
  const released = isReleased(i), soon = isSoon(i);
  return `<div class="game-card">
    <div class="game-cover" data-open="${i.id}" style="cursor:pointer">${coverInner(i, 24)}</div>
    <div class="game-body">
      <h3 data-open="${i.id}" style="cursor:pointer">${esc(i.title)}</h3>
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
  el.querySelectorAll("[data-open]").forEach((n) => (n.onclick = () => openDrawer(n.dataset.open)));
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
  const cur = isPro() ? (userPlan === "lifetime" ? "lifetime" : "pro") : "free";
  const label = (plan, cta) => (UNLOCK_ALL ? (plan === "free" ? "" : t("currentPlan")) : cur === plan ? t("currentPlan") : cta);
  el.innerHTML = `
    <h1>${t("plansTitle")}</h1><p class="sub">${t("plansSub")}</p>
    ${UNLOCK_ALL ? `<div class="unlocked-banner">${I.crown} ${t("unlocked")}</div>` : ""}
    <div class="plan-grid">
      <div class="plan">
        <h3>Free</h3><div class="price">$0</div><div class="per">forever · local-first</div>
        <ul>${feat([
          "Unlimited tracking — manga, manhwa, webtoons, anime, series, films, games",
          "Auto-detect & one-click save, resume anywhere",
          "Lists, tags, ratings, synopsis, series grouping",
          "Episode / chapter seen tracking",
          "Import from MAL, CSV, JSON + local backup",
          "Every UI language",
          "Page translation — up to 5 pages / day",
        ])}</ul>
        <button class="cta" data-plan="free"${cur === "free" || UNLOCK_ALL ? " disabled" : ""}>${label("free", t("getStarted")) || t("currentPlan")}</button>
      </div>
      <div class="plan feat"><span class="ptag">${t("mostPopular")}</span>
        <h3>Pro</h3><div class="price">$2.99<small>/mo</small></div><div class="per">or $24.99/yr — save 30%</div>
        <ul>${feat([
          "Everything in Free",
          "Encrypted multi-device sync — unlimited devices",
          "New-episode & game-release alerts (notifications)",
          "Unlimited page translation, every language, priority engine",
          "Full stats & insights — streaks, trends, forecasts",
          "Custom list covers & profile (upload, crop, reposition)",
          "Priority support & early features",
        ])}</ul>
        <button class="cta" data-plan="pro"${cur === "pro" ? " disabled" : ""}>${label("pro", t("goPro"))}</button>
      </div>
      <div class="plan">
        <h3>Lifetime</h3><div class="price">$49</div><div class="per">one-time · best value</div>
        <ul>${feat([
          "Everything in Pro, forever",
          "No subscription, ever",
          "Founder badge on your profile",
          "All future updates included",
          "Support an independent, local-first tool",
        ])}</ul>
        <button class="cta" data-plan="lifetime"${cur === "lifetime" ? " disabled" : ""}>${label("lifetime", t("getLifetime"))}</button>
      </div>
    </div>
    <p class="sub" style="margin-top:18px">Local tracking is free forever and never depends on our servers. Paid tiers fund the optional sync, alerts and translation engine.</p>`;
  el.querySelectorAll("[data-plan]").forEach((b) => (b.onclick = () => {
    if (UNLOCK_ALL) { toast(t("unlocked")); return; }
    api.runtime.openOptionsPage();
  }));
}

/* ================= LISTS ================= */
function listCover(l) { return l.cover && /^https?:|^data:/.test(l.cover) ? `background-image:url('${esc(l.cover)}')` : `background:${esc(l.cover || "#EDE6FF")}`; }
function isImg(v) { return v && /^https?:|^data:/.test(v); }
function renderLists() {
  const strip = document.getElementById("list-strip");
  if (!strip) return;
  strip.innerHTML = lists.map((l) => `<div class="strip-list" data-list="${l.id}">
      <div class="lc" style="${listCover(l)}">${isImg(l.cover) ? "" : esc((l.name || "?")[0].toUpperCase())}</div>
      <b>${esc(l.name)}</b><small>${(l.itemIds || []).length} ${(l.itemIds || []).length === 1 ? "work" : "works"}</small>
    </div>`).join("") + `<button class="strip-new" id="new-list">${I.plus}</button>`;
}
function renderSites() {
  const block = document.getElementById("sites-block");
  const strip = document.getElementById("site-strip");
  if (!block) return;
  if (!sites.length) { block.hidden = true; return; }
  block.hidden = false;
  const h = document.getElementById("sites-h");
  if (h) h.textContent = t("sitesTitle");
  strip.innerHTML = sites.map((s) => `<a class="site-chip" href="${esc(s.url)}" target="_blank" rel="noreferrer"><span class="fav-dot">${esc((s.name || "?")[0].toUpperCase())}</span>${esc(s.name)}<span class="rm-site" data-rmsite="${esc(s.id || s.url)}">${I.close.replace('class="ic"', 'class="ic" style="width:12px;height:12px"')}</span></a>`).join("");
  strip.querySelectorAll("[data-rmsite]").forEach((x) => (x.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const id = x.dataset.rmsite;
    api.runtime.sendMessage({ type: "REMOVE_SITE", id }, (r) => { sites = r?.sites || sites.filter((s) => (s.id || s.url) !== id); renderSites(); });
  }));
}
function openList(id) { currentListId = id; document.getElementById("lib-main").hidden = true; document.getElementById("list-detail").hidden = false; renderListDetail(); window.scrollTo({ top: 0, behavior: "smooth" }); }
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
  document.getElementById("list-cover-btn").onclick = () => changeCover((v) => listMsg("LIST_UPDATE", { id: l.id, patch: { cover: v } }), "square");
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
function backToLists() { currentListId = null; document.getElementById("list-detail").hidden = true; document.getElementById("lib-main").hidden = false; renderLists(); }

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
        <div class="released-row"><span class="rel-label">${t("released")}</span><input id="dr-total" type="number" min="0" value="${i.total || ""}" placeholder="?" /><span class="rel-hint">${unseen(i) > 0 ? t("unseenN", { n: unseen(i) }) : i.total ? t("upToDate") : ""}</span></div>
        ${episodeGrid(i)}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          ${i.total && unseen(i) > 0 ? `<button class="btn primary" id="dr-markall">${I.check} ${t("markAll")}</button>` : ""}
          <a class="btn" href="${esc(i.url || "#")}" target="_blank" rel="noreferrer">${I.open} ${t("open")}</a>
        </div>`}
      ${isGame ? "" : `<div class="section-t">${t("status")}</div>
      <div class="chips-wrap" id="dr-status">${STATUSES.map((s) => `<button class="chip-toggle ${itemState(i) === s ? "on" : ""}" data-status="${s}">${itemState(i) === s ? I.check : ""} ${t(s)}</button>`).join("")}</div>`}
      <div class="section-t">${t("rating")}</div>
      <div class="rate-big" id="dr-rate">${[1,2,3,4,5].map((n) => `<span data-v="${n}">${I.star.replace('class="ic fill"', `class="ic fill ${n <= (i.rating || 0) ? "on" : ""}"`)}</span>`).join("")}</div>
      <div class="section-t">${t("tags")}</div><div class="tag-edit" id="dr-tags"></div>
      <div class="section-t">${t("lists")}</div>
      <div class="chips-wrap" id="dr-lists">${lists.map((l) => `<button class="chip-toggle ${memberIn.includes(l.id) ? "on" : ""}" data-list="${l.id}">${memberIn.includes(l.id) ? I.check : I.plus} ${esc(l.name)}</button>`).join("") || `<span style="color:var(--muted);font-size:12px">${t("newList")}…</span>`}</div>
      <div class="section-t">${t("editDetails")}</div>
      <div class="edit-grid">
        <input class="field" id="dr-title" value="${esc(i.title || "")}" placeholder="${t("title")}" />
        <select class="field" id="dr-type">
          <option value="reading" ${i.type === "reading" ? "selected" : ""}>${t("reading")}</option>
          <option value="watching" ${i.type === "watching" ? "selected" : ""}>${t("watching")}</option>
          <option value="game" ${i.type === "game" ? "selected" : ""}>${t("games")}</option>
        </select>
        ${!isGame ? `<input class="field" id="dr-season" type="number" min="0" value="${i.season || ""}" placeholder="${isWatch ? "Season" : "Vol."}" />` : ""}
      </div>
      <div class="section-t">${t("manage")}</div><button class="btn danger" id="dr-remove">${I.trash} ${t("removeLib")}</button>
    </div>`;
  document.getElementById("scrim").classList.add("open");
  d.classList.add("open");
  wireDrawer(i, isWatch, isGame);
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
function wireDrawer(i, isWatch, isGame) {
  document.getElementById("dr-close").onclick = closeDrawer;
  const syn = document.getElementById("dr-syn"), synT = document.getElementById("dr-syn-toggle");
  if (synT) synT.onclick = () => { syn.classList.toggle("clamp"); synT.textContent = syn.classList.contains("clamp") ? t("showMore") : t("showLess"); };
  if (!isGame) {
    const num = document.getElementById("dr-num");
    const key = isWatch ? "episode" : "chapter", latestKey = isWatch ? "latestEpisode" : "latestChapter";
    const setNum = (v) => { const n = Math.max(0, Math.round(Number(v) || 0)); num.value = n; const p = { [key]: n || undefined }; p[latestKey] = Math.max(i[latestKey] || 0, n) || undefined; update(i.id, p); };
    document.getElementById("dr-minus").onclick = () => { setNum((Number(num.value) || 0) - 1); setTimeout(() => openDrawer(i.id), 30); };
    document.getElementById("dr-plus").onclick = () => { setNum((Number(num.value) || 0) + 1); setTimeout(() => openDrawer(i.id), 30); };
    num.onchange = () => { setNum(num.value); setTimeout(() => openDrawer(i.id), 30); };
    const total = document.getElementById("dr-total");
    if (total) total.onchange = () => { update(i.id, { total: Math.max(0, Math.round(Number(total.value) || 0)) || undefined }); setTimeout(() => openDrawer(i.id), 30); };
    const eps = document.getElementById("dr-eps");
    if (eps) eps.querySelectorAll("[data-ep]").forEach((c) => (c.onclick = () => { setNum(Number(c.dataset.ep)); setTimeout(() => openDrawer(i.id), 30); }));
    const markall = document.getElementById("dr-markall");
    if (markall) markall.onclick = () => { setNum(i.total || currentNum(i)); setTimeout(() => openDrawer(i.id), 30); };
  } else {
    document.getElementById("dr-prereg").onclick = () => { update(i.id, { preregistered: !i.preregistered }); setTimeout(() => openDrawer(i.id), 30); };
  }
  document.getElementById("dr-cover").onclick = () => changeCover((v) => { update(i.id, { coverOverride: v }); setTimeout(() => openDrawer(i.id), 30); });
  document.querySelectorAll("#dr-rate span").forEach((s) => (s.onclick = () => { const v = Number(s.dataset.v); update(i.id, { rating: i.rating === v ? 0 : v }); setTimeout(() => openDrawer(i.id), 30); }));
  document.querySelectorAll("#dr-status [data-status]").forEach((b) => (b.onclick = () => {
    const s = b.dataset.status; const patch = { state: s };
    if (s === "completed") { patch.progress = 100; patch.status = "completed"; }
    else if (s === "planned") { patch.progress = 0; patch.status = "in_progress"; }
    else patch.status = "in_progress";
    update(i.id, patch); setTimeout(() => openDrawer(i.id), 30);
  }));
  renderDrawerTags(i);
  document.querySelectorAll("#dr-lists [data-list]").forEach((b) => (b.onclick = () => { const l = lists.find((x) => x.id === b.dataset.list); if (!l) return; const has = (l.itemIds || []).includes(i.id); setListItemsSilent(l.id, has ? l.itemIds.filter((x) => x !== i.id) : [...(l.itemIds || []), i.id]); setTimeout(() => openDrawer(i.id), 30); }));
  const titleEl = document.getElementById("dr-title");
  if (titleEl) titleEl.onchange = () => { const v = titleEl.value.trim(); if (v && v !== i.title) { update(i.id, { title: v }); setTimeout(() => openDrawer(i.id), 30); } };
  const typeEl = document.getElementById("dr-type");
  if (typeEl) typeEl.onchange = () => { update(i.id, { type: typeEl.value }); setTimeout(() => openDrawer(i.id), 30); };
  const seasonEl = document.getElementById("dr-season");
  if (seasonEl) seasonEl.onchange = () => { const v = Math.max(0, Math.round(Number(seasonEl.value) || 0)); update(i.id, isWatch ? { season: v || undefined } : { volume: v || undefined }); setTimeout(() => openDrawer(i.id), 30); };
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
/* ---- image cropper (upload · zoom · reposition), Discord-style ---- */
const CROP_V = 280, CROP_T = 512;
let cropState = null; // { img, zoom, ox, oy, onSave, shape }
function openCropper({ shape = "square", onSave, initial, title }) {
  cropState = { img: null, zoom: 1, ox: 0, oy: 0, onSave, shape };
  const view = document.getElementById("crop-view");
  view.classList.toggle("circle", shape === "circle");
  document.getElementById("crop-title").textContent = title || "Adjust image";
  document.getElementById("crop-zoom").value = 1;
  document.getElementById("crop-scrim").classList.add("open");
  document.getElementById("cropper").classList.add("open");
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
  x.clearRect(0, 0, CROP_V, CROP_V); x.fillStyle = "#F0EEF6"; x.fillRect(0, 0, CROP_V, CROP_V);
}
function loadCropImage(src) {
  const img = new Image();
  img.onload = () => {
    const cover = Math.max(CROP_T / img.naturalWidth, CROP_T / img.naturalHeight);
    cropState.img = img; cropState.cover = cover; cropState.zoom = 1;
    const dw = img.naturalWidth * cover, dh = img.naturalHeight * cover;
    cropState.ox = (CROP_T - dw) / 2; cropState.oy = (CROP_T - dh) / 2;
    document.getElementById("crop-zoom").value = 1;
    drawCrop();
  };
  img.src = src;
}
function cropDims() { const s = cropState.cover * cropState.zoom; return { dw: cropState.img.naturalWidth * s, dh: cropState.img.naturalHeight * s }; }
function clampCrop() { const { dw, dh } = cropDims(); cropState.ox = Math.min(0, Math.max(CROP_T - dw, cropState.ox)); cropState.oy = Math.min(0, Math.max(CROP_T - dh, cropState.oy)); }
function drawCrop() {
  if (!cropState || !cropState.img) return;
  clampCrop();
  const c = document.getElementById("crop-canvas"), x = c.getContext("2d");
  const r = CROP_V / CROP_T, { dw, dh } = cropDims();
  x.clearRect(0, 0, CROP_V, CROP_V);
  x.drawImage(cropState.img, cropState.ox * r, cropState.oy * r, dw * r, dh * r);
}
function exportCrop() {
  const c = document.createElement("canvas"); c.width = CROP_T; c.height = CROP_T;
  const x = c.getContext("2d"); const { dw, dh } = cropDims();
  x.fillStyle = "#fff"; x.fillRect(0, 0, CROP_T, CROP_T);
  x.drawImage(cropState.img, cropState.ox, cropState.oy, dw, dh);
  return c.toDataURL("image/jpeg", 0.86);
}
(function wireCropper() {
  const view = document.getElementById("crop-view");
  let drag = null;
  const down = (e) => { if (!cropState || !cropState.img) return; const pt = e.touches ? e.touches[0] : e; drag = { x: pt.clientX, y: pt.clientY }; };
  const move = (e) => {
    if (!drag || !cropState || !cropState.img) return;
    const pt = e.touches ? e.touches[0] : e; const r = CROP_T / CROP_V;
    cropState.ox += (pt.clientX - drag.x) * r; cropState.oy += (pt.clientY - drag.y) * r;
    drag = { x: pt.clientX, y: pt.clientY }; drawCrop(); if (e.cancelable) e.preventDefault();
  };
  const up = () => (drag = null);
  view.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  view.addEventListener("touchstart", down, { passive: true }); view.addEventListener("touchmove", move, { passive: false }); view.addEventListener("touchend", up);
  document.getElementById("crop-zoom").addEventListener("input", (e) => {
    if (!cropState || !cropState.img) return;
    const before = cropDims(); const fx = (CROP_T / 2 - cropState.ox) / before.dw, fy = (CROP_T / 2 - cropState.oy) / before.dh;
    cropState.zoom = Number(e.target.value); const after = cropDims();
    cropState.ox = CROP_T / 2 - fx * after.dw; cropState.oy = CROP_T / 2 - fy * after.dh; drawCrop();
  });
  document.getElementById("crop-file").onclick = () => document.getElementById("crop-input").click();
  document.getElementById("crop-input").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return; const rd = new FileReader(); rd.onload = () => loadCropImage(String(rd.result)); rd.readAsDataURL(f);
  });
  document.getElementById("crop-cancel").onclick = closeCropper;
  document.getElementById("crop-save").onclick = () => { if (cropState && cropState.img && cropState.onSave) cropState.onSave(exportCrop()); closeCropper(); };
})();

function changeCover(apply, shape) {
  const c = prompt("Cover — paste an image URL, type 'upload' to pick & crop a file, or leave blank to clear:", "");
  if (c === null) return;
  if (c.trim().toLowerCase() === "upload") { openCropper({ shape: shape || "square", title: t("cover"), onSave: apply }); return; }
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
    <div class="section-t">${t("account")}</div>
    <div class="panel" id="account-panel"></div>
    <div class="section-t">${t("language")}</div>
    <div class="panel">
      <div class="row"><div class="grow"><b>${t("uiLanguage")}</b></div>
        <select class="field" id="set-uilang" style="max-width:200px">${Object.entries(LANGS).map(([c, L]) => `<option value="${c}" ${settings.lang === c ? "selected" : ""}>${esc(L.name)}</option>`).join("")}</select></div>
      <div class="row"><div class="grow"><b>${t("translateLanguage")}</b></div>
        <select class="field" id="set-trlang" style="max-width:200px">${TR_LANGS.map(([c, n]) => `<option value="${c}" ${(settings.translateLang || "en") === c ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
    </div>
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
  const saveProfile = (patch) => { settings.profile = { ...(settings.profile || {}), ...patch }; api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { profile: settings.profile } }, (r) => { if (r?.settings) settings = r.settings; paintAvatar(); renderProfileMenu(); }); };
  nameEl.onchange = () => saveProfile({ name: nameEl.value.trim() });
  const pickPhoto = () => openCropper({ shape: "circle", title: t("changePhoto"), onSave: (data) => { saveProfile({ avatar: data }); renderSettings(); } });
  document.getElementById("set-photo").onclick = pickPhoto;
  document.getElementById("set-avatar").onclick = pickPhoto;
  document.getElementById("sw-notify").onclick = () => { settings.notifyNew = !settings.notifyNew; document.getElementById("sw-notify").classList.toggle("on", settings.notifyNew); api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { notifyNew: settings.notifyNew } }, (r) => { if (r?.settings) settings = r.settings; }); };
  const uilang = document.getElementById("set-uilang");
  uilang.onchange = () => { settings.lang = uilang.value; api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { lang: settings.lang } }, (r) => { if (r?.settings) settings = r.settings; document.documentElement.lang = settings.lang; renderNav(); renderAll(); renderSettings(); }); };
  const trlang = document.getElementById("set-trlang");
  trlang.onchange = () => { settings.translateLang = trlang.value; api.runtime.sendMessage({ type: "SET_SETTINGS", patch: { translateLang: settings.translateLang } }, (r) => { if (r?.settings) settings = r.settings; }); };
  renderAccountPanel();
  document.getElementById("export").onclick = doExport;
  document.getElementById("import").onclick = () => document.getElementById("file").click();
  document.getElementById("file").addEventListener("change", doImport);
  document.getElementById("sync-link").onclick = () => api.runtime.openOptionsPage();
  buildShare(document.getElementById("share"));
  buildRateStore(document.getElementById("rate-store"));
  api.runtime.sendMessage({ type: "SYNC_STATUS" }, (s) => { void api.runtime.lastError; userPlan = (s && s.plan) || null; const el = document.getElementById("sync-state"); if (s && s.configured && el) el.textContent = s.meta && s.meta.lastError ? "Signed in — sync needs attention" : `Synced as ${s.email || "you"}`; });
}
function renderAccountPanel() {
  const el = document.getElementById("account-panel");
  if (!el) return;
  api.runtime.sendMessage({ type: "SYNC_STATUS" }, (s) => {
    void api.runtime.lastError;
    userPlan = (s && s.plan) || userPlan;
    if (!s || !s.configured) {
      el.innerHTML = `<div class="row"><div class="grow"><b>${t("notSignedIn")}</b><small>${t("cloudSyncSub")}</small></div><button class="btn primary" id="acc-signin">${t("manageSync")}</button></div>`;
      document.getElementById("acc-signin").onclick = () => api.runtime.openOptionsPage();
      return;
    }
    el.innerHTML = `
      <div class="row"><div class="grow"><b>${esc(s.email || "")}</b><small>${t("signedInAs")} · ${esc(s.plan || "free")}</small></div><button class="btn" id="acc-manage">${t("manageSync")}</button></div>
      <div class="row" style="flex-wrap:wrap;gap:8px"><div class="grow"><b>${t("changeEmail")}</b></div><input class="field" id="acc-email" type="email" placeholder="new@email.com" style="max-width:200px" /><button class="btn" id="acc-email-btn">${t("save")}</button></div>
      <div class="row" style="flex-wrap:wrap;gap:8px"><div class="grow"><b>${t("changePassword")}</b></div><input class="field" id="acc-pw-cur" type="password" placeholder="${t("currentPassword")}" style="max-width:150px" /><input class="field" id="acc-pw-new" type="password" placeholder="${t("newPassword")}" style="max-width:150px" /><button class="btn" id="acc-pw-btn">${t("save")}</button></div>`;
    document.getElementById("acc-manage").onclick = () => api.runtime.openOptionsPage();
    document.getElementById("acc-email-btn").onclick = () => {
      const v = document.getElementById("acc-email").value.trim();
      if (!v) return;
      api.runtime.sendMessage({ type: "SYNC_CHANGE_EMAIL", email: v }, (r) => { void api.runtime.lastError; toast(r && r.ok ? t("changeEmail") + " ✓" : (r && r.error) || "Error"); if (r && r.ok) renderAccountPanel(); });
    };
    document.getElementById("acc-pw-btn").onclick = () => {
      const cur = document.getElementById("acc-pw-cur").value, nw = document.getElementById("acc-pw-new").value;
      if (!nw) return;
      api.runtime.sendMessage({ type: "SYNC_CHANGE_PASSWORD", current: cur, next: nw }, (r) => { void api.runtime.lastError; toast(r && r.ok ? t("changePassword") + " ✓" : (r && r.error) || "Error"); if (r && r.ok) { document.getElementById("acc-pw-cur").value = ""; document.getElementById("acc-pw-new").value = ""; } });
    };
  });
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
  const tabs = [["home", t("home")], ["library", t("library")], ["games", t("games")], ["plans", t("plans")]];
  document.getElementById("nav").innerHTML = tabs.map(([k, l]) => `<button data-v="${k}" class="${view === k ? "active" : ""}">${l}</button>`).join("");
  document.getElementById("lang-code").textContent = (settings.lang || "en").toUpperCase().slice(0, 2);
  document.querySelectorAll("[data-t]").forEach((n) => (n.textContent = t(n.dataset.t)));
  const addL = document.getElementById("add-list-inline");
  if (addL) addL.innerHTML = `${I.plus} ${t("newList")}`;
}
function renderProfileMenu() {
  const p = settings.profile || {};
  document.getElementById("profile-menu").innerHTML = `
    <div class="menu-head"><div class="avatar">${p.avatar ? `<img src="${esc(p.avatar)}">` : esc(initials(p.name || "Dasi"))}</div><div><b>${esc(p.name || "Your profile")}</b><small>Local-first</small></div></div>
    <div class="sep"></div>
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
function closeMenus() { document.getElementById("profile-menu").classList.remove("open"); document.getElementById("lang-menu").classList.remove("open"); document.getElementById("notif-menu").classList.remove("open"); }

function renderNotifMenu() {
  const el = document.getElementById("notif-menu");
  const list = (notifications || []).slice(0, 40);
  el.innerHTML = `<div class="notif-head"><b>${t("updates") || "Updates"}</b>${list.length ? `<button id="notif-clear">${t("delete")}</button>` : ""}</div>` +
    (list.length ? list.map((n) => `<div class="notif-item" data-nitem="${esc(n.itemId || "")}" data-nurl="${esc(n.url || "")}"><span class="dot2 ${n.read ? "read" : ""}"></span><div><b>${esc(n.title || "")}</b><small>${esc(n.message || "")} · ${relative(n.ts)}</small></div></div>`).join("")
      : `<div class="notif-empty">${t("updatesNone")}</div>`);
  const clr = document.getElementById("notif-clear");
  if (clr) clr.onclick = (e) => { e.stopPropagation(); api.runtime.sendMessage({ type: "NOTIF_CLEAR" }, (r) => { notifications = r?.notifications || []; renderNotifMenu(); renderBell(); }); };
  el.querySelectorAll("[data-nitem]").forEach((row) => (row.onclick = () => {
    closeMenus();
    const id = row.dataset.nitem;
    if (id && items.find((x) => x.id === id)) openDrawer(id);
    else if (row.dataset.nurl) api.tabs.create({ url: row.dataset.nurl });
  }));
}
function renderBell() {
  const unread = (notifications || []).filter((n) => !n.read).length;
  const bell = document.getElementById("bell");
  bell.querySelector(".badge-dot")?.remove();
  if (unread) { const b = document.createElement("span"); b.className = "badge-dot"; b.textContent = unread > 9 ? "9+" : unread; bell.appendChild(b); }
}

function switchView(v) {
  view = v; closeMenus();
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("active", s.id === `view-${v}`));
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.v === v));
  if (v === "home") { renderHome(); } else clearInterval(spotTimer);
  if (v === "library") { if (!currentListId) { document.getElementById("lib-main").hidden = false; document.getElementById("list-detail").hidden = true; } renderLists(); renderSites(); }
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
  renderSites();
  if (view === "home") renderHome();
  if (view === "games") renderGames();
  if (view === "plans") renderPlans();
  if (currentListId) renderListDetail();
  renderBell();
}

/* ---- global events ---- */
document.getElementById("nav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) switchView(b.dataset.v); });
document.getElementById("brand").onclick = () => { filter = "all"; query = ""; document.getElementById("q").value = ""; switchView("home"); };
document.getElementById("bell").onclick = (e) => {
  e.stopPropagation();
  const menu = document.getElementById("notif-menu");
  const willOpen = !menu.classList.contains("open");
  closeMenus();
  if (willOpen) {
    renderNotifMenu();
    menu.classList.add("open");
    if ((notifications || []).some((n) => !n.read)) api.runtime.sendMessage({ type: "NOTIF_READ_ALL" }, (r) => { notifications = r?.notifications || notifications.map((n) => ({ ...n, read: true })); renderBell(); });
  }
};
document.getElementById("avatar").onclick = (e) => { e.stopPropagation(); const m = document.getElementById("profile-menu"); const willOpen = !m.classList.contains("open"); closeMenus(); if (willOpen) m.classList.add("open"); };
document.getElementById("lang-btn").onclick = (e) => { e.stopPropagation(); const m = document.getElementById("lang-menu"); const willOpen = !m.classList.contains("open"); closeMenus(); if (willOpen) m.classList.add("open"); };
document.addEventListener("click", (e) => { if (!e.target.closest(".top-right")) closeMenus(); });
document.getElementById("q").addEventListener("input", (e) => { query = e.target.value; if (view !== "library") switchView("library"); renderGrid(); if (!query) clearSearchResults(); });
document.getElementById("q").addEventListener("keydown", (e) => { if (e.key === "Enter" && query.trim().length >= 2) { if (view !== "library") switchView("library"); catalogSearch(query.trim()); } });

function clearSearchResults() { const el = document.getElementById("search-results"); if (el) el.innerHTML = ""; }
function catalogSearch(q) {
  const el = document.getElementById("search-results");
  el.innerHTML = `<div class="sr-wrap"><p class="sr-head">${esc(q)} — …</p></div>`;
  api.runtime.sendMessage({ type: "CATALOG_SEARCH", query: q }, (r) => {
    void api.runtime.lastError;
    if (!r || !r.ok || !r.results || !r.results.length) {
      el.innerHTML = `<div class="sr-wrap"><p class="sr-head">${t("addByName")}: no online match — you can still add it manually from Games, or keep browsing your library.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="sr-wrap"><p class="sr-head">${t("addByName")} · ${esc(q)}</p>${r.results.map((m, idx) => srRow(m, idx)).join("")}</div>`;
    r.results.forEach((m, idx) => {
      const btn = el.querySelector(`[data-add-cat="${idx}"]`);
      if (btn) btn.onclick = () => addFromCatalog(m, btn);
    });
  });
}
function srRow(m, idx) {
  const tags = (m.genres || []).slice(0, 3).map((g) => `<span class="tag">${esc(g)}</span>`).join("");
  const meta = [m.format, m.season, m.price].filter(Boolean).join(" · ");
  return `<div class="sr-row">
    <div class="sc">${m.cover ? `<img src="${esc(m.cover)}" referrerpolicy="no-referrer" onerror="this.remove()">` : esc((m.title || "?")[0])}</div>
    <div class="si"><b>${esc(m.title)}</b><small>${esc(meta)}${m.synopsis ? " — " + esc(m.synopsis.slice(0, 90)) + "…" : ""}</small><div class="st">${tags}</div></div>
    <button class="btn primary" data-add-cat="${idx}">${I.plus} ${t("add")}</button>
  </div>`;
}
function addFromCatalog(m, btn) {
  const payload = {
    title: m.title, type: m.type || "reading", cover: m.cover || undefined, synopsis: m.synopsis || undefined,
    genres: m.genres || [], total: m.total || undefined, season: m.type === "watching" ? m.season : undefined,
    price: m.price || undefined, platform: m.platform || undefined, releaseDate: m.releaseDate || undefined,
    url: m.url || "", domain: (m.url && m.url.replace(/^https?:\/\//, "").split("/")[0]) || "catalog", enrichedAt: Date.now(),
  };
  if (btn) { btn.disabled = true; btn.innerHTML = I.check; }
  api.runtime.sendMessage({ type: "SAVE_PROGRESS", payload }, () => {
    api.runtime.sendMessage({ type: "GET_STATE" }, (s) => { hydrate(s); toast(m.title + " ✓"); });
  });
}
document.getElementById("filters").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.f; renderFilters(); renderGrid(); });
document.getElementById("grid").addEventListener("click", (e) => {
  const fav = e.target.closest(".fav"); if (fav) { const it = items.find((x) => x.id === fav.dataset.fav); if (it) update(it.id, { favorite: !it.favorite }); return; }
  const rate = e.target.closest("[data-rate]"); if (rate) { const it = items.find((x) => x.id === rate.dataset.rate); const v = Number(rate.dataset.v); update(rate.dataset.rate, { rating: it && it.rating === v ? 0 : v }); return; }
  const card = e.target.closest("[data-open]"); if (card) openDrawer(card.dataset.open);
});
const newListFlow = () => listMsg("LIST_CREATE", { name: t("newList") }, () => { renderLists(); const last = lists[lists.length - 1]; if (last) openList(last.id); });
document.getElementById("list-strip").addEventListener("click", (e) => {
  if (e.target.closest("#new-list")) { newListFlow(); return; }
  const card = e.target.closest("[data-list]"); if (card) openList(card.dataset.list);
});
document.getElementById("add-list-inline").onclick = newListFlow;
document.getElementById("scrim").onclick = closeDrawer;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeMenus(); if (cropState) closeCropper(); } });
document.getElementById("crop-scrim").onclick = closeCropper;

/* ---- boot ---- */
function hydrate(state) {
  items = state?.items || []; sites = state?.sites || []; notifications = state?.notifications || [];
  lists = state?.lists || []; settings = { notifyNew: true, lang: "en", profile: { name: "", avatar: "" }, ...(state?.settings || {}) };
  document.documentElement.lang = settings.lang;
  renderNav(); renderAll(); renderLangMenu(); renderProfileMenu();
}
api.runtime.sendMessage({ type: "GET_STATE" }, hydrate);
