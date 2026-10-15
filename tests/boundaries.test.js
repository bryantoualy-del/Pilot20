import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSession,copy,serialize,deserialize} from '../src/model.js';
import {execute} from '../src/engine.js';
import {repository} from '../src/storage.js';
const definition=JSON.parse(readFileSync(new URL('../examples/guardian.json',import.meta.url)));
test('sessions and imported definitions never alias a shared character definition',()=>{
 const a=createSession([definition]),b=createSession([definition]);
 a.actors[definition.id].definition.name='Changed only here';a.actors[definition.id].hp.current=1;
 assert.equal(b.actors[definition.id].definition.name,definition.name);assert.equal(b.actors[definition.id].hp.current,44);
 assert.equal(definition.name,'Gardien de démonstration');
});
test('dashboard preferences remain outside combat undo and do not change rules',()=>{
 const s=createSession([definition]);s.layout={characters:{[definition.id]:{panels:['health'],color:'blue'}}};
 let next=execute(s,{id:'hurt',type:'damage',actorId:definition.id,amount:1,damageType:'fire'}).state;
 next.layout.characters[definition.id].color='red';
 next=execute(next,{id:'undo',type:'undo',actionId:'hurt'}).state;
 assert.equal(next.actors[definition.id].hp.current,44);assert.equal(next.layout.characters[definition.id].color,'red');
 assert.equal(s.layout.characters[definition.id].color,'blue');assert.deepEqual(deserialize(serialize(next)),next);
});
test('separate storage keys isolate sessions; default key is a single document, not a library',()=>{
 const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};
 const a=repository(storage,'session:a'),b=repository(storage,'session:b');
 const s=createSession([definition]);a.save(s);
 const next=copy(s);next.actors[definition.id].hp.current=3;b.save(next);
 assert.equal(a.load().state.actors[definition.id].hp.current,44);assert.equal(b.load().state.actors[definition.id].hp.current,3);
});
test('snapshot must contain its own actors, turn and active actor; no fallback to live data',()=>{
 const s=createSession([definition]);s.history=[{id:'invalid',before:{}}];
 assert.throws(()=>serialize(s),/Snapshot turn/);
});
test('a failed primary write retains the last committed session and readable recovery copy',()=>{
 const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)},r=repository(storage);
 const s=createSession([definition]);r.save(s);
 const next=execute(s,{id:'hurt',type:'damage',actorId:definition.id,amount:1,damageType:'fire'}).state;
 storage.setItem=(k,v)=>{if(k==='pilot20:session:v1')throw Error('primary quota');m.set(k,v);};
 assert.throws(()=>r.save(next),/primary quota/);assert.deepEqual(r.load().state,s);
 assert.deepEqual(deserialize(m.get('pilot20:session:v1:last-good')),s);
});
test('optional attack/resource profiles cannot be null or false placeholders',()=>{
 for(const field of ['attack','resource'])for(const value of [null,false]) {
  const d=copy(definition);d.abilities.focus[field]=value;
  assert.throws(()=>createSession([d]),/profile|cost/);
 }
});
