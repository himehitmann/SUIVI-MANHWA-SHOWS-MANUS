# Yomu 0.4.3 — bibliothèque et personnalisation

Les modifications d’œuvre, de liste et de profil attendent maintenant une réponse de sauvegarde valide avant de modifier les données affichées. Une suppression échouée ne masque plus l’œuvre. Le détail d’œuvre se rafraîchit après confirmation sans minuterie de 30 ms. Le menu rapide de liste attend la sauvegarde avant de rafraîchir la coche.

Le changement de couverture ouvre directement le recadrage sans demander de taper upload. Retirer la couverture et utiliser une URL HTTP(S) restent possibles. Le recadrage attend la sauvegarde et reste ouvert en cas de refus. Avatar et bannière existants peuvent être réouverts dans le recadrage.

Validation : lint, tests Chrome de recadrage ordinateur/mobile et zoom ; erreurs de stockage simulées vérifiant que progression, liste et profil restent inchangés ; parcours Chrome sur ZIP MV3 à 31 fichiers ; migration 0.3.1 vers 0.4.3 conservant compte, progression, listes et profil. La suite de 177 tests avait passé en 0.4.1 ; elle n’a pas été relancée pour ce lot UI.

Reste : audit exhaustif et harmonisation visuelle de tous les écrans, diagnostic du chapitre Webtoon et autres objectifs du cahier des charges. Avancement global estimé : 51 %. Aucun déploiement du site ni fusion sur main.
