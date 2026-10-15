import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSession,copy,serialize,deserialize,validateDefinition} from '../src/model.js';
import {execute} from '../src/engine.js';
import {repository} from '../src/storage.js';
const guardian=JSON.parse(readFileSync(new URL('../examples/guardian.json',import.meta.url)));
const target=JSON.parse(readFileSync(new URL('../examples/target.json',import.meta.url)));
function fixture({attack=false,start='activation'}={}) {
 const d=copy(guardian);
 d.abilities.field={name:'Field',cost:'action',target:'selected',maxTargets:attack?1:2,
   resource:{id:'slot1',amount:1},concentration:{effectId:'field',start},
   effects:[{kind:'damage',amount:1,damageType:'fire'}],...(attack?{attack:{bonus:0}}:{})};
 return createSession([d,target]);
}
const cast=(id='cast',targetIds=[guardian.id,target.id],extra={})=>({id,type:'useAbility',actorId:guardian.id,abilityId:'field',targetIds,...extra});
const run=(s,c)=>execute(s,c).state;
const owner=s=>s.actors[guardian.id];
function pending() {
 let s=run(fixture(),cast('old',[target.id]));
 s=run(s,{id:'damage',type:'damage',actorId:guardian.id,amount:1,damageType:'fire'});
 return run(s,{id:'new-turn',type:'startTurn',actorId:guardian.id});
}
test('multi-target concentration activates once; next target never erases self-damage check',()=>{
 const before=fixture(),out=execute(before,cast());const a=owner(out.state);
 assert.deepEqual(a.concentration,{effectId:'field',instanceId:'cast'});
 assert.deepEqual(a.checks,[{id:'cast:'+guardian.id,instanceId:'cast',dc:10}]);
 assert.equal(a.resources.slot1,1);assert.equal(a.economy.action,false);
 assert.equal(out.state.actors[target.id].hp.current,59);
 assert.equal(execute(out.state,cast()).replayed,true);
 assert.deepEqual(owner(before).checks,[]);
});
test('target order does not change concentration or damage-induced checks',()=>{
 const first=run(fixture(),cast()),last=run(fixture(),cast('cast',[target.id,guardian.id]));
 assert.deepEqual(first.actors,last.actors);
});
test('miss still starts activation-scoped concentration and spends one action/resource',()=>{
 const out=execute(fixture({attack:true}),cast('miss',[target.id],{attackRolls:[1]}));
 assert.equal(out.result.hit,false);assert.deepEqual(out.result.results,[]);
 assert.deepEqual(owner(out.state).concentration,{effectId:'field',instanceId:'miss'});
 assert.equal(owner(out.state).resources.slot1,1);assert.equal(owner(out.state).economy.action,false);
 assert.equal(out.state.actors[target.id].hp.current,60);
});
test('hit-gated concentration is explicit; miss preserves previous concentration',()=>{
 let s=fixture({attack:true,start:'hit'});
 owner(s).concentration={effectId:'previous',instanceId:'old'};
 const miss=run(s,cast('miss',[target.id],{attackRolls:[1]}));
 assert.deepEqual(owner(miss).concentration,owner(s).concentration);
 const hit=run(s,cast('hit',[target.id],{attackRolls:[20]}));
 assert.deepEqual(owner(hit).concentration,{effectId:'field',instanceId:'hit'});
});
test('replacement retires old requests; late old save cannot change the new instance',()=>{
 const s=pending();assert.equal(owner(s).checks.length,1);
 const next=run(s,cast('new',[target.id]));
 assert.deepEqual(owner(next).concentration,{effectId:'field',instanceId:'new'});
 assert.deepEqual(owner(next).checks,[]);
 const raw=serialize(next);
 assert.throws(()=>run(next,{id:'late',type:'concentrationSave',actorId:guardian.id,checkId:'damage',rolls:[1]}),/Stale/);
 assert.equal(serialize(next),raw);
});
test('replacement allows new self-damage requests without retaining old instance requests',()=>{
 const next=run(pending(),cast('new'));
 assert.deepEqual(owner(next).checks,[{id:'new:'+guardian.id,instanceId:'new',dc:10}]);
});
test('hit-gated ability cannot evade unresolved old checks on a miss or hit',()=>{
 const s=pending();owner(s).definition.abilities.field.concentration.start='hit';
 owner(s).definition.abilities.field.attack={bonus:0};
 for (const roll of [1,20]) assert.throws(()=>run(s,cast('conditional',[target.id],{attackRolls:[roll]})),/Resolve concentration/);
});
test('undo replacement restores old concentration, pending requests, costs and economy',()=>{
 const s=pending(),next=run(s,cast('new'));
 const undone=run(next,{id:'undo',type:'undo',actionId:'new'});
 assert.deepEqual(undone.actors,s.actors);
 const replay=execute(undone,cast('new'));assert.equal(replay.replayed,true);assert.deepEqual(replay.state.actors,s.actors);
});
test('undo first activation restores absence of concentration',()=>{
 const s=fixture(),next=run(s,cast('new',[target.id]));
 assert.deepEqual(run(next,{id:'undo',type:'undo',actionId:'new'}).actors,s.actors);
});
test('active concentration and queued requests survive storage reload; undo still works',()=>{
 const s=run(fixture(),cast()),m=new Map(),r=repository({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)});
 r.save(s);const loaded=r.load().state;
 assert.deepEqual(loaded,s);assert.equal(execute(loaded,cast()).replayed,true);
 assert.equal(owner(run(loaded,{id:'undo',type:'undo',actionId:'cast'})).concentration,null);
});
test('invalid dice after attempted replacement leave original pending instance intact',()=>{
 const s=pending();owner(s).definition.abilities.field.effects=[{kind:'damage',dice:'1d6',damageType:'fire'}];
 const before=serialize(s);
 assert.throws(()=>run(s,cast('invalid',[target.id],{effectRolls:{0:[8]}})),/dice/);
 assert.equal(serialize(s),before);
});
test('incapacitated or zero HP actors cannot start concentration',()=>{
 for (const blocked of ['incapacitated','hp']) {
  const s=fixture();if(blocked==='hp')owner(s).hp.current=0;else owner(s).incapacitated=true;
  assert.throws(()=>run(s,cast()),/cannot act/);
 }
});
test('unrecognized activation conditions and hit rules without an attack are rejected',()=>{
 for(const start of ['conditional',null,'hit'])assert.throws(()=>fixture({start}),/activation rule|requires an attack/);
});
test('legacy v1 definitions migrate on copies, including undo history; receipts are preserved',()=>{
 const state=run(fixture(),cast('old',[target.id]));
 const legacy=copy(state);
 for (const a of [legacy.actors[guardian.id],legacy.history[0].before.actors[guardian.id]]) {
  const field=a.definition.abilities.field;field.effects.unshift({kind:'concentration',effectId:field.concentration.effectId});delete field.concentration;
 }
 const raw=JSON.stringify(legacy),loaded=deserialize(raw);
 assert.deepEqual(loaded,state);assert.equal(JSON.stringify(legacy),raw);
 assert.deepEqual(loaded.receipts,state.receipts);
 assert.equal(owner(run(loaded,{id:'undo',type:'undo',actionId:'old'})).concentration,null);
 assert.deepEqual(deserialize(serialize(loaded)),loaded);
});
test('ambiguous legacy definitions are rejected instead of guessing concentration rules',()=>{
 const s=fixture(),field=owner(s).definition.abilities.field;
 field.effects.push({kind:'concentration',effectId:'other'});
 assert.throws(()=>deserialize(JSON.stringify(s)),/Ambiguous/);
 const d=copy(guardian);d.abilities.focus.concentration={effectId:'focus',start:'hit'};
 assert.throws(()=>validateDefinition(d),/requires an attack/);
});
test('unknown concentration prerequisites are not silently ignored at validation or migration',()=>{
 const s=fixture();owner(s).definition.abilities.field.concentration.requires='custom-condition';
 assert.throws(()=>serialize(s),/activation rule/);
 const d=copy(guardian);delete d.abilities.focus.concentration;
 d.abilities.focus.effects=[{kind:'concentration',effectId:'focus',requires:'unsupported'}];
 assert.throws(()=>createSession([d]),/Unsupported legacy/);
});
