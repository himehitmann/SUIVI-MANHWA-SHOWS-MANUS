# Installer et actualiser Yomu

## Paquet vérifié

Utiliser un workflow **Yomu quality réussi** sur la branche `fix/yomu-p0-reliability`.
Télécharger son artifact `yomu-verification`, extraire cette archive, puis extraire
`yomu-extension.zip`. Le dossier final contient directement `manifest.json`,
`background.js`, `library.html`, `tesseract/` et `vendor/`.

La version 0.4.16 a été vérifiée dans le [workflow 34867367235](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/34867367235).

## Première installation

1. Ouvrir `chrome://extensions` et activer le mode développeur.
2. Choisir **Charger l’extension non empaquetée**.
3. Sélectionner le dossier qui contient directement `manifest.json`.

Le manifeste se trouve à la racine du paquet. Il n’y a pas de sous-dossier
`extension/` à choisir. Ne pas sélectionner une archive ZIP ou le dossier
parent qui contient seulement `yomu-extension.zip`.

## Actualiser une installation existante

1. Exporter une sauvegarde depuis Yomu avant la mise à jour.
2. Remplacer les fichiers du **dossier déjà chargé par Chrome** avec ceux du nouveau paquet.
3. Conserver ce dossier et l’extension existante; ne pas la désinstaller.
4. Dans `chrome://extensions`, cliquer sur **Recharger** pour Yomu.
5. Vérifier la version affichée, puis actualiser les onglets Yomu et les pages où la bulle est utilisée.

Une extension chargée manuellement ne reçoit pas les modifications GitHub
automatiquement. Publier un commit ou un artifact ne met pas à jour Chrome.
Une nouvelle installation dans un autre dossier peut avoir une autre identité
et ne pas retrouver les données de l’ancienne.

## Données

Les données sont conservées dans le stockage du navigateur, séparément des
fichiers du paquet. La sauvegarde JSON reste nécessaire avant une désinstallation
ou un changement de profil. Le miroir du navigateur est limité par ses quotas;
il ne remplace pas une sauvegarde exportée. La synchronisation avec un compte
nécessite un serveur configuré et fonctionnel.

## Construire le paquet

Depuis le dépôt, après installation des dépendances :

```sh
pnpm build:extension
pnpm test:package
```

Le script produit `yomu-extension.zip`, vérifie ses fichiers et inclut les
ressources OCR locales. Préférer ce paquet à un téléchargement brut du dépôt.
