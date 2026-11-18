# Comptes et synchronisation — version 0.4.0

Les données locales sont séparées par origine de service et compte. Se connecter ne transfère plus silencieusement la bibliothèque de l'invité ou du compte précédent. Les anciennes données restent conservées sur le disque. Les caches de compte ne sont pas copiés dans chrome.storage.sync, partagé par le profil Chrome.

La logique de fusion unique est dans shared/sync-core.ts. Le fichier sync-core.js de l'extension est généré par pnpm build:sync et inclus dans le ZIP. Les modifications datent les enregistrements réellement changés. Les suppressions sont conservées sous forme de tombstones ; les opérations d'appartenance aux listes fusionnent séparément. Une synchronisation d'un appareil ancien ne doit pas ressusciter une suppression. Les tombstones ne sont pas purgés arbitrairement tant qu'un appareil hors ligne peut revenir.

Le store fichier fusionne et persiste atomiquement dans un processus. Il ne doit pas être partagé entre plusieurs processus. Le store PostgreSQL verrouille la ligne du compte dans une transaction avec une connexion dédiée avant de lire et fusionner sa bibliothèque. La dépendance pg est désormais incluse. Les tests locaux de PostgreSQL restent des tests d'adaptateur ; un test sur une vraie instance est encore requis avant exploitation.

Une table sessions est créée sans supprimer les tables existantes. La base fichier reçoit une collection sessions vide si elle n'existait pas. Les nouvelles connexions créent une session serveur révocable. Les anciens jetons sans identifiant de session nécessitent une nouvelle connexion : les bibliothèques ne sont pas supprimées. Le changement de mot de passe invalide les autres sessions et remet un jeton neuf à l'appareil courant. La déconnexion ordinaire révoque uniquement sa session. La suppression du compte vérifie le mot de passe puis supprime compte, sessions et bibliothèque serveur. L'interface avertit qu'une copie locale est conservée.

Avant mise en production : sauvegarder la base persistante ; vérifier sa lecture ; déployer le serveur et les deux clients ensemble ; contrôler une connexion, la révocation d'un jeton et un cycle de synchronisation. Un retour à un ancien serveur dépourvu de tombstones ne garantit pas la conservation des suppressions. Préférer une correction en avant et conserver la sauvegarde.

Vérification exécutée le 8 septembre 2026 : 156 tests unitaires/intégration passent ; TypeScript et build passent ; audit des dépendances sans vulnérabilité connue. Le ZIP 0.4.0 a été extrait et chargé dans Chromium : sauvegarde dans une liste, limites de progression, recherche concurrente, affichage mobile, popup de 564 px, OCR anglais/japonais/image longue, superposition et restauration passent. La page synthétique de test est ajoutée uniquement au dossier temporaire du banc de test, jamais au ZIP distribué.

Aucun déploiement web n'est déclaré dans les métadonnées GitHub consultées (pas de homepage ni de GitHub Pages). Le service de comptes, la facturation et les emails ne sont donc pas déclarés opérationnels en ligne.

Le scénario de mise à jour dans un profil Chromium persistant passe également : version 0.3.1 vers 0.4.0, même identifiant d’extension, compte/progression/listes/profil conservés. Les fixtures sont enregistrées après les migrations via la même file d’écriture que le produit.
