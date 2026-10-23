# Localisation de la fiche et délais au clic

Base : PR #75, commit b9e880b. Test Chromium local, viewport 390 × 844, même magicien de niveau 3 enregistré, trois passages (une mesure pour la première ouverture du grimoire et du créateur). Mesure entre le clic DOM et l'affichage de la destination suivi de deux frames ; aucune simulation d'iPhone ni promesse de temps identiques sur appareil réel.

| Interaction | Avant (médiane, ms) | Après (médiane, ms) |
|---|---:|---:|
| Ouvrir Mes persos | 5748 | 56 |
| Ouvrir la fiche | 3048 | 107 |
| Ouvrir le créateur | 3424 | 288 |
| Onglet Compétences | 27 | 30 |
| Niveau 1 des sorts | 28 | 29 |
| Caractéristiques du créateur | 94 | 42 |
| Retour à l'origine du créateur | 109 | 56 |
| Première ouverture des sorts | 223 | 391 |

Le gain concerne la navigation entre écrans. Les onglets étaient déjà rapides. La première ouverture des sorts reste plus coûteuse et sa mesure isolée varie : aucun gain n'est revendiqué sur cette interaction.

Le catalogue était reconstruit dans chaque render(), puis de nouveau pour chaque campagne de la bibliothèque. Le cache UI réutilise au maximum quatre contextes, vérifie la configuration complète et la révision des packs stockée dans IndexedDB. Un import depuis un autre onglet invalide les contextes. Les autres utilisateurs du repository gardent le comportement sans cache par défaut.

Le créateur réutilise la résolution des règles lors de la navigation. Les changements de choix, scores, équipement ou autres entrées invalident cette résolution ; seul step/revision/updatedAt est exclu de la clé. La sauvegarde demeure attendue avant navigation et la compilation finale est toujours exécutée.

## Traductions

La première correction des ressources ne constituait pas un audit linguistique complet. 58 des 181 déclarations de ressources du catalogue n'étaient pas identifiées par le nom seul lors du contrôle statique (les capacités exécutables pouvaient en résoudre certaines). La résolution utilise maintenant aussi la capacité possédée déclarant la réserve. Cela distingue notamment les avatars propres à chaque serment. Les réserves partagées gardent leur propre intitulé ; les usages de sorts affichent leur nom. Une ressource privée inconnue reste explicitement à identifier, au lieu d'être masquée par « Utilisations de capacité ».

Les 181 déclarations ont un libellé explicite dans le test utilisant leurs capacités propriétaires. Ce contrôle ne prétend pas vérifier chaque phrase du catalogue ni traduire les notes et noms personnalisés des joueurs.

Termes comparés aux documents fournis : Sens divin et Conduit divin (fiche Zéphyr), Rune du feu / Rune de givre / Rune des pierres, Élixir expérimental, Canon occulte et Murmures psychiques (Tasha). Le don SRD Grappler devient Lutteur, avec Empoigneur en alias ; référence 2014 : https://www.aidedd.org/dnd-filters/dons.php . Aucun texte de livre n'est ajouté.

## Validation reproductible

- `node --test tests/resource-labels.test.js tests/campaign-sources.test.js tests/creator-review.test.js`
- `npm run build:web`
- `node e2e/click-latency.mjs current` (résultats dans artifacts/ ; PILOT20_CHROMIUM peut fournir un exécutable local)
- `node e2e/unified-sources.mjs`
- `node e2e/compact-sheet.mjs`

Les 29 tests ciblés et les deux parcours navigateur ont réussi : sources activées/désactivées, données conservées, cinq onglets, filtres sur quatre largeurs, réouverture et simulation locale. Le benchmark a réussi avant et après. Les données des personnages ne sont pas migrées.
