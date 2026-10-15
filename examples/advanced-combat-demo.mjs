import assert from 'node:assert/strict';
import {advancedCharacter} from './advanced-characters.mjs';
import {createCombat,executeCombat,validateCombat} from '../src/character/session.js';
const participants=['fighter','sorcerer','warlock'].map(name=>({instanceId:name,character:advancedCharacter(name,{level:11})}));
for(let i=0;i<5;i++) {const d=advancedCharacter('fighter',{level:11});if(i===1)d.defenses.resistances=['fire'];if(i===2)d.defenses.immunities=['fire'];if(i===3)d.defenses.vulnerabilities=['fire'];participants.push({instanceId:'t'+i,character:d});}
let s=createCombat('demo-advanced',participants),seq=0;
const sheets=structuredClone(Object.fromEntries(Object.entries(s.engine.actors).map(([k,a])=>[k,a.definition])));
function act(type,params) {const out=executeCombat(s,{id:'demo'+(++seq),type,...params});s=out.state;return out.result;}
const turn=actorId=>act('startTurn',{actorId});
const cast=(actorId,abilityId,params={})=>act('useAbility',{actorId,abilityId,...params});
const hit=(target,budget)=>cast('fighter','blade',{targetIds:[target],attackRolls:[19],effectRolls:{0:[4]},...(budget?{budget}:{})});
const hp=()=>Array.from({length:5},(_,i)=>s.engine.actors['t'+i].hp.current);
const pact=()=>cast('warlock','fireball',{targetIds:['t1','t2','t3','t4'],slotId:'pact:warlock',effectRolls:{0:Array(10).fill(2)},saveRolls:{t1:[1],t2:[1],t3:[1],t4:[1]}});
console.log('Pilot20 — selected-target combat demonstration, D&D 2014');
console.log('Eligibility, areas, components and narrative consequences are adjudicated externally.');
console.log('Round 1');
turn('sorcerer');cast('sorcerer','haste',{targetIds:['fighter'],slotId:'slot3'});
turn('fighter');for(let i=0;i<3;i++)hit('t0');cast('fighter','action-surge');for(let i=0;i<3;i++)hit('t0','extra');hit('t0',s.engine.actors.fighter.advanced.effects[0].id);
turn('warlock');const one=pact();assert.deepEqual(one.results.map(r=>r.damage),[10,0,40,20]);assert.deepEqual(hp(),[47,93,103,63,83]);
console.log('Fighter: 3 ordinary + 3 additional + 1 restricted weapon attack. Pact blast: 10 / 0 / 40 / 20. HP:',hp());
// Reload between rounds, without recomputing a single damage instance.
s=validateCombat(JSON.parse(JSON.stringify(s)));
console.log('Round 2 — resumed from JSON');
turn('sorcerer');const two=cast('sorcerer','fireball',{targetIds:['t0','t1','t2','t3','t4'],slotId:'slot3',effectRolls:{0:Array(8).fill(3)},saveRolls:{t0:[1],t1:[20],t2:[1],t3:[20],t4:[20]}});
assert.deepEqual(two.results.map(r=>r.damage),[24,6,0,24,12]);
turn('fighter');for(let i=0;i<3;i++)hit('t0');hit('t1',s.engine.actors.fighter.advanced.effects[0].id);
turn('warlock');cast('warlock','cantrip',{targetIds:['t1'],attackRolls:[19]});assert.deepEqual(hp(),[0,75,103,39,71]);
console.log('Five-target save spell: 24 / 6 / 0 / 24 / 12. HP:',hp());
console.log('Round 3');
turn('sorcerer');act('damage',{actorId:'sorcerer',amount:1,damageType:'fire'});const damageId=s.engine.actors.sorcerer.checks[0].id;
const check=act('concentrationSave',{actorId:'sorcerer',checkId:damageId,rolls:[1]});assert.equal(check.success,false);assert.equal(s.engine.actors.fighter.advanced.effects.length,0);
cast('sorcerer','cantrip',{targetIds:['t3'],attackRolls:[19]});turn('fighter');
assert.throws(()=>executeCombat(s,{id:'blocked-attack',type:'useAbility',actorId:'fighter',abilityId:'blade',targetIds:['t1'],attackRolls:[19],effectRolls:{0:[4]}}),/cannot act/);
act('endTurn',{actorId:'fighter'});turn('warlock');pact();assert.deepEqual(hp(),[0,65,103,0,51]);
console.log('Concentration failed; Haste effects removed; Fighter cannot act until own turn ends. HP:',hp());
assert.deepEqual(Object.fromEntries(Object.entries(s.engine.actors).map(([k,a])=>[k,a.definition])),sheets);
console.log('Verified: exact final HP, slot expenditure, independent budgets, concentration cleanup, reload and unchanged permanent sheets.');
