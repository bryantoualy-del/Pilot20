import {check,id,json} from '../character/contracts.js';
import {validateCombat,executeCombat} from '../character/session.js';
import {StorageError} from './adapters.js';
const clone=structuredClone, same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const address=(sessionId,key)=>sessionId+'/'+key;
function packGame(game,definitions) {
  const out=clone(game);
  for(const [k,a] of Object.entries(out.actors)) {
    check(same(a.definition,definitions[k]),'Pinned definition changed');delete a.definition;
  }
  return out;
}
function unpackGame(game,definitions) {
  const out=clone(game);
  check(out && out.actors,'Corrupt game');
  for(const [k,a] of Object.entries(out.actors)) {check(Object.hasOwn(definitions,k),'Corrupt definition reference');a.definition=clone(definitions[k]);}
  return out;
}
function decompose(s) {
  validateCombat(s);const {history,receipts,...engine}=s.engine;
  const definitions=Object.fromEntries(Object.entries(engine.actors).map(([k,a])=>[k,clone(a.definition)]));
  const current=packGame(engine,definitions);
  const header={kind:s.kind,schemaVersion:s.schemaVersion,id:s.id,participants:clone(s.participants),initiative:clone(s.initiative),targets:clone(s.targets),current,definitions,historyIds:history.map(h=>h.id),receiptIds:Object.keys(receipts)};
  return {header,history:history.map(h=>({...clone(h),before:packGame(h.before,definitions)})),receipts:clone(receipts)};
}
/** Split writes, immutable pinned definitions, optimistic concurrency. No history/receipt eviction. */
export function combatRepository(storage,{checkpointEvery=50}={}) {
  check(Number.isSafeInteger(checkpointEvery) && checkpointEvery>0,'Checkpoint interval');
  async function load(sessionId) {
    check(id(sessionId),'Session ID');
    const h=await storage.get('sessions',sessionId);if(h===undefined)return null;
    json(h);check(h.id===sessionId && Array.isArray(h.historyIds) && Array.isArray(h.receiptIds),'Corrupt session header');
    const history=[],receipts={};
    // Explicit keys from the manifest detect missing/interrupted rows, unlike a best-effort scan.
    for(const key of h.historyIds) {
      check(id(key),'History key');const row=await storage.get('history',address(sessionId,key));
      check(row && row.id===key,'Missing/corrupt history');
      history.push({...row,before:unpackGame(row.before,h.definitions)});
    }
    for(const key of h.receiptIds) {
      check(id(key),'Receipt key');const row=await storage.get('receipts',address(sessionId,key));
      check(row,'Missing receipt');receipts[key]=row;
    }
    const s={kind:h.kind,schemaVersion:h.schemaVersion,id:h.id,participants:clone(h.participants),initiative:clone(h.initiative),targets:clone(h.targets),engine:{...unpackGame(h.current,h.definitions),history,receipts}};
    validateCombat(s);
    // A second manifest read detects a concurrent tab commit during reconstruction.
    if(!same(h,await storage.get('sessions',sessionId))) throw new StorageError('conflict');
    return s;
  }
  async function create(s) {
    validateCombat(s);check(s.engine.revision===0 && !s.engine.history.length && !Object.keys(s.engine.receipts).length,'New combat required');
    const {header}=decompose(s);
    await storage.batch([{store:'sessions',key:s.id,value:undefined}],[{store:'sessions',key:s.id,value:header},{store:'checkpoints',key:address(s.id,'0'),value:header}]);
    return clone(s);
  }
  async function commit(sessionId,command,context={}) {
    const input=await load(sessionId);check(input,'Unknown session');
    const out=executeCombat(input,command,context);if(out.replayed)return out;
    const old=decompose(input),next=decompose(out.state),writes=[];
    check(same(old.header.definitions,next.header.definitions),'Pinned definitions changed');
    for(const row of next.history) {
      const prior=old.history.find(h=>h.id===row.id);
      if(!prior) writes.push({store:'history',key:address(sessionId,row.id),value:row});
      else check(same(prior,row),'History mutation');
    }
    // Undo removes the row from the active manifest, retaining the original row and an archive record.
    for(const row of old.history.filter(h=>!next.header.historyIds.includes(h.id)))
      writes.push({store:'archives',key:address(sessionId,'undo:'+command.id),value:{kind:'undone-history',revision:out.state.engine.revision,entry:row}});
    for(const [key,r] of Object.entries(old.receipts)) check(same(r,next.receipts[key]),'Receipt mutation');
    for(const [key,r] of Object.entries(next.receipts)) if(!Object.hasOwn(old.receipts,key)) writes.push({store:'receipts',key:address(sessionId,key),value:r});
    writes.push({store:'sessions',key:sessionId,value:next.header});
    if(out.state.engine.revision%checkpointEvery===0) writes.push({store:'checkpoints',key:address(sessionId,String(out.state.engine.revision)),value:next.header});
    await storage.batch([{store:'sessions',key:sessionId,value:old.header}],writes);
    return out;
  }
  return {
    create,load,commit,
    async checkpoint(sessionId) {const s=await load(sessionId);check(s,'Unknown session');const {header}=decompose(s);await storage.batch([{store:'sessions',key:sessionId,value:header}],[{store:'checkpoints',key:address(sessionId,String(s.engine.revision)),value:header}]);return s.engine.revision;},
    async archive(sessionId) {
      const s=await load(sessionId);check(s,'Unknown session');const {header}=decompose(s);
      const archive={kind:'combat-archive',schemaVersion:2,session:clone(s)};
      // Deliberate user operation: full self-contained archive, no deletion and no automatic retry on quota.
      await storage.batch([{store:'sessions',key:sessionId,value:header}],[{store:'archives',key:address(sessionId,'session:'+s.engine.revision),value:archive}]);return archive;
    },
    async exportJSON(sessionId) {const s=await load(sessionId);check(s,'Unknown session');return JSON.stringify(s);},
    async importJSON(raw) {
      check(typeof raw==='string' && raw.length<=10000000,'Session import size');
      const s=validateCombat(JSON.parse(raw)),p=decompose(s),writes=[{store:'sessions',key:s.id,value:p.header},{store:'checkpoints',key:address(s.id,String(s.engine.revision)),value:p.header}];
      for(const h of p.history) writes.push({store:'history',key:address(s.id,h.id),value:h});
      for(const [k,r] of Object.entries(p.receipts)) writes.push({store:'receipts',key:address(s.id,k),value:r});
      await storage.batch([{store:'sessions',key:s.id,value:undefined}],writes);return clone(s);
    }
  };
}
