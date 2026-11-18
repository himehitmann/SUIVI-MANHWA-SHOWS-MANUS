# Contestations Stripe des achats à vie

Le serveur traite les cinq événements `charge.dispute.created`, `updated`, `closed`, `funds_withdrawn` et `funds_reinstated`, après vérification de leur signature. Il rattache la charge à une unique session Checkout d'un produit Lifetime configuré. Les paiements hors Checkout, offres inconnues et abonnements récurrents ne sont pas traités par ce parcours.

## Droits réversibles

L'état indiqué dans l'événement ne suffit pas à changer les droits. Sous le verrou de la ressource et du compte PostgreSQL, le serveur relit la session, son produit, le PaymentIntent, sa charge et la liste complète des contestations de cette charge. Le compte, les identifiants, le montant capturé et les devises doivent correspondre.

Une contestation actuellement perdue sur la totalité du montant retire uniquement le droit apporté par cet achat. Une contestation gagnée ensuite permet de le rétablir. Les contestations en cours, avertissements et pertes partielles ne retirent pas à eux seuls l'accès à vie ; leur traitement commercial reste manuel. Un remboursement intégral reste prioritaire et ne peut pas être annulé par une contestation gagnée.

La marque de réconciliation est persistante. Les notifications d'achat livrées ensuite relisent elles aussi l'état actuel : une ancienne confirmation d'achat ne peut pas réactiver à elle seule une offre contestée. Les autres achats, abonnements, droits administrateur/cadeaux et sauvegardes restent indépendants.

## Erreurs, concurrence et données

Une lecture indisponible, une liste vide ou tronquée, une identité incohérente ou un état inconnu ne consomme pas le reçu. Le webhook renvoie 503 pour permettre une nouvelle livraison. Les lectures utilisent le domaine Stripe fixe, refusent les redirections et limitent chaque réponse à cinq secondes et 64 Kio. Le flux peut effectuer plusieurs lectures successives.

PostgreSQL sérialise le changement sous verrou et enregistre état et reçu dans la même transaction. Le stockage fichier refuse l'écriture si le compte ou la ressource ont changé pendant la lecture. Les doublons déjà appliqués ne déclenchent pas une nouvelle modification des droits. La résolution initiale du paiement peut toutefois relire Stripe avant cette détection.

La migration ajoute uniquement la colonne booléenne `billing_heads.lifetime_reconciled` avec valeur initiale fausse. Elle est réexécutable et ne supprime aucune donnée.

## Configuration et limites

Configurer les secrets Stripe côté serveur et donner à la clé les droits de lecture nécessaires aux charges, Checkout/produits et contestations. Sélectionner les cinq événements ci-dessus dans le webhook de test, puis vérifier le cycle sur le déploiement avant activation commerciale.

Ce lot ne déploie rien, ne facture personne et n'envoie aucune réponse à une banque. Les preuves bancaires, litiges Paddle, litiges sur abonnements récurrents, pertes partielles, différences de devises et cas hors des bornes de lecture restent à traiter séparément. Les tests utilisent des réponses Stripe simulées et une base PostgreSQL réelle isolée ; ils ne certifient pas un cycle bancaire réel.

Références consultées le 15 novembre 2026 : [liste des contestations par charge](https://docs.stripe.com/api/disputes/list), [cycle de vie d'une contestation](https://docs.stripe.com/disputes/how-disputes-work), [objet contestation](https://docs.stripe.com/api/disputes/retrieve).
