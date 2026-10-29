/** Builds a detached session participant using the existing character + item contracts.
 * Selected Forge equipment replaces ordinary equipped gear of the same kind only in
 * this session. Library character, item definitions and previous sessions stay intact. */
import {assertItem,instanceOf} from './model.js';
export function forgeParticipant(character,items,settings={}) {
 const base=structuredClone(character),kinds=new Set(items.map(d=>d.category));
 for(const gear of base.equipment)if(kinds.has(gear.kind)||kinds.has('staff')&&gear.kind==='weapon')gear.equipped=false;
 const itemContexts={};
 const forgeItems=items.map(definition=>{
  assertItem(definition);const config=settings[definition.id]??{};
  itemContexts[definition.id]={...(config.hands?{hands:config.hands}:{}),...(config.attackAbility?{attackAbility:config.attackAbility}:{})};
  return {definition:structuredClone(definition),instance:{...instanceOf(definition,'hero'),equipped:true,attuned:config.attuned===true}};
 });
 return {instanceId:'hero',character:base,forgeItems,forgeBaseStatistics:true,forgeContext:{itemContexts,...(base.equipment.some(e=>e.kind==='shield'&&e.equipped)?{availableHands:1}:{})}};
}
