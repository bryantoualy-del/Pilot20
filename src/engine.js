import {PHASES,beginEvent,nextWindow,respond,guardPending} from './rules/reactive.js';
import {json} from './character/contracts.js';
import {advanced,profileExecutable,statistic,saveModes,hasCondition,cleanupConcentration,boundary,checkCanAct,payAction,prepareCast,establish,addEffect,removeEffect} from './rules/combat.js';
import {copy, validate, requireThat as check, integer, id, diceSpec} from './model.js';
const game = s => copy({actors:s.actors,activeActorId:s.activeActorId,turnId:s.turnId,...(s.reactive?{reactive:s.reactive}:{})});
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
function activation(s,c,manual=false) {
  const a=actor(s,c.actorId);check(Object.hasOwn(a.definition.abilities,c.abilityId),'Unknown ability');
  const ability=copy(a.definition.abilities[c.abilityId]),p=ability.combat;
  checkCanAct(s,a);
  check(!ability.concentration || !hasCondition(a,'cannotConcentrate'),'Concentration restricted');
  if(manual) check(p?.mode==='manual','Explicit manual profile required');
  else if(p) check(profileExecutable(p),'Ability is not automatically executable');
  if(!['reaction','none'].includes(ability.cost)) check(s.activeActorId===c.actorId,'Not actor turn');
  const ids=ability.target==='self'?[c.actorId]:c.targetIds;
  check(Array.isArray(ids) && ids.length>0 && ids.length<=ability.maxTargets && new Set(ids).size===ids.length,'Invalid targets');
  const targets=ids.map(key=>[key,actor(s,key)]);
  check(!ability.attack || ids.length===1,'One attack target required');
  check(!a.checks.length || ability.concentration?.start==='activation','Resolve concentration first');
  payAction(s,a,ability,c);
  if(ability.resource) {const r=ability.resource;check(a.resources[r.id]>=r.amount,'Resource depleted');a.resources[r.id]-=r.amount;}
  const slotLevel=prepareCast(a,ability,c);
  if(p?.upcast) {
    const e=ability.effects[p.upcast.effectIndex],d=diceSpec(e.dice),count=d.count+(slotLevel-p.spell.level)*p.upcast.dicePerLevel;
    e.dice=count+'d'+d.sides+(d.bonus<0?'':'+')+d.bonus;diceSpec(e.dice);
  }
  return {a,ability,targets,slotLevel};
}
function useAbility(s,c) {
  const {a,ability,targets,slotLevel}=activation(s,c);
  let hit=true,critical=false,total=null;
  if(ability.attack) {
    const natural=d20(c.attackRolls,c.advantage===true,c.disadvantage===true);
    total=natural+statistic(a,'attack',ability.attack.bonus);critical=natural===20;
    hit=natural!==1 && (critical || total>=statistic(targets[0][1],'ac',targets[0][1].definition.ac));
  }
  const plan={command:copy(c),ability,targetIds:targets.map(([key])=>key),slotLevel,natural:ability.attack?d20(c.attackRolls,c.advantage===true,c.disadvantage===true):null,total,critical,hit};
  if(!Object.values(s.actors).some(a=>a.definition.rules?.length))return finishAbility(s,{plan,modifiers:{damage:[],damageDivisor:1,attackTotal:0}});
  return advanceEvent(s,beginEvent(s,plan));
}
function advanceEvent(s,e) {
  while(true) {
    const p=e.plan,t=s.actors[e.targetIds[0]];
    if(e.phase==='after-damage' && e.outcome===null)e.outcome=finishAbility(s,e);
    if(e.phase==='before-hit' && p.ability.attack) p.hit=p.natural!==1 && (p.critical || p.total+e.modifiers.attackTotal>=statistic(t,'ac',t.definition.ac));
    if(nextWindow(s,e)) return {pending:e.window.decisionId,eventId:e.id,phase:e.phase};
    if(e.modifiers.cancelled) {e.status='cancelled';return {cancelled:true,eventId:e.id,results:[]};}
    const i=PHASES.indexOf(e.phase);
    if(i===PHASES.length-1) {e.status='completed';return e.outcome;}
    e.phase=PHASES[i+1];
  }
}
function finishAbility(s,event) {
  const {command:c,ability,targetIds,slotLevel,hit,critical,total}=event.plan,a=actor(s,c.actorId),targets=targetIds.map(k=>[k,actor(s,k)]);
  activateConcentration(a,ability.concentration,c.id,hit);cleanupConcentration(s);
  const results=[],lasting=[];
  const amounts=hit?ability.effects.map((e,i)=>resolveAmount(e,c.effectRolls?.[i],critical)):[];
  if(hit) for(const [key,target] of targets) {
    let save=null;
    if(ability.save) {
      const r=ability.save,m=saveModes(target,r.ability);
      check(integer(target.definition.saves[r.ability],-100,100),'Target save statistic required');
      const total=d20(c.saveRolls?.[key],m.advantage,m.disadvantage)+statistic(target,'save.'+r.ability,target.definition.saves[r.ability]);
      save={ability:r.ability,dc:r.dc,total,success:total>=r.dc};
    }
    const components=new Map();let damageBonusUsed=false;
    for(const [i,e] of ability.effects.entries()) {
      if(e.when==='success' && !save?.success || e.when==='failure' && save?.success) continue;
      let n=amounts[i];
      if(e.kind==='damage') {
        if(!damageBonusUsed) {n=Math.max(0,statistic(a,'damage',n));damageBonusUsed=true;}
        components.set(e.damageType,(components.get(e.damageType)||0)+n);
      }
      if(e.kind==='heal') target.hp.current=Math.min(target.hp.max,target.hp.current+n);
      if(e.kind==='tempHp') target.hp.temp=Math.max(target.hp.temp,n);
    }
    let detail={targetId:key,hp:copy(target.hp)};
    if(ability.attack) for(const extra of event.modifiers.damage) {const n=resolveAmount({kind:'damage',dice:extra.dice},extra.rolls,critical);components.set(extra.damageType,(components.get(extra.damageType)||0)+n);}
    if(components.size) {
      const n=[...components].reduce((sum,[type,n])=>{
        // Saving-throw reduction precedes resistance/vulnerability, once per typed total.
        if(save?.success) n=ability.save.onSuccess==='half'?Math.floor(n/2):ability.save.onSuccess==='none'?0:n;
        n=Math.floor(n/event.modifiers.damageDivisor);
        return sum+effectiveDamage(n,type,target.definition);
      },0);
      detail={targetId:key,...damage(target,n,c.id+':'+key)};
    }
    if(save) detail.save=save;
    results.push(detail);
    // P0 persistent effects with a save are established only on failure.
    lasting.push(key);
  }
  establish(s,a,ability,c,lasting,Object.fromEntries(results.filter(r=>r.save).map(r=>[r.targetId,r.save.success])));cleanupConcentration(s);
  return {hit,critical,total,results,...(ability.combat?.spell?{slotLevel}: {})};
}
function declareManual(s,c) {
  check(typeof c.reason==='string' && c.reason.trim(),'Manual declaration reason required');
  const {a,ability,targets,slotLevel}=activation(s,c,true);
  check(ability.concentration?.start!=='hit','Manual hit-gated concentration unsupported');
  activateConcentration(a,ability.concentration,c.id,true);cleanupConcentration(s);
  if(ability.combat.duration && a.concentration?.instanceId===c.id) {const d=ability.combat.duration;advanced(a).concentrationClock={instanceId:c.id,remaining:d.value*(d.unit==='minute'?10:1),boundary:d.boundary};}
  advanced(a).pendingManual={id:c.id,abilityId:c.abilityId,actorId:c.actorId,targetIds:targets.map(([key])=>key),declaration:c.reason,slotLevel};
  return {pending:c.id,slotLevel,reason:c.reason};
}
function resolveManual(s,c) {
  const a=actor(s,c.actorId),x=advanced(a),pending=x.pendingManual;
  check(pending && pending.id===c.declarationId,'Stale manual decision');
  check(typeof c.reason==='string' && c.reason.trim() && Array.isArray(c.outcomes) && c.outcomes.length<=100,'Manual resolution and reason');
  const results=[];
  for(const o of c.outcomes) {
    check(pending.targetIds.includes(o.actorId),'Outcome target was not declared');const t=actor(s,o.actorId);
    check(typeof o.reason==='string' && o.reason.trim(),'Outcome reason required');
    if(o.kind==='damage') {check(integer(o.amount),'Adjudicated damage');results.push({actorId:o.actorId,...damage(t,o.amount,c.id+':'+results.length)});}
    else if(o.kind==='heal') {check(integer(o.amount),'Healing');t.hp.current=Math.min(t.hp.max,t.hp.current+o.amount);}
    else if(o.kind==='tempHp') {check(integer(o.amount),'Temporary HP');t.hp.temp=Math.max(t.hp.temp,o.amount);}
    else if(o.kind==='resource') {check(Object.hasOwn(t.resources,o.resourceId) && integer(o.value,0,t.definition.resources[o.resourceId].max),'Manual resource bounds');t.resources[o.resourceId]=o.value;}
    else if(o.kind==='effect') addEffect(s,o.actorId,c.actorId,o.rule,c.id+':m'+results.length);
    else if(o.kind==='removeEffect') removeEffect(t,o.effectId);
    else if(o.kind==='incapacitated') {check(typeof o.value==='boolean','Boolean incapacity');t.incapacitated=o.value;}
    else throw Error('Unsupported manual outcome');
    if(o.kind!=='damage') results.push({actorId:o.actorId,kind:o.kind,reason:o.reason});
  }
  x.pendingManual=null;cleanupConcentration(s);return {resolved:pending.id,reason:c.reason,results};
}
function apply(s,c) {
  if (c.type === 'respondDecision') return advanceEvent(s,respond(s,c));
  if (c.type === 'resumeDecision') throw Error('Continuation resumes atomically with its decision; double resume refused');
  if (c.type === 'useAbility') return useAbility(s,c);
  if (c.type === 'declareManual') return declareManual(s,c);
  if (c.type === 'resolveManual') return resolveManual(s,c);
  if (c.type === 'endTurn') {
    check(s.activeActorId===c.actorId,'Not actor turn');const a=actor(s,c.actorId);
    check(a.advanced?.turnOpen!==false,'Turn already ended');advanced(a);boundary(s,c.actorId,'end');advanced(a).turnOpen=false;return {ended:c.actorId};
  }
  if (c.type === 'move') {
    const a=actor(s,c.actorId);checkCanAct(s,a);check(s.activeActorId===c.actorId && a.advanced?.turnOpen!==false && !hasCondition(a,'cannotMove'),'Movement restricted');
    check(integer(c.distance,1,10000),'Movement distance');const x=advanced(a),speed=Math.max(0,statistic(a,'speed',a.definition.speed??0));
    check(x.movementSpent+c.distance<=speed*(1+x.dashCount),'Movement budget exceeded');x.movementSpent+=c.distance;return {distance:c.distance,remaining:speed*(1+x.dashCount)-x.movementSpent};
  }
  if (c.type === 'removeEffect') {
    check(typeof c.reason==='string' && c.reason.trim(),'Removal reason required');removeEffect(actor(s,c.actorId),c.effectId);return {removed:c.effectId,reason:c.reason};
  }
  if (c.type === 'endConcentration') {loseConcentration(actor(s,c.actorId));return {ended:true};}
  if (c.type === 'startTurn') {
    if(s.actors[s.activeActorId].advanced?.turnOpen!==false) boundary(s,s.activeActorId,'end');
    boundary(s,c.actorId,'start');
    for(const a of Object.values(s.actors)) if(a.advanced) a.advanced.casts=[];
    const a = actor(s,c.actorId); s.activeActorId = c.actorId; s.turnId++;
    a.economy = {action:true,bonus:true,reaction:true,attacks:0}; return {turnId:s.turnId,...(s.reactive?{reactive:s.reactive}:{})};
  }
  if (c.type === 'concentrationSave') {
    const a = actor(s,c.actorId), q = a.checks.find(q=>q.id === c.checkId);
    check(q && q.instanceId === a.concentration?.instanceId,'Stale concentration check');
    check(integer(c.bonus ?? 0,-100,100) && integer(c.penalty ?? 0,0,100),'Save adjustments');
    const modes=saveModes(a,'con');
    const total = d20(c.rolls,c.advantage === true || modes.advantage,c.disadvantage === true || modes.disadvantage)+statistic(a,'save.con',a.definition.saves.con)+(c.bonus||0)-(c.penalty||0);
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
    check(['short','long'].includes(c.kind),'Rest kind');
    check(!Object.values(s.actors).some(a=>a.advanced?.effects.length),'Resolve timed effects before rest'); const a=actor(s,c.actorId);
    for (const [k,r] of Object.entries(a.definition.resources)) if (r.recovery === c.kind || (c.kind === 'long' && r.recovery === 'short')) a.resources[k]=r.max;
    if (c.kind === 'long') {a.hp.current=a.hp.max; a.hp.temp=0; loseConcentration(a);}
    return {rest:c.kind};
  }
  throw Error('Unsupported command');
}
/** Pure transaction: invalid commands leave input untouched; caller persists before publication. */
export function execute(input, command, context = {}) {
  validate(input);
  check(command && Object.getPrototypeOf(command)===Object.prototype,'Plain command required');
  command=Object.fromEntries(Object.entries(command).filter(([,v])=>v!==undefined));json(command); check(command && id(command.id) && typeof command.type === 'string','Command identity');
  if (input.mode === 'encounter') check(context.authority === 'encounter','Encounter authority required');
  const fingerprint = JSON.stringify(command), prior=input.receipts[command.id];
  if (prior) { check(prior.fingerprint === fingerprint,'Command ID collision'); return {state:copy(input),result:copy(prior.result),replayed:true}; }
  if (['correct','damage','setIncapacitated','startTurn','endTurn','rest','undo','removeEffect','declareManual','resolveManual'].includes(command.type)) check(context.role === 'gm' || input.mode !== 'encounter','GM command required');
  if(command.expectedRevision!==undefined) check(command.expectedRevision===input.revision,'Revision conflict');
  if(Object.values(input.actors).some(a=>a.advanced?.pendingManual)) check(['resolveManual','undo'].includes(command.type),'Resolve pending manual decision first');
  guardPending(input,command);
  const state=copy(input), before=game(input); let result;
  if (command.type === 'undo') {
    const latest=state.history.at(-1); check(latest && latest.id === command.actionId,'Only latest transaction can be undone');
    delete state.reactive; Object.assign(state,copy(latest.before));
    if(state.reactive?.event?.status==='pending') for(const d of state.reactive.event.decisions) if(d.status==='pending')d.revision=input.revision+1;
    state.history.pop(); result={undone:latest.id};
  } else { result=apply(state,command); cleanupConcentration(state); state.history.push({id:command.id,command:JSON.parse(JSON.stringify(command)),result:copy(result),before}); }
  state.revision++; state.receipts[command.id]={fingerprint,result:copy(result)};
  validate(state); return {state,result,replayed:false};
}
