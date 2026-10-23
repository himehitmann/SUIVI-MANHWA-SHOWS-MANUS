# Sauvegarde personnelle gratuite : mise en service

État au 23 octobre 2026 : sauvegarde en ligne non activée. Aucun hébergement ni compte fournisseur créé. Budget imposé par la propriétaire : 0 €, sans carte bancaire, sans facturation automatique et sans essai temporaire payant.

## Proposition payante retirée

La proposition Render du 21 octobre a été refusée. render.yaml et scripts/start-render.mjs sont retirés du dépôt ; aucune ressource Render n'a été créée. Ne pas réintroduire cette proposition comme prérequis à la sauvegarde personnelle. Les tests PostgreSQL existants restent utiles et sont conservés.

## Piste gratuite vérifiée : Firebase Spark

Spark permet de démarrer sans moyen de paiement. Firestore propose une base gratuite par projet : 1 Gio stocké, 50 000 lectures et 20 000 écritures quotidiennes, et 10 Gio de trafic sortant mensuel. Les quotas sont partagés par les utilisateurs du projet ; ils ne prouvent aucune capacité particulière de Yomu.

Les fonctions de sauvegarde gérée, restauration et récupération à un instant passé exigent une facturation. Elles sont donc exclues du périmètre gratuit. Ne pas lier de compte de facturation ni passer à Blaze. Une copie synchronisée Firestore survivrait à la désinstallation de l'extension, mais resterait exposée à la suppression du projet ou du compte fournisseur : ce n'est pas une sauvegarde indépendante.

Les transports d'authentification et de bibliothèque sont implémentés dans shared/firebase-auth.ts et shared/firebase-library.ts. Ils sont testés avec des réponses contrôlées et avec les émulateurs officiels Authentication/Firestore. Les règles privées sont dans firestore.rules. Ces modules sont désormais inclus dans le bundle chargé par le worker via shared/extension-sync.ts, mais les commandes de l'interface et de synchronisation ne les appellent pas encore ; aucun projet Firebase réel n'est activé. Le serveur actuel utilise Express/PostgreSQL et son propre système de sessions. Changer une adresse ou une variable d'environnement ne suffit pas à le connecter à Firebase.

Sources officielles vérifiées le 22 octobre 2026 :
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/firestore/quotas

## Travail restant avant activation

1. Raccorder les adaptateurs Firebase testés au worker et à l'interface, en conservant le protocole du serveur existant. Inclure la nouvelle voie dans les parcours Chrome du paquet distribué.
2. Le transport e-mail/mot de passe et renouvellement est testé aussi avec l'émulateur ; la demande de récupération est préparée sans envoi réel. Le gestionnaire shared/firebase-session.ts couvre les renouvellements concurrents, la déconnexion et les réponses tardives, avec neuf tests réussis. Le raccorder au stockage Chrome local protégé et aux commandes du worker, puis vérifier ces parcours sur un projet réel. Ne pas utiliser de compte anonyme.
3. Règles d'isolation par identité, refus par défaut, documents immuables et tests d'accès croisés validés dans l'émulateur. Déployer ces mêmes règles et les contrôler sur le projet réel avant activation. Aucun secret administrateur dans l'extension. Les rôles administrateur et abonnements ne doivent jamais pouvoir être accordés par une écriture du client.
4. Fusion, suppressions, conflits et fragmentation sont testés dans l'adaptateur. Lors du raccordement au worker, empêcher toute réponse tardive d'un autre compte d'écraser la bibliothèque active.
5. L'adaptateur évite les écritures de contenu inchangé, limite les lectures parallèles à quatre et conserve les données distantes si le dépôt échoue. Ajouter la planification, le délai de reprise après quota et la confirmation d'état dans le worker. Mesurer les volumes avant toute promesse de capacité gratuite.
6. États non configuré, en attente, sauvegardé et erreur ajoutés au protocole HTTP existant le 22 octobre, avec empreinte du contenu confirmé et tests de concurrence/redémarrage. Les paramètres et le compte reflètent ces états. Étendre cette confirmation à l'adaptateur gratuit lors de son intégration ; ce correctif ne l'active pas.
7. Deux versions de la bibliothèque sont conservées et la précédente peut être lue par le code ; l'interface de récupération reste à faire. Préparer une copie indépendante automatique compatible avec le budget. Des versions dans le même projet ne protègent pas contre la perte de ce projet.
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


## Réception Firebase en émulateur — 23 octobre 2026

Le job firebase-recovery exécute Firebase CLI 15.34.1 avec Java 21 et le projet fictif demo-yomu-backup. Aucun compte fournisseur ni identifiant de production n'est requis. Les transports sont redirigés explicitement vers 127.0.0.1 ; une destination inattendue est refusée. Le rapport ne contient aucun jeton, mot de passe ou contenu de bibliothèque.

Le scénario crée deux comptes synthétiques, sauvegarde des séries et webtoons avec progression, listes, sites et profil, se reconnecte sans ancienne session, renouvelle le jeton puis relit les données. Il contrôle l'accès refusé pour un autre compte et une requête non authentifiée, l'interdiction de lister les fragments, de s'accorder un rôle et de supprimer le pointeur de récupération. Il vérifie aussi l'immuabilité des fragments, les limites de manifeste, les conflits entre clients, la lecture de la version précédente et trois dépôts successifs contenant seize fragments chacun.

Les règles peuvent signaler une écriture obsolète par un refus d'accès avant d'évaluer sa précondition. L'adaptateur ne transforme ce refus en conflit qu'après une relecture autorisée prouvant que la version a changé. Un véritable refus d'accès demeure un refus ; aucune réécriture automatique n'est effectuée.

## Limites précises du stockage préparé

- La bibliothèque JSON est bornée à 4 Mio avant encodage, répartie en seize fragments de 256 Kio maximum. Le dépassement est une erreur explicite ; aucune œuvre n'est tronquée silencieusement.
- Le manifeste, les nouveaux fragments et le retrait de la plus ancienne version changent dans une seule opération atomique. La version courante et la précédente restent présentes. Une empreinte SHA-256 contrôle la reconstitution.
- Une modification réécrit actuellement le snapshot complet ; au maximum, elle peut produire 16 créations, une mise à jour du manifeste et 16 suppressions. Le plafond gratuit est partagé par le projet. Une optimisation par enregistrement reste possible avant montée en charge.
- Les fragments en base sont encodés en base64, pas chiffrés par l'application. Cet encodage augmente le stockage d'environ un tiers. Les droits d'accès reposent sur Firebase Authentication et les règles serveur ; l'empreinte sert à contrôler l'intégrité, pas à chiffrer.
- Deux versions dans le même projet ne constituent pas une copie externe et ne protègent pas contre la suppression de ce projet. Le test d'émulateur ne prouve ni la disponibilité du service hébergé ni la récupération après désinstallation réelle de Chrome.
- Aucun changement de facturation, publication Store, déploiement Firebase ou remplacement de l'extension installée n'a été effectué.
