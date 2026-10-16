import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,serialize,deserialize} from '../src/model.js';
import {execute} from '../src/engine.js';
import {advanced,saveModes} from '../src/rules/combat.js';
import {pendingDecisions} from '../src/rules/reactive.js';
import {bardicTransfer,rageStance,quickenedSpell,heightenedSpell} from '../src/rules/conditional.js';
import {definition,run,attack,answer} from './helpers/reactive.js';
const profile=(extra={})=>({version:1,mode:'automatic',requirements:[],...extra});
const inspiration=(level=10)=>({name:'Bardic Inspiration',cost:'bonus',target:'selected',maxTargets:1,resource:{id:'inspiration',amount:1},effects:[],combat:profile({transfer:bardicTransfer(level)})});
const resources={inspiration:{max:3,recovery:'short'},rage:{max:3,recovery:'long'},sorcery:{max:10,recovery:'long'},slot3:{max:4,recovery:'long',slotLevel:3,pool:'standard'}};
const spell=(extra={})=>({name:'Spell',cost:'action',target:'selected',maxTargets:3,effects:[{kind:'damage',amount:12,damageType:'fire'}],save:{ability:'dex',dc:14,onSuccess:'half'},combat:profile({spell:{id:'spell',classId:'mage',level:3,access:'known',available:true}}),...extra});
const setup=()=>{const defs=[definition('a',{resources,abilities:{...definition('a').abilities,inspire:inspiration(),rage:{name:'Rage',cost:'bonus',target:'self',maxTargets:1,resource:{id:'rage',amount:1},effects:[],combat:profile({stance:rageStance(10)})},spell:spell(),cantrip:{...spell(),attack:{bonus:5},effects:[],combat:profile({spell:{id:'cantrip',classId:'mage',level:0,access:'known',available:true}})}},castingModifiers:[quickenedSpell(),heightenedSpell()]}),definition('b'),definition('c')];delete defs[0].abilities.cantrip.save;return createSession(defs);};
const give=(extra={})=>({id:'inspire',type:'useAbility',actorId:'a',abilityId:'inspire',targetIds:['b'],facts:{b:{within60ft:true,canHear:true}},...extra});
const targetTurn=s=>run(s,{id:'b-turn',type:'startTurn',actorId:'b'});
const strike=(extra={})=>attack('b-hit',{actorId:'b',targetIds:['c'],attackRolls:[7],...extra});
const raging=()=>run(setup(),{id:'rage',type:'useAbility',actorId:'a',abilityId:'rage',facts:{a:{notHeavyArmor:true}}});
const cast=(extra={})=>({id:'cast',type:'useAbility',actorId:'a',abilityId:'spell',slotId:'slot3',targetIds:['b','c'],saveRolls:{b:[12],c:[12]},...extra});
test('Bard transfers one die, recipient spends after roll before result, reload and undo restore it',()=>{
 let s=run(setup(),give());assert.equal(s.actors.a.resources.inspiration,2);assert.equal(s.actors.b.advanced.tokens[0].sides,10);
 s=targetTurn(s);s=run(s,strike());assert.equal(s.actors.c.hp.current,100);assert.equal(pendingDecisions(s)[0].actorId,'b');s=deserialize(serialize(s));const cmd=answer(s,'accept',{rolls:{0:[5]}});const out=execute(s,cmd);s=out.state;
 assert.equal(out.result.hit,true);assert.equal(s.actors.c.hp.current,79);assert.equal(s.actors.b.advanced.tokens[0].status,'spent');assert.equal(s.actors.a.resources.inspiration,2);
 s=run(s,{id:'undo',type:'undo',actionId:cmd.id});assert.equal(s.actors.c.hp.current,100);assert.equal(s.actors.b.advanced.tokens[0].status,'available');assert.equal(pendingDecisions(s).length,1);
});
test('Bard die also modifies a saving throw on one target of a multi-target spell',()=>{
 let s=run(setup(),give());s=run(s,cast());assert.equal(pendingDecisions(s)[0].actorId,'b');const out=execute(s,answer(s,'accept',{rolls:{0:[3]}}));assert.deepEqual(out.result.results.map(r=>r.save.success),[true,true]);assert.deepEqual(out.result.results.map(r=>r.damage),[6,6]);
});
test('transferred die modifies a declared ability check; refusal retains it',()=>{
 let s=run(setup(),give());s.actors.b.definition.abilities.check={name:'Check',cost:'none',target:'self',maxTargets:1,effects:[],combat:profile({roll:{kind:'check',ability:'str',bonus:2,dc:15}})};
 s=targetTurn(s);const c={id:'check',type:'useAbility',actorId:'b',abilityId:'check',attackRolls:[10]};s=run(s,c);s=run(s,answer(s,'decline'));assert.equal(s.actors.b.advanced.tokens[0].status,'available');s=run(s,{...c,id:'check2'});const out=execute(s,answer(s,'accept',{rolls:{0:[4]}}));assert.equal(out.result.total,16);assert.equal(out.result.success,true);
});
test('transfer rejects self, duplicate dice and unvalidated hearing/range; clocks expire after 100 source turns',()=>{
 for(const extra of [{targetIds:['a'],facts:{a:{within60ft:true,canHear:true}}},{facts:{}},{facts:{b:{within60ft:true,canHear:false}}}])assert.throws(()=>run(setup(),give(extra)),/self|eligibility/);
 let s=run(setup(),give());s=run(s,{id:'a-reset',type:'startTurn',actorId:'a'});assert.throws(()=>run(s,give({id:'twice'})),/already has/);
 for(let i=0;i<99;i++)s=run(s,{id:'clock'+i,type:'startTurn',actorId:'a'});assert.equal(s.actors.b.advanced.tokens[0].status,'expired');assert.deepEqual([1,5,10,15].map(l=>bardicTransfer(l).sides),[6,8,10,12]);
});
test('Rage bonus only Strength melee weapons, physical resistance and strength advantage; no spells/concentration',()=>{
 let s=raging();assert.equal(s.actors.a.resources.rage,2);assert.equal(saveModes(s.actors.a,'str').advantage,true);
 s.actors.a.definition.abilities.blade.combat=profile({weapon:true,actionKind:'weaponAttack',traits:{melee:true,strength:true}});
 let out=execute(s,attack('strength',{facts:{a:{hostileTarget:true}}}));s=out.state;assert.equal(out.result.results[0].damage,24);
 s.actors.a.definition.abilities.blade.combat.traits.strength=false;out=execute(s,attack('dex',{facts:{a:{hostileTarget:true}}}));s=out.state;assert.equal(out.result.results[0].damage,21);
 s=run(s,{id:'hurt',type:'damage',actorId:'a',amount:21,damageType:'slashing'});assert.equal(s.actors.a.hp.current,90);
 assert.throws(()=>run(s,cast()),/Spellcasting restricted/);assert.throws(()=>run(s,{...cast(),abilityId:'cantrip',slotId:undefined,targetIds:['b'],attackRolls:[15]}),/Spellcasting restricted/);
});
test('Rage ends early without qualifying activity; takes hostile attacks/damage since previous turn into account; undo',()=>{
 let s=raging();s=run(s,{id:'end',type:'endTurn',actorId:'a'});assert.equal(s.actors.a.advanced.stance,null);s=run(s,{id:'undo',type:'undo',actionId:'end'});assert.ok(s.actors.a.advanced.stance);
 s=run(s,attack('hostile',{attackRolls:[1],facts:{a:{hostileTarget:true}}}));s=run(s,{id:'end-active',type:'endTurn',actorId:'a'});assert.ok(s.actors.a.advanced.stance);
 s=run(s,{id:'incoming',type:'damage',actorId:'a',amount:4,damageType:'fire'});s=run(s,{id:'next',type:'startTurn',actorId:'a'});s=run(s,{id:'end2',type:'endTurn',actorId:'a'});assert.ok(s.actors.a.advanced.stance);
 s=run(s,{id:'next2',type:'startTurn',actorId:'a'});s=run(s,{id:'end3',type:'endTurn',actorId:'a'});assert.equal(s.actors.a.advanced.stance,null);
});
test('Rage loses existing concentration, ends unconscious/voluntarily, level 15 ignores inactivity but max duration remains',()=>{
 let initial=setup();initial.actors.a.concentration={effectId:'old',instanceId:'old'};let s=run(initial,{id:'rage',type:'useAbility',actorId:'a',abilityId:'rage',facts:{a:{notHeavyArmor:true}}});assert.equal(s.actors.a.concentration,null);
 s=run(s,{id:'down',type:'setUnconscious',actorId:'a',value:true});assert.equal(s.actors.a.advanced.stance,null);
 s=raging();s=run(s,{id:'sustain',type:'damage',actorId:'a',amount:1,damageType:'fire'});s=run(s,{id:'next',type:'startTurn',actorId:'a'});s=run(s,{id:'stop',type:'endStance',actorId:'a'});assert.equal(s.actors.a.advanced.stance,null);assert.equal(s.actors.a.economy.bonus,false);
 initial=setup();initial.actors.a.definition.abilities.rage.combat.stance=rageStance(15);s=run(initial,{id:'rage',type:'useAbility',actorId:'a',abilityId:'rage',facts:{a:{notHeavyArmor:true}}});
 for(let i=0;i<9;i++)s=run(s,{id:'clock'+i,type:'startTurn',actorId:'a'});assert.ok(s.actors.a.advanced.stance);s=run(s,{id:'clock-last',type:'startTurn',actorId:'a'});assert.equal(s.actors.a.advanced.stance,null);
});
test('Quickened pays 2, uses bonus action, forbids another leveled spell in either order, permits action cantrip',()=>{
 let s=run(setup(),cast({castingModifiers:['quickened']}));assert.equal(s.actors.a.resources.sorcery,8);assert.equal(s.actors.a.economy.bonus,false);assert.equal(s.actors.a.economy.action,true);
 assert.throws(()=>run(s,cast({id:'second'})),/Bonus-action/);s=run(s,{id:'cantrip',type:'useAbility',actorId:'a',abilityId:'cantrip',targetIds:['b'],attackRolls:[15]});assert.equal(s.actors.a.economy.action,false);
 s=run(setup(),cast());assert.throws(()=>run(s,cast({id:'quickened',castingModifiers:['quickened']})),/Bonus-action/);
 assert.throws(()=>run(setup(),cast({castingModifiers:['quickened','heightened'],modifierTargets:{heightened:'b'}})),/Exclusive/);
 const poor=setup();poor.actors.a.resources.sorcery=1;assert.throws(()=>run(poor,cast({castingModifiers:['quickened']})),/depleted/);assert.equal(poor.actors.a.resources.slot3,4);
});
test('Heightened pays 3 before saves; only selected target has disadvantage; advantage cancels normally',()=>{
 const c=cast({castingModifiers:['heightened'],modifierTargets:{heightened:'b'},saveRolls:{b:[20,1],c:[12]}}),out=execute(setup(),c);assert.deepEqual(out.result.results.map(r=>r.save.success),[false,true]);assert.equal(out.state.actors.a.resources.sorcery,7);
 assert.throws(()=>run(setup(),{...c,modifierTargets:{heightened:'absent'}}),/declared target/);assert.throws(()=>run(setup(),{...c,saveRolls:{b:[1],c:[12]}}),/dice/);
});
test('inactivity and conscious incapacity differ from unconsciousness; Heightened cancels advantage on the first save',()=>{
 let s=raging();s=run(s,{id:'stunned',type:'setIncapacitated',actorId:'a',value:true});assert.ok(s.actors.a.advanced.stance);s=run(s,{id:'unconscious',type:'setUnconscious',actorId:'a',value:true});assert.equal(s.actors.a.advanced.stance,null);
 s=setup();advanced(s.actors.b).effects.push({id:'dex-advantage',sourceActorId:'b',concentrationInstanceId:null,anchorActorId:'b',remaining:1,rule:{id:'dex-advantage',stack:{key:'dex-advantage',policy:'replace',priority:0},duration:{unit:'turn',value:1,anchor:'target',boundary:'start'},modifiers:[{stat:'save.dex',operation:'advantage',value:1}],conditions:[],concentration:false}});
 const out=execute(s,cast({castingModifiers:['heightened'],modifierTargets:{heightened:'b'},saveRolls:{b:[12],c:[12]}}));assert.equal(out.result.results[0].save.success,true);
});
test('all extended character/schema producers include conditional profiles, pending windows and runtime tokens',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:Ajv}=await import('ajv/dist/2020.js'),{reactiveCharacter}=await import('../examples/reactive-characters.mjs'),{createCombat}=await import('../src/character/session.js');
 const ajv=new Ajv({strict:false});for(const name of ['../schemas/combat-rules-v1.schema.json','../docs/session-v1.schema.json'])ajv.addSchema(JSON.parse(await readFile(new URL(name,import.meta.url))));const valid=ajv.compile(JSON.parse(await readFile(new URL('../schemas/contracts-v2.schema.json',import.meta.url))));
 for(const name of ['fighter','rogue','paladin','barbarian','sorcerer','warlock','bard']) {const d=reactiveCharacter(name),s=createCombat('schema-'+name,[{instanceId:'actor',character:d}]);assert.equal(valid(d),true,JSON.stringify(valid.errors));assert.equal(valid(s),true,JSON.stringify(valid.errors));}
 const s=run(setup(),give());const structural=ajv.getSchema('https://pilot20.invalid/schemas/session-v1.schema.json');assert.equal(structural(s),true,JSON.stringify(structural.errors));const bad=structuredClone(s);bad.actors.b.advanced.tokens[0].sides=7;assert.equal(structural(bad),false);
});
