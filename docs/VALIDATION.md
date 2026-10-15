# Validation V0.1 — correctifs pré-merge de la PR #1

Validation locale le 15 octobre 2026 sous **Node 24.19.0**. Travail uniquement sur `dev/universal-engine-v0.1`, sans déploiement ni fusion.

| Vérification exécutée | Résultat réel |
|---|---|
| `npm test` | **57 tests passent**, 0 échec, 0 ignoré : les 35 tests initiaux et 22 nouveaux |
| `node --test tests/concentration.test.js tests/boundaries.test.js` | **22 tests passent** : 16 concentration/migration et 6 frontières/stockage |
| `npm run demo` | Réussite : deux attaques, résistance, critique, annulation, concentration, dégâts et sauvegarde obligatoire, avec export/import entre les étapes |
| `npm run benchmark -- --output=docs/benchmark-500.json` | Deux scénarios de **500 transactions** chacun, 2 et 7 participants ; assertions de sauvegarde/relecture, annulation, rejeu et quota réussies |
| `git diff --check` | Réussite |
| Modèle et schéma | Schéma canonique mis à jour pour `ability.concentration`, JSON parsable ; invariants et migration testés par le validateur runtime |

## Défauts confirmés et corrections

- Ancien `useAbility` : une concentration dans la boucle des cibles ne démarrait pas sur un raté ; le passage à une cible suivante pouvait effacer la demande de sauvegarde créée par les dégâts subis par le lanceur lui-même. Reproduction faite sur le code de départ.
- Concentration déplacée dans une activation unique, avant les effets par cible, avec `start: activation` ou `start: hit` obligatoire. Les préconditions inconnues sont refusées. Le remplacement retire les anciennes demandes ; les nouvelles demandes restent valides.
- Le blocage général des capacités en présence de demandes en attente empêchait tout remplacement. Une activation explicitement inconditionnelle peut maintenant remplacer l’instance et invalider les anciennes demandes ; les autres capacités restent bloquées jusqu’à résolution.
- Les définitions anciennes V1 sont normalisées sur copie, acteurs actuels et historiques compris. Une déclaration ambiguë est refusée ; les reçus restent inchangés.
- Le validateur répétait la lecture du ledger courant pour chaque snapshot ; les snapshots vérifient désormais uniquement leurs propres données mécaniques. Aucun reçu ou snapshot n’est supprimé. Les snapshots incomplets sont refusés.
- Profils optionnels d’attaque/ressource `null` ou `false` refusés, conformément au schéma.

## Couverture nouvelle

Multicible avec auto-dégâts, permutation des cibles, raté, règle sur touche explicite, remplacement avec demandes en attente, refus de sauvegarde périmée, maintien de nouvelles demandes, annulation du démarrage/remplacement, rechargement et rejouements, entrée invalide atomique, incapacité/0 PV, migration des historiques, ambiguïtés et conditions inconnues.

Les tests de frontières vérifient l’isolation des définitions entre sessions, les préférences hors annulation mécanique, les clés distinctes de stockage, les snapshots autonomes, la conservation du primaire après un refus d’écriture et les profils optionnels invalides. Le module de stockage n’a pas nécessité de modification fonctionnelle.

Les mesures détaillées, temps et risques de quota sont dans `HISTORY-MEASUREMENTS.md`, avec données brutes dans `benchmark-500.json`. Dans le budget simulé de 5 Mio, le cas 7 participants refuse la transaction 371 sans altérer la dernière révision validée (370). Le scénario principal sans quota complète les 500 opérations.

## GitHub Actions

La matrice existante exécute `npm test` et `npm run demo` sous Node 22 et 24. Les nouveaux résultats du correctif seront vérifiés après le push ; aucun succès distant n’est déduit de la seule configuration.

## Limites et tests non exécutés

Pas de tests navigateur/iPad, de stockage localStorage réel, de connexion WebSocket, ni de nouvelle exécution des anciens dépôts : leur audit et les 15 tests ciblés de la livraison initiale restent historiques. Aucune écriture dans ces dépôts.

Le benchmark utilise des fixtures simples et des stockages mémoire ; ses temps ne mesurent ni le disque ni la latence de l’interface. Le quota 5 Mio est une simulation documentée, pas une mesure des quotas Safari. Le schéma n’a pas été exécuté par un validateur JSON Schema externe, indisponible dans l’environnement ; la validation runtime et les tests couvrent les contraintes fonctionnelles.

La bibliothèque multipersonnage, la séparation physique définition/runtime, les identifiants de participants distincts, les préférences par personnage, IndexedDB et le compactage non destructif sont documentés pour V0.2. Aucun dashboard, créateur, intégration réseau ou contenu propriétaire n’a été ajouté.
