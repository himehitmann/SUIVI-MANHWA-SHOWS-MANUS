# Suivi global Yomu

Mise à jour : 26 octobre 2026. Branche : fix/yomu-p0-reliability. Ce suivi remplace toute interprétation du précédent « 39 % » comme avancement du produit entier.

## Mesure fixe

60 critères de réception : les 36 contrôles de docs/DELIVERY-AUDIT-2026-09-16.md, plus les 24 critères produit et lancement ci-dessous. Chaque critère a le même poids. V = entièrement vérifié dans le périmètre défini ; P = partiel ; NV = non vérifié ou absent. Seuls les V comptent. Ce score est une couverture des exigences validées, pas une estimation des heures, de la qualité perçue ou du nombre de lignes de code.

**19 / 60 = 31,7 % global vérifié (32 % arrondi).** Les contrôles historiques comptent 14 V et les critères supplémentaires 5 V. G03 est rouvert après les captures utilisateur du 10 octobre. Le périmètre élargi explique la différence avec l’ancien 14/36 (39 %), qui concernait un lot d’audit uniquement. Tout changement de dénominateur devra être explicite.

## Conservation du titre saisi après échec — 26 octobre 2026

Commit 3ab061ba093b6a8ec6f5451e659b90168e9f62ea : [CI PR](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40365467635) et [CI push](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40365460752) réussies, dont 643 tests unitaires, parcours navigateur, listes, affichage, capacité et récupérations.

L'édition du titre conservait mal un échec : le rafraîchissement de la fiche rétablissait l'ancien titre en effaçant la saisie. Ce champ demande désormais de conserver son brouillon, affiche un statut accessible et un bouton Réessayer, bloque les demandes simultanées et refuse un titre vide. Le test simule échec de stockage, réponse absente, réponse tardive ignorée, reprise réussie et titre vide. Le brouillon est conservé dans la fiche courante, sans garantie après fermeture/rechargement ou autre reconstruction de la fiche. Aucun critère global supplémentaire validé ; 19/60 inchangé.

Complément du lot retrait : la validation parallèle 40364117670 s'est terminée avec verify annulé, et non réussi. La validation 40364127219 reste réussie ; le scénario de retrait passe également dans les deux nouvelles validations ci-dessus.

## Retrait d'une œuvre de la bibliothèque — 26 octobre 2026

Commit eb6b8225dcd7a50432e236d7541c8cfc12cdf1d4 : [validation réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40364127219), dont 643 tests unitaires, parcours navigateur, listes, affichage, capacité et récupérations. La validation parallèle 40364117670 est encore en cours à l'étape installation de Chromium au moment de ce relevé ; son résultat n'est pas revendiqué.

Le bouton de retrait bloque les doubles clics pendant l'attente et utilise le transport borné. Une réponse absente ou un échec rend le bouton disponible et affiche une suppression non confirmée, sans vider localement la collection. Une réponse tardive après expiration est ignorée par le transport. Une réponse réussie ne ferme pas la fiche d'une autre œuvre ouverte entre-temps. Le test de navigateur simule ces réponses : il ne retire aucune donnée utilisateur et ne démontre pas l'annulation d'une écriture côté worker après expiration. 19/60 inchangé ; G13 reste partiel. Aucune installation ni publication.

## Lecture des images et changement de sélection — 26 octobre 2026

Commit da805d9e5dd102e1902fbc9531d2f0f9f08f32a8 : [CI push](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40280396176) et [CI PR](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40280402932) réussies. 643 tests unitaires et parcours navigateur, recadrage, listes, affichage, capacité et récupérations passent.

Choisir un fichier invalide immédiatement l'ancienne image et désactive l'enregistrement pendant la lecture. Les erreurs ou abandons de lecture affichent une indication sans conserver l'ancienne image comme sélection enregistrable. Le chargement ultérieur d'une adresse d'image invalide le retour du fichier précédent. Le test simule lecture différée, retour tardif de l'ancienne image, changement vers une adresse, échec puis nouvelle sélection réussie. Ce test ciblé ne démontre pas l'absence de toute erreur image. Aucune installation dans le navigateur utilisateur ni publication. G13 reste partiel ; 19/60 inchangé.

## Préparation des tests de bibliothèque — 26 octobre 2026

Commit ad5fbdb5149b5d866e575af091680c9f8a097a07 : [CI push](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40229503716) et [CI PR](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40229508414) réussies, dont 643 tests unitaires et les parcours extension, recadrage, bibliothèque, web et récupération. Le jeu de données attend maintenant la migration dans la même file d'écriture ; des assertions vérifient l'œuvre et son appartenance à la liste avant et après les opérations. Cela supprime une course possible de préparation, sans établir que toute intermittence de production est résolue. Aucun critère global supplémentaire validé.

## Sélection et enregistrement des images — 25 octobre 2026

[CI PR réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40220908473), commit c4c68167936303870aa19cb71aa9cb3aa7b02dd1 : 643 tests unitaires, audit sans vulnérabilité connue, parcours Chrome/web, recadrage, capacité et récupérations réussis. L'exécution push parallèle 40220901971 a échoué avant le recadrage sur l'absence de alchemy-of-souls dans la liste au test extension.mjs:231. Le parcours identique passe dans la CI PR ; cause de cette intermittence non déterminée et non revendiquée comme corrigée.

Le recadrage ignore le chargement tardif d'une ancienne sélection. Une image illisible désactive l'enregistrement au lieu de conserver silencieusement l'ancienne image. Les retours de lecture de fichiers après fermeture ou nouvelle sélection sont ignorés. Pendant la sauvegarde, les actions concurrentes sont désactivées ; en cas de refus, le cadrage reste disponible avec un message de reprise. La fermeture pendant une demande ne permet pas à sa réponse de fermer un nouveau recadrage.

Les nouveaux tests contrôlent deux chargements dans l'ordre inverse, une erreur d'image, les doubles clics, la conservation du cadrage après refus et une reprise réussie. Le test de chargement utilise des événements Image contrôlés ; l'enregistrement utilise une image canvas réelle. Les contrôles de taille desktop/mobile, zoom et annulation existants passent également.

Aucun paquet installé dans le navigateur utilisateur. Global inchangé : 19/60 (32 % arrondi).

## Édition directe du profil dans la bibliothèque — 25 octobre 2026

[CI réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40214910973), commit f3e78cb9a919a2d87f779ba089e8c43e45259fe7 : 643 tests unitaires, audit sans vulnérabilité connue, parcours web/Chrome, capacité et récupérations réussis.

Les éditeurs directs du nom et de la bio ne reconstruisent plus immédiatement l'en-tête avant confirmation. Après échec, le texte reste dans le champ courant avec état d'erreur et bouton Réessayer. Entrée enregistre, Maj+Entrée permet un retour à la ligne dans la bio et Échap annule hors sauvegarde. Les commandes empêchent les doubles demandes pendant l'enregistrement. Les changements d'image ne reconstruisent plus l'en-tête en cas d'échec.

Le test Chrome ouvre la bio, saisit un brouillon, provoque un refus lors de la sortie du champ, vérifie sa conservation et clique Réessayer pour confirmer son enregistrement. La conservation concerne l'éditeur ouvert, pas un brouillon durable après rechargement. Aucun paquet installé dans le navigateur utilisateur. Global inchangé : 19/60 (32 % arrondi).

## Conservation du nom de profil après échec — 25 octobre 2026

[CI réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40184346504), commit 9194cc6a008329aaf88cc1bfd03701665e98d71c : 643 tests unitaires, audit sans vulnérabilité connue, parcours web/Chrome, capacité et récupérations réussis.

Le champ de nom n'est plus remplacé par l'ancienne valeur lorsque l'enregistrement échoue. Le texte saisi reste dans le champ ouvert, avec message d'état, aria-invalid et bouton Réessayer. Après confirmation, la valeur confirmée apparaît sans reconstruire toute la page. Le transport du profil est borné et les autres réglages en mémoire ne sont plus remplacés par la réponse du profil. Un délai dépassé ne constitue pas l'annulation de l'écriture côté worker.

Le parcours Chrome remplit le champ, déclenche un refus, vérifie le texte conservé et la disponibilité du champ, clique réellement Réessayer puis vérifie la valeur confirmée et la disparition de l'erreur. Ce brouillon est conservé dans le champ courant, pas promis après fermeture ou rechargement de la page. Les changements de photo ne reconstruisent plus les paramètres en cas d'échec.

Aucun paquet installé dans le navigateur utilisateur. Global inchangé : 19/60 (32 % arrondi).

## Reprise des listes et suivi de jeu au clavier — 25 octobre 2026

[CI réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40183517800), commit 402be642f87ad8974fb870554afa4c9abbd32936 : 643 tests unitaires, audit sans vulnérabilité connue, parcours web/Chrome, capacité et récupérations réussis.

Le transport des opérations de listes est borné. Une demande sans réponse ne retient plus indéfiniment la file de modifications des appartenances. Le message de délai dépassé indique que la sauvegarde n'est pas confirmée et demande de vérifier le contenu avant de recommencer ; une écriture engagée dans le worker n'est pas annulée. Le parcours Chrome clique sur l'ajout dans la fiche, simule une absence de réponse puis une réussite et une ancienne réponse tardive. Il vérifie déverrouillage, conservation du contenu et reprise de la file.

La préinscription d'un jeu est un véritable bouton avec aria-pressed, focus visible et protection pendant l'enregistrement. Le test utilise Entrée puis Espace pour activer et désactiver ce suivi personnel, et vérifie le maintien du focus après reconstruction de la fiche. Ce bouton enregistre un état personnel ; il ne réalise pas une inscription auprès d'une boutique.

Pas de paquet installé dans le navigateur utilisateur. Validation exhaustive de la bibliothèque et des jeux encore partielle ; global 19/60 (32 % arrondi).

## Fiches longues et notation au clavier — 25 octobre 2026

[CI réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40182931123), commit 81d30191806e818c9256bb82c7365c13b0205022 : 643 tests unitaires, audit sans vulnérabilité connue, parcours web/Chrome, capacité et récupérations réussis.

Les titres, synopsis, auteurs, alias, tags et boutons de listes peuvent revenir à la ligne dans les fiches. Les contrôles de progression peuvent se répartir sur plusieurs lignes sur petit écran. Le parcours Chrome utilise des chaînes très longues sans espaces sur une fiche de 320 px, développe le synopsis et vérifie la largeur défilante ainsi que les limites des textes et boutons. Capture dans test-results/audit-long-detail-320.png ; ce contrôle géométrique ne remplace pas la revue visuelle de tous les contenus.

Les étoiles de notation sont de vrais boutons nommés, avec état aria-pressed et focus visible. Le test vérifie Entrée pour attribuer une note, Espace pour la retirer et maintien du focus après reconstruction de la fiche. Les commandes sont désactivées pendant la sauvegarde. UPDATE_ITEM utilise maintenant le transport borné existant : une absence de réponse ne suspend plus indéfiniment la commande ; le message précise que l'enregistrement n'est pas confirmé. Le délai n'annule pas une écriture déjà engagée côté worker.

Aucune installation dans le navigateur utilisateur. Pas de nouveau critère global entièrement clos : 19/60 (32 % arrondi).

## Réglages confirmés et libellés accessibles — 25 octobre 2026

[CI réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40180544219), commit 406bcec0ef265b0a45df752c98e2ee0c59a68eba : 643 tests unitaires, audit sans vulnérabilité connue, parcours web/Chrome, audit UI enrichi, capacité et récupérations réussis.

Notifications, langue de traduction et suivi automatique attendent désormais la confirmation du worker avant de modifier leur valeur en mémoire. Les commandes sont désactivées pendant la demande puis libérées ; un refus ou une absence de réponse rétablit la dernière valeur confirmée et affiche un message explicite. Le délai n'annule pas une écriture déjà engagée côté worker ; le message demande donc de vérifier le réglage avant de recommencer. Les réponses tardives de la demande expirée ne modifient pas la vue. Seul le champ demandé est fusionné pour ne pas remplacer les autres réglages depuis une ancienne réponse.

Le parcours Chrome clique réellement les réglages, simule un refus et une réponse absente/tardive, puis confirme la reprise. Les tests vérifient le retour des valeurs affichées et le déverrouillage. Les champs nom/langues ont un nom accessible et les notifications exposent leur état de switch. Les boutons de fermeture et de couverture de fiche ont un libellé ; Fermer est traduit dans les huit langues. Le panneau de compte ignore sa réponse lorsqu'il a été retiré du DOM.

Ce lot ne valide pas toutes les langues, tous les boutons ni une revue visuelle exhaustive. Aucun paquet installé sur le navigateur utilisateur. Global inchangé : 19/60 (32 % arrondi).

## Audit transversal des commandes et chargements — 25 octobre 2026

[CI réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40141932682), commit 098318bb5e6db085a821a0ef0a8ffd398471b4e8 : 643 tests unitaires, audit sans vulnérabilité connue, parcours web/Chrome, nouvel audit UI, capacité et récupérations PostgreSQL/Firebase réussis.

L'actualisation Accueil/Jeux dispose d'un délai de réponse borné. Une absence de réponse libère les commandes dans toutes les vues déjà rendues et les réponses tardives ne remplacent pas le résultat courant. La recherche des informations manquantes réactive les deux points d'entrée après échec ou absence de réponse, avec un message visible dans la bibliothèque et les paramètres.

Les échanges des paramètres de synchronisation sont bornés à 45 secondes et absorbent les erreurs de transport. Le message précise qu'une opération peut encore finir : l'expiration de l'attente n'est pas une annulation côté worker. Le rendu de l'état du compte ignore les anciennes réponses arrivant après une demande plus récente.

Un nouveau parcours Chrome tests/e2e/ui-audit.mjs ouvre Accueil, Bibliothèque, Jeux, Offres et Paramètres à 320, 390, 768 et 1440 px. Il contrôle la navigation réelle, les limites horizontales des vues et l'absence de chevauchement des commandes d'en-tête. Il simule les pannes, réponses absentes et tardives des recommandations, de la recherche des métadonnées et du transport des paramètres, ainsi que l'inversion des réponses d'état du compte. Les captures 320 px et le rapport ui-audit.json sont conservés avec les résultats CI.

Périmètre limité : ces contrôles géométriques ne sont pas une revue visuelle exhaustive des contenus réels ni de tous les textes/langues, formulaires ou boutons. Les tests de capacité et récupération restent isolés. Sauvegarde de production, paiement réel, publication et couverture exhaustive des catalogues restent non validés. Aucun paquet installé sur le navigateur utilisateur. Aucun nouveau critère global entièrement clos : 19/60 (32 % arrondi).

## Bibliothèque : accès aux sections et ajout aux listes — 25 octobre 2026

[CI réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40140602189), commit f7deb88f765920285724d130cdfe2d566644877d : 643 tests unitaires, audit sans vulnérabilité connue, parcours web et Chrome, tests des listes, capacité et récupérations PostgreSQL/Firebase réussis. La mise à jour du profil Chrome de 0.3.1 vers 0.4.24 conserve compte, progression, listes et profil.

Les cartes d'œuvres enregistrées proposent maintenant une action visible et nommée « Ajouter à une liste ». Le titre conserve son action distincte d'ouverture de fiche. Les raccourcis Collection, Listes et Sites affichent leurs compteurs, se mettent à jour après modification et déplacent le focus vers le bon titre. Le raccourci Listes revient aux listes actives si les archives étaient affichées.

Le menu d'ajout suit le bouton après défilement et redimensionnement, reste dans la fenêtre sur petit écran et accepte les noms longs avec défilement interne. Échap rend le focus au bouton ; les flèches et Début/Fin parcourent les choix. Les écouteurs sont retirés à la fermeture. Les contrôles Chrome utilisent un vrai bouton de carte puis une page défilée à 320 px, avec 40 listes aux noms longs, et vérifient les limites après redimensionnement. Capture : test-results/library-quick-add-mobile.png.

Les anciens tests qui cliquaient le centre d'une carte ou exigeaient l'absence du bouton ont été remplacés par des contrôles des actions explicites et de leur nom accessible. Aucun paquet installé dans le navigateur utilisateur. G13 reste partiel : cette réception ne valide pas à elle seule tout le tableau de bord, les imports et la sauvegarde de production. Global inchangé : 19/60 (32 % arrondi).

## Récupération du compte préparée dans l'extension — 24 octobre 2026

[CI réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40093083009), commit 6a67df71262e45f8f7c14d9147b458ec65cb8a2c : 643 tests unitaires, audit sans vulnérabilité connue, parcours web/paquet Chrome, capacité et récupérations Firebase/PostgreSQL réussis.

Les paramètres proposent « Mot de passe oublié ». Le worker accepte la demande uniquement depuis les pages de l'extension, valide la configuration publique et l'adresse, transmet la langue du profil et conserve une temporisation d'une minute dans le stockage local protégé. L'adresse et le mot de passe ne sont pas enregistrés par ce parcours. La réponse reste identique pour une adresse inconnue. Les erreurs réseau ne sont pas présentées comme un envoi réussi. La bibliothèque et la session ne sont pas modifiées.

Cinq tests contrôlent les requêtes simulées, la confidentialité des réponses, la persistance de la temporisation après redémarrage, les refus avant réseau et les erreurs. Le parcours Chrome contrôle aussi le message honnête lorsque le service n'est pas configuré. Aucun e-mail réel envoyé et aucun lien de réinitialisation réel reçu/consommé : ces étapes restent à vérifier sur le projet gratuit.

La configuration de production reste vide et aucun accès Firebase n'est connecté. La sauvegarde personnelle après désinstallation n'est toujours pas activée. G13/G23 partiels ; global 19/60 (32 % arrondi).

## Copie explicite de la bibliothèque invitée — 24 octobre 2026

[CI réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40088857064), commit a60d7cf63536ca43c7445b11a4e232957173c651 : 638 tests unitaires, audit sans vulnérabilité connue, contrôles web et paquet Chrome, capacité et récupération PostgreSQL/Firebase réussis.

Les paramètres permettent de prévisualiser le nombre d'œuvres, listes et sites puis de copier explicitement ces données dans le compte affiché. Un reçu lié au compte, à son changement de session et à l'empreinte de la source refuse les confirmations périmées ou réutilisées. La bibliothèque invitée reste conservée. Les suppressions de l'invité ne sont pas appliquées au compte ; ses éléments déjà supprimés, paramètres techniques, profil et identifiants ne sont pas transférés. La fusion réutilise la politique additive et le remappage des références de listes existants.

Cinq tests du worker couvrent prévisualisation, conservation, changement de compte, changement de source, suppressions et accès depuis une page. Le parcours réel du paquet Chrome clique sur les deux boutons et vérifie épisodes, listes, profil du compte conservé, source intacte et état en attente. Capture de preuve dans l'artefact CI : test-results/guest-library-transfer.png.

Le transfert confirme une copie locale dans la bibliothèque du compte, pas son dépôt distant. La synchronisation est ensuite planifiée. La configuration Firebase de production reste vide ; aucun projet ni compte créé, aucun test réel de désinstallation/restitution cloud effectué. G13/G23 restent partiels, global 19/60 (32 % arrondi).

## Sauvegarde Firebase raccordée au worker — 24 octobre 2026

[CI de branche réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40088329732), commit 3b38a2d416d9f503e559c1bc9c9a0234525e2f51 : 633 tests unitaires, audit sans vulnérabilité connue, parcours web/extension, paquet Chrome et mise à jour de profil, capacité et récupérations PostgreSQL/Firebase réussis.

Le worker route maintenant les messages de connexion avec configuration Firebase vers Authentication, puis SYNC_NOW et la sauvegarde automatique vers le stockage privé Firestore. La session est renouvelée et persistée dans le stockage local protégé. La portée des caches inclut le fournisseur, le projet et l'utilisateur. Les réponses tardives sont refusées après changement de compte ; la déconnexion Firebase locale ne dépend pas d'un endpoint HTTP inexistant. Les opérations de compte HTTP non implémentées pour Firebase répondent explicitement account_action_unavailable. Le délai de reprise automatique survit à une rotation de jeton sans être appliqué à un autre compte.

Six tests supplémentaires du worker avec transport simulé couvrent la récupération depuis un worker neuf, les quotas, la déconnexion pendant une lecture, le renouvellement avec reprise différée, le refus des opérations HTTP et l'interdiction de connexion depuis un script de page. Ce test de worker neuf ne constitue pas une réception de désinstallation/réinstallation Chrome sur un projet réel.

L'audit a détecté deux alertes nouvelles dans Zod et body-parser. Le lockfile résolu par pnpm fixe Zod à 4.6.7 et body-parser à 1.20.9 via une surcharge ciblée Express. Le workflow temporaire de résolution sans scripts de paquets a été retiré après utilisation. L'audit final est propre.

Les paramètres reconnaissent le fournisseur et proposent des erreurs explicites ; le texte ne promet plus une fusion automatique de la bibliothèque invitée. DEFAULT_FIREBASE_CONFIG reste null : aucun projet réel activé, aucun accès utilisateur de production disponible, aucun compte fournisseur créé. L'import explicite des données invitées, les fonctions de gestion de compte Firebase, la copie indépendante et la réception Chrome réelle restent à terminer. G13/G23 partiels, global inchangé : 19/60 (32 % arrondi).

## Sessions Firebase préparées dans le paquet extension — 23 octobre 2026

[CI de branche réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39943797703), commit 5b0c25d41afe0c15278801675637cdfd19c8da34 : 627 tests unitaires dans 34 fichiers, dont 9 nouveaux tests de session, parcours web/extension, récupération Firebase/PostgreSQL et capacité réussis.

shared/firebase-session.ts prépare la persistance via un stockage fourni par le worker, le renouvellement groupé des connexions proches de l'expiration et la sérialisation des écritures. Une réponse tardive de renouvellement ou connexion ne peut pas rétablir un compte déconnecté ou remplacer un nouveau compte. Une erreur réseau conserve les identifiants persistés ; un échec d'écriture locale n'est pas présenté comme une connexion ou déconnexion réussie. Seuls les champs de session sont persistables, sans mot de passe ni rôle.

shared/extension-sync.ts inclut les adaptateurs et le gestionnaire dans le bundle YomuSync déjà chargé par le worker. L'import n'effectue aucun accès réseau ou stockage. Les tests du paquet généré et de mise à jour Chrome passent. Ceci prépare le raccordement, mais ne branche pas encore les commandes de l'interface, le stockage Chrome protégé, les changements de bibliothèque ou les messages de synchronisation à Firebase. Aucun projet réel ni compte fournisseur créé ; aucune récupération après désinstallation réelle validée. Global inchangé : 19/60 (32 % arrondi), G13/G23 partiels.

## Stockage Firebase privé et récupération en émulateur — 23 octobre 2026

[CI de branche réussie](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39940790456), commit 8455578d0e46e0deac3b543cd38f1b93aff167d0 : 618 tests unitaires dont 16 sur le stockage Firebase, contrôles de sécurité, parcours web et extension, capacité PostgreSQL, récupération PostgreSQL et nouveau job firebase-recovery réussis. Le run PR parallèle 39940797254 attendait encore l'installation Chromium au moment de ce relevé ; sa sonde de catalogues réels n'est pas revendiquée comme terminée.

shared/firebase-library.ts stocke une bibliothèque fragmentée avec empreinte SHA-256, dans la portée fixe du compte. Les données sont fusionnées selon la politique existante ; un client vide ne remplace pas les œuvres, et les suppressions sont conservées. Le manifeste, les fragments et le nettoyage de la plus ancienne version sont atomiques. Une version concurrente est refusée et doit être relue avant fusion. Deux versions seulement restent en base ; la précédente est lisible. Les snapshots sont bornés à 4 Mio avant encodage, avec erreur explicite au-delà, sans troncature.

firestore.rules refuse les accès entre comptes, les requêtes non authentifiées, les listes de fragments, les écritures de rôles, la modification de fragments existants et la suppression du pointeur de récupération. Les fragments encore référencés sont protégés contre la suppression. Les index de contenu des fragments sont désactivés dans la configuration.

Le test utilise les émulateurs officiels Authentication/Firestore avec Firebase CLI 15.34.1, Java 21 et demo-yomu-backup, sans projet réel. Il exerce le code REST de connexion, renouvellement, sauvegarde et récupération avec les règles chargées. Il vérifie aussi une bibliothèque de seize fragments et la rotation des deux versions. Ce contrôle a révélé qu'une écriture obsolète peut être refusée par les règles avant sa précondition : le code distingue maintenant ce conflit d'un vrai refus d'accès par une relecture autorisée.

Limites : modules non raccordés au worker distribué, projet gratuit non créé, aucune réception Chrome après désinstallation, aucune copie externe automatique. Les deux versions sont dans le même projet et ne protègent pas contre sa disparition. Les quotas gratuits doivent être suivis ; une modification réécrit actuellement le snapshot entier. G13/G23 restent partiels ; global 19/60 (32 % arrondi).

## Connexion Firebase préparée — 22 octobre 2026

[CI complète](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39805274938), commit 526eb99f4d5a045fe571517d7b282e459d9dee68 : 602 tests unitaires réussis dont 19 tests du nouveau transport Firebase, contrôles web/extension, audit des dépendances, capacité et récupération PostgreSQL réussis.

shared/firebase-auth.ts implémente les appels REST de création/connexion par e-mail, renouvellement de session et demande de réinitialisation de mot de passe. Les requêtes ciblent exclusivement les hôtes HTTPS Google fixés dans le module, refusent les redirections, omettent les cookies et expirent aussi pendant la lecture du corps. Les erreurs publiques ne contiennent pas les réponses brutes ni les identifiants secrets. Le renouvellement conserve l'identité attendue et refuse un autre projet ou utilisateur. Les métadonnées du jeton sont contrôlées, mais ce contrôle local ne vérifie pas sa signature et ne remplace jamais les règles Firestore côté service.

Le module n'est pas encore raccordé à l'interface ou au worker distribué. Aucun compte, projet, e-mail de récupération ni accès réel Firebase n'a été créé par ces tests : les réponses sont simulées. Stockage Firestore, règles d'accès, persistance locale protégée des sessions, gestion des renouvellements concurrents, projet Spark réel et réception Chrome après réinstallation restent à réaliser. Aucune nouvelle permission d'extension ni dépendance n'a été ajoutée.

Référence : https://firebase.google.com/docs/reference/rest/auth
Global inchangé : 19/60 (32 % arrondi), G13 et G23 partiels.

## Confirmation des sauvegardes — 22 octobre 2026

[CI complète](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39803503065), commit a0a09207b5a483e0580b40d9dd0eedf3955cd44b : vérification, parcours web/extension, capacité et récupération PostgreSQL réussis.

Le worker distingue maintenant local_only, pending, saved et error. Une empreinte SHA-256 du contenu envoyé est conservée uniquement après succès HTTP du dépôt serveur ; elle est comparée au contenu courant pour établir l'état. Une date historique seule ne suffit plus. L'empreinte contient les collections, suppressions et profil, sans les réglages techniques locaux. Elle est conservée au redémarrage du worker. Les changements d'ordre des clés d'objet sont neutralisés.

Cinq nouveaux tests couvrent : compte connecté sans dépôt confirmé et ancienne date, redémarrage, modification pendant un envoi, panne manuelle puis reprise, réponse tardive d'un autre compte, profil et exclusion des paramètres techniques. Les erreurs manuelles sont enregistrées aussi. Les paramètres et le panneau de compte affichent les états en français ou anglais ; les libellés se rafraîchissent sans recréer les formulaires de compte.

Portée : confirmation du protocole HTTP existant, pas sauvegarde Firebase, copie indépendante ou garantie de durabilité de l'hébergeur. Aucun hébergement n'est activé. L'adaptateur gratuit et la réception après désinstallation réelle restent à terminer ; G13 et G23 restent partiels, global 19/60 (32 % arrondi).

## Budget gratuit et contrôle de sécurité — 22 octobre 2026

La configuration de déploiement payante a été retirée dans 0123771dce3fb924d3c3477ce440445cf43aee8e. La relance des contrôles a détecté deux alertes modérées dans @vitest/mocker (GHSA-qxg6-89mg-rqv8 et GHSA-xp26-3454-mjgp). Vitest et son fichier de verrouillage ont été mis à jour vers 4.1.12, sans désactiver l'audit. Le workflow temporaire de génération du verrouillage a été supprimé.

[CI complète](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39801188749), commit fdef1ef9c7a4fda1b1c41614cc129f5787c533d4 : vérification, audit des dépendances, parcours web/extension, capacité et récupération PostgreSQL réussis. Aucun déploiement ni changement de l'extension installée. Firebase reste une piste documentée, pas une fonctionnalité livrée. G13 et G23 restent partiels ; global 19/60 (32 % arrondi).

## Préparation de la sauvegarde personnelle en ligne — 21 octobre 2026

[CI complète](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39658799771), commit 53e9394c3936533df27afdc0b188c2ec100f590f : vérification, capacité PostgreSQL isolée et nouveau job recovery réussis. Le scénario crée un compte via HTTP, enregistre séries/film/webtoon, progression, listes, sites et profil, redémarre API et connexions puis se reconnecte sans ancien jeton. Un pg_dump est restauré dans une autre base ; la source est supprimée et les données sont relues par l’API restaurée. Autre compte, requête non authentifiée et synchronisation cliente vide sont contrôlés. Ce test synthétique ne constitue pas une réception de désinstallation Chrome ni de l’hébergeur réel.

**Proposition payante annulée le 22 octobre après refus utilisateur.** render.yaml et scripts/start-render.mjs sont retirés, ainsi que le contrôle CI de ce script. Aucun service n'a été créé. Budget strict : 0 €, sans carte et sans facturation automatique. Firebase Spark est une piste gratuite vérifiée, mais son intégration dans Yomu n'est pas réalisée ; ses sauvegardes gérées nécessitent une facturation et ne sont pas retenues. Voir docs/PERSONAL-CLOUD-SETUP.md pour les limites et les étapes restantes. Les tests de récupération PostgreSQL sont conservés et ne constituent pas des tests Firebase.

L’utilisateur confirme ne disposer d’aucun hébergement. Le point d’accès de l’extension reste vide. Activation du compte fournisseur, essai sur Chrome neuf, indicateurs de sauvegarde en attente, transfert explicite de la bibliothèque invitée et copie externe périodique restent à terminer. Ne pas conseiller d’utiliser Yomu comme seule copie personnelle avant réception. G23 reste P ; score inchangé 19/60 (32 %).

## Bibliothèque : réordonnancement préservant les autres modifications — 21 octobre 2026

[CI](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39572649471), commit 7d47a138f2a18a3308973a8da0d0cfb81a89681c : contrôles réussis. LIST_REORDER_ITEMS réordonne les membres encore présents et conserve les ajouts absents de l’ancienne vue. Une suppression concurrente ne peut être annulée par le réordonnancement. Les boutons haut/bas et la sauvegarde du glisser-déposer utilisent cette opération. Tests d’ajout concurrent, retrait concurrent, enregistrement du nouvel ordre et données invalides. G13 reste partiel.

## Bibliothèque : retrait groupé sans écraser les ajouts concurrents — 21 octobre 2026

[CI complète](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39571638240), commit 76e2b243db7756d74760208153e65179d680032e : vérification complète et capacité PostgreSQL isolée réussies. Le retrait groupé transmet uniquement les identifiants sélectionnés au service worker. Celui-ci relit la liste dans la file de mutations avant de retirer ces membres, au lieu de remplacer sa totalité par un instantané de la vue. Les ajouts effectués entre-temps dans une autre vue sont conservés.

Le parcours Chrome garde volontairement une vue ancienne, ajoute une œuvre côté stockage, simule un échec de retrait, vérifie que la sélection et les données sont conservées, puis réessaie et contrôle la conservation de l’ajout concurrent. Les requêtes malformées sont rejetées et les œuvres sauvegardées restent intactes. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : changement de présentation et correctif de sécurité — 21 octobre 2026

[CI complète](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39570260034), commit 0fdcc5fbb2363a8653206134c32a19c13aa5597f : vérification complète et capacité PostgreSQL isolée réussies. Le bouton de présentation lignes/grille est désactivé pendant l’enregistrement et indique son état occupé. Un échec conserve la présentation précédente et permet de réessayer ; le focus revient au bouton après un changement réussi au clavier.

Le parcours Chrome retarde la réponse, simule un refus, vérifie la conservation de la vue en lignes, puis réessaie avec Entrée et contrôle la grille, le focus et la valeur sauvegardée. L’audit initial a bloqué les tests sur trois nouveaux avis concernant Vite 7.3.6 ; Vite passe à 7.3.7 avec un verrouillage régénéré par pnpm. Le workflow temporaire de génération est supprimé. L’audit des dépendances et tous les tests passent après cette mise à jour.

G13 reste partiel : la revue visuelle complète et la réception globale restent à effectuer. Score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : aller-retour au clavier dans les listes — 20 octobre 2026

[CI #885](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39464823450), commit d36649f42843cbab5fc6b6e284dabe39a3722bed : vérification complète et capacité PostgreSQL isolée réussies. Ouvrir une liste place le focus sur son bouton de retour. Revenir à la bibliothèque restitue le focus au titre de cette liste si elle reste affichée, ou au bouton de création si elle n’est plus visible. Les actualisations sans liste précédemment ouverte ne déplacent pas le focus.

Le parcours Chrome ouvre et quitte une liste avec Entrée, contrôle le focus dans les deux vues et vérifie que la fiche est masquée au retour. Les scénarios de création, archivage et suppression restent réussis. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : filtre « Sans liste » au retour des détails — 20 octobre 2026

[CI #881](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39458410972), commit 7307b3284567bc6624a123da420da66334e833af : vérification complète et capacité PostgreSQL isolée réussies. Le retour depuis une liste recalcule la grille de bibliothèque à partir des appartenances courantes, en conservant recherche et filtres. Il n’affiche plus une grille périmée après un ajout ou un retrait de membre.

Le parcours Chrome recherche une œuvre avec « Sans liste », l’ajoute à une liste, revient et vérifie son absence ; il la retire ensuite, revient et vérifie sa réapparition. La recherche et le filtre restent sélectionnés dans les deux cas. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : suppression cohérente depuis la fiche — 20 octobre 2026

[CI #877](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39455458335), commit 25651a0394d3f7778ce80961c1a874bed3b884d4 : vérification complète et capacité PostgreSQL isolée réussies. Le récapitulatif et la fiche d’une liste utilisent la même confirmation modale de suppression, avec rappel que les œuvres sont conservées. Le retour du focus vérifie que le déclencheur est encore visible : après suppression depuis une fiche masquée, le focus rejoint le bouton de création de liste.

Le parcours Chrome annule depuis la fiche et contrôle le retour au bouton Supprimer, confirme ensuite, vérifie la fermeture de la fiche, le retour à la bibliothèque, le focus et la conservation des trois œuvres sauvegardées. Les scénarios d’échec et de nouvel essai de la confirmation commune passent aussi. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : confirmation de suppression et focus — 20 octobre 2026

[CI #873](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39450599521), commit 7d9ca6b63226d6bc57313f006ec373b6fb1216ca : vérification complète et capacité PostgreSQL isolée réussies. La confirmation de suppression depuis le récapitulatif utilise une boîte de dialogue modale, une description accessible et une boucle de navigation entre les boutons activés. Échap annule et rend le focus au déclencheur ; après suppression, le focus revient au bouton de création de liste.

Le parcours Chrome vérifie Tab/Maj+Tab, l’annulation, un refus de suppression avec conservation de la liste, le nouvel essai et le focus final. Le premier passage a révélé que la navigation native seule ne faisait pas revenir Maj+Tab au dernier bouton ; la gestion explicite de cette limite corrige ce cas. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : renommage échoué et nouvel essai — 20 octobre 2026

[CI #867](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39410459309), commit ee59c58f2e006c0620f96d07dec6286f6f7ca895 : vérification complète et capacité PostgreSQL isolée réussies. Le renommage indique l’enregistrement en cours et désactive le champ pendant la requête. En cas d’échec, le brouillon reste visible, un message associé au champ précise qu’il n’est pas enregistré et un bouton permet de réessayer. Une valeur vide conserve le nom sauvegardé, sans le remplacer par « Untitled ».

Le parcours Chrome injecte un refus d’enregistrement, vérifie le brouillon et le nom persistant inchangé, rétablit le transport, réessaie avec succès et vérifie le comportement d’un nom vide. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : création depuis les archives — 20 octobre 2026

[CI #863](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39407948756), commit 39e6da6b8a2cff5e7bebf22928dbae4509b07081 : vérification complète et capacité PostgreSQL isolée réussies. L’ouverture d’une liste aligne le filtre actif/archive sur cette liste. Une nouvelle liste active créée depuis les archives ne disparaît donc plus du récapitulatif au retour. La création place le focus sur le nom et le sélectionne pour permettre son remplacement immédiat ; ce champ possède un nom accessible.

Le parcours Chrome crée depuis les archives, contrôle focus et sélection, renomme, revient aux listes actives, vérifie la présence de la nouvelle liste puis la supprime. Les parcours antérieurs d’archivage/restauration passent aussi. G13 reste partiel, car la revue visuelle complète et la réception globale restent à effectuer. Score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Validation consolidée de la bibliothèque — 20 octobre 2026

[CI #859](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39280992887), commit b850ad98f4ea4655baa4a2446d1e3c395cf21cf7 : les jobs verify et capacity sont réussis. Les contrôles sécurité et dépendances, lint, TypeScript, tests unitaires, construction, tests web, extension empaquetée, listes, recadrage et vidéo passent. La sonde des catalogues de l’accueil passe également. Le test de capacité utilise PostgreSQL isolé et ne mesure pas une capacité de production.

Les quatre lots jusque-là en attente sont désormais couverts ensemble : remise à zéro locale sans effacer le catalogue ; recherche conservée lors des ajouts/retraits ; navigation active/archive avec compteurs et états vides ; filtre « En cours » et sélection accessible. G13 reste partiel car la revue visuelle complète et la réception globale de la bibliothèque ne sont pas acquises par ces parcours ciblés. Score inchangé : 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : filtres de progression et navigation des listes — 19 octobre 2026

Ajout du filtre « En cours », utilisant le même état de progression que les fiches. Les filtres exposent leur sélection avec aria-pressed et conservent le focus au clavier après activation. Le parcours Chrome ajouté vérifie la séparation entre œuvres en cours, prévues et terminées, puis le retour à toutes les œuvres.

Le lot précédent (4da0c7329f22af7f8f7bffe1db41c3bd58e88c71) clarifie les listes actives/archivées, leurs nombres et leurs états vides. La syntaxe de library.js a été contrôlée par compilation sans exécution ; des contrôles isolés sur DOM simulé couvrent les listes actives/archivées, états vides, focus de la bascule et échappement du titre. Ces contrôles ne remplacent pas Chrome. Validation du 20 octobre : [CI #859](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39280992887) réussie sur b850ad98f4ea4655baa4a2446d1e3c395cf21cf7, incluant les parcours Chrome de ces lots. G13 partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : recherche conservée pendant les ajouts à une liste — 19 octobre 2026

Commit 839cbfbc321cbe448236e547b9c6ab42bcbb7293 : la recherche d’œuvres à ajouter reste affichée après les changements de membres et de présentation de la liste. Elle est réinitialisée à la fermeture ou à l’ouverture d’une autre liste. La correspondance ignore les accents et inclut les alias, auteurs et étiquettes. Le bouton d’ajout est désactivé pendant l’opération ; le focus revient au champ de recherche si le bouton disparaît après son activation.

Le parcours Chrome couvre un alias accentué recherché sans accents, la conservation de la recherche après ajout/retrait, les résultats recalculés et le retour du focus ; il vérifie aussi le champ vide après rechargement. Validation acquise le 20 octobre dans [CI #859](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39280992887), qui inclut ce changement et son parcours Chrome. G13 reste partiel, score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : remise à zéro indépendante du catalogue — 19 octobre 2026

Commit a9173b8d81131ff40db79ada59d8de17efde4458 : la remise à zéro agit uniquement sur la recherche et les filtres de bibliothèque ; elle conserve la recherche catalogue et replace le focus dans le champ local. La commande reste disponible lorsqu’un filtre actif laisse toutes les œuvres visibles. Un scénario Chrome couvre ces comportements, dont l’activation au clavier.

Validation acquise le 20 octobre dans [CI #859](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39280992887), qui inclut ce changement et son parcours Chrome. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : notes et favoris au clavier — 19 octobre 2026

[CI #845](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39152197261), commit abfc20345d9c8b8b979110579fa3ee2f18694bf5 : vérification complète et capacité PostgreSQL isolée réussies. Les étoiles sont de vrais boutons nommés avec la note et le titre de l’œuvre ; leur état sélectionné est exposé par aria-pressed. Notes et favoris sont désactivés pendant leur enregistrement, puis le focus revient sur la commande correspondante après le rendu. Si retirer un favori masque sa carte, le focus revient au filtre actif.

Parcours Chrome : noter au clavier, annoncer la sélection, effacer la note par un second appui, ajouter un favori, vérifier son compteur, filtrer puis retirer ce favori et retrouver le focus sur le filtre ; persistance de la note et du favori vérifiée dans le service worker. G13 reste partiel : ces tests ne remplacent pas la revue visuelle complète de la bibliothèque. Score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : recherche locale distincte du catalogue — 18 octobre 2026

[CI #841](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39151705729), commit 2867dc5855cc3469eb9917f0b13a7ed6bea4e9e7 : vérification complète et capacité PostgreSQL isolée réussies. Un champ dédié filtre les œuvres sauvegardées par titre, alias, auteur, progression et étiquette, avec normalisation des accents. Il utilise un état distinct de la recherche catalogue et se combine aux filtres existants. La saisie conserve focus et sélection ; la remise à zéro efface également ce filtre local.

Scénarios Chrome : titre alternatif accentué retrouvé sans accents, recherche par auteur, focus conservé, aucun message de recherche envoyé au service pendant la saisie, champ global inchangé et retour aux sept œuvres après remise à zéro. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : appartenances enregistrées côté service worker — 18 octobre 2026

[CI #837](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39149184959), commit a23c2832523e06906f90e4df56973875356f12a8 : vérification complète et capacité PostgreSQL isolée réussies. Les ajouts/retraits individuels depuis une liste, une fiche ou le menu rapide envoient désormais une intention LIST_MEMBERSHIP (liste, œuvre, ajouter/retirer), plutôt qu’une copie entière des membres. La file de mutation du service worker applique cette intention à l’état sauvegardé courant et vérifie l’existence des références. Le bouton de fiche est désactivé pendant son enregistrement et réactivé en cas d’échec.

Parcours Chrome : deux ajouts simultanés conservés, membre inexistant refusé, ajout/retrait depuis la fiche ; scénarios d’ajouts rapides et rechargement de l’extension conservés. Ce lot protège les actions locales utilisant cette opération ; il ne valide pas toutes les courses de synchronisation multi-appareils. G13 partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : création d’une liste avec une œuvre — 18 octobre 2026

[CI #833](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39113237971), commit ef4b51f79a6e603f8fa90d6b9852abc941c615df : vérification complète et capacité PostgreSQL isolée réussies. La création depuis l’ajout rapide fournit les membres initiaux au service worker, qui valide leur existence avant une seule écriture. Une création échouée ne déclenche plus d’ajout à la dernière liste existante. Création et duplication ouvrent la liste identifiée dans la réponse plutôt que de supposer qu’elle est en dernière position.

Parcours Chrome : échec simulé sans modification des listes, bouton réessayable, création réussie avec l’œuvre, rejet d’un membre inexistant ; les parcours existants de duplication/archivage/restauration restent réussis. G13 partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : grille, états vides et clavier — 18 octobre 2026

[CI #829](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39112864699), commit 68343ff8aeb5ad3dd27935452cf76a78ecab7a9b : vérification complète et capacité PostgreSQL isolée réussies. Le compteur des résultats occupe toute la largeur de la grille au lieu d’une colonne d’affiche. Un filtre sans correspondance indique que les œuvres sont conservées ; une collection vide guide vers la recherche. Une collection composée uniquement de jeux propose l’accès à leur onglet. Les listes s’ouvrent via un vrai bouton de titre au clavier ; le bouton de création sans texte reçoit un nom accessible.

Parcours Chrome : ouverture par Entrée, message filtré, remise à zéro des filtres, largeur du compteur, focus du champ de recherche et accès aux jeux. G13 reste partiel ; revue visuelle complète et validation globale distinctes de ces parcours. Score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : cycle de vie et ordre visible des listes — 18 octobre 2026

[CI #825](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39112383496), commit 0ce5f65299d1aca0822c08f16a9feac87b31775b : vérification complète et capacité PostgreSQL isolée réussies. Les commandes de réorganisation utilisent les membres présents et uniques, comme le rendu : les identifiants absents ou doublonnés d’une liste importée ne créent plus d’étapes invisibles ni de boutons activés à tort.

Parcours Chrome : duplication, renommage, archivage (masqué parmi les listes actives), restauration, suppression de la copie, conservation de la liste originale et des œuvres ; puis import de références manquantes/doublonnées, déplacement entre deux lignes visibles et contrôle des limites Monter/Descendre. G13 reste partiel : cette preuve couvre le cycle des listes et ne remplace pas la revue visuelle totale du tableau de bord. Score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : déplacement groupé en une seule écriture — 17 octobre 2026

[CI #821](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39070108008), commit 6ba380418755a85ed1601b2ca9adfb933c13cb60 : vérification complète et capacité PostgreSQL isolée réussies. LIST_TRANSFER calcule copie/déplacement depuis les listes courantes dans la file de mutation du service worker, valide source/destination distinctes, destination active, action et appartenance des œuvres sélectionnées, puis enregistre les deux listes en une seule écriture locale. Le déplacement n’effectue plus deux sauvegardes séparées susceptibles de laisser une copie partielle.

Scénarios Chrome : copie conservant la source, panne de transport, panne injectée au niveau du stockage local laissant les deux listes inchangées, nouvel essai réussi, refus d’une œuvre absente de la source, réorganisation clavier et retrait préservant les œuvres, largeur mobile. Le premier essai de simulation de panne réaffectait une constante ; la simulation a été corrigée au niveau du stockage. Périmètre local : ce lot ne prouve pas une transaction distribuée multi-appareils. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : ajouts rapides et rechargement — 17 octobre 2026

[CI #815](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39069142594), commit 843d8db329a91495f0ac95db02f4e3d492568b70 : vérification complète et capacité PostgreSQL isolée réussies. Les ajouts/retraits individuels depuis le détail d’une liste sont enregistrés dans l’ordre ; chaque action calcule ses membres depuis le dernier état confirmé, plutôt que depuis la fermeture du rendu précédent. Cela empêche deux clics rapides de remplacer l’un des ajouts. Scénario Chrome avec transport volontairement retardé : deux ajouts consécutifs, contrôle du stockage puis rechargement réel, deux œuvres conservées ; retrait précédent également conservé après rechargement. Périmètre : actions individuelles de cette vue, pas une garantie de concurrence multi-appareils pour toutes les mutations. G13 reste partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : navigation et ajout dans les listes — 17 octobre 2026

[CI #811](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39068497547), commit 508b07b54d1e5f3c3e4045d0276b0c25be739cc2 : vérification complète et capacité PostgreSQL isolée réussies.

Les titres ouvrent les fiches depuis une liste en grille ou en lignes, avec des boutons accessibles au clavier. Le retrait est explicitement nommé « Retirer de la liste ». Les listes vides disposent d’une explication. L’ajout depuis la bibliothèque dispose d’une recherche incluant les titres alternatifs, d’un compteur et de 50 choix maximum simultanés. Parcours Chrome avec 65 œuvres supplémentaires : recherche d’un alias, ajout persistant, ouverture au clavier et en grille, retrait de la liste sans suppression de l’œuvre.

Sur le web, la catégorie Jeux figure dans la barre principale ; un résultat filtré vide ne prétend plus que la bibliothèque est vide et propose de réinitialiser les filtres. « Voir tout » efface aussi la recherche et rejoint les œuvres. Ces ajustements passent la suite web existante ; revue visuelle globale toujours requise. G13 partiel ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Lot parallèle : listes, filtres traduits et fiches de secours — 17 octobre 2026

[CI #805](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39050094135), commit fe1477a2e40138f8a90dbc8ec865feaf6bbec8f4 : vérification complète et capacité PostgreSQL isolée réussies.

- Extension : compteurs et contenu de listes fondés sur des œuvres présentes et uniques ; listes archivées exclues de l’ajout rapide. Une suppression de site échouée ne masque plus le favori et laisse réessayer. Scénarios Chrome : doublons/références absentes, choix actifs, échec sans perte puis suppression persistée.
- Recherche web : formats lisibles, pays localisés et genres communs traduits FR/EN ; clés internes conservées pour les filtres. Séparateurs médians supprimés sur les cartes concernées. Quatre tests ; genres inconnus conservés tels quels.
- Catalogue de secours AniList : identifiants positifs vérifiés, URL canonique fixe, titres originaux/alternatifs, synopsis, genres, année, image large et total connu préservés. Totaux inconnus non inventés ; erreur GraphQL signalée au lieu d’un faux résultat vide. Trois tests, dont passage résultat vers création d’œuvre.

Ces changements ne garantissent ni traduction des synopsis, ni disponibilité universelle des bandes-annonces, ni catalogue exhaustif. G05, G08 et G13 restent partiels ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Lot parallèle : bibliothèque, langue et pertinence — 17 octobre 2026

[CI #801](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39027100721), commit 36cdb40eaf3b87f072b936d34a050d1d7bf9ab4b : vérification complète et capacité PostgreSQL isolée réussies ; CI push #800 également réussie.

- Bibliothèque extension : les compteurs favoris/terminés excluent les jeux comme la grille qu’ils décrivent. Les sites favoris disposent d’un véritable bouton de suppression accessible au clavier, séparé du lien ; un lien importé non HTTP(S) n’est plus rendu cliquable. Parcours Chrome : compteurs avec œuvres et jeux mélangés, suppression avec Entrée et persistance dans le stockage, conservation d’un autre favori.
- Langue web : dates relatives traduites FR/EN, dates anciennes selon la langue de l’application, arrondis temporels corrigés et horodatages invalides gérés. Séparateurs médians retirés des marqueurs de progression partagés et de l’accueil concernés. Douze cas de régression. Cela ne valide pas la traduction des synopsis.
- Recherche web fédérée : titres originaux/alternatifs exacts prioritaires, puis préfixes et mots complets avant mentions indirectes ; accents/ponctuation normalisés, écritures non latines et ordre stable conservés. Quatre tests, dont parcours de recherche fédérée et cache. Aucun élargissement de catalogue ni exhaustivité revendiquée.

G08 et G13 restent partiels ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Actualisation des métadonnées pendant une modification de progression — 17 octobre 2026

[CI #797](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39023557578), commit 85bc793d5477f9d982b4fb7afa3493276136ea0a : vérification complète et capacité PostgreSQL isolée réussies. Une modification de progression invalidait correctement une ancienne réponse, mais pouvait abandonner l’actualisation des métadonnées encore attendue. Un indicateur conserve désormais cette actualisation jusqu’à l’application d’une réponse valide ou d’une hydratation explicite. Le scénario Chrome vérifie simultanément le rejet de l’ancien épisode, le maintien du nouvel épisode et l’application du synopsis frais via une nouvelle lecture. Les réponses périmées ne peuvent pas effacer cet indicateur. Aucun changement de score : bibliothèque encore partielle, 19/60 (32 %). Aucun déploiement ni publication.

## Bibliothèque : réponses de rafraîchissement périmées — 17 octobre 2026

[CI #793](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/39020625433), commit 4c981d247ee0ce63174044e3829d02c804259c7c : vérification complète et capacité PostgreSQL isolée réussies. Le correctif 4a2761f8c6192006d55666deef694f3246a307bd ajoute une version aux lectures de fond GET_STATE : une réponse ancienne ne peut plus remplacer une bibliothèque actualisée. Une modification de progression seule ou une hydratation explicite invalide également les réponses en attente. Trois scénarios Chrome sur l’extension empaquetée livrent les réponses hors ordre et vérifient la conservation des fiches et de la progression. Le parcours existant d’ouverture d’Alchemy of Souls reste inchangé et réussit. Le premier essai du nouveau test comptait les deux contrôles d’ouverture d’une seule fiche ; le sélecteur corrigé compte les articles, sans relâcher l’exigence d’une seule fiche. Cette course est reproduite et couverte ; son lien avec l’expiration initiale de #787 reste une hypothèse, pas une cause démontrée. La bibliothèque complète reste partiellement validée ; score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Remboursement intégral Stripe Lifetime — 16 octobre 2026

[CI #775](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38904735402), commit 3d0c0699b1cfd61b61b04a88e103c267ccea6397 : suite complète et capacité isolée réussies. Le webhook signé vérifie la charge actuelle, le total des remboursements réussis, la session Checkout correspondant au PaymentIntent et le produit Lifetime configuré. Retrait du seul achat remboursé ; autres achats Lifetime, abonnements et anciens droits non rattachés conservés. Marqueur durable empêchant les confirmations tardives de réactiver cet achat. Tests : remboursement partiel/en attente/échoué, sommes de remboursements, preuves incohérentes, signature invalide, panne fournisseur réessayable, livraison avant achat, dates égales, doublons, mauvais compte, redémarrage fichier et PostgreSQL, remboursements simultanés avec conservation de Pro. Les tests HTTP simulent Stripe ; aucun remboursement réel ni cycle déployé effectué. Configuration des événements et limites dans [STRIPE-REFUNDS.md](STRIPE-REFUNDS.md). Paddle, contestations, réconciliation des abonnements à dates égales et cycle fournisseur sur le déploiement restent ouverts. G20 partiel, score inchangé 19/60 (32 %). Aucun déploiement ni publication.

## Remboursement intégral Paddle Lifetime — 16 octobre 2026

[CI #779](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38907991187), commit edae4209952569e729dc80708eb3ff41c9a06f03 : suite complète et capacité isolée réussies. Prise en charge des événements signés adjustment.created/updated lorsqu’un remboursement intégral est approuvé. Lecture bornée de la transaction Paddle et vérification du client, produit, devise et montant ; environnements sandbox/live explicites. Marqueur de remboursement et agrégation des autres droits réutilisés. Tests unitaires/HTTP : signatures, partiel/en attente/avoir/contestation ignorés, produit étranger, réponse incohérente, panne réessayable, doublon et ancienne attribution. PostgreSQL : doublons simultanés, conservation d’un abonnement Stripe, ancienne attribution bloquée et relecture par connexion indépendante. [Configuration et limites](PADDLE-REFUNDS.md). Aucun remboursement réel, déploiement ni publication. Sommes de remboursements partiels Paddle, contestations et cycle fournisseur déployé restent à valider. G20 partiel ; score 19/60 (32 %) inchangé.

## Réconciliation des abonnements à dates égales — 16 octobre 2026

[CI #783](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38913963742), commit b01ddb10f9680a68405b551b7663c0205e605dcf : suite complète et capacité isolée réussies. Un conflit de plans à date fournisseur égale relit désormais l’abonnement exact chez Stripe/Paddle, vérifie produit et rattachement au compte, puis applique les droits agrégés. PostgreSQL garde ses verrous pendant la lecture bornée ; le stockage fichier refuse une réponse devenue périmée par une modification concurrente. Un marqueur durable oblige les livraisons suivantes non anciennes de cette ressource à vérifier également le prestataire, pour empêcher une notification intermédiaire de remplacer l’état courant. Tests HTTP signés sur les deux fournisseurs, panne réessayable sans consommation du reçu, doublons, réponse étrangère, produit inconnu, ancien événement, changement concurrent, redémarrage et PostgreSQL avec connexions indépendantes. [Configuration et coût des lectures](BILLING-RECONCILIATION.md). Aucun cycle fournisseur déployé, encaissement réel ni publication. G20 reste partiel ; score 19/60 (32 %) inchangé.

## Cumul des remboursements partiels Paddle — 16 octobre 2026

[CI #787](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38948738071), commit 4375f2d3f725b3d2f6c934c727098d3b1f1852b7 : suite complète réussie à la seconde exécution ; capacité PostgreSQL réussie dès la première. Un ajustement partiel approuvé déclenche la lecture bornée des ajustements de la transaction. Seuls les remboursements approuvés sont additionnés ; le cumul doit atteindre exactement le montant d’achat vérifié. Première moitié : accès conservé ; deuxième moitié : retrait de l’achat, avec marqueur durable déjà validé. Tests : deux moitiés, attente/rejet/avoir/contestation non comptés, doublons, client/transaction/devise incorrects, total excessif, pagination restante, ajustement déclencheur absent et ancien achat livré après remboursement. Réponses incomplètes réessayables ; limite d’une page de 100 ajustements et 64 Kio. Permissions serveur et recette mises à jour dans [PADDLE-REFUNDS.md](PADDLE-REFUNDS.md). La première exécution de #787 a expiré en attendant la carte alchemy-of-souls dans tests/e2e/extension.mjs:329 ; le même code a réussi dans la CI push #786 et lors de la relance ciblée du job verify de #787. Cause intermittente non identifiée : garder ce parcours bibliothèque ouvert à investigation, sans affaiblir le test. Aucun remboursement réel ni cycle déployé validé. G20 partiel, score inchangé 19/60 (32 %).

## Pourquoi le compteur évolue peu

Le compteur attribue un point uniquement à un critère entièrement vérifié. Plusieurs corrections peuvent donc améliorer un même critère partiel sans ajouter de point. Il ne mesure pas le travail réalisé ni le temps restant. Les preuves documentaires étaient aussi restées au 20 septembre : elles sont désormais actualisées.

La livraison a été trop fragmentée en petits correctifs. Priorité : terminer des parcours cohérents, puis les comparer aux critères de réception. Ne pas ajouter de critères plus faciles ni reclasser un critère uniquement pour augmenter le score.

G03 avait été validé, mais les captures utilisateur du 10 octobre montrent des écarts visuels importants. Il repasse partiel : la validation antérieure était insuffisante. Les corrections de hauteur de bannière, de cartes uniformes et de navigation sont en cours de revalidation. Le dénominateur reste 60. G09 est également validé depuis la CI #614 : combinaison des filtres et distinction explicite entre œuvre/série terminée, saison/partie terminée et portée inconnue, avec sauvegarde et rechargement vérifiés dans Chrome.

## Preuves actuelles

[CI #771](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38797066517), commit 52f257d92eef1acf38b9d55c19619fa8aac4fa93 : suite complète et capacité isolée réussies. Les événements ordonnés de facturation recalculent désormais les droits à partir des abonnements enregistrés du compte : annuler une ressource ne supprime pas Pro si une autre demeure active. Implémentations fichier et PostgreSQL cohérentes ; transactions et verrou du compte existants conservés. Tests : abonnements Stripe/Paddle, annulation d’un seul puis de tous, événement ancien ignoré, redémarrage, compte distinct et renouvellement/annulation simultanés. La sonde PostgreSQL relit les droits via un pool indépendant et vérifie la descente à gratuit après clôture du dernier abonnement. Correction préparée antérieurement mais non intégrée, reprise après comparaison exacte des quatre fichiers avec leur base. Ce lot ne traite pas les remboursements Lifetime ni les événements de dates égales contradictoires ; aucun encaissement réel ou cycle fournisseur déployé validé. G20 reste partiel ; score inchangé 19/60. Aucun déploiement ni publication.

[CI #767](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38584169795), commit f0f9723fe7cdfe8b1ae18e08ff672f44eb0a8656 : suite complète et capacité isolée réussies. Les réponses Steam enregistrent la disponibilité du prix et l’instant de consultation. Les fiches catalogue et bibliothèque affichent une indication traduite dans huit langues : prix indicatif pour une réponse disponible datant de moins de dix minutes au rendu, dernier prix connu sinon (absence, ancien enregistrement, donnée expirée). Le montant et ses deux métadonnées sont protégés ensemble contre une modification concurrente. Tests : réponse sans prix conservant le montant mais marquant son indisponibilité, persistance après restauration, protection de l’ensemble des champs, libellés français pour prix récent/absent/ancien et présence du montant dans la fiche. Aucune actualisation continue du libellé pendant une fiche laissée ouverte, aucune garantie du prix au paiement ni de la région ; tests fournisseurs simulés. Score inchangé 19/60. Aucun déploiement ni mise à jour du Chrome utilisateur.

[CI #763](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38583079648), commit 2be2488cc0a2a083948556fa0a0fb9ee12d51f96 : suite complète et capacité isolée réussies. La requête Steam appdetails demande price_overview ; son prix formaté est retenu avec sa devise fournisseur, sous validation du montant entier non négatif et du code devise. is_free explicite produit Free, absence de prix ne devient pas gratuit. L’enrichissement remplace désormais un prix enregistré lorsqu’une valeur est disponible ; la garde de modifications concurrentes reste active. Tests simulés : extraction, prix nul/absent/invalide, requête contenant le filtre, prix payant modifié puis gratuit via GAME_ENRICH, note conservée et édition concurrente préservée. Aucun prix en boutique n’a été certifié en direct ; l’accès de vérification web à appdetails était indisponible. Sans prix fournisseur, l’ancien est conservé et peut être périmé ; pas de conversion ni garantie régionale, ni validation des autres boutiques. Score inchangé 19/60. Aucun déploiement ni mise à jour du Chrome utilisateur.

[CI #759](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38581785747), commit 3e0977b1fb08f80bc0333e6855454e9f848ebea6 : suite complète et capacité isolée réussies. Le guide des saisons/épisodes utilise désormais l’attente bornée à quinze secondes, avec retour d’erreur et bouton de reprise existants. Test Chrome à délai réduit : absence de réponse pour les saisons, reprise, absence de réponse pour les épisodes, retrait de l’état occupé, nouvelle reprise réussie ; les deux anciennes réponses tardives n’effacent pas l’épisode récupéré. Ce test simule les réponses et ne valide pas l’exhaustivité du catalogue TVmaze. Le délai ne suspend pas une requête déjà en cours dans le service worker. Total inchangé 19/60 ; aucun déploiement ni changement du Chrome utilisateur.

[CI #755](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38537924567), commit 3241563678e2bc2cd96d9d30b4e26102ae98f2dc : suite complète et capacité isolée réussies. L’attente des messages de chargement de fiche et d’actualisation manuelle est bornée à quinze secondes. Un transport silencieux ou une exception déclenche le retour d’échec existant ; une réponse tardive ne déclenche pas une seconde mise à jour de l’interface. Tests Chrome à délai raccourci : silence, reprise sur la requête suivante, exception, résolution unique, bouton réactivé après expiration, titre/progression inchangés malgré un retour tardif. Ce délai termine l’attente côté interface sans annuler le traitement éventuellement en cours dans le service worker ; une écriture valide en arrière-plan reste possible. Aucun engagement sur la latence des fournisseurs. Total inchangé 19/60 ; aucun déploiement ni modification du Chrome utilisateur.

[CI #751](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38537171587), commit 734276ba88c3c10432d1b1f14b5f4e5ea3146c8b : suite complète et capacité isolée réussies. L’actualisation d’une fiche affiche maintenant les données d’une réponse partielle au lieu de les ignorer pour les séries, et annonce explicitement que des informations manquent encore. Distinction des états panne, absence d’informations nouvelles, résultat partiel et résultat complet. Huit libellés de commande/retour traduits dans les huit langues, dont masquer/réafficher sur l’accueil. Tests Chrome avec réponses simulées : partiel japonais avec synopsis et progression conservés, erreur française avec bouton réactivé et données conservées, absence d’informations et succès d’un jeu en anglais. Les états reflètent la réponse du service et ne prouvent pas la complétude de tous les champs ni la disponibilité de chaque fournisseur. G16 reste partiel, score inchangé 19/60. Aucun déploiement ni mise à jour du Chrome utilisateur.

[CI #747](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38535863598), commit a0ce6c8f88d7f1915e1fff2c77e155df7f93215d : suite complète et capacité isolée réussies. L’actualisation des métadonnées peut désormais compléter un synopsis enregistré à une ancienne longueur de coupure (500, 700 ou 1 500 caractères), uniquement si ce texte est le préfixe exact du synopsis fournisseur plus long. Les synopsis différents et les modifications concurrentes sont conservés. Tests : trois frontières historiques, préfixes divergents/non tronqués, message COMPLETE_ITEM_METADATA forcé sur une fiche déjà enrichie, couverture personnalisée/progression/note conservées, persistance après restauration et édition du synopsis pendant la requête. Réparation disponible via le bouton existant d’actualisation ; aucune migration automatique de toute la bibliothèque. Une coupure non reconnaissable ou une source dont le texte a changé n’est pas réparée par cette règle. G03/G06 restent partiels ; score inchangé 19/60. Aucun déploiement ni mise à jour du Chrome utilisateur.

[CI #743](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38526552214), commit f62f10d8408e0148320a5a5653caf62d837852ba : suite complète et capacité isolée réussies. Les descriptions AniList, TVmaze (recherche, fiche et découverte), Wikipedia et TMDB ne sont plus tronquées à 500, 700 ou 1 500 caractères dans le service worker ; elles partagent une borne de 20 000 caractères, également appliquée à Jikan. Tests de synopsis longs AniList/Jikan et borne maximale ; parcours TVmaze recherche → fiche → sauvegarde conservant le texte final. Données fournisseurs simulées pour ces scénarios ; aucune récupération de texte absent chez le fournisseur, aucune réparation revendiquée des anciennes fiches déjà enregistrées. Les extraits courts de recherche peuvent rester visuellement abrégés. G03 et G06 restent partiels, score inchangé 19/60. Aucun déploiement ni mise à jour du Chrome utilisateur.

[CI #739](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38426669283), commit 6884658d284b4cf73f483aeb046976fb8b5964b0 : suite complète et capacité isolée réussies. Le second passage d’enrichissement des œuvres initialement sans identifiant AniList utilise maintenant le même complément de bande-annonce que les fiches déjà identifiées. Tests : identification unique puis sauvegarde de la vidéo, conservation du titre, synopsis, saison, épisode et note, restauration dans un nouveau service worker ; une modification de bande-annonce et de progression pendant la requête n’est pas écrasée par sa réponse. Fournisseurs simulés pour ces scénarios, aucune garantie de vidéo disponible pour chaque œuvre. G06 reste partiel, total inchangé 19/60. Aucun déploiement ni changement du Chrome utilisateur.

[CI #735](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38424933499), commit 42375b57f84abd6c46a5766698ef8ef0314b2072 : suite complète et capacité isolée réussies. Quand une fiche AniList d’anime ne fournit pas de bande-annonce, complément Jikan utilisant uniquement l’identité MAL connue et non contradictoire. Vidéo déjà connue conservée ; synopsis principal et titre utilisateur préservés. Cache limité à 48 identités, dix minutes, requêtes identiques partagées, délai d’attente optionnel de 1,5 seconde, échec temporairement mémorisé trente secondes ; résultat tardif réutilisable lors d’une ouverture suivante. Tests simulés : cache, concurrence, absence/conflit d’identité, lecture exclue, expiration courte, résultat tardif, panne/reprise et parcours catalogDetail. Premier passage #733 échoué sur une assertion incorrecte qui attendait la suppression des identifiants ; assertion corrigée pour vérifier leur conservation. Ces tests ne prouvent pas la disponibilité d’une vidéo pour chaque anime ni sa lecture externe. Séries TVmaze et vidéos HLS seules non couvertes par ce complément. G06 reste partiel, total inchangé 19/60 ; aucune publication ni modification du Chrome utilisateur.

[CI #729](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38419643284), commit d3916c42fa85baba0d365ab4591710586830e042 : suite complète et capacité isolée réussies. Le lecteur de fiche reconnaît maintenant les URL YouTube intégrées sans cookies ainsi que les formes watch, lien court, shorts et live. Les URL sont normalisées vers le lecteur youtube-nocookie ; chemins non vidéo, faux domaines, identifiants invalides, informations d’identification et ports non standard sont rejetés. Le titre du lecteur utilise le dictionnaire de langue existant. Test Chrome : cinq formats valides produisent directement le lecteur avec libellé japonais, six cas invalides ne produisent aucun lecteur. Ce test valide le rendu et la normalisation, pas la disponibilité ni la lecture de chaque vidéo externe. Aucun nouveau fournisseur de bandes-annonces ajouté ; les fiches sans vidéo source et les vidéos HLS seules restent à traiter. G06 et G16 restent partiels, total inchangé 19/60. Aucune publication ni modification du Chrome utilisateur.

[CI #724](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38351166600), commit 551cbe602383ca8e76e516a4d593091c641d586e : suite complète et capacité isolée réussies. Les cartes Steam privilégient désormais la capsule de recherche en résolution double lorsqu’elle existe, avec conservation du chemin fournisseur et repli borné vers les autres images. Tests Chrome : image haute résolution choisie en un appel, repli après deux erreurs sans boucle, aucune URL dérivée pour un faux domaine Steam. Observation réelle : STAR WARS: Galactic Racer et AION 2 chargent des capsules 462 × 174 au lieu des anciennes 231 × 87 ; plusieurs autres jeux utilisent également ces capsules, Dota 2 et Risk of Rain 2 utilisent le header 460 × 215. Contrôles à 1 440 et 390 pixels sans débordement horizontal. Phantom Blade Zero n’était pas présent dans le catalogue observé : aucun résultat spécifique revendiqué pour ce titre. G06 reste partiel, notamment pour la couverture des bandes-annonces et des autres fournisseurs ; total inchangé 19/60. Aucun déploiement ni mise à jour du Chrome utilisateur.

[CI #720](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38282239433), commit d18d5118e9e705a04755dd1a7cdbe9070d131e1e : suite complète et capacité isolée réussies. Attente des traductions d’affichage bornée à quinze secondes ; un transport silencieux ou déconnecté ne bloque plus indéfiniment la file. Tests Chrome : expiration courte simulée, réponse tardive ignorée, appel suivant réussi, exception de transport récupérée, texte original conservé après échec, délai anti-répétition respecté et reprise après expiration de ce délai. Le délai termine l’attente côté interface, sans annuler une requête déjà en cours dans le service worker. Aucun engagement de latence ou de disponibilité du fournisseur externe. G16 reste partiel ; total inchangé 19/60. Pas de publication ni de modification du Chrome utilisateur.

[CI #716](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38278935175), commit 2bc2e576821ec3c672c85511befc042bd3e7dcef : suite complète et capacité isolée réussies au premier essai. Les extraits de synopsis, étiquettes de genres et options du filtre de genre rejoignent la traduction d’affichage des contenus visibles. Les valeurs des options, titres officiels, années et données sources restent inchangés. Un synopsis court n’est plus suivi artificiellement de points de suspension. Tests Chrome avec transport de traduction simulé : rendu traduit, filtre utilisant toujours Adventure, résultat conservé, cache réutilisé, texte source intact, réponse tardive ignorée après remplacement du contenu et changement de langue. Ces tests prouvent le comportement, pas la qualité linguistique du service externe. Repli au texte original conservé en cas d’échec. G16 reste P : interface entière et contenus externes non intégralement validés. Total 19/60, Chrome utilisateur non modifié.

[CI #712](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38277481672), commit cf93fd23f9c52e3a39a9ea1541cc50b9e5aeb6b4 : contrôles fonctionnels réussis. Vingt-deux libellés supplémentaires de recherche traduits dans les huit langues : filtres, types de médias, résultats partiels, erreurs, pagination et ajout manuel. Le changement de langue redessine désormais les résultats déjà ouverts, sans relancer la recherche. Test Chrome japonais puis français : requête, genre brut, année, état, prix, résultats et curseur de pagination inchangés ; zéro nouvel appel CATALOG_SEARCH. Les genres et synopsis fournisseurs de la recherche ne sont pas tous localisés, G16 reste P. Charge isolée : premier essai à 100 000 lignes / 200 requêtes simultanées échoué au seuil p95 de 5 s (9 351 ms, 600 réponses HTTP 200). Une seule relance du job échoué réussit (p95 1 575 ms, 600 HTTP 200). Aucun code serveur ni seuil modifié ; variabilité de l’environnement non diagnostiquée, les deux mesures sont conservées et aucune capacité de production n’est certifiée. Score inchangé : 19/60.

[CI #708](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38207619559), commit 242c51db54bd0dc41cc5527de148a02876d0c2a6 : suite complète réussie. Quarante et un libellés de fiches et du guide des saisons traduits dans les huit langues : publication, portée de fin, plateformes, auteurs, titres alternatifs, distribution, choix/création de liste, chargement/erreurs, saisons et compteurs d’épisodes. Les valeurs de statut restent inchangées ; saison terminée et série terminée restent distinctes. Guide des saisons et faits de publication exclus de la traduction automatique, noms de saison/épisode fournisseurs conservés. Tests Chrome : présence des clés pour huit langues, distinctions de portée, fiche japonaise, pagination 40 vers 42 épisodes, sélection d’une autre saison, conservation du titre fournisseur, changement vers le français avec fiche ouverte. Cela ne valide ni la traduction de tous les écrans ni tous les contenus externes : G16 reste P, total 19/60. Aucun déploiement ou changement du Chrome utilisateur.

[CI #704](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38161979357), commit 650708e4e4d010723b2771f981cedcfd13f0bfd0 : suite complète et capacité isolée réussies. Les douze libellés de profil/bibliothèque (bannière, biographie, tri et options, format, œuvres sans liste, tout afficher, accès clavier au contenu) sont définis dans les huit langues proposées. Les contrôles utilisent ces traductions sans changer les valeurs internes des filtres. Tests Chrome vérifiant les textes japonais, présence des clés dans les huit langues et absence de repli anglais pour la bannière ; capture mobile japonaise examinée, profil et tri désormais traduits et lisibles. Le nom d’une liste créée par l’utilisateur reste intact. G16 demeure partiel : cette preuve ne couvre pas tous les écrans, messages, attributs accessibles et contenus externes. Score inchangé : 19/60. Extension non publiée, Chrome utilisateur non modifié.

[CI #700](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38153055931), commit daeb164d46093c233f6043c868a349ea446e4485 : contrôles complets réussis, incluant sécurité, tests unitaires, compilation, audit des dépendances, parcours web, extension empaquetée, OCR, listes, vidéo et capacité PostgreSQL isolée. Accueil : rotation toutes les neuf secondes, arrêt au survol, au focus, dans un onglet masqué et avec réduction des animations. Bibliothèque organisée en listes, sites favoris expliqués et œuvres enregistrées. Quatorze libellés supplémentaires traduits en huit langues. Traduction à l’affichage des synopsis/genres/sections visibles avec cache borné ; données originales conservées. Titres alternatifs dédupliqués sans perdre les alphabets cyrillique/arabe. Séparateurs médians retirés du rendu library, menus repositionnés. Tests Chrome : vrai changement vers le japonais, sections, rotation/survol/préférence de mouvement, cache de traduction et conservation du texte source. Capture japonaise examinée : sections lisibles, mais commandes du profil et du tri encore en anglais ; G16 reste P. Observation réelle française : synopsis traduit, aucun débordement horizontal à 1440/390 px ; quelques libellés restent anglais et certaines capsules Steam restent en basse résolution. Aucune validation de tous les trailers, de toutes les langues ou de l’exhaustivité ; G03/G06 restent P. Ni publication ni mise à jour du Chrome utilisateur. Total inchangé : 19/60.

[CI #688](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38125410353), commit 4de301f96da01b024121ef9cc2db3a93d745bbd5 : contrôles complets réussis. Classement par titres exacts, alias, phrases et mots entiers après normalisation des accents ; tags et synopsis en repli. La normalisation précédente supprimait les espaces avant la comparaison multi-mots. Scores calculés une fois par résultat et index d’origine conservé pour ouvrir la bonne fiche, sans recherche quadratique des index. Saisie d’année et curseur de prix conservés pendant les résultats progressifs. Tests Chrome : mots multiples, accents, faux sous-mot art/heart, identité des résultats, popularité non finie, saisie d’année avant perte de focus ; pagination et remplacement d’une requête en attente toujours validés. Cela améliore les résultats reçus, sans prouver l’exhaustivité des catalogues. Total inchangé 19/60.


[CI #684](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38124740596), commit e70248913a808d20899ff3ed1c4b50c2d1704bae : contrôles complets réussis le 11 octobre. Fiches Steam mises en mémoire dix minutes, avec regroupement des appels simultanés pour un même identifiant, copies indépendantes des résultats, maximum 48 entrées et quatre chargements de jeux différents en parallèle. Actualisation explicite transmise à Steam, échecs non mémorisés, identifiants invalides refusés. Tests de concurrence, mutation, expiration, nouvelle tentative et bornes mémoire. Aucun gain de latence réel chiffré ; ne valide pas la capacité de production ni l’ensemble des performances du catalogue. Score inchangé : 19/60.


[CI #680](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38075195625), commit ae8917d3ba81dbf8e0fbde54a720f1fad5d84c2d : contrôles complets réussis. Actualités Steam limitées aux 30 derniers jours, triées par date et dédupliquées, dates futures/inconnues exclues, identité de jeu vérifiée, liens sources restreints aux hôtes Steam HTTPS sans identifiants ni ports. Le même rendu filtre aussi les anciennes données locales. Les actualités sont conservées à l’ajout à la bibliothèque ; test Chrome de sauvegarde et affichage dans la fiche enregistrée. La rubrique codes/récompenses reste visible après sauvegarde mais n’invente aucun code actif : collecte toujours absente, G11 NV. Fenêtre de publication récente ne signifie pas qu’un événement est encore actif. Total inchangé 19/60.


[CI #676](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38073388813), commit 2f617ad4d0c48ab7693edee45b5e9894efec96dd : contrôles complets réussis. Sélection Steam des vidéos MP4/WebM valides avec repli 480p, refus des URL à identifiants/ports et mise à niveau HTTPS limitée aux domaines Steam connus. La fiche essaie le second champ vidéo si le premier est inutilisable ; vérification dans Chrome sur un jeu sauvegardé. Synopsis long Steam, développeurs et plateformes Windows/macOS/Linux réellement indiquées par le fournisseur récupérés. Lecteur pleine largeur. Ne garantit pas la disponibilité des vidéos externes, ne prend pas encore en charge les flux HLS seuls et ne clôt pas G06. Score inchangé : 19/60.


Lot interface du 10 octobre : CI #670 entièrement réussie (f5e19144b649752cb741c62a564b4870a13dff89), puis correction du repli des images Steam dans 0d44f24bdb97d5e5f12ef79019714e233c252893, validée par [CI #672](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38069839331) entièrement réussie. La nouvelle sonde réelle ne signale aucune image en échec ni débordement à 1440 et 390 pixels ; les visuels Steam sont à nouveau présents. Leur résolution fournisseur reste variable. Cartes de dimensions fixes, alignement haut, bannière sans lecture automatique, synopsis complet dans une zone défilante, recherche Jeux dans son onglet, classement par titre, prix différenciés, lecteurs intégrés et liens Steam dédupliqués jusque dans les données sauvegardées. Rubrique codes/récompenses ajoutée avec état vide honnête ; collecte des codes non implémentée, G11 reste NV. La revue réelle de #670 a montré deux images Steam absentes, justifiant le correctif de repli et le maintien de G03/G06 partiels. Les entrées plus anciennes ci-dessous conservent leur score historique ; le score courant est 19/60.


[CI #652](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38032629279), commit af1e0302dbde4b34f7049c9bb08c8434ab457b73 : ordre des notifications par fournisseur/abonnement conservé durablement. Les dates provider created/occurred_at sont validées ; PostgreSQL sérialise chaque ressource, verrouille le compte et persiste le dernier état dans la transaction du reçu. Un événement distinct plus ancien est enregistré sans modifier les droits. À date égale et plans contradictoires, transaction annulée et 503 ; aucun ordre inventé entre identifiants. Une ressource déjà liée à un autre compte est refusée. Paddle récurrent suit les événements d’abonnement, pas les confirmations de transaction tardives. Tests mémoire/fichier et PostgreSQL réel : livraisons anciennes/nouvelles concurrentes, annulation préservée, redémarrage/reconnexion, conflit égal et propriété de ressource avec absence de reçu après rollback. Contrôles complets réussis. Réconciliation des dates égales par API prestataire, agrégation multi-abonnements, remboursements et cycle réel restent ouverts. Total 20/60 inchangé.


[CI #646](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38032237781), commit a14ca4b7925e37a9a61079493c40dab1b8252d3d : protection durable contre le rejeu d’un identifiant de notification Stripe/Paddle. PostgreSQL enregistre le reçu et la modification du plan dans la même transaction, avec verrou utilisateur et unicité fournisseur/événement ; seul le champ plan est modifié. Le stockage de développement persiste les deux dans le même instantané. Tests : dix livraisons concurrentes, une seule attribution, annulation puis rejeu de l’ancienne attribution, nouvelle connexion PostgreSQL indépendante, relance du stockage fichier et compte absent réessayable. Contrôles complets réussis. Cette protection ne résout pas l’arrivée désordonnée de deux événements distincts, les remboursements ou plusieurs abonnements concurrents ; G20 reste partiel et total 20/60.


[CI #642](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/38031676108), commit fae9c39c3551b645987e8fba7809c9d4496b54e6 : contrôles complets réussis. Depuis #638, le vrai popup Chrome est aussi testé pour changement français vers espagnol (réponse linguistique réseau simulée, OCR réel) et désactivation, avec navigation puis restauration. L’attribution Stripe/Paddle exige un produit configuré et un état connu : aucun Pro par défaut ni accès à vie sans preuve de produit. Les achats Stripe ponctuels signés sans line_items sont complétés côté serveur auprès de api.stripe.com : URL fixe, identifiant borné, délai 5 s, corps 64 Ko, redirections interdites et erreur 503 pour nouvelle livraison du webhook en cas de récupération impossible. Tests des achats reconnus, inconnus, impayés, tronqués, de la panne et des identifiants invalides. Clé STRIPE_SECRET_KEY documentée côté serveur uniquement. Pas de paiement réel effectué. Le rejeu/ordre durable des événements, les remboursements et le cycle déployé restent ouverts. Total inchangé à 20/60.


[CI #632](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37951217876), commit e5a386d8301a82a94bad7ef2c114a4a6d3a3e6d2 : correction du popup après refus/erreur de permission. Les langues affichées reviennent à la règle active, tous les contrôles sont déverrouillés, les valeurs envoyées sont figées pendant la requête. Tests dans le véritable popup : réponses de permission refusée et exception simulées, règle persistée inchangée. Le parcours normal conserve les API de permissions réelles. Tous les contrôles passent ; le premier dialogue natif sur une nouvelle origine reste non vérifié. G17 partiel, 20/60 inchangé.


[CI #628](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37950062394), commit 5076feb06cfb9482a2a194f49ab23b90bd6b2a0b : contrôles complets réussis. Le test ouvre maintenant le vrai popup via chrome.action.openPopup, sélectionne anglais comme source OCR et français comme destination, puis clique son interrupteur dans son propre contexte navigateur avec un geste utilisateur. GET_TRANSLATION_RULE confirme les valeurs persistées, puis le parcours OCR/navigation/restauration existant passe. Aucun remplacement de tabs.query ou permissions.request/contains. L’origine HTTPS est déjà autorisée par le manifeste : cette preuve ne couvre pas le premier dialogue natif d’octroi/refus. G17 reste partiel ; total 20/60 inchangé. Les essais #622, #624 et #626 ont exposé des problèmes du pilotage du popup, corrigés dans #628.


[CI #618](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37912389197), commit b6e98ed9d2e021cb3ba68281f2b190e44282d60f : 455 tests unitaires et contrôles du paquet réussis. Nouveau parcours automatique via SET_TRANSLATION_RULE depuis une page de l’extension vers une fixture HTTPS interceptée sur une origine déjà autorisée : texte et OCR réels, second chapitre traduit sans commande manuelle, désactivation restaurant les originaux, troisième chapitre inchangé, refus d’une origine non autorisée. Seul le service de traduction réseau est simulé ; ceci ne mesure pas la qualité linguistique et ne valide pas le dialogue natif de permission du popup. G17 reste partiel, score inchangé à 20/60.


[CI #533](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37456852013), commit 01852faff0d6ac06ec476f7b7e341ab0f6ee9491 : contrôles du code, compilation, sécurité, audit des dépendances, parcours web et Chrome, images, listes, vidéo et sonde PostgreSQL réussis. Les catégories de l’accueil sont testées depuis les boutons réels : sélection vide sauvegardée dans Chrome, choix d’une catégorie, maintien du focus clavier, refus de double enregistrement et récupération après erreur. Les filtres restent accessibles pendant une panne de catalogue.

Trois dépendances signalées par l’audit du 6 octobre ont été corrigées : proxy-addr 2.0.8, source-map-js 1.2.2 et postcss-selector-parser 7.1.6. Les empreintes et dépendances ont été vérifiées auprès du registre npm, puis l’installation verrouillée, l’audit et les tests ont réussi. Cette mise à jour documentaire ne modifie pas le produit testé.

Les scénarios de panne RAWG/Steam, les fusions de plateformes/boutiques et les contrôles d'identité Steam sont vérifiés avec des réponses fournisseur simulées. Ils ne prouvent ni l'exhaustivité du catalogue ni la disponibilité de chaque API réelle. La sonde de charge isolée ne certifie pas une capacité de production. La validation ci-dessus concerne le commit de code cité ; cette mise à jour documentaire ne modifie pas le produit.

## Critères produit et lancement

| ID | Critère de réception | État | Preuve ou travail restant |
|---|---|---|---|
| G01 | Identité entre sites et langues, titres alternatifs et auteurs sur une collection représentative | P | Fusions confirmées et conflits testés ; mesurer rappel/précision sur corpus réel multilingue. Ne pas fusionner adaptations/remakes sur le seul titre. |
| G02 | Couverture multi-fournisseur et fonctionnement dégradé sans AniList | P | Sources/replis disponibles selon média ; sources demandées non toutes intégrées. Aucune exhaustivité revendiquée. |
| G03 | Accueil actuel, catégories pertinentes et recommandations texte/goûts | P | Rouvert le 10 octobre après les captures utilisateur : tailles irrégulières, synopsis tronqué et présentation insatisfaisante. Formats fixes, bannière manuelle stable et synopsis intégral défilant corrigés. Revue réelle encore nécessaire pour la qualité des images Jeux et la cohérence globale. |
| G04 | Nouveautés à rattraper disparaissant après lecture/visionnage | P | Données épisodes compatibles ; chapitres manga et calendrier global incomplets. |
| G05 | Fiches internes complètes avec tags, personnages, acteurs et titres lisibles | P | Fiches internes présentes ; complétude des fournisseurs et présentation à élargir. |
| G06 | Images et bandes-annonces robustes, sans recadrage gênant | P | Replis, proportions et activation volontaire présents ; vidéos indisponibles et portrait réel à vérifier. |
| G07 | Saisons et épisodes nommés avec progression cohérente | P | Guide TVmaze disponible ; autres catalogues et saisons particulières à compléter. |
| G08 | Recherche progressive rapide, pertinente et paginée au-delà des petits résultats | P | Pagination à la demande AniList/Jikan/Steam/Open Library, puis TMDB/RAWG avec clés configurées (CI #572). Filtres conservés, dédoublonnage, reprise et courses entre recherches testés. Continuation Wikipedia par langue validée (CI #576). Classement titres/alias/thèmes/synopsis et deux recherches réelles contrôlés (CI #584). Extension de la couverture thématique, lenteur Jikan et progression Steam à examiner. |
| G09 | Filtres type, genre, diffusion, dates futures et prix correctement combinés | V | CI #606 et #614 : combinaisons année 2028/gratuit, changement de type, genres conservés pendant chargement, états séparés et portée œuvre/série vs saison/partie. Mapping AniList/Jikan/TVmaze, ajout, actualisation et rechargement Chrome vérifiés. Les métadonnées manquantes restent inconnues ; couverture des fournisseurs distincte de ce critère. |
| G10 | Jeux au-delà de Steam, boutiques officielles, prix et tags détaillés | P | Steam et RAWG avec clé personnelle : repli sur identifiant connu, plateformes/boutiques fusionnées, genres conservés et refresh sans perte des modifications personnelles testés. Prix multi-boutiques, droits et couverture réelle restent partiels. |
| G11 | Actualités récentes, codes et récompenses structurés avec expiration | NV | Ne pas confondre annonces génériques et codes actifs vérifiés. Flux officiels et expiration à réaliser. |
| G12 | Notifications par œuvre/jeu, catégories et désactivation réellement vérifiées | P | Préférences présentes ; livraison et suppression des événements périmés à valider. |
| G13 | Bibliothèque cohérente, compteurs, listes et actions rapides sans ajout invisible | P | Ajouts explicites, listes/imports/progression testés ; revue totale du tableau de bord et des compteurs restante. |
| G14 | Personnalisation profil : nom, bio, avatar/bannière recadrables et synchronisation | V | ProfileEditor et parcours web : image WebP, profil relu via API et écran étroit. D’autres personnalisations restent possibles sans invalider ce périmètre. |
| G15 | Amis, messages, partage de recommandations avec contrôle de confidentialité | NV | Service social complet absent. Invitations, refus/blocage, signalement et permissions nécessaires. |
| G16 | Traduction texte et images sur les pages/langues représentatives | P | OCR embarqué et scénarios réels existants ; qualité, toutes langues, panneaux difficiles et coût fournisseur à mesurer. |
| G17 | Traduction automatique par site, arrêt/restauration et permissions | P | CI #618 : paquet Chrome sur page HTTPS, permission réelle, OCR image réel, navigation entre chapitres, désactivation et restauration texte/images vérifiés. CI #628 : activation depuis le véritable popup Chrome et langues choisies vérifiées sans simuler les API de permissions. Première demande native sur site non autorisé encore à vérifier. |
| G18 | Rôles propriétaires/admin et cadeaux contrôlés côté serveur | V | Tests HTTP, rôle revérifié, expiration, rejeu, transaction PostgreSQL et journal durable. Activation du propriétaire réel distincte. |
| G19 | Console admin utilisable : recherche exacte, confirmation, motif et mobile | V | Parcours web annulation/confirmation et écran étroit ; API simulée pour ce parcours, tests serveur séparés. |
| G20 | Paiement, renouvellement, annulation, remboursement et droits de bout en bout | P | CI #642 : produits/états reconnus exigés, détails Stripe manquants récupérés côté serveur, panne réessayable et réponses bornées. CI #646 : reçus durables et rejeu atomique vérifiés sur PostgreSQL. CI #652 : ordre d’événements distincts d’un même abonnement vérifié. CI #771 : agrégation multi-abonnements vérifiée avec persistance PostgreSQL et événements simultanés. CI #775 : remboursements intégraux Stripe Lifetime vérifiés en HTTP simulé et PostgreSQL réel isolé. CI #779 : remboursement intégral Paddle Lifetime vérifié. CI #783 : réconciliation des dates égales Stripe/Paddle, reprise après panne et concurrence vérifiées. CI #787 : cumul borné des remboursements partiels Paddle vérifié. Contestations et cycle déployé restent ouverts ; cas dépassant les bornes de lecture à réconcilier par un opérateur. |
| G21 | Prix et avantages cohérents, coûts bornés et marge mesurée | P | Recherche tarifaire réalisée ; droits gratuits/Pro à réconcilier, frais réels et consommation à instrumenter avant engagement commercial. |
| G22 | Guide de prise en main accessible depuis accueil et réglages | V | Guide illustré FR/EN et parcours web navigation/mobile. Il est étiqueté comme exemple ; aucune fausse vidéo de démonstration. |
| G23 | Déploiement robuste, conformité, sauvegarde restaurable et charge prolongée | P | Sonde CI PostgreSQL réussie ; ce n’est pas une capacité de production. Informations exploitant, droits sources/images, sauvegarde/restore, endurance et coûts réels restent ouverts. |
| G24 | Publication Chrome Web Store et site prêt à encaisser | NV | Pas de fiche Store réelle validée ni de cycle paiement réel. Parité web/extension, revue visuelle finale, informations légales et consentements restent requis. |

## Observation des catalogues réels du 6 octobre 2026

[CI #543](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37498625950), commit b79ddd53c87f627bc8ed7eed93e748c304d73f7b : tous les contrôles réussissent, y compris un nouveau parcours Chromium avec les fournisseurs réels et captures à 1440 et 390 pixels.

Le premier contrôle réel (#538) recevait zéro K-Drama, C-Drama et J-Drama. La collecte ne consultait que le calendrier américain et web, puis appliquait une limite globale favorisant les séries américaines. Elle consulte désormais US/KR/CN/JP et le calendrier web sur sept jours, avec quatre requêtes simultanées au maximum et vingt œuvres par catégorie régionale.

Après correction : 8 K-Dramas, 20 C-Dramas, 11 J-Dramas, 20 séries, 18 œuvres dans chacune des quatre catégories AniList, 14 jeux attendus et 14 jeux populaires. Ces nombres décrivent cette observation et ne sont pas une garantie d’exhaustivité. Aucun échec de catégorie signalé ; collecte observée en 2008 ms. Trois rangées et aucun débordement horizontal aux deux largeurs.

Deux images n’étaient pas chargées au moment du dernier relevé mobile ; cela ne suffit pas à conclure qu’elles sont définitivement cassées. À cette date, les captures n’avaient pas encore fait l’objet d’une revue visuelle manuelle et G03/G06 restaient partiels. La revue du 7 octobre ci-dessous remplace cette réserve pour G03 uniquement. Les tests d’interaction avec données fictives sont isolés des réponses réelles afin qu’une réponse tardive ne remplace pas les données du scénario.

## Contrôle des images du 6 octobre à 17:31 UTC

[CI #547](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37503997843), commit 62e12467f3c19176a2109a9b76cb8e4caaa6b0e7 : tous les contrôles passent. Le diagnostic attend les images de secours et consigne désormais le titre et la source des images non chargées.

Sur l’échantillon observé, le premier relevé à 1440 pixels comptait 32 images chargées sur 38 ; le relevé suivant à 390 pixels comptait 38/38, sans débordement aux deux largeurs. Les affiches Steam ACE COMBAT 8 et Aniimo ont donc fini par charger. Ce résultat indique un chargement encore en cours au premier relevé, et non une preuve de panne définitive. Il ne garantit pas le résultat sur d’autres réseaux, œuvres ou dates, et ne remplace pas la revue visuelle des captures. Aucun changement du comportement produit n’a été nécessaire pour ce diagnostic.

## Accueil : résultat concret et limite de validation

- Trois familles de découvertes par défaut : lecture, visionnage, jeux. Les autres catégories restent accessibles volontairement.
- Fiches internes et choix explicite d'une liste ; consulter une découverte ne l'enregistre pas.
- Recommandations fondées sur les genres, tags et mots du synopsis, sans mélanger les types dans une même rangée.
- Reprise et sorties récentes séparées ; les éléments rattrapés disparaissent du bloc des nouveautés.
- Actualisation verrouillée pendant la requête, conservation bornée des résultats récents en cas de panne et reprise après erreur.
- Suggestions de jeux accessibles sans image, identité multilingue et absence de masquage d'un jeu homonyme d'un manga.
- Choix des catégories sauvegardé, sélection vide expliquée, filtres disponibles hors catalogue, navigation clavier préservée et échec de sauvegarde récupérable.
- Images synthétiques, petits écrans et clavier couverts par des tests ; affiches réelles examinées sur ordinateur et mobile. La couverture complète des fournisseurs reste distincte et partielle.

## Validation visuelle de l’accueil du 7 octobre 2026

[CI #559](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37587014910), commit 2a40cd5cfb7020995c995112192e672210c98514 : tous les contrôles réussissent.

Les captures Chromium à 1440 et 390 pixels ont été effectivement examinées. Une première revue avait révélé une rangée Jeux déséquilibrée, mélangeant de grandes affiches verticales et de petites bannières. Les cartes utilisent maintenant une hauteur d’image commune et une largeur suivant les proportions de l’image réellement chargée, y compris après un repli. Un test vérifie la hauteur commune et le respect des proportions sur deux formats différents.

La seconde revue confirme une présentation cohérente : affiche entière dans le bandeau, titre et action interne lisibles, catégories accessibles, trois rangées distinctes et navigation sans débordement de page. Les images Jeux sont entières, sans bandes artificielles ; la découpe d’une carte en bord de carrousel indique le contenu suivant.

Observation réelle : 18 résultats dans chacune des catégories manga/manhwa/manhua/anime, 8 K-Dramas, 20 C-Dramas, 12 J-Dramas, 20 séries et 14 jeux dans chacune des deux sélections. Images chargées : 37/38 au premier relevé ordinateur, puis 38/38 sur mobile. Aucun débordement de page. Ces chiffres sont un échantillon daté, pas une garantie d’exhaustivité ni de disponibilité permanente.

G03 passe à V. G06 reste partiel pour les images et bandes-annonces de l’ensemble des fiches ; G16 reste partiel pour la traduction, notamment les synopsis fournisseurs encore en anglais dans une interface française. La publication, les paiements réels et la version installée chez l’utilisateur ne sont pas validés par ces captures.

## Recherche : attente et résultats Steam corrigés le 7 octobre 2026

[CI #564](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37588112202), commit 6eb9c44614aaea422eb3d2093afbf4d53e42cf5a : tous les contrôles réussissent.

Les résultats manga Jikan sont publiés dès leur réception, sans attendre les réponses anime ni AniList. Les tests maintiennent ces deux réponses en attente puis simulent une panne anime : les premiers mangas restent disponibles et ne sont pas publiés deux fois par le fournisseur.

La recherche Steam conserve désormais les vingt résultats reçus, au lieu de réutiliser la limite de quatorze prévue pour une rangée de découvertes. L’accueil conserve sa limite propre. Le test parcourt la recherche réelle avec une réponse Steam simulée de vingt jeux.

G08 reste partiel : ces corrections ne constituent ni une pagination de tous les fournisseurs ni une recherche exhaustive dans les descriptions. Avancement inchangé : 19/60.

## Pagination de la recherche validée le 7 octobre 2026

[CI #568](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37639136435), commit 9295e575d8697ef6ee4260fddd1fda9293e1dc28 : 425 tests unitaires, compilation, contrôles de sécurité, parcours web et Chrome et sonde PostgreSQL réussis.

Un bouton « Charger plus de résultats » poursuit désormais les recherches AniList, Jikan manga/anime, Steam et Open Library à partir des informations de pagination de chaque source. Les premiers résultats restent visibles ; les filtres sont conservés ; les identités communes à plusieurs pages sont fusionnées. Les sources terminées ne sont pas rappelées. Une source en échec conserve son numéro de page pour être réessayée, sans supprimer les résultats reçus des autres sources.

Les tests couvrent les doubles clics, la fusion entre pages, la reprise après panne, l’expiration de session, les paramètres de pagination fournisseurs et la limite explicite. Le parcours Chrome vérifie aussi qu’une réponse tardive d’une ancienne recherche ne remplace pas la nouvelle et que l’indication « Dans la bibliothèque » fonctionne au-delà de 200 résultats.

Les livres sont désormais reçus par lots de vingt, avec auteur, année et lien de fiche lorsqu’ils sont fournis. La session est bornée à 1 000 résultats et vingt pages par source ; un message signale la limite et invite à préciser la recherche. Ce plafond protège le rendu et les appels ; il ne signifie pas que tous les résultats possibles sont chargés.

G08 reste partiel : Wikipedia, TMDB et RAWG ne disposent pas encore de cette continuation, et la couverture des recherches par descriptions/thèmes doit être étendue. Les nouvelles continuations ont été vérifiées avec des réponses contrôlées dans les tests ; aucun taux de disponibilité des fournisseurs réels n’est déduit de ces tests. Avancement global inchangé : 19/60 (32 % arrondi).

## Pagination films et jeux multi-plateformes du 7 octobre 2026

[CI #572](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37652408780), commit 36b655a7be5c05544de35f147c752147781a619a : tous les contrôles réussissent, y compris les parcours Chrome.

TMDB et RAWG participent maintenant à « Charger plus » lorsque leurs clés sont configurées. Les acteurs/personnes restent exclus des résultats TMDB, mais une page ne contenant que des personnes ne masque pas les œuvres des pages suivantes. Les jeux RAWG conservent leurs plateformes et tags sur les pages suivantes. Les requêtes de continuation sont construites vers les hôtes fixes des fournisseurs : une URL « next » reçue de RAWG n’est pas suivie directement.

Les tests vérifient les paramètres page, l’arrêt en fin de catalogue, les deux sources dans une même session, l’absence de clés dans les réponses de recherche et le retrait d’une clé entre deux pages. Les réponses fournisseurs sont simulées : aucun accès réel avec les clés de l’utilisateur n’est revendiqué.

G08 reste partiel pour Wikipedia, la couverture descriptions/thèmes et une mesure représentative sur catalogues réels. Le score demeure 19/60 (32 % arrondi).

## Pagination Wikipédia du 8 octobre 2026

[CI #576](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37803890560), commit 1385e298b98354b2ab716f2a780dde1c2e3ffd32 : tous les contrôles réussissent.

La recherche Wikipédia reprend maintenant à la position renvoyée par le fournisseur, avec un suivi indépendant par langue. Les résultats identifiés comme personnes restent exclus sans empêcher de poursuivre après une page ne contenant aucune œuvre. Une panne conserve la position à réessayer et ne recharge pas les langues déjà terminées.

Les tests vérifient la position réelle de continuation (y compris un décalage autre que dix), la reprise de la seule langue en panne, les positions invalides ou qui reculent et les erreurs applicatives reçues avec un statut HTTP de succès. Les destinations restent construites sur les sous-domaines Wikipédia validés. Les détails du protocole suivent la [documentation MediaWiki Search](https://www.mediawiki.org/wiki/API:Search).

Ces tests utilisent des réponses contrôlées ; ils ne prouvent pas la pertinence ou l’exhaustivité de toutes les recherches réelles. G08 reste partiel pour la couverture descriptions/thèmes et les mesures représentatives. Avancement : 19/60 (32 % arrondi).

## Recherches réelles et classement du 8 octobre 2026

[CI #584](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37817204056), commit bcf9cdd3fc0e911bdbe473e4e7117b1395a318e0 : tous les contrôles réussissent.

Une sonde Chromium appelle désormais le moteur réel sur « yandere » et « portal », avec les catalogues publics sans clé personnelle. Elle consigne le délai du premier résultat, deux tours de pagination, les types d’œuvres et l’état de chaque source. Les mesures décrivent cet environnement CI et cette date, pas une garantie de performances pour chaque utilisateur.

Le premier relevé (#580) montrait que les correspondances approximatives TVmaze occupaient le début de « yandere » parce qu’elles étaient reçues rapidement. Le classement prend maintenant en compte les titres et titres alternatifs, puis les thèmes et le synopsis. Il conserve les résultats moins pertinents et ne confond pas classement avec fusion d’identités. Tests ajoutés pour accents, titres natifs, thèmes, descriptions et résultats progressifs.

Après correction, les premiers résultats « yandere » sont des œuvres correspondantes ; « Yankee » et « The Wanderer » ne précèdent plus les correspondances de titre. Relevé #584 : premier résultat en 503 ms, 103 puis 123 résultats (70 puis 90 lectures, 11 visionnages et 22 jeux). Pour « portal » : premier résultat en 501 ms, 54 puis 74 résultats. Les totaux incluent plusieurs médias et ne signifient pas qu’il existe 123 mangas uniques répondant au thème.

Limites confirmées : Jikan manga/anime échoue dans cet environnement après environ 30 secondes ; la recherche fournit déjà ses autres résultats pendant cette attente. Le nombre de jeux reste à 22 entre les deux tours pour les deux requêtes malgré une continuation Steam annoncée : examiner les réponses de cette source avant de revendiquer un gain réel de couverture des jeux. Le classement du synopsis porte sur les œuvres déjà reçues, et n’étend pas à lui seul la recherche thématique de chaque fournisseur. G08 reste partiel, score inchangé : 19/60.

## Priorités de livraison

1. Revalider G03 après les défauts signalés le 10 octobre : conserver les contrôles Chrome, la sonde de catalogues réels et les captures ordinateur/mobile lors des changements de l’accueil.
2. Étendre recherche/fiches/jeux multi-boutiques et corriger les écarts de présentation avec un corpus réel.
3. Réconcilier avantages gratuits/Pro et limites de traduction avec une mesure de coûts. Tester paiement, annulation et révocation avant activation commerciale.
4. Configurer et vérifier le propriétaire ; voir ADMINISTRATION.md. Aucune promotion réelle n’a été faite par simple modification du code.
5. Finaliser couverture notifications, nouveautés à rattraper et données de récompenses. Le social reste un chantier distinct, non livré.
6. Valider production, documents exploitant, droits d’utilisation des données, sauvegarde/restore, accessibilité et publication Store.

Les prix affichés, le catalogue ou la traduction ne garantissent pas un revenu rapide. Les limites, disponibilités et coûts doivent être vérifiés sur les fournisseurs effectivement utilisés. Le code distribué dans une extension reste consultable ; les secrets et les droits commerciaux doivent être protégés côté serveur.


## Recherche : délai Jikan et pagination Steam vérifiés le 9 octobre 2026

[CI #592](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37895676145), commit 3c4b0775e245b7a68853cdca5c34c98e3f276607. La sonde utilise les fournisseurs réels depuis Chromium avec un compte synthétique vide.

- Jikan : délai de recherche limité à 6 secondes, y compris le corps JSON ; après une panne, pause de 30 secondes pour éviter deux attentes successives et les relances immédiates. Les tests couvrent réseau bloqué, corps bloqué, annulation, reprise après la pause et erreur 404 sans suspension générale.
- Mesure « yandere » : premiers résultats à 503 ms, premier chargement terminé à 6 521 ms contre environ 30 secondes auparavant ; deuxième page à 505 ms. Jikan reste indisponible sur cette sonde : les résultats restent explicitement partiels.
- Steam ignorait le seul décalage start et renvoyait start=0 pour la deuxième page. Ajout de page explicite, décalage de 25 et conservation des 25 jeux par page. Une réponse dont le décalage ne correspond pas est rejetée sans avancer le curseur ; les résultats déjà reçus sont conservés.
- Preuve réelle : start=0 puis start=25, deux ensembles de 25 identifiants distincts pour « yandere » et « portal ». Les jeux cumulés passent de 27 à 52 pour chaque requête, contre 22 à 22 avant correction. Totaux toutes sources après deux pages : 153 pour « yandere », 104 pour « portal ». Ces nombres ne prouvent pas l'exhaustivité des catalogues.
- Le test Chrome attend désormais l'ouverture effective des paramètres après le clic, avec un maximum de cinq secondes ; aucune assertion fonctionnelle n'est supprimée.

G08 reste partiel : disponibilité Jikan, couverture des recherches par thèmes et validation des sources nécessitant des clés encore à compléter. Global inchangé : 19/60, soit 32 % arrondi. Aucun déploiement, publication Store ou remplacement de l'extension installée n'est effectué.


## Recherche thématique vérifiée le 9 octobre 2026

[CI #598](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37899523064), commit 7b69de2bc902223e97e726f91d20d2299fd92251 : tous les contrôles réussis, dont 447 tests unitaires et les parcours Chrome.

La recherche AniList par titre collecte désormais les genres et thèmes disponibles (cache en mémoire du worker). Si le texte correspond exactement à un thème ou genre connu, une recherche complémentaire par tag_in ou genre_in ramène des œuvres dont le titre peut être différent. Les genres français courants sont associés aux noms du fournisseur. Un titre complet ou une portion de mot ne déclenche pas d'élargissement approximatif. Les résultats par titre restent prioritaires ; les identités communes sont fusionnées et le thème possède son propre curseur de pagination. Une panne du thème conserve les résultats par titre et signale la source partielle. Les tags adultes ou marqués comme spoilers sont masqués sur les résultats.

Sonde réelle « yandere » : 158 résultats à la première page et 254 après la deuxième (96 lectures, 106 contenus à regarder et 52 jeux). Lors de la sonde précédente sans recherche thématique : 108 puis 153. Le premier résultat reste à 503 ms, premier chargement terminé à 6 535 ms, deuxième à 508 ms. AniList-theme progresse de la page 1 à la page 2 avec une suite disponible. « portal » ne déclenche pas cette source thématique et conserve la recherche par titre.

Limites : les chiffres varient avec les fournisseurs et ne constituent pas une mesure d'exhaustivité. La recherche thématique ajoutée concerne AniList, pas l'ensemble des fournisseurs ; ce n'est pas une recherche plein texte universelle dans toutes les descriptions. Les genres traduits ne couvrent pas toutes les langues. Le tri par popularité du fournisseur favorise ici les anime parmi les thèmes, et Jikan demeure indisponible pendant la sonde. G08 reste P ; global inchangé 19/60 (32 % arrondi).

Référence du schéma utilisé : [filtres des médias AniList](https://docs.anilist.co/reference/object/page) et [définition des tags](https://docs.anilist.co/reference/object/mediatag).


## Équilibre manga/anime des thèmes vérifié le 9 octobre 2026

[CI #602](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37900174069), commit b599e4550625bcd8011ba40ae83607be5b0df51c : vérification complète réussie.

Les recherches thématiques ont désormais deux sources paginées indépendantes, MANGA et ANIME, de 50 résultats chacune. Elles sont lancées en parallèle après les résultats par titre. Une famille terminée n'est pas relancée ; une page en échec peut être réessayée sans perdre les résultats de l'autre famille ni changer son curseur. Un test couvre la reprise de la page manga après panne avec la source anime déjà terminée.

Sonde réelle « yandere » : première page 208 résultats (120 lectures, 61 contenus à regarder, 27 jeux), deuxième page 354 (191 lectures, 111 contenus à regarder, 52 jeux). La sonde précédente donnait 254 résultats dont 96 lectures après deux pages. Les deux sources thématiques avancent chacune vers la page 3. Premiers résultats à 502 ms ; fin de la première page à 6 573 ms, seconde à 517 ms. « portal » conserve son parcours par titre, 58 puis 104 résultats.

Cette mesure confirme que la popularité des anime ne repousse plus les mangas vers des pages thématiques éloignées. Les lectures comprennent aussi les livres des autres fournisseurs : 191 ne signifie pas 191 mangas. Le corpus n'est toujours pas exhaustif, et Jikan reste indisponible pendant ce contrôle. G08 reste partiel ; score global inchangé à 19/60 (32 % arrondi). Aucune mise à jour de l'extension installée ni publication Store.


## Filtres combinés vérifiés dans Chrome le 9 octobre 2026

[CI #606](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37901256213), commit 1e3db4a35ccdd013cb5ad9e395d1e9a27c389b8e : tous les contrôles ont réussi après une installation du navigateur particulièrement lente. Le test du paquet réel manipule les menus pour combiner jeux, année 2028, à venir et prix gratuit ; vérifie séparément terminé, hiatus et annulé ; puis simule un changement de résultats pour vérifier que le genre actif reste visible et peut être effacé.

Les genres proposés sont limités au type sélectionné, tout en conservant le genre actif. Les jeux comingSoon/released=false sont reconnus comme à venir ; un jeu simplement sorti ne devient pas une œuvre terminée. HIATUS et CANCELLED ont des états distincts. Aucun changement du score global : G09 demeure P car le statut fournisseur d'une saison terminée ne prouve pas la fin de la franchise. 19/60, soit 32 % arrondi.


## Tags des fiches enregistrées vérifiés le 9 octobre 2026

[CI #610](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37906599062), commit 0cb01d25b77e90f80ee102d773f9124001e01cfc : tous les contrôles réussis. La requête de détail AniList demande désormais les tags et leurs indicateurs de spoiler/adulte, comme la recherche. Un test vérifie les champs demandés, l'identifiant exact, les tags retournés sans doublons et le masquage des spoilers/adulte pour une œuvre enregistrée sans métadonnées de recherche. Les parcours Chrome du paquet passent également. Cette correction ne prouve pas la complétude de toutes les fiches ni la disponibilité de tous les fournisseurs ; G05 reste partiel. Global 19/60 (32 % arrondi), inchangé.


## G09 validé : portée de publication et sauvegarde, 9 octobre 2026

[CI #614](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37908817868), commit e42b1b64965fbad765347f297682eb673ca3ba35 : tous les contrôles réussis. Cette preuve clôt G09 et fait passer le score à 20/60 (33,3 %, 33 % arrondi). G05 et G02 restent partiels.

- Les métadonnées couplées releaseStatus/releaseScope/releaseSource sont propagées des sources à la fiche, à l'ajout puis à la bibliothèque. AniList/Jikan : manga et films = œuvre, autres anime = saison/partie ; TVmaze = série. Une série annoncée Ended peut naturellement être relancée ultérieurement : aucun état n'est une garantie sur les annonces futures.
- Les anciens statuts sans portée ne sont pas convertis en fin globale par supposition. Le filtre « Œuvre / série terminée » exclut les saisons et les fins non précisées, qui ont leurs propres options. Les fiches expliquent la portée.
- Fusion et actualisation conservent la cohérence du trio statut/portée/source, y compris si une modification intervient pendant le chargement. TVmaze actualise son statut Ended/Running au lieu de conserver indéfiniment l'ancien état.
- Les genres et thèmes récupérés sont persistés (catalogTags pour les thèmes du fournisseur) sans remplacer les tags personnels. Ce correctif complète la précédente requête de tags : récupérer les tags seuls ne garantissait pas leur sauvegarde.
- Le changement de type efface un genre incompatible ; un simple rafraîchissement progressif conserve la sélection. TV est présenté comme série, BOOK comme livre.
- Tests Chrome : filtres 2028/gratuit, œuvre terminée, série terminée, saison terminée, ancienne portée inconnue, pause/annulation ; changement Romance → Jeux ; ajout réel à une liste puis rechargement et réouverture avec statut et thèmes conservés. Tests du worker : mappers fournisseurs, statut TVmaze actualisé, thèmes séparés des tags personnels, fusion et modification concurrente.

Limites distinctes : données absentes des fournisseurs, exhaustivité des catalogues, épisodes/chapitres, qualité des traductions et publication Store ne sont pas validés par ce lot. L'extension installée n'est pas remplacée automatiquement.
