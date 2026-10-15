import {check,json,id} from '../character/contracts.js';
export const STORES=['characters','preferences','sessions','history','receipts','checkpoints','archives','meta'];
const clone=v=>v===undefined?undefined:structuredClone(v);
export class StorageError extends Error {
  constructor(code,cause) {super('Storage '+code,{cause});this.name='StorageError';this.code=code;}
}
export function storageError(e) {return e instanceof StorageError?e:new StorageError(e?.name==='QuotaExceededError'?'quota':e?.name==='VersionError'?'migration':'write',e);}
function validateBatch(conditions,writes) {
  check(Array.isArray(conditions) && Array.isArray(writes),'Storage batch');
  for(const op of [...conditions,...writes]) {check(STORES.includes(op.store) && typeof op.key==='string' && op.key.length<=500,'Storage address');if(Object.hasOwn(op,'value') && op.value!==undefined) json(op.value);}
}
/** Copy-on-commit adapter. Share the adapter across repository instances to model reloads. */
export class MemoryStorage {
  constructor() {this.data=Object.fromEntries(STORES.map(s=>[s,new Map()]));this.failure=null;}
  async get(store,key) {check(STORES.includes(store),'Store');return clone(this.data[store].get(key));}
  async list(store,prefix='') {check(STORES.includes(store),'Store');return [...this.data[store]].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>({key,value:clone(value)}));}
  failNext(code='write') {this.failure=code;}
  async batch(conditions,writes) {
    validateBatch(conditions,writes);
    for(const c of conditions) if(JSON.stringify(this.data[c.store].get(c.key))!==JSON.stringify(c.value)) throw new StorageError('conflict');
    const data=Object.fromEntries(STORES.map(s=>[s,new Map(this.data[s])]));
    for(const w of writes) w.delete?data[w.store].delete(w.key):data[w.store].set(w.key,clone(w.value));
    if(this.failure) {const code=this.failure;this.failure=null;throw new StorageError(code);}
    this.data=data;
  }
}
/** Native transactions encompass CAS reads and every write; publication follows oncomplete. */
export async function openIndexedDB(name='pilot20',{indexedDB=globalThis.indexedDB}={}) {
  check(indexedDB && typeof indexedDB.open==='function','IndexedDB unavailable');
  const db=await new Promise((resolve,reject)=>{
    const r=indexedDB.open(name,1);
    r.onupgradeneeded=()=>{for(const s of STORES) if(!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s);};
    r.onerror=()=>reject(storageError(r.error));
    r.onblocked=()=>reject(new StorageError('blocked'));
    r.onsuccess=()=>resolve(r.result);
  });
  db.onversionchange=()=>db.close();
  function transaction(stores,mode,work) {
    return new Promise((resolve,reject)=>{
      let tx,result,reason;
      try {
        tx=db.transaction(stores,mode);
        tx.oncomplete=()=>resolve(result);
        tx.onabort=()=>reject(reason||storageError(tx.error));
        tx.onerror=()=>{}; // onabort is the single failure path.
        work(tx,v=>{result=v;},e=>{reason=storageError(e);tx.abort();});
      } catch(e) {if(tx) {reason=storageError(e);try{tx.abort();}catch{reject(reason);}}else reject(storageError(e));}
    });
  }
  return {
    close:()=>db.close(),
    async get(store,key) {check(STORES.includes(store),'Store');return transaction([store],'readonly',(tx,done)=>{const r=tx.objectStore(store).get(key);r.onsuccess=()=>done(r.result);});},
    async list(store,prefix='') {check(STORES.includes(store),'Store');return transaction([store],'readonly',(tx,done)=>{
      const rows=[],r=tx.objectStore(store).openCursor();
      r.onsuccess=()=>{const c=r.result;if(!c) return done(rows);if(String(c.key).startsWith(prefix)) rows.push({key:c.key,value:c.value});c.continue();};
    });},
    async batch(conditions,writes) {
      validateBatch(conditions,writes);
      if(!conditions.length && !writes.length) return;
      return transaction([...new Set([...conditions,...writes].map(w=>w.store))],'readwrite',(tx,done,fail)=>{
        let pending=conditions.length,failed=false;
        function put() {if(failed)return;try{for(const w of writes) {const s=tx.objectStore(w.store);w.delete?s.delete(w.key):s.put(w.value,w.key);}}catch(e){failed=true;fail(e);}}
        for(const c of conditions) {
          const r=tx.objectStore(c.store).get(c.key);
          r.onsuccess=()=>{if(failed)return;if(JSON.stringify(r.result)!==JSON.stringify(c.value)){failed=true;fail(new StorageError('conflict'));return;}if(--pending===0)put();};
        }
        if(!pending) put();
      });
    }
  };
}
