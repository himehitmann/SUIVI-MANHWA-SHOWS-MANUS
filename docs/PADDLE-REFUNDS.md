# Paddle Lifetime : remboursements

Le webhook `/api/webhooks/paddle` traite `adjustment.created` et `adjustment.updated`. Activer les deux dans Paddle : certains remboursements sont approuvés dès leur création. L’état `pending_approval` ne retire aucun droit.

## Configuration serveur

- `PADDLE_WEBHOOK_SECRET` : secret de signature de cet endpoint.
- `PADDLE_API_KEY` : clé API serveur autorisée à lire les transactions et les ajustements (`transaction.read`, `adjustment.read`). La réconciliation d’abonnements utilise aussi `subscription.read`.
- `PADDLE_ENVIRONMENT` : `sandbox` pour les essais, `live` pour la production (valeur par défaut). Clé, endpoint webhook et prix doivent appartenir au même environnement.
- `PADDLE_PRICE_LIFETIME` : identifiant du prix Lifetime vendu.

Aucune clé API dans l’extension ni dans les variables `VITE_*`. Les hôtes API sont fixes ; les données du webhook ne choisissent pas l’adresse appelée. Lecture limitée à cinq secondes et 64 Kio, sans redirection.

## Droits d’accès

Un ajustement signé `refund`, `approved` sur une transaction sans abonnement est traité. Pour `full`, son montant doit couvrir l’achat. Pour `partial`, le serveur relit la liste des ajustements de cette transaction et additionne uniquement les remboursements approuvés ; il retire les droits seulement lorsque leur somme couvre exactement le montant de l’achat. Le serveur relit la transaction et vérifie son identité, son client, le produit Lifetime, la devise et le montant intégral. Un avoir, une contestation ou un remboursement en attente n’entre pas dans ce total. Un remboursement partiel dont le cumul reste inférieur au prix de l’achat conserve l’accès.

L’achat est marqué remboursé durablement. Un ancien événement `transaction.completed` ne peut plus le réactiver. Un autre achat Lifetime ou abonnement Pro reste valable. Les rôles et cadeaux administrateur sont gérés séparément. Les anciens droits Lifetime sans achat enregistré restent conservés pour réconciliation.

En cas de panne fournisseur ou de preuve incohérente, réponse 503 permettant une nouvelle livraison ; aucun changement de droits. Le paiement récurrent reste piloté par son abonnement.

## Limites et recette avant mise en ligne

Le cumul est borné à une page complète de 100 ajustements et à 64 Kio par réponse. Pagination restante, doublon d’identifiant, absence de l’ajustement déclencheur, mauvaise devise ou total incohérent entraînent une réponse réessayable sans changement des droits. Au-delà de ces limites, une réconciliation opérateur reste nécessaire. Les contestations et l’annulation d’un abonnement ne sont pas couvertes. Les tests HTTP simulent Paddle et les tests PostgreSQL utilisent une base isolée réelle.

Avant activation commerciale, réaliser dans le sandbox du déploiement : achat Lifetime, remboursement partiel sans retrait, second remboursement partiel portant le cumul à la totalité, remboursement intégral d’un achat distinct puis approbation, redélivrance du même événement, compte possédant aussi Pro. Vérifier les droits depuis le compte connecté, les erreurs de webhook et les notifications reçues. Aucun remboursement réel n’a été effectué par les tests.

## Documentation officielle

- [Événements d’ajustement et approbation](https://developer.paddle.com/webhooks/adjustments/adjustment-updated/)
- [Lecture d’une transaction](https://developer.paddle.com/api-reference/transactions/get-transaction/)
- [Environnements et API](https://developer.paddle.com/api-reference/about/)

- [Liste et pagination des ajustements](https://developer.paddle.com/api-reference/adjustments/list-adjustments/)
