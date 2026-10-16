import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runReactiveDemo} from '../examples/reactive-combat-demo.mjs';
import {reactiveCharacter} from '../examples/reactive-characters.mjs';
import {createCombat,executeCombat} from '../src/character/session.js';
import {pendingDecisions} from '../src/rules/reactive.js';
import {coverageReport} from '../scripts/coverage-report.mjs';
const run=(s,c)=>executeCombat(s,c).state;
test('five-round seven-class encounter is reproducible and covers the six historical mechanic families plus bard',async()=>{
 const out=runReactiveDemo();assert.equal(out.transcript,await readFile(new URL('../docs/V0.2b.3-DEMO.txt',import.meta.url),'utf8'));assert.equal(out.proof.rounds,5);assert.equal(out.proof.classes.length,7);assert.ok(out.proof.saved && out.proof.declined && out.proof.defended && out.proof.postHit);
 const fighterDamage=out.state.engine.history.filter(h=>h.command.type==='useAbility' && h.command.actorId==='fighter' && h.command.abilityId==='blade');assert.equal(fighterDamage.length,17); // 5*(2 normal+1 Haste)+2 surge
 assert.ok(out.state.engine.actors.barbarian.advanced.stance);assert.equal(out.state.engine.actors.sorcerer.resources['sorcery-points'],5);assert.equal(out.state.engine.actors.paladin.resources.slot1,0);assert.equal(out.state.engine.actors.warlock.resources['pact:warlock'],1);
 const report=coverageReport();assert.equal(report.fullOfficialSpellsAutomated,0);
});
test('character definitions pin reaction rules and casting modifiers through derive and actual IndexedDB reload',async()=>{
 const {indexedDB}=await import('fake-indexeddb'),{openIndexedDB}=await import('../src/persistence/adapters.js'),{combatRepository}=await import('../src/persistence/combat-repository.js');
 const rogue=reactiveCharacter('rogue'),fighter=reactiveCharacter('fighter');const repo=combatRepository(await openIndexedDB('reactive-character-e2e',{indexedDB}));
 let s=createCombat('reactive-characters',[{instanceId:'rogue',character:rogue},{instanceId:'fighter',character:fighter}]);await repo.create(s);
 const c={id:'sneak',type:'useAbility',actorId:'rogue',abilityId:'blade',targetIds:['fighter'],attackRolls:[16,15],advantage:true,effectRolls:{0:[4]}};await repo.commit(s.id,c);s=await repo.load(s.id);const d=pendingDecisions(s.engine)[0];assert.equal(d.ruleId,'sneak-attack');
 const response={id:'spend',type:'respondDecision',actorId:'rogue',decisionId:d.id,decisionRevision:d.revision,expectedRevision:s.engine.revision,choice:'accept',optionId:'sneak',rolls:{0:Array(5).fill(2)}};
 await repo.commit(s.id,response);const done=await repo.load(s.id);assert.equal(done.engine.actors.fighter.hp.current,s.engine.actors.fighter.hp.current-18);assert.equal((await repo.commit(s.id,response)).replayed,true);
});
test('authoritative final manual damage is not defended twice and connected responses need Encounter authority',()=>{
 const mage=reactiveCharacter('sorcerer'),fighter=reactiveCharacter('fighter');let s=createCombat('authority',[{instanceId:'mage',character:mage},{instanceId:'fighter',character:fighter}],{authority:'encounter'});
 const cast={id:'manual',type:'declareManual',actorId:'mage',abilityId:'manual-illusion',slotId:'slot1',targetIds:['fighter'],reason:'Encounter final result'};
 s=executeCombat(s,cast,{authority:'encounter',role:'gm'}).state;s.engine.actors.fighter.definition.resistances=['fire'];const hp=s.engine.actors.fighter.hp.current;
 const out=executeCombat(s,{id:'final',type:'resolveManual',actorId:'mage',declarationId:'manual',reason:'Already resolved by Encounter',outcomes:[{actorId:'fighter',kind:'damage',amount:9,reason:'Final post-defenses damage'}]},{authority:'encounter',role:'gm'});assert.equal(out.state.engine.actors.fighter.hp.current,hp-9);
 const local=createCombat('rx-authority',[{instanceId:'mage',character:mage},{instanceId:'fighter',character:fighter}]);s=run(local,{id:'ft',type:'startTurn',actorId:'fighter'});s=run(s,{id:'hit',type:'useAbility',actorId:'fighter',abilityId:'blade',targetIds:['mage'],attackRolls:[7],effectRolls:{0:[4]},facts:{mage:{canCastShield:true,reactionSpellUnopposed:true}}});s.engine.mode='encounter';const d=pendingDecisions(s.engine)[0];assert.ok(d);assert.throws(()=>executeCombat(s,{id:'no-authority',type:'respondDecision',actorId:'mage',decisionId:d.id,decisionRevision:d.revision,expectedRevision:s.engine.revision,choice:'decline'}),/Encounter authority/);
});
test('unsupported opportunity detection and non-SRD subclass automation fail closed',()=>{
 const s=createCombat('manual-opportunity',[{instanceId:'rogue',character:reactiveCharacter('rogue')},{instanceId:'fighter',character:reactiveCharacter('fighter')}]);
 assert.throws(()=>run(s,{id:'unverified-opportunity',type:'useAbility',actorId:'fighter',abilityId:'opportunity',targetIds:['rogue'],attackRolls:[20],effectRolls:{0:[2,2]}}),/prerequisites/);
 for(const id of ['glamour','eloquence','agathys-retaliation','wild-shape','summon','zone'])assert.throws(()=>run(s,{id:'no-'+id,type:'useAbility',actorId:'rogue',abilityId:id}),/Unknown ability/);
});
