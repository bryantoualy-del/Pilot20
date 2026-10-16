import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession} from '../src/model.js';
import {execute} from '../src/engine.js';
import {pendingDecisions} from '../src/rules/reactive.js';
import {shield,uncannyDodge,counterspell,sneakAttack,smiteRules} from '../src/rules/srd-reactions.js';
import {definition,rule,run,attack,answer} from './helpers/reactive.js';
const resources={slot1:{max:3,recovery:'long',slotLevel:1,pool:'standard'},slot3:{max:2,recovery:'long',slotLevel:3,pool:'standard'},pact:{max:2,recovery:'short',slotLevel:5,pool:'pact'}};
const profile=(extra={})=>({version:1,mode:'automatic',requirements:[],...extra});
const blade=()=>({...definition('a').abilities.blade,combat:profile({weapon:true,actionKind:'weaponAttack',traits:{melee:true,finesse:true,strength:true}})});
const setup=(ar=[],br=[])=>createSession([definition('a',{resources,abilities:{blade:blade()},rules:ar}),definition('b',{resources,rules:br})]);
const hit=(extra={})=>attack('hit',extra);
test('Shield turns hit into miss, preserves concentration, expires at caster start',()=>{
 let s=setup([],[shield(resources)]);s.actors.b.concentration={effectId:'old',instanceId:'old'};
 s=run(s,hit({facts:{b:{canCastShield:true,reactionSpellUnopposed:true}},attackRolls:[10]}));assert.equal(s.actors.b.hp.current,100);
 const out=execute(s,answer(s,'accept',{optionId:'slot1'}));s=out.state;assert.equal(out.result.hit,false);assert.equal(s.actors.b.hp.current,100);assert.equal(s.actors.b.resources.slot1,2);assert.equal(s.actors.b.concentration.instanceId,'old');assert.equal(s.actors.b.advanced.effects.length,1);
 s=run(s,{id:'next',type:'startTurn',actorId:'b'});assert.equal(s.actors.b.advanced.effects.length,0);
});
test('Uncanny Dodge before typed defenses and temporary HP; concentration uses actual damage',()=>{
 let s=setup([],[uncannyDodge(5)]);s.actors.b.definition.resistances=['slashing'];s.actors.b.definition.vulnerabilities=['slashing'];s.actors.b.hp.temp=3;s.actors.b.concentration={effectId:'focus',instanceId:'focus'};
 s=run(s,hit({facts:{b:{attackerVisible:true}}}));const c=answer(s),out=execute(s,c);s=out.state;
 assert.equal(out.result.results[0].damage,10);assert.equal(s.actors.b.hp.temp,0);assert.equal(s.actors.b.hp.current,93);assert.equal(s.actors.b.checks[0].dc,10);
 s=run(s,{id:'undo',type:'undo',actionId:c.id});assert.equal(s.actors.b.hp.temp,3);assert.equal(s.actors.b.hp.current,100);assert.equal(s.actors.b.economy.reaction,true);
 s=run(s,answer(s,'decline'));assert.equal(s.actors.b.hp.current,83);
});
const spell=()=>({name:'Test spell',cost:'action',target:'selected',maxTargets:1,effects:[{kind:'damage',amount:12,damageType:'fire'}],combat:profile({spell:{id:'spell',classId:'caster',level:3,access:'known',available:true}})});
const cast=(id='cast')=>({id,type:'useAbility',actorId:'a',abilityId:'spell',slotId:'slot3',targetIds:['b'],facts:{b:{hostileSpell:true,casterVisibleWithin60ft:true,canCastCounterspell:true,reactionSpellUnopposed:true}}});
test('Counterspell success cancels original spell with both costs, failure resumes it',()=>{
 for(const roll of [1,20]) {let s=setup([],[counterspell(resources,2)]);s.actors.a.definition.abilities.spell=spell();s.actors.a.definition.abilities.spell.combat.spell.level=5;
 const c={...cast(),slotId:'pact'};s=run(s,c);const out=execute(s,answer(s,'accept',{optionId:'slot3',checkRolls:[roll]}));assert.equal(out.state.actors.b.resources.slot3,1);assert.equal(out.state.actors.a.resources.pact,1);assert.equal(out.state.actors.b.hp.current,roll===20?100:88);assert.equal(out.result.cancelled===true,roll===20);}
 let s=setup([],[counterspell(resources,2)]);s.actors.a.definition.abilities.spell=spell();s=run(s,cast());s=run(s,answer(s,'accept',{optionId:'slot3'}));assert.equal(s.actors.b.hp.current,100);
});
test('counterspell asks for spatial verification; nested reactions and bonus spell conflicts refuse',()=>{
 let s=setup([],[counterspell(resources,2)]);s.actors.a.definition.abilities.spell=spell();const pending=run(s,{...cast(),facts:{}});assert.ok(pendingDecisions(pending)[0].validationRequired.length);assert.throws(()=>run(pending,answer(pending,'accept',{optionId:'slot3'})),/validation/);
 s=run(s,{...cast(),facts:{b:{hostileSpell:true,casterVisibleWithin60ft:true,canCastCounterspell:true}}});assert.throws(()=>run(s,answer(s,'accept',{optionId:'slot3'})),/Nested/);s=run(s,answer(s,'decline'));assert.equal(s.actors.b.hp.current,88);
});
test('Sneak Attack is once per turn, refreshes on enemy turn, critical doubles dice, decline does not spend',()=>{
 let s=setup([sneakAttack(5)]);s=run(s,hit({advantage:true,attackRolls:[15,16]}));s=run(s,answer(s,'decline'));assert.equal(s.reactive.usage['a:sneak-attack'],undefined);
 s=run(s,attack('second',{advantage:true,attackRolls:[20,19]}));const out=execute(s,answer(s,'accept',{rolls:{0:[1,1,1,1,1,1]}}));s=out.state;assert.equal(out.result.results[0].damage,27);
 s=run(s,{id:'reset',type:'correct',actorId:'a',field:'economy',slot:'action',value:true,reason:'extra attack test'});s=run(s,attack('same-turn',{advantage:true,attackRolls:[15,16]}));assert.equal(pendingDecisions(s).length,0);
 s=run(s,{id:'enemy-turn',type:'startTurn',actorId:'b'});s.actors.a.definition.abilities.opportunity={...blade(),cost:'reaction',attackAction:undefined};delete s.actors.a.definition.abilities.opportunity.attackAction;
 s=run(s,attack('off-turn',{abilityId:'opportunity',advantage:true,attackRolls:[15,16]}));assert.equal(pendingDecisions(s)[0].ruleId,'sneak-attack');s=run(s,answer(s,'accept',{rolls:{0:[1,1,1]}}));assert.equal(s.reactive.usage['a:sneak-attack'],1);
});
test('Sneak Attack requires finesse/ranged and advantage or validated adjacent enemy, no disadvantage',()=>{
 for(const extra of [{facts:{a:{adjacentEnemyEligible:false}}},{disadvantage:true,attackRolls:[15,16],facts:{a:{adjacentEnemyEligible:true}}}])assert.equal(pendingDecisions(run(setup([sneakAttack(5)]),hit(extra))).length,0);
 let s=setup([sneakAttack(5)]);s.actors.a.definition.abilities.blade.combat.traits={melee:true};assert.equal(pendingDecisions(run(s,hit({advantage:true,attackRolls:[15,16]}))).length,0);
 s=run(setup([sneakAttack(5)]),hit({facts:{a:{adjacentEnemyEligible:true}}}));assert.equal(pendingDecisions(s).length,1);
});
test('Divine Smite after hit offers standard/pact slots, critical and fiend dice; decline and miss are free',()=>{
 for(const [critical,fiend,slotId,count] of [[false,false,'slot1',2],[true,false,'slot1',4],[false,true,'pact',6],[true,true,'pact',12]]) {
 let s=setup(smiteRules(resources));s=run(s,hit({attackRolls:[critical?20:15],facts:{a:{fiendOrUndead:fiend}}}));assert.equal(s.actors.a.resources[slotId],resources[slotId].max);
 const out=execute(s,answer(s,'accept',{optionId:slotId,rolls:{0:Array(count).fill(2)}}));assert.equal(out.result.results[0].damage,21+count*2);assert.equal(out.state.actors.a.resources[slotId],resources[slotId].max-1);
 }
 let s=run(setup(smiteRules(resources)),hit({facts:{a:{fiendOrUndead:false}}}));s=run(s,answer(s,'decline'));assert.equal(s.actors.a.resources.slot1,3);
 s=run(setup(smiteRules(resources)),hit({attackRolls:[1],facts:{a:{fiendOrUndead:false}}}));assert.equal(pendingDecisions(s).length,0);assert.equal(s.actors.a.resources.slot1,3);
});
test('Shield and Dodge order avoids spending Dodge when Shield removes hit',()=>{
 let s=setup([],[shield(resources),uncannyDodge(5)]);s=run(s,hit({attackRolls:[10],facts:{b:{canCastShield:true,attackerVisible:true,reactionSpellUnopposed:true}}}));assert.equal(pendingDecisions(s)[0].ruleId,'shield');s=run(s,answer(s,'accept',{optionId:'slot1'}));assert.equal(s.reactive.event.decisions.length,1);assert.equal(s.actors.b.hp.current,100);
});
test('Shield blocks Magic Missile for triggering spell and for its duration on that target',()=>{
 let s=setup([],[shield(resources)]);s.actors.a.definition.abilities.missiles={...spell(),combat:profile({...spell().combat,spell:{...spell().combat.spell,level:1},tags:['magicMissile'],negatedByEffects:['shield']})};
 const c={id:'missiles',type:'useAbility',actorId:'a',abilityId:'missiles',slotId:'slot1',targetIds:['b'],facts:{b:{canCastShield:true,reactionSpellUnopposed:true}}};
 s=run(s,c);const out=execute(s,answer(s,'accept',{optionId:'slot1'}));s=out.state;assert.equal(out.result.results[0].negated,true);assert.equal(s.actors.b.hp.current,100);
 s=run(s,{id:'extra',type:'correct',actorId:'a',field:'economy',slot:'action',value:true,reason:'Granted extra action fixture'});s=run(s,{...c,id:'again'});assert.equal(s.actors.b.hp.current,100);
});
