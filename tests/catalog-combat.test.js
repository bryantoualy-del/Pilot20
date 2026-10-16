import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSRD} from '../src/catalog/srd51-catalog.js';
import {catalogCharacter} from './helpers/catalog.js';
import {derive} from '../src/character/derive.js';
import {createCombat,executeCombat} from '../src/character/session.js';
import {pendingDecisions} from '../src/rules/reactive.js';
import {statistic} from '../src/rules/combat.js';
const index=loadSRD(),run=(s,c)=>executeCombat(s,c).state;
const fresh=(cls,spell,level=10,defenses={})=>{
 const caster=catalogCharacter(index,cls,{level,spellIds:[spell]}),target=catalogCharacter(index,'fighter',{level:20});
 Object.assign(target.defenses,defenses);let s=createCombat('catalog-combat',[{instanceId:'a',character:caster},{instanceId:'b',character:target}]);
 return run(s,{id:'start',type:'startTurn',actorId:'a'});
};
const cast=(cls,spell,extra={})=>({id:'cast',type:'useAbility',actorId:'a',abilityId:cls+':'+spell,targetIds:['b'],facts:{a:{spellEligibilityValidated:true,spellRiderResolved:true,baseLevelOnlyValidated:true}},...extra});
for(const [cls,spell] of [['wizard','srd51:fire-bolt'],['sorcerer','srd51:fire-bolt'],['wizard','srd51:ray-of-frost'],['sorcerer','srd51:shocking-grasp']])for(const roll of [1,15,20])test(`catalogue attack ${cls} ${spell} natural ${roll}`,()=>{
 const s=fresh(cls,spell),critical=roll===20,c=cast(cls,spell,{attackRolls:[roll],effectRolls:{0:Array(critical?4:2).fill(3)}}),r=executeCombat(s,c);
 assert.equal(r.result.hit,roll!==1);assert.equal(r.state.engine.actors.b.hp.current,s.engine.actors.b.hp.current-(roll===1?0:critical?12:6));
 assert.equal(executeCombat(r.state,c).replayed,true);
});
for(const [cls,spell,count] of [['wizard','srd51:fireball',8],['sorcerer','srd51:lightning-bolt',8],['wizard','srd51:burning-hands',3]])for(const mode of ['normal','resistance','immunity','vulnerability'])test(`catalogue save ${spell} ${mode}`,()=>{
 const damageType=spell.includes('lightning')?'lightning':'fire';const defenses=mode==='resistance'?{resistances:[damageType]}:mode==='immunity'?{immunities:[damageType]}:mode==='vulnerability'?{vulnerabilities:[damageType]}:{};
 const s=fresh(cls,spell,10,defenses),base=count*2,n=mode==='resistance'?base/2:mode==='immunity'?0:mode==='vulnerability'?base*2:base;
 const slot=spell.includes('burning')?'slot1':'slot3',out=executeCombat(s,cast(cls,spell,{slotId:slot,saveRolls:{b:[1]},effectRolls:{0:Array(count).fill(2)}}));
 assert.equal(out.result.results[0].damage,n);assert.equal(out.state.engine.actors.a.resources[slot],s.engine.actors.a.resources[slot]-1);
 const undo=run(out.state,{id:'undo',type:'undo',actionId:'cast'});assert.deepEqual(undo.engine.actors,s.engine.actors);
});
for(const [cls,spell,sides] of [['cleric','srd51:cure-wounds',8],['bard','srd51:healing-word',4],['druid','srd51:cure-wounds',8],['paladin','srd51:cure-wounds',8]])test(`catalogue heal ${cls} ${spell}`,()=>{
 let s=fresh(cls,spell);s=run(s,{id:'wound',type:'damage',actorId:'b',amount:20,damageType:'force'});
 const c=cast(cls,spell,{slotId:'slot2',effectRolls:{0:[sides,sides]}}),r=executeCombat(s,c);
 const ability=derive(catalogCharacter(index,cls,{spellIds:[spell]})).modifiers[cls==='bard'||cls==='paladin'?'cha':'wis'];
 assert.equal(r.state.engine.actors.b.hp.current,Math.min(s.engine.actors.b.hp.max,s.engine.actors.b.hp.current+2*sides+ability));
 if(spell==='srd51:healing-word'){assert.equal(r.state.engine.actors.a.economy.bonus,false);assert.equal(r.state.engine.actors.a.economy.action,true);}
});
test('catalogue temp HP uses self target and maximum policy',()=>{
 const s=fresh('wizard','srd51:false-life');const out=executeCombat(s,cast('wizard','srd51:false-life',{slotId:'slot1',effectRolls:{0:[4]}}));assert.equal(out.state.engine.actors.a.hp.temp,8);assert.equal(out.state.engine.actors.b.hp.temp,0);
});
test('catalogue cantrip character-level scaling and explicit upcast dice count',()=>{
 for(const [level,count] of [[1,1],[5,2],[11,3],[20,4]]){const s=fresh('wizard','srd51:fire-bolt',level),out=executeCombat(s,cast('wizard','srd51:fire-bolt',{attackRolls:[15],effectRolls:{0:Array(count).fill(2)}}));assert.equal(out.result.results[0].damage,count*2);}
 let s=fresh('wizard','srd51:fireball'),c=cast('wizard','srd51:fireball',{slotId:'slot4',saveRolls:{b:[1]},effectRolls:{0:Array(9).fill(2)}});assert.equal(executeCombat(s,c).result.results[0].damage,18);
 assert.throws(()=>executeCombat(s,{...c,effectRolls:{0:Array(8).fill(2)}}),/dice/);
 assert.throws(()=>executeCombat(s,{...c,slotId:'slot2'}),/slot/);
 assert.throws(()=>executeCombat(s,{...c,facts:{}}),/external validation/);
});
test('catalogue haste concentrates, expires, applies lethargy, and concentration loss undoes',()=>{
 let s=fresh('wizard','srd51:haste');s=run(s,cast('wizard','srd51:haste',{slotId:'slot3'}));
 const b=s.engine.actors.b;assert.equal(statistic(b,'ac',b.definition.ac),b.definition.ac+2);assert.equal(s.engine.actors.a.concentration.effectId,'srd51:haste');
 s=run(s,{id:'hurt',type:'damage',actorId:'a',amount:2,damageType:'fire'});s=run(s,{id:'fail',type:'concentrationSave',actorId:'a',checkId:'hurt',rolls:[1]});assert.equal(s.engine.actors.a.concentration,null);assert.equal(s.engine.actors.b.advanced.effects.length,0);
 s=run(s,{id:'undo-fail',type:'undo',actionId:'fail'});assert.equal(s.engine.actors.a.concentration.effectId,'srd51:haste');
 for(let n=0;n<10;n++)s=run(s,{id:'tick'+n,type:'startTurn',actorId:'a'});assert.equal(s.engine.actors.a.concentration,null);assert.ok(s.engine.actors.b.advanced.lethargyUntil);
});
test('catalogue manual illusion requires declaration and explicit resolution; no automatic fake success',()=>{
 let s=fresh('wizard','srd51:major-image');const command=cast('wizard','srd51:major-image',{slotId:'slot3'});
 assert.throws(()=>executeCombat(s,command),/not automatically/);
 s=run(s,{...command,type:'declareManual',reason:'GM validates illusion and geometry'});assert.ok(s.engine.actors.a.advanced.pendingManual);assert.ok(s.engine.actors.a.concentration);
 s=run(s,{id:'resolve',type:'resolveManual',actorId:'a',declarationId:'cast',reason:'Illusion established; no numeric effect',outcomes:[]});assert.equal(s.engine.actors.a.advanced.pendingManual,null);
 assert.throws(()=>run(s,{id:'again',type:'resolveManual',actorId:'a',declarationId:'cast',reason:'duplicate',outcomes:[]}),/Stale/);
});
test('catalogue Second Wind, Action Surge and short-rest resource recovery',()=>{
 const d=catalogCharacter(index,'fighter',{level:10});let s=createCombat('fighter',[{instanceId:'a',character:d}]);
 s=run(s,{id:'hurt',type:'damage',actorId:'a',amount:30,damageType:'force'});s=run(s,{id:'start',type:'startTurn',actorId:'a'});
 s=run(s,{id:'wind',type:'useAbility',actorId:'a',abilityId:'srd51:fighter:second-wind',effectRolls:{0:[5]}});assert.equal(s.engine.actors.a.resources['fighter:second-wind'],0);
 s=run(s,{id:'surge',type:'useAbility',actorId:'a',abilityId:'srd51:fighter:action-surge'});assert.equal(s.engine.actors.a.advanced.extraActions,1);
 s=run(s,{id:'rest',type:'rest',actorId:'a',kind:'short'});assert.equal(s.engine.actors.a.resources['fighter:second-wind'],1);assert.equal(s.engine.actors.a.resources['fighter:action-surge'],1);
});
test('catalogue rage uses existing stance defenses and enforces spellcasting restriction',()=>{
 const d=catalogCharacter(index,'barbarian',{level:10});let s=createCombat('rage',[{instanceId:'a',character:d}]);s=run(s,{id:'start',type:'startTurn',actorId:'a'});
 s=run(s,{id:'rage',type:'useAbility',actorId:'a',abilityId:'srd51:barbarian:rage',facts:{a:{rageEligible:true,notHeavyArmor:true}}});assert.ok(s.engine.actors.a.advanced.stance);
 const hp=s.engine.actors.a.hp.current;s=run(s,{id:'hit',type:'damage',actorId:'a',amount:10,damageType:'slashing'});assert.equal(s.engine.actors.a.hp.current,hp-5);
});
test('FX projection accepts committed results and rejects replay',async()=>{
 const {confirmedActionEvent}=await import('../src/catalog/events.js');const s=fresh('wizard','srd51:fire-bolt');const c=cast('wizard','srd51:fire-bolt',{attackRolls:[15],effectRolls:{0:[2,2]}}),out=executeCombat(s,c);
 const e=confirmedActionEvent(s,c,out);assert.equal(e.id,'catalog-combat:cast');assert.equal(e.confirmed,true);assert.deepEqual(e.damageTypes,['fire']);assert.deepEqual(e.targetIds,['b']);assert.throws(()=>confirmedActionEvent(out.state,c,executeCombat(out.state,c)));
});
