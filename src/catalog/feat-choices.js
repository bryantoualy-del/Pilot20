import {ABILITIES,SKILLS} from '../character/contracts.js';
import {LANGUAGES} from './origins.js';
import {TOOL_PROFICIENCIES} from './proficiencies.js';
import {WEAPONS} from './equipment.js';
const abilityOf={bard:'cha',cleric:'wis',druid:'wis',sorcerer:'cha',warlock:'cha',wizard:'int',artificer:'int'};
const attackCantrip=s=>s.data.level===0&&(s.data.resolution.kind==='spell-attack'||['Booming Blade','Green-Flame Blade','Primal Savagery','Magic Stone'].includes(s.name.en));
const total=classes=>classes.reduce((n,c)=>n+c.level,0);
export function featInstances(index,{classes,selections},origin){
 const out=(origin.featIds??[]).map(id=>({id,classId:classes[0].id,level:1,key:'origin'}));
 for(const c of classes)for(const q of index.class(c.id).data.choices??[])if(q.kind==='asi'&&q.level<=c.level)for(const id of selections[c.id+':'+q.key]??[])if(index.get(id)?.type==='feat')out.push({id,classId:c.id,level:q.level,key:c.id+':'+q.key});
 return out.map(r=>({...r,prefix:index.get(r.id)?.data.repeatable?r.key+':'+r.id:r.id}));
}
function trained(index,classes,origin,selections){
 const skills=new Set(origin.background.skills),profs=new Set(origin.background.proficiencies);
 for(const[c,n]of classes.map((c,n)=>[c,n])){for(const p of index.class(c.id).data[n?'multiclassProficiencies':'initialProficiencies'])profs.add(p);for(const row of [...index.class(c.id).data.grants,...(index.get(c.subclassId)?.data.grants??[])])if(row.level<=c.level)for(const fid of row.featureIds){const e=index.get(fid)?.data.buildEffects;for(const p of e?.proficiencies??[])profs.add(p);for(const s of [...e?.skills??[],...e?.expertiseSkills??[]])skills.add(s);}for(const q of [{key:'skills',kind:'skill'},...index.class(c.id).data.choices,...index.get(c.subclassId)?.data.choices??[]])for(const v of selections[c.id+':'+q.key]??[]){if(['skill','training'].includes(q.kind)&&Object.hasOwn(SKILLS,v))skills.add(v);if(q.kind==='proficiency'||q.kind==='training'&&!Object.hasOwn(SKILLS,v))profs.add(v);}}
 return{skills,profs};
}
export function featEligible(index,feat,{classes,scores,origin,selections,excludeId=feat.id}){
 const d=feat.data,r=d.requirements??{},family=origin.race?.id.split(':').at(-1)??'',sub=origin.subrace?.id??'';
 if((d.requiresScores??[]).some(p=>scores[p.score]<p.minimum)||(r.scores??[]).some(p=>scores[p.score]<p.minimum))return false;
 if(r.scoreAny&&!r.scoreAny.some(p=>scores[p.score]>=p.minimum))return false;
 if(r.minimumCharacterLevel&&total(classes)<r.minimumCharacterLevel)return false;
 if(r.giantStrike&&(!(Object.values(selections??{}).flat().includes('bgg:feat:strike-of-the-giants'))||!(selections['bgg:feat:strike-of-the-giants:giant']??[]).includes(r.giantStrike)))return false;
 if(r.raceFamilies&&!r.raceFamilies.includes(family))return false;
 if(r.subraceTokens&&!r.subraceTokens.some(t=>sub.includes(t)))return false;
 if(r.smallOrDwarf&&family!=='dwarf'&&origin.size!=='small')return false;
 const classCasting=classes.some(c=>{const data=index.get(c.subclassId)?.data.casting??index.class(c.id).data.casting;return data&&c.level>=(data.startsAtClassLevel??(data.progression==='half'?2:data.progression==='third'?3:1));});
 if(r.classCasting&&!classCasting)return false;
 if(r.casting&&!classCasting&&!origin.spells?.length&&!Object.values(selections).flat().some(id=>id!==excludeId&&index.get(id)?.data.spellPackage)&&!r.backgroundNames?.includes(origin.background?.name))return false;
 const{profs}=trained(index,classes,origin,selections);for(const id of Object.values(selections).flat()){const e=index.get(id);if(id===excludeId)continue;for(const p of e?.data.buildEffects?.proficiencies??[])profs.add(p);if(Object.values(WEAPONS).some(w=>w.proficiency===id))profs.add(id);}
 if(r.armor&&!profs.has('all-armor')&&!profs.has(r.armor))return false;
 if(r.martialWeapon&&!profs.has('martial-weapons')&&!Object.values(WEAPONS).some(w=>w.category==='martial'&&profs.has(w.proficiency))&&!r.backgroundNames?.includes(origin.background?.name))return false;
 return true;
}
/** Feat decisions are inert inputs to the same character compiler, never a second character store. */
export function resolveFeatChoices(index,{classes,scores,selections,campaignOptions=[],featRitualCopies=[]},origin){
 const instances=featInstances(index,{classes,selections},origin),choices=[],resources=[],spells=[],issues=[],featureOwners={},featureResourceOverrides={},additionalSaves=[],featScores={...scores},effects=[],seen=new Set(),pb=2+Math.floor((total(classes)-1)/4),allTraining=trained(index,classes,origin,selections),expertise=new Set();
 for(const [id,values]of Object.entries(selections))if(id.includes('expertise'))for(const v of values)expertise.add(v);
 for(const instance of instances){const feat=index.get(instance.id),d=feat.data,{prefix,classId,level}=instance;
  if(seen.has(feat.id)&&!d.repeatable)issues.push({code:'duplicate-feat',featureId:feat.id});seen.add(feat.id);
  if(!featEligible(index,feat,{classes,scores:featScores,origin,selections}))issues.push({code:'feat-prerequisite',featureId:feat.id});
  const ask=(key,kind,count,options,extra={})=>{const q={id:prefix+':'+key,classId,ownerId:feat.id,level,kind,count,options,...extra};choices.push(q);const v=selections[q.id]??[];return Array.isArray(v)&&v.length===count&&new Set(v).size===v.length&&v.every(id=>options.includes(id))?v:[];};
  const pool=(key,maximum,recovery='long')=>{const id=prefix+':'+key;resources.push({id,max:maximum,recovery,unlimited:false,classId,ownerId:feat.id});return id;};
  let ability=d.abilityOptions?(d.abilityOptions.length===1?d.abilityOptions[0]:ask('ability','feat-ability',1,d.abilityOptions)[0]):null;
  if(ability){if(featScores[ability]>=20)issues.push({code:'feat-score-cap',featureId:feat.id,choiceId:prefix+':ability'});else featScores[ability]++;if(d.saveFromAbility)additionalSaves.push(ability);}
  for(const cap of d.draconicCapabilities??[])pool(cap.key,cap.maximum==='proficiency'?pb:cap.maximum,cap.recovery);
  if(d.featResource)pool('uses',d.featResource.maximum==='proficiency'?pb:d.featResource.maximum,d.featResource.recovery);
  if(d.elementalChoice)ask('element','feat-option',1,['acid','cold','fire','lightning','thunder'].filter(type=>!instances.some(other=>other.prefix!==prefix&&other.id===feat.id&&(selections[other.prefix+':element']??[]).includes(type))));
  if(d.giantStrikeChoices)ask('giant','feat-option',1,d.giantStrikeChoices);
  for(const[key,count,options,kind]of [
   ['training',d.trainingCount,[...Object.keys(SKILLS),...TOOL_PROFICIENCIES],'training'],['skill',d.skillCount,d.skillOptions??Object.keys(SKILLS),'skill'],['tool',d.toolCount,TOOL_PROFICIENCIES,'proficiency'],['artisan-tool',d.artisanToolCount,TOOL_PROFICIENCIES.slice(0,17),'proficiency'],['language',d.languageCount,LANGUAGES.map(k=>'language:'+k),'proficiency'],['weapons',d.weaponCount,[...new Set(Object.values(WEAPONS).map(w=>w.proficiency))],'proficiency'],
  ])if(count){const previous=selections[prefix+':'+key]??[],owned=key==='skill'||key==='training'?new Set([...allTraining.skills,...allTraining.profs]):key==='language'?new Set((origin.languages??[]).map(l=>'language:'+l)):allTraining.profs;const values=ask(key,kind,count,options.filter(v=>key==='weapons'||!owned.has(v)));for(const v of values)if(Object.hasOwn(SKILLS,v))allTraining.skills.add(v);else allTraining.profs.add(v);}
  // All selected feat skills may qualify for expertise even while editing another decision.
  for(const other of instances)for(const key of ['skill','training'])for(const v of selections[other.prefix+':'+key]??[])if(Object.hasOwn(SKILLS,v))allTraining.skills.add(v);
  if(d.expertiseCount)ask('expertise','expertise',d.expertiseCount,[...allTraining.skills].filter(s=>!expertise.has(s)||(selections[prefix+':expertise']??[]).includes(s)));
  for(const [key,count,filter]of [['maneuvers',d.maneuverCount,f=>f.id.includes(':fighter:maneuver:')],['metamagic',d.metamagicCount,f=>f.data.optionKind==='metamagic'],['fighting-style',d.fightingStyleCount,f=>f.data.classId==='fighter'&&!!f.data.uniqueRuleKey],['invocation',d.invocationCount,f=>f.data.optionKind==='invocation']])if(count){
   let options=index.list('feature').filter(filter).filter(f=>!Object.entries(selections).filter(([id])=>id!==prefix+':'+key).flatMap(([,v])=>v).includes(f.id));
   if(key==='fighting-style')options=options.filter(f=>!Object.entries(selections).filter(([id])=>id!==prefix+':'+key).flatMap(([,v])=>v).some(id=>index.get(id)?.data.uniqueRuleKey===f.data.uniqueRuleKey));
   if(key==='invocation')options=options.filter(f=>{const req=f.data,hasPrereq=req.minimumClassLevel>2||(req.selectionRequires??[]).length||(req.selectionRequiresAny??[]).length,w=classes.find(c=>c.id==='warlock');if(!hasPrereq)return true;if(!w||w.level<(req.minimumClassLevel<=2?0:req.minimumClassLevel))return false;const owned=new Set([...Object.values(selections).flat(),...(index.get(w.subclassId)?.data.grants??[]).filter(r=>r.level<=w.level).flatMap(r=>r.featureIds)]);return(req.selectionRequires??[]).every(id=>owned.has(id))&&(!req.selectionRequiresAny||req.selectionRequiresAny.some(id=>owned.has(id)));});
   const v=ask(key,'feature',count,options.map(f=>f.id),{replacementRule:{levels:null,atASI:key!=='invocation',anyClass:true,maximum:1}});for(const id of v){featureOwners[id]=classId;if(key==='maneuvers')featureResourceOverrides[id]=prefix+':uses';}
  }
  const addSpell=(id,castAbility,resourceId=null,ritualOnly=false,note='',tag='magic')=>{if(!index.get(id))return;spells.push({id,level,ability:castAbility,ownerId:feat.id,featureOwnerId:feat.id,...(resourceId?{resourceId}:{}),...(ritualOnly?{ritualOnly:true}:{}),source:feat.source,requirements:note||d.description});};
  const selectSpells=(key,count,lists,min,max,{schools=null,ritual=false,attack=false,...extra}={})=>{const options=index.list('spell').filter(s=>s.data.level>=min&&s.data.level<=max&&s.data.classIds.some(id=>lists.includes(id))&&(!schools||schools.includes(s.data.school))&&(!ritual||s.data.ritual)&&(!attack||attackCantrip(s))).map(s=>s.id);return ask(key,'feat-spell',count,options,extra);};
  let pkg=d.spellPackage;
  if(pkg==='draconic-healing'){const castAbility=ask('casting-ability','feat-option',1,d.castingAbilityOptions)[0];if(castAbility)addSpell(d.draconicHealing.spellId,castAbility,pool('draconic-healing',1),false,d.description);}
  if(d.runeShaper){
   const castAbility=ask('casting-ability','feat-option',1,['int','wis','cha'])[0];
   const runeSpells=['srd51:fog-cloud','srd51:inflict-wounds','phb14:spell:chromatic-orb','srd51:disguise-self','srd51:burning-hands','srd51:speak-with-animals','phb14:spell:armor-of-agathys','srd51:goodberry','srd51:longstrider','srd51:command','srd51:entangle','srd51:sanctuary','srd51:thunderwave'].filter(id=>index.get(id)?.type==='spell');
   const chosen=ask('runes','feat-spell',Math.floor(pb/2),runeSpells);
   if(castAbility){
    addSpell('srd51:comprehend-languages',castAbility,pool('comprehend-languages',1),false,'Une incantation gratuite par repos long, ou un emplacement de sort.');
    for(const id of chosen)addSpell(id,castAbility,pool('rune-'+id.replace(/[^a-z0-9]+/g,'-'),1),false,'Rune inscrite après un repos long : une incantation gratuite par sort et par repos long, ou un emplacement.');
   }
  }

  if(['magic-initiate','ritual-caster','spell-sniper'].includes(pkg)){
   const cls=ask('spell-class','feat-option',1,['bard','cleric','druid','sorcerer','warlock','wizard'].filter(cls=>pkg!=='spell-sniper'||index.list('spell').some(s=>s.data.classIds.includes(cls)&&attackCantrip(s))))[0];if(cls){const castAbility=abilityOf[cls];if(pkg==='magic-initiate'){for(const id of selectSpells('cantrips',2,[cls],0,0))addSpell(id,castAbility);for(const id of selectSpells('spell',1,[cls],1,1))addSpell(id,castAbility,pool('spell',1),'',d.description);}
    if(pkg==='spell-sniper')for(const id of selectSpells('cantrip',1,[cls],0,0,{attack:true}))addSpell(id,castAbility);
    if(pkg==='ritual-caster'){for(const id of selectSpells('rituals',2,[cls],1,1,{ritual:true}))addSpell(id,castAbility,null,true);for(const row of featRitualCopies.filter(r=>r.featId===feat.id)){const s=index.get(row.spellId);if(!s||s.data.level>Math.ceil(total(classes)/2)||!s.data.ritual||!s.data.classIds.includes(cls)||!row.note?.trim())issues.push({code:'invalid-ritual-copy',id:row.spellId});else addSpell(s.id,castAbility,null,true,row.note,'ritual-copy');}}
   }
  }
  if(pkg==='artificer-initiate'){for(const id of selectSpells('cantrip',1,['artificer'],0,0,{replacementRule:{levels:null,anyClass:true,maximum:1,group:prefix+':artificer-versatility'}}))addSpell(id,'int');for(const id of selectSpells('spell',1,['artificer'],1,1,{replacementRule:{levels:null,anyClass:true,maximum:1,group:prefix+':artificer-versatility'}}))addSpell(id,'int',pool('spell',1));}
  if(['fey-touched','shadow-touched'].includes(pkg)){const fixed=pkg==='fey-touched'?'srd51:misty-step':'srd51:invisibility';if(ability)addSpell(fixed,ability,pool('fixed-spell',1));for(const id of selectSpells('spell',1,index.list('class').map(c=>c.data.classId),1,1,{schools:pkg==='fey-touched'?['divination','enchantment']:['illusion','necromancy']}))if(ability)addSpell(id,ability,pool('chosen-spell',1));}
  if(pkg==='telekinetic'&&ability)addSpell('srd51:mage-hand',ability);
  if(pkg==='telepathic'&&ability)addSpell('srd51:detect-thoughts',ability,pool('spell',1));
  if(pkg==='fey-teleportation')addSpell('srd51:misty-step','int',pool('spell',1,'short'));
  if(pkg==='drow-high-magic'){addSpell('srd51:detect-magic','cha');for(const id of ['srd51:levitate','srd51:dispel-magic'])addSpell(id,'cha',pool(id.split(':').at(-1),1));}
  if(pkg==='wood-elf-magic'){for(const id of selectSpells('cantrip',1,['druid'],0,0))addSpell(id,'wis');for(const id of ['srd51:longstrider','srd51:pass-without-trace'])addSpell(id,'wis',pool(id.split(':').at(-1),1));}
  effects.push({id:feat.id,ownerClassId:classId});
 }
 return{choices,resources,spells,issues,featureOwners,featureResourceOverrides,additionalSaves,scores:featScores,features:[...new Set(instances.map(i=>i.id))],effects};
}
