# Vérification des signatures de paiement

Les webhooks Stripe et Paddle vérifient le corps brut avant de lire le JSON ou de modifier les droits. Une signature doit correspondre au secret configuré sur le serveur et à une date de livraison récente.

## Rotation des secrets

Le vérificateur conserve tous les `v1` de Stripe et tous les `h1` de Paddle. Une correspondance suffit, quelle que soit sa position dans l'en-tête ; une signature d'un autre secret ne remplace donc plus une signature valide. Les schémas inconnus et les champs diagnostiques restent ignorés. La comparaison des condensats SHA-256 utilise `timingSafeEqual`.

Le serveur utilise toujours un seul secret configuré par fournisseur (`STRIPE_WEBHOOK_SECRET`, `PADDLE_WEBHOOK_SECRET`). Cette modification ne crée, ne change et ne révoque aucune clé chez les prestataires. Lors d'une rotation, remplacer le secret côté serveur pendant le chevauchement permis par le fournisseur, puis vérifier une livraison signée avant d'expirer l'ancien secret. Aucun secret ne doit être placé dans le paquet extension.

## Rejets et limites

- Une date répétée est refusée, même identique, pour éviter une interprétation ambiguë du contenu signé.
- La date doit être un entier décimal valide ; les écritures exponentielles, flottantes et les entiers non représentables sont refusés.
- Chaque signature candidate doit contenir exactement 64 caractères hexadécimaux.
- Un en-tête dépassant 8 Kio est refusé. Les champs additionnels connus ou inconnus ne sont pas utilisés pour accorder des droits.
- La tolérance par défaut est de 300 secondes pour Stripe et de 5 secondes pour Paddle, en accord avec la valeur documentée du SDK Paddle. Elle porte sur le passé et le futur. L'horloge du serveur doit être synchronisée.
- Une signature valide ne remplace pas la vérification du produit, du compte ou du reçu durable. Les protections existantes contre les doublons et les événements anciens restent nécessaires.

Les tests unitaires couvrent les positions des signatures, les deux clés de chevauchement, les métadonnées inconnues, Unicode, les modifications d'espaces, les en-têtes mal formés et les limites temporelles. Les tests HTTP utilisent de vraies routes Express, des signatures HMAC synthétiques et un stockage isolé : activation, annulation, rejeu, refus avant mutation et reprise d'un événement précédemment refusé. Aucune transaction réelle ni rotation de clé d'un compte prestataire n'est réalisée.

Références officielles consultées le 15 novembre 2026 : [Stripe — signatures et rotation](https://docs.stripe.com/events/manage-webhook-endpoints), [Paddle — vérification et signatures multiples](https://developer.paddle.com/webhooks/about/signature-verification/).
