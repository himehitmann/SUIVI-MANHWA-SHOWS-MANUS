# Yomu: audit de livraison du 16 septembre 2026

## Périmètre et mesure

Ce document suit les demandes produit et les listes de contrôle fournies par le propriétaire. Les captures sont des points de départ à vérifier, pas une preuve de sécurité ni une obligation d'installer toutes les technologies citées.

Le lot comporte **36 contrôles fixes** (12 domaines, 3 contrôles chacun). Un contrôle partiel ou non vérifié reste au dénominateur. Les contrôles validés portent uniquement sur le code et les scénarios nommés ci-dessous; ils ne prouvent pas la sécurité exhaustive d'un déploiement réel. Le pourcentage du lot ne représente pas le pourcentage de toutes les fonctionnalités de Yomu.

Version 0.4.23 validée: [CI #310, 306 tests et parcours Chromium](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/35088980961), commit 14c65439f427001a20191ff73024c9af55faf47a. Le contrôle complet couvre lint, types, build, audit des dépendances au seuil modéré, web, paquet extension, recadrage, listes et vidéo. Scanner: 218 fichiers texte actuels et 890 blobs texte historiques analysés, zéro détection parmi six familles de motifs, 17 fichiers binaires actuels et 19 blobs binaires historiques exclus, aucun texte laissé hors limite.

## Changements du lot

- Les messages des pages web ne peuvent plus lire les comptes, les clés ou la bibliothèque entière, changer les réglages, importer, supprimer, gérer les listes ou déclencher la synchronisation. Les opérations de détection, progression et traduction disposent d'une frontière explicite et d'entrées bornées.
- Le stockage Chrome local et synchronisé est réservé aux contextes de confiance de l'extension. Les réponses aux lecteurs vidéo ne renvoient pas la fiche privée. Le lien de l'épisode reste celui de la page principale pour les lecteurs intégrés.
- Les nouvelles sauvegardes et copies dans Chrome Sync excluent les clés de service et les adresses de serveur personnalisées. Une migration conserve localement les anciennes valeurs avant de nettoyer la copie active de Chrome Sync. Les anciens fichiers de sauvegarde déjà téléchargés ne sont pas modifiés.
- La connexion et les requêtes authentifiées exigent HTTPS, sauf une adresse de développement locale explicite. Les redirections et cookies ambiants y sont refusés.
- Les images OCR doivent être des formats raster acceptés. Les URL exécutables, fichiers locaux, identifiants dans l'URL, adresses privées littérales et redirections sont refusés. Taille de réponse et type MIME sont contrôlés. Cela ne constitue pas une protection DNS contre toute forme de rebinding; le serveur d'images personnalisé reste un service choisi par l'utilisateur.
- Les réponses API privées, y compris les erreurs, portent no-store. Les quotas ont une capacité mémoire bornée, expirent sans dépendre des inscriptions et partagent le quota des variantes de casse/slash. La synchronisation possède aussi un quota par compte.
- Les liens importés sont limités à HTTP/HTTPS sans identifiants. Les attributs de cartes et les couleurs/fonds importés sont échappés ou validés.
- Contraste amélioré, focus clavier visible, lien d'évitement, libellés de recherche/langue, titre de page, favicon, annonces de statut. Les fiches fermées ne sont plus parcourables au clavier; leur fermeture rend le focus au contrôle d'origine.
- CI: détection conservatrice de six familles de secrets dans les fichiers suivis et les blobs uniques de l'historique Git accessible. Les valeurs ne sont jamais imprimées. Les binaires sont exclus et comptés; un fichier texte non analysé fait échouer le contrôle. Ce scanner complète l'audit des dépendances, sans le remplacer.

## Grille de 36 contrôles

V = vérifié dans les scénarios cités. P = partiel, pas compté comme validé. NV = non vérifié. Les preuves sont le code courant et la suite CI citée, pas un service de production supposé.

| ID | Contrôle | État | Preuve ou limite |
|---|---|---|---|
| 1.1 | Permissions MV3 justifiées | P | Manifest lu; justification détaillée des permissions facultatives à compléter. |
| 1.2 | Accès aux sites limité aux besoins | P | Injection à la demande et hôtes listés; audit du refus des permissions facultatives incomplet. |
| 1.3 | Refus de permission sans panne | NV | Scénarios de refus à compléter. |
| 2.1 | Schémas et taille de tous les messages | P | Messages des pages validés; schémas complets des commandes internes à compléter. |
| 2.2 | Émetteur et contexte des commandes sensibles | V | Tests extension trust boundary, émetteurs absents et origines ressemblantes. |
| 2.3 | Aucune mutation privilégiée depuis une page | V | Tests de refus GET_STATE, SET_SETTINGS, SYNC, IMPORT, suppression et listes. |
| 3.1 | Identités ambiguës et identifiants contradictoires | V | Tests des remakes, adaptations, alias et identifiants autoritaires. |
| 3.2 | Métadonnées sans perte de progression | V | Tests concurrence, file de récupération et parcours Chromium. |
| 3.3 | Événements retardés et progression par saison | V | Tests de régressions vidéo et épisodes. |
| 4.1 | Imports bornés et schémas complets | P | Parseurs et tests existants; audit intégral des formats et tailles à terminer. |
| 4.2 | Exclusion de tous les champs dangereux importés | P | Secrets, attributs HTML et couleurs durcis; schéma exhaustif des fiches à compléter. |
| 4.3 | Import invalide/interrompu sans corruption | P | Fusion additive testée; scénarios d'interruption de chaque parseur à compléter. |
| 5.1 | Rendu sans exécution de contenu importé | P | Test HTML hostile sur cartes; revue complète web/extension à poursuivre. |
| 5.2 | URL de navigation et téléchargements contrôlées | P | Liens de bibliothèque, OCR et connexion couverts; autres services personnalisés à revoir. |
| 5.3 | Gestion de tous les médias cassés | P | Replis et état de métadonnées disponibles; sources externes variables. |
| 6.1 | Absence de secrets dans toutes les sources/paquets | P | Scanner borné de motifs, historique accessible et audit de dépendances; pas de preuve exhaustive. |
| 6.2 | Aucune clé restituée aux pages | V | Stockage TRUSTED_CONTEXTS et commandes sensibles refusées. |
| 6.3 | Clés exclues des exports et de la sync automatique | V | Tests unitaires et téléchargement réel d'une sauvegarde; clés personnelles restent locales. |
| 7.1 | Authentification des routes sensibles | V | Tests HTTP: API sans token refusée, sessions révoquées refusées. |
| 7.2 | Isolation des données entre comptes | V | Tests HTTP A/B, stockage par identité de session. |
| 7.3 | Token invalide/révoqué sans mutation | V | Tests logout, changement de mot de passe, accès anonyme. |
| 8.1 | Entrées et fréquence des requêtes bornées | P | Quotas et corps JSON testés; audit complet des schémas restant. |
| 8.2 | Origines et exposition réseau de production | P | CORS restrictif, no-store et en-têtes dans le code; déploiement réel non vérifié. |
| 8.3 | Requêtes serveur vers URL utilisateur contrôlées | NV | Revue complète des routes de relais et services personnalisés à terminer. |
| 9.1 | Reprise/hors ligne sans perte | V | File de métadonnées persistée et scénarios de reprise du worker. |
| 9.2 | Requêtes répétées sans doublon | V | Tests identité, imports répétés et fusions. |
| 9.3 | Écritures concurrentes sans perte silencieuse | V | Tests extension, synchronisation et requêtes HTTP concurrentes. |
| 10.1 | Tous les parcours et retours utilisateur cohérents | P | Ajout/liste/progression/import/export testés; revue de tous les écrans restante. |
| 10.2 | Toutes les erreurs expliquées et récupérables | P | États de récupération et erreurs principaux; couverture complète restante. |
| 10.3 | Doubles actions et chargements sans mutation indue | P | Annulation de recherche et verrous couverts; audit de chaque formulaire restant. |
| 11.1 | Tous les parcours principaux sur écran étroit | P | Home/Library/Games testés à 320/375/480 px; revue visuelle de tous les panneaux restante. |
| 11.2 | Clavier, focus et libellés partout | P | Fiche, navigation et recherche améliorées/testées; menus et contrôles secondaires à terminer. |
| 11.3 | Tactile et dialogues sans survol obligatoire | NV | Vérification sur appareil tactile restant. |
| 12.1 | Chaque ancienne demande reliée à une preuve | P | Inventaire ci-dessous; couverture concurrentielle encore incomplète. |
| 12.2 | Régressions produit exécutées | V | CI: unité, web, paquet extension, recadrage, listes et vidéo. |
| 12.3 | Livraison et configuration de production validées | P | Paquet et migration testés; hébergement, paiement et installation personnelle distincts. |

Résultat de ce lot: **14/36 contrôles validés (39 %)**. Aucun déploiement de production réel n'est déclaré validé par ce lot.

## Anciennes demandes: ce qui reste réellement à terminer

| Demande | État actuel et limite |
|---|---|
| Reconnaissance entre sites/langues | Implémentée pour les identités confirmées et testée; correspondances ambiguës conservées séparément. |
| Titres alternatifs, auteurs, import des images | Fiches et récupération persistante implémentées; complétude dépend des sources. |
| Ajout explicite à une liste et reconnaissance des œuvres déjà sauvées | Parcours testé; aucune liste inventée par le clic sur une suggestion. |
| Fiches internes | Implémentées; couverture des personnages, acteurs, tags et biographies encore variable. |
| Bandes-annonces intégrées | Intégration présente; certaines vidéos refusent l'intégration ou disparaissent. Couverture réelle à vérifier. |
| Saisons et noms des épisodes | Guide TVmaze disponible; extension aux autres catalogues restante. |
| Accueil évolutif et recommandations | Tendances, catégories, carrousel et signaux de goût présents; pertinence régionale et validation visuelle complète restantes. |
| Nouveautés à rattraper | Épisodes datés des sources compatibles; dates de chapitres manga et calendrier global incomplets. |
| Affiches sans découpe et flèches | Proportions originales et commandes de carrousel corrigées; revue sur contenus réels à élargir. |
| Recherche rapide et complète | Recherche progressive, cache et plusieurs sources; maximum actuel de 120 résultats, aucune exhaustivité promise. |
| Types, genres, dates futures, statut et prix des jeux | Filtres présents; sémantique et couverture de chaque fournisseur à vérifier ensemble. |
| Résultats acteurs indésirables | Filtrage renforcé précédemment; revue de tous les fournisseurs encore nécessaire. |
| Jeux: boutiques, prix et tags | Liens et détails présents; exhaustivité des prix et tags non garantie. |
| Notifications par œuvre/jeu | Choix de catégories présents; vérification d'usage et de toutes les sources restante. |
| Récompenses, codes expirants, Twitch Drops | Pas de flux structuré complet et vérifié; ne pas présenter les annonces génériques comme équivalentes. |
| Ajout depuis un lien | Parcours contextuels présents; prise en charge universelle non atteinte. |
| Bibliothèque/tableau de bord | Listes, statistiques, tri, filtres et suppression avec confirmation; historique détaillé/calendrier restant. |
| Indépendance d'AniList | Repli Jikan et autres sources selon le média; accès hors ligne préservé. Intégration de toutes les sources demandées restante. |
| Nautiljon, Manga-news, MangaUpdates, Booknode, ComicWalker, Fandom, TVTropes, Anime-Planet | Pas tous intégrés; disponibilité/licences/conditions et méthodes d'accès à étudier source par source. |
| Amis, messagerie et recommandations partagées | Pas de fonctionnalité sociale complète livrée. |
| Monétisation/prix/offres | Interface existante; activation et vérification de paiement en production non établies. Audit de toutes les traductions/offres restant. |
| Aucun style générique, surcharge ni tiret cadratin | Nettoyage progressif; revue éditoriale et visuelle complète restante. |
| Chrome installé | Mise à jour manuelle par le propriétaire; les commits GitHub n'actualisent pas automatiquement l'installation. |
| Parité web/extension | Incomplète; ne pas confondre les tests de l'extension et la livraison du site web. |

## Points des captures qui dépendent du produit et du déploiement

Les cookies de session, CSRF, règles SQL/RLS, plafond de dépenses, sauvegardes serveur, restauration, WAF, domaine HTTPS, e-mails et paiement se vérifient avec la configuration effectivement déployée. L'API actuelle utilise des tokens Bearer; ajouter une case générique « cookies sécurisés » ne prouve rien. Le backend dispose d'implémentations de stockage fichier et PostgreSQL; leurs choix opérationnels restent à documenter pour le déploiement réel.

Robots, sitemap, URL canoniques, pages légales, partage et 404 concernent le site public. Ils ne sont pas un mécanisme d'indexation d'une page chrome-extension privée. Les informations légales de l'exploitant et le traitement effectif des données doivent être établis avant de prétendre la publication prête. Un numéro de téléphone fictif ou une bannière cookies sans usage correspondant ne sera pas ajouté pour cocher une liste.

Kubernetes, sharding, multi-région, service discovery et autres technologies de la capture ne sont pas des fonctionnalités à ajouter automatiquement. Choisir une architecture en fonction du trafic mesuré et des besoins, sans multiplier les services non nécessaires.

Référence technique: [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) pour la restriction TRUSTED_CONTEXTS. Les tests restent la preuve du comportement de Yomu, pas cette documentation seule.

