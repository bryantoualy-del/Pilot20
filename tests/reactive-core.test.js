import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,serialize,deserialize,validate} from '../src/model.js';
import {execute} from '../src/engine.js';
import {pendingDecisions} from '../src/rules/reactive.js';
export const definition=(id,overrides={})=>({id,name:id,level:10,maxHp:100,ac:15,attacksPerAction:2,saves:{con:3,dex:2,str:3,wis:2,int:1,cha:4},resources:{power:{max:4,recovery:'long'}},abilities:{blade:{name:'Weapon',cost:'action',target:'selected',maxTargets:1,attackAction:true,attack:{bonus:5},effects:[{kind:'damage',amount:21,damageType:'slashing'}]}},resistances:[],immunities:[],vulnerabilities:[],...overrides});
export const rule=(id,overrides={})=>({version:1,id,trigger:{version:1,event:'attack-hit',scope:'target',limit:'none',whileEffect:null},phase:'before-damage',priority:0,conditions:[{fact:'external.visible',equals:true}],options:[{id:'reduce',label:'Reduce',costs:[{resourceId:'power',amount:1}],reaction:true,effects:[{kind:'adjust',field:'damageDivisor',amount:2}]}],...overrides});
export const run=(s,c)=>execute(s,c).state;
export const attack=(id='hit',extra={})=>({id,type:'useAbility',actorId:'a',abilityId:'blade',targetIds:['b'],attackRolls:[15],facts:{b:{visible:true}},...extra});
export const answer=(s,choice='accept',extra={})=>{const d=pendingDecisions(s)[0];return {id:'answer-'+s.revision,type:'respondDecision',actorId:d.actorId,decisionId:d.id,decisionRevision:d.revision,expectedRevision:s.revision,choice,optionId:d.options[0].id,...extra};};
const fresh=()=>createSession([definition('a'),definition('b',{rules:[rule('defend')]})]);
test('deferred damage preserves source and resumes exactly once after JSON reload',()=>{
 const initial=fresh(),c=attack();let s=run(initial,c);assert.equal(s.actors.b.hp.current,100);assert.equal(s.actors.b.resources.power,4);
 s=deserialize(serialize(s));const command=answer(s);s=run(s,command);assert.equal(s.actors.b.hp.current,90);assert.equal(s.actors.b.resources.power,3);assert.equal(s.actors.b.economy.reaction,false);
 assert.equal(execute(s,command).replayed,true);assert.equal(execute(s,c).replayed,true);assert.throws(()=>run(s,{...command,id:'late',expectedRevision:s.revision}),/Stale/);assert.deepEqual(initial,fresh());
});
test('decline spends nothing; source action already paid only once',()=>{
 let s=run(fresh(),attack());s=run(s,answer(s,'decline'));assert.equal(s.actors.b.hp.current,79);assert.equal(s.actors.b.resources.power,4);assert.equal(s.actors.b.economy.reaction,true);assert.equal(s.actors.a.economy.attacks,1);
});
test('latest undo restores pending choice and invalidates old response revision; cancellation restores declaration',()=>{
 let s=run(fresh(),attack());const cmd=answer(s);s=run(s,cmd);s=run(s,{id:'undo-answer',type:'undo',actionId:cmd.id});
 assert.equal(s.actors.b.hp.current,100);assert.equal(pendingDecisions(s).length,1);assert.equal(s.actors.b.resources.power,4);
 assert.throws(()=>run(s,{...cmd,id:'stale',expectedRevision:s.revision}),/revision/);assert.equal(execute(s,cmd).replayed,true);
 s=run(s,{id:'undo-source',type:'undo',actionId:'hit'});assert.equal(s.reactive,undefined);assert.equal(s.actors.a.economy.action,true);assert.throws(()=>run(s,{...cmd,id:'orphan',expectedRevision:s.revision}),/Stale/);
});
test('dependent commands block; collision, revision, double resume, malformed and orphan continuations reject',()=>{
 const s=run(fresh(),attack()),cmd=answer(s);for(const c of [{id:'turn',type:'startTurn',actorId:'b'},attack('second')])assert.throws(()=>run(s,c),/pending/);
 assert.throws(()=>run(s,{...attack(),attackRolls:[20]}),/collision/);assert.throws(()=>run(s,{...cmd,expectedRevision:0}),/Revision conflict/);
 assert.throws(()=>run(s,{id:'resume',type:'resumeDecision'}),/pending/);
 for(const mutate of [e=>e.window.decisionId='missing',e=>e.decisions[0].continuation.eventId='missing',e=>e.plan.command.id='missing',e=>e.decisions.push(structuredClone(e.decisions[0]))]) {const bad=structuredClone(s);mutate(bad.reactive.event);assert.throws(()=>validate(bad));}
});
test('sequential same-event decisions ordered by priority and recheck reaction availability',()=>{
 const d=definition('b',{rules:[rule('one'),rule('two',{priority:1})]});let s=run(createSession([definition('a'),d]),attack());assert.equal(pendingDecisions(s)[0].ruleId,'one');s=run(s,answer(s,'decline'));assert.equal(pendingDecisions(s)[0].ruleId,'two');s=run(s,answer(s));assert.equal(s.actors.b.hp.current,90);
 let accepted=run(createSession([definition('a'),d]),attack());accepted=run(accepted,answer(accepted));assert.equal(pendingDecisions(accepted).length,0);assert.equal(accepted.reactive.event.decisions.length,1);
});
test('missing perception and unavailable reaction/resource do not open automated windows',()=>{
 for(const alter of [s=>s.actors.b.economy.reaction=false,s=>s.actors.b.resources.power=0]) {const s=fresh();alter(s);const out=execute(s,attack());assert.equal(out.result.hit,true);assert.equal(pendingDecisions(out.state).length,0);}
 assert.equal(pendingDecisions(run(fresh(),attack('unknown',{facts:{}}))).length,0);
});
test('pending decision persists through actual IndexedDB adapter and repository manifest',async()=>{
 const {indexedDB}=await import('fake-indexeddb');const {openIndexedDB}=await import('../src/persistence/adapters.js');const {combatRepository}=await import('../src/persistence/combat-repository.js');
 const store=await openIndexedDB('reactive-core',{indexedDB});const repo=combatRepository(store),engine=fresh();
 const s={kind:'combat',schemaVersion:2,id:'persist',participants:{a:{characterId:'a',definitionRevision:1},b:{characterId:'b',definitionRevision:1}},engine,initiative:[],targets:[]};
 await repo.create(s);await repo.commit(s.id,attack());const loaded=await repo.load(s.id),c=answer(loaded.engine);await repo.commit(s.id,c);assert.equal((await repo.load(s.id)).engine.actors.b.hp.current,90);assert.equal((await repo.commit(s.id,c)).replayed,true);
});
test('reactive schema accepts pending/completed snapshots and rejects malformed continuations',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:Ajv}=await import('ajv/dist/2020.js');const schema=JSON.parse(await readFile(new URL('../schemas/reactive-rules-v1.schema.json',import.meta.url)));
 const valid=new Ajv({strict:false}).compile(schema);const s=run(fresh(),attack());assert.equal(valid(s.reactive),true,JSON.stringify(valid.errors));const done=run(s,answer(s));assert.equal(valid(done.reactive),true,JSON.stringify(valid.errors));
 const bad=structuredClone(s.reactive);delete bad.event.plan;assert.equal(valid(bad),false);
});
