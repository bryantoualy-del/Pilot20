import {check,id,json,preferences,defaultPreferences} from '../character/contracts.js';
import {validateCharacter,migrateCharacter} from '../character/definition.js';
import {StorageError} from './adapters.js';
const clone=structuredClone,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function record(r) {
  check(r && typeof r.archived==='boolean','Corrupt character record');
  validateCharacter(r.definition);return r;
}
export function characterLibrary(storage,{newId=()=>globalThis.crypto.randomUUID()}={}) {
  async function read(characterId) {
    check(id(characterId),'Character ID');const raw=await storage.get('characters',characterId);
    if(raw===undefined)return null;record(raw);
    const prefs=await storage.get('preferences',characterId);preferences(prefs);check(prefs.characterId===characterId,'Preference identity');
    if(!same(raw,await storage.get('characters',characterId))) throw new StorageError('conflict');
    return {raw,prefs};
  }
  async function get(characterId) {const r=await read(characterId);return r?{...clone(r.raw),preferences:clone(r.prefs)}:null;}
  async function save(d,{expectedRevision=null,prefs,initialArchived=false}={}) {
    validateCharacter(d);check(typeof initialArchived==='boolean','Archive flag');
    const old=await read(d.id);
    check(old===null?expectedRevision===null && d.revision===1:expectedRevision===old.raw.definition.revision && d.revision===expectedRevision+1,'Revision conflict');
    const p=prefs??old?.prefs??defaultPreferences(d.id);preferences(p);check(p.characterId===d.id,'Preferences mismatch');
    const raw={definition:clone(d),archived:old?.raw.archived??initialArchived};
    await storage.batch([{store:'characters',key:d.id,value:old?.raw},{store:'preferences',key:d.id,value:old?.prefs}],
      [{store:'characters',key:d.id,value:raw},{store:'preferences',key:d.id,value:clone(p)}]);
    return {...clone(raw),preferences:clone(p)};
  }
  return {
    get,save,
    async list({includeArchived=false}={}) {
      const rows=await storage.list('characters'),out=[];
      for(const row of rows) {const r=await get(row.key);check(r,'Concurrent library edit');if(includeArchived || !r.archived)out.push(r);}
      return out;
    },
    async duplicate(characterId) {const r=await get(characterId);check(r,'Unknown character');const d=clone(r.definition);d.id=newId();d.revision=1;return save(d,{prefs:{...r.preferences,characterId:d.id}});},
    async setPreferences(characterId,prefs) {
      preferences(prefs);check(prefs.characterId===characterId,'Preferences mismatch');const old=await read(characterId);check(old,'Unknown character');
      await storage.batch([{store:'characters',key:characterId,value:old.raw},{store:'preferences',key:characterId,value:old.prefs}],[{store:'preferences',key:characterId,value:clone(prefs)}]);
      return {...clone(old.raw),preferences:clone(prefs)};
    },
    async archive(characterId,archived=true) {
      check(typeof archived==='boolean','Archive flag');const old=await read(characterId);check(old,'Unknown character');
      await storage.batch([{store:'characters',key:characterId,value:old.raw}],[{store:'characters',key:characterId,value:{...old.raw,archived}}]);
    },
    async remove(characterId,{confirmId}={}) {
      check(confirmId===characterId,'Explicit delete confirmation required');const old=await read(characterId);check(old,'Unknown character');
      await storage.batch([{store:'characters',key:characterId,value:old.raw},{store:'preferences',key:characterId,value:old.prefs}],[{store:'characters',key:characterId,delete:true},{store:'preferences',key:characterId,delete:true}]);
    },
    async exportJSON(characterId) {const r=await get(characterId);check(r,'Unknown character');return JSON.stringify({kind:'pilot20-character-export',schemaVersion:2,...r});},
    async importJSON(raw) {
      check(typeof raw==='string' && raw.length<=2000000,'Import size');
      const e=JSON.parse(raw);json(e);check(e.kind==='pilot20-character-export' && [1,2].includes(e.schemaVersion),'Import envelope');
      const d=migrateCharacter(e.definition),p=preferences(e.preferences);
      check(!(await get(d.id)),'Import ID already exists');
      check(typeof e.archived==='boolean','Import archive flag');d.revision=1;return save(d,{prefs:p,initialArchived:e.archived});
    }
  };
}
