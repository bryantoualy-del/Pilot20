# Icône Ensorceleur — recadrage normalisé

Audit du 19/10/2026 :

- Source : `bryantoualy-del/RPG-Connect/assets/icon-data/icon-data-01.json`, entrée `classes/sorcerer` (data URI WebP, 64 × 64).
- Copie d'origine : `web/assets/shared/classes/sorcerer.webp` (SHA-256 `2d2ad40200d33194894824af15c49bb4c9da28082cacb2b5ce7ca2b20a639570`).
- Alpha non transparent dans la source : rectangle (17, 11) — (64, 49). Le dessin touche donc le bord droit et n'est pas centré.
- Correctif : ignorer les pixels fantômes presque transparents à gauche (seuil alpha 18), retenir le symbole réellement peint autour de x=31..64 / y=10..49, le replacer au centre d'un canevas transparent de 64 × 64 (dessin 48 × 51), puis réencoder en WebP. La source RPG Connect n'est pas modifiée.
- L'asset Pilot20 est désormais autoportant, et `class-icons.js` n'applique plus de coordonnées spécifiques à la classe `sorcerer`. CSS, barre de navigation et autres icônes inchangés.
- Contrôle navigateur ajouté dans `e2e/validated-journey.mjs` : 40 × 40 à l'écran, alpha centré et marges transparentes tout autour.

**Limite :** le bord droit était déjà tronqué dans le fichier source. Ce correctif stabilise la position et la taille, sans prétendre recréer les pixels absents. Aucun changement aux règles ou aux personnages.

Test de régression initial : un premier recadrage fondé sur la moindre opacité restait décentré à l'œil (x médian = 40). Le nouveau recadrage s'appuie sur l'alpha >= 18 : centre mesuré ≈ (32, 30,5) et marge visible des quatre côtés.
