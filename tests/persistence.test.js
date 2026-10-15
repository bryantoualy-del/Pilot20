import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {MemoryStorage,openIndexedDB} from '../src/persistence/adapters.js';
import {characterLibrary} from '../src/persistence/library.js';
import {combatRepository} from '../src/persistence/combat-repository.js';
import {characterFixture} from '../examples/characters.mjs';
import {createCombat} from '../src/character/session.js';
import {defaultPreferences} from '../src/character/contracts.js';
const makeCombat=(id='combat')=>createCombat(id,[{instanceId:'a',character:characterFixture('fighter')},{instanceId:'b',character:characterFixture('sorcerer')}]);
const damage=id=>({id,type:'damage',actorId:'a',amount:3,damageType:'force'});
for(const [label,make] of [['memory',async()=>new MemoryStorage()],['indexeddb',async()=>openIndexedDB('test',{indexedDB:new IDBFactory()})]]) {
 test(label+': multiperson library, editing, duplicate, archive, explicit deletion and export/import',async()=>{
   const store=await make();try {
     const lib=characterLibrary(store,{newId:()=> 'duplicate'}),a=characterFixture('fighter'),b=characterFixture('sorcerer');
     await lib.save(a);await lib.save(b);assert.equal((await lib.list()).length,2);
     const dupe=await lib.duplicate(a.id);assert.equal(dupe.definition.id,'duplicate');assert.equal(dupe.definition.revision,1);
     const edited=structuredClone(a);edited.revision=2;edited.identity.name='Renamed';
     await lib.save(edited,{expectedRevision:1});assert.equal((await lib.get(a.id)).definition.identity.name,'Renamed');
     await assert.rejects(lib.save(a),/Revision conflict/);
     const p=defaultPreferences(a.id);p.theme='copper';await lib.setPreferences(a.id,p);
     assert.equal((await lib.get(a.id)).definition.revision,2);
     await lib.archive(a.id);assert.equal((await lib.list()).length,2);assert.equal((await lib.list({includeArchived:true})).length,3);
     await assert.rejects(lib.remove(a.id),/confirmation/);
     const raw=await lib.exportJSON(a.id);await lib.remove(a.id,{confirmId:a.id});assert.equal(await lib.get(a.id),null);
     await lib.importJSON(raw);assert.equal((await lib.get(a.id)).preferences.theme,'copper');
     await assert.rejects(lib.importJSON(raw),/already exists/);
   }finally{store.close?.();}
 });
 test(label+': combat survives reload, replay, collision, undo, checkpoint, archive and export',async()=>{
   const store=await make();try {
     const repo=combatRepository(store,{checkpointEvery:2});await repo.create(makeCombat());
     const first=await repo.commit('combat',damage('one'));assert.equal(first.state.engine.revision,1);
     const reload=combatRepository(store,{checkpointEvery:2});assert.equal((await reload.load('combat')).engine.actors.a.hp.current,46);
     const replay=await reload.commit('combat',damage('one'));assert.equal(replay.replayed,true);assert.equal(replay.state.engine.revision,1);
     await assert.rejects(reload.commit('combat',{...damage('one'),amount:4}),/collision/);
     await reload.commit('combat',damage('two'));assert.equal((await store.list('checkpoints','combat/')).length,2);
     await reload.commit('combat',{id:'undo-two',type:'undo',actionId:'two'});
     const stale=await reload.commit('combat',damage('two'));assert.equal(stale.replayed,true);assert.equal(stale.state.engine.actors.a.hp.current,46);
     assert.equal((await store.list('history','combat/')).length,2); // original history retained after undo
     assert.equal((await store.list('receipts','combat/')).length,3);
     const archive=await reload.archive('combat');assert.equal(archive.session.engine.revision,3);
     assert.equal(await reload.checkpoint('combat'),3);
     const raw=await reload.exportJSON('combat'),other=await make();try {
       const imported=combatRepository(other);await imported.importJSON(raw);assert.deepEqual(await imported.load('combat'),await reload.load('combat'));
       await assert.rejects(imported.importJSON(raw),e=>e.code==='conflict');
     }finally{other.close?.();}
   }finally{store.close?.();}
 });
 test(label+': corruption is detected and preserved',async()=>{
   const store=await make();try {
     const repo=combatRepository(store);await repo.create(makeCombat());await repo.commit('combat',damage('one'));
     await store.batch([],[{store:'history',key:'combat/one',value:{id:'one',before:{}}}]);
     await assert.rejects(repo.load('combat'));assert.deepEqual(await store.get('history','combat/one'),{id:'one',before:{}});
     const lib=characterLibrary(store);await lib.save(characterFixture('fighter'));
     await store.batch([],[{store:'characters',key:'fighter-fixture',value:{broken:true}}]);
     await assert.rejects(lib.get('fighter-fixture'));assert.deepEqual(await store.get('characters','fighter-fixture'),{broken:true});
   }finally{store.close?.();}
 });
 test(label+': CAS blocks stale updates and concurrent sessions remain isolated',async()=>{
   const store=await make();try {
     await store.batch([{store:'meta',key:'revision',value:undefined}],[{store:'meta',key:'revision',value:1}]);
     await assert.rejects(store.batch([{store:'meta',key:'revision',value:undefined}],[{store:'meta',key:'revision',value:2}]),e=>e.code==='conflict');
     const repo=combatRepository(store);await repo.create(makeCombat('first'));await repo.create(makeCombat('second'));
     await repo.commit('first',damage('shared-command-id'));await repo.commit('second',damage('shared-command-id'));
     assert.equal((await repo.load('first')).engine.revision,1);assert.equal((await repo.load('second')).engine.revision,1);
   }finally{store.close?.();}
 });
 test(label+': migration import and invalid import are atomic',async()=>{
   const store=await make();try {
     const lib=characterLibrary(store),d=characterFixture('fighter');d.schemaVersion=1;delete d.revision;
     await lib.importJSON(JSON.stringify({kind:'pilot20-character-export',schemaVersion:1,definition:d,preferences:defaultPreferences(d.id),archived:false}));
     assert.equal((await lib.get(d.id)).definition.schemaVersion,2);
     const before=await lib.list({includeArchived:true});await assert.rejects(lib.importJSON('{"broken":true}'));assert.deepEqual(await lib.list({includeArchived:true}),before);
   }finally{store.close?.();}
 });
}
test('interrupted memory commit and simulated quota preserve all last-committed rows',async()=>{
 const store=new MemoryStorage(),repo=combatRepository(store);await repo.create(makeCombat());
 for(const code of ['write','quota']) {store.failNext(code);await assert.rejects(repo.commit('combat',damage(code)),e=>e.code===code);assert.equal((await repo.load('combat')).engine.revision,0);assert.equal((await store.list('receipts')).length,0);assert.equal((await store.list('history')).length,0);}
});
test('IndexedDB abort after first staged put rolls back quota/interruption; retry is idempotent',async()=>{
 const store=await openIndexedDB('rollback',{indexedDB:new IDBFactory()}),repo=combatRepository(store);await repo.create(makeCombat());
 const original=IDBObjectStore.prototype.put;
 try {
   for(const name of ['QuotaExceededError','AbortError']) {
     let puts=0;IDBObjectStore.prototype.put=function(...args){if(++puts===2)throw new DOMException('injected',name);return original.apply(this,args);};
     await assert.rejects(repo.commit('combat',damage(name)),e=>e.code===(name==='QuotaExceededError'?'quota':'write'));
     IDBObjectStore.prototype.put=original;
     assert.equal((await repo.load('combat')).engine.revision,0);assert.equal((await store.list('history')).length,0);assert.equal((await store.list('receipts')).length,0);
   }
   await repo.commit('combat',damage('success'));assert.equal((await repo.load('combat')).engine.revision,1);
 } finally {IDBObjectStore.prototype.put=original;store.close();}
});
test('IndexedDB rejects unknown database version without deleting data',async()=>{
 const indexedDB=new IDBFactory();
 const raw=await new Promise((resolve,reject)=>{const r=indexedDB.open('future',2);r.onupgradeneeded=()=>r.result.createObjectStore('untouched');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});raw.close();
 await assert.rejects(openIndexedDB('future',{indexedDB}),e=>e.code==='migration');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('future',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});assert.ok(db.objectStoreNames.contains('untouched'));db.close();
});
test('bounded incremental writes retain every receipt over 120 commands',async()=>{
 const store=new MemoryStorage(),repo=combatRepository(store,{checkpointEvery:20});await repo.create(makeCombat());
 for(let i=0;i<120;i++) await repo.commit('combat',{id:'turn-'+i,type:'startTurn',actorId:i%2?'b':'a'});
 assert.equal((await store.list('receipts')).length,120);assert.equal((await store.list('history')).length,120);assert.equal((await store.list('checkpoints')).length,7);
 assert.equal((await combatRepository(store).load('combat')).engine.revision,120);
 assert.equal((await repo.commit('combat',{id:'turn-0',type:'startTurn',actorId:'a'})).replayed,true);
 const rows=await store.list('history');assert.ok(!JSON.stringify(rows).includes('"definition"'));
});
