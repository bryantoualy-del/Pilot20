/** Serializable event scheduler. Effects are a closed interpreter, never catalogue code. */
import {check,keys,id,integer,json} from '../character/contracts.js';
import {validateDecision,validateTrigger,costs} from './contracts.js';
import {hasCondition,addEffect,validateEffectRule,prepareCast} from './combat.js';
export const PHASES=['cast','after-roll','before-hit','after-hit','before-damage','after-damage'];
const FIELDS=['attackTotal','damageDivisor'];
export function validateReactiveRule(r) {
  json(r);keys(r,['version','id','trigger','phase','priority','conditions','options']);
  check(r.version===1 && id(r.id) && PHASES.includes(r.phase) && integer(r.priority,-1000,1000),'Reactive rule header');validateTrigger(r.trigger);
  check(Array.isArray(r.conditions) && r.conditions.length<=20,'Rule conditions');
  r.conditions.forEach(c=>validateCondition(c));
  check(Array.isArray(r.options) && r.options.length>0 && r.options.length<=30 && new Set(r.options.map(o=>o.id)).size===r.options.length,'Rule options');
  for(const o of r.options) {
    keys(o,['id','label','costs','reaction','spell','effects'],['id','label','costs','reaction','effects']);
    check(id(o.id) && typeof o.label==='string' && o.label.length<=200 && typeof o.reaction==='boolean','Rule option');costs(o.costs);
    if(o.spell) {keys(o.spell,['level','slotId']);check(integer(o.spell.level,1,9) && id(o.spell.slotId),'Reaction spell');check(o.reaction,'Reaction casting only');}
    check(Array.isArray(o.effects) && o.effects.length>0 && o.effects.length<=10,'Rule effects');o.effects.forEach(validateOperation);
    for(const e of o.effects) {if(e.kind==='adjust')check(r.phase===(e.field==='attackTotal'?'after-roll':'before-damage'),'Modifier phase');if(e.kind==='cancel' || e.kind==='counter')check(r.phase==='cast','Cancellation phase');if(e.kind==='damage')check(r.phase==='after-hit','Post-hit phase');}
  }
  return r;
}
function validateCondition(c,depth=0) {
  check(depth<4,'Condition nesting');
  if(c.any || c.all) {const key=c.any?'any':'all';keys(c,[key]);check(Array.isArray(c[key]) && c[key].length>0 && c[key].length<=10,'Condition alternatives');c[key].forEach(v=>validateCondition(v,depth+1));}
  else {keys(c,['fact','equals']);check(typeof c.fact==='string' && /^[a-zA-Z][a-zA-Z0-9.]{0,79}$/.test(c.fact) && ['boolean','string','number'].includes(typeof c.equals),'Explicit rule fact');}
}
const matchesCondition=(f,c)=>c.any?c.any.some(v=>matchesCondition(f,v)):c.all?c.all.every(v=>matchesCondition(f,v)):f[c.fact]===c.equals;
function validateOperation(e) {
  if(e.kind==='adjust') {keys(e,['kind','field','amount']);check(FIELDS.includes(e.field) && integer(e.amount,1,100),'Event adjustment');}
  else if(e.kind==='cancel') keys(e,['kind']);
  else if(e.kind==='effect') {keys(e,['kind','rule']);validateEffectRule(e.rule);}
  else if(e.kind==='damage') {keys(e,['kind','dice','damageType']);check(/^\d{1,2}d[468]$/.test(e.dice) && id(e.damageType),'Additional damage dice');}
  else if(e.kind==='counter') {keys(e,['kind','slotLevel','bonus']);check(integer(e.slotLevel,3,9) && integer(e.bonus,-20,100),'Counter check');}
  else throw Error('Unsupported reactive operation');
}
export function reactive(s) {return s.reactive??={version:1,event:null,usage:{}};}
export function validateReactive(s) {
  for(const a of Object.values(s.actors)) if(a.definition.rules!==undefined) {
    check(Array.isArray(a.definition.rules) && a.definition.rules.length<=50 && new Set(a.definition.rules.map(r=>r.id)).size===a.definition.rules.length,'Unique actor rules');a.definition.rules.forEach(validateReactiveRule);
  }
  if(s.reactive===undefined)return;
  const x=s.reactive;keys(x,['version','event','usage']);check(x.version===1,'Reactive runtime version');
  check(x.usage && typeof x.usage==='object' && !Array.isArray(x.usage) && Object.keys(x.usage).length<=5000,'Entitlement ledger');
  for(const [k,n] of Object.entries(x.usage)) check(id(k) && integer(n),'Entitlement turn');
  if(x.event===null)return;
  const e=x.event;keys(e,['version','id','actorId','targetIds','phase','revision','status','plan','decisions','window','processed','modifiers','lockedActorIds','outcome']);
  check(e.version===1 && id(e.id) && Object.hasOwn(s.actors,e.actorId) && PHASES.includes(e.phase) && integer(e.revision) && ['pending','completed','cancelled'].includes(e.status),'Event header');
  check(Array.isArray(e.targetIds) && e.targetIds.length>0 && e.targetIds.every(k=>Object.hasOwn(s.actors,k)),'Event targets');
  check(Array.isArray(e.lockedActorIds) && e.lockedActorIds.every(k=>Object.hasOwn(s.actors,k)),'Event locks');
  keys(e.plan,['command','ability','targetIds','slotLevel','natural','total','critical','hit']);
  check(e.plan.command.id===e.id && e.plan.command.actorId===e.actorId && JSON.stringify(e.plan.targetIds)===JSON.stringify(e.targetIds),'Continuation source');
  const pinned=structuredClone(s.actors[e.actorId].definition.abilities[e.plan.command.abilityId]);check(pinned,'Continuation ability');
  if(pinned.combat?.upcast) {const u=pinned.combat.upcast,m=/^(\d+)d(\d+)([+-]\d+)?$/.exec(pinned.effects[u.effectIndex].dice);check(m,'Upcast dice');pinned.effects[u.effectIndex].dice=(+m[1]+(e.plan.slotLevel-pinned.combat.spell.level)*u.dicePerLevel)+'d'+m[2]+((+(m[3]??0))<0?'':'+')+(+(m[3]??0));}
  check(JSON.stringify(e.plan.ability)===JSON.stringify(pinned),'Pinned continuation ability');
  check(integer(e.plan.slotLevel,0,9) && typeof e.plan.hit==='boolean' && typeof e.plan.critical==='boolean' && (e.plan.natural===null || integer(e.plan.natural,1,20)) && (e.plan.total===null || integer(e.plan.total,-1000,1000)),'Continuation roll');
  check(e.outcome===null || e.outcome && typeof e.outcome==='object' && Array.isArray(e.outcome.results),'Continuation outcome');
  check(Array.isArray(e.decisions) && e.decisions.length<=200 && new Set(e.decisions.map(d=>d.id)).size===e.decisions.length,'Bounded decisions');
  for(const d of e.decisions) {validateDecision(d);check(d.eventId===e.id && Object.hasOwn(s.actors,d.actorId),'Orphan decision');check(s.actors[d.actorId].definition.rules?.some(r=>r.id===d.ruleId),'Orphan rule');}
  check(Array.isArray(e.processed) && new Set(e.processed).size===e.processed.length && e.processed.length<=200,'Bounded processed rules');
  keys(e.modifiers,['attackTotal','damageDivisor','cancelled','damage']);check(integer(e.modifiers.attackTotal,0,10000) && integer(e.modifiers.damageDivisor,1,1024) && typeof e.modifiers.cancelled==='boolean' && Array.isArray(e.modifiers.damage),'Event modifiers');
  for(const d of e.modifiers.damage) {keys(d,['dice','damageType','rolls']);check(typeof d.dice==='string' && id(d.damageType) && Array.isArray(d.rolls),'Damage continuation');}
  if(e.window!==null) {keys(e.window,['version','eventId','phase','decisionId','status']);check(e.window.version===1 && e.window.eventId===e.id && e.window.phase===e.phase && e.window.status==='pending','Reaction window');check(e.decisions.some(d=>d.id===e.window.decisionId && d.status==='pending'),'Orphan window');}
  check(e.decisions.filter(d=>d.status==='pending').length===(e.window?1:0),'Pending continuation cardinality');
  check(e.status==='pending'?e.window!==null:e.window===null,'Event continuation lifecycle');
}
function facts(s,e,actorId) {
  const c=e.plan.command,a=s.actors[actorId],source=s.actors[e.actorId],target=s.actors[e.targetIds[0]],ability=e.plan.ability;
  return {self:actorId===e.actorId,target:e.targetIds.includes(actorId),other:actorId!==e.actorId,
    attack:!!ability.attack,weapon:ability.combat?.weapon===true,hit:e.plan.hit,critical:e.plan.critical,spell:!!ability.combat?.spell,
    spellLevel:e.plan.slotLevel,advantage:c.advantage===true && c.disadvantage!==true,disadvantage:c.disadvantage===true && c.advantage!==true,
    ...Object.fromEntries((ability.combat?.tags??[]).map(k=>['tag.'+k,true])),
    ...(Object.fromEntries(Object.entries(ability.combat?.traits??{}).map(([k,v])=>['weapon.'+k,v]))),
    ...Object.fromEntries(Object.entries(c.facts?.[actorId]??{}).map(([k,v])=>['external.'+k,v])),
    conscious:a.hp.current>0 && !hasCondition(a,'incapacitated'),sourceAlive:source.hp.current>0,targetAlive:target.hp.current>0};
}
function options(a,r) {
  return r.options.filter(o=>(!o.reaction || a.economy.reaction) && o.costs.every(c=>(a.resources[c.resourceId]??0)>=c.amount) && (!o.spell || !hasCondition(a,'cannotCast') && !a.advanced?.casts.some(c=>c.cost==='bonus')));
}
export function beginEvent(s,plan) {
  check(plan.command.id.length<=65,'Reactive command ID length limit');const x=reactive(s);
  check(x.event?.status!=='pending','Dependent resolution pending');
  x.event={version:1,id:plan.command.id,actorId:plan.command.actorId,targetIds:plan.targetIds,phase:'cast',revision:s.revision+1,status:'pending',plan,decisions:[],window:null,processed:[],modifiers:{attackTotal:0,damageDivisor:1,cancelled:false,damage:[]},lockedActorIds:[...new Set([plan.command.actorId,...plan.targetIds,...Object.keys(s.actors).filter(k=>s.actors[k].definition.rules?.length)])],outcome:null};
  return x.event;
}
export function nextWindow(s,e) {
  if(e.modifiers.cancelled)return false;
  const candidates=Object.entries(s.actors).flatMap(([actorId,a])=>(a.definition.rules??[]).map(r=>({actorId,a,r})))
    .filter(({r})=>r.phase===e.phase).sort((x,y)=>x.r.priority-y.r.priority || x.actorId.localeCompare(y.actorId) || x.r.id.localeCompare(y.r.id));
  for(const {actorId,a,r} of candidates) {
    const key=actorId+':'+r.id;
    if(e.processed.includes(key))continue;
    const f=facts(s,e,actorId),scope=r.trigger.scope;
    if(scope==='self' && actorId!==e.actorId || scope==='target' && !e.targetIds.includes(actorId) || scope==='ally')continue; // no inferred allegiance
    if(r.trigger.whileEffect && !a.advanced?.effects.some(v=>v.rule.id===r.trigger.whileEffect))continue;
    const matches={'ability-targeted':true,'spell-cast':!!e.plan.ability.combat?.spell,'attack-hit':!!e.plan.ability.attack && e.plan.hit,'attack-roll':!!e.plan.ability.attack,'damage-taken':e.outcome?.results.some(r=>r.targetId===actorId && r.damage>0)===true};
    if(!matches[r.trigger.event] || !f.conscious || !r.conditions.every(c=>matchesCondition(f,c)))continue;
    if(r.trigger.limit==='turn' && reactive(s).usage[key]===s.turnId)continue;
    check(['none','turn'].includes(r.trigger.limit),'Unsupported reactive entitlement');
    const allowed=options(a,r);if(!allowed.length)continue;
    check(e.decisions.length<200,'Decision bound reached');e.processed.push(key);
    const d={version:2,id:e.id+':d'+e.decisions.length,eventId:e.id,actorId,revision:s.revision+1,status:'pending',options:allowed.map(o=>({id:o.id,label:o.label,costs:o.costs})),continuation:{eventId:e.id,phase:e.phase},policy:'block-dependent-resolution',ruleId:r.id,phase:e.phase};
    e.decisions.push(d);e.window={version:1,eventId:e.id,phase:e.phase,decisionId:d.id,status:'pending'};return true;
  }
  return false;
}
export function pendingDecisions(s) {return structuredClone(s.reactive?.event?.decisions.filter(d=>d.status==='pending')??[]);}
export function respond(s,c) {
  const e=s.reactive?.event,d=e?.decisions.find(d=>d.id===c.decisionId);
  check(e?.status==='pending' && d?.status==='pending' && e.window?.decisionId===d.id,'Stale decision');
  check(c.expectedRevision===s.revision && c.decisionRevision===d.revision,'Decision revision conflict');
  check(c.actorId===d.actorId && ['accept','decline'].includes(c.choice),'Decision actor/choice');
  if(c.choice==='decline')d.status='declined';
  else {
    const a=s.actors[d.actorId],r=a.definition.rules.find(r=>r.id===d.ruleId),o=options(a,r).find(o=>o.id===c.optionId);
    check(d.options.some(o=>o.id===c.optionId) && o,'Option unavailable');
    const f=facts(s,e,d.actorId);check(f.conscious && r.conditions.every(c=>matchesCondition(f,c)),'Decision conditions changed');
    if(o.spell) {
      check(e.plan.command.facts?.[d.actorId]?.reactionSpellUnopposed===true,'Nested reaction spells require manual adjudication');
      prepareCast(a,{cost:'reaction',combat:{spell:{available:true,level:o.spell.level}}},{slotId:o.spell.slotId});
    }
    for(const cost of o.costs) {if(o.spell?.slotId===cost.resourceId)continue;a.resources[cost.resourceId]-=cost.amount;}
    if(o.reaction) {check(a.economy.reaction,'Reaction unavailable');a.economy.reaction=false;}
    for(const [i,op] of o.effects.entries()) {
      if(op.kind==='adjust') {if(op.field==='damageDivisor')e.modifiers.damageDivisor*=op.amount;else e.modifiers.attackTotal+=op.amount;}
      else if(op.kind==='cancel')e.modifiers.cancelled=true;
      else if(op.kind==='effect')addEffect(s,d.actorId,d.actorId,op.rule,c.id+':e'+i);
      else if(op.kind==='damage') {const rolls=c.rolls?.[i];check(Array.isArray(rolls),'Additional damage rolls required');e.modifiers.damage.push({dice:op.dice,damageType:op.damageType==='attack'?e.plan.ability.effects.find(v=>v.kind==='damage')?.damageType:op.damageType,rolls});}
      else if(op.kind==='counter') {
        const level=e.plan.slotLevel;if(op.slotLevel>=level)e.modifiers.cancelled=true;
        else {check(Array.isArray(c.checkRolls) && c.checkRolls.length===1 && integer(c.checkRolls[0],1,20),'Counter ability roll');e.modifiers.cancelled=c.checkRolls[0]+op.bonus>=10+level;}
      }
    }
    if(r.trigger.limit==='turn')reactive(s).usage[d.actorId+':'+r.id]=s.turnId;
    d.status='resolved';
  }
  e.window=null;return e;
}
/** Only a read/response, latest undo, or unrelated concentration check is safe while paused. */
export function guardPending(s,c) {
  if(s.reactive?.event?.status!=='pending')return;
  check(['respondDecision','undo'].includes(c.type) || c.type==='concentrationSave' && !s.reactive.event.lockedActorIds.includes(c.actorId),'Dependent resolution pending');
}
