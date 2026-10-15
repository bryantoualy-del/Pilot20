# API du moteur V0.1

```js
import {createSession} from './src/model.js';
import {execute} from './src/engine.js';
import {repository} from './src/storage.js';

const session = createSession([definition, targetDefinition]);
const {state, result} = execute(session, {
  id: 'activation-unique', type: 'useAbility', actorId: definition.id,
  abilityId: 'sword', targetIds: [targetDefinition.id],
  attackRolls: [15], effectRolls: {0: [7]}
});
// Dans l’application : sauvegarder avant de remplacer/publier l’état courant.
repository(localStorage).save(state);
```

Commandes, champs en plus de `id` et `type` :

| Type | Champs | Usage |
|---|---|---|
| `useAbility` | `actorId`, `abilityId`, `targetIds` pour cible selected, `attackRolls`, `effectRolls`, `advantage`/`disadvantage` facultatifs | Exécuter une capacité ; `effectRolls` est indexé par position de l’effet. Les mêmes dés s’appliquent aux cibles d’une activation, sauf critique d’une attaque à cible unique. |
| `startTurn` | `actorId` | Incrémenter l’identifiant du tour et restaurer A/B/R de l’acteur ; pas un ordonnanceur d’initiative. |
| `damage` | `actorId`, `amount`, `damageType` | Appliquer des dégâts après défenses calculées par le moteur, absorption puis concentration. |
| `concentrationSave` | `actorId`, `checkId`, `rolls`, `bonus`/`penalty`, avantage/désavantage facultatifs | Résoudre une demande persistante. `bonus` et `penalty` sont des ajustements chiffrés fournis par l’adaptateur de règles, pas des formules exécutées. |
| `setIncapacitated` | `actorId`, `value` booléen | Adjudication explicite, avec rupture de concentration immédiate. |
| `correct` | `actorId`, `field`, `value`, `reason` | `field`: `hp`, `tempHp`, `resource` (+ `resourceId`) ou `economy` (+ `slot`: action/bonus/reaction). |
| `rest` | `actorId`, `kind`: short/long | Récupération après repos validé par le contrôleur. |
| `undo` | `actionId` | Annuler seulement la dernière transaction ; l’annulation a son propre identifiant. |

Tous les champs de dés sont des résultats naturels entiers dans les bornes ; le moteur calcule les bonus fixes. Les attaques de l’action Attaquer ont `attackAction: true`. Les autres attaques consomment entièrement leur coût. Les PV temporaires conservent le maximum actuel/offert, sans cumul. Les effets inconnus et formules hors grammaire sont refusés.

En mode connecté, `execute` exige un troisième argument de confiance `{authority: 'encounter'}` ; les commandes d’adjudication exigent en plus `role: 'gm'`. Ne jamais alimenter ce contexte depuis un champ JSON fourni par le joueur. `connect.js` constitue une frontière expérimentale, pas un client fonctionnel. Les changements de mode sont différés ; les fixtures peuvent sélectionner le mode dans le document avant validation.

Les erreurs lèvent une exception et laissent l’entrée intacte. L’application doit les afficher, sans publier ni enregistrer un état partiel. `replayed: true` signale qu’aucune nouvelle transaction n’a eu lieu. Après annulation, rejouer la commande originelle renvoie son ancien reçu et ne réapplique pas ses effets.
