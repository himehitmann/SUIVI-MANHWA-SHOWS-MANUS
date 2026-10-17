# Stripe Lifetime : remboursements intégraux

Le serveur traite les notifications signées `charge.refunded`, `refund.created` et `refund.updated`. Ajouter ces trois événements à l’endpoint Stripe `/api/webhooks/stripe`, en plus des événements Checkout et abonnements déjà utilisés. Le secret de signature de cet endpoint (`STRIPE_WEBHOOK_SECRET`), la clé API serveur (`STRIPE_SECRET_KEY`) et le prix Lifetime (`STRIPE_PRICE_LIFETIME`) doivent être configurés côté serveur uniquement.

## Comportement

- Relire la charge chez Stripe et vérifier le total effectivement remboursé avec les remboursements au statut `succeeded`. Un remboursement partiel, en attente, annulé ou échoué ne retire pas l’accès.
- Retrouver la session Checkout par son PaymentIntent et vérifier le produit Lifetime configuré. Aucun rapprochement par montant, nom ou email du remboursement.
- Retirer uniquement les droits issus de cet achat. Conserver un autre achat Lifetime, un abonnement Pro actif et les droits d’administration/cadeaux gérés séparément.
- Enregistrer durablement que cet achat a été remboursé : les confirmations d’achat tardives ne le réactivent pas, même après redémarrage.
- Préserver les anciens droits Lifetime qui ne sont pas rattachés à un achat enregistré. Leur provenance demande une réconciliation manuelle ; ne pas les supprimer par déduction.
- Retourner une erreur réessayable si Stripe est indisponible ou si ses réponses sont incohérentes. Les réponses API sont limitées à 64 Kio et chaque requête à cinq secondes. Une liste de plus de 100 remboursements est refusée pour examen, sans révocation automatique.

## Vérification avant activation commerciale

Dans le mode test Stripe du déploiement, vérifier un achat Lifetime, un remboursement partiel puis intégral réussi, un remboursement différé, et une redélivrance de notification. Contrôler le plan via le compte connecté et les journaux du webhook. Vérifier aussi le cas avec un abonnement Pro ou un deuxième achat Lifetime. Les tests automatisés simulent Stripe et utilisent PostgreSQL réel isolé ; ils ne remplacent pas ce cycle fournisseur sur le déploiement.

Paddle, les contestations de paiement et le remboursement des abonnements récurrents ne sont pas couverts par ce correctif. Un remboursement de facture ne vaut pas annulation d’abonnement.

## Références fournisseur

- [Charge et indicateur refunded](https://docs.stripe.com/api/charges/object)
- [Statuts de remboursement](https://docs.stripe.com/api/refunds/object)
- [Liste des remboursements d’une charge](https://docs.stripe.com/api/refunds/list)
- [Recherche Checkout par PaymentIntent](https://docs.stripe.com/api/checkout/sessions/list)
- [Événements Stripe](https://docs.stripe.com/api/events/types)
