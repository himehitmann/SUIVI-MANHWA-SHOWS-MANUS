# Livraison Chrome et CI — 13 septembre 2026

Le workflow de publication utilisait une ancienne liste de fichiers omettant sync-core.js et ocr-regions.js. Il utilise désormais pnpm build:extension puis pnpm test:package avant toute publication. Le script shell historique délègue au même générateur Node. Les changements de modèles OCR, bibliothèques, scripts et dépendances déclenchent aussi le workflow.

La CI qualité exécute les parcours de recadrage, actions groupées et vidéo. Les fixtures ont été stabilisées : stockage initialisé après chargement de la bibliothèque ; images vidéo explicitement enregistrées avant lecture. Les tests listes et vidéo ont réussi après correction puis à nouveau le 13 septembre. Lint et vérification du diff réussis. La syntaxe YAML a été analysée par Prettier.

Ces changements ne publient pas eux-mêmes une release depuis la branche fix. L’extension installée reste en 0.4.6. Validation distante à confirmer après push. Le diagnostic Webtoon et les autres exigences ouvertes restent non terminés. Avancement estimé : 54 %.
