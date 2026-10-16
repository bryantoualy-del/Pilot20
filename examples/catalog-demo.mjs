import assert from 'node:assert/strict';
import {loadSRD} from '../src/catalog/srd51-catalog.js';
import {buildCharacter} from '../src/catalog/character-builder.js';
import {characterLibrary} from '../src/persistence/library.js';
import {MemoryStorage} from '../src/persistence/adapters.js';
import {createCombat,executeCombat} from '../src/character/session.js';
import {combatRepository} from '../src/persistence/combat-repository.js';
import {pendingDecisions} from '../src/rules/reactive.js';
const spell=(...ids)=>ids.map(id=>'srd51:'+id);
export const bardRequest={id:'lore-bard-10',name:'Reference Bard',classes:[{id:'bard',level:10,subclassId:'srd51:college-of-lore'}],scores:{str:10,dex:14,con:14,int:12,wis:12,cha:16},selections:{
 'bard:skills':['arcana','perception','persuasion'],'bard:lore-skills':['investigation','history','insight'],
 'bard:asi-4':['asi:cha:cha'],'bard:asi-8':['asi:cha:cha'],'bard:expertise-3':['persuasion','perception'],'bard:expertise-10':['investigation','history'],
 'bard:instruments':['flute','lute','drum'],'bard:cantrips':spell('mage-hand','minor-illusion','light','vicious-mockery'),
 'bard:known-spells':spell('healing-word','cure-wounds','heroism','thunderwave','detect-magic','faerie-fire','invisibility','shatter','dispel-magic','hypnotic-pattern','dimension-door','greater-invisibility'),
 'bard:magical-secrets-6':spell('fireball','haste'),'bard:magical-secrets-10':spell('counterspell','wall-of-force')
}};
export const fighterRequest={id:'reference-fighter',name:'Reference Fighter',classes:[{id:'fighter',level:10,subclassId:'srd51:champion'}],scores:{str:16,dex:12,con:16,int:10,wis:12,cha:10},selections:{'fighter:skills':['athletics','perception'],'fighter:fighting-style':['srd51:fighter:defense'],'fighter:additional-style':['srd51:fighter:archery'],'fighter:asi-4':['asi:str:str'],'fighter:asi-6':['asi:str:str'],'fighter:asi-8':['asi:con:con']}};
export async function catalogDemo() {
 const index=loadSRD(),build=req=>{const r=buildCharacter(index,req);assert.equal(r.valid,true,JSON.stringify(r.issues));return r.character;};
 const bard=build(bardRequest),fighter=build(fighterRequest),store=new MemoryStorage(),library=characterLibrary(store);
 await library.save(bard);await library.save(fighter);const reloaded=(await characterLibrary(store).get(bard.id)).definition;assert.deepEqual(reloaded,bard);
 let s=createCombat('catalog-demo',[{instanceId:'bard',character:reloaded},{instanceId:'fighter',character:fighter}]);const run=c=>{s=executeCombat(s,c).state;};
 run({id:'bard-turn',type:'startTurn',actorId:'bard'});
 run({id:'inspire',type:'useAbility',actorId:'bard',abilityId:'srd51:bard:bardic-inspiration',targetIds:['fighter'],facts:{bard:{inspirationTargetEligible:true},fighter:{within60ft:true,canHear:true}}});
 run({id:'fireball',type:'useAbility',actorId:'bard',abilityId:'bard:srd51:fireball',targetIds:['fighter'],slotId:'slot3',saveRolls:{fighter:[1]},effectRolls:{0:Array(8).fill(2)},facts:{bard:{spellEligibilityValidated:true}}});
 const decision=pendingDecisions(s.engine)[0];assert.ok(decision);
 // Save/reload an unresolved reactive decision through the existing repository.
 const repo=combatRepository(store);await repo.importJSON(JSON.stringify(s));s=await combatRepository(store).load(s.id);
 const current=pendingDecisions(s.engine)[0];assert.equal(current.id,decision.id);
 run({id:'use-inspiration',type:'respondDecision',actorId:current.actorId,decisionId:current.id,decisionRevision:current.revision,expectedRevision:s.engine.revision,choice:'accept',optionId:current.options[0].id,rolls:{0:[4]}});
 assert.equal(s.engine.actors.fighter.hp.current,s.engine.actors.fighter.hp.max-16);
 run({id:'next-bard-turn',type:'startTurn',actorId:'bard'});
 run({id:'heal',type:'useAbility',actorId:'bard',abilityId:'bard:srd51:healing-word',targetIds:['fighter'],slotId:'slot1',effectRolls:{0:[4]},facts:{bard:{spellEligibilityValidated:true}}});
 assert.equal(s.engine.actors.fighter.hp.current,s.engine.actors.fighter.hp.max-7);
 assert.equal(s.engine.actors.bard.resources['bard:inspiration'],4);
 run({id:'rest',type:'rest',actorId:'bard',kind:'short'});assert.equal(s.engine.actors.bard.resources['bard:inspiration'],5);
 const final=JSON.parse(JSON.stringify(s));assert.deepEqual(final,s);
 return {catalogEntries:index.size,bardLevel:10,subclass:'College of Lore',reactiveDecisionReloaded:true,damage:16,healing:9,inspirationRecovered:true,finalFighterHp:s.engine.actors.fighter.hp.current};
}
if(process.argv[1]===new URL(import.meta.url).pathname)console.log(JSON.stringify(await catalogDemo(),null,2));
