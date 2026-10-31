# Yomu 0.4.4 — actions groupées dans les listes

Ajout dans l’extension de cases de sélection accessibles, sélection totale/partielle, compteur, destination, copie, déplacement et retrait groupés. Le retrait concerne uniquement la liste. Le déplacement copie avant de retirer ; si le retrait échoue, les deux exemplaires de l’appartenance restent conservés et le message indique l’étape en échec. Les commandes sont désactivées pendant la sauvegarde.

Une œuvre sélectionnée peut être réordonnée avec les boutons Monter/Descendre, utilisables au clavier, avec conservation du focus après sauvegarde. Le glisser-déposer rétablit l’ordre enregistré en cas d’échec.

Validation : tests Chrome sur stockage réel (copie conservant source, déplacement, retrait préservant les trois œuvres, réordonnancement avec Entrée, largeur mobile 375 px). Échec simulé du retrait pendant un déplacement : source et destination conservées, reprise réussie. Lint et diff sans erreur. ZIP 31 fichiers MV3 0.4.4 et migration depuis 0.3.1 vérifiés avec conservation des données. Les tests de migration lisent maintenant la version du manifeste livré au lieu d’un numéro fixe.

Limites : destination unique par opération, copie répétable vers plusieurs listes ; pas de partage public ; audit visuel exhaustif et problème Webtoon toujours ouverts. Avancement global estimé 52 %. Travail sur la branche existante, pas de fusion ou déploiement web.
