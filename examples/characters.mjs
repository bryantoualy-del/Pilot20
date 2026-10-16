import {SRD,HOMEBREW} from '../src/catalog/srd51.js';
const ref=ref=>({ref}),add=(...args)=>({op:'add',args}),mul=(...args)=>({op:'multiply',args});
export const ability=(id,overrides={})=>({id,name:id,kind:'custom',cost:'action',target:'selected',maxTargets:1,attackAction:false,attack:null,resource:null,effects:[],concentration:null,conditions:[],save:null,duration:null,triggers:[],source:HOMEBREW,...overrides});
export const resource=(id,max,recovery='long')=>({id,max,recovery,source:SRD});
const classProfiles={
  bard:{hitDie:8,casting:{ability:'cha',progression:'full'},saves:['dex','cha'],scores:{str:8,dex:14,con:14,int:10,wis:12,cha:18}},
  cleric:{hitDie:8,casting:{ability:'wis',progression:'full'},saves:['wis','cha'],scores:{str:14,dex:10,con:14,int:10,wis:18,cha:10}},
  druid:{hitDie:8,casting:{ability:'wis',progression:'full'},saves:['int','wis'],scores:{str:10,dex:14,con:14,int:12,wis:18,cha:8}},
  wizard:{hitDie:6,casting:{ability:'int',progression:'full'},saves:['int','wis'],scores:{str:8,dex:14,con:14,int:18,wis:12,cha:10}},
  monk:{hitDie:8,casting:null,saves:['str','dex'],scores:{str:10,dex:18,con:14,int:10,wis:16,cha:8}},
  ranger:{hitDie:10,casting:{ability:'wis',progression:'half'},saves:['str','dex'],scores:{str:10,dex:18,con:14,int:10,wis:14,cha:10}},
  fighter:{hitDie:10,casting:null,saves:['str','con'],scores:{str:18,dex:12,con:16,int:10,wis:10,cha:8}},
  sorcerer:{hitDie:6,casting:{ability:'cha',progression:'full'},saves:['con','cha'],scores:{str:8,dex:14,con:14,int:10,wis:10,cha:18}},
  warlock:{hitDie:8,casting:{ability:'cha',progression:'pact'},saves:['wis','cha'],scores:{str:8,dex:14,con:14,int:10,wis:10,cha:18}},
  rogue:{hitDie:8,casting:null,saves:['dex','int'],scores:{str:10,dex:18,con:14,int:12,wis:12,cha:10}},
  barbarian:{hitDie:12,casting:null,saves:['str','con'],scores:{str:18,dex:14,con:16,int:8,wis:12,cha:10}},
  paladin:{hitDie:10,casting:{ability:'cha',progression:'half'},saves:['wis','cha'],scores:{str:18,dex:10,con:14,int:8,wis:10,cha:16}}
};
/** Fixtures are synthetic builds, not imports of personal characters. One shared data factory. */
export function characterFixture(classId,{id=classId+'-fixture',level=5,name=classId}={}) {
  const p=classProfiles[classId];if(!p)throw Error('Unknown fixture profile');
  const d={kind:'character',schemaVersion:2,ruleset:'dnd5e-2014',id,revision:1,identity:{name,portrait:'',description:'Synthetic integration build'},
    ancestry:{id:'srd51:human',subraceId:null,source:SRD},classes:[{id:classId,level,subclassId:null,hitDie:p.hitDie,casting:p.casting===null?null:{...p.casting},source:SRD}],
    background:'',alignment:null,scores:{...p.scores},skills:{athletics:1,perception:classId==='rogue'?2:0},saveProficiencies:[...p.saves],
    proficiencies:['simple-weapons'],features:[],equipment:[],spells:{known:[],prepared:[]},
    progression:Array.from({length:level},(_,i)=>({classId,hp:i===0?p.hitDie:p.hitDie/2+1})),choices:[],choiceRules:[],resources:[],abilities:[],modifiers:[],
    defenses:{resistances:[],immunities:[],vulnerabilities:[]},movement:{walk:30,ignoreHeavyPenalty:false},armorRules:[],buildRules:[]};
  const melee=['fighter','paladin','barbarian'].includes(classId);
  d.equipment.push({id:'blade',kind:'weapon',equipped:true,source:SRD,armor:null,weapon:{ability:melee?'str':'dex',proficient:true,bonus:0,dice:'1d8',damageType:melee?'slashing':'piercing'}});
  if(['fighter','paladin'].includes(classId)) d.equipment.push({id:'chain',kind:'armor',equipped:true,source:SRD,weapon:null,armor:{base:16,dexCap:0,bonus:0,minStrength:13,heavy:true}});
  d.abilities.push(ability('blade',{kind:'weapon',attackAction:true,attack:{bonus:ref('weaponAttack.blade')},effects:[{kind:'damage',damageType:melee?'slashing':'piercing',dice:{count:1,sides:8,bonus:ref('weaponDamage.blade')}}],source:SRD}));
  if(['fighter','paladin','barbarian','monk','ranger'].includes(classId)) d.modifiers.push({id:'extra-attack',stat:'attacksPerAction',operation:'max',value:classId==='fighter' && level>=20?4:classId==='fighter' && level>=11?3:level>=5?2:1,reason:'Class progression fixture; fighter level 11/20 tested separately',source:SRD});
  if(classId==='fighter') {
    d.resources.push(resource('second-wind',1,'short'),resource('action-surge',level>=17?2:1,'short'),{...resource('maneuver-pool',4,'short'),source:HOMEBREW});
    d.abilities.push(ability('second-wind',{kind:'class',cost:'bonus',target:'self',resource:{id:'second-wind',amount:1},effects:[{kind:'heal',dice:{count:1,sides:10,bonus:ref('class.fighter')}}],source:SRD}),
      ability('action-surge',{kind:'class',cost:'none',target:'self',resource:{id:'action-surge',amount:1},effects:[{kind:'grantAction',parameters:{budget:'action'}}],source:SRD}),
      ability('maneuver-case',{kind:'class',triggers:['weapon-hit'],resource:{id:'maneuver-pool',amount:1},effects:[{kind:'modifier',parameters:{target:'damage'}}]}));
  }
  if(p.casting) {
    d.spells.known.push('spell-attack');
    d.abilities.push(ability('spell-attack',{kind:'spell',combat:{version:1,mode:'automatic',requirements:[],spell:{id:'spell-attack',classId,level:0,access:'known'}},attack:{bonus:ref('spellAttack.'+classId)},effects:[{kind:'damage',damageType:'fire',dice:'2d10'}],source:HOMEBREW}));
  }
  if(classId==='sorcerer') {
    d.resources.push(resource('sorcery-points',ref('class.sorcerer')));
    d.abilities.push(ability('metamagic-case',{kind:'class',triggers:['cast-spell'],resource:{id:'sorcery-points',amount:1},effects:[{kind:'modifier',parameters:{target:'spell'}}]}));
  }
  if(classId==='warlock') {
    d.features.push('invocation-reference');
    d.abilities.push(ability('pact-cast',{kind:'spell',resource:{id:'pact:warlock',amount:1},conditions:['spell-known-and-level-allowed'],effects:[{kind:'damage',amount:10,damageType:'force'}]}));
  }
  if(classId==='rogue') d.abilities.push(ability('sneak-case',{kind:'class',cost:'none',conditions:['qualifying-weapon-hit'],triggers:['once-per-turn'],effects:[{kind:'damage',dice:'3d6',damageType:'piercing'}],source:SRD}),
    ability('reaction-case',{kind:'custom',cost:'reaction',attack:{bonus:ref('weaponAttack.blade')},effects:[{kind:'damage',dice:'1d8+4',damageType:'piercing'}]}));
  if(classId==='barbarian') {
    d.resources.push(resource('rage',level<3?2:level<6?3:4));
    d.armorRules.push({id:'unarmored-defense',base:10,abilities:['dex','con'],shieldAllowed:true,source:SRD});
    d.abilities.push(ability('rage',{kind:'class',cost:'bonus',target:'self',resource:{id:'rage',amount:1},duration:{unit:'minute',value:1},effects:[{kind:'modifier',parameters:{target:'melee-damage'}},{kind:'condition',parameters:{id:'raging'}}],source:SRD}));
  }
  if(classId==='paladin') {
    d.resources.push(resource('lay-on-hands',mul(5,ref('class.paladin'))));
    d.abilities.push(ability('lay-on-hands-one',{kind:'class',resource:{id:'lay-on-hands',amount:1},effects:[{kind:'heal',amount:1}],source:SRD}),
      ...(level>=2?[ability('smite-case',{kind:'class',cost:'none',resource:{id:'slot1',amount:1},triggers:['melee-weapon-hit'],effects:[{kind:'damage',dice:'2d8',damageType:'radiant'}],source:SRD})]:[]));
  }
  const extra={
    bard:{resource:'inspiration',max:4,recovery:level>=5?'short':'long',trigger:'ally-attacks'},
    cleric:{resource:'channel',max:level<2?0:level>=18?3:level>=6?2:1,recovery:'short',trigger:'turn-start'},
    druid:{resource:'wild-shape',max:level<2?0:2,recovery:'short',trigger:'turn-start'},
    wizard:{resource:'arcane-recovery',max:1,recovery:'long',trigger:'spell-cast'},
    monk:{resource:'ki',max:level>=2?level:0,recovery:'short',trigger:'attack-hit'},
    ranger:{resource:'custom-feature',max:1,recovery:'long',trigger:'attack-hit'}
  }[classId];
  if(extra) {
    d.resources.push({...resource(extra.resource,extra.max,extra.recovery),source:['ranger','wizard'].includes(classId)?HOMEBREW:SRD});
    d.abilities.push(ability('class-reference',{kind:'class',cost:'none',target:'self',triggers:[extra.trigger],effects:[],source:SRD}));
  }
  if(classId==='monk') d.armorRules.push({id:'unarmored-defense',base:10,abilities:['dex','wis'],shieldAllowed:false,source:SRD});
  return d;
}
export const referenceClasses=Object.keys(classProfiles);
