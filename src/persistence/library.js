import {check,id,integer,json,preferences,defaultPreferences} from '../character/contracts.js';
import {validateCharacter,migrateCharacter} from '../character/definition.js';
import {StorageError} from './adapters.js';
const clone=structuredClone;
function record(r) {
  check(r && typeof r.archived==='boolean','Corrupt character record');
  validateCharacter(r.definition);preferences(r.preferences);
  check(r.preferences.characterId===r.definition.id,'Preference identity');return r;
}
export function characterLibrary(storage,{newId=()=>globalThis.crypto.randomUUID()}={}) {
  async function get(characterId) {check(id(characterId),'Character ID');const r=await storage.get('characters',characterId);return r===undefined?null:clone(record(r));}
  async function save(d,{expectedRevision=null,prefs=defaultPreferences(d.id)}={}) {
    validateCharacter(d);preferences(prefs);check(prefs.characterId===d.id,'Preferences mismatch');
    const old=await storage.get('characters',d.id);
    if(old!==undefined) record(old);
    check(old===undefined?expectedRevision===null && d.revision===1:expectedRevision===old.definition.revision && d.revision===expectedRevision+1,'Revision conflict');
    const r={definition:clone(d),preferences:clone(prefs),archived:old?.archived||false};
    await storage.batch([{store:'characters',key:d.id,value:old}],[{store:'characters',key:d.id,value:r},{store:'preferences',key:d.id,value:clone(prefs)}]);
    return clone(r);
  }
  return {
    get,save,
    async list({includeArchived=false}={}) {const rows=await storage.list('characters');return rows.map(r=>clone(record(r.value))).filter(r=>includeArchived || !r.archived);},
    async duplicate(characterId) {const r=await get(characterId);check(r,'Unknown character');const d=clone(r.definition);d.id=newId();d.revision=1;const p={...r.preferences,characterId:d.id};return save(d,{prefs:p});},
    async setPreferences(characterId,prefs) {
      preferences(prefs);check(prefs.characterId===characterId,'Preferences mismatch');const r=await get(characterId);check(r,'Unknown character');
      const next={...r,preferences:clone(prefs)};
      await storage.batch([{store:'characters',key:characterId,value:r}],[{store:'characters',key:characterId,value:next},{store:'preferences',key:characterId,value:clone(prefs)}]);return next;
    },
    async archive(characterId,archived=true) {
      check(typeof archived==='boolean','Archive flag');const r=await get(characterId);check(r,'Unknown character');
      await storage.batch([{store:'characters',key:characterId,value:r}],[{store:'characters',key:characterId,value:{...r,archived}}]);
    },
    async remove(characterId,{confirmId}={}) {
      check(confirmId===characterId,'Explicit delete confirmation required');const r=await get(characterId);check(r,'Unknown character');
      await storage.batch([{store:'characters',key:characterId,value:r}],[{store:'characters',key:characterId,delete:true},{store:'preferences',key:characterId,delete:true}]);
    },
    async exportJSON(characterId) {const r=await get(characterId);check(r,'Unknown character');return JSON.stringify({kind:'pilot20-character-export',schemaVersion:2,...r});},
    async importJSON(raw) {
      check(typeof raw==='string' && raw.length<=2000000,'Import size');
      const e=JSON.parse(raw);json(e);check(e.kind==='pilot20-character-export' && [1,2].includes(e.schemaVersion),'Import envelope');
      const d=migrateCharacter(e.definition),p=preferences(e.preferences);
      check(!(await get(d.id)),'Import ID already exists');
      // Imported revision starts a new local lineage; original retained in the export.
      d.revision=1;return save(d,{prefs:p});
    }
  };
}
