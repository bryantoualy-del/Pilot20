# Recette du jalon Créateur et Grimoire

## Version locale de test

Dans l’exécution GitHub Actions de la PR22, télécharger l’artefact `pilot20-work4-local-build` produit après les tests, puis extraire le ZIP. Depuis le dossier extrait, lancer `python3 -m http.server 4173 --bind 127.0.0.1` et ouvrir `http://127.0.0.1:4173/web/index.html` dans un navigateur récent. L’application doit être servie en HTTP local ; ouvrir directement le fichier HTML ne suffit pas.

La construction complète utilise les ressources du dépôt GitHub. Les données sont locales à l’origine du navigateur. Exporter une fiche avant de changer d’adresse ou de navigateur. Aucun compte RPG Connect n’est requis.

Les fixtures des tests automatisés ne font pas partie du build distribué : le navigateur démarre avec une bibliothèque vide. Créer un personnage ou importer un export Pilot20 existant.

## Safari sur iPhone et iPad — à exécuter après mise à disposition d’une URL HTTPS autorisée

Ces vérifications ne sont pas encore effectuées sur appareils physiques. Un serveur HTTP accessible via l’adresse réseau d’un ordinateur ne valide pas le fonctionnement hors ligne de Safari ; utiliser une origine HTTPS pour cette recette.

1. Sur iPhone portrait, iPad Air5 paysage, puis iPad portrait : créer un guerrier1. Revenir sur la race, conserver les choix et poursuivre. Vérifier les boutons Précédent/Suivant, le défilement avec clavier ouvert et la fermeture des détails.
2. Créer un clerc5 : terminer les choix requis, enregistrer, ouvrir Bibliothèque puis Grimoire. Modifier la préparation en respectant le compteur. Vérifier qu’un sort du domaine reste toujours préparé sans prendre une place dans le quota.
3. Avec un magicien10 : chercher un sort disponible qui n’est pas encore dans le livre. Confirmer sa copie après vérification de l’accès, du temps et du coût. Vérifier qu’il est inscrit sans être préparé automatiquement, puis remplacer un sort préparé par celui-ci.
4. Avec un barde10 et un occultiste11 : vérifier l’absence de préparation quotidienne générique. Vérifier les choix de Secrets magiques dans le Créateur et l’origine distincte de l’Arcanum dans le Grimoire.
5. Exporter, fermer Safari, rouvrir puis importer dans un autre profil de navigateur sans cette fiche. Comparer livre, sorts préparés et origines. L’import d’un identifiant déjà présent doit être refusé sans altérer la fiche existante.
6. Attendre « Disponible hors ligne », activer le mode avion, rouvrir l’application et le Grimoire, rechercher un sort et consulter ses informations locales. Le lien AideDD nécessite une connexion ; les informations embarquées restent accessibles. Réactiver le réseau et vérifier la conservation des choix.

Pour chaque défaut, relever appareil, version iOS/iPadOS, orientation, étape et capture. Ne pas présenter cette liste comme exécutée avant retour de recette.

## Limites du jalon

Ce build utilise encore le catalogue de règles SRD installé. Les références supplémentaires ne rendent pas à elles seules les sorts et sous-classes Xanathar/Tasha sélectionnables. Artificier, catalogue étendu, équipement de départ complet, certains choix de progression et descriptions françaises intégrales restent à intégrer ou vérifier. Les configurations réelles de la Compagnie Créole ne sont pas remplacées par les fixtures synthétiques des tests.
