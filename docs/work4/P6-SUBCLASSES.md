# Work4 — Lame maudite, bardes et Âme acérée

Les sous-classes Lame maudite (Xanathar), Collège de la séduction (Xanathar), Collège de l’Éloquence (Tasha) et Âme acérée (Tasha) sont sélectionnables dans le parcours unique. Les capacités sont acquises au niveau indiqué, avec résumés français originaux et ressources de récupération distinctes. Les noms du PDF priment ; les appellations d’AideDD et de la campagne sont des alias.

Le Lame maudite ajoute des options à la liste d’occultiste ; elles ne sont pas connues automatiquement, contrairement aux sorts toujours préparés de l’Artificier. Les dés psioniques sont calculés à partir du bonus de maîtrise du personnage, y compris multiclassé. Les tailles de dés et déblocages restent liés aux niveaux de roublard.

Les capacités conditionnelles restent expliquées et disponibles comme définitions stables pour le futur Companion ; ce lot n’automatise pas leurs effets de combat. Les tests utilisent des personnages synthétiques et ne certifient pas les configurations exactes de Kentaro ou Rufus.

Le moteur de tests navigateur est sélectionnable par `PILOT20_E2E_BROWSER=chromium|webkit`. La CI exécute désormais les deux moteurs, avec captures, exports et vérifications hors ligne séparés. WebKit Linux n’est pas une validation Safari sur iPhone/iPad physique.

Le premier essai WebKit a atteint le test hors ligne puis rencontré le bogue d’émulation Playwright42775 (https://github.com/microsoft/playwright/issues/42775). Le test WebKit coupe désormais réellement le serveur d’origine au lieu d’utiliser `context.setOffline` : le rechargement ne peut réussir que grâce au cache de l’application. Ce contrôle n’est pas supprimé ni marqué artificiellement réussi.

Tests : `tests/extended-subclasses.test.js` vérifie acquisitions, récupération, listes étendues, bonus de maîtrise multiclassé et désactivation de source sans perte de choix. La suite navigateur utilise désormais un barde de la séduction et un occultiste Lame maudite. Les résultats CI doivent être contrôlés sur chaque révision.
