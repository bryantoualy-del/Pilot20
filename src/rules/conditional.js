/** Generic transfers, sustained stances and casting-plan modifiers. */
import {check,keys,id,integer,json} from '../character/contracts.js';
import {costs} from './contracts.js';
export function validateCastingModifier(m) {
 json(m);keys(m,['id','costs','operation','from','to','exclusiveGroup'],['id','costs','operation','exclusiveGroup']);
 check(id(m.id) && id(m.exclusiveGroup) && ['castingTime','firstSaveDisadvantage'].includes(m.operation),'Casting modifier');costs(m.costs);
 if(m.operation==='castingTime')check(m.from==='action' && m.to==='bonus','Casting time conversion');
 else check(m.from===undefined && m.to===undefined,'Save modifier fields');
}
export function modifyCasting(a,ability,c,{pay=true}={}) {
 const ids=c.castingModifiers??[];check(Array.isArray(ids) && ids.length<=10 && new Set(ids).size===ids.length,'Unique casting modifiers');
 const groups=new Set();
 for(const key of ids) {
  const m=a.definition.castingModifiers?.find(m=>m.id===key);check(m && ability.combat?.spell,'Casting modifier unavailable');
  check(!groups.has(m.exclusiveGroup),'Exclusive casting modifiers');groups.add(m.exclusiveGroup);
  if(m.operation==='castingTime') {check(ability.cost===m.from,'Casting time not eligible');ability.cost=m.to;}
  else {const target=c.modifierTargets?.[key];check(ability.save && c.targetIds?.includes(target),'Save modifier requires a declared target');ability.combat.castPlan={firstSaveDisadvantageTarget:target};}
  if(pay)for(const cost of m.costs) {check((a.resources[cost.resourceId]??0)>=cost.amount,'Casting modifier resource depleted');a.resources[cost.resourceId]-=cost.amount;}
 }
 return ability;
}
export function validateTransfer(t) {
 keys(t,['key','sides','duration','requirements','excludeSelf','rollKinds']);
 check(id(t.key) && [6,8,10,12].includes(t.sides) && integer(t.duration,1,1000) && t.excludeSelf===true,'Transferred die');
 check(Array.isArray(t.requirements) && t.requirements.length>0 && t.requirements.every(id),'Explicit transfer requirements');
 check(Array.isArray(t.rollKinds) && t.rollKinds.length>0 && t.rollKinds.every(k=>['attack','check','save'].includes(k)),'Transfer roll kinds');
}
export function validateStance(r) {
 keys(r,['id','duration','damageBonus','requiredTraits','resistances','advantageAbilities','blocks','sustain','endOnUnconscious','requirements','voluntaryCost']);
 check(id(r.id) && integer(r.duration,1,1000) && integer(r.damageBonus,0,100) && typeof r.sustain==='boolean' && r.endOnUnconscious===true && r.voluntaryCost==='bonus','Sustained stance');
 check(Array.isArray(r.requiredTraits) && r.requiredTraits.every(k=>['melee','strength','ranged','finesse'].includes(k)),'Conditional weapon traits');
 check(Array.isArray(r.resistances) && r.resistances.every(id) && Array.isArray(r.advantageAbilities) && r.advantageAbilities.every(k=>['str','dex','con','int','wis','cha'].includes(k)),'Stance benefits');
 check(Array.isArray(r.blocks) && r.blocks.every(k=>['cannotCast','cannotConcentrate'].includes(k)) && Array.isArray(r.requirements) && r.requirements.length>0 && r.requirements.every(id),'Stance restrictions');
}
export function validateConditional(a,state) {
 if(a.definition.castingModifiers!==undefined) {check(Array.isArray(a.definition.castingModifiers) && a.definition.castingModifiers.length<=20 && new Set(a.definition.castingModifiers.map(m=>m.id)).size===a.definition.castingModifiers.length,'Casting modifiers');a.definition.castingModifiers.forEach(validateCastingModifier);}
 const x=a.advanced;if(!x)return;
 if(x.unconscious!==undefined)check(typeof x.unconscious==='boolean','Unconscious flag');
 if(x.activity!==undefined){keys(x.activity,['attacked','damaged']);check(typeof x.activity.attacked==='boolean' && typeof x.activity.damaged==='boolean','Combat activity');}
 if(x.stance!==undefined && x.stance!==null) {keys(x.stance,['rule','remaining']);validateStance(x.stance.rule);check(integer(x.stance.remaining,1,1000),'Stance clock');check(!x.stance.rule.endOnUnconscious || a.hp.current>0 && !x.unconscious,'Unconscious stance');}
 if(x.tokens!==undefined) {
  check(Array.isArray(x.tokens) && x.tokens.length<=20 && new Set(x.tokens.map(t=>t.key)).size===x.tokens.length,'Unique transferred resources');
  for(const t of x.tokens) {keys(t,['id','key','sourceActorId','remaining','sides','status','rollKinds']);check(id(t.id) && id(t.key) && Object.hasOwn(state.actors,t.sourceActorId) && integer(t.remaining,0,1000) && [6,8,10,12].includes(t.sides) && ['available','spent','expired'].includes(t.status) && Array.isArray(t.rollKinds) && t.rollKinds.every(k=>['attack','check','save'].includes(k)),'Transferred resource state');}
 }
}
export function transfer(s,a,targetId,t,command) {
 validateTransfer(t);check(targetId!==a.definition.id,'Transfer cannot target self');const target=s.actors[targetId],facts=command.facts?.[targetId];
 check(t.requirements.every(k=>facts?.[k]===true),'Transfer eligibility requires external validation');const x=target.advanced;
 check(x,'Target runtime must be initialized');x.tokens??=[];
 check(!x.tokens.some(v=>v.key===t.key && v.status==='available'),'Recipient already has transferred resource');
 x.tokens=x.tokens.filter(v=>v.key!==t.key);x.tokens.push({id:command.id+':token',key:t.key,sourceActorId:a.definition.id,remaining:t.duration,sides:t.sides,status:'available',rollKinds:[...t.rollKinds]});
}
export function tokenRules(a) {
 return (a.advanced?.tokens??[]).filter(t=>t.status==='available').map(t=>({version:1,id:t.id,trigger:{version:1,event:'roll-made',scope:'any',limit:'none',whileEffect:null},phase:'after-roll',priority:0,conditions:[{fact:'rollOwner',equals:true},{any:t.rollKinds.map(k=>({fact:'rollKind',equals:k}))}],options:[{id:'spend',label:'Spend '+t.key+' d'+t.sides,costs:[],reaction:false,tokenId:t.id,effects:[{kind:'rollAdjustment',sides:t.sides}]}]}));
}
export function stanceDamage(a,ability) {
 const r=a.advanced?.stance?.rule;return r && ability.combat?.weapon && r.requiredTraits.every(k=>ability.combat.traits?.[k]===true)?r.damageBonus:0;
}
export function stanceDefense(a) {return [...new Set([...a.definition.resistances,...(a.advanced?.stance?.rule.resistances??[])])];}
export function activity(a) {check(a.advanced,'Activity runtime');return a.advanced.activity??={attacked:false,damaged:false};}
export function conditionalBoundary(s,actorId,phase) {
 const a=s.actors[actorId],x=a.advanced;
 for(const target of Object.values(s.actors))for(const t of target.advanced?.tokens??[])if(t.sourceActorId===actorId && t.status==='available' && phase==='start' && --t.remaining===0)t.status='expired';
 if(!x)return;
 if(phase==='start' && x.stance && --x.stance.remaining===0)x.stance=null;
 if(phase==='end') {if(x.stance?.rule.sustain && !x.activity?.attacked && !x.activity?.damaged)x.stance=null;x.activity={attacked:false,damaged:false};}
}
export function conditionalCleanup(s,unconscious) {for(const a of Object.values(s.actors))if(a.advanced?.stance && (a.hp.current===0 || unconscious(a)))a.advanced.stance=null;}
export const quickenedSpell=(resourceId='sorcery')=>({id:'quickened',costs:[{resourceId,amount:2}],operation:'castingTime',from:'action',to:'bonus',exclusiveGroup:'metamagic'});
export const heightenedSpell=(resourceId='sorcery')=>({id:'heightened',costs:[{resourceId,amount:3}],operation:'firstSaveDisadvantage',exclusiveGroup:'metamagic'});
export function bardicTransfer(level) {check(integer(level,1,20),'Bard level');return {key:'bardic-inspiration',sides:level>=15?12:level>=10?10:level>=5?8:6,duration:100,requirements:['within60ft','canHear'],excludeSelf:true,rollKinds:['attack','check','save']};}
export function rageStance(level) {check(integer(level,1,20),'Barbarian level');return {id:'rage',duration:10,damageBonus:level>=16?4:level>=9?3:2,requiredTraits:['melee','strength'],resistances:['bludgeoning','piercing','slashing'],advantageAbilities:['str'],blocks:['cannotCast','cannotConcentrate'],sustain:level<15,endOnUnconscious:true,requirements:['notHeavyArmor'],voluntaryCost:'bonus'};}
