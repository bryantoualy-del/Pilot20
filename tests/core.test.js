import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSession,validate,serialize,deserialize,migrate,copy} from '../src/model.js';
import {execute,d20,effectiveDamage} from '../src/engine.js';
import {repository} from '../src/storage.js';
import {healthIntent,connectionReadiness} from '../src/connect.js';
const guardian=JSON.parse(readFileSync(new URL('../examples/guardian.json',import.meta.url)));
const target=JSON.parse(readFileSync(new URL('../examples/target.json',import.meta.url)));
const fresh=()=>createSession([guardian,target]);
const run=(s,c,ctx)=>execute(s,c,ctx).state;
const use=(id='swing',extra={})=>({id,type:'useAbility',actorId:guardian.id,abilityId:'sword',targetIds:[target.id],attackRolls:[12],effectRolls:{0:[7]},...extra});
const focus=()=>run(fresh(),use('focus',{abilityId:'focus',targetIds:undefined}));
const hit=(id='hit',amount=22)=>({id,type:'damage',actorId:guardian.id,amount,damageType:'fire'});
function store(){const m=new Map();return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};}
test('two attacks spend one action; third rejected atomically',()=>{
  const one=run(fresh(),use()), two=run(one,use('second'));
  assert.equal(two.actors[target.id].hp.current,50);
  assert.equal(two.actors[guardian.id].economy.action,false);
  assert.equal(two.actors[guardian.id].economy.attacks,0);
  const before=serialize(two);assert.throws(()=>run(two,use('third')),/Action spent/);assert.equal(serialize(two),before);
});
test('non-attack action unavailable while an attack action is in progress',()=>assert.throws(()=>run(run(fresh(),use()),use('focus',{abilityId:'focus'})),/Action spent/));
test('spell attack consumes a whole action rather than Extra Attack',()=>{
  const a=copy(guardian);a.abilities.ray={...a.abilities.sword};delete a.abilities.ray.attackAction;
  const s=run(createSession([a,target]),use('ray',{abilityId:'ray'}));assert.equal(s.actors[a.id].economy.attacks,0);
  assert.throws(()=>run(s,use()),/Action spent/);
});
test('critical doubles dice, not modifier; natural 1 misses even with high total',()=>{
  const c=execute(fresh(),use('crit',{attackRolls:[20],effectRolls:{0:[8,4]}}));assert.equal(c.result.results[0].damage,7);
  const s=fresh();s.actors[target.id].definition.ac=0;
  const r=execute(s,use('miss',{attackRolls:[1],effectRolls:{}}));assert.equal(r.result.hit,false);assert.equal(r.state.actors[guardian.id].economy.attacks,1);
});
test('advantage/disadvantage cancel',()=>{assert.equal(d20([8],true,true),8);assert.equal(d20([8,19],true),19);assert.equal(d20([8,19],false,true),8);assert.throws(()=>d20([21]));});
test('defenses: immunity first, resistance then vulnerability',()=>{
 const d=copy(target);d.vulnerabilities=['slashing'];assert.equal(effectiveDamage(11,'slashing',d),10);d.immunities=['slashing'];assert.equal(effectiveDamage(11,'slashing',d),0);
});
test('temporary HP absorb damage and still trigger concentration; no stacking',()=>{
 let s=run(focus(),use('ward',{abilityId:'ward'}));s=run(s,hit('hit',4));assert.deepEqual(s.actors[guardian.id].hp,{current:44,max:44,temp:4});assert.equal(s.actors[guardian.id].checks[0].dc,10);
});
test('typed components aggregate before resistance and concentration per hit',()=>{
 const a=copy(guardian);a.abilities.sword.effects=[{kind:'damage',amount:3,damageType:'slashing'},{kind:'damage',amount:3,damageType:'slashing'},{kind:'damage',amount:1,damageType:'fire'}];
 const r=execute(createSession([a,target]),use());assert.equal(r.result.results[0].damage,4);
});
for(const [amount,dc] of [[1,10],[21,10],[22,11],[43,21]]) test('concentration DC '+amount,()=>{
 const s=run(focus(),hit('hit',amount));assert.equal(s.actors[guardian.id].checks[0].dc,dc);
});
test('concentration failure clears pending checks; natural 20 can fail high DC',()=>{
 let s=focus();s.actors[guardian.id].hp={max:200,current:200,temp:0};s=run(s,hit('huge',100));s=run(s,{id:'save',type:'concentrationSave',actorId:guardian.id,checkId:'huge',rolls:[20]});assert.equal(s.actors[guardian.id].concentration,null);assert.deepEqual(s.actors[guardian.id].checks,[]);
});
test('natural 1 can pass a save; adjustments and replay survive reload',()=>{
 let s=run(focus(),hit('hit',1));const c={id:'save',type:'concentrationSave',actorId:guardian.id,checkId:'hit',rolls:[1],bonus:6};const out=execute(s,c);assert.equal(out.result.success,true);s=deserialize(serialize(out.state));assert.equal(execute(s,c).replayed,true);
});
test('multiple damage instances queue separately and block further abilities',()=>{
 let s=run(run(focus(),hit('a',1)),hit('b',2));assert.equal(s.actors[guardian.id].checks.length,2);assert.throws(()=>run(s,use('ward',{abilityId:'ward'})),/concentration first/);
});
test('0 HP or incapacitation breaks concentration without save',()=>{
 const zero=run(focus(),hit('lethal',100));assert.equal(zero.actors[guardian.id].concentration,null);
 const inc=run(focus(),{id:'inc',type:'setIncapacitated',actorId:guardian.id,value:true});assert.equal(inc.actors[guardian.id].concentration,null);
});
test('reaction can be used off-turn once, refreshes only at own turn start',()=>{
 let s=run(fresh(),{id:'turn-target',type:'startTurn',actorId:target.id});s=run(s,use('reaction',{abilityId:'parry'}));assert.throws(()=>run(s,use('reaction2',{abilityId:'parry'})),/Action spent/);
 s=run(s,{id:'turn-target2',type:'startTurn',actorId:target.id});assert.equal(s.actors[guardian.id].economy.reaction,false);
 s=run(s,{id:'turn-own',type:'startTurn',actorId:guardian.id});assert.equal(s.actors[guardian.id].economy.reaction,true);
});
test('resource depletion, rests, healing cap and bonus action',()=>{
 let s=run(fresh(),hit('hurt',10));s=run(s,use('recover',{abilityId:'recover',effectRolls:{0:[10]}}));assert.equal(s.actors[guardian.id].hp.current,44);assert.equal(s.actors[guardian.id].resources.recovery,0);
 s=run(s,{id:'next',type:'startTurn',actorId:guardian.id});assert.throws(()=>run(s,use('recover2',{abilityId:'recover',effectRolls:{0:[10]}})),/depleted/);
 s=run(s,{id:'rest',type:'rest',actorId:guardian.id,kind:'short'});assert.equal(s.actors[guardian.id].resources.recovery,1);
});
test('undo restores whole transaction and keeps replay tombstone',()=>{
 let s=run(fresh(),use());s=run(s,{id:'undo',type:'undo',actionId:'swing'});assert.equal(s.actors[target.id].hp.current,60);assert.equal(s.actors[guardian.id].economy.action,true);assert.equal(execute(s,use()).replayed,true);assert.equal(execute(s,{id:'undo',type:'undo',actionId:'swing'}).replayed,true);
});
test('undo latest only; undo of damage cancels concentration request',()=>{
 let s=run(focus(),hit());assert.throws(()=>run(s,{id:'undo-stale',type:'undo',actionId:'focus'}));s=run(s,{id:'undo',type:'undo',actionId:'hit'});assert.equal(s.actors[guardian.id].checks.length,0);assert.equal(s.actors[guardian.id].hp.current,44);
});
test('duplicate command returns receipt; conflicting ID rejected',()=>{
 const s=run(fresh(),use());assert.equal(execute(s,use()).replayed,true);assert.throws(()=>run(s,use('swing',{attackRolls:[20]})),/collision/);
});
test('corrections need reason, bounds and can be undone',()=>{
 let s=run(fresh(),{id:'edit',type:'correct',actorId:guardian.id,field:'resource',resourceId:'slot1',value:1,reason:'MJ adjustment'});assert.equal(s.actors[guardian.id].resources.slot1,1);
 s=run(s,{id:'undo',type:'undo',actionId:'edit'});assert.equal(s.actors[guardian.id].resources.slot1,2);
 assert.throws(()=>run(s,{id:'bad',type:'correct',actorId:guardian.id,field:'hp',value:999,reason:'x'}));
});
test('invalid rolls, duplicate/missing targets and unknown effects reject atomically',()=>{
 for(const c of [use('bad',{attackRolls:[99]}),use('bad',{effectRolls:{0:[0]}}),use('bad',{targetIds:['missing']}),use('bad',{targetIds:[target.id,target.id]})]) {const s=fresh(),before=serialize(s);assert.throws(()=>run(s,c));assert.equal(serialize(s),before);}
 const d=copy(guardian);d.abilities.sword.effects=[{kind:'javascript',code:'x'}];assert.throws(()=>createSession([d]));
});
test('same engine supports arbitrary identities, data and defenses',()=>{
 const a=copy(guardian),b=copy(target);a.id='custom-bard';a.name='Barde test';b.id='training-dummy';b.resistances=[];
 const s=run(createSession([a,b]),use('new',{actorId:a.id,targetIds:[b.id]}));assert.equal(s.actors[b.id].hp.current,50);
});
test('connected authority never falls back locally; free mode remains local',()=>{
 let s=fresh();s.mode='encounter';assert.throws(()=>run(s,use()),/authority/);assert.throws(()=>run(s,hit(),{authority:'encounter'}),/GM/);assert.equal(run(s,hit(),{authority:'encounter',role:'gm'}).actors[guardian.id].hp.current,22);
 s.mode='free';assert.equal(run(s,use()).actors[target.id].hp.current,55);
});
test('versioned roundtrip, v0 migration, future version rejection',()=>{
 const s=fresh();assert.deepEqual(deserialize(serialize(s)),s);const old=copy(s);old.schemaVersion=0;delete old.layout;assert.deepEqual(migrate(old),s);assert.throws(()=>deserialize(JSON.stringify({...s,schemaVersion:2})));assert.throws(()=>deserialize('{broken'));
});
test('invalid imported state and dangerous identifiers rejected',()=>{
 for(const modify of [s=>s.actors[guardian.id].hp.current=-1,s=>s.actors[guardian.id].resources.slot1=900,s=>s.activeActorId='missing',s=>s.actors[guardian.id].economy.action='yes']) {const s=fresh();modify(s);assert.throws(()=>validate(s));}
 const a=copy(guardian);a.id='__proto__';assert.throws(()=>createSession([a]));
});
test('storage recovers previous good snapshot and preserves corrupt primary',()=>{
 const st=store(),r=repository(st),s=fresh();r.save(s);r.save(run(s,use()));st.setItem('pilot20:session:v1','broken');const result=r.load();assert.equal(result.recovered,true);assert.deepEqual(result.state,s);assert.throws(()=>r.save(s));assert.equal(st.getItem('pilot20:session:v1'),'broken');
});
test('quota failure does not replace primary; export/import without storage',()=>{
 const st=store(),r=repository(st),s=fresh();r.save(s);st.setItem=()=>{throw Error('quota')};assert.throws(()=>r.save(run(s,use())),/quota/);assert.deepEqual(r.load().state,s);assert.deepEqual(r.import(r.export(s)),s);
});
test('pending checks and receipts survive save/load then undo',()=>{
 const s=deserialize(serialize(run(focus(),hit())));assert.equal(s.actors[guardian.id].checks.length,1);assert.equal(execute(s,hit()).replayed,true);assert.equal(run(s,{id:'undo',type:'undo',actionId:'hit'}).actors[guardian.id].checks.length,0);
});
test('legacy connection gate exposes character restriction; intent leaves state intact',()=>{
 const s=fresh();s.mode='encounter';const before=serialize(s);assert.equal(connectionReadiness(guardian.id,[]).ready,false);const q=healthIntent(s,{id:'heal',actorId:guardian.id,targetIds:['target'],amount:5,source:'Custom heal',combatId:'c'});assert.equal(q.event.type,'heal:request');assert.equal(serialize(s),before);
});
test('concentration replacement invalidates old instance and zero damage adds no check',()=>{
 let s=run(focus(),hit('zero',0));assert.equal(s.actors[guardian.id].checks.length,0);
 s=run(s,{id:'turn',type:'startTurn',actorId:guardian.id});s=run(s,use('new-focus',{abilityId:'focus'}));assert.equal(s.actors[guardian.id].concentration.instanceId,'new-focus');
 assert.throws(()=>run(s,{id:'stale-save',type:'concentrationSave',actorId:guardian.id,checkId:'zero',rolls:[15]}));
});
test('temporary HP never stack or replace a higher value automatically',()=>{
 let s=run(fresh(),use('ward',{abilityId:'ward'}));s.actors[guardian.id].hp.temp=12;
 s=run(s,{id:'turn',type:'startTurn',actorId:guardian.id});s=run(s,use('ward2',{abilityId:'ward'}));assert.equal(s.actors[guardian.id].hp.temp,12);
});
test('multi-target effect spends its resource once and undo restores every target',()=>{
 const d=copy(guardian);d.abilities.wave={name:'Custom wave',cost:'action',target:'selected',maxTargets:2,resource:{id:'slot1',amount:1},effects:[{kind:'damage',amount:8,damageType:'fire'}]};
 const s=createSession([d,target]),c=use('wave',{abilityId:'wave',targetIds:[d.id,target.id]});
 const out=execute(s,c);assert.equal(out.state.actors[d.id].resources.slot1,1);assert.equal(out.state.actors[d.id].hp.current,36);assert.equal(out.state.actors[target.id].hp.current,52);
 assert.equal(execute(out.state,c).replayed,true);const undone=run(out.state,{id:'undo',type:'undo',actionId:'wave'});assert.deepEqual(undone.actors,s.actors);
});
test('JSON-only persistence rejects nonfinite metadata and stale concentration instances',()=>{
 const s=fresh();s.layout.bad=NaN;assert.throws(()=>serialize(s));delete s.layout.bad;
 s.actors[guardian.id].checks=[{id:'bad',instanceId:'old',dc:10}];assert.throws(()=>validate(s),/Stale/);
});
