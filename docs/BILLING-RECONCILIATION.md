# Réconciliation des notifications d’abonnement

Deux notifications d’un même abonnement peuvent porter la même date tout en indiquant des droits différents. Le serveur ne choisit pas un ordre d’après leur identifiant ou leur arrivée : il relit l’abonnement auprès de Stripe ou Paddle.

La lecture vérifie l’identifiant de ressource, le produit configuré et le compte auquel le prestataire rattache l’abonnement. Un état inconnu, un autre compte, une liste de produits tronquée ou une panne ne modifie pas les droits : le reçu n’est pas consommé et le webhook répond 503 pour une nouvelle livraison.

## Concurrence et persistance

PostgreSQL conserve les verrous de la ressource et du compte pendant cette lecture, limitée à cinq secondes et 64 Kio. Cela sérialise les changements de droits du compte concerné. Le stockage fichier vérifie après la lecture qu’aucun changement concurrent du compte ou de la ressource n’est intervenu ; sinon il refuse l’application et demande une nouvelle livraison.

Une ressource réconciliée reste identifiée comme telle après redémarrage. Ses notifications suivantes qui ne sont pas déjà anciennes relisent aussi le prestataire. Ce coût réseau est limité aux abonnements concernés par une ambiguïté ; il évite qu’un événement intermédiaire livré tardivement remplace l’état courant déjà vérifié. Les doublons enregistrés et événements plus anciens ne relancent pas la lecture.

Les autres abonnements du compte restent pris en compte. Les marqueurs d’achats Lifetime remboursés gardent leur priorité.

## Configuration et validation

Configurer côté serveur `STRIPE_SECRET_KEY` ou `PADDLE_API_KEY` avec l’autorisation de lecture des abonnements (`subscription.read` chez Paddle), en plus des secrets de signature. `PADDLE_ENVIRONMENT` doit correspondre à la clé, aux prix et au webhook. Aucun domaine API n’est fourni par l’événement.

Les tests automatisés simulent les API prestataires et vérifient les transactions sur PostgreSQL réel isolé. Avant mise en ligne, vérifier ce parcours avec les clés de test du déploiement, notamment panne/reprise et livraison répétée. Les contestations de paiement et le cumul des remboursements partiels Paddle ne sont pas traités par ce mécanisme.

Références : [Stripe](https://docs.stripe.com/api/subscriptions/retrieve), [Paddle](https://developer.paddle.com/api-reference/subscriptions/get-subscription/).
