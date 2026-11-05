# Yomu 0.4.1 — validation du 9 septembre 2026

Corrections : recadrage responsive (bannière, avatar, couverture), zoom à la molette autour du pointeur, suppression du padding de l’avatar de navigation, protection contre un chargement d’image après fermeture. Commandes vidéo visibles et contrôle des vidéos dans les cadres autorisés et shadow roots ouverts. Traduction : langue source masquée, modèle français local et diagnostic des erreurs affiché.

Validation : 177 tests unitaires/intégration ; lint ; ZIP MV3 31 fichiers ; parcours Chrome et migration 0.3.1 vers 0.4.1 ; recadrage 1280/375 px ; changement de vitesse à 1.25 et entrée PiP sur vidéo enregistrée localement dans un shadow root. Le test vidéo utilise un paquet temporaire avec permission localhost et simule uniquement la sélection de l’onglet cible. OCR sur la capture fournie reconnaît les mots français ; le service Google réel traduit la phrase française. Cette dernière vérification ne valide pas le téléchargement des images Webtoon.

Limites ouvertes : cause des cinq erreurs Webtoon non reproduite ; détection de langue image basée sur les indices de page/site ; pas de validation sur le profil Chrome personnel faute de contrôle navigateur ; audit exhaustif des boutons et refonte visuelle complète encore à faire. Avancement global estimé : 50 %, pas un taux de réussite des tests.

Modèle fra : tesseract-ocr/tessdata_fast/main/fra.traineddata, licence Apache-2.0 incluse dans tesseract/LICENSE.tessdata. SHA256 du gzip distribué : 7ffcc7f3f5e213a8b0ce4f8c9c071b02fb208968e309a9e2148a2c123f73f40d.
