import {check,json,id,ABILITIES,SKILLS,preferences} from '../character/contracts.js';
import {StorageError} from '../persistence/adapters.js';
import {validateCharacter} from '../character/definition.js';
export function validateDraft(d){json(d);check(d?.kind==='pilot20-creator-draft'&&d.schemaVersion===1&&id(d.id)&&id(d.campaignId)&&Number.isSafeInteger(d.revision)&&d.revision>0,'Draft header');
 check(['quick','guided','expert'].includes(d.mode)&&typeof d.name==='string'&&d.name.length<=200&&Array.isArray(d.classes)&&d.classes.length>0&&d.classes.length<=20&&d.classes.every(c=>id(c.id)&&Number.isInteger(c.level)&&c.level>=1&&c.level<=20&&(c.subclassId===null||id(c.subclassId)))&&new Set(d.classes.map(c=>c.id)).size===d.classes.length&&d.classes.reduce((n,c)=>n+c.level,0)<=20,'Draft classes');
 check(d.scores&&ABILITIES.every(k=>Number.isInteger(d.scores[k])&&d.scores[k]>=1&&d.scores[k]<=30)&&d.selections&&Object.values(d.selections).every(v=>Array.isArray(v)&&v.every(id)),'Draft decisions');
 check(typeof d.portrait==='string'&&d.portrait.length<=10000&&(!d.portrait||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.portrait)),'Draft portrait');
 check(d.background&&typeof d.background.name==='string'&&Array.isArray(d.background.skills)&&d.background.skills.every(k=>Object.hasOwn(SKILLS,k))&&new Set(d.background.skills).size===d.background.skills.length&&Array.isArray(d.background.proficiencies)&&d.background.proficiencies.every(id),'Draft background');
 for(const k of ['origin','languages','traits','description','step'])check(typeof d[k]==='string'&&d[k].length<=5000,'Draft text');for(const k of ['reviewed','confirmed','finalized','shield'])check(typeof d[k]==='boolean','Draft flags');check(['none','leather','chain','scale'].includes(d.equipment)&&['draft','review','ready'].includes(d.status),'Draft equipment/status');return d;}
/** Drafts and UI preferences live in the existing meta store; writes retain CAS revision guards. */
export function creatorRepository(storage,library){
 const key=id=>'creator:draft:'+id;
 return {
  async list(){return (await storage.list('meta','creator:draft:')).map(r=>validateDraft(r.value));},
  async get(id){const r=await storage.get('meta',key(id));return r?validateDraft(r):null;},
  async save(d,{expectedRevision=null}={}){validateDraft(d);const old=await storage.get('meta',key(d.id));if(old?(old.revision!==expectedRevision||d.revision!==expectedRevision+1):(expectedRevision!==null||d.revision!==1))throw new StorageError('conflict');await storage.batch([{store:'meta',key:key(d.id),value:old}],[{store:'meta',key:key(d.id),value:d}]);return structuredClone(d);},
  async remove(id,revision){const old=await storage.get('meta',key(id));check(old?.revision===revision,'Draft revision conflict');await storage.batch([{store:'meta',key:key(id),value:old}],[{store:'meta',key:key(id),delete:true}]);},
  async finalize(d,character,{expectedCharacterRevision=null,expectedDraftRevision}={}){validateDraft(d);const old=await storage.get('meta',key(d.id));check(old?.revision===expectedDraftRevision,'Draft revision conflict');const next={...structuredClone(d),revision:old.revision+1,finalized:true};const result=await library.save(character,{expectedRevision:expectedCharacterRevision,linkedMeta:[{key:key(d.id),value:next,expectedValue:old}]});return {record:result,draft:next};},
  async duplicate(id){const d=await this.get(id);check(d,'Unknown draft');d.id=crypto.randomUUID();d.revision=1;d.name+=' (2)';d.finalized=false;await this.save(d);return d;},
  async export(id){const draft=await this.get(id),record=await library.get(id);check(draft||record,'Unknown character');return JSON.stringify({kind:'pilot20-creator-export',schemaVersion:1,draft,character:record?JSON.parse(await library.exportJSON(id)):null});},
  async import(raw){check(typeof raw==='string'&&raw.length<=4000000,'Import size');const e=JSON.parse(raw);json(e);check(e.kind==='pilot20-creator-export'&&e.schemaVersion===1,'Creator export required');const d=e.draft?validateDraft(e.draft):null;if(e.character)validateCharacter(e.character.definition);check(d||e.character,'Empty export');if(d&&e.character)check(d.id===e.character.definition.id,'Export identity');const cid=d?.id??e.character.definition.id;check(!(await this.get(cid))&&!(await library.get(cid)),'Import ID already exists');
   if(e.character){check(e.character.kind==='pilot20-character-export'&&e.character.preferences?.characterId===cid&&typeof e.character.archived==='boolean','Character envelope');preferences(e.character.preferences);const definition=structuredClone(e.character.definition);definition.revision=1;if(d)d.revision=1;await library.save(definition,{prefs:e.character.preferences,initialArchived:e.character.archived,linkedMeta:d?[{key:key(d.id),value:d,expectedValue:undefined}]:[]});}
   else if(d){d.revision=1;await this.save(d);}return cid;
  }
 };
}
