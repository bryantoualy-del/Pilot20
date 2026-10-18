import {validateScoreMethod} from '../catalog/origins.js';
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
  decisions.push({id:'class',kind:'class'},{id:'background',kind:'background'},{id:'scores',kind:'scores'},{id:'hit-points',kind:'hit-points'});
  const training=q=>['skill','proficiency','language','tool','training'].includes(q.kind);
  const originTraining=(report.origin?.choices??[]).filter(training);
  const classTraining=(report.choices??[]).filter(training);
  decisions.push({id:'training',kind:'training',originChoices:originTraining,classChoices:classTraining});
  decisions.push(...(report.origin?.choices??[]).filter(q=>q.kind!=='score'&&q.key!=='ability-pattern'&&!training(q)).map(q=>({id:'origin:'+q.id,kind:'origin-choice',choice:q})));
  const priority={skill:0,proficiency:1,subclass:2,asi:3,feature:4,expertise:5,spellbook:7,spell:8,prepared:9};
  decisions.push(...[...(report.choices??[]).filter(q=>!training(q))].sort((a,b)=>a.level-b.level||(priority[a.kind]??6)-(priority[b.kind]??6)||a.id.localeCompare(b.id)).map(q=>({id:'choice:'+q.id,kind:'class-choice',choice:q})));
  decisions.push({id:'equipment',kind:'equipment'},{id:'summary',kind:'summary'});
  const scoreChoice=(report.origin?.choices??[]).some(q=>'origin:'+q.id===draft.step&&(q.kind==='score'||q.key==='ability-pattern'));
  const trainingStep=[...originTraining.map(q=>'origin:'+q.id),...classTraining.map(q=>'choice:'+q.id)].includes(draft.step);
  const step=scoreChoice?'scores':trainingStep?'training':draft.step==='equipment-method'||draft.step?.startsWith('equipment:')?'equipment':draft.step;
  const current=decisions.find(x=>x.id===step)??decisions[0];
  return {report,decisions,current,position:decisions.indexOf(current)};
}
export function decisionReady(decision,report,draft) {
  const q=decision.choice;
  if(decision.kind==='equipment-choice'){const v=draft.startingEquipmentChoices?.[q.id]??[];return v.length===1&&q.options.some(o=>o.id===v[0]);}
  if(q) {
    const selected=decision.kind==='origin-choice'?draft.originSelections?.[q.id]:q.kind==='subclass'?[draft.classes.find(c=>c.id===q.classId)?.subclassId].filter(Boolean):report.selections?.[q.id]??draft.selections[q.id]??(q.kind==='prepared'?[]:undefined);
    return selected!==undefined&&selected.length>=(q.minimumCount??q.count)&&selected.length<=q.count&&new Set(selected).size===selected.length&&selected.every(id=>q.options.includes(id))&&!report.issues.some(i=>i.choiceId===q.id);
  }
  switch(decision.kind){
    case 'identity':return !!draft.name.trim();
    case 'race':return !!(draft.raceId||draft.manualRace||draft.origin.trim());
    case 'subrace':return !!report.origin?.subrace;
    case 'class':return draft.classChosen!==false&&draft.classes.every(c=>c.level>=1&&c.level<=20)&&!report.issues.some(i=>['unavailable-class','multiclass-prerequisite','multiclass-option-disabled'].includes(i.code));
    case 'background':return !!draft.backgroundId||!!draft.background.name.trim()&&draft.background.skills.length===2;
    case 'training':return decision.originChoices.every(choice=>decisionReady({kind:'origin-choice',choice},report,draft))&&decision.classChoices.every(choice=>decisionReady({kind:'class-choice',choice},report,draft));
    case 'scores':return validateScoreMethod(draft.scores,draft.scoreMethod,draft.scoreRolls)&&!report.issues.some(i=>/score-method|origin-score-cap|asi-cap|origin-bonus-duplicate/.test(i.code)||(report.origin?.choices??[]).some(q=>(q.kind==='score'||q.key==='ability-pattern')&&q.id===i.choiceId));
    case 'hit-points':return report.hitPoints?.valid===true;
    case 'equipment':return report.economy?.valid!==false&&report.startingEquipment?.valid!==false;
    case 'summary':return report.valid;
    default:return true;
  }
}
