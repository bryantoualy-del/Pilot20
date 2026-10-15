import {characterFixture,ability} from './characters.mjs';
import {SRD,HOMEBREW} from '../src/catalog/srd51.js';
export const profile=(overrides={})=>({version:1,mode:'automatic',requirements:[],...overrides});
export const timedEffect=(overrides={})=>({id:'ward',stack:{key:'ward',policy:'priority',priority:1},duration:{unit:'round',value:1,anchor:'target',boundary:'start'},modifiers:[{stat:'ac',operation:'add',value:2}],conditions:[],concentration:false,...overrides});
export const hasteEffect=()=>timedEffect({id:'haste',stack:{key:'srd51:haste',policy:'priority',priority:1},duration:{unit:'minute',value:1,anchor:'source',boundary:'start'},modifiers:[{stat:'ac',operation:'add',value:2},{stat:'speed',operation:'multiply',value:2},{stat:'save.dex',operation:'advantage',value:1}],concentration:true,actionGrant:{kinds:['weaponAttack','dash','disengage','hide','useObject'],attacks:1},onEnd:'no-actions-until-next-turn-end'});
export function advancedCharacter(name,options={}) {
  const d=characterFixture(name,options),classId=d.classes[0].id;
  d.abilities.find(a=>a.id==='blade').combat=profile({actionKind:'weaponAttack',weapon:true});
  for(const kind of ['dash','disengage','hide','useObject']) d.abilities.push(ability(kind,{target:'self',combat:profile({actionKind:kind})}));
  if(name==='fighter') {
    const surge=d.abilities.find(a=>a.id==='action-surge');surge.effects=[];surge.combat=profile({grant:{count:1,maxPerTurn:1}});
  }
  if(d.classes[0].casting) {
    const spell=(id,level,overrides={})=>{
      d.spells.known.push(id);
      return ability(id,{kind:'spell',combat:profile({spell:{id,classId,level,access:'known'}}),source:SRD,...overrides});
    };
    d.abilities.push(spell('fireball',3,{maxTargets:20,save:{ability:'dex',dc:{ref:'spellDC.'+classId},onSuccess:'half'},effects:[{kind:'damage',dice:'8d6',damageType:'fire'}],combat:profile({spell:{id:'fireball',classId,level:3,access:'known'},upcast:{effectIndex:0,dicePerLevel:1}})}));
    d.abilities.push(spell('haste',3,{concentration:{effectId:'haste',start:'activation'},combat:profile({spell:{id:'haste',classId,level:3,access:'known'},duration:{unit:'minute',value:1,anchor:'source',boundary:'start'},ongoing:[hasteEffect()]})}));
    d.abilities.push(spell('cantrip',0,{attack:{bonus:{ref:'spellAttack.'+classId}},effects:[{kind:'damage',amount:4,damageType:'force'}],source:HOMEBREW}));
    d.abilities.push(spell('manual-illusion',1,{combat:profile({mode:'manual',spell:{id:'manual-illusion',classId,level:1,access:'known'},requirements:['MJ adjudicates illusion interaction'],deferred:['decision']}),source:HOMEBREW}));
  }
  return d;
}
