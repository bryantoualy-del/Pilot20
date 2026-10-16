/** V0.2b contracts: JSON data, never executable expressions or callbacks. */
import {check,keys,integer,id,json,source,text} from '../character/contracts.js';
export const PRIMITIVES = Object.freeze({
  damage:'automated', healing:'automated', temporaryHP:'automated', resourceChange:'manual',
  savingThrow:'automated', spellCast:'automated', modifier:'automated', condition:'automated',
  duration:'automated', concentration:'automated', extraAction:'automated', movement:'automated',
  removeEffect:'automated', transformation:'unsupported', summon:'unsupported', reactionWindow:'automated',
  triggeredEffect:'partial', decision:'automated', choice:'automated', zone:'unsupported', aura:'unsupported', postHitResource:'automated', oncePerTurn:'automated', damageInterception:'automated', transferredResource:'automated', conditionalModifier:'automated', castingModifier:'automated'
});
export function validateDecision(d) {
  json(d);keys(d,d.version===2?['version','id','eventId','actorId','revision','status','options','continuation','policy','ruleId','phase','validationRequired']:['version','id','eventId','actorId','revision','status','options','continuation','policy'],d.version===2?['version','id','eventId','actorId','revision','status','options','continuation','policy','ruleId','phase']:['version','id','eventId','actorId','revision','status','options','continuation','policy']);
  check([1,2].includes(d.version) && id(d.id) && id(d.eventId) && id(d.actorId) && integer(d.revision),'Decision header');
  check(['pending','resolved','declined','cancelled'].includes(d.status),'Decision status');
  check(d.policy==='block-dependent-resolution','Deferred decision policy');
  check(Array.isArray(d.options) && d.options.length>0 && new Set(d.options.map(o=>o.id)).size===d.options.length,'Decision options');
  for(const o of d.options) {keys(o,['id','label','costs']);check(id(o.id) && text(o.label) && o.label.trim(),'Decision option');costs(o.costs);}
  keys(d.continuation,['eventId','phase']);check(d.continuation.eventId===d.eventId && ['before-hit','after-hit','after-save','after-damage','cast','after-roll','before-damage'].includes(d.continuation.phase),'Decision continuation');
  if(d.validationRequired!==undefined)check(Array.isArray(d.validationRequired) && d.validationRequired.every(k=>typeof k==='string' && k.startsWith('external.')),'External decision requirements');
  if(d.version===2) check(id(d.ruleId) && d.phase===d.continuation.phase,'Decision v2 rule/phase');
  return d;
}
export function costs(list) {
  check(Array.isArray(list) && new Set(list.map(c=>c.resourceId)).size===list.length,'Unique resource costs');
  for(const c of list) {keys(c,['resourceId','amount']);check(id(c.resourceId) && integer(c.amount,1),'Resource cost');}
}
export function validateTransformation(t) {
  json(t);keys(t,['version','id','profileId','retained','hpPolicy','overflow','casting','concentration','reversion','execution']);
  check(t.version===1 && id(t.id) && id(t.profileId) && t.execution==='unsupported','Transformation is contract only');
  check(Array.isArray(t.retained) && t.retained.every(v=>['int','wis','cha','proficiencies','features'].includes(v)) && new Set(t.retained).size===t.retained.length,'Retained statistics');
  check(t.hpPolicy==='separate-pool' && t.overflow==='original-form' && ['blocked','profile-defined'].includes(t.casting) && t.concentration==='retain-existing','Transformation policies');
  check(Array.isArray(t.reversion) && t.reversion.length>0 && t.reversion.every(v=>['zero-hp','duration','voluntary','unconscious','death'].includes(v)),'Reversion events');return t;
}
export function validateTrigger(t) {
  json(t);keys(t,['version','event','scope','limit','whileEffect']);
  check(t.version===1 && ['attack-hit','damage-taken','turn-start','turn-end','save-resolved','ally-attacks','zone-enter','spell-cast','attack-roll','ability-targeted','roll-made'].includes(t.event),'Trigger event');
  check(['self','ally','target','any'].includes(t.scope) && ['none','turn','round','short-rest','long-rest'].includes(t.limit),'Trigger scope');
  check(t.whileEffect===null || id(t.whileEffect),'Trigger dependency');return t;
}
export function validateCoverageRule(r) {
  json(r);keys(r,['version','mode','primitives','requirements']);
  check(r.version===1 && ['referenced','manual','automatic'].includes(r.mode),'Coverage rule');
  check(Array.isArray(r.primitives) && r.primitives.every(p=>Object.hasOwn(PRIMITIVES,p)) && new Set(r.primitives).size===r.primitives.length,'Known primitives');
  check(Array.isArray(r.requirements) && r.requirements.every(t=>text(t) && t.trim()),'Unresolved requirements');return r;
}
/** A partial rule is NEVER automatically executable as a stripped subset. */
export function coverage(r, registry=PRIMITIVES) {
  validateCoverageRule(r);
  const missing=r.primitives.filter(p=>registry[p]!=='automated');
  if(r.mode==='referenced') return {status:'referenced',executable:false,missing};
  if(r.mode==='manual') return {status:'manual',executable:false,missing};
  if(r.requirements.length) return {status:'unsupported',executable:false,missing,requirements:[...r.requirements]};
  if(missing.length) return {status:missing.length<r.primitives.length?'partial':'unsupported',executable:false,missing};
  return {status:r.primitives.length?'automated':'unsupported',executable:r.primitives.length>0,missing};
}
export function validateCatalogPack(p,{distribution='private'}={}) {
  json(p);keys(p,['kind','schemaVersion','ruleset','id','version','items']);
  check(p.kind==='rules-catalog' && p.schemaVersion===1 && p.ruleset==='dnd5e-2014' && id(p.id) && integer(p.version,1),'Catalog pack');
  check(Array.isArray(p.items) && new Set(p.items.map(i=>i.id)).size===p.items.length,'Unique catalog items');
  for(const i of p.items) {
    keys(i,['id','type','version','source','references','rules','mechanics']);source(i.source);
    check(id(i.id) && integer(i.version,1) && ['class','subclass','progression','trait','feat','spell','equipment','condition','creature','transformation','ability'].includes(i.type),'Content identity');
    check(Array.isArray(i.references) && i.references.every(text),'Content references');validateCoverageRule(i.rules);
    check(i.mechanics && typeof i.mechanics==='object' && !Array.isArray(i.mechanics),'Inert mechanical data');
    if(distribution==='public') check(i.source.kind==='srd' || (i.source.kind==='homebrew' && i.source.license==='CC-BY-4.0'),'Public redistribution license not established');
  }
  return p;
}
export function importCatalogPack(raw,options) {check(typeof raw==='string' && raw.length<=10000000,'Catalog import size');return validateCatalogPack(JSON.parse(raw),options);}
