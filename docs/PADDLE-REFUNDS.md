# Paddle Lifetime : remboursement intégral

Le webhook `/api/webhooks/paddle` traite `adjustment.created` et `adjustment.updated`. Activer les deux dans Paddle : certains remboursements sont approuvés dès leur création. L’état `pending_approval` ne retire aucun droit.

## Configuration serveur

- `PADDLE_WEBHOOK_SECRET` : secret de signature de cet endpoint.
- `PADDLE_API_KEY` : clé API serveur autorisée à lire les transactions.
- `PADDLE_ENVIRONMENT` : `sandbox` pour les essais, `live` pour la production (valeur par défaut). Clé, endpoint webhook et prix doivent appartenir au même environnement.
- `PADDLE_PRICE_LIFETIME` : identifiant du prix Lifetime vendu.

Aucune clé API dans l’extension ni dans les variables `VITE_*`. Les hôtes API sont fixes ; les données du webhook ne choisissent pas l’adresse appelée. Lecture limitée à cinq secondes et 64 Kio, sans redirection.

## Droits d’accès

Seul un ajustement signé `refund`, `full`, `approved` sur une transaction sans abonnement est traité. Le serveur relit la transaction et vérifie son identité, son client, le produit Lifetime, la devise et le montant intégral. Un avoir, une contestation ou un remboursement en attente/partiel n’est pas assimilé à ce remboursement.

L’achat est marqué remboursé durablement. Un ancien événement `transaction.completed` ne peut plus le réactiver. Un autre achat Lifetime ou abonnement Pro reste valable. Les rôles et cadeaux administrateur sont gérés séparément. Les anciens droits Lifetime sans achat enregistré restent conservés pour réconciliation.

En cas de panne fournisseur ou de preuve incohérente, réponse 503 permettant une nouvelle livraison ; aucun changement de droits. Le paiement récurrent reste piloté par son abonnement.

## Limites et recette avant mise en ligne

Ce lot couvre un ajustement intégral approuvé, pas la somme de plusieurs remboursements partiels, les contestations, ni l’annulation d’un abonnement. Les tests HTTP simulent Paddle et les tests PostgreSQL utilisent une base isolée réelle.

Avant activation commerciale, réaliser dans le sandbox du déploiement : achat Lifetime, remboursement partiel sans retrait, remboursement intégral d’un achat distinct puis approbation, redélivrance du même événement, compte possédant aussi Pro. Vérifier les droits depuis le compte connecté, les erreurs de webhook et les notifications reçues. Aucun remboursement réel n’a été effectué par les tests.

## Documentation officielle

- [Événements d’ajustement et approbation](https://developer.paddle.com/webhooks/adjustments/adjustment-updated/)
- [Lecture d’une transaction](https://developer.paddle.com/api-reference/transactions/get-transaction/)
- [Environnements et API](https://developer.paddle.com/api-reference/about/)
