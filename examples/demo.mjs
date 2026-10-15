import {readFileSync} from 'node:fs';
import {createSession,serialize,deserialize} from '../src/model.js';
import {execute} from '../src/engine.js';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
let state=createSession([read('guardian.json'),read('target.json')]);
for (const command of [
  {id:'attack-1',type:'useAbility',actorId:'demo-guardian',abilityId:'sword',targetIds:['demo-target'],attackRolls:[15],effectRolls:{0:[7]}},
  {id:'attack-2',type:'useAbility',actorId:'demo-guardian',abilityId:'sword',targetIds:['demo-target'],attackRolls:[20],effectRolls:{0:[8,4]}},
  {id:'undo-2',type:'undo',actionId:'attack-2'},
  {id:'turn-2',type:'startTurn',actorId:'demo-guardian'},
  {id:'focus-1',type:'useAbility',actorId:'demo-guardian',abilityId:'focus'},
  {id:'hit-1',type:'damage',actorId:'demo-guardian',amount:22,damageType:'fire'},
  {id:'save-1',type:'concentrationSave',actorId:'demo-guardian',checkId:'hit-1',rolls:[8]}
]) {
  const outcome=execute(state,command); state=deserialize(serialize(outcome.state));
  console.log(command.id,JSON.stringify(outcome.result));
}
console.log('Demo complete:',state.actors['demo-guardian'].hp,'concentration:',state.actors['demo-guardian'].concentration);
