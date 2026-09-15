# Alertes Steam — 0.4.6

La minuterie de vérification n’est créée que si elle manque. Sa prochaine échéance n’est plus repoussée à chaque démarrage du service worker. Les vérifications simultanées sont coalescées. Les réponses d’un compte précédent, et celles visant une source Steam modifiée entre-temps, sont ignorées. Une sortie nécessite toujours une confirmation Steam ; aucune disponibilité n’est déduite uniquement d’une date.

Tests : 186 tests/20 fichiers réussis, lint, ZIP MV3 31 fichiers, parcours Chromium, migration 0.3.1 vers 0.4.6 conservant les données. Vérification Chrome de la même échéance après deux initialisations d’alarme. Cas de réponse tardive après changement de compte et de vérifications concurrentes testés. Appels Steam simulés dans les tests ; pas de validation réseau exhaustive des sorties.

Améliorations web déjà publiées séparément : chargement différé des écrans, build principal réduit, parcours web validés. Pas de déploiement web ni publication Web Store. Traduction directe Webtoon toujours ouverte. Avancement global estimé : 54 %.
