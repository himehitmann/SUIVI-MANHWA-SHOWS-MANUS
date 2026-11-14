# Réception du parcours de recherche — 31 octobre 2026

Critère G08 : recherche progressive rapide, pertinente et paginée au-delà des petits résultats. Statut : V.

Commit vérifié : ca32ed94dbaf34596af1b918b0fd1abdfbaa7ae3.
- [CI PR, avec observation réelle](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/41190184934)
- [CI push](https://github.com/himehitmann/SUIVI-MANHWA-SHOWS-MANUS/actions/runs/41190181910)

660 tests unitaires, contrôles navigateur, capacité et récupération réussis. Audit des dépendances sans vulnérabilité connue à cette exécution.

## Preuves complémentaires

| Aspect | Vérification |
| --- | --- |
| Affichage progressif | Premiers résultats reçus avant la fin des sources lentes ; tests simulés et cinq recherches réelles. |
| Pertinence | Titres exacts, alias, accents, thèmes, synopsis, écritures asiatiques et conservation de l’index de fiche : tests unitaires/navigateur. Titres exacts en tête du classement d’interface sur les cinq observations réelles. |
| Pagination | Résultats précédents conservés, identités dédoublonnées, filtres conservés, sources manga/anime indépendantes, nouvelle recherche protégée contre l’ancienne page : tests automatisés. Deux pages réelles pour cinq requêtes. |
| Steam | 25 identifiants sur chaque page non vide ; offsets 0 puis 25 observés. Les pages répétées restent rejetées. |
| Recherche vide Steam | La réponse start=-1 et total_count=0 sans jeu est désormais reconnue comme épuisée. Une seule requête réelle sur 鬼滅の刃 ; aucune relance à la seconde page des autres sources. Réponses incohérentes toujours rejetées par les tests. |
| Reprise | Délai global, requête sans réponse, réponse mal formée, bouton réessayer, conservation des résultats et réponses tardives testés dans ui-audit.mjs. |
| Saisie | Composition asiatique sans requêtes intermédiaires, délai de frappe et changement de langue sans perdre la recherche : tests navigateur. |
| Thèmes | Dictionnaire fournisseur et alias français, manga/anime distincts, panne isolée, pagination et publication indépendante de la recherche par titre testés. |
| Attente Jikan | Six secondes incluant l’attente en file, interruption active, expiration sans appel inutile et reprise testées. |

## Observation réelle

Chromium dans GitHub Actions, compte de test vide, fournisseurs sans clé. Mesure échantillonnée toutes les 500 ms : les valeurs proches de 500 ms signifient que des résultats étaient disponibles au premier relevé, pas une précision à la milliseconde de l’affichage humain.

| Requête | Premier relevé avec résultats | Fin du premier tour | Résultats après pagination | Durée du second tour |
| --- | --- | --- | --- | --- |
| yandere | 502 ms | 6116 ms | 208 → 354 | 580 ms |
| portal | 501 ms | 3004 ms | 59 → 104 | 1002 ms |
| 鬼滅の刃 | 501 ms | 501 ms | 43 → 61 | 503 ms |
| Breaking Bad | 501 ms | 1001 ms | 54 → 96 | 502 ms |
| Stardew Valley | 501 ms | 501 ms | 46 → 96 | 502 ms |

Toutes les recherches ont terminé leurs deux tours. Jikan a dépassé son délai sur la première recherche puis sa suspension temporaire a été respectée ; chaque réponse reste explicitement partielle. Les autres sources ont fourni les résultats. Un titre identique peut désigner plusieurs œuvres de médias différents : le dédoublonnage exige une identité compatible, il ne fusionne pas les homonymes.

## Limites et critères distincts

Cette réception porte sur le fonctionnement du parcours G08, avec les sources disponibles et la gestion des pannes. Elle ne garantit pas une latence identique sur tous les réseaux, la disponibilité permanente de Jikan, ni une pertinence parfaite pour chaque requête. Les appels TMDB/RAWG configurés par clé sont couverts par des tests simulés, pas par cette observation sans clé.

G02 (couverture/exhaustivité des œuvres), G10 (jeux et boutiques), G16 (traduction), G23/G24 (déploiement et publication) restent distincts et non clôturés par cette réception. Aucun changement installé dans Chrome utilisateur.
