# Mises à jour de Yomu

Le manifeste actif est `manifest.json` à la racine du dépôt.
Le paquet est produit par `pnpm build:extension` sous le nom
`yomu-extension.zip`.

## Installation manuelle actuelle

Suivre [INSTALL.md](../INSTALL.md). Une mise à jour GitHub ne recharge pas
l’extension installée. Remplacer les fichiers du même dossier puis utiliser
**Recharger** dans Chrome. Vérifier la version avant d’annoncer une installation
réussie. Ne pas désinstaller pour actualiser.

## Conservation des données

Conserver les clés `dasi.*` malgré le nom Yomu. Toute évolution de schéma doit
préserver les données existantes, les appartenances aux listes et les suppressions
synchronisées. Tester la migration dans un profil persistant et garder une
sauvegarde exportée avant une intervention sur un profil réel.

La suite `pnpm test:package` vérifie notamment une mise à jour dans un profil
Chromium persistant. Ce résultat ne prouve pas qu’une mise à jour a été effectuée
sur le Chrome personnel de l’utilisateur.

## Livraison

1. Modifier et tester les fonctions.
2. Incrémenter la version du manifeste pour une nouvelle livraison de l’extension.
3. Exécuter le workflow Yomu quality jusqu’à réussite de toutes ses étapes.
4. Distribuer le paquet de ce workflow réussi.
5. Recharger l’installation cible et vérifier sa version séparément.

Une publication Chrome Web Store et sa distribution automatique ne sont pas
confirmées pour ce projet. Les comptes, paiements et abonnements en production
demandent leur propre validation; les tests de code ne prouvent pas leur déploiement.
