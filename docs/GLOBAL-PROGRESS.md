# Suivi global Yomu

Mise à jour : 8 octobre 2026. Branche : fix/yomu-p0-reliability. Ce suivi remplace toute interprétation du précédent « 39 % » comme avancement du produit entier.

## Mesure fixe

60 critères de réception : les 36 contrôles de docs/DELIVERY-AUDIT-2026-09-16.md, plus les 24 critères produit et lancement ci-dessous. Chaque critère a le même poids. V = entièrement vérifié dans le périmètre défini ; P = partiel ; NV = non vérifié ou absent. Seuls les V comptent. Ce score est une couverture des exigences validées, pas une estimation des heures, de la qualité perçue ou du nombre de lignes de code.

**19 / 60 = 31,7 % global vérifié (32 % arrondi).** Les contrôles historiques comptent 14 V et les critères supplémentaires 5 V. Le périmètre élargi explique la différence avec l’ancien 14/36 (39 %), qui concernait un lot d’audit uniquement. Tout changement de dénominateur devra être explicite.

## Pourquoi le compteur est resté à 30 %, puis passe à 32 %

Le compteur attribue un point uniquement à un critère entièrement vérifié. Plusieurs corrections peuvent donc améliorer un même critère partiel sans ajouter de point. Il ne mesure pas le travail réalisé ni le temps restant. Les preuves documentaires étaient aussi restées au 20 septembre : elles sont désormais actualisées.

La livraison a été trop fragmentée en petits correctifs. Priorité : terminer des parcours cohérents, puis les comparer aux critères de réception. Ne pas ajouter de critères plus faciles ni reclasser un critère uniquement pour augmenter le score.

G03 est désormais validé : la revue visuelle sur données réelles a été réalisée sur ordinateur et mobile, après correction des proportions des cartes Jeux. La collecte régionale réelle et les tests de fraîcheur, de panne et de recommandations complètent cette revue. Le dénominateur reste 60 ; aucun autre critère n'est reclassé.

## Preuves actuelles

[CI #533](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/37456852013), commit 01852faff0d6ac06ec476f7b7e341ab0f6ee9491 : contrôles du code, compilation, sécurité, audit des dépendances, parcours web et Chrome, images, listes, vidéo et sonde PostgreSQL réussis. Les catégories de l’accueil sont testées depuis les boutons réels : sélection vide sauvegardée dans Chrome, choix d’une catégorie, maintien du focus clavier, refus de double enregistrement et récupération après erreur. Les filtres restent accessibles pendant une panne de catalogue.

Trois dépendances signalées par l’audit du 6 octobre ont été corrigées : proxy-addr 2.0.8, source-map-js 1.2.2 et postcss-selector-parser 7.1.6. Les empreintes et dépendances ont été vérifiées auprès du registre npm, puis l’installation verrouillée, l’audit et les tests ont réussi. Cette mise à jour documentaire ne modifie pas le produit testé.

Les scénarios de panne RAWG/Steam, les fusions de plateformes/boutiques et les contrôles d'identité Steam sont vérifiés avec des réponses fournisseur simulées. Ils ne prouvent ni l'exhaustivité du catalogue ni la disponibilité de chaque API réelle. La sonde de charge isolée ne certifie pas une capacité de production. La validation ci-dessus concerne le commit de code cité ; cette mise à jour documentaire ne modifie pas le produit.

## Critères produit et lancement

| ID | Critère de réception | État | Preuve ou travail restant |
|---|---|---|---|
| G01 | Identité entre sites et langues, titres alternatifs et auteurs sur une collection représentative | P | Fusions confirmées et conflits testés ; mesurer rappel/précision sur corpus réel multilingue. Ne pas fusionner adaptations/remakes sur le seul titre. |
| G02 | Couverture multi-fournisseur et fonctionnement dégradé sans AniList | P | Sources/replis disponibles selon média ; sources demandées non toutes intégrées. Aucune exhaustivité revendiquée. |
| G03 | Accueil actuel, catégories pertinentes et recommandations texte/goûts | V | Trois rangées variées, recommandations par tags et synopsis, catégories sauvegardées, cache borné et récupération après panne testés. Catalogues régionaux réels contrôlés ; revue visuelle à 1440 et 390 pixels et correction des cartes Jeux, CI #559. Cette validation ne couvre pas l'exhaustivité des sources ni toutes les fiches/vidéos. |
| G04 | Nouveautés à rattraper disparaissant après lecture/visionnage | P | Données épisodes compatibles ; chapitres manga et calendrier global incomplets. |
| G05 | Fiches internes complètes avec tags, personnages, acteurs et titres lisibles | P | Fiches internes présentes ; complétude des fournisseurs et présentation à élargir. |
| G06 | Images et bandes-annonces robustes, sans recadrage gênant | P | Replis, proportions et activation volontaire présents ; vidéos indisponibles et portrait réel à vérifier. |
| G07 | Saisons et épisodes nommés avec progression cohérente | P | Guide TVmaze disponible ; autres catalogues et saisons particulières à compléter. |
| G08 | Recherche progressive rapide, pertinente et paginée au-delà des petits résultats | P | Pagination à la demande AniList/Jikan/Steam/Open Library, puis TMDB/RAWG avec clés configurées (CI #572). Filtres conservés, dédoublonnage, reprise et courses entre recherches testés. Continuation Wikipedia par langue validée (CI #576). Classement titres/alias/thèmes/synopsis et deux recherches réelles contrôlés (CI #584). Extension de la couverture thématique, lenteur Jikan et progression Steam à examiner. |
| G09 | Filtres type, genre, diffusion, dates futures et prix correctement combinés | P | Contrôles présents ; cohérence entre fournisseurs et distinction diffusion terminée/saison terminée restante. |
| G10 | Jeux au-delà de Steam, boutiques officielles, prix et tags détaillés | P | Steam et RAWG avec clé personnelle : repli sur identifiant connu, plateformes/boutiques fusionnées, genres conservés et refresh sans perte des modifications personnelles testés. Prix multi-boutiques, droits et couverture réelle restent partiels. |
| G11 | Actualités récentes, codes et récompenses structurés avec expiration | NV | Ne pas confondre annonces génériques et codes actifs vérifiés. Flux officiels et expiration à réaliser. |
| G12 | Notifications par œuvre/jeu, catégories et désactivation réellement vérifiées | P | Préférences présentes ; livraison et suppression des événements périmés à valider. |
| G13 | Bibliothèque cohérente, compteurs, listes et actions rapides sans ajout invisible | P | Ajouts explicites, listes/imports/progression testés ; revue totale du tableau de bord et des compteurs restante. |
| G14 | Personnalisation profil : nom, bio, avatar/bannière recadrables et synchronisation | V | ProfileEditor et parcours web : image WebP, profil relu via API et écran étroit. D’autres personnalisations restent possibles sans invalider ce périmètre. |
| G15 | Amis, messages, partage de recommandations avec contrôle de confidentialité | NV | Service social complet absent. Invitations, refus/blocage, signalement et permissions nécessaires. |
| G16 | Traduction texte et images sur les pages/langues représentatives | P | OCR embarqué et scénarios réels existants ; qualité, toutes langues, panneaux difficiles et coût fournisseur à mesurer. |
| G17 | Traduction automatique par site, arrêt/restauration et permissions | P | Module et 22 nouveaux tests de validation/course/navigation ; parcours complet depuis le paquet Chrome restant. |
| G18 | Rôles propriétaires/admin et cadeaux contrôlés côté serveur | V | Tests HTTP, rôle revérifié, expiration, rejeu, transaction PostgreSQL et journal durable. Activation du propriétaire réel distincte. |
| G19 | Console admin utilisable : recherche exacte, confirmation, motif et mobile | V | Parcours web annulation/confirmation et écran étroit ; API simulée pour ce parcours, tests serveur séparés. |
| G20 | Paiement, renouvellement, annulation, remboursement et droits de bout en bout | P | Signature/webhooks et garde de destination présents ; aucun cycle complet du prestataire déployé vérifié. |
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

1. Maintenir G03 validé : conserver les contrôles Chrome, la sonde de catalogues réels et les captures ordinateur/mobile lors des changements de l’accueil.
2. Étendre recherche/fiches/jeux multi-boutiques et corriger les écarts de présentation avec un corpus réel.
3. Réconcilier avantages gratuits/Pro et limites de traduction avec une mesure de coûts. Tester paiement, annulation et révocation avant activation commerciale.
4. Configurer et vérifier le propriétaire ; voir ADMINISTRATION.md. Aucune promotion réelle n’a été faite par simple modification du code.
5. Finaliser couverture notifications, nouveautés à rattraper et données de récompenses. Le social reste un chantier distinct, non livré.
6. Valider production, documents exploitant, droits d’utilisation des données, sauvegarde/restore, accessibilité et publication Store.

Les prix affichés, le catalogue ou la traduction ne garantissent pas un revenu rapide. Les limites, disponibilités et coûts doivent être vérifiés sur les fournisseurs effectivement utilisés. Le code distribué dans une extension reste consultable ; les secrets et les droits commerciaux doivent être protégés côté serveur.
