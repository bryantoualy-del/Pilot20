import {check,integer,id,json,ABILITIES,SKILLS} from '../character/contracts.js';
import {spellSlots,modifier} from '../character/derive.js';
export const listClasses=index=>index.list('class');
export const listSubclasses=(index,classId)=>index.list('subclass').filter(i=>i.data.classId===classId);
export const getProgression=(index,classId)=>{const c=index.class(classId);check(c,'Unknown class');return c.data.grants;};
export const listSpells=(index,classId,{maximumLevel=9,minimumLevel=0}={})=>index.list('spell').filter(i=>i.data.classIds.includes(classId)&&i.data.level<=maximumLevel&&i.data.level>=minimumLevel);
export const meetsPrerequisites=(scores,anyOf)=>anyOf.some(all=>all.every(p=>scores[p.score]>=p.minimum));
/** Resolves a current build, never silently chooses. All acquisition levels are class levels. */
export function resolveProgression(index,{classes,scores,selections={},campaignOptions=[],background={skills:[],proficiencies:[]},spellbookTranscriptions=[]}) {
 json({classes,scores,selections,campaignOptions,background,spellbookTranscriptions});
 check(Array.isArray(background.skills)&&background.skills.every(k=>Object.hasOwn(SKILLS,k))&&new Set(background.skills).size===background.skills.length&&Array.isArray(background.proficiencies)&&background.proficiencies.every(id),'Explicit background proficiencies');
 check(Array.isArray(classes)&&classes.length>0&&new Set(classes.map(c=>c.id)).size===classes.length,'Distinct classes');
 check(ABILITIES.every(a=>integer(scores[a],1,30)),'Scores');
 check(classes.every(c=>id(c.id)&&integer(c.level,1,20))&&classes.reduce((n,c)=>n+c.level,0)<=20,'Class levels');
 const adjustedScores={...scores};
 for(const c of classes)for(const spec of index.class(c.id)?.data.choices??[])if(spec.kind==='asi'&&spec.level<=c.level)for(const v of selections[c.id+':'+spec.key]??[])if(spec.options.includes(v)&&v.startsWith('asi:')){const [,a,b]=v.split(':');adjustedScores[a]++;adjustedScores[b]++;}
 const features=new Set(),resources=[],choices=[],issues=[],castingClasses=[],scaling={},grantedSpells=[],suppressedChoices=new Set(),suppressedResources=new Set();
 const optional=index.list('feature').filter(f=>f.data.optionalClassFeature&&classes.some(c=>c.id===f.data.classId&&c.level>=f.data.minimumClassLevel));
 const replacementOwners=new Map();
 for(const f of optional){for(const key of f.data.suppressesChoices??[])suppressedChoices.add(f.data.classId+':'+key);for(const key of f.data.suppressesResources??[])suppressedResources.add(f.data.classId+':'+key);for(const old of f.data.replaces??[]){if(replacementOwners.has(old))issues.push({code:'ambiguous-replacement',featureId:old});replacementOwners.set(old,f.id);}}
 const selected=new Set(Object.values(selections).flat());
 const addChoice=(cls,key,level,count,options,kind,metadata={})=>choices.push({id:cls+':'+key,classId:cls,level,count,options,kind,...metadata});
 const proficientSkills=new Set(background.skills);
 for(const c of classes){const d=index.class(c.id)?.data;for(const key of ['skills',...(d?.choices??[]).filter(q=>q.kind==='skill').map(q=>q.key)])for(const v of selections[c.id+':'+key]??[])if(Object.hasOwn(SKILLS,v))proficientSkills.add(v);}
 for(const [position,c] of classes.entries()) {
  const entry=index.class(c.id);check(entry,'Unknown class: '+c.id);const d=entry.data,L=c.level;
  if(classes.length>1&&!meetsPrerequisites(adjustedScores,d.multiclassPrerequisites))issues.push({code:'multiclass-prerequisite',classId:c.id});
  if(selections[c.id+':subclass']&&selections[c.id+':subclass'][0]!==c.subclassId)issues.push({code:'subclass-definition-mismatch',classId:c.id});
  const sub=c.subclassId?index.get(c.subclassId):null;
  if(c.subclassId)check(sub?.type==='subclass'&&sub.data.classId===c.id&&L>=d.subclassLevel,'Invalid subclass');
  if(L>=d.subclassLevel)addChoice(c.id,'subclass',d.subclassLevel,1,listSubclasses(index,c.id).map(x=>x.id),'subclass');
  for(const row of [...d.grants,...(sub?.data.grants??[])])if(row.level<=L)row.featureIds.forEach(id=>features.add(id));
  for(const f of optional.filter(f=>f.data.classId===c.id))features.add(f.id);
  if(d.casting)castingClasses.push({id:c.id,level:L,casting:d.casting});
  const pool=spellSlots([{id:c.id,level:L,casting:d.casting}]);
  const maxSpell=Math.max(0,...Object.values(pool.resources).map(x=>x.slotLevel));
  scaling[c.id]=Object.fromEntries(Object.entries(d.scaling??{}).map(([k,v])=>[k,v[L-1]]));
  const extraSpells=[...(sub?.data.extraSpells??[]),...[...selected].flatMap(id=>{const d=index.get(id)?.data;return d?.classId===c.id?d.extraSpells??[]:[];})].filter(r=>r.classLevel<=L);
  grantedSpells.push(...extraSpells.filter(r=>r.mode==='prepared').flatMap(r=>r.spellIds.map(id=>({id,classId:c.id,mode:'prepared'}))));
  const allowedSpells=(minimumLevel=1)=>[...new Set([...listSpells(index,c.id,{minimumLevel,maximumLevel:maxSpell}).map(s=>s.id),...extraSpells.flatMap(r=>r.spellIds).filter(id=>index.get(id).data.level>=minimumLevel)])];
  for(const r of [...(d.resources??[]),...(sub?.data.resources??[])]) {
   if(suppressedResources.has(c.id+':'+r.id))continue;
   let n=r.maxByLevel[L-1];
   if(n&&typeof n==='object')n=Math.max(n.minimum,modifier(adjustedScores[n.ability]))+(n.add??0);
   if(n===0)continue;
   resources.push({id:c.id+':'+r.id,max:n,recovery:L>=(r.shortRestFromLevel??21)?'short':r.recovery,unlimited:n===null,classId:c.id,...(r.recharge?{recharge:r.recharge}:{})});
  }
  const skillCount=position===0?d.skillChoice.count:['bard','ranger','rogue'].includes(c.id)?1:0;
  if(skillCount)addChoice(c.id,'skills',1,skillCount,d.skillChoice.options,'skill');
  for(const spec of [...(d.choices??[]),...(sub?.data.choices??[]),...optional.filter(f=>f.data.classId===c.id).flatMap(f=>f.data.choices??[])]) {
   if(suppressedChoices.has(c.id+':'+spec.key))continue;
   if(spec.requiresChoice&&!(selections[c.id+':'+spec.requiresChoice.key]??[]).includes(spec.requiresChoice.optionId))continue;
   if(spec.level>L||(spec.subclassId&&spec.subclassId!==c.subclassId)||(spec.requiresSelected&&!selected.has(spec.requiresSelected)))continue;
   if(position>0&&['instruments','tool'].includes(spec.key)) {
    if(c.id==='bard')addChoice(c.id,spec.key,1,1,spec.options,spec.kind);
    continue;
   }
   let options=spec.options;
   if(spec.kind==='asi'&&campaignOptions.includes('feats'))options=options.concat(index.list('feat').filter(f=>(f.data.requiresScores??[]).every(p=>adjustedScores[p.score]>=p.minimum)).map(f=>f.id));
   if(spec.requiresKnown)options=options.filter(id=>(selections[c.id+':spellbook']??[]).includes(id));
   if(spec.kind==='expertise')options=[...new Set([...proficientSkills].concat(c.id==='rogue'?['thieves-tools']:[]))];
   addChoice(c.id,spec.key,spec.level,spec.countByLevel?.[L-1]??spec.count,options,spec.kind,{...(spec.distinctGroup?{distinctGroup:spec.distinctGroup}:{}),...(spec.adjudication?{adjudication:spec.adjudication}:{})});
  }
  if(d.invocationsKnown?.[L-1])addChoice(c.id,'invocations',2,d.invocationsKnown[L-1],index.list('feature').filter(f=>f.data.optionKind==='invocation'&&f.data.minimumClassLevel<=L&&(f.data.selectionRequires??[]).every(k=>selected.has(k))).map(f=>f.id),'feature');
  if(d.cantripsKnown?.[L-1])addChoice(c.id,'cantrips',1,d.cantripsKnown[L-1],listSpells(index,c.id,{maximumLevel:0}).map(s=>s.id),'spell');
  if(d.spellsKnown?.[L-1]) {
   let count=d.spellsKnown[L-1];
   if(c.id==='bard')count-=(L>=10?2:0)+(L>=14?2:0)+(L>=18?2:0);
   addChoice(c.id,'known-spells',d.casting.progression==='half'?2:1,count,allowedSpells(),'spell');
  }
  if(c.id==='wizard'){const extras=spellbookTranscriptions.filter(t=>t.classId===c.id&&t.characterLevel<=classes.reduce((n,c)=>n+c.level,0));addChoice(c.id,'spellbook',1,6+2*(L-1)+extras.length,allowedSpells(),'spellbook');}
  if((['cleric','druid','paladin','wizard'].includes(c.id)||d.casting?.preparation)&&maxSpell) {
   const count=Math.max(1,modifier(adjustedScores[d.casting.ability])+(d.casting.preparation==='ability-plus-half-level'||(!d.casting.preparation&&d.casting.progression==='half')?Math.floor(L/2):L));
   const options=c.id==='wizard'?(selections[c.id+':spellbook']??[]).filter(id=>!(selections[c.id+':signature-spells']??[]).includes(id)):allowedSpells().filter(id=>!grantedSpells.some(s=>s.classId===c.id&&s.id===id));
   addChoice(c.id,'prepared',1,count,options,'prepared');
  }
  if(c.id==='bard')for(const lv of [10,14,18,...(sub?.id==='srd51:college-of-lore'?[6]:[])])if(L>=lv)addChoice(c.id,'magical-secrets-'+lv,lv,2,index.list('spell').filter(s=>s.data.level<=maxSpell).map(s=>s.id),'spell');
  if(c.id==='warlock')for(const [lv,spellLevel] of [[11,6],[13,7],[15,8],[17,9]])if(L>=lv)addChoice(c.id,'arcanum-'+spellLevel,lv,1,listSpells(index,c.id,{minimumLevel:spellLevel,maximumLevel:spellLevel}).map(s=>s.id),'spell');
 }
 // Subclass is explicit in classes. Preserve one consistent source for selection records.
 const effectiveSelections={...selections};for(const c of classes)if(c.subclassId)effectiveSelections[c.id+':subclass']=[c.subclassId];
 const expertise=new Set(),skillSelections=new Set(background.skills),featureSelections=new Set(),distinctGroups=new Map();
 for(const choice of choices) {
  const values=effectiveSelections[choice.id];
  if(!values){issues.push({code:'required-choice',choiceId:choice.id});continue;}
  if(!Array.isArray(values)||values.length!==choice.count||new Set(values).size!==values.length||values.some(k=>!choice.options.includes(k))){issues.push({code:'invalid-choice',choiceId:choice.id});continue;}
  if(choice.distinctGroup)for(const v of values){const seen=distinctGroups.get(choice.distinctGroup)??new Set();if(v!=='language:none'&&seen.has(v))issues.push({code:'duplicate-choice-group',choiceId:choice.id});seen.add(v);distinctGroups.set(choice.distinctGroup,seen);}
  if(choice.kind==='skill')for(const v of values){if(skillSelections.has(v))issues.push({code:'duplicate-skill',choiceId:choice.id});skillSelections.add(v);}
  if(choice.kind==='feature')for(const v of values){if(featureSelections.has(v)&&!v.endsWith(':two-humanoid-races'))issues.push({code:'duplicate-feature-option',choiceId:choice.id});featureSelections.add(v);}
  if(choice.kind==='expertise')for(const v of values){if(expertise.has(v))issues.push({code:'duplicate-expertise',choiceId:choice.id});expertise.add(v);}
  if(choice.kind==='feature')values.forEach(v=>features.add(v));
 }
 const spellsByClass=new Map();
 for(const q of choices.filter(q=>q.kind==='spell'))for(const v of effectiveSelections[q.id]??[]){const seen=spellsByClass.get(q.classId)??new Set();if(seen.has(v))issues.push({code:'duplicate-spell-choice',choiceId:q.id});seen.add(v);spellsByClass.set(q.classId,seen);}
 for(const key of Object.keys(effectiveSelections))if(!choices.some(c=>c.id===key))issues.push({code:'obsolete-choice',choiceId:key});
 for(const choice of choices.filter(c=>c.kind==='asi'))for(const v of effectiveSelections[choice.id]??[]) {
  if(!choice.options.includes(v))continue;
  if(index.get(v)?.type==='feat'){features.add(v);continue;}
  const [,a,b]=v.split(':');
  if(adjustedScores[a]>20||adjustedScores[b]>20)issues.push({code:'asi-cap',choiceId:choice.id});
 }
 for(const t of spellbookTranscriptions){check(t&&id(t.classId)&&id(t.spellId)&&integer(t.characterLevel,1,20)&&typeof t.reason==='string'&&t.reason.trim(),'Approved spellbook transcription');const c=classes.find(c=>c.id===t.classId);if(!c||t.characterLevel>classes.reduce((n,c)=>n+c.level,0)||!(selections[t.classId+':spellbook']??[]).includes(t.spellId))issues.push({code:'invalid-transcription',spellId:t.spellId});}
 check(new Set(spellbookTranscriptions.map(t=>t.classId+':'+t.spellId)).size===spellbookTranscriptions.length,'Duplicate transcription');
 // Optional feats are never silently enabled. Future packs may add feat choices.
 // Only enabled, source-authorized feats are offered; protected feats require a private pack.
 for(const f of optional)if((f.data.requires??[]).some(id=>!features.has(id)))issues.push({code:'optional-feature-prerequisite',featureId:f.id});
 for(const fid of features)for(const other of index.get(fid)?.data.incompatible??[])if(features.has(other))issues.push({code:'optional-feature-incompatible',featureId:fid,otherFeatureId:other});
 for(const fid of [...features])for(const replaced of index.get(fid)?.data.replaces??[])features.delete(replaced);
 for(const fid of features)for(const r of index.get(fid)?.data.resources??[]){const entry=index.get(fid),c=classes.find(c=>c.id===entry.data.classId);if(suppressedResources.has(c.id+':'+r.id))continue;let n=r.maxByLevel[c.level-1];if(n&&typeof n==='object')n=Math.max(n.minimum,modifier(adjustedScores[n.ability]))+(n.add??0);if(n!==0)resources.push({id:c.id+':'+r.id,max:n,recovery:r.recovery,unlimited:n===null,classId:c.id,...(r.recharge?{recharge:r.recharge}:{})});}
 check(new Set(resources.map(r=>r.id)).size===resources.length,'Duplicate resolved resource');
 return {features:[...features],resources,choices,grantedSpells,manualRequirements:classes.flatMap(c=>(index.class(c.id).data.manualRequirements??[]).map(reason=>({classId:c.id,reason}))).concat(choices.filter(q=>q.adjudication).map(q=>({classId:q.classId,choiceId:q.id,reason:q.adjudication})),resources.filter(r=>r.recharge).map(r=>({classId:r.classId,resourceId:r.id,reason:'Recovery requires GM calendar adjudication: '+JSON.stringify(r.recharge)}))),selections:effectiveSelections,issues,valid:issues.length===0,scores:adjustedScores,scaling,slots:spellSlots(castingClasses),limits:['Historical acquisition/replacement eligibility must be reviewed for high-level imports.','Subclass effects beyond explicit spell grants remain manual.','Resource maxima depending on ASIs are recalculated by the character compiler.']};
}
