# Direction produit et design — Suivi

## Trois pistes initiales

### Theme Name: Editorial Quiet
**Very Brief Intro:** Une interface inspirée des index éditoriaux et des carnets de lecture, lumineuse, calme et très structurée. Elle privilégie la mémoire, la continuité et la lisibilité quotidienne.
**Probability:** 0.07

### Theme Name: Signal Noir
**Very Brief Intro:** Une interface sombre et dense, avec des accents corail et des signaux de progression précis. Elle évoque un tableau de bord personnel pour reprendre instantanément une session.
**Probability:** 0.03

### Theme Name: Paper Trail
**Very Brief Intro:** Une esthétique de bibliothèque contemporaine mêlant papier chaud, encre bleue et repères de marge. Elle transforme l’historique numérique en mémoire tangible sans tomber dans le skeuomorphisme.
**Probability:** 0.08

## Approche retenue : Editorial Quiet

### Design Movement
Modern editorial design, avec une influence des revues culturelles, des index de bibliothèque et des interfaces de lecture premium. Le produit doit sembler discret, fiable et suffisamment beau pour être ouvert chaque jour.

### Core Principles
1. **La reprise avant la gestion :** l’action « Continue » domine l’interface et reste accessible sans navigation complexe.
2. **La confiance par la provenance :** chaque détection expose sa source et son niveau de confiance avant d’enregistrer une information ambiguë.
3. **La densité éditoriale maîtrisée :** beaucoup d’information utile, mais hiérarchisée par typographie, espaces et repères latéraux plutôt que par une forêt de cartes.
4. **La localité par défaut :** les données restent dans le navigateur, avec export/import explicite et aucune dépendance réseau pour le cœur du produit.

### Color Philosophy
La palette utilise un fond ivoire légèrement chaud pour réduire la fatigue visuelle, une encre bleu nuit pour la confiance et une couleur signature **vermillon corail** pour signaler l’action immédiate et la progression active. Les surfaces secondaires sont des blancs cassés, jamais des gris froids. Le contraste doit rester élevé, mais l’ensemble ne doit pas ressembler à un outil administratif.

### Layout Paradigm
Une composition en **rail éditorial** : une colonne latérale étroite pour les vues essentielles, une zone principale asymétrique consacrée à la reprise, puis une colonne de contexte qui expose les informations de détection et les outils vidéo. Sur petit écran, le rail devient une barre compacte et la priorité reste la prochaine action.

### Signature Elements
- Une **ligne de progression corail** qui traverse les éléments actifs comme un marque-page.
- Des **repères de marge** numérotés pour les sections clés : Continue, Library, Activity.
- Un symbole de marque composé de deux parenthèses ouvertes formant un signet abstrait, sans texte.

### Interaction Philosophy
Les interactions doivent confirmer une intention déjà comprise, pas demander une exploration. Les actions principales sont verbales et directes : **Continue**, **Save progress**, **Edit detection**. Les raccourcis clavier sont instantanés, les transitions servent uniquement à situer l’utilisateur et les confirmations sont réservées aux actions destructives ou ambiguës.

### Animation
Les entrées de contenu utilisent un décalage vertical très court et une opacité progressive, avec 40 ms entre les rangées. Les boutons réagissent par une compression légère, jamais par un rebond. Les changements de progression animent uniquement la ligne corail et le compteur. Aucune animation essentielle ne dépend d’un délai, et `prefers-reduced-motion` désactive les mouvements non nécessaires.

### Typography System
Titres et repères : **DM Serif Display**, en bleu nuit, avec une casse naturelle et des tailles franches. Interface et texte courant : **IBM Plex Sans**, pour sa lisibilité et ses chiffres tabulaires. Les métadonnées utilisent IBM Plex Sans en capitales espacées, 11–12 px. La hiérarchie privilégie les contrastes de taille et de poids plutôt que les bordures.

### Brand Essence
**Positionnement :** la mémoire locale et instantanée de tout ce que vous lisez ou regardez en ligne, pour reprendre sans chercher. **Personnalité :** attentive, calme, précise.

### Brand Voice
Les titres sont courts et concrets. Les CTA décrivent le résultat, pas la mécanique. Les microcopies expliquent l’incertitude sans jargon technique.

Exemples : « Pick up where your attention left off. » et « Detected from this page — review before saving. »

### Wordmark & Logo
Le symbole est un signet abstrait dessiné par deux parenthèses verticales qui se rapprochent sans se toucher, évoquant à la fois une page ouverte et un point de reprise. Le wordmark utilise DM Serif Display avec un espacement légèrement resserré ; il ne doit jamais être remplacé par le nom dans une police système.

### Signature Brand Color
**Vermillon de reprise — `#E45B45`**. C’est une couleur chaude, visible sans être agressive, utilisée uniquement pour l’action de reprise, les marqueurs de progression et les confirmations positives.

## Décisions produit initiales

Le MVP sera local-first et sans compte. Il comprend une interface web de bibliothèque qui sert aussi de page de démonstration et un paquet d’extension Manifest V3 partageant les mêmes modèles de données et détecteurs. La détection générique combine JSON-LD, Open Graph, titre, headings, URL et éléments vidéo ; les adaptateurs spécifiques restent isolés.

La permission privilégiée est `activeTab` avec `scripting`, afin d’éviter de lire continuellement tous les sites. Le content script est injecté à la demande depuis l’action de l’extension, puis observe uniquement la page active. Le stockage repose sur `chrome.storage.local`; l’export/import JSON apporte une récupération explicite sans service distant.

La sauvegarde automatique vidéo est limitée à un changement significatif de position ou à la pause/la sortie de page, avec un délai de stabilisation pour éviter les écritures inutiles. Picture-in-Picture utilise d’abord l’élément vidéo HTML5 le plus pertinent et signale clairement les restrictions du navigateur ou du lecteur.

Les statistiques, recommandations, comptes, synchronisation cloud, notifications et catalogue externe sont différés : leur valeur est réelle mais leur coût et leur impact sur la confidentialité dépassent le cœur du MVP.

## Sources de recherche consultées

- [Chrome Developers — Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Developers — Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [MDN — WebExtension content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)
- [MDN — Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)

## Style Decisions

- Le produit est **Editorial Quiet**, pas une interface de streaming sombre ou une grille de cartes générique.
- Le vermillon `#E45B45` est réservé aux actions de reprise et aux marqueurs de progression.
- Les états de confiance de la détection doivent être lisibles avant toute sauvegarde ambiguë.
- Le cœur du MVP ne dépend d’aucun backend, catalogue ou service externe.

## Style Decisions — seconde revue

La demande utilisateur de supprimer l’orange prime sur la suggestion de revenir au vermillon : la couleur active est donc le teal `#3A7D7A`, suffisamment distinctif et cohérent avec le repositionnement premium demandé. Le motif de progression reste une ligne active continue, mais en teal, reliant rail, sections, héros et bibliothèque. Les utilitaires de vérification et de filtre restent secondaires par bordure fine et densité typographique réduite.

La revue visuelle confirme que la composition éditoriale, le rail asymétrique, le contexte de provenance et la hiérarchie de reprise sont solides. La prochaine passe renforce uniquement la continuité de la ligne de progression et supprime les derniers tokens rouge-orangé hérités du premier thème.

## Validation v0.2

Le build TypeScript et le build de production passent. Le rendu desktop confirme la nouvelle palette froide, le bouton de vérification manuelle, les contrôles vidéo repliables et le fil de progression teal. Le rendu mobile conserve la priorité Continue, rend les actions principales accessibles et permet le défilement horizontal du rail sans casser la composition. Le bundle Vite conserve un avertissement de taille supérieur à 500 kB ; il ne bloque pas le build et pourra être traité par code-splitting dans une passe performance dédiée.
