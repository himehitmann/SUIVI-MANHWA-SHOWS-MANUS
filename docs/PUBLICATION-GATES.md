# Priorités indispensables avant publication — 18 novembre 2026

**Décision actuelle : NE PAS PUBLIER, NE PAS OUVRIR LES VENTES.**

Instruction utilisateur du 18 novembre : traiter d’abord les indispensables ; annoncer explicitement lorsque tout est prêt pour que l’utilisateur publie lui-même. Aucune publication automatique, bêta gratuite, dépense ou activation des encaissements n’est autorisée par ce suivi. Les ventes restent fermées par défaut.

Cette liste ordonne le travail de lancement ; elle ne remplace pas la mesure globale fixe de 60 critères. Avancement global confirmé : **21/60 = 35 %**. Un test automatisé réussi ne constitue pas une preuve de service réellement déployé.

| Priorité | Condition de lancement | Situation actuelle et preuve requise |
| --- | --- | --- |
| 1 | Sécurité de la version distribuée et du serveur | Autorisations, signatures et isolation testées ; audit des dépendances actuellement bloquant. Corriger ou démontrer une remédiation vérifiable sans masquer l’alerte, puis obtenir tous les contrôles requis réussis sur le code final. Vérifier les secrets et paramètres du vrai déploiement. |
| 2 | Compte personnel, progression et sauvegarde récupérable | Restaurations PostgreSQL/Firebase et mise à jour Chrome testées en environnement isolé. Configurer le service réellement choisi, puis vérifier sauvegarde, reconnexion et récupération sur une autre installation avec le même compte. Un stockage local seul ne satisfait pas ce point. |
| 3 | Paiement et abonnement sans mauvaise attribution ni double achat | Parcours serveur et refus d’achat testés ; fournisseur simulé. Configurer les offres, les notifications signées et le portail, puis vérifier en mode test du marchand achat, activation sur les deux clients, renouvellement, résiliation, remboursement, panne/reprise et suppression de compte. Désactiver les anciens liens externes. Garder les ventes fermées tant que cette réception n’est pas achevée. |
| 4 | Parcours principaux compréhensibles et utilisables | Installation, recherche, ajout, reprise, bibliothèque, import/export, réglages et traduction doivent être testés sur la version candidate avec des sources représentatives. Corriger les boutons sans effet, erreurs bloquantes et défauts d’affichage majeurs. Ne pas promettre une exhaustivité ou une traduction illimitée non vérifiée. |
| 5 | Exploitation, support et informations publiques | Fournir les véritables informations exploitant/support et textes adaptés au service ; vérifier confidentialité, permissions et données envoyées aux fournisseurs. Tester récupération de compte, traitement d’une facturation ambiguë et demandes de suppression. Mesurer les coûts et limites avant de vendre les avantages annoncés. |
| 6 | Paquet et fiche Chrome Web Store prêts | Revoir la version finale, permissions justifiées, description, prix/avantages, captures et guide ; vérifier le compte éditeur et les modalités de publication. Le site et l’extension doivent pointer vers les bons services. L’utilisateur garde la main pour soumettre et ouvrir les ventes après réception. |

## Blocage de sécurité identifié le 18 novembre

L’audit CI du code f63074ecbf4404a93bd19120cc22728c6480b3c8 échoue sur picomatch 4.0.7, dépendance indirecte des outils de compilation, pour [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), déni de service par expressions régulières. L’audit indique >=4.0.8, mais la consultation du registre officiel le 18 novembre retourne latest=4.0.7 et « version not found: 4.0.8 ». Aucune fausse mise à jour, version inventée ou exception d’audit n’est ajoutée.

Le contrôle reste obligatoire et fait échouer le job. Il est exécuté après les parcours fonctionnels pour pouvoir examiner leurs résultats même pendant ce blocage. Un changement de son emplacement n’est pas une résolution de la vulnérabilité. Ne pas considérer un code dont cet audit échoue comme prêt à publier.

## Contraintes externes à résoudre sans engager de frais

L’hébergement, le compte marchand et le compte éditeur réels ne sont pas certifiés par les tests locaux/CI. Le propriétaire souhaite ne rien dépenser : ne souscrire aucun service payant automatiquement. Google indique que l’ouverture d’un compte développeur Chrome Web Store exige des frais d’inscription uniques ; vérifier si le compte existe déjà et traiter cette incompatibilité avant toute démarche payante. Source officielle : [inscription Chrome Web Store](https://developer.chrome.com/docs/webstore/register).

## Améliorations après les indispensables

Les enrichissements facultatifs (fonctions sociales supplémentaires, personnalisation avancée, nouveaux fournisseurs au-delà du périmètre annoncé, raffinements visuels secondaires) passent après les blocages ci-dessus. Les demandes restent dans GLOBAL-PROGRESS.md ; elles ne sont pas marquées réalisées pour accélérer artificiellement le lancement.

Quand tous les points indispensables disposent de preuves sur la version et les services réels, annoncer clairement à l’utilisateur que Yomu est prêt, avec les étapes de publication et les éventuelles limites explicitement acceptées. Jusqu’à cette réception, rester en état « non prêt à publier ».
