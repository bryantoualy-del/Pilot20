import {prepareForgeActor} from '../forge/loadout.js';
import {advanced} from '../rules/combat.js';
import {createSession,validate,validateDefinition,migrate} from '../model.js';
import {execute} from '../engine.js';
import {check,id,integer,keys,json} from './contracts.js';
import {derive} from './derive.js';
/** A session pins revisions; changing a library definition never mutates an actor. */
export function createCombat(sessionId,participants,{authority='local'}={}) {
  check(id(sessionId) && ['local','free','encounter'].includes(authority),'Session header');
  check(Array.isArray(participants) && participants.length>0 && participants.length<=100 && new Set(participants.map(p=>p.instanceId)).size===participants.length,'Participants');
  const prepared=new Map();
  const refs={},defs=participants.map(p=>{
    check(id(p.instanceId),'Participant ID');
    const d=p.character,s=derive(d);
    refs[p.instanceId]={characterId:d.id,definitionRevision:d.revision};
    const base=validateDefinition({id:p.instanceId,name:d.identity.name,level:s.level,maxHp:s.maxHp,ac:s.ac,speed:s.speed,attacksPerAction:s.attacksPerAction,saves:s.saves,resources:s.resources,abilities:s.abilities,...(s.reactiveRules.length?{rules:s.reactiveRules}:{}),...(s.castingModifiers.length?{castingModifiers:s.castingModifiers}:{}),...structuredClone(d.defenses)});
    if(!p.forgeItems?.length)return base;
    check(p.forgeBaseStatistics===true,'Forge requires item-free base statistics');
    const gear=prepareForgeActor(base,p.forgeItems,{scores:Object.fromEntries(Object.entries(d.scores).map(([k,v])=>[k,v+2*(s.modifiers[k]-Math.floor((v-10)/2))])),proficiencies:d.proficiencies,level:s.level,...p.forgeContext});prepared.set(p.instanceId,gear);return gear.definition;
  });
  const engine=createSession(defs);engine.mode=authority;
  for(const [key,gear] of prepared){Object.assign(engine.actors[key].resources,gear.resources);advanced(engine.actors[key]).forms=gear.forms;}
  return validateCombat({kind:'combat',schemaVersion:2,id:sessionId,participants:refs,engine,initiative:[],targets:[]});
}
export function validateCombat(s) {
  json(s);keys(s,['kind','schemaVersion','id','participants','engine','initiative','targets']);
  check(s.kind==='combat' && s.schemaVersion===2 && id(s.id),'Combat header');validate(s.engine);
  check(Object.keys(s.participants).length===Object.keys(s.engine.actors).length,'Participant count');
  for(const [k,p] of Object.entries(s.participants)) {keys(p,['characterId','definitionRevision']);check(Object.hasOwn(s.engine.actors,k) && id(p.characterId) && integer(p.definitionRevision,1),'Participant reference');}
  check(Array.isArray(s.initiative) && new Set(s.initiative.map(i=>i.instanceId)).size===s.initiative.length,'Initiative');
  for(const i of s.initiative) {keys(i,['instanceId','total']);check(Object.hasOwn(s.participants,i.instanceId) && integer(i.total,-100,100),'Initiative row');}
  check(Array.isArray(s.targets) && s.targets.every(k=>Object.hasOwn(s.participants,k)) && new Set(s.targets).size===s.targets.length,'Targets');
  return s;
}
export function executeCombat(input,command,context={}) {
  validateCombat(input);
  const result=execute(input.engine,command,context);
  return {...result,state:validateCombat({...structuredClone(input),engine:result.state})};
}
/** Runtime contract is the exact V0.1 actor minus its pinned mechanical definition. */
export function runtimeOf(s,instanceId) {
  validateCombat(s);check(Object.hasOwn(s.engine.actors,instanceId),'Unknown participant');
  const {definition,...runtime}=s.engine.actors[instanceId];
  return {kind:'runtime',schemaVersion:2,sessionId:s.id,instanceId,characterId:s.participants[instanceId].characterId,definitionRevision:s.participants[instanceId].definitionRevision,...structuredClone(runtime)};
}

/** Explicit legacy bridge requires caller-resolved character identities; no guessed permanent sheet. */
export function migrateLegacyCombat(sessionId,input,characterRefs) {
  const engine=migrate(input);
  return validateCombat({kind:'combat',schemaVersion:2,id:sessionId,participants:structuredClone(characterRefs),engine,initiative:[],targets:[]});
}
