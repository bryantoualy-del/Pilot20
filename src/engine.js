import {copy, validate, requireThat as check, integer, id, diceSpec} from './model.js';
const game = s => copy({actors:s.actors,activeActorId:s.activeActorId,turnId:s.turnId});
function dieRoll(rolls, sides, count) {
  check(Array.isArray(rolls) && rolls.length === count && rolls.every(n=>integer(n,1,sides)), 'Invalid dice results');
  return rolls;
}
export function d20(rolls, advantage = false, disadvantage = false) {
  const mode = advantage === disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage';
  dieRoll(rolls,20,mode === 'normal' ? 1 : 2);
  return mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0];
}
export function effectiveDamage(amount, type, definition) {
  check(integer(amount) && id(type), 'Invalid damage');
  if (definition.immunities.includes(type)) return 0;
  let n = definition.resistances.includes(type) ? Math.floor(amount/2) : amount;
  return definition.vulnerabilities.includes(type) ? n*2 : n;
}
function loseConcentration(a) { a.concentration = null; a.checks = []; }
function activateConcentration(a, rule, instanceId, hit) {
  if (!rule || (rule.start === 'hit' && !hit)) return;
  a.concentration = {effectId:rule.effectId,instanceId};
  a.checks = [];
}
function damage(a, amount, damageId) {
  const absorbed = Math.min(a.hp.temp,amount); a.hp.temp -= absorbed;
  const lost = Math.min(a.hp.current,amount-absorbed); a.hp.current -= lost;
  // Damage absorbed by temporary HP still requires concentration.
  if (a.hp.current === 0 || a.incapacitated) loseConcentration(a);
  else if (amount > 0 && a.concentration) a.checks.push({id:damageId,instanceId:a.concentration.instanceId,dc:Math.max(10,Math.floor(amount/2))});
  return {damage:amount,tempLost:absorbed,hpLost:lost};
}
function resolveAmount(e, rolls, critical) {
  if (e.amount !== undefined) return e.amount;
  const spec = diceSpec(e.dice), count = spec.count * (critical && e.kind === 'damage' ? 2 : 1);
  return Math.max(0,dieRoll(rolls,spec.sides,count).reduce((a,b)=>a+b,0)+spec.bonus);
}
function actor(s,key) { check(Object.hasOwn(s.actors,key),'Unknown actor'); return s.actors[key]; }
function useAbility(s,c) {
  const a = actor(s,c.actorId), ability = a.definition.abilities[c.abilityId];
  check(Object.hasOwn(a.definition.abilities,c.abilityId),'Unknown ability');
  check(a.hp.current > 0 && !a.incapacitated,'Actor cannot act');
  if (!['reaction','none'].includes(ability.cost)) check(s.activeActorId === c.actorId,'Not actor turn');
  const ids = ability.target === 'self' ? [c.actorId] : c.targetIds;
  check(Array.isArray(ids) && ids.length > 0 && ids.length <= ability.maxTargets && new Set(ids).size === ids.length,'Invalid targets');
  const targets = ids.map(key=>[key,actor(s,key)]);
  check(!ability.attack || ids.length === 1,'One attack target required');
  // Activation rules are actor-scoped. A hit-gated activation must first settle
  // pending checks; an unconditional replacement retires its old instance.
  check(!a.checks.length || ability.concentration?.start === 'activation','Resolve concentration first');
  if (ability.cost === 'action' && ability.attackAction === true) {
    if (!a.economy.attacks) { check(a.economy.action,'Action spent'); a.economy.action = false; a.economy.attacks = a.definition.attacksPerAction; }
    a.economy.attacks--;
  } else if (ability.cost !== 'none') {
    check(a.economy[ability.cost], 'Action spent'); a.economy[ability.cost] = false;
    if (ability.cost === 'action') a.economy.attacks = 0;
  }
  if (ability.resource) {
    const r = ability.resource; check(a.resources[r.id] >= r.amount,'Resource depleted'); a.resources[r.id] -= r.amount;
  }
  let hit = true, critical = false, total = null;
  if (ability.attack) {
    const natural = d20(c.attackRolls,c.advantage === true,c.disadvantage === true);
    total = natural+ability.attack.bonus; critical = natural === 20;
    hit = natural !== 1 && (critical || total >= targets[0][1].definition.ac);
  }
  activateConcentration(a,ability.concentration,c.id,hit);
  const results = [];
  if (hit) for (const [key,target] of targets) {
    // Aggregate typed components before applying resistance and concentration once per hit.
    const components = new Map();
    for (const [i,e] of ability.effects.entries()) {
      const n = resolveAmount(e,c.effectRolls?.[i],critical);
      if (e.kind === 'damage') components.set(e.damageType,(components.get(e.damageType)||0)+n);
      if (e.kind === 'heal') target.hp.current = Math.min(target.hp.max,target.hp.current+n);
      if (e.kind === 'tempHp') target.hp.temp = Math.max(target.hp.temp,n);
    }
    if (components.size) {
      const n = [...components].reduce((sum,[type,n])=>sum+effectiveDamage(n,type,target.definition),0);
      results.push({targetId:key,...damage(target,n,c.id+':'+key)});
    } else results.push({targetId:key,hp:copy(target.hp)});
  }
  return {hit,critical,total,results};
}
function apply(s,c) {
  if (c.type === 'useAbility') return useAbility(s,c);
  if (c.type === 'startTurn') {
    const a = actor(s,c.actorId); s.activeActorId = c.actorId; s.turnId++;
    a.economy = {action:true,bonus:true,reaction:true,attacks:0}; return {turnId:s.turnId};
  }
  if (c.type === 'concentrationSave') {
    const a = actor(s,c.actorId), q = a.checks.find(q=>q.id === c.checkId);
    check(q && q.instanceId === a.concentration?.instanceId,'Stale concentration check');
    check(integer(c.bonus ?? 0,-100,100) && integer(c.penalty ?? 0,0,100),'Save adjustments');
    const total = d20(c.rolls,c.advantage === true,c.disadvantage === true)+a.definition.saves.con+(c.bonus||0)-(c.penalty||0);
    const success = total >= q.dc; a.checks = a.checks.filter(x=>x.id !== q.id);
    if (!success) loseConcentration(a); return {total,dc:q.dc,success};
  }
  if (c.type === 'damage') {
    const a = actor(s,c.actorId); return damage(a,effectiveDamage(c.amount,c.damageType,a.definition),c.id);
  }
  if (c.type === 'setIncapacitated') {
    const a = actor(s,c.actorId); check(typeof c.value === 'boolean','Boolean required');
    a.incapacitated = c.value; if (c.value) loseConcentration(a); return {incapacitated:c.value};
  }
  if (c.type === 'correct') {
    check(typeof c.reason === 'string' && c.reason.trim().length > 0,'Correction reason required');
    const a = actor(s,c.actorId);
    if (c.field === 'hp') { check(integer(c.value,0,a.hp.max),'HP bounds'); a.hp.current=c.value; if (!c.value) loseConcentration(a); }
    else if (c.field === 'tempHp') { check(integer(c.value),'Temp HP bounds'); a.hp.temp=c.value; }
    else if (c.field === 'resource') { check(Object.hasOwn(a.resources,c.resourceId) && integer(c.value,0,a.definition.resources[c.resourceId].max),'Resource bounds'); a.resources[c.resourceId]=c.value; }
    else if (c.field === 'economy') { check(['action','bonus','reaction'].includes(c.slot) && typeof c.value === 'boolean','Economy correction'); a.economy[c.slot]=c.value; if (c.slot==='action') a.economy.attacks=0; }
    else throw Error('Unsupported correction');
    return {reason:c.reason};
  }
  if (c.type === 'rest') {
    check(['short','long'].includes(c.kind),'Rest kind'); const a=actor(s,c.actorId);
    for (const [k,r] of Object.entries(a.definition.resources)) if (r.recovery === c.kind || (c.kind === 'long' && r.recovery === 'short')) a.resources[k]=r.max;
    if (c.kind === 'long') {a.hp.current=a.hp.max; a.hp.temp=0; loseConcentration(a);}
    return {rest:c.kind};
  }
  throw Error('Unsupported command');
}
/** Pure transaction: invalid commands leave input untouched; caller persists before publication. */
export function execute(input, command, context = {}) {
  validate(input); check(command && id(command.id) && typeof command.type === 'string','Command identity');
  const fingerprint = JSON.stringify(command), prior=input.receipts[command.id];
  if (prior) { check(prior.fingerprint === fingerprint,'Command ID collision'); return {state:copy(input),result:copy(prior.result),replayed:true}; }
  if (input.mode === 'encounter') check(context.authority === 'encounter','Encounter authority required');
  if (['correct','damage','setIncapacitated','startTurn','rest','undo'].includes(command.type)) check(context.role === 'gm' || input.mode !== 'encounter','GM command required');
  const state=copy(input), before=game(input); let result;
  if (command.type === 'undo') {
    const latest=state.history.at(-1); check(latest && latest.id === command.actionId,'Only latest transaction can be undone');
    Object.assign(state,copy(latest.before)); state.history.pop(); result={undone:latest.id};
  } else { result=apply(state,command); state.history.push({id:command.id,command:JSON.parse(JSON.stringify(command)),result:copy(result),before}); }
  state.revision++; state.receipts[command.id]={fingerprint,result:copy(result)};
  validate(state); return {state,result,replayed:false};
}
