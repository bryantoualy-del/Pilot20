import {validateCastingModifier} from './rules/conditional.js';
import {validateReactive,validateReactiveRule} from './rules/reactive.js';
import {validateProfile,validateAdvanced} from './rules/combat.js';
/** Portable, JSON-only domain model. All external data crosses this validator. */
export const VERSION = 1;
export const copy = value => structuredClone(value);
export function requireThat(ok, message) { if (!ok) throw new Error(message); }
export const integer = (v, min = 0, max = 1000000) => Number.isSafeInteger(v) && v >= min && v <= max;
export const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const id = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,119}$/.test(v) && !['__proto__','constructor','prototype'].includes(v);
const costs = ['action','bonus','reaction','none'];
export function diceSpec(formula) {
  const match = /^(\d{1,2})d(\d{1,3})([+-]\d{1,4})?$/.exec(formula);
  requireThat(match, 'Invalid dice formula');
  const [, n, sides, bonus = 0] = match;
  requireThat(integer(+n,1,50) && integer(+sides,2,100), 'Dice bounds');
  return {count:+n, sides:+sides, bonus:+bonus};
}
/** Additive v1 compatibility: concentration used to be a per-target effect.
 * Normalize copies only, including historical definitions; receipts stay intact.
 */
export function normalizeDefinition(input) {
  const d = copy(input);
  if (!object(d?.abilities)) return d;
  for (const a of Object.values(d.abilities)) {
    if (!Array.isArray(a?.effects)) continue;
    const legacy = a.effects.filter(e=>e?.kind === 'concentration');
    if (!legacy.length) continue;
    requireThat(legacy.length === 1 && a.concentration === undefined, 'Ambiguous legacy concentration');
    requireThat(id(legacy[0].effectId) && Object.keys(legacy[0]).every(k=>['kind','effectId'].includes(k)), 'Unsupported legacy concentration rule');
    a.concentration = {effectId:legacy[0].effectId,start:'activation'};
    a.effects = a.effects.filter(e=>e?.kind !== 'concentration');
  }
  return d;
}
export function validateDefinition(d) {
  requireThat(object(d) && id(d.id) && typeof d.name === 'string' && d.name.length > 0, 'Character identity');
  requireThat(integer(d.level,1,20) && integer(d.maxHp,1) && integer(d.ac,0,100) && integer(d.attacksPerAction,1,10), 'Character statistics');
  requireThat(object(d.saves) && integer(d.saves.con,-20,100), 'Constitution save');
  requireThat(object(d.resources) && object(d.abilities), 'Resources and abilities');
  if(d.speed!==undefined) requireThat(integer(d.speed,0,1000),'Speed');
  for (const [key,r] of Object.entries(d.resources)) {
    requireThat(id(key) && object(r) && integer(r.max) && ['short','long','none'].includes(r.recovery), 'Resource definition');
    if(r.recharge!==undefined) {
      requireThat(object(r.recharge) && ['dawn','dusk','short-rest','long-rest'].includes(r.recharge.event) && typeof r.recharge.formula==='string','Recharge definition');
      if(/^\d+$/.test(r.recharge.formula))requireThat(integer(Number(r.recharge.formula)),'Recharge amount');else diceSpec(r.recharge.formula);
      requireThat(r.recovery==='none','Recharge must have one authority');
    }
    if(r.slotLevel!==undefined) requireThat(integer(r.slotLevel,1,9) && ['standard','pact'].includes(r.pool),'Slot metadata');
  }
  for (const [key,a] of Object.entries(d.abilities)) {
    requireThat(id(key) && object(a) && typeof a.name === 'string' && costs.includes(a.cost) && ['self','selected'].includes(a.target), 'Ability definition');
    requireThat(integer(a.maxTargets,1,20) && Array.isArray(a.effects), 'Ability targets/effects');
    requireThat(a.attackAction === undefined || (typeof a.attackAction === 'boolean' && a.cost === 'action' && !!a.attack), 'Attack action profile');
    requireThat(a.attack === undefined || (object(a.attack) && integer(a.attack.bonus,-20,100)), 'Attack profile');
    if (a.resource !== undefined) requireThat(object(a.resource) && Object.hasOwn(d.resources,a.resource.id) && integer(a.resource.amount,1), 'Resource cost');
    if (a.concentration !== undefined) {
      requireThat(object(a.concentration) && Object.keys(a.concentration).every(k=>['effectId','start'].includes(k)) && id(a.concentration.effectId) && ['activation','hit'].includes(a.concentration.start), 'Concentration activation rule');
      requireThat(a.concentration.start !== 'hit' || !!a.attack, 'Hit-gated concentration requires an attack');
    }
    if(a.combat!==undefined) {
      requireThat(Object.keys(a).every(k=>['name','cost','target','maxTargets','effects','attackAction','attack','resource','concentration','combat','save','manualPlan'].includes(k)),'Unsupported ability field');
      validateProfile(a.combat,{compiled:true});
      requireThat(!a.concentration || a.combat.mode!=='automatic' || !!a.combat.duration,'Explicit concentration duration required');
      requireThat(!a.combat.spell || !a.resource || a.combat.spell.slotPolicy==='free','Spell slot and fixed cost are mutually exclusive');
      requireThat(!a.combat.grant || (a.cost==='none' && a.target==='self' && !!a.resource),'Resource-backed action grant');
      if(a.combat.upcast && a.combat.mode==='automatic') requireThat(a.effects[a.combat.upcast.effectIndex]?.dice!==undefined,'Dice upcast effect');
      requireThat(!(a.combat.ongoing??[]).some(e=>e.concentration) || a.concentration?.start==='activation','Ongoing concentration activation required');
      if(a.combat.weapon) requireThat(!!a.attack && a.combat.actionKind==='weaponAttack','Weapon attack profile');
    }
    if(a.save!==undefined) requireThat(object(a.save) && ['str','dex','con','int','wis','cha'].includes(a.save.ability) && integer(a.save.dc,1,100) && ['full','half','none'].includes(a.save.onSuccess) && !a.attack && !!a.combat,'Save profile');
    for (const e of a.effects) {
      if(a.combat) requireThat(Object.keys(e).every(k=>['kind','amount','dice','damageType','when'].includes(k)),'Unsupported effect field');
      requireThat(object(e) && ['damage','heal','tempHp'].includes(e.kind), 'Unsupported effect');
      requireThat((e.amount === undefined) !== (e.dice === undefined), 'One effect amount or dice formula required');
      if (e.dice !== undefined) diceSpec(e.dice); else requireThat(integer(e.amount), 'Effect amount');
      if(e.when!==undefined) requireThat(['always','success','failure'].includes(e.when) && !!a.save,'Conditional save effect');
      if (e.kind === 'damage') requireThat(id(e.damageType), 'Damage type');
    }
  }
  for (const list of ['resistances','immunities','vulnerabilities']) requireThat(Array.isArray(d[list]) && d[list].every(id), 'Damage defenses');
  if(d.castingModifiers!==undefined) {requireThat(Array.isArray(d.castingModifiers) && d.castingModifiers.length<=20 && new Set(d.castingModifiers.map(m=>m.id)).size===d.castingModifiers.length,'Casting modifiers');d.castingModifiers.forEach(validateCastingModifier);}
  if(d.rules!==undefined) {requireThat(Array.isArray(d.rules),'Reactive rules');d.rules.forEach(validateReactiveRule);}
  return d;
}
function jsonOnly(value, depth = 0) {
  requireThat(depth < 50, 'JSON nesting limit');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { requireThat(Number.isFinite(value), 'Finite JSON number required'); return; }
  requireThat(Array.isArray(value) || (object(value) && Object.getPrototypeOf(value) === Object.prototype), 'Plain JSON value required');
  for (const child of Object.values(value)) jsonOnly(child, depth+1);
}
export function validate(state, {history = true} = {}) {
  if (history) jsonOnly(state);
  requireThat(object(state) && state.schemaVersion === VERSION && state.ruleset === 'dnd5e-2014', 'Unsupported schema or ruleset');
  requireThat(integer(state.revision) && integer(state.turnId) && ['local','free','encounter'].includes(state.mode), 'Runtime header');
  validateGame(state);
  requireThat(object(state.layout) && Array.isArray(state.history) && object(state.receipts), 'Document envelope');
  for (const [key,r] of Object.entries(state.receipts)) requireThat(id(key) && object(r) && typeof r.fingerprint === 'string' && object(r.result), 'Receipt');
  if (history) for (const h of state.history) {
    requireThat(object(h) && id(h.id) && object(h.before) && Object.keys(h.before).every(k=>['actors','activeActorId','turnId','reactive'].includes(k)), 'History entry');
    validateGame(h.before);
  }
  return state;
}
function validateGame(state) {
  requireThat(integer(state.turnId), 'Snapshot turn');
  requireThat(object(state.actors) && Object.keys(state.actors).length > 0 && Object.keys(state.actors).length <= 100, 'Actors');
  requireThat(Object.hasOwn(state.actors,state.activeActorId), 'Active actor');
  for (const [key,a] of Object.entries(state.actors)) {
    requireThat(id(key) && object(a) && key === a.definition?.id, 'Actor identity'); validateDefinition(a.definition);
    validateAdvanced(a,state);
    requireThat(object(a.hp) && integer(a.hp.max,1) && integer(a.hp.current,0,a.hp.max) && integer(a.hp.temp), 'HP bounds');
    requireThat(object(a.resources) && Object.keys(a.resources).length === Object.keys(a.definition.resources).length, 'Resource state');
    for (const [r,value] of Object.entries(a.resources)) requireThat(Object.hasOwn(a.definition.resources,r) && integer(value,0,a.definition.resources[r].max), 'Resource bounds');
    requireThat(object(a.economy) && ['action','bonus','reaction'].every(k=>typeof a.economy[k] === 'boolean') && integer(a.economy.attacks,0,10), 'Action economy');
    requireThat(a.concentration === null || (object(a.concentration) && id(a.concentration.effectId) && id(a.concentration.instanceId)), 'Concentration');
    requireThat(Array.isArray(a.checks) && new Set(a.checks.map(c=>c.id)).size === a.checks.length && a.checks.every(c=>object(c) && id(c.id) && id(c.instanceId) && integer(c.dc,10)), 'Pending concentration checks');
    requireThat(typeof a.incapacitated === 'boolean', 'Incapacitation');
    requireThat(a.checks.every(c=>c.instanceId === a.concentration?.instanceId), 'Stale pending check');
    requireThat(!(a.hp.current === 0 || a.incapacitated) || a.concentration === null, 'Concentration while incapacitated');
    requireThat(!a.economy.attacks || !a.economy.action, 'Attack budget without action consumption');
  }
  validateReactive(state);
}
export function createSession(definitions) {
  requireThat(Array.isArray(definitions) && definitions.length && new Set(definitions.map(d=>d.id)).size === definitions.length, 'Unique character definitions required');
  const actors = Object.fromEntries(definitions.map(input=> {
    const d = validateDefinition(normalizeDefinition(input));
    return [d.id,{definition:d,hp:{current:d.maxHp,max:d.maxHp,temp:0},resources:Object.fromEntries(Object.entries(d.resources).map(([k,r])=>[k,r.max])),economy:{action:true,bonus:true,reaction:true,attacks:0},concentration:null,checks:[],incapacitated:false}];
  }));
  return validate({schemaVersion:VERSION,ruleset:'dnd5e-2014',revision:0,turnId:0,mode:'local',actors,activeActorId:definitions[0].id,receipts:{},history:[],layout:{}});
}
/** Only Pilot20's explicit v0 envelope is migrated; legacy Companions need dedicated importers. */
export function migrate(input) {
  const d = copy(input);
  if (d?.schemaVersion === 0) {
    requireThat(d.ruleset === 'dnd5e-2014' && object(d.actors), 'Unsupported v0 document');
    d.schemaVersion = 1; d.layout ??= {}; d.history ??= []; d.receipts ??= {};
  }
  function normalizeActors(actors) {
    if (object(actors)) for (const a of Object.values(actors)) if (object(a) && a.definition) a.definition = normalizeDefinition(a.definition);
  }
  function upgradeReactive(game) {
    const x=game?.reactive;if(!x || x.version!==1)return;x.version=2;
    if(x.event) {x.event.version=2;x.event.validations??={};x.event.modifiers.saves??={};x.event.plan.saves??={};}
  }
  upgradeReactive(d);if(Array.isArray(d?.history))for(const h of d.history)upgradeReactive(h.before);
  normalizeActors(d?.actors);
  if (Array.isArray(d?.history)) for (const entry of d.history) normalizeActors(entry?.before?.actors);
  return validate(d);
}
export function deserialize(raw) { requireThat(typeof raw === 'string' && raw.length <= 10000000, 'Save size limit'); return migrate(JSON.parse(raw)); }
export function serialize(state) { validate(state); const raw=JSON.stringify(state); requireThat(raw.length <= 10000000, 'Save size limit'); return raw; }
