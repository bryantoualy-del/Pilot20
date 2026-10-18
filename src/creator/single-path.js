import {draftProgression} from './model.js';

/** Legacy data is preserved; only the navigation presentation is migrated. */
export function migrateSingleDraft(input) {
  const d=structuredClone(input);
  if(d.mode!=='single') {
    d.legacyCreation={mode:d.mode,step:d.step};
    d.mode='single';d.classChosen=true;
    d.step=({origin:'race',identity:'identity',class:'class',level:'class',background:'background',scores:'scores',equipment:'equipment',summary:'summary'})[d.step]??'identity';
  }
  return d;
}
export function singlePath(context,config,draft) {
  const report=draftProgression(context,config,draft),race=report.origin?.race;
  const decisions=[{id:'identity',kind:'identity'},{id:'race',kind:'race'}];
  if(race?.data.subraces.length)decisions.push({id:'subrace',kind:'subrace'});
  decisions.push({id:'class',kind:'class'},{id:'background',kind:'background'},{id:'scores',kind:'scores'});
  decisions.push(...(report.origin?.choices??[]).map(q=>({id:'origin:'+q.id,kind:'origin-choice',choice:q})));
  const priority={skill:0,proficiency:1,subclass:2,asi:3,feature:4,expertise:5,spellbook:7,spell:8,prepared:9};
  decisions.push(...[...(report.choices??[])].sort((a,b)=>a.level-b.level||(priority[a.kind]??6)-(priority[b.kind]??6)||a.id.localeCompare(b.id)).map(q=>({id:'choice:'+q.id,kind:'class-choice',choice:q})));
  decisions.push(...(report.startingEquipment?.choices??[]).map(q=>({id:'equipment:'+q.id,kind:'equipment-choice',choice:q})));
  decisions.push({id:'equipment',kind:'equipment'},{id:'summary',kind:'summary'});
  const current=decisions.find(x=>x.id===draft.step)??decisions[0];
  return {report,decisions,current,position:decisions.indexOf(current)};
}
export function decisionReady(decision,report,draft) {
  const q=decision.choice;
  if(decision.kind==='equipment-choice'){const v=draft.startingEquipmentChoices?.[q.id]??[];return v.length===1&&q.options.some(o=>o.id===v[0]);}
  if(q) {
    const selected=decision.kind==='origin-choice'?draft.originSelections?.[q.id]:q.kind==='subclass'?[draft.classes.find(c=>c.id===q.classId)?.subclassId].filter(Boolean):draft.selections[q.id]??(q.kind==='prepared'?[]:undefined);
    return selected!==undefined&&selected.length>=(q.minimumCount??q.count)&&selected.length<=q.count&&new Set(selected).size===selected.length&&selected.every(id=>q.options.includes(id))&&!report.issues.some(i=>i.choiceId===q.id);
  }
  switch(decision.kind){
    case 'identity':return !!draft.name.trim();
    case 'race':return !!(draft.raceId||draft.manualRace||draft.origin.trim());
    case 'subrace':return !!report.origin?.subrace;
    case 'class':return draft.classChosen!==false&&draft.classes.every(c=>c.level>=1&&c.level<=20)&&!report.issues.some(i=>['unavailable-class','multiclass-prerequisite','multiclass-option-disabled'].includes(i.code));
    case 'background':return !!draft.backgroundId||!!draft.background.name.trim()&&draft.background.skills.length===2;
    case 'scores':return !report.issues.some(i=>/score-method|origin-score-cap|asi-cap/.test(i.code));
    case 'summary':return report.valid;
    default:return true;
  }
}
