/** Reusable P0 mechanics. No class, subclass or character identifiers. */
import {check,keys,integer,id,json} from '../character/contracts.js';
const ABILITIES=['str','dex','con','int','wis','cha'];
export const ACTION_KINDS=['weaponAttack','dash','disengage','hide','useObject'];
const STATS=['ac','speed','attack','damage',...ABILITIES.map(k=>'save.'+k)];
const CONDITIONS=['incapacitated','cannotAct','cannotMove','cannotCast','cannotConcentrate'];
export function validateEffectRule(r) {
  keys(r,['id','stack','duration','modifiers','conditions','concentration','actionGrant','onEnd','when'],['id','stack','duration','modifiers','conditions','concentration']);
  check(id(r.id) && typeof r.concentration==='boolean','Effect identity');
  keys(r.stack,['key','policy','priority']);check(id(r.stack.key) && ['independent','priority','replace'].includes(r.stack.policy) && integer(r.stack.priority,-1000,1000),'Explicit stacking');
  keys(r.duration,['unit','value','anchor','boundary']);check(['turn','round','minute'].includes(r.duration.unit) && integer(r.duration.value,1,1000) && ['source','target'].includes(r.duration.anchor) && ['start','end'].includes(r.duration.boundary),'Effect duration');
  check(Array.isArray(r.modifiers) && Array.isArray(r.conditions) && r.conditions.every(k=>CONDITIONS.includes(k)) && new Set(r.conditions).size===r.conditions.length,'Effect conditions');
  for(const m of r.modifiers) {
    keys(m,['stat','operation','value']);check(STATS.includes(m.stat) && ['add','multiply','set','advantage','disadvantage'].includes(m.operation),'Modifier operation');
    check(integer(m.value,-1000,1000),'Modifier value');
    if(m.operation==='multiply') check(m.value>=0,'Nonnegative multiplier');
    if(['advantage','disadvantage'].includes(m.operation)) check(m.stat.startsWith('save.') && m.value===1,'Save advantage flag');
  }
  if(r.actionGrant!==undefined) {keys(r.actionGrant,['kinds','attacks']);check(Array.isArray(r.actionGrant.kinds) && r.actionGrant.kinds.length>0 && r.actionGrant.kinds.every(k=>ACTION_KINDS.includes(k)) && new Set(r.actionGrant.kinds).size===r.actionGrant.kinds.length && r.actionGrant.attacks===1,'Restricted single-attack budget');}
  if(r.when!==undefined) check(['always','success','failure'].includes(r.when),'Ongoing save condition');
  if(r.onEnd!==undefined) check(r.onEnd==='no-actions-until-next-turn-end','Effect end consequence');return r;
}
export function validateProfile(p,{compiled=false}={}) {
  json(p);keys(p,['version','mode','requirements','spell','upcast','ongoing','grant','actionKind','weapon','deferred','duration'],['version','mode','requirements']);
  check(p.version===1 && ['automatic','manual','referenced'].includes(p.mode) && Array.isArray(p.requirements) && p.requirements.every(v=>typeof v==='string' && v.trim()),'Combat profile');
  if(p.deferred!==undefined) check(Array.isArray(p.deferred) && p.deferred.every(k=>['reactionWindow','triggeredEffect','decision','transformation','summon','zone','aura'].includes(k)),'Deferred primitives');
  if(p.spell) {
    keys(p.spell,compiled?['id','classId','level','access','available']:['id','classId','level','access']);
    check(id(p.spell.id) && id(p.spell.classId) && integer(p.spell.level,0,9) && ['known','prepared','granted'].includes(p.spell.access),'Spell access');
    if(compiled) check(typeof p.spell.available==='boolean','Compiled spell availability');
  }
  if(p.duration) {keys(p.duration,['unit','value','anchor','boundary']);check(['turn','round','minute'].includes(p.duration.unit) && integer(p.duration.value,1,1000) && p.duration.anchor==='source' && ['start','end'].includes(p.duration.boundary),'Spell concentration duration');}
  if(p.upcast) {keys(p.upcast,['effectIndex','dicePerLevel']);check(p.spell?.level>0 && integer(p.upcast.effectIndex,0,19) && integer(p.upcast.dicePerLevel,1,20),'Upcast rule');}
  if(p.ongoing) {check(Array.isArray(p.ongoing) && p.ongoing.length<=20 && new Set(p.ongoing.map(r=>r.id)).size===p.ongoing.length,'Ongoing effects');p.ongoing.forEach(validateEffectRule);}
  if(p.grant) {keys(p.grant,['count','maxPerTurn']);check(p.grant.count===1 && integer(p.grant.maxPerTurn,1,10),'Extra action grant');}
  if(p.actionKind!==undefined) check(ACTION_KINDS.includes(p.actionKind),'Action kind');
  if(p.weapon!==undefined) check(typeof p.weapon==='boolean','Weapon flag');return p;
}
export const profileExecutable=p=>p.mode==='automatic' && !p.requirements.length && !p.deferred?.length;
export function advanced(a) {
  return a.advanced??={version:1,effects:[],extraActions:0,extraAttacks:0,grantUses:{},restrictedUsed:[],casts:[],turnStarts:0,turnOpen:true,lethargyUntil:0,movementSpent:0,dashCount:0,pendingManual:null,concentrationClock:null};
}
export function validateAdvanced(a,state) {
  if(a.advanced===undefined) return;
  const x=a.advanced;
  keys(x,['version','effects','extraActions','extraAttacks','grantUses','restrictedUsed','casts','turnStarts','turnOpen','lethargyUntil','movementSpent','dashCount','pendingManual','concentrationClock']);
  check(x.version===1 && integer(x.extraActions,0,10) && integer(x.extraAttacks,0,10) && integer(x.turnStarts) && integer(x.lethargyUntil) && typeof x.turnOpen==='boolean' && integer(x.movementSpent) && integer(x.dashCount),'Advanced runtime');
  check(x.lethargyUntil===0 || x.lethargyUntil>=x.turnStarts,'Stale action inhibition');
  check(x.grantUses && typeof x.grantUses==='object' && !Array.isArray(x.grantUses) && Object.entries(x.grantUses).every(([k,n])=>id(k) && integer(n,0,10)),'Grant use ledger');
  check(Array.isArray(x.restrictedUsed) && x.restrictedUsed.every(id) && new Set(x.restrictedUsed).size===x.restrictedUsed.length,'Restricted use ledger');
  check(Array.isArray(x.casts) && x.casts.every(c=>{keys(c,['level','cost']);return integer(c.level,0,9) && ['action','bonus','reaction'].includes(c.cost);}),'Cast ledger');
  check(Array.isArray(x.effects) && x.effects.length<=100 && new Set(x.effects.map(e=>e.id)).size===x.effects.length,'Active effect instances');
  for(const e of x.effects) {
    keys(e,['id','sourceActorId','concentrationInstanceId','anchorActorId','remaining','rule']);
    check(id(e.id) && Object.hasOwn(state.actors,e.sourceActorId) && Object.hasOwn(state.actors,e.anchorActorId) && integer(e.remaining,1,10000),'Effect instance');validateEffectRule(e.rule);
    check(e.concentrationInstanceId===null || id(e.concentrationInstanceId),'Effect concentration reference');
    check(e.rule.concentration===(e.concentrationInstanceId!==null),'Effect concentration dependency');
    if(e.rule.concentration) check(state.actors[e.sourceActorId].concentration?.instanceId===e.concentrationInstanceId,'Orphan concentration effect');
  }
  if(x.concentrationClock!==null) {
    const c=x.concentrationClock;keys(c,['instanceId','remaining','boundary']);
    check(c.instanceId===a.concentration?.instanceId && integer(c.remaining,1,10000) && ['start','end'].includes(c.boundary),'Concentration duration clock');
  }
  if(x.pendingManual!==null) {
    const m=x.pendingManual;keys(m,['id','abilityId','actorId','targetIds','declaration','slotLevel']);
    check(id(m.id) && id(m.abilityId) && m.actorId===a.definition.id && Object.hasOwn(a.definition.abilities,m.abilityId) && Array.isArray(m.targetIds) && m.targetIds.length>0 && m.targetIds.every(k=>Object.hasOwn(state.actors,k)) && new Set(m.targetIds).size===m.targetIds.length && typeof m.declaration==='string' && m.declaration.trim() && integer(m.slotLevel,0,9),'Manual pending declaration');
  }
  // Ambiguous same-key policies cannot be smuggled through imported runtime.
  for(const e of x.effects) {check(x.effects.every(o=>o.rule.stack.key!==e.rule.stack.key || o.rule.stack.policy===e.rule.stack.policy),'Incompatible stacking policies');if(e.rule.stack.policy==='replace') check(x.effects.filter(o=>o.rule.stack.key===e.rule.stack.key).length===1,'Duplicate replacement effect');}
  for(const stat of STATS) statistic(a,stat);
}
export function activeEffects(a) {
  const all=a.advanced?.effects??[],selected=[];
  for(const e of all) {
    if(e.rule.stack.policy==='priority') {
      const group=all.filter(o=>o.rule.stack.key===e.rule.stack.key);
      const winner=group.reduce((best,o)=>o.rule.stack.priority>=best.rule.stack.priority?o:best);
      if(winner!==e) continue;
    }
    selected.push(e);
  }
  return selected;
}
export function hasCondition(a,k) {
  if(k==='incapacitated' && a.incapacitated) return true;
  if(['cannotAct','cannotMove'].includes(k) && (a.advanced?.lethargyUntil??0)>0) return true;
  return activeEffects(a).some(e=>e.rule.conditions.includes(k));
}
export function statistic(a,stat,base=0) {
  const mods=activeEffects(a).flatMap(e=>e.rule.modifiers).filter(m=>m.stat===stat);
  const sets=mods.filter(m=>m.operation==='set');check(sets.length<=1,'Incompatible statistic replacements');
  let n=sets.length?sets[0].value:base;
  n+=mods.filter(m=>m.operation==='add').reduce((n,m)=>n+m.value,0);
  n*=mods.filter(m=>m.operation==='multiply').reduce((n,m)=>n*m.value,1);
  return Math.floor(n);
}
export function saveModes(a,ability) {
  const mods=activeEffects(a).flatMap(e=>e.rule.modifiers).filter(m=>m.stat==='save.'+ability);
  return {advantage:mods.some(m=>m.operation==='advantage'),disadvantage:mods.some(m=>m.operation==='disadvantage')};
}
export function removeEffect(a,effectId) {
  const x=advanced(a),e=x.effects.find(e=>e.id===effectId);check(e,'Unknown effect instance');
  x.effects=x.effects.filter(o=>o!==e);
  // A suppressed instance ending does not end a still-active copy of the same effect.
  if(e.rule.onEnd && !x.effects.some(o=>o.rule.stack.key===e.rule.stack.key)) x.lethargyUntil=x.turnStarts+1;
  return e;
}
export function addEffect(s,targetId,sourceId,rule,effectId) {
  validateEffectRule(rule);const a=s.actors[targetId],x=advanced(a),source=s.actors[sourceId];
  check(!x.effects.some(e=>e.id===effectId),'Effect ID collision');
  const same=x.effects.filter(e=>e.rule.stack.key===rule.stack.key);
  check(same.every(e=>e.rule.stack.policy===rule.stack.policy),'Incompatible stacking policy');
  if(rule.stack.policy==='replace') for(const e of same) removeEffect(a,e.id);
  check(!rule.concentration || source.concentration,'Concentration source required');
  x.effects.push({id:effectId,sourceActorId:sourceId,concentrationInstanceId:rule.concentration?source.concentration.instanceId:null,anchorActorId:rule.duration.anchor==='source'?sourceId:targetId,remaining:rule.duration.value*(rule.duration.unit==='minute'?10:1),rule:structuredClone(rule)});
  // Detect incompatible replacements immediately, rather than at the next attack.
  for(const stat of STATS) statistic(a,stat);
}
export function cleanupConcentration(s) {
  let changed=true;
  while(changed) {
    changed=false;
    for(const a of Object.values(s.actors)) {
      if((a.hp.current===0 || hasCondition(a,'incapacitated') || hasCondition(a,'cannotConcentrate')) && a.concentration) {a.concentration=null;a.checks=[];changed=true;}
      if(a.advanced?.concentrationClock && a.advanced.concentrationClock.instanceId!==a.concentration?.instanceId) a.advanced.concentrationClock=null;
      for(const e of [...(a.advanced?.effects??[])]) if(e.concentrationInstanceId!==null && s.actors[e.sourceActorId].concentration?.instanceId!==e.concentrationInstanceId) {removeEffect(a,e.id);changed=true;}
    }
  }
}
export function boundary(s,actorId,phase) {
  const a=s.actors[actorId],clock=a.advanced?.concentrationClock;
  if(clock?.boundary===phase && --clock.remaining===0) {a.concentration=null;a.checks=[];a.advanced.concentrationClock=null;}
  for(const target of Object.values(s.actors)) for(const e of [...(target.advanced?.effects??[])]) if(e.anchorActorId===actorId && e.rule.duration.boundary===phase) {
    if(--e.remaining===0) removeEffect(target,e.id);
  }
  cleanupConcentration(s);
  const x=a.advanced;
  if(!x) return;
  if(phase==='start') {
    x.turnStarts++;x.turnOpen=true;x.extraActions=0;x.extraAttacks=0;x.grantUses={};x.restrictedUsed=[];x.movementSpent=0;x.dashCount=0;
  } else {
    x.turnOpen=false;
    if(x.lethargyUntil && x.turnStarts>=x.lethargyUntil) x.lethargyUntil=0;
    x.extraActions=0;x.extraAttacks=0;
  }
}
export function checkCanAct(s,a) {
  check(a.hp.current>0 && !hasCondition(a,'incapacitated') && !hasCondition(a,'cannotAct'),'Actor cannot act');
  check(!Object.values(s.actors).some(a=>a.advanced?.pendingManual),'Resolve pending manual decision first');
}
export function payAction(s,a,ability,c) {
  const p=ability.combat;
  if(ability.cost!=='reaction') check(a.advanced?.turnOpen!==false,'Turn ended');
  if(c.budget && c.budget!=='normal') {
    check(ability.cost==='action' && s.activeActorId===a.definition.id,'Additional action on own turn only');
    if(c.budget==='extra') {
      const x=advanced(a);
      if(ability.attackAction && x.extraAttacks>0) {x.extraAttacks--;return;}
      check(x.extraActions>0,'Extra action spent');
      // Each Attack action owns its budget; normal and granted actions may interleave.
      x.extraActions--;
      if(ability.attackAction) x.extraAttacks=a.definition.attacksPerAction-1;
      return;
    }
    const e=activeEffects(a).find(e=>e.id===c.budget && e.rule.actionGrant),x=advanced(a);
    check(e && !x.restrictedUsed.includes(e.rule.stack.key),'Restricted action spent');
    check(p?.actionKind && e.rule.actionGrant.kinds.includes(p.actionKind) && !p.spell,'Action not allowed by restricted budget');
    if(p.actionKind==='weaponAttack') check(p.weapon===true && !!ability.attack,'One weapon attack required');
    x.restrictedUsed.push(e.rule.stack.key);return;
  }
  if(ability.cost==='action' && ability.attackAction) {
    if(!a.economy.attacks) {check(a.economy.action,'Action spent');a.economy.action=false;a.economy.attacks=a.definition.attacksPerAction;}
    a.economy.attacks--;
  } else if(ability.cost!=='none') {
    check(a.economy[ability.cost],'Action spent');a.economy[ability.cost]=false;
    if(ability.cost==='action') a.economy.attacks=0;
  }
}
export function prepareCast(a,ability,c) {
  const p=ability.combat;
  if(!p?.spell) return 0;
  check(p.spell.available,'Spell is not available (known/prepared/granted)');
  check(!hasCondition(a,'cannotCast'),'Spellcasting restricted');
  const level=p.spell.level,x=advanced(a);
  check(['action','bonus','reaction'].includes(ability.cost),'Spell casting time unsupported');
  const casts=x.casts;
  if(ability.cost==='bonus') check(casts.every(o=>o.level===0 && o.cost==='action'),'Bonus-action spell restriction');
  else if(casts.some(o=>o.cost==='bonus')) check(level===0 && ability.cost==='action','Bonus-action spell restriction');
  let slotLevel=0;
  if(level>0) {
    const slot=a.definition.resources[c.slotId];
    check(slot && integer(slot.slotLevel,1,9) && slot.slotLevel>=level,'Valid spell slot required');
    check(a.resources[c.slotId]>0,'Spell slot depleted');a.resources[c.slotId]--;slotLevel=slot.slotLevel;
  } else check(c.slotId===undefined,'Cantrip does not use a slot');
  x.casts.push({level,cost:ability.cost});return slotLevel;
}
export function establish(s,a,ability,c,targetIds,saveResults={}) {
  const p=ability.combat;if(!p)return;
  if(p.duration && a.concentration?.instanceId===c.id) advanced(a).concentrationClock={instanceId:c.id,remaining:p.duration.value*(p.duration.unit==='minute'?10:1),boundary:p.duration.boundary};
  if(p.grant) {
    check(ability.cost==='none' && ability.target==='self' && s.activeActorId===c.actorId,'Extra action activation profile');
    const x=advanced(a),uses=x.grantUses[c.abilityId]??0;check(uses<p.grant.maxPerTurn,'Grant limit per turn');
    x.grantUses[c.abilityId]=uses+1;x.extraActions+=p.grant.count;
  }
  for(const targetId of targetIds) for(const [i,r] of (p.ongoing??[]).entries()) {
    const success=saveResults[targetId],when=r.when??'failure';
    if(success!==undefined && when!=='always' && ((when==='success')!==success)) continue;
    if(!r.concentration || a.concentration) addEffect(s,targetId,c.actorId,r,c.id+':'+targetId+':e'+i);}
  if(p.actionKind==='dash') advanced(a).dashCount++;
}
