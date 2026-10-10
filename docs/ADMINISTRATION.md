# Administration Yomu

État au 20 septembre 2026 : code livré sur la branche fix/yomu-p0-reliability. Aucun compte réel n’a été promu dans un déploiement par cette intervention.

## Première activation

1. Déployer l’API avec PostgreSQL et DATABASE_URL. Le stockage fichier convient au développement, pas à cette administration en production.
2. Créer son compte Yomu normalement, puis ouvrir Réglages. Copier l’identifiant du compte affiché sous l’adresse e-mail.
3. Dans la configuration privée du serveur, définir YOMU_OWNER_IDS avec cet identifiant. Plusieurs identifiants peuvent être séparés par des virgules. Ne jamais utiliser une variable VITE_ pour ce réglage.
4. Redémarrer le serveur. Se connecter et ouvrir Réglages puis Administration. L’API doit annoncer le rôle owner et les droits Pro sans achat.
5. Vérifier avec un second compte membre que /api/admin/me et les mutations administratives sont refusés. Ne jamais faire du premier inscrit un administrateur automatiquement.

Le propriétaire est défini par l’exploitant sur le serveur. Modifier le stockage du navigateur, une adresse e-mail ou un champ envoyé par le client ne confère aucun rôle.

## Ce que la console permet

- Trouver un compte par son adresse e-mail exacte.
- Accorder ou retirer le rôle administrateur à un autre compte membre.
- Offrir un accès Pro pour 1 à 366 jours à partir de maintenant. Un nouveau cadeau remplace la date d’expiration ; il ne cumule pas automatiquement les durées.
- Retirer un cadeau avec 0 jour. Un abonnement payé reste indépendant.
- Consulter les 50 dernières opérations du journal, avec auteur, destinataire, motif et état précédent/suivant.

Un administrateur bénéficie de Pro sans payer pendant la durée de son rôle. Le propriétaire ne peut pas être rétrogradé depuis cette console. Les changements de son propre rôle sont refusés. La console n’ouvre pas les bibliothèques privées des membres.

## Confirmation et erreurs

Chaque modification demande le mot de passe actuel, un motif et une confirmation présentant le compte visé. Une version périmée est refusée pour éviter d’écraser un changement récent. Après une réponse réseau incertaine, réessayer conserve l’identifiant de la demande : le cadeau n’est pas accordé deux fois.

Les droits et la session sont relus côté serveur au moment de la transaction. La révocation bloque les nouvelles actions, y compris depuis un onglet resté ouvert. Les quotas sont de 30 requêtes administratives et 10 mutations par minute et par compte.

## Vérifications disponibles

- tests/access.test.ts : autorité, expiration, versions, rejeux et concurrence.
- tests/admin-api.test.ts : accès HTTP, mot de passe et refus de mutations non autorisées.
- scripts/verify-load.mjs : transactions sur PostgreSQL réel, rejeu après retrait et persistance du journal.
- tests/e2e/web.mjs : confirmation annulée/acceptée et console sur écran étroit. Les réponses administratives de ce parcours UI sont simulées ; les tests serveur et PostgreSQL les vérifient séparément.

La CI #422 a validé 360 tests, le parcours web et le contrôle de capacité. Le paquet extension échouait encore sur sa hauteur ; cela ne constitue pas une validation complète de publication.

## Avant mise en production

Configurer réellement le propriétaire, vérifier HTTPS, sauvegardes et restauration, réserver l’accès au serveur à l’exploitant et définir la conservation du journal. Les anciens événements sont conservés pour l’idempotence ; aucune purge planifiée n’est encore livrée. La double authentification applicative n’est pas implémentée. Les cadeaux ne doivent pas être présentés comme des paiements ni annuler des abonnements Stripe.
