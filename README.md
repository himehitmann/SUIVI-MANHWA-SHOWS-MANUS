# Dasi — Progress Companion

Dasi est une extension de navigateur local-first qui mémorise où l’utilisateur s’est arrêté dans ce qu’il lit ou regarde en ligne. Le produit vise une reprise immédiate, sans compte, sans catalogue distant obligatoire et avec une demande de permissions limitée.

> **Vision :** « Je n’ai plus besoin de réfléchir à où je me suis arrêté. L’extension s’en occupe. »

## Ce qui est livré

Le projet contient une interface web premium de bibliothèque, un popup Manifest V3, un service worker de stockage local et un détecteur générique capable de combiner JSON-LD, Open Graph, titre, headings, URL et lecteurs vidéo HTML5. L’interface web couvre Continue, Reading, Watching, Activity, recherche, filtres, suppression, changement de langue de démonstration, vitesse vidéo et Picture-in-Picture avec gestion explicite des limites.

Le détecteur n’enregistre pas silencieusement une détection ambiguë : la confiance est transmise au popup et l’utilisateur confirme la sauvegarde. La progression vidéo est enregistrée à la pause ou à la sortie de page, plutôt qu’à chaque `timeupdate`, afin de limiter les écritures et les erreurs.

## Architecture

| Couche | Responsabilité | Dépendance critique |
|---|---|---|
| `client/` | Interface web de bibliothèque et démonstration UX | Aucune API métier |
| `extension/content.js` | Détection locale dans la page active, observation SPA et vidéo | APIs DOM natives |
| `extension/background.js` | Messages, persistance et raccourci clavier | `chrome.storage.local` |
| `extension/popup.*` | Confirmation rapide depuis l’icône | Service worker local |
| `ideas.md` | Décisions produit, design et recherche | Documentation |

Le flux privilégie `activeTab` + `scripting` pour injecter à la demande, plutôt qu’une lecture permanente de tous les sites. Manifest V3 s’appuie sur un service worker déclenché par événements et interdit le code distant exécuté dans l’extension, ce qui réduit la surface de confidentialité et de maintenance [1] [2]. Les content scripts communiquent avec le contexte d’extension par messages et ont un accès DOM isolé [1] [3].

## Installation de l’extension en développement

Ouvrir `chrome://extensions`, activer le mode développeur, choisir « Load unpacked » et sélectionner le dossier `extension/`. Ouvrir ensuite une page de lecture ou de vidéo, cliquer sur l’icône Dasi, vérifier la détection et confirmer « Save progress ». Le raccourci par défaut est `Ctrl+Shift+S` sur Windows/Linux et `MacCtrl+Shift+S` sur macOS.

Le fichier `extension/icon.png` doit être présent pour un chargement complet dans le navigateur. En développement, une icône PNG issue de l’asset de marque peut être copiée à cet emplacement.

## Développement de l’interface web

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
```

L’interface est statique et conserve ses états de démonstration en mémoire de session. La persistance réelle de la bibliothèque est assurée par l’extension via `chrome.storage.local`; aucune synchronisation cloud n’est imposée au MVP.

## Stratégie de détection

La priorité est : données structurées, métadonnées sociales, DOM visible, URL, heuristiques, puis confirmation utilisateur. Les adaptateurs spécifiques à un site devront être ajoutés dans un module séparé et ne devront jamais remplacer la détection générique. Les titres ambigus et les pages sans métadonnées doivent rester dans un état de revue, avec l’URL et le domaine conservés pour une récupération ultérieure.

## Vidéo et Picture-in-Picture

La première vidéo HTML5 visible et de plus grande surface est sélectionnée. La progression utilise `currentTime` et `duration`, avec une sauvegarde lors de la pause ou de la fermeture. Le bouton PiP doit appeler `requestPictureInPicture()` uniquement si `document.pictureInPictureEnabled` est disponible et si le lecteur l’autorise. Le support n’est pas uniforme selon les navigateurs, les permissions de contenu et les lecteurs intégrés ; l’interface doit donc présenter un message de limite plutôt que simuler un succès [4].

## Confidentialité et permissions

Les données restent locales par défaut. Le MVP ne demande pas d’accès réseau, de compte, de catalogue, de permission `cookies` ou de permission large de type `host_permissions`. Les permissions `activeTab`, `scripting`, `storage` et `tabs` sont justifiées par l’action utilisateur, le stockage local et l’accès à l’onglet actif. Toute future synchronisation devra être opt-in, chiffrée et découplée du flux principal.

## Tests recommandés

Le plan QA doit couvrir les pages classiques et SPA, les changements d’URL sans rechargement, les titres provenant de JSON-LD/Open Graph/DOM/URL, les pages sans métadonnées, les iframes et lecteurs personnalisés, les vidéos multiples, les pauses et changements d’onglet, les doublons, la suppression, les rechargements du service worker, le raccourci clavier et l’import/export à venir. Il doit aussi vérifier l’accessibilité clavier, le contraste, `prefers-reduced-motion`, l’absence d’écritures vidéo à haute fréquence et l’absence de données transmises à un serveur.

## Limites connues et prochaines étapes

Le MVP ne tente pas de résoudre universellement les lecteurs propriétaires, les iframes cross-origin, les pages protégées du navigateur ou les URL mortes par recherche externe automatique. Les prochaines améliorations à plus forte valeur sont l’export/import JSON, la vraie i18n avec fichiers de messages anglais/français, des tests Playwright sur fixtures HTML, puis des adaptateurs isolés pour quelques sites à forte demande. Les comptes, statistiques, recommandations et cloud backup restent volontairement hors du chemin critique.

## Références

[1]: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts "Chrome Developers — Content scripts"
[2]: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3 "Chrome Developers — Manifest V3"
[3]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts "MDN — WebExtension content scripts"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API "MDN — Picture-in-Picture API"

## Mise à jour v0.2 — ergonomie et fusion multi-sites

La palette v0.2 abandonne le vermillon/orange au profit d’un teal profond (`#3A7D7A`), d’une encre bleu nuit et d’un état de conflit rose discret. Les contrôles importants disposent de cibles plus grandes et de libellés explicites.

Le bouton **Check for updates** est une vérification manuelle et non un suivi permanent en arrière-plan. Il est prévu pour être relié à des adaptateurs de sources ou à des pages déjà ouvertes ; le MVP ne dépend pas d’un catalogue distant et ne promet donc pas une disponibilité universelle sans configuration de source.

La fusion inter-sites dérive une clé de travail à partir du titre normalisé, retire les marqueurs de chapitre/épisode/page et conserve une seule entrée canonique. Si la nouvelle progression est inférieure à la plus avancée, elle est conservée comme conflit et l’interface doit demander confirmation avant remplacement. Les domaines sources sont regroupés dans `sources` afin de garder la provenance sans créer de doublons.

Le popup dispose désormais d’un panneau vidéo ouvrable avec boutons `−` et `+` par pas de 0,25×, ainsi qu’un bouton Picture-in-Picture. Le content script cible la vidéo HTML5 visible la plus grande et signale proprement les cas où le navigateur ou le lecteur refuse PiP.
