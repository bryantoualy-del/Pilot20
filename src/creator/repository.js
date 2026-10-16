import {check,json,id} from '../character/contracts.js';
import {StorageError} from '../persistence/adapters.js';
import {validateCharacter} from '../character/definition.js';
export function validateDraft(d){json(d);check(d?.kind==='pilot20-creator-draft'&&d.schemaVersion===1&&id(d.id)&&id(d.campaignId)&&Number.isSafeInteger(d.revision)&&d.revision>0,'Draft header');check(['quick','guided','expert'].includes(d.mode)&&typeof d.name==='string'&&d.name.length<=200&&Array.isArray(d.classes)&&d.classes.length<=20&&d.scores&&d.selections&&typeof d.portrait==='string'&&d.portrait.length<=10000,'Draft fields');return d;}
/** Drafts and UI preferences live in the existing meta store; writes retain CAS revision guards. */
export function creatorRepository(storage,library){
 const key=id=>'creator:draft:'+id;
 return {
  async list(){return (await storage.list('meta','creator:draft:')).map(r=>validateDraft(r.value));},
  async get(id){const r=await storage.get('meta',key(id));return r?validateDraft(r):null;},
  async save(d,{expectedRevision=null}={}){validateDraft(d);const old=await storage.get('meta',key(d.id));if(old?(old.revision!==expectedRevision||d.revision!==expectedRevision+1):(expectedRevision!==null||d.revision!==1))throw new StorageError('conflict');await storage.batch([{store:'meta',key:key(d.id),value:old}],[{store:'meta',key:key(d.id),value:d}]);return structuredClone(d);},
  async remove(id,revision){const old=await storage.get('meta',key(id));check(old?.revision===revision,'Draft revision conflict');await storage.batch([{store:'meta',key:key(id),value:old}],[{store:'meta',key:key(id),delete:true}]);},
  async duplicate(id){const d=await this.get(id);check(d,'Unknown draft');d.id=crypto.randomUUID();d.revision=1;d.name+=' (2)';d.finalized=false;await this.save(d);return d;},
  async export(id){const draft=await this.get(id),record=await library.get(id);check(draft||record,'Unknown character');return JSON.stringify({kind:'pilot20-creator-export',schemaVersion:1,draft,character:record?JSON.parse(await library.exportJSON(id)):null});},
  async import(raw){check(typeof raw==='string'&&raw.length<=4000000,'Import size');const e=JSON.parse(raw);json(e);check(e.kind==='pilot20-creator-export'&&e.schemaVersion===1,'Creator export required');const d=e.draft?validateDraft(e.draft):null;if(e.character)validateCharacter(e.character.definition);check(d||e.character,'Empty export');if(d&&e.character)check(d.id===e.character.definition.id,'Export identity');const cid=d?.id??e.character.definition.id;check(!(await this.get(cid))&&!(await library.get(cid)),'Import ID already exists');
   // Validate the complete envelope before any mutation. Library import retains its own CAS guards.
   if(e.character){check(e.character.kind==='pilot20-character-export'&&e.character.preferences?.characterId===cid&&typeof e.character.archived==='boolean','Character envelope');await library.importJSON(JSON.stringify(e.character));}
   if(d){d.revision=1;await this.save(d);}return cid;
  }
 };
}
