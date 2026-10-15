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
export function validateDefinition(d) {
  requireThat(object(d) && id(d.id) && typeof d.name === 'string' && d.name.length > 0, 'Character identity');
  requireThat(integer(d.level,1,20) && integer(d.maxHp,1) && integer(d.ac,0,100) && integer(d.attacksPerAction,1,10), 'Character statistics');
  requireThat(object(d.saves) && integer(d.saves.con,-20,100), 'Constitution save');
  requireThat(object(d.resources) && object(d.abilities), 'Resources and abilities');
  for (const [key,r] of Object.entries(d.resources)) {
    requireThat(id(key) && object(r) && integer(r.max) && ['short','long','none'].includes(r.recovery), 'Resource definition');
  }
  for (const [key,a] of Object.entries(d.abilities)) {
    requireThat(id(key) && object(a) && typeof a.name === 'string' && costs.includes(a.cost) && ['self','selected'].includes(a.target), 'Ability definition');
    requireThat(integer(a.maxTargets,1,20) && Array.isArray(a.effects), 'Ability targets/effects');
    requireThat(a.attackAction === undefined || (typeof a.attackAction === 'boolean' && a.cost === 'action' && !!a.attack), 'Attack action profile');
    requireThat(!a.attack || (object(a.attack) && integer(a.attack.bonus,-20,100)), 'Attack profile');
    if (a.resource) requireThat(object(a.resource) && Object.hasOwn(d.resources,a.resource.id) && integer(a.resource.amount,1), 'Resource cost');
    for (const e of a.effects) {
      requireThat(object(e) && ['damage','heal','tempHp','concentration'].includes(e.kind), 'Unsupported effect');
      if (e.kind === 'concentration') requireThat(id(e.effectId), 'Concentration effect identity');
      else {
        requireThat((e.amount === undefined) !== (e.dice === undefined), 'One effect amount or dice formula required');
        if (e.dice !== undefined) diceSpec(e.dice); else requireThat(integer(e.amount), 'Effect amount');
        if (e.kind === 'damage') requireThat(id(e.damageType), 'Damage type');
      }
    }
  }
  for (const list of ['resistances','immunities','vulnerabilities']) requireThat(Array.isArray(d[list]) && d[list].every(id), 'Damage defenses');
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
  requireThat(object(state.actors) && Object.keys(state.actors).length > 0 && Object.keys(state.actors).length <= 100, 'Actors');
  requireThat(Object.hasOwn(state.actors,state.activeActorId), 'Active actor');
  for (const [key,a] of Object.entries(state.actors)) {
    requireThat(id(key) && object(a) && key === a.definition?.id, 'Actor identity'); validateDefinition(a.definition);
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
  requireThat(object(state.layout) && Array.isArray(state.history) && object(state.receipts), 'Document envelope');
  for (const [key,r] of Object.entries(state.receipts)) requireThat(id(key) && object(r) && typeof r.fingerprint === 'string' && object(r.result), 'Receipt');
  if (history) for (const h of state.history) {
    requireThat(object(h) && id(h.id) && object(h.before) && Object.keys(h.before).every(k=>['actors','activeActorId','turnId'].includes(k)), 'History entry');
    validate({...state,...h.before,history:[]},{history:false});
  }
  return state;
}
export function createSession(definitions) {
  requireThat(Array.isArray(definitions) && definitions.length && new Set(definitions.map(d=>d.id)).size === definitions.length, 'Unique character definitions required');
  const actors = Object.fromEntries(definitions.map(input=> {
    const d = copy(validateDefinition(input));
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
  return validate(d);
}
export function deserialize(raw) { requireThat(typeof raw === 'string' && raw.length <= 10000000, 'Save size limit'); return migrate(JSON.parse(raw)); }
export function serialize(state) { validate(state); const raw=JSON.stringify(state); requireThat(raw.length <= 10000000, 'Save size limit'); return raw; }
