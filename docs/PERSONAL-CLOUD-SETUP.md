# Mise en service personnelle : sauvegarde indépendante de l’extension

État au 21 octobre 2026 : configuration préparée, aucun hébergement créé, aucune protection de données réelles revendiquée. Le test CI scripts/verify-recovery.mjs vérifie une base synthétique PostgreSQL, pas le service Render ni la désinstallation réelle de Chrome.

## Proposition concrète

Le fichier render.yaml prévoit un service Node et PostgreSQL 16 à Francfort. Les déploiements automatiques sont désactivés. Le secret de session est généré par Render ; aucun mot de passe ou secret n’est à copier dans le dépôt. La base refuse les connexions publiques ; le démarrage dédié Render exige son nom d’hôte privé et TLS. Le certificat interne étant auto-signé chez Render, sa validation CA est désactivée uniquement dans cette configuration privée ; la configuration serveur générale conserve sa validation stricte.

Estimation vérifiée le 21 octobre 2026 : service 7 USD/mois + base 6 USD/mois + stockage 1 Go à 0,30 USD/mois, soit environ 13,30 USD/mois avant taxes, change, trafic ou autres dépassements. L’espace Hobby est suffisant pour cette proposition personnelle. Aucun plan Pro, domaine payant ou service supplémentaire n’est nécessaire au test initial. Le montant affiché dans Render doit être accepté par la propriétaire avant création.

Sources officielles :
- https://render.com/articles/production-rails-hosting-guide
- https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses
- https://render.com/docs/blueprint-spec
- https://render.com/docs/postgresql-creating-connecting
- https://render.com/docs/postgresql-backups

## Activation par l’opérateur

1. Créer un compte Render contrôlé par la propriétaire et connecter le dépôt GitHub. Utiliser New > Blueprint, sélectionner la branche contenant cette configuration, examiner le coût avant de confirmer. Ne pas créer les ressources sans accord sur la facturation.
2. Renseigner ALLOWED_ORIGINS avec l’origine exacte de l’extension installée (chrome-extension://IDENTIFIANT). Ajouter l’origine HTTPS du service si nécessaire. Ne pas utiliser une autorisation globale.
3. Après démarrage, vérifier /healthz, création/connexion d’un compte de test, disponibilité de la base et page Recovery. Conserver le secret de session entre déploiements.
4. Configurer l’extension avec l’adresse réelle HTTPS du service suivie de /api. La valeur DEFAULT_SYNC_API de options.js reste vide tant que cette adresse n’existe pas ; ne pas inventer une adresse.
5. Faire le parcours de réception ci-dessous avant d’importer la bibliothèque personnelle complète. Le compte invité et les comptes connectés sont volontairement séparés : les œuvres locales ne migrent pas silencieusement au premier login. Le transfert explicite de l’invité reste à préparer pour éviter toute confusion.

## Réception obligatoire avant utilisation comme bibliothèque principale

- Enregistrer une série avec saison/épisode, un webtoon avec chapitre, un film terminé, une liste et un profil sous un compte de test.
- Vérifier le succès du dépôt serveur, fermer la session et récupérer ces données depuis un profil Chrome neuf avec la même identité de compte, sans aucun export local.
- Désinstaller seulement l’extension du profil de test, la réinstaller et contrôler la récupération ; ne jamais utiliser les données personnelles pour ce test.
- Couper le réseau, modifier une progression, rétablir le réseau et contrôler la sauvegarde. Une modification encore hors ligne ne peut pas être récupérée après effacement du navigateur.
- Vérifier les indicateurs de modifications en attente : une date de dernière synchronisation seule n’atteste pas que les dernières modifications ont été transmises. Cette distinction reste à renforcer dans le produit.
- Déclencher un export de base et restaurer vers une base distincte. Contrôler les comptes et bibliothèques avant toute bascule, sans effacer la base active.
- Configurer une copie périodique externe et sa rétention avant de qualifier la protection contre une perte du compte fournisseur. La seule configuration render.yaml ne réalise pas cette copie.
- Prévoir la récupération du compte en cas de mot de passe oublié : l’envoi d’e-mails de récupération reste à vérifier avant lancement public.

## Portée des sauvegardes Render

Les bases payantes disposent de récupération à un instant passé : trois jours sur espace Hobby, sept sur Pro ou supérieur. Les exports logiques créés sont conservés sept jours par Render. Cela ne signifie pas que tous les exports sont automatiquement créés ni stockés ailleurs. La suppression de la base Render supprime aussi ses sauvegardes chez le fournisseur. Une copie externe contrôlée et testée reste nécessaire.

## Test automatisé ajouté

Le job recovery crée exclusivement deux bases jetables sur localhost dans GitHub Actions, crée un compte via l’API, enregistre des données, ferme les connexions, se reconnecte sans ancien jeton puis exécute pg_dump et pg_restore. Il supprime la base source et contrôle les données via une nouvelle connexion sur la restauration. Il vérifie aussi l’isolation d’un autre compte, le refus sans authentification et la conservation des données lors d’une synchronisation cliente vide. Le rapport ne contient pas de mots de passe, de jetons ou de dump.
