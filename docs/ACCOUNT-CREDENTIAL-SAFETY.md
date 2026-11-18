# Identifiants, sessions et droits payants — 18 novembre 2026

## Problème corrigé
Les modifications d’adresse ou de mot de passe réécrivaient auparavant la totalité d’un ancien enregistrement utilisateur. Un paiement enregistré entre la lecture et l’écriture pouvait donc être remplacé par l’ancien plan. Le mot de passe, la révocation des sessions et la création de la session de remplacement étaient aussi trois écritures séparées.

## Comportement obtenu
- Une modification ne touche que le champ demandé. Le plan payé, la date de création et la bibliothèque sont conservés.
- Le serveur compare au moment de l’écriture le mot de passe réellement vérifié et la session encore valide. Une ancienne requête ne peut pas modifier le compte après révocation ou changement de mot de passe.
- La rotation du mot de passe, la révocation des sessions et la session de remplacement sont enregistrées ensemble. Une panne d’écriture annule toute l’opération.
- Une connexion en cours avec l’ancien mot de passe ne crée pas une nouvelle session après la rotation. Le serveur vérifie également que l’adresse n’a pas changé depuis la lecture.
- Deux revendications simultanées d’une même adresse donnent un succès et un conflit lisible, sans modification partielle de l’autre compte.
- Après le contrôle du fournisseur de paiement, la suppression revérifie atomiquement les identifiants, la session et le plan récurrent brut. Une session révoquée ou une activation Pro tardive empêche l’effacement.

## Implémentation et périmètre
PostgreSQL : transactions sur une seule connexion, verrouillage de la ligne utilisateur puis de la session, mises à jour ciblées et annulation en cas d’échec. Le contrôleur de suppression/facturation transmet une façade de requêtes sur sa connexion déjà acquise ; il ne tente pas de reconnecter un client PostgreSQL occupé.

Stockage fichier : une unique persistance remplace simultanément les identifiants et les sessions, après les mêmes vérifications. Ce stockage reste destiné à un seul processus ; le service public doit utiliser PostgreSQL.

Aucun changement de schéma, migration destructrice, réinitialisation de bibliothèque, nouvelle dépendance ou augmentation de prix. L’extension conserve sa version 0.4.31 : le changement porte sur le service de comptes.

La déconnexion générale invalide les sessions enregistrées au moment où elle s’exécute ; elle ne remplace pas un changement de mot de passe lorsqu’il est compromis. Une nouvelle connexion correctement authentifiée après celle-ci reste possible. En cas de réponse réseau perdue après validation d’une rotation, une reconnexion avec le nouveau mot de passe peut être nécessaire ; aucune garantie irréaliste de récupération sans identifiants n’est ajoutée.

## Vérifications
- Tests de stockage : plan et progression conservés, preuves périmées/révoquées/refusées, une seule rotation concurrente acceptée, refus des anciennes connexions, unicité des adresses et contrôle final de suppression.
- Tests HTTP : réception d’un paiement pendant une modification, révocation après vérification du mot de passe, connexion retardée, conflit d’adresse et suppression devenue non autorisée.
- `scripts/verify-credentials.mjs` : véritable PostgreSQL isolé, deux serveurs HTTP avec une seule connexion chacun, observation de l’ancien état pendant la transaction, refus de connexion tardive, échec d’insertion injecté et rollback intégral, conflit d’adresse, bibliothèque intacte et connexions libérées.
- `scripts/verify-account-deletion.mjs` : ajoute une rotation de mot de passe et une activation Pro pendant un contrôle de paiement suspendu.

Réception du code 5b930222080d1b6617eebf745228bd836c096b1e : [CI push](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/44347450957) et [CI PR](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/44347462031). **1 105 tests réussis dans 47 fichiers, dont 20 nouveaux tests** ; lint, TypeScript, compilation, parcours navigateur, paquet Chrome et mise à jour 0.3.1 → 0.4.31 réussis. Les trois jobs capacity, recovery et firebase-recovery réussissent dans les deux exécutions. Le job verify reste en échec uniquement sur l’audit obligatoire picomatch, GHSA-fc5q-39xc-vjpf. Cet échec n’est ni ignoré ni présenté comme résolu.

## Publication
Global : **21/60 = 35 %**. Ce correctif renforce les conditions de lancement sans valider le déploiement réel, la récupération d’un mot de passe oublié, l’exploitation, les offres marchandes réelles ou le Store. L’audit de dépendances picomatch reste obligatoire et bloquant jusqu’à remédiation vérifiée. **Ne pas publier ni ouvrir les ventes.**
