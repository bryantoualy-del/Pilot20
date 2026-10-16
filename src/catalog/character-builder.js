import {validateAdvancementHistory,choiceHistoryNote} from './advancement.js';
import {check,SKILLS} from '../character/contracts.js';
import {validateCharacter,validateBuild} from '../character/definition.js';
import {resolveProgression} from './progression.js';
import {ability,compileSpell,attachClassAdapters} from './adapters.js';
/** Production constructor. No fixture imports, random rolls, implied subclass or automatic player choices. */
export function buildCharacter(index,{id,name,classes,scores,selections={},hpMode='average',hpProgression=null,campaignOptions=[],ancestry=null,background={skills:[],proficiencies:[]},spellbookTranscriptions=[],advancementHistory=[]}) {
 const report=resolveProgression(index,{classes,scores,selections,campaignOptions,background,spellbookTranscriptions});
 if(!report.valid)return {character:null,...report};
 const history=validateAdvancementHistory(index,{classes,scores,selections,campaignOptions,background,spellbookTranscriptions},advancementHistory);
 if(!history.valid)return {...report,character:null,valid:false,issues:history.issues,history};
 check(hpMode==='average'||hpProgression!==null,'Explicit HP progression required');
 const definitions=classes.map(c=>{const entry=index.class(c.id);return {id:c.id,level:c.level,subclassId:c.subclassId??null,hitDie:entry.data.hitDie,casting:entry.data.casting,source:entry.source};});
 const first=index.class(classes[0].id);
 const d={kind:'character',schemaVersion:2,ruleset:'dnd5e-2014',id,revision:1,identity:{name,portrait:'',description:''},ancestry:ancestry??{id:'pilot20:ancestry-unselected',subraceId:null,source:{kind:'homebrew',document:'Pilot20 unselected ancestry marker',license:'project-data',url:''}},classes:definitions,background:background.name??'',alignment:null,scores:report.scores,skills:Object.fromEntries(background.skills.map(k=>[k,1])),saveProficiencies:first.data.saves,proficiencies:[],features:report.features,equipment:[],spells:{known:[],prepared:[]},progression:[],choices:[],choiceRules:[],resources:[],abilities:[],modifiers:[],defenses:{resistances:[],immunities:[],vulnerabilities:[]},movement:{walk:30,ignoreHeavyPenalty:false},armorRules:[],buildRules:[]};
 // Ancestry/background remain editable; no racial bonuses are silently added to supplied scores.
 for(const [n,c] of definitions.entries()) {
  const e=index.class(c.id),data=e.data;
  d.proficiencies.push(...(n===0?data.initialProficiencies:data.multiclassProficiencies));
  d.buildRules.push({id:c.id+':multiclass',when:'multiclass',anyOf:data.multiclassPrerequisites});
  for(let l=0;l<c.level;l++)d.progression.push({classId:c.id,hp:n===0&&l===0?c.hitDie:c.hitDie/2+1});
  const attacks=report.scaling[c.id]?.attacksPerAction;
  if(attacks&&(!data.attackFeatureId||d.features.includes(data.attackFeatureId)))d.modifiers.push({id:c.id+':extra-attack',stat:'attacksPerAction',operation:'max',value:attacks,reason:'Class attack progression; does not stack between classes.',source:e.source});
  if(c.id==='barbarian'&&d.features.includes(data.armorRuleFeatureId))d.armorRules.push({id:'barbarian:unarmored',base:10,abilities:['dex','con'],shieldAllowed:true,source:e.source});
  if(c.id==='monk'&&d.features.includes(data.armorRuleFeatureId))d.armorRules.push({id:'monk:unarmored',base:10,abilities:['dex','wis'],shieldAllowed:false,source:e.source});
 }
 if(advancementHistory.length)d.progression=advancementHistory.map((row,i)=>({classId:row.classId,hp:i===0?definitions.find(c=>c.id===row.classId).hitDie:definitions.find(c=>c.id===row.classId).hitDie/2+1}));
 if(hpProgression!==null){if(advancementHistory.length)check(hpProgression.length===advancementHistory.length&&hpProgression.every((p,i)=>p.classId===advancementHistory[i].classId),'HP progression conflicts with advancement chronology');d.progression=structuredClone(hpProgression);}
 const spellClasses=new Map();
 for(const choice of report.choices) {
  const values=report.selections[choice.id],c=definitions.find(c=>c.id===choice.classId);
  // Character v2 has a maximum of 20 options per choice. Large spellbook choices are paged.
  for(let offset=0;offset<choice.count;offset+=20) {
   const chunkId=choice.count>20?choice.id+':page-'+(offset/20):choice.id;
   const count=Math.min(20,choice.count-offset),historyIndex=advancementHistory.findIndex(row=>row.classId===c.id&&row.classes.find(k=>k.id===c.id)?.level===choice.level),level=historyIndex>=0?historyIndex+1:definitions.slice(0,definitions.indexOf(c)).reduce((n,c)=>n+c.level,0)+choice.level;
   d.choiceRules.push({id:chunkId,level,count,options:choice.options,requires:[],incompatible:[]});
   d.choices.push({id:chunkId,level,optionIds:values.slice(offset,offset+count),note:advancementHistory.length?choiceHistoryNote(advancementHistory,choice.id,choice.classId,{referenceOnly:offset>0}):'Catalog class level '+choice.level});
  }
  if(choice.kind==='skill')values.forEach(k=>{d.skills[k]=Math.max(1,d.skills[k]??0);});
  if(choice.kind==='expertise')values.forEach(k=>{if(Object.hasOwn(SKILLS,k))d.skills[k]=2;else d.proficiencies.push('expertise:'+k);});
  if(choice.kind==='proficiency')d.proficiencies.push(...values);
  if(['spell','spellbook','prepared','spell-mastery','signature-spell','ritual-spell'].includes(choice.kind))for(const spellId of values) {
   const e=index.get(spellId);check(e?.type==='spell','Unknown selected spell');
   if(!spellClasses.has(c.id))spellClasses.set(c.id,new Map());
   const spells=spellClasses.get(c.id),record=spells.get(spellId)??{entry:e,normal:false,prepared:false,ritualOnly:false,arcanumLevel:null,mastery:false,signature:false};
   const arcanum=choice.id.includes(':arcanum-');
   if(arcanum){record.arcanumLevel=e.data.level;d.features.push(spellId);}
   else if(choice.kind==='ritual-spell')record.ritualOnly=true;
   else record.normal=true;
   if(choice.kind==='prepared'||choice.kind==='signature-spell')record.prepared=true;
   if(choice.kind==='spell-mastery')record.mastery=true;
   if(choice.kind==='signature-spell')record.signature=true;
   spells.set(spellId,record);
   d.spells.known.push(spellId);if(choice.kind==='prepared'||choice.kind==='signature-spell'||e.data.level===0)d.spells.prepared.push(spellId);
  }
 }
 for(const g of report.grantedSpells){const entry=index.get(g.id);check(entry?.type==='spell','Granted spell reference');if(!spellClasses.has(g.classId))spellClasses.set(g.classId,new Map());const existing=spellClasses.get(g.classId).get(g.id)??{entry,arcanumLevel:null};spellClasses.get(g.classId).set(g.id,{...existing,normal:true,prepared:true});d.spells.known.push(g.id);d.spells.prepared.push(g.id);}
 d.features=[...new Set(d.features)];d.proficiencies=[...new Set([...d.proficiencies,...background.proficiencies])];d.spells.known=[...new Set(d.spells.known)];d.spells.prepared=[...new Set(d.spells.prepared)];
 for(const r of report.resources)if(!r.unlimited)d.resources.push({id:r.id,max:r.max,recovery:r.recovery,source:index.class(r.classId).source});
 for(const [cls,spells] of spellClasses)for(const record of spells.values()) {
  const {entry,arcanumLevel,ritualOnly,normal,prepared,mastery,signature}=record;
  const requiresPreparation=['cleric','druid','paladin','wizard'].includes(cls)||definitions.find(c=>c.id===cls).casting?.preparation,available=!requiresPreparation||prepared||entry.data.level===0;
  if(arcanumLevel!==null&&arcanumLevel!==undefined)d.abilities.push(compileSpell(entry,cls,d,{arcanumLevel}));
  else if(normal&&available)d.abilities.push(compileSpell(entry,cls,d));
  if((mastery||signature)&&available){
   const free=compileSpell(entry,cls,d);free.id+=':'+ (signature?'signature':'mastery');free.combat.spell.slotPolicy='free';
   if(signature){const id='wizard:signature:'+entry.id;d.resources.push({id,max:1,recovery:'short',source:entry.source});free.resource={id,amount:1};}
   d.abilities.push(free);
  }
  if(ritualOnly){
   const ritual=compileSpell(entry,cls,d);ritual.id+=':ritual';ritual.cost='none';ritual.attack=null;ritual.save=null;ritual.effects=[];ritual.combat={version:1,mode:'manual',requirements:['GM confirms ritual access, components and completion of the extended casting time.'],spell:{id:entry.id,classId:cls,level:entry.data.level,access:'granted',slotPolicy:'free'},externalRequirements:['castingTimeAdjudicated','ritualEligibilityValidated']};
   d.features.push(entry.id);d.abilities.push(ritual);
  }
 }
 d.features=[...new Set(d.features)];
 validateCharacter(d);check(validateBuild(d).valid,'Generated build invalid');
 attachClassAdapters(d,index);
 // Every unlocked feature is inspectable/manual even if it has no executable adapter.
 const executable=new Set(d.abilities.map(a=>a.id));
 for(const id of d.features)if(!executable.has(id)) {
  const e=index.get(id);if(!e||!['feature','feat'].includes(e.type))continue;
  const m=e.data.manualMechanics,resourceId=m?.resourceId?e.data.classId+':'+m.resourceId:null;
  const resource=resourceId&&d.resources.some(r=>r.id===resourceId)?{id:resourceId,amount:m.amount}:null;
  if(resourceId&&!resource)check(report.resources.some(r=>r.id===resourceId&&r.unlimited),'Unresolved manual feature resource');
  d.abilities.push(ability(e,{cost:m?.economy??'none',target:m?.target??'self',maxTargets:m?.maxTargets??1,resource,...(m?.concentration?{concentration:{effectId:e.id,start:'activation'}}:{}),combat:{version:1,mode:'manual',requirements:m?.requirements??['GM adjudicates feature, action economy, restrictions and outcomes.'],...(m?{externalRequirements:['featureEligibilityValidated']}:{})}}));
 }
 validateCharacter(d);check(validateBuild(d).valid,'Generated integrated build invalid');
 return {...report,character:d,valid:true,history};
}
/** Current spell replacement is explicit, atomic and revalidated. Historical per-level replacement stays partial. */
export function replaceSelection(index,request,{choiceId,removeId,addId}) {
 const selections=structuredClone(request.selections??{}),values=selections[choiceId];check(values?.includes(removeId)&&!values.includes(addId),'Replacement selection');
 selections[choiceId]=values.map(v=>v===removeId?addId:v);
 const next={...request,selections},report=resolveProgression(index,next);check(report.valid,'Invalid replacement: '+JSON.stringify(report.issues));return next;
}
export function commandMetadata(character,index) {
 return character.abilities.map(a=>({id:a.id,category:a.kind,economy:a.cost,resource:a.resource,target:a.target,maxTargets:a.maxTargets,confirmation:a.combat?.mode==='manual'||!!a.combat?.externalRequirements?.length,automation:index.get(a.combat?.spell?.id??a.id)?.data.automation??{status:'manual',handler:null,limits:['Uncatalogued ability']},favoritesKey:a.id,externalRequirements:a.combat?.externalRequirements??[]}));
}
