import {HANDLERS} from './handlers.js';
/** Inert, versioned, modular catalogue. Legacy v2 remains in validate.js. */
import {check,keys,id,json,source,integer,ABILITIES,SKILLS} from '../character/contracts.js';
const TYPES=['class','subclass','feature','spell','resource','choice','prerequisite','progression','effect','source','feat'];
const STATUSES=['automated','partial','manual','unsupported'];
const list=(v,label)=>check(Array.isArray(v)&&v.every(id)&&new Set(v).size===v.length,label);
export function validateCatalogV3(c,{distribution='private'}={}) {
 json(c);keys(c,['kind','schemaVersion','ruleset','id','items']);
 check(c.kind==='catalog'&&c.schemaVersion===3&&c.ruleset==='dnd5e-2014'&&id(c.id)&&Array.isArray(c.items)&&c.items.length<=10000,'Catalog v3 header');
 list(c.items.map(i=>i.id),'Duplicate catalogue ID');
 for(const i of c.items) {
  keys(i,['id','type','name','source','data']);source(i.source);keys(i.name,['en','fr']);
  check(id(i.id)&&TYPES.includes(i.type)&&Object.values(i.name).every(n=>typeof n==='string'&&n.trim()&&n.length<=200),'Entry identity');
  check(distribution!=='public'||i.source.kind!=='private','Private content cannot be distributed');
  check(i.data&&i.data.ruleset===c.ruleset,'Entry ruleset');
  const a=i.data.automation;keys(a,['status','handler','limits']);
  check(STATUSES.includes(a.status)&&(a.handler===null||id(a.handler))&&Array.isArray(a.limits)&&a.limits.every(x=>typeof x==='string'&&x.trim()),'Automation metadata');
  check(a.handler===null||HANDLERS[a.handler]?.includes(i.id),'Unknown or mismatched executable handler');
  check(a.status!=='automated'||(a.handler!==null&&a.limits.length===0),'Automated entry needs executable handler');
  check(a.status!=='unsupported'||a.limits.length>0,'Unsupported reason');
  const d=i.data;
  for(const field of ['aliases','reviewNotes'])if(d[field]!==undefined)check(Array.isArray(d[field])&&d[field].length<=100&&d[field].every(v=>typeof v==='string'&&v.length<=2000),'Safe display metadata');
  if(d.incompatible!==undefined)list(d.incompatible,'Incompatible entries');
  if(i.type==='class') {
   check(id(d.classId)&&[6,8,10,12].includes(d.hitDie),'Class identity');
   list(d.saves,'Class saves');check(d.saves.length===2&&d.saves.every(s=>ABILITIES.includes(s)),'Class saves');
   check(integer(d.skillChoice?.count,1,18),'Skill choice count');list(d.skillChoice.options,'Skill options');check(d.skillChoice.options.every(k=>Object.hasOwn(SKILLS,k))&&d.skillChoice.count<=d.skillChoice.options.length,'Skill options');
   if(d.casting!==null) {keys(d.casting,['ability','progression','multiclassRounding','startsAtClassLevel','preparation'],['ability','progression']);if(d.casting.preparation!==undefined)check(['ability-plus-level','ability-plus-half-level'].includes(d.casting.preparation),'Preparation policy');if(d.casting.multiclassRounding!==undefined)check(['floor','ceil'].includes(d.casting.multiclassRounding),'Casting contribution rounding');if(d.casting.startsAtClassLevel!==undefined)check(integer(d.casting.startsAtClassLevel,1,3),'Casting start level');check(ABILITIES.includes(d.casting.ability)&&['full','half','third','pact'].includes(d.casting.progression),'Class casting');}
   check(integer(d.subclassLevel,1,20),'Subclass level');list(d.subclassIds,'Subclass IDs');
   for(const field of ['initialProficiencies','multiclassProficiencies'])list(d[field],'Class proficiencies');
   for(const field of ['cantripsKnown','spellsKnown'])check(d[field]?.length===20&&d[field].every(n=>integer(n,0,100)),'Known progression');
   check(Array.isArray(d.multiclassPrerequisites)&&d.multiclassPrerequisites.length>0&&d.multiclassPrerequisites.every(all=>Array.isArray(all)&&all.length>0&&all.every(p=>ABILITIES.includes(p.score)&&integer(p.minimum,1,30))),'Multiclass requirements');
   check(Array.isArray(d.resources)&&Array.isArray(d.choices),'Class resources/choices');
   list(d.resources.map(r=>r.id),'Duplicate resource');list(d.choices.map(r=>r.key),'Duplicate choice');
   for(const r of d.resources){check(['short','long','none'].includes(r.recovery)&&r.maxByLevel?.length===20,'Resource progression');for(const v of r.maxByLevel)check(v===null||integer(v,0,1000)||(v&&ABILITIES.includes(v.ability)&&integer(v.minimum,0,30)&&(v.add===undefined||integer(v.add,0,30))),'Resource maximum');}
   for(const q of d.choices){check(integer(q.level,1,20)&&integer(q.count,1,100)&&['feature','asi','skill','proficiency','expertise','spell','spell-mastery','signature-spell','ritual-spell'].includes(q.kind),'Choice contract');list(q.options,'Choice options');if(q.requiresChoice){keys(q.requiresChoice,['key','optionId']);check(id(q.requiresChoice.key)&&id(q.requiresChoice.optionId),'Conditional choice');}if(q.distinctGroup!==undefined)check(id(q.distinctGroup),'Choice distinct group');if(q.adjudication!==undefined)check(typeof q.adjudication==='string'&&q.adjudication.trim(),'Choice adjudication');if(q.countByLevel)check(q.countByLevel.length===20&&q.countByLevel.every(n=>integer(n,0,100)),'Choice progression');}
   for(const table of Object.values(d.scaling??{}))check(Array.isArray(table)&&table.length===20&&table.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0),'Scaling table');
   check(d.grants?.length===20&&d.grants.every((r,i)=>r.level===i+1),'Complete progression');
  }
  if(['class','subclass'].includes(i.type)) {
   check(id(d.classId)&&Array.isArray(d.grants),'Grant owner');
   for(const r of d.grants) {keys(r,['level','featureIds']);check(integer(r.level,1,20),'Grant level');list(r.featureIds,'Grant features');}
   check(new Set(d.grants.map(r=>r.level)).size===d.grants.length,'Duplicate progression level');
  }
  if(i.type!=='class'&&d.choices!==undefined){check(Array.isArray(d.choices),'Extension choices');list(d.choices.map(q=>q.key),'Duplicate extension choice');for(const q of d.choices){check(integer(q.level,1,20)&&integer(q.count,1,100)&&['feature','asi','skill','proficiency','expertise','spell','spell-mastery','signature-spell','ritual-spell'].includes(q.kind),'Extension choice contract');list(q.options,'Extension choice options');}}
  if(i.type==='feature')check(id(d.classId)&&integer(d.minimumClassLevel,1,20),'Feature availability');
  if(i.type==='spell') {
   check(integer(d.level,0,9)&&['abjuration','conjuration','divination','enchantment','evocation','illusion','necromancy','transmutation'].includes(d.school),'Spell level/school');
   list(d.classIds,'Spell classes');check(d.classIds.length>0,'Spell class access');
   for(const f of ['castingTime','range','components','duration','description'])check(typeof d[f]==='string'&&d[f].trim(),'Spell '+f);
   check(typeof d.concentration==='boolean'&&typeof d.ritual==='boolean','Spell flags');
  }
  if(d.manualMechanics){const m=d.manualMechanics;keys(m,['economy','target','maxTargets','resourceId','amount','requirements','concentration'],['economy','target','maxTargets','resourceId','amount','requirements']);check(['action','bonus','reaction','none'].includes(m.economy)&&['self','selected'].includes(m.target)&&integer(m.maxTargets,1,20)&&id(m.resourceId)&&integer(m.amount,1,100),'Manual mechanics');check(Array.isArray(m.requirements)&&m.requirements.every(v=>typeof v==='string'&&v.trim()),'Manual requirements');if(m.concentration!==undefined)check(typeof m.concentration==='boolean','Manual concentration');}
  if(d.resources)for(const r of d.resources){check(id(r.id)&&['short','long','none'].includes(r.recovery)&&r.maxByLevel?.length===20,'Resource owner contract');for(const v of r.maxByLevel)check(v===null||integer(v,0,1000)||(v&&ABILITIES.includes(v.ability)&&integer(v.minimum,0,30)&&(v.add===undefined||integer(v.add,0,30))),'Resource maximum');if(r.recharge){keys(r.recharge,['kind','failure','successDays','intervalDays'],['kind']);check(r.recovery==='none'&&r.recharge.kind==='adjudicated-calendar','Calendar recovery must stay explicit');if(r.recharge.failure!==undefined)check(r.recharge.failure==='long-rest','Calendar failure policy');for(const field of ['successDays','intervalDays'])if(r.recharge[field]!==undefined)check(integer(r.recharge[field],1,365),'Calendar interval');}}
  if(d.optionalClassFeature!==undefined)check(i.type==='feature'&&d.optionalClassFeature===true&&id(d.campaignOption),'Optional feature requires explicit campaign option');
  for(const k of ['suppressesChoices','suppressesResources'])if(d[k]!==undefined)list(d[k],'Suppression references');
  if(d.requires!==undefined)list(d.requires,'Entry dependencies');
  if(d.replaces!==undefined)list(d.replaces,'Replaced entries');
  if(d.campaignOption!==undefined)check(id(d.campaignOption),'Campaign option');
 }
 return c;
}
/** Sources/options default off for private packs; no implicit override or executable pack code. */
export function createCatalogIndex(packs,{distribution='private',enabledPackIds=[],enabledOptions=[]}={}) {
 check(Array.isArray(packs)&&packs.length<=100,'Pack limit');list(enabledPackIds,'Enabled packs');list(enabledOptions,'Enabled options');
 const entries=new Map(),packIds=new Set();
 for(const p of packs) {
  validateCatalogV3(p,{distribution});check(!packIds.has(p.id),'Duplicate pack ID');packIds.add(p.id);
  if(p.items.some(i=>i.source.kind!=='srd')&&!enabledPackIds.includes(p.id))continue;
  for(const i of p.items) {
   if(i.data.campaignOption&&!enabledOptions.includes(i.data.campaignOption))continue;
   check(!entries.has(i.id),'Catalogue collision: '+i.id);entries.set(i.id,structuredClone(i));
  }
 }
 const classes=new Map([...entries.values()].filter(i=>i.type==='class').map(i=>[i.data.classId,i]));
 check(classes.size===[...entries.values()].filter(i=>i.type==='class').length,'Duplicate class key');
 for(const i of entries.values()) {
  const d=i.data;
  for(const field of ['aliases','reviewNotes'])if(d[field]!==undefined)check(Array.isArray(d[field])&&d[field].length<=100&&d[field].every(v=>typeof v==='string'&&v.length<=2000),'Safe display metadata');
  if(d.incompatible!==undefined)list(d.incompatible,'Incompatible entries');
  if(['feature','subclass'].includes(i.type))check(classes.has(d.classId),'Missing class: '+d.classId);
  for(const cls of d.classIds??[])check(classes.has(cls),'Missing spell class: '+cls);
  for(const sid of d.subclassIds??[])check(entries.get(sid)?.type==='subclass'&&entries.get(sid).data.classId===d.classId,'Subclass reference');
  for(const row of d.grants??[])for(const fid of row.featureIds)check(entries.get(fid)?.type==='feature'&&entries.get(fid).data.classId===d.classId,'Feature reference: '+fid);
  for(const q of d.choices??[]) {
   if(q.subclassId)check(entries.get(q.subclassId)?.type==='subclass','Choice subclass reference');
   if(q.requiresSelected)check(entries.has(q.requiresSelected),'Choice prerequisite reference');
   if(q.kind==='feature')for(const ref of q.options)check(entries.get(ref)?.type==='feature','Choice feature reference');
   if(['spell','spell-mastery','signature-spell','ritual-spell'].includes(q.kind))for(const ref of q.options)check(entries.get(ref)?.type==='spell','Choice spell reference');
  }
  for(const row of d.extraSpells??[]) {check(integer(row.classLevel,1,20)&&['prepared','expanded'].includes(row.mode),'Extra spell grant');list(row.spellIds,'Extra spells');for(const ref of row.spellIds)check(entries.get(ref)?.type==='spell','Extra spell reference');}
  for(const ref of [...(d.requires??[]),...(d.replaces??[]),...(d.incompatible??[])])check(entries.has(ref),'Missing reference: '+ref);
 }
 const visiting=new Set(),visited=new Set();
 function visit(key,depth=0) {
  check(depth<100,'Catalogue dependency depth');check(!visiting.has(key),'Catalogue dependency cycle');if(visited.has(key))return;
  visiting.add(key);for(const ref of [...(entries.get(key).data.requires??[]),...(entries.get(key).data.replaces??[])])visit(ref,depth+1);visiting.delete(key);visited.add(key);
 }
 for(const key of entries.keys())visit(key);
 // Do not expose mutable cached definitions or mutable Map internals.
 return Object.freeze({get:key=>structuredClone(entries.get(key)),list:type=>[...entries.values()].filter(i=>!type||i.type===type).map(i=>structuredClone(i)),class:cls=>structuredClone(classes.get(cls)),size:entries.size});
}
