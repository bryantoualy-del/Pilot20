/** Reproducible, non-destructive history/storage probe. All stores are in memory. */
import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createSession,copy,serialize,deserialize} from '../src/model.js';
import {execute} from '../src/engine.js';
import {repository} from '../src/storage.js';
const guardian=JSON.parse(readFileSync(new URL('../examples/guardian.json',import.meta.url)));
const target=JSON.parse(readFileSync(new URL('../examples/target.json',import.meta.url)));
function memoryStorage(limit=Infinity) {
 const values=new Map();
 return {
   getItem:key=>values.get(key)??null,
   setItem(key,value) {
     // Conservative illustrative UTF-16 budget, including key names and backup.
     let units=key.length+value.length;
     for(const [k,v] of values)if(k!==key)units+=k.length+v.length;
     if(units*2>limit)throw Error('Simulated storage quota');
     values.set(key,value);
   },
   bytes:()=>[...values].reduce((n,[k,v])=>n+2*(k.length+v.length),0)
 };
}
function summary(samples) {
 const sorted=[...samples].sort((a,b)=>a-b);
 return {totalMs:samples.reduce((a,b)=>a+b,0),meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p50Ms:sorted[Math.ceil(sorted.length*.5)-1],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1)};
}
export function measure(participants=7,transactions=500) {
 assert.equal(transactions%10,0);
 const definitions=[copy(guardian),...Array.from({length:participants-1},(_,i)=>({...copy(target),id:'participant-'+i}))];
 definitions[0].abilities.focus={...definitions[0].abilities.focus,target:'selected',maxTargets:2};
 const who=definitions[0].id,foe=definitions[1].id;
 let state=createSession(definitions),beforeAttack=null,firstCommand;
 const storage=memoryStorage(),repo=repository(storage);
 const quotaStorage=memoryStorage(5*1024*1024),quotaRepo=repository(quotaStorage);
 let firstQuotaFailure=null,quotaLastCommitted=null;
 const times={execute:[],save:[],load:[]},samples=[],commandsByType={};
 const started=performance.now();
 for(let i=0;i<transactions;i++) {
   const id='tx-'+i;
   const commands=[
    {type:'startTurn',actorId:who},
    {type:'useAbility',actorId:who,abilityId:'focus',targetIds:[who,foe]},
    {type:'useAbility',actorId:who,abilityId:'ward'},
    {type:'damage',actorId:who,amount:12,damageType:'fire'},
    {type:'concentrationSave',actorId:who,checkId:'tx-'+(i-1),rolls:[15]},
    {type:'startTurn',actorId:who},
    {type:'useAbility',actorId:who,abilityId:'sword',targetIds:[foe],attackRolls:[15],effectRolls:{0:[7]}},
    {type:'undo',actionId:'tx-'+(i-1)},
    {type:'correct',actorId:who,field:'hp',value:44,reason:'Benchmark manual correction'},
    {type:'rest',actorId:who,kind:'long'}
   ];
   const command={id,...commands[i%10]};firstCommand??=command;
   commandsByType[command.type]=(commandsByType[command.type]||0)+1;
   if(i%10===6)beforeAttack=copy(state.actors);
   let t=performance.now();state=execute(state,command).state;times.execute.push(performance.now()-t);
   if(i%10===7)assert.deepEqual(state.actors,beforeAttack);
   t=performance.now();repo.save(state);times.save.push(performance.now()-t);
   t=performance.now();const loaded=repo.load();times.load.push(performance.now()-t);
   assert.equal(loaded.recovered,false);assert.deepEqual(loaded.state,state);state=loaded.state;
   if(!firstQuotaFailure) {
     const old=quotaStorage.getItem('pilot20:session:v1');
     try {quotaRepo.save(state);quotaLastCommitted=state.revision;}
     catch(error) {
       assert.equal(error.message,'Simulated storage quota');
       assert.equal(quotaStorage.getItem('pilot20:session:v1'),old);
       assert.equal(quotaRepo.load().state.revision,quotaLastCommitted);
       firstQuotaFailure={transaction:i+1,lastCommittedRevision:quotaLastCommitted,storedBytes:quotaStorage.bytes()};
     }
   }
   if([100,250,500].includes(i+1)) {
     const raw=serialize(state),replay=execute(deserialize(raw),command);
     assert.equal(replay.replayed,true);assert.equal(serialize(replay.state),raw);
     samples.push({transactions:i+1,historyEntries:state.history.length,receipts:Object.keys(state.receipts).length,serializedUtf8Bytes:Buffer.byteLength(raw),serializedCharacters:raw.length,primaryAndBackupUtf16Bytes:storage.bytes(),historyUtf8Bytes:Buffer.byteLength(JSON.stringify(state.history)),receiptsUtf8Bytes:Buffer.byteLength(JSON.stringify(state.receipts))});
   }
 }
 const raw=serialize(state);
 assert.equal(execute(state,firstCommand).replayed,true);
 // An undone attack remains a tombstone after all 500 commits and reloads.
 const cancelled={id:'tx-6',type:'useAbility',actorId:who,abilityId:'sword',targetIds:[foe],attackRolls:[15],effectRolls:{0:[7]}};
 assert.equal(execute(state,cancelled).replayed,true);assert.equal(serialize(execute(state,cancelled).state),raw);
 assert.throws(()=>execute(state,{...firstCommand,actorId:foe}),/collision/);
 return {participants,transactions,commandsByType,samples,timing:Object.fromEntries(Object.entries(times).map(([k,v])=>[k,summary(v)])),wallMs:performance.now()-started,quotaSimulation:{budgetBytes:5*1024*1024,accounting:'2 bytes per UTF-16 code unit, keys and previous-good copy included; illustrative, not a browser quota measurement',firstFailure:firstQuotaFailure,lastCommittedRevision:quotaLastCommitted},checks:{roundtripEveryTransaction:true,undoChecks:transactions/10,idempotentCheckpoints:samples.length,oldAndUndoneReplay:true,conflictingIdRejected:true,quotaFailurePreservesPrimary:firstQuotaFailure?true:null}};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const scenarios=[];
 for(const n of [2,7]){scenarios.push(measure(n));console.log(JSON.stringify(scenarios.at(-1)));}
 const result={measuredAt:new Date().toISOString(),node:process.version,platform:process.platform,architecture:process.arch,scenarios};
 const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
 if(output)writeFileSync(output,JSON.stringify(result,null,2)+'\n');
}
