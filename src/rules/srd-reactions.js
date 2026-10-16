/** SRD 5.1 / CC BY 4.0 mechanics adapters. Output is inert, pinned declarative rules.
 * Acquisition/progression belongs to the character compiler/catalogue, not the scheduler.
 */
import {check,integer} from '../character/contracts.js';
const fact=(fact,equals=true)=>({fact,equals});
const trigger=(event,scope,limit='none')=>({version:1,event,scope,limit,whileEffect:null});
const option=(id,effects,{costs=[],reaction=false,spell}={})=>({id,label:id,costs,reaction,...(spell?{spell}:{}),effects});
const rule=(id,phase,event,scope,conditions,options,priority=0,limit='none')=>({version:1,id,phase,priority,trigger:trigger(event,scope,limit),conditions,options});
const slots=(resources,min)=>Object.entries(resources).filter(([,v])=>integer(v.slotLevel,min,9)).sort(([a],[b])=>a.localeCompare(b));
export function uncannyDodge(level) {
 check(integer(level,5,20),'Uncanny Dodge requires rogue level 5');
 return rule('uncanny-dodge','before-damage','attack-hit','target',[fact('external.attackerVisible')],[option('dodge',[{kind:'adjust',field:'damageDivisor',amount:2}],{reaction:true})]);
}
export function shield(resources) {
 return rule('shield','before-hit','ability-targeted','target',[fact('external.canCastShield'),{any:[{all:[fact('attack'),fact('hit')]},fact('tag.magicMissile')]}],slots(resources,1).map(([slotId,v])=>option(slotId,[{kind:'effect',rule:{id:'shield',stack:{key:'shield',policy:'replace',priority:0},duration:{unit:'turn',value:1,anchor:'target',boundary:'start'},modifiers:[{stat:'ac',operation:'add',value:5}],conditions:[],concentration:false}}],{reaction:true,costs:[{resourceId:slotId,amount:1}],spell:{level:1,slotId}})),-20);
}
export function counterspell(resources,castingBonus) {
 check(integer(castingBonus,-20,100),'Spellcasting ability modifier');
 return rule('counterspell','cast','spell-cast','any',[fact('other'),fact('external.hostileSpell'),fact('external.casterVisibleWithin60ft'),fact('external.canCastCounterspell')],slots(resources,3).map(([slotId,v])=>option(slotId,[{kind:'counter',slotLevel:v.slotLevel,bonus:castingBonus}],{reaction:true,costs:[{resourceId:slotId,amount:1}],spell:{level:3,slotId}})),-30);
}
export function sneakAttack(level) {
 check(integer(level,1,20),'Rogue level');
 return rule('sneak-attack','after-hit','attack-hit','self',[fact('weapon'),{any:[fact('weapon.finesse'),fact('weapon.ranged')]},fact('disadvantage',false),{any:[fact('advantage'),fact('external.adjacentEnemyEligible')]}],[option('sneak',[{kind:'damage',dice:Math.ceil(level/2)+'d6',damageType:'attack'}])],0,'turn');
}
export function divineSmite(resources) {
 return rule('divine-smite','after-hit','attack-hit','self',[fact('weapon'),fact('weapon.melee')],slots(resources,1).flatMap(([slotId,v])=>[
 option(slotId,[{kind:'damage',dice:Math.min(5,v.slotLevel+1)+'d8',damageType:'radiant'}],{costs:[{resourceId:slotId,amount:1}]})]),10);
}
// Distinct declarative extension supplies the creature-type die. Generic conditions
// verify the authoritative context, not a guessed creature name.
export function smiteRules(resources) {
 const base=divineSmite(resources);base.conditions.push(fact('external.fiendOrUndead',false));
 const boosted=divineSmite(resources);boosted.id='divine-smite-exalted';boosted.conditions.push(fact('external.fiendOrUndead'));
 for(const o of boosted.options) {const v=resources[o.id];o.effects[0].dice=Math.min(6,v.slotLevel+2)+'d8';}
 return [base,boosted];
}
