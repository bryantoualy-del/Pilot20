/** Synthetic SRD mechanic fixtures, not full builds or complete official spell content. */
import {advancedCharacter,profile} from './advanced-characters.mjs';
import {ability} from './characters.mjs';
import {derive} from '../src/character/derive.js';
import {shield,uncannyDodge,sneakAttack,smiteRules,counterspell} from '../src/rules/srd-reactions.js';
import {bardicTransfer,rageStance,quickenedSpell,heightenedSpell} from '../src/rules/conditional.js';
export function reactiveCharacter(classId,{level=10}={}) {
 const d=advancedCharacter(classId,{level}),blade=d.abilities.find(a=>a.id==='blade');d.reactiveRules=[];
 blade.combat.traits={melee:true,finesse:classId==='rogue',strength:['fighter','paladin','barbarian'].includes(classId)};
 const rx=structuredClone(blade);rx.id='opportunity';rx.cost='reaction';rx.attackAction=false;rx.combat.externalRequirements=['opportunityValidated'];d.abilities.push(rx);
 const slots=derive(d).resources;
 if(classId==='rogue')d.reactiveRules=[sneakAttack(level),...(level>=5?[uncannyDodge(level)]:[])];
 if(classId==='paladin')d.reactiveRules=smiteRules(slots);
 if(['sorcerer','wizard','warlock'].includes(classId))d.reactiveRules=[shield(slots),counterspell(slots,Math.floor((d.scores[d.classes[0].casting.ability]-10)/2))];
 if(classId==='sorcerer')d.castingModifiers=[quickenedSpell('sorcery-points'),heightenedSpell('sorcery-points')];
 if(classId==='barbarian')d.abilities=d.abilities.map(a=>a.id==='rage'?ability('rage',{kind:'class',cost:'bonus',target:'self',resource:{id:'rage',amount:1},combat:profile({stance:rageStance(level)})}):a);
 if(classId==='bard')d.abilities.push(ability('inspire',{kind:'class',cost:'bonus',resource:{id:'inspiration',amount:1},combat:profile({transfer:bardicTransfer(level)})}));
 return d;
}
