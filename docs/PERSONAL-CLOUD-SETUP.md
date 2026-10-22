# Sauvegarde personnelle gratuite : mise en service

État au 22 octobre 2026 : sauvegarde en ligne non activée. Aucun hébergement ni compte fournisseur créé. Budget imposé par la propriétaire : 0 €, sans carte bancaire, sans facturation automatique et sans essai temporaire payant.

## Proposition payante retirée

La proposition Render du 21 octobre a été refusée. render.yaml et scripts/start-render.mjs sont retirés du dépôt ; aucune ressource Render n'a été créée. Ne pas réintroduire cette proposition comme prérequis à la sauvegarde personnelle. Les tests PostgreSQL existants restent utiles et sont conservés.

## Piste gratuite vérifiée : Firebase Spark

Spark permet de démarrer sans moyen de paiement. Firestore propose une base gratuite par projet : 1 Gio stocké, 50 000 lectures et 20 000 écritures quotidiennes, et 10 Gio de trafic sortant mensuel. Les quotas sont partagés par les utilisateurs du projet ; ils ne prouvent aucune capacité particulière de Yomu.

Les fonctions de sauvegarde gérée, restauration et récupération à un instant passé exigent une facturation. Elles sont donc exclues du périmètre gratuit. Ne pas lier de compte de facturation ni passer à Blaze. Une copie synchronisée Firestore survivrait à la désinstallation de l'extension, mais resterait exposée à la suppression du projet ou du compte fournisseur : ce n'est pas une sauvegarde indépendante.

Cette piste n'est PAS implémentée. Le serveur actuel utilise Express/PostgreSQL et son propre système de sessions. Changer une adresse ou une variable d'environnement ne suffit pas à le connecter à Firebase.

Sources officielles vérifiées le 22 octobre 2026 :
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/firestore/quotas

## Travail restant avant activation

1. Préparer et tester un adaptateur distinct pour Firebase Authentication et Firestore ; conserver le fonctionnement du serveur existant.
2. Utiliser une identité persistante récupérable, pas un compte anonyme. Vérifier connexion, renouvellement de session, déconnexion et récupération du compte.
3. Protéger les données par identité côté Firestore, refus par défaut et tests d'accès croisés. Aucun secret administrateur dans l'extension. Les rôles administrateur et abonnements ne doivent jamais pouvoir être accordés par une écriture du client.
4. Préserver la fusion, les suppressions et l'isolation des comptes. Les bibliothèques actuelles peuvent dépasser la taille maximale d'un document Firestore : définir un stockage par enregistrement ou des versions fragmentées avant tout transfert. Une réponse tardive d'un autre compte ne doit pas écraser la bibliothèque active.
5. Limiter les lectures et écritures aux modifications utiles ; gérer les quotas et les pannes sans effacer les données locales et sans afficher « sauvegardé » avant confirmation distante.
6. États non configuré, en attente, sauvegardé et erreur ajoutés au protocole HTTP existant le 22 octobre, avec empreinte du contenu confirmé et tests de concurrence/redémarrage. Les paramètres et le compte reflètent ces états. Étendre cette confirmation à l'adaptateur gratuit lors de son intégration ; ce correctif ne l'active pas.
7. Préparer une protection contre l'écrasement accidentel et une copie indépendante automatique compatible avec le budget. Des versions dans le même projet ne protègent pas contre la perte de ce projet.
8. Créer le projet gratuit dans un compte contrôlé par la propriétaire, sans facturation ; déployer et vérifier les règles avant tout import. Aucun accès Firebase n'est actuellement connecté à cette tâche.
9. Tester les parcours ci-dessous avec des données synthétiques avant d'utiliser la bibliothèque personnelle principale.

Le point d'accès de l'extension reste vide tant qu'aucun service fonctionnel n'est configuré. Ne pas inventer d'URL ou revendiquer une synchronisation active.

## Réception obligatoire avant utilisation comme bibliothèque principale

- Enregistrer une série avec saison/épisode, un webtoon avec chapitre, un film terminé, une liste et un profil sous un compte de test.
- Vérifier le succès du dépôt serveur, fermer la session et récupérer ces données depuis un profil Chrome neuf avec la même identité de compte, sans aucun export local.
- Désinstaller seulement l’extension du profil de test, la réinstaller et contrôler la récupération ; ne jamais utiliser les données personnelles pour ce test.
- Couper le réseau, modifier une progression, rétablir le réseau et contrôler la sauvegarde. Une modification encore hors ligne ne peut pas être récupérée après effacement du navigateur.
- Vérifier les indicateurs de modifications en attente : une date de dernière synchronisation seule n’atteste pas que les dernières modifications ont été transmises. Cette distinction est désormais testée pour le protocole HTTP existant ; elle devra être reçue également sur l'adaptateur gratuit.
- Déclencher un export de base et restaurer vers une base distincte. Contrôler les comptes et bibliothèques avant toute bascule, sans effacer la base active.
- Configurer une copie périodique externe gratuite et sa rétention avant de qualifier la protection contre une perte du compte fournisseur.
- Prévoir la récupération du compte en cas de mot de passe oublié : l’envoi d’e-mails de récupération reste à vérifier avant lancement public.


## Test automatisé ajouté

Le job recovery crée exclusivement deux bases jetables sur localhost dans GitHub Actions, crée un compte via l’API, enregistre des données, ferme les connexions, se reconnecte sans ancien jeton puis exécute pg_dump et pg_restore. Il supprime la base source et contrôle les données via une nouvelle connexion sur la restauration. Il vérifie aussi l’isolation d’un autre compte, le refus sans authentification et la conservation des données lors d’une synchronisation cliente vide. Le rapport ne contient pas de mots de passe, de jetons ou de dump.

