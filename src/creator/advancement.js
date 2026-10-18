import {check} from '../character/contracts.js';
import {effectiveClassData,resolveProgression} from '../catalog/progression.js';
const total=classes=>classes.reduce((n,c)=>n+c.level,0);
/** An observed level gain starts from the current snapshot. Never reconstruct earlier levels. */
export function beginAdvancement(input,classId){
 check(!input.pendingAdvancement,'A level gain is already open');check(input.finalized,'Save the current character before gaining a level');check(total(input.classes)<20,'Maximum character level');
 const d=structuredClone(input),before=structuredClone(input);delete before.buildBaseline;
 const c=d.classes.find(c=>c.id===classId);if(c)c.level++;else d.classes.push({id:classId,level:1,subclassId:null});
 d.pendingAdvancement={classId,before,startedAt:new Date().toISOString()};d.finalized=false;d.confirmed=false;d.reviewed=false;d.step='class';return d;
}
export function cancelAdvancement(input){check(input.pendingAdvancement,'No open level gain');return{...structuredClone(input.pendingAdvancement.before),revision:input.revision,...(input.buildBaseline?{buildBaseline:structuredClone(input.buildBaseline)}:{})};}
export function validateLevelGain(index,request,pending){
 if(!pending)return[];const issues=[],before=pending.before,classId=pending.classId;
 const oldCounts=new Map(before.classes.map(c=>[c.id,c.level])),newCounts=new Map(request.classes.map(c=>[c.id,c.level]));
 if(total(request.classes)!==total(before.classes)+1||[...new Set([...oldCounts.keys(),...newCounts.keys()])].some(id=>(newCounts.get(id)??0)!==(oldCounts.get(id)??0)+(id===classId?1:0)))return[{code:'level-gain-class-sequence'}];
 const report=resolveProgression(index,{...request,classes:before.classes,selections:before.selections,spellbookTranscriptions:before.spellbookTranscriptions??[],spellGrantReplacements:before.spellGrantReplacements??[],featRitualCopies:before.featRitualCopies??[]});
 const next=resolveProgression(index,request),budgets=new Map();
 for(const old of report.choices){if(old.kind==='prepared'||old.mutableAtRest)continue;const after=next.choices.find(q=>q.id===old.id);const prior=before.selections[old.id]??(old.kind==='subclass'?[before.classes.find(c=>c.id===old.classId)?.subclassId].filter(Boolean):[]),now=request.selections[old.id]??(old.kind==='subclass'?[request.classes.find(c=>c.id===old.classId)?.subclassId].filter(Boolean):[]),removed=prior.filter(id=>!now.includes(id));
 if(!after){issues.push({code:'level-gain-choice-removed',choiceId:old.id});continue;}
 if(!removed.length)continue;
 const c=request.classes.find(c=>c.id===old.classId),policy=effectiveClassData(index,c).acquisitionPolicy??{},advancing=classId===old.classId;
 const invocation=old.id.endsWith(':invocations'),known=old.replaceableKnown||old.id.endsWith(':known-spells')||old.id.endsWith(':known-free-spells')||old.id.includes(':magical-secrets-');
 if(invocation||known){const key=old.classId+(invocation?':invocation':':known'),cap=invocation?policy.invocationReplacementPerClassLevel??0:policy.knownReplacementPerClassLevel??0;budgets.set(key,(budgets.get(key)??0)+removed.length);if(!advancing||budgets.get(key)>cap)issues.push({code:'replacement-limit',choiceId:old.id});if(old.id.includes(':magical-secrets-')&&now.filter(id=>!prior.includes(id)).some(id=>!index.get(id)?.data.classIds.includes(old.classId)))issues.push({code:'secret-replacement-class-list',choiceId:old.id});continue;}
 if(old.replacementRule&&removed.length){const rule=old.replacementRule;if(!advancing||removed.length>rule.maximum||(rule.levels&&!rule.levels.includes(c.level)))issues.push({code:'replacement-limit',choiceId:old.id});continue;}
 const kind=old.id===old.classId+':cantrips'?'cantrip':old.kind==='expertise'?'expertise':null;
 if(kind&&advancing&&next.choices.some(q=>q.classId===classId&&q.kind==='asi'&&q.level===c.level)){const cap=policy[kind+'ReplacementAtASI']??0,key=classId+':versatility';budgets.set(key,(budgets.get(key)??0)+removed.length);if(removed.length<=cap&&budgets.get(key)<=(policy.sharedASIReplacementLimit??cap))continue;}
 issues.push({code:'historical-choice-changed',choiceId:old.id});
 }
 return issues;
}
export function finishAdvancement(draft){
 const next=structuredClone(draft),p=next.pendingAdvancement;if(!p)return next;
 const snapshot=d=>({classes:structuredClone(d.classes),selections:structuredClone(d.selections),originSelections:structuredClone(d.originSelections??{})});
 next.advancementEvents=[...(next.advancementEvents??[]),{kind:'observed-level-gain',classId:p.classId,recordedAt:new Date().toISOString(),from:snapshot(p.before),to:snapshot(next),earlierHistoryVerified:!!p.before.advancementHistory?.length}];
 if(next.advancementHistory?.length)next.advancementHistory.push({classId:p.classId,classes:structuredClone(next.classes),selections:structuredClone(next.selections)});
 delete next.pendingAdvancement;return next;
}
