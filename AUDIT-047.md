# Traduction Webtoon et dépendances — 0.4.7

Diagnostic réel : les cinq premières images du chapitre EP141 fourni renvoient HTTP 403 depuis le worker. La requête normale provenant de la page Webtoon renvoie HTTP 200 avec CORS autorisé. La récupération de secours utilise fetch dans le content script, avec le référent normal de la page et sans identifiants, puis transmet l’image au moteur OCR local. Aucune nouvelle permission, modification de headers ou contournement CORS n’est ajouté. La taille est limitée à 25 Mo et le type attendu est une image. Le placeholder bg_transparency est reconnu pour sélectionner data-url.

Test réel depuis la page : panneau 1, 2 blocs OCR sans traduction différente ; panneau 2, 5 blocs dont 2 traduits ; panneaux 3 à 5 refusés par Google GTX avec HTTP 429. Cela identifie deux causes distinctes ; cela ne valide pas une traduction complète du chapitre. Les images ne sont pas enregistrées dans le dépôt.

Gestion de limite : respecte Retry-After (au moins une minute), persiste le délai localement et évite de transformer un lot refusé en requêtes individuelles. Message compréhensible dans la page. Aucune promesse de service illimité ni fournisseur alternatif simulé.

Vitest 4.1.11 remplace 3.2.6 pour corriger GHSA-82fw-gwwq-j7x9. Validation : 188 tests/20 fichiers, TypeScript, lint, audit sans vulnérabilité connue ; ZIP 31 fichiers et migration 0.3.1 vers 0.4.7 réussis. Test Chrome d’un refus 403 suivi de récupération depuis la page puis vrai OCR réussi, avec réponse de traduction déterministe dans ce test.

Limites : qualité de reconnaissance/rendu réelle à améliorer ; disponibilité du fournisseur non garantie ; Chrome personnel inaccessible à l’outil de contrôle ; audit global du produit toujours incomplet. Avancement estimé : 55 %.
