# Suivi global Yomu

Mise à jour : 20 septembre 2026. Branche : fix/yomu-p0-reliability. Ce suivi remplace toute interprétation du précédent « 39 % » comme avancement du produit entier.

## Mesure fixe

60 critères de réception : les 36 contrôles de docs/DELIVERY-AUDIT-2026-09-16.md, plus les 24 critères produit et lancement ci-dessous. Chaque critère a le même poids. V = entièrement vérifié dans le périmètre défini ; P = partiel ; NV = non vérifié ou absent. Seuls les V comptent. Ce score est une couverture des exigences validées, pas une estimation des heures, de la qualité perçue ou du nombre de lignes de code.

**18 / 60 = 30 % global vérifié.** Les contrôles historiques comptent 14 V et les critères supplémentaires 4 V. Le périmètre élargi explique la différence avec l’ancien 14/36 (39 %), qui concernait un lot d’audit uniquement. Tout changement de dénominateur devra être explicite.

## Preuves actuelles

[CI #455](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/35523972755), commit 60eeee3e7461bb562ae4eea7641702799f99f363 : 382 tests unitaires passent, ainsi que lint, TypeScript, compilation, contrôle de sécurité et audit des dépendances. Les parcours web, paquet Chrome, recadrage, listes et vidéo réussissent. La sonde PostgreSQL/capacité réussit également. Le précédent échec de hauteur du popup n'est plus présent sur cette exécution.

Les scénarios de panne RAWG/Steam, les fusions de plateformes/boutiques et les contrôles d'identité Steam sont vérifiés avec des réponses fournisseur simulées. Ils ne prouvent ni l'exhaustivité du catalogue ni la disponibilité de chaque API réelle. La sonde de charge isolée ne certifie pas une capacité de production. La validation ci-dessus concerne le commit de code cité ; cette mise à jour documentaire ne modifie pas le produit.

## Critères produit et lancement

| ID | Critère de réception | État | Preuve ou travail restant |
|---|---|---|---|
| G01 | Identité entre sites et langues, titres alternatifs et auteurs sur une collection représentative | P | Fusions confirmées et conflits testés ; mesurer rappel/précision sur corpus réel multilingue. Ne pas fusionner adaptations/remakes sur le seul titre. |
| G02 | Couverture multi-fournisseur et fonctionnement dégradé sans AniList | P | Sources/replis disponibles selon média ; sources demandées non toutes intégrées. Aucune exhaustivité revendiquée. |
| G03 | Accueil actuel, catégories pertinentes et recommandations texte/goûts | P | Tendances/carrousels présents ; contrôler fraîcheur, catégories régionales et pertinence sur données réelles. |
| G04 | Nouveautés à rattraper disparaissant après lecture/visionnage | P | Données épisodes compatibles ; chapitres manga et calendrier global incomplets. |
| G05 | Fiches internes complètes avec tags, personnages, acteurs et titres lisibles | P | Fiches internes présentes ; complétude des fournisseurs et présentation à élargir. |
| G06 | Images et bandes-annonces robustes, sans recadrage gênant | P | Replis, proportions et activation volontaire présents ; vidéos indisponibles et portrait réel à vérifier. |
| G07 | Saisons et épisodes nommés avec progression cohérente | P | Guide TVmaze disponible ; autres catalogues et saisons particulières à compléter. |
| G08 | Recherche progressive rapide, pertinente et paginée au-delà des petits résultats | P | Cache et plusieurs sources ; plafond de résultats et couverture descriptions/titres à améliorer. |
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

## Priorités de livraison

1. Maintenir les contrôles Chrome réussis ; tester le mode de traduction automatique depuis le popup réel.
2. Étendre recherche/fiches/jeux multi-boutiques et corriger les écarts de présentation avec un corpus réel.
3. Réconcilier avantages gratuits/Pro et limites de traduction avec une mesure de coûts. Tester paiement, annulation et révocation avant activation commerciale.
4. Configurer et vérifier le propriétaire ; voir ADMINISTRATION.md. Aucune promotion réelle n’a été faite par simple modification du code.
5. Finaliser couverture notifications, nouveautés à rattraper et données de récompenses. Le social reste un chantier distinct, non livré.
6. Valider production, documents exploitant, droits d’utilisation des données, sauvegarde/restore, accessibilité et publication Store.

Les prix affichés, le catalogue ou la traduction ne garantissent pas un revenu rapide. Les limites, disponibilités et coûts doivent être vérifiés sur les fournisseurs effectivement utilisés. Le code distribué dans une extension reste consultable ; les secrets et les droits commerciaux doivent être protégés côté serveur.
