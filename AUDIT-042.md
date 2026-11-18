# Yomu 0.4.2 — 9 septembre 2026

Le bouton Réessayer relance uniquement les images échouées et conserve les traductions réussies. Les changements des attributs de chargement différé déclenchent une nouvelle prise en compte des images visibles ; data-url est pris en charge. Une réponse devenue obsolète après un changement de source ne recouvre plus la nouvelle image. Le popup indique un refus de permission pour les images et ne présente plus une connexion configurée sans synchronisation comme synchronisée.

Validation : lint ; parcours Chrome avec erreur img_503 simulée puis clic Réessayer et OCR réel réussi ; ZIP 31 fichiers, MV3 0.4.2 ; migration 0.3.1 vers 0.4.2 préservant compte, progression, listes et profil. Traductions du test automatisé simulées comme auparavant. Le diagnostic réseau réel du chapitre Webtoon EP141 a échoué par délai de navigation (45 secondes), donc la cause des cinq échecs signalés reste ouverte. Aucun contenu du chapitre n’est inclus dans le dépôt.

Avancement global estimé inchangé : 50 %. Audit exhaustif de tous les boutons et refonte premium globale non terminés.
