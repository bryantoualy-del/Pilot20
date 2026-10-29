/** Pins Forge definitions into the existing actor contract before session creation.
 * Caller supplies base statistics EXCLUDING these items; never pass sheet totals.
 * No saved character, library instance or live Companion is mutated. */
import {validateDefinition} from '../model.js';
import {compileCapability,weaponCapability} from './automation.js';
import {itemSource,resolvePassive} from './engine.js';
import {assertItem,baseProfile} from './model.js';
export function prepareForgeActor(base,entries,context={}) {
  const definition=structuredClone(base),resources={},forms=[],diagnostics=[];
  const seen=new Set(),sources=[];
  let shields=0,shieldBase=0,armors=0;
  const shieldHeld=entries.some(({definition:d,instance:i})=>d.category==='shield'&&i.equipped&&i.active!==false&&!i.consumed&&i.quantity>0);
  for(const {definition:item,instance} of entries){
    assertItem(item);
    if(seen.has(instance.instanceId))throw Error('Duplicate item instance');seen.add(instance.instanceId);
    if(instance.ownerId!==base.id)throw Error('Item owner mismatch');
    const source=itemSource(item,instance,context);
    const prefix=instance.instanceId+':';
    sources.push({...source,contributions:source.contributions.filter(c=>!c.effect.modeId)});
    const physical=baseProfile(item)?.params.payload;
    const worn=instance.equipped&&instance.active!==false&&!instance.consumed&&instance.quantity>0&&instance.definitionId===item.id&&instance.definitionVersion===item.version;
    if(item.category==='shield'&&worn){shields++;shieldBase+=physical?.shieldBase??2;}
    if(item.category==='armor'&&worn&&physical?.baseAC!=null){
      if(++armors>1)throw Error('Only one armor may contribute');
      const dex=context.scores?.dex;
      if(physical.dexCap!==0&&!Number.isFinite(dex))throw Error('Dextérité requise pour la CA');
      const modifier=physical.dexCap===0?0:Math.floor((dex-10)/2);
      definition.ac=physical.baseAC+(physical.dexCap==null?modifier:Math.min(modifier,physical.dexCap));
      if(physical.minimumStrength&&(!Number.isFinite(context.scores?.str)||context.scores.str<physical.minimumStrength))diagnostics.push({id:item.id,reason:'Force minimale : pénalité de vitesse à arbitrer selon le porteur'});
      if(physical.stealthDisadvantage)diagnostics.push({id:item.id,reason:'Désavantage aux tests de Discrétion'});
    }
    const candidates=item.abilities.map(a=>({ability:a,context}));
    // Each mode has its own weapon action, gated by runtime form state.
    for(const mode of item.modes.length?item.modes:[null]){
      try{
        const i={...instance,modeIds:mode?[mode.id]:instance.modeIds};
        const w=weaponCapability(item,i,{availableHands:shieldHeld?1:2,...context,...context.itemContexts?.[item.id]});w.ability.id=mode?'weapon-'+mode.id:'weapon-attack';
        // Eligibility is checked for this candidate mode; the engine checks active form at use.
        candidates.push({...w,instance:i});
      }catch(e){if(item.category==='weapon')diagnostics.push({id:item.id,reason:e.message});}
    }
    for(const r of item.resources){
      const key=prefix+r.id;
      if(Object.hasOwn(definition.resources,key))throw Error('Item resource collision');
      const recharge=['dawn','dusk','short-rest','long-rest'].includes(r.recovery.event)&&r.recovery.formula!==null?
        {recharge:{event:r.recovery.event,formula:r.recovery.formula}}:{};
      definition.resources[key]={max:r.maximum,recovery:'none',...recharge};
      resources[key]=instance.resources[r.id];
    }
    for(const candidate of candidates){
      const d=compileCapability(item,candidate.ability,{instance:candidate.instance??instance,context:candidate.context});
      diagnostics.push({id:prefix+candidate.ability.id,status:d.status,reasons:[...d.missing,...d.limitations]});
      if(d.status!=='automatic')continue;
      const key=prefix+candidate.ability.id;
      if(Object.hasOwn(definition.abilities,key))throw Error('Item ability collision');
      const ability=structuredClone(d.ability);
      if(ability.resource)ability.resource.id=prefix+ability.resource.id;
      definition.abilities[key]=ability;
      if(ability.combat.form && instance.modeIds.includes(ability.combat.form.id))forms.push(structuredClone(ability.combat.form));
    }
  }
  if(shields>1)throw Error('Only one shield may contribute');
  const passive=resolvePassive(sources);
  for(const [key,value] of Object.entries(passive.bonuses)){
    if(key==='ac:wearer')definition.ac+=value;
    else if(key==='save:wearer')for(const k of Object.keys(definition.saves))definition.saves[k]+=value;
    else if(!key.includes(':this-weapon:'))diagnostics.push({id:key,reason:'Contribution passive non raccordée au profil de combat'});
  }
  definition.ac+=shieldBase;
  for(const k of ['resistances','immunities'])definition[k]=[...new Set([...definition[k],...passive[k]])];
  diagnostics.push(...passive.pending);
  if(new Set(forms.map(f=>f.key)).size!==forms.length)throw Error('Incompatible initial forms');
  return {definition:validateDefinition(definition),resources,forms,diagnostics};
}
