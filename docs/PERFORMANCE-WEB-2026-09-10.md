# Performance web — 10 septembre 2026

Les écrans secondaires sont chargés à la demande avec React.lazy et Suspense. L’accueil reste immédiat. Message de chargement traduit et annoncé ; traces d’erreur techniques limitées au développement.

Mesure du build vérifié : fichier principal minifié 580,22 ko vers 391,21 ko ; gzip 187,32 ko vers 127,51 ko. Les autres écrans se chargent séparément : ce gain ne représente pas une réduction de tout le JavaScript ni une mesure de latence réelle.

Validation avant interruption : TypeScript, lint, build et parcours web réussis (compte, import, progression, notes, sync, isolation/restauration des comptes et mobile). Aucun déploiement en production. Extension inchangée en 0.4.5. Cahier des charges global non terminé, estimation 54 %.
