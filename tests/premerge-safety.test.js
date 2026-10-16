import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,serialize,deserialize} from '../src/model.js';
import {execute} from '../src/engine.js';
import {combatView,transactionView} from '../src/public-view.js';
import {workloadStatus,guardWorkload,WORKLOAD_LIMITS} from '../src/workload.js';
import {definition,rule,attack,answer,run} from './helpers/reactive.js';

const player=actorId=>({role:'player',actorId});
const fresh=(r=rule('defend'))=>createSession([definition('a'),definition('b',{rules:[r]}),definition('observer')]);
test('public pending view hides future rolls, provisional hit, DC, source plan and receipts for every audience',()=>{
  const r=rule('before-result',{trigger:{version:1,event:'attack-roll',scope:'self',limit:'none',whileEffect:null},phase:'after-roll',conditions:[],options:[{id:'boost',label:'Boost',costs:[],reaction:false,effects:[{kind:'adjust',field:'attackTotal',amount:1}]}]});
  const input=createSession([definition('a',{rules:[r]}),definition('b'),definition('observer')]);input.layout={privateMarker:'SECRET_LAYOUT'};
  const tx=execute(input,attack());assert.equal(tx.state.reactive.event.plan.total,20);assert.equal(tx.state.reactive.event.plan.hit,true);
  for(const viewer of [player('a'),player('b'),player('observer'),{role:'gm'}]) {
    const shown=transactionView(tx,viewer),raw=JSON.stringify(shown);
    for(const key of ['plan','command','history','receipts','definition','outcome','hit','critical','total','dc','slotLevel','effectRolls','attackRolls'])assert.ok(!raw.includes('"'+key+'":'),key);
    assert.ok(!raw.includes('SECRET_LAYOUT'));
    assert.equal(shown.view.decisions.length,viewer.role==='gm' || viewer.actorId==='a'?1:0);
    assert.equal(shown.events.length,shown.view.decisions.length);
  }
  assert.throws(()=>combatView(tx.state,{}),/role/);assert.throws(()=>combatView(tx.state,player('missing')),/actor/);
});
test('public copies expose only own resources; completed events are sanitized, stable, replay-safe and undo-aware',()=>{
  const pending=run(fresh(),attack()),cmd=answer(pending),tx=execute(pending,cmd);
  const shown=transactionView(tx,player('b'));assert.equal(shown.events[0].type,'combat.resolution.completed');
  assert.equal(shown.events[0].outcome.results[0].damage,10);assert.equal(shown.events[0].outcome.total,undefined);
  assert.equal(shown.view.actors.find(a=>a.id==='a').hp,undefined);assert.equal(shown.view.actors.find(a=>a.id==='a').resources,undefined);
  shown.view.actors.find(a=>a.id==='b').resources.power=999;assert.equal(tx.state.actors.b.resources.power,3);
  const replay=execute(deserialize(serialize(tx.state)),cmd);assert.deepEqual(transactionView(replay,player('b')).events,[]);
  const undo=execute(tx.state,{id:'undo',type:'undo',actionId:cmd.id}),publicUndo=transactionView(undo,player('b'));
  assert.deepEqual(publicUndo.events,[{version:1,type:'combat.transaction.undone',actionId:cmd.id,revision:undo.state.revision}]);
  assert.equal(publicUndo.view.decisions.length,1);assert.equal(publicUndo.view.decisions[0].id,pending.reactive.event.window.decisionId);
});
test('spell saves expose own roll but never another actor total or any player DC; GM can inspect final DC',()=>{
  const s=createSession([definition('a'),definition('b'),definition('observer')]);
  s.actors.a.definition.abilities.spell={name:'Spell',cost:'action',target:'selected',maxTargets:2,effects:[{kind:'damage',amount:4,damageType:'fire'}],save:{ability:'dex',dc:17,onSuccess:'half'},combat:{version:1,mode:'automatic',requirements:[]}};
  const tx=execute(s,{id:'spell',type:'useAbility',actorId:'a',abilityId:'spell',targetIds:['b','observer'],saveRolls:{b:[18],observer:[4]}});
  const view=transactionView(tx,player('b'));assert.deepEqual(view.events[0].outcome.results[0].save,{success:true,total:20});
  assert.deepEqual(view.events[0].outcome.results[1].save,{success:false});assert.equal(view.events[0].outcome.results[1].damage,undefined);
  assert.equal(JSON.stringify(view).includes('"dc":'),false);
  assert.equal(transactionView(tx,{role:'gm'}).events[0].outcome.results[1].save.dc,17);
});

function mixed(reverse=false) {
  const s=fresh(),a=s.actors.a,b=s.actors.b;
  const effects=[['slashing',5],['fire',3],['cold',11],['fire',3],['necrotic',9],['slashing',4],['fire',1]].map(([damageType,amount])=>({kind:'damage',damageType,amount}));
  a.definition.abilities.blade.effects=reverse?effects.reverse():effects;
  b.definition.resistances=['slashing'];b.definition.vulnerabilities=['fire'];b.definition.immunities=['cold'];
  b.hp.temp=5;b.concentration={effectId:'focus',instanceId:'focus'};return s;
}
test('mixed damage groups equal types, rounds per typed subtotal, then applies defenses/temp HP/concentration once',()=>{
  for(const reverse of [false,true]) {
    const pending=deserialize(serialize(run(mixed(reverse),attack()))),cmd=answer(pending),tx=execute(pending,cmd),r=tx.result.results[0];
    assert.equal(r.rawDamage,36);assert.equal(r.modifiedDamage,16);assert.equal(r.defendedDamage,12);assert.equal(r.damage,12);
    const parts=Object.fromEntries(r.components.map(c=>[c.type,c]));
    assert.deepEqual(parts.fire,{type:'fire',raw:7,afterSave:7,afterModifiers:3,afterDefenses:6});
    assert.deepEqual(parts.slashing,{type:'slashing',raw:9,afterSave:9,afterModifiers:4,afterDefenses:2});
    assert.equal(parts.cold.afterDefenses,0);assert.equal(parts.necrotic.afterDefenses,4);
    assert.equal(r.tempLost,5);assert.equal(r.hpLost,7);assert.equal(tx.state.actors.b.hp.current,93);
    assert.equal(tx.state.actors.b.checks.length,1);assert.equal(tx.state.actors.b.checks[0].dc,10);
    assert.equal(execute(tx.state,cmd).replayed,true);
    const undo=run(tx.state,{id:'undo',type:'undo',actionId:cmd.id});assert.equal(undo.actors.b.hp.temp,5);assert.equal(undo.actors.b.checks.length,0);
    const declined=execute(undo,answer(undo,'decline'));assert.equal(declined.result.results[0].damage,27);assert.equal(declined.result.results[0].hpLost,22);assert.equal(declined.state.actors.b.checks[0].dc,13);
  }
});
test('odd mixed-type interception allocation is explicit local per-type flooring, not a silent global halving',()=>{
  const s=fresh();s.actors.a.definition.abilities.blade.effects=[{kind:'damage',amount:1,damageType:'fire'},{kind:'damage',amount:1,damageType:'cold'}];
  const pending=run(s,attack()),tx=execute(pending,answer(pending));assert.equal(tx.result.results[0].rawDamage,2);assert.equal(tx.result.results[0].damage,0);assert.equal(tx.state.actors.b.checks.length,0);
});

test('deterministic workload thresholds warn then reject new work before recursive validation, without mutation',()=>{
  const s=createSession([definition('a')]);s.history=Array(WORKLOAD_LIMITS.historyWarning).fill(null);
  assert.equal(workloadStatus(s).blocked,false);assert.ok(workloadStatus(s).warnings.includes('history'));
  s.history=Array(WORKLOAD_LIMITS.historyStop).fill(null);const before=JSON.stringify(s);
  assert.throws(()=>execute(s,{id:'new',type:'startTurn',actorId:'a'}),/workload limit/);assert.equal(JSON.stringify(s),before);
  const receipts=createSession([definition('a')]);receipts.receipts=Object.fromEntries(Array.from({length:WORKLOAD_LIMITS.receiptStop},(_,i)=>['r'+i,{}]));
  assert.throws(()=>guardWorkload(receipts,{id:'new'}),/workload limit/);
  const heavy=createSession([definition('a')]);heavy.history=Array(999).fill(null);heavy.actors.a.definition.rules=Array(100).fill({});assert.ok(workloadStatus(heavy).units>=WORKLOAD_LIMITS.unitsStop);assert.equal(workloadStatus(heavy).blocked,true);
});
test('workload stop keeps undo, receipt replay/collision checks and pending refusal/reload available',()=>{
  const command={id:'turn',type:'startTurn',actorId:'a'},one=execute(createSession([definition('a')]),command).state;
  one.history=Array.from({length:WORKLOAD_LIMITS.historyStop},()=>structuredClone(one.history[0]));
  assert.equal(execute(one,command).replayed,true);assert.throws(()=>execute(one,{...command,actorId:'unknown'}),/collision/);
  assert.equal(run(one,{id:'undo',type:'undo',actionId:'turn'}).history.length,WORKLOAD_LIMITS.historyStop-1);
  let pending=run(fresh(),attack());pending.history=Array.from({length:WORKLOAD_LIMITS.historyStop},()=>structuredClone(pending.history[0]));
  pending=deserialize(serialize(pending));const declined=run(pending,answer(pending,'decline'));assert.equal(declined.actors.b.hp.current,79);assert.equal(declined.actors.b.resources.power,4);
  assert.throws(()=>run(declined,{id:'new',type:'startTurn',actorId:'a'}),/workload limit/);
});
