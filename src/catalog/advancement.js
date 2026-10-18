import {replacementPermission,pactRetooling,forcedInvocationReplacement} from './replacement-policy.js';
/** Level-up audit, separate from combat. Only declarative snapshots, never inferred player choices. */
import {check,keys,json,id,integer} from '../character/contracts.js';
import {resolveProgression,effectiveClassData} from './progression.js';
const difference=(a,b)=>a.filter(v=>!b.includes(v));
const equal=(a,b)=>a.length===b.length&&a.every(v=>b.includes(v));
export function validateAdvancementHistory(index,request,history) {
 json(history);check(Array.isArray(history)&&history.length<=20,'Advancement history');
 const total=request.classes.reduce((n,c)=>n+c.level,0),issues=[];
 if(!history.length)return {status:'not-recorded',valid:true,issues:[],limits:['Historical acquisition remains unverified until level snapshots are supplied.']};
 if(history.length!==total)issues.push({code:'history-length',expected:total,actual:history.length});
 const counts=new Map(),order=[];let previous=null,last=null;
 for(const [i,row] of history.entries()) {
  keys(row,['classId','classes','selections','adjudication'],['classId','classes','selections']);check(id(row.classId)&&Array.isArray(row.classes),'Advancement snapshot');
  check(row.adjudication===undefined||(typeof row.adjudication==='string'&&row.adjudication.trim().length>0),'Adjudication note');
  if(!counts.has(row.classId))order.push(row.classId);counts.set(row.classId,(counts.get(row.classId)??0)+1);
  if(row.classes.length!==order.length||row.classes.some((c,j)=>c.id!==order[j]||c.level!==counts.get(c.id)))issues.push({code:'history-class-sequence',characterLevel:i+1});
  const transcriptions=(request.spellbookTranscriptions??[]).filter(t=>t.characterLevel<=i+1);
  const grantReplacements=(request.spellGrantReplacements??[]).filter(r=>r.classLevel<=(row.classes.find(c=>c.subclassId===r.originId)?.level??0));
  const report=resolveProgression(index,{...request,classes:row.classes,selections:row.selections,spellbookTranscriptions:transcriptions,pactRitualCopies:(request.pactRitualCopies??[]).filter(r=>r.characterLevel<=i+1),spellGrantReplacements:grantReplacements,featRitualCopies:(request.featRitualCopies??[]).filter(r=>r.characterLevel<=i+1)});
  for(const error of report.issues)issues.push({...error,characterLevel:i+1});
  const changedSubclasses=previous?row.classes.filter(c=>previous.classes.find(p=>p.id===c.id)?.subclassId&&previous.classes.find(p=>p.id===c.id).subclassId!==c.subclassId):[];
  const retraining=changedSubclasses.length>0&&(request.campaignOptions??[]).includes('subclass-retraining')&&!!row.adjudication;
  if(changedSubclasses.length&&!retraining)issues.push({code:'unapproved-subclass-change',characterLevel:i+1});
  if(previous) {
   const budgets=new Map();
   for(const old of previous.report.choices) {
    const next=report.choices.find(c=>c.id===old.id),before=previous.report.selections[old.id]??[],after=report.selections[old.id]??[];
    const removed=difference(before,after),added=difference(after,before);
    if(!next){if(pactRetooling(index,row.classes,row.classId,previous.report.selections,report.selections)&&old.classId==='warlock'&&['warlock:tome-cantrips','warlock:ancient-rituals'].includes(old.id))continue;if(!retraining)issues.push({code:'historical-choice-disappeared',choiceId:old.id,characterLevel:i+1});continue;}
    if(!removed.length&&!added.length)continue;
    const advancing=old.classId===row.classId,policy=effectiveClassData(index,row.classes.find(c=>c.id===old.classId)).acquisitionPolicy??{};
    const addIssue=code=>issues.push({code,choiceId:old.id,characterLevel:i+1});
    if(old.kind==='prepared'||old.mutableAtRest)continue; // A preparation choice is not permanent learning.
    if(old.kind==='spellbook') {
     if(removed.length)addIssue('spellbook-forgotten');
     const copied=transcriptions.filter(t=>t.classId===old.classId&&t.characterLevel===i+1).map(t=>t.spellId);
     if(copied.some(id=>before.includes(id)||!added.includes(id)))addIssue('transcription-not-new');
     if(added.length!==(advancing?(policy.spellbookLearnedPerClassLevel??0):0)+copied.length)addIssue('spellbook-acquisition-count');
     continue;
    }
    const learned=old.replaceableKnown||old.id.endsWith(':known-spells')||old.id.endsWith(':known-free-spells')||old.id.includes(':magical-secrets-');
    const invocation=old.id.endsWith(':invocations');
    if(learned||invocation) {
     const key=old.classId+(invocation?':invocation':':known');const counted=invocation?removed.filter(id=>next.options.includes(id)||!forcedInvocationReplacement(index,row.classes,row.classId,previous.report.selections,report.selections,id)).length:removed.length;budgets.set(key,(budgets.get(key)??0)+counted);
     const cap=invocation?policy.invocationReplacementPerClassLevel??0:policy.knownReplacementPerClassLevel??0;
     if((!advancing&&(removed.length||added.length))||budgets.get(key)>cap)addIssue('replacement-limit');
     if(old.id.includes(':magical-secrets-')&&removed.length&&added.some(id=>!index.get(id)?.data.classIds?.includes(old.classId)))addIssue('secret-replacement-class-list');
     continue;
    }
    const permit=replacementPermission(index,row.classes,row.classId,old);if(permit&&removed.length){budgets.set(permit.key,(budgets.get(permit.key)??0)+removed.length);if(removed.length>permit.choiceMaximum||budgets.get(permit.key)>permit.maximum)addIssue(permit.key.endsWith(':asi-versatility')?'asi-versatility-limit':'replacement-limit');continue;}
    // Count increases (new cantrip / metamagic / etc.) are allowed only when that class advances.
    if(removed.length||!advancing)addIssue('historical-choice-changed');
   }
  }
  previous={classes:row.classes,report};last=report;
 }
 for(const c of request.classes)if(counts.get(c.id)!==c.level)issues.push({code:'history-final-class-level',classId:c.id});
 if(last) {
  const final=resolveProgression(index,request),all=new Set([...Object.keys(final.selections),...Object.keys(last.selections)]);
  for(const key of all)if(!equal(final.selections[key]??[],last.selections[key]??[]))issues.push({code:'history-final-selection',choiceId:key});
  for(const c of request.classes)if((history.at(-1).classes.find(k=>k.id===c.id)?.subclassId??null)!==(c.subclassId??null))issues.push({code:'history-final-subclass',classId:c.id});
 }
 return {status:issues.length?'invalid':'verified',valid:issues.length===0,issues,limits:['Physical transcription time/materials and explicitly approved retraining remain GM adjudications.']};
}
/** Compact deltas survive existing v2 character exports without a schema migration. */
export function choiceHistoryNote(history,choiceId,classId,{referenceOnly=false}={}) {
 if(referenceOnly)return JSON.stringify({kind:'catalog-choice-history-ref',schemaVersion:1,choiceId});
 const events=[];let before=[];
 for(const [i,row] of history.entries()) {
  const after=row.selections[choiceId]??(choiceId.endsWith(':subclass')?(row.classes.find(c=>c.id===classId)?.subclassId?[row.classes.find(c=>c.id===classId).subclassId]:[]):[]);
  const add=difference(after,before),remove=difference(before,after);
  if(add.length||remove.length)events.push({characterLevel:i+1,classLevel:row.classes.find(c=>c.id===classId)?.level??0,add,remove,...(row.adjudication?{adjudication:row.adjudication}:{})});
  before=after;
 }
 const note=JSON.stringify({kind:'catalog-choice-history',schemaVersion:1,choiceId,events});
 check(note.length<=10000,'Choice history exceeds v2 note limit; export the build plan without truncation');return note;
}
export function readChoiceHistories(character) {
 return character.choices.flatMap(choice=>{
  if(!choice.note.startsWith('{'))return [];
  let data;try{data=JSON.parse(choice.note);}catch{return [];}
  if(data?.kind!=='catalog-choice-history')return [];
  json(data);
  check(data.schemaVersion===1&&Array.isArray(data.events),'Unknown choice history version');return [data];
 });
}
export function exportBuildPlan(request,history=[]) {
 json({request,history});check(history.length<=20,'Build plan history');return JSON.stringify({kind:'pilot20-build-plan',schemaVersion:1,request,history});
}
export function importBuildPlan(index,raw) {
 check(typeof raw==='string'&&raw.length<=2000000,'Build plan size');const p=JSON.parse(raw);json(p);keys(p,['kind','schemaVersion','request','history']);
 check(p.kind==='pilot20-build-plan'&&p.schemaVersion===1,'Build plan version');
 const current=resolveProgression(index,p.request),audit=validateAdvancementHistory(index,p.request,p.history);check(current.valid&&audit.valid,'Invalid build plan');return p;
}
