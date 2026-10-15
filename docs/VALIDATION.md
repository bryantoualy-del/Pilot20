# Validation du livrable V0.1

Exécutée le 15 octobre 2026, Node.js **24.19.0**.

| Vérification | Résultat |
|---|---|
| `npm test` / `node --test` | **35 tests passent**, 0 échec, 0 ignoré |
| `npm run demo` | Réussite : deux attaques, résistance, critique, annulation, concentration et sauvegarde après dégâts, sérialisation entre les étapes |
| Trois fichiers de tests des références Encounter | **15 tests passent** ; détails et portée dans `AUDIT.md` |
| Statut Git des huit références | Vide, aucun changement suivi ou non suivi |
| Format JSON | Modèle, fixtures et schéma parsables ; import/export et invariants testés par le validateur runtime |
| `git diff --check` | Réussite |

Les 35 tests vérifient notamment l’atomicité des refus, les budgets action/bonus/réaction, l’attaque supplémentaire et les sorts d’attaque, les critiques, R/I/V, les PV temporaires, les sauvegardes de concentration séparées, les rechargements, reçus, collisions et annulations, les corrections justifiées, les versions inconnues, les imports malformés, la récupération et les erreurs de quota. Une capacité multi-cible teste la dépense unique et la restauration de toutes les cibles.

La CI est configurée pour Node 22 et 24 ; sa configuration n’est pas une preuve d’exécution distante. Les résultats GitHub sont à consulter dans la PR. Node 22 n’a pas été exécuté localement.

Une tentative supplémentaire sur `rpg-participant-profiles.test.js` est bloquée par l’absence de `jsdom` ; aucune modification des références ni installation dans ces dépôts n’a été effectuée. Le schéma JSON n’a pas été vérifié par un validateur JSON Schema externe, indisponible dans l’environnement ; les invariants exécutables du modèle restent couverts par `src/model.js` et les tests.

Pas de tests navigateur/iPad, pas de test de connexion réelle RPG Connect, pas de compilation ni déploiement. La démo est textuelle. Ces limites sont volontaires et n’équivalent pas à une validation produit complète.
