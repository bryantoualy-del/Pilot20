import {validateReactiveRule} from '../rules/reactive.js';
import {validateCastingModifier} from '../rules/conditional.js';
import {validateRuleData} from './rules.js';
import {check,id,integer,keys,json,text,ids,source,ABILITIES,SKILLS} from './contracts.js';
export const SCHEMA_VERSION=2;
export function validateCharacter(d) {
  json(d);
  keys(d,['kind','schemaVersion','ruleset','id','revision','identity','ancestry','classes','background','alignment','scores','skills','saveProficiencies','proficiencies','features','equipment','spells','progression','choices','choiceRules','resources','abilities','modifiers','defenses','movement','armorRules','buildRules','reactiveRules','castingModifiers'],['kind','schemaVersion','ruleset','id','revision','identity','ancestry','classes','background','alignment','scores','skills','saveProficiencies','proficiencies','features','equipment','spells','progression','choices','choiceRules','resources','abilities','modifiers','defenses','movement','armorRules','buildRules']);
  if(d.reactiveRules!==undefined) {check(Array.isArray(d.reactiveRules) && d.reactiveRules.length<=50,'Reactive character rules');ids(d.reactiveRules.map(r=>r.id));d.reactiveRules.forEach(validateReactiveRule);}
  if(d.castingModifiers!==undefined) {check(Array.isArray(d.castingModifiers) && d.castingModifiers.length<=20,'Character casting modifiers');ids(d.castingModifiers.map(r=>r.id));d.castingModifiers.forEach(validateCastingModifier);}
  check(d.kind==='character' && d.schemaVersion===2 && d.ruleset==='dnd5e-2014' && id(d.id) && integer(d.revision,1),'Character header');
  keys(d.identity,['name','portrait','description','gender'],['name','portrait','description']);if(d.identity.gender!==undefined)check(['','femme','homme'].includes(d.identity.gender),'Identity gender'); check(text(d.identity.name) && d.identity.name.trim() && text(d.identity.portrait) && text(d.identity.description),'Identity');
  keys(d.ancestry,['id','subraceId','source','size','creatureType'],['id','subraceId','source']); check(id(d.ancestry.id) && (d.ancestry.subraceId===null || id(d.ancestry.subraceId)),'Ancestry');source(d.ancestry.source);
  if(d.ancestry.size!==undefined)check(['small','medium'].includes(d.ancestry.size),'Ancestry size');if(d.ancestry.creatureType!==undefined)check(['humanoid','fey','construct','undead'].includes(d.ancestry.creatureType),'Ancestry creature type');
  check(text(d.background) && (d.alignment===null || text(d.alignment)),'Background');
  keys(d.scores,ABILITIES);check(ABILITIES.every(k=>integer(d.scores[k],1,30)),'Ability scores');
  check(Array.isArray(d.classes) && d.classes.length>0,'Classes');
  ids(d.classes.map(c=>c.id));
  for(const c of d.classes) {
    keys(c,['id','level','subclassId','hitDie','casting','source']);
    check(id(c.id) && integer(c.level,1,20) && [6,8,10,12].includes(c.hitDie) && (c.subclassId===null || id(c.subclassId)),'Class');
    source(c.source);
    if(c.casting!==null) {keys(c.casting,['ability','progression','multiclassRounding','startsAtClassLevel','preparation'],['ability','progression']);if(c.casting.preparation!==undefined)check(['ability-plus-level','ability-plus-half-level'].includes(c.casting.preparation),'Preparation policy');if(c.casting.multiclassRounding!==undefined)check(['floor','ceil'].includes(c.casting.multiclassRounding),'Casting contribution rounding');if(c.casting.startsAtClassLevel!==undefined)check(integer(c.casting.startsAtClassLevel,1,3),'Casting start level');check(ABILITIES.includes(c.casting.ability) && ['full','half','third','pact'].includes(c.casting.progression),'Casting');}
  }
  const level=d.classes.reduce((n,c)=>n+c.level,0);check(level<=20,'Total level');
  check(Object.keys(d.skills).every(k=>Object.hasOwn(SKILLS,k)) && Object.values(d.skills).every(v=>[0,1,2].includes(v)),'Skill ranks');
  ids(d.saveProficiencies);check(d.saveProficiencies.every(k=>ABILITIES.includes(k)),'Save proficiencies');
  ids(d.proficiencies);ids(d.features);
  check(Array.isArray(d.equipment),'Equipment');
  ids(d.equipment.map(e=>e.id));
  for(const e of d.equipment) {
    keys(e,['id','kind','equipped','source','armor','weapon','name','quantity'],['id','kind','equipped','source','armor','weapon']);
    if(e.name!==undefined){keys(e.name,['fr','en']);check(Object.values(e.name).every(v=>text(v)&&v.trim()),'Equipment names');}
    if(e.quantity!==undefined)check(integer(e.quantity,1,10000),'Equipment quantity');
    check(id(e.id) && ['weapon','armor','shield','item'].includes(e.kind) && typeof e.equipped==='boolean','Equipment item');source(e.source);
    if(e.armor!==null) {keys(e.armor,['base','dexCap','bonus','minStrength','heavy']);check(integer(e.armor.base,0,30) && (e.armor.dexCap===null || integer(e.armor.dexCap,0,10)) && integer(e.armor.bonus,-5,10) && integer(e.armor.minStrength,0,30) && typeof e.armor.heavy==='boolean','Armor');}
    if(e.weapon!==null) {keys(e.weapon,['ability','proficient','bonus','dice','damageType']);check(ABILITIES.includes(e.weapon.ability) && typeof e.weapon.proficient==='boolean' && integer(e.weapon.bonus,-5,10) && text(e.weapon.dice) && id(e.weapon.damageType),'Weapon');}
    check((e.kind==='weapon')===(e.weapon!==null) && (['armor','shield'].includes(e.kind))===(e.armor!==null),'Equipment profile mismatch');
  }
  keys(d.spells,['known','prepared']);ids(d.spells.known);ids(d.spells.prepared);
  check(Array.isArray(d.progression) && d.progression.length<=20,'Progression');
  for(const p of d.progression) {keys(p,['classId','hp']);check(d.classes.some(c=>c.id===p.classId) && integer(p.hp,1,12),'HP progression');}
  check(Array.isArray(d.choices) && Array.isArray(d.choiceRules),'Choices');
  ids(d.choices.map(c=>c.id));ids(d.choiceRules.map(c=>c.id));
  for(const c of d.choices) {keys(c,['id','level','optionIds','note']);check(id(c.id) && integer(c.level,1,20) && text(c.note),'Choice');ids(c.optionIds);}
  for(const r of d.choiceRules) {
    keys(r,['id','level','count','options','requires','incompatible','minimumCount'],['id','level','count','options','requires','incompatible']);
    if(r.minimumCount!==undefined)check(integer(r.minimumCount,0,r.count),'Minimum choices');
    check(id(r.id) && integer(r.level,1,20) && integer(r.count,1,20),'Choice rule');ids(r.options);ids(r.requires);ids(r.incompatible);
  }
  check(Array.isArray(d.resources) && Array.isArray(d.abilities) && Array.isArray(d.modifiers),'Rule arrays');
  ids(d.resources.map(r=>r.id));ids(d.abilities.map(a=>a.id));ids(d.modifiers.map(m=>m.id));
  keys(d.defenses,['resistances','immunities','vulnerabilities']);for(const v of Object.values(d.defenses)) ids(v);
  keys(d.movement,['walk','ignoreHeavyPenalty','climb','swim','fly','climbMatchesWalk'],['walk','ignoreHeavyPenalty']);check(integer(d.movement.walk,0,200) && typeof d.movement.ignoreHeavyPenalty==='boolean','Movement');
  for(const key of ['climb','swim','fly'])if(d.movement[key]!==undefined)check(integer(d.movement[key],0,200),'Movement mode');if(d.movement.climbMatchesWalk!==undefined)check(typeof d.movement.climbMatchesWalk==='boolean','Climb speed policy');
  check(Array.isArray(d.armorRules),'Armor rules');
  for(const a of d.armorRules) {keys(a,['id','base','abilities','shieldAllowed','source']);check(id(a.id) && integer(a.base,0,30) && typeof a.shieldAllowed==='boolean','AC rule');ids(a.abilities);check(a.abilities.every(k=>ABILITIES.includes(k)),'AC abilities');source(a.source);}
  check(Array.isArray(d.buildRules),'Build requirements');ids(d.buildRules.map(r=>r.id));
  for(const r of d.buildRules) {
    keys(r,['id','when','anyOf']);check(id(r.id) && ['always','multiclass'].includes(r.when) && Array.isArray(r.anyOf) && r.anyOf.length>0,'Prerequisite rule');
    for(const all of r.anyOf) {check(Array.isArray(all) && all.length>0,'Prerequisite conjunction');for(const clause of all) {keys(clause,['score','minimum']);check(ABILITIES.includes(clause.score) && integer(clause.minimum,1,30),'Score prerequisite');}}
  }
  validateRuleData(d);
  return d;
}
/** Incomplete construction is valid data; it is not playable until build diagnostics pass. */
export function validateBuild(d) {
  validateCharacter(d);
  const issues=[],level=d.classes.reduce((n,c)=>n+c.level,0), add=(code,path)=>issues.push({code,path});
  if(d.progression.length!==level) add('missing-progression','progression');
  const counts={};
  d.progression.forEach((p,i)=>{
    const c=d.classes.find(c=>c.id===p.classId);
    counts[c.id]=(counts[c.id]||0)+1;
    if(p.hp>c.hitDie || (i===0 && p.hp!==c.hitDie)) add('invalid-hit-die','progression.'+i);
  });
  for(const c of d.classes) if(counts[c.id]!==c.level) add('class-level-mismatch','classes.'+c.id);
  for(const r of d.buildRules) if(r.when==='always' || d.classes.length>1) {
    if(!r.anyOf.some(all=>all.every(c=>d.scores[c.score]>=c.minimum))) add('score-prerequisite','buildRules.'+r.id);
  }
  const selected=new Set(d.choices.flatMap(c=>c.optionIds));
  for(const r of d.choiceRules) {
    if(r.level>level) continue;
    const c=d.choices.find(c=>c.id===r.id);
    if(!c || c.optionIds.length<(r.minimumCount??r.count)||c.optionIds.length>r.count) add('required-choice','choices.'+r.id);
    else if(c.level!==r.level || c.optionIds.some(k=>!r.options.includes(k))) add('invalid-choice','choices.'+r.id);
    if(c && r.requires.some(k=>!selected.has(k))) add('prerequisite','choices.'+r.id);
    if(c && r.incompatible.some(k=>selected.has(k))) add('incompatible','choices.'+r.id);
  }
  for(const c of d.choices) if(!d.choiceRules.some(r=>r.id===c.id) || c.level>level) add('unknown-choice','choices.'+c.id);
  for(const s of d.spells.prepared) if(!d.spells.known.includes(s)) add('spell-not-known','spells.prepared');
  const armor=d.equipment.filter(e=>e.equipped && e.kind==='armor'),shields=d.equipment.filter(e=>e.equipped && e.kind==='shield');
  if(armor.length>1 || shields.length>1) add('equipment-conflict','equipment');
  return {valid:issues.length===0,issues};
}
/** Only the documented early Pilot20 character v1 prototype, never a Companion or combat save. */
export function migrateCharacter(input) {
  json(input);const d=structuredClone(input);
  if(d.kind==='character' && d.schemaVersion===1) {check(!Object.hasOwn(d,'revision'),'Ambiguous migration');d.schemaVersion=2;d.revision=1;}
  return validateCharacter(d);
}
