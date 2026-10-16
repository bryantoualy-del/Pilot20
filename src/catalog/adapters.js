/** Whitelisted adapters reuse V0.2b rules. JSON packs cannot define handlers. */
import {check} from '../character/contracts.js';
import {derive,modifier} from '../character/derive.js';
import {sneakAttack,uncannyDodge,smiteRules,shield,counterspell} from '../rules/srd-reactions.js';
import {bardicTransfer,rageStance,quickenedSpell,heightenedSpell} from '../rules/conditional.js';
const profile=(overrides={})=>({version:1,mode:'automatic',requirements:[],...overrides});
export const ability=(entry,overrides={})=>({id:entry.id,name:entry.name.en,kind:entry.type==='spell'?'spell':'class',cost:'none',target:'self',maxTargets:1,attackAction:false,attack:null,resource:null,effects:[],concentration:null,conditions:[],save:null,duration:null,triggers:[],source:entry.source,...overrides});
const spellFamilies={
 'srd51:fire-bolt':{dice:10,damageType:'fire',cantrip:true,attack:true},
 'srd51:ray-of-frost':{dice:8,damageType:'cold',cantrip:true,attack:true,manualRider:true},
 'srd51:shocking-grasp':{dice:8,damageType:'lightning',cantrip:true,attack:true,manualRider:true},
 'srd51:sacred-flame':{dice:8,damageType:'radiant',cantrip:true,save:'dex',manualRider:true},
 'srd51:acid-splash':{dice:6,damageType:'acid',cantrip:true,save:'dex',maxTargets:2},
 'srd51:fireball':{dice:6,count:8,damageType:'fire',save:'dex',half:true,maxTargets:20,upcast:true},
 'srd51:lightning-bolt':{dice:6,count:8,damageType:'lightning',save:'dex',half:true,maxTargets:20,upcast:true},
 'srd51:burning-hands':{dice:6,count:3,damageType:'fire',save:'dex',half:true,maxTargets:20,upcast:true},
 'srd51:cure-wounds':{dice:8,count:1,healing:true,abilityBonus:true,upcast:true},
 'srd51:healing-word':{dice:4,count:1,healing:true,abilityBonus:true,upcast:true},
 'srd51:mass-healing-word':{dice:4,count:1,healing:true,abilityBonus:true,upcast:true,maxTargets:6},
 'srd51:mass-cure-wounds':{dice:8,count:3,healing:true,abilityBonus:true,upcast:true,maxTargets:6},
 'srd51:false-life':{dice:4,count:1,tempHp:true,flatBonus:4,manualUpcast:true}
};
export const SPELL_FAMILY_IDS=Object.keys(spellFamilies);
export function compileSpell(entry,classId,character,{arcanumLevel=null}={}) {
 const d=entry.data,L=character.classes.reduce((n,c)=>n+c.level,0),f=spellFamilies[entry.id];
 const casting=character.classes.find(c=>c.id===classId).casting;
 const access=['cleric','druid','paladin','wizard'].includes(classId)?'prepared':'known';
 const spell={id:entry.id,classId,level:d.level,access};
 const cost=d.castingTime.startsWith('1 bonus action')?'bonus':d.castingTime.startsWith('1 reaction')?'reaction':d.castingTime==='1 action'?'action':'none';
 const a=ability(entry,{id:classId+':'+entry.id,cost,target:'selected',maxTargets:f?(f.maxTargets??1):20,combat:profile({mode:'manual',requirements:['Player/GM resolves effect, components, targets, casting time and duration.'],spell})});
 // Manual concentration starts only on explicit declaration; long durations require GM expiry.
 if(d.concentration)a.concentration={effectId:entry.id,start:'activation'};
 if(cost==='none')a.combat.externalRequirements=['castingTimeAdjudicated'];
 if(entry.id==='srd51:false-life')a.target='self';
 if(f) {
  const count=f.cantrip?(L>=17?4:L>=11?3:L>=5?2:1):f.count;
  a.combat=profile({spell,externalRequirements:['spellEligibilityValidated']});
  if(f.manualRider)a.combat.externalRequirements.push('spellRiderResolved');
  if(f.manualUpcast)a.combat.externalRequirements.push('baseLevelOnlyValidated');
  if(f.upcast)a.combat.upcast={effectIndex:0,dicePerLevel:1};
  if(f.attack)a.attack={bonus:{ref:'spellAttack.'+classId}};
  if(f.save)a.save={ability:f.save,dc:{ref:'spellDC.'+classId},onSuccess:f.half?'half':'none'};
  a.effects=[{kind:f.healing?'heal':f.tempHp?'tempHp':'damage',...(!f.healing&&!f.tempHp?{damageType:f.damageType}:{}),dice:{count,sides:f.dice,bonus:f.abilityBonus?{ref:'mod.'+casting.ability}:f.flatBonus??0}}];
 }
 if(entry.id==='srd51:haste') {
  a.maxTargets=1;
  a.combat=profile({spell,externalRequirements:['spellEligibilityValidated'],duration:{unit:'minute',value:1,anchor:'source',boundary:'start'},ongoing:[{id:'haste',stack:{key:'srd51:haste',policy:'priority',priority:1},duration:{unit:'minute',value:1,anchor:'source',boundary:'start'},modifiers:[{stat:'ac',operation:'add',value:2},{stat:'speed',operation:'multiply',value:2},{stat:'save.dex',operation:'advantage',value:1}],conditions:[],concentration:true,actionGrant:{kinds:['weaponAttack','dash','disengage','hide','useObject'],attacks:1},onEnd:'no-actions-until-next-turn-end'}]});
 }
 if(arcanumLevel!==null) {
  a.combat=profile({mode:'manual',spell:{id:entry.id,classId,level:arcanumLevel,access:'granted',slotPolicy:'free'},externalRequirements:['arcanumCastingValidated',...(cost==='none'?['castingTimeAdjudicated']:[])],requirements:['GM resolves Mystic Arcanum effect at its fixed real spell level.']});
  a.resource={id:'warlock:arcanum-'+arcanumLevel,amount:1};a.effects=[];a.attack=null;a.save=null;
 }
 return a;
}
export function attachClassAdapters(character,index) {
 const d=character;d.reactiveRules=[];d.castingModifiers=[];
 const stats=derive(d),available=id=>d.features.includes(id),push=(id,overrides)=>{const e=index.get(id);check(e,'Missing adapter entry');d.abilities.push(ability(e,overrides));};
 for(const c of d.classes) {
  const L=c.level,prefix=c.id+':';
  if(c.id==='fighter') {
   if(available('srd51:fighter:second-wind'))push('srd51:fighter:second-wind',{cost:'bonus',resource:{id:prefix+'second-wind',amount:1},effects:[{kind:'heal',dice:{count:1,sides:10,bonus:L}}],combat:profile()});
   if(L>=2&&available('srd51:fighter:action-surge'))push('srd51:fighter:action-surge',{resource:{id:prefix+'action-surge',amount:1},combat:profile({grant:{count:1,maxPerTurn:1}})});
  }
  if(c.id==='rogue')d.reactiveRules.push(...(available('srd51:rogue:sneak-attack')?[sneakAttack(L)]:[]),...(L>=5&&available('srd51:rogue:uncanny-dodge')?[uncannyDodge(L)]:[]));
  if(c.id==='paladin'&&L>=2&&available('srd51:paladin:divine-smite'))d.reactiveRules.push(...smiteRules(stats.resources));
  if(c.id==='paladin'&&available('srd51:paladin:lay-on-hands'))push('srd51:paladin:lay-on-hands',{cost:'action',target:'selected',resource:{id:prefix+'lay-on-hands',amount:1},effects:[{kind:'heal',amount:1}],combat:profile({externalRequirements:['healingTargetEligible']})});
  if(c.id==='barbarian'&&available('srd51:barbarian:rage'))push('srd51:barbarian:rage',{cost:'bonus',resource:L===20?null:{id:prefix+'rage',amount:1},combat:profile({stance:rageStance(L),externalRequirements:['rageEligible']})});
  if(c.id==='bard'&&available('srd51:bard:bardic-inspiration'))push('srd51:bard:bardic-inspiration',{cost:'bonus',target:'selected',resource:{id:prefix+'inspiration',amount:1},combat:profile({transfer:bardicTransfer(L),externalRequirements:['inspirationTargetEligible']})});
  if(c.id==='sorcerer') {
   if(available('srd51:sorcerer:quickened-spell'))d.castingModifiers.push(quickenedSpell(prefix+'sorcery-points'));
   if(available('srd51:sorcerer:heightened-spell'))d.castingModifiers.push(heightenedSpell(prefix+'sorcery-points'));
  }
 }
 // Learned/prepared checks are per class: a Wizard spell cannot accidentally grant Bard access.
 const shieldAvailable=d.abilities.some(a=>a.combat?.spell?.id==='srd51:shield'&&(a.combat.spell.access==='known'||d.spells.prepared.includes('srd51:shield')));
 const counter=d.abilities.find(a=>a.combat?.spell?.id==='srd51:counterspell'&&(a.combat.spell.access==='known'||d.spells.prepared.includes('srd51:counterspell')));
 if(shieldAvailable)d.reactiveRules.push(shield(stats.resources));
 if(counter){const cls=d.classes.find(c=>c.id===counter.combat.spell.classId);d.reactiveRules.push(counterspell(stats.resources,modifier(d.scores[cls.casting.ability])));}
 return d;
}
