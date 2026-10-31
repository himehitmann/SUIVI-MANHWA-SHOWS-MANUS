# Réception G13 — bibliothèque — 29 octobre 2026

Critère existant : bibliothèque cohérente, compteurs, listes et actions rapides sans ajout invisible.

État testé : 05fe657dea836321fa21e140718b7358a8cdb6de. CI PR https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40826822924 et push https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/40826817160 : toutes les tâches réussies.

## Vérifications nouvelles

tests/e2e/ui-audit.mjs produit test-results/library-acceptance.json. Jeu de données comprenant lectures, séries/anime et jeu, états explicites et terminé déduit, favoris, titres alternatifs, auteurs, étiquettes, liste active, liste archivée, membre dupliqué et référence absente.

- 216 combinaisons : neuf filtres principaux × trois formats × deux choix sans liste × quatre recherches, avec identifiants attendus indépendants. Compteur de résultats, sélection des contrôles et compteurs globaux vérifiés.
- Cinq tris : titre, note, activité récente, date d’ajout, épisodes/chapitres restants ; ordres attendus explicites.
- Compteurs globaux et raccourcis de sections, membres de liste dédupliqués et références absentes exclues.
- Aucun résultat filtré distingué d’une bibliothèque vide ; remise à zéro de tous les filtres ; bibliothèque ne contenant que des jeux avec accès aux jeux et à la recherche.
- États d’affichage après retrait d’une œuvre, changement de type, archivage, ajout d’un élément importé et retrait d’un site. Ces vérifications injectent des états et ne constituent pas, seules, une preuve de persistance.
- Correction : un filtre de format actif reste affiché dans le menu même après disparition de la dernière œuvre de ce format, au lieu de laisser apparaître Tous avec un filtre caché.

## Vérifications complémentaires exécutées dans la même CI

Les parcours existants extension.mjs, bulk-lists.mjs et ui-audit.mjs couvrent les ajouts explicites depuis le catalogue, imports, progression, favoris/notes, création/duplication/archivage/restauration, copie/déplacement/retrait, réordonnancement, recherches d’ajout et rechargement du stockage. Les tests d’erreurs récents couvrent réponses absentes, invalides et tardives, reprise, conservation des brouillons et navigation.

La suite UI contrôle les cinq vues à 320, 390, 768 et 1440 pixels, les bornes des vues et chevauchements des commandes d’en-tête ; d’autres scénarios couvrent les libellés longs et les panneaux. Cela ne constitue pas une approbation esthétique globale.

La suite web vérifie les parcours existants de compte, import de sauvegarde extension, progression, notes, synchronisation via API de test, déconnexion/reconnexion et listes. Les contrôles de capacité et récupération utilisent des environnements isolés.

643 tests unitaires passent et l’audit des dépendances ne signale aucune vulnérabilité connue à cette exécution.

## Décision et limites

G13 passe de P à V dans son périmètre fonctionnel défini. Le dénominateur reste 60 ; les contrôles historiques restent 14 V, les critères produit passent de 5 à 6 V. Total : 20/60 = 33,3 %.

Cette réception ne valide pas l’ensemble du produit : refonte esthétique de l’accueil, exhaustivité des catalogues/trailers, traduction universelle, sauvegarde cloud réelle après désinstallation, paiement et publication Chrome restent distincts. Pas de garantie de zéro bug ou de concurrence arbitraire multi-appareils. Aucun changement installé dans le navigateur utilisateur.

La première exécution de la matrice échouait car le test injectait ses données sans redessiner les compteurs ; le test a été corrigé avec renderAll avant les assertions, sans modifier les valeurs attendues.
