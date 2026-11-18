# Yomu 0.4.5 — suivi et progression

Le content script signale la progression vidéo au plus toutes les 15 secondes pendant les événements de lecture, ainsi qu’à la pause, au masquage et à la sortie de page. Ce mécanisme commence après l’injection par ouverture de Yomu ; il ne constitue pas une injection automatique sur tous les sites ni un suivi des lecteurs cross-origin.

Le worker n’enregistre automatiquement qu’une œuvre vidéo déjà suivie avec une correspondance exacte de titre normalisé ou d’identifiant, unique et suffisamment fiable (confiance >= 0,75). Une option des réglages désactive ce suivi sans empêcher l’enregistrement manuel. Les anciennes saisons et les minutages inférieurs d’un même épisode ne remplacent plus la progression la plus avancée. Le démarrage d’un nouvel épisode ou d’une nouvelle saison reste accepté ; les corrections explicites via UPDATE_ITEM restent possibles.

Validation exécutée : 184 tests/20 fichiers réussis ; TypeScript ; lint ; build ; parcours web (création compte, import, progression, notes, API sync, séparation des comptes, restauration, mobile) ; ZIP MV3 0.4.5 à 31 fichiers ; parcours Chrome et migration depuis 0.3.1. L’intervalle de lecture n’a pas été chronométré sur le Chrome personnel. Compilation avec avertissement de bundle principal > 500 ko toujours ouvert.

L’outil de contrôle du navigateur personnel échoue encore au démarrage. La traduction directe du chapitre Webtoon n’est pas validée. Aucun déploiement de production ni publication Chrome Web Store n’a été effectué.

Avancement global estimé : 53 %, estimation qualitative et non validation exhaustive des 80 sections.
