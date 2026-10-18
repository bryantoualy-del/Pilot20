import {effectiveClassData} from './progression.js';
export function asiAt(index,classes,classId){const c=classes.find(c=>c.id===classId);return!!c&&(index.class(classId)?.data.choices??[]).some(q=>q.kind==='asi'&&q.level===c.level);}
export function pactRetooling(index,classes,advancingClassId,before,after){const c=classes.find(c=>c.id==='warlock');return advancingClassId==='warlock'&&c&&asiAt(index,classes,'warlock')&&(effectiveClassData(index,c).acquisitionPolicy?.pactReplacementAtASI??0)>0&&(before['warlock:pact-boon']??[]).join()!==(after['warlock:pact-boon']??[]).join();}
export function replacementPermission(index,classes,advancingClassId,choice){
 const c=classes.find(c=>c.id===choice.classId),advance=classes.find(c=>c.id===advancingClassId),policy=c?effectiveClassData(index,c).acquisitionPolicy??{}:{},own=advancingClassId===choice.classId,asi=asiAt(index,classes,advancingClassId);
 const kind=choice.id===choice.classId+':cantrips'?'cantrip':choice.kind==='expertise'?'expertise':choice.id===choice.classId+':metamagic'?'metamagic':choice.id===choice.classId+':fighting-style'||choice.id===choice.classId+':additional-style'?'fightingStyle':choice.id==='fighter:maneuvers'?'maneuver':choice.id==='warlock:pact-boon'?'pact':choice.id.startsWith('warlock:arcanum-')?'arcanum':null;
 if(own&&asi&&kind&&(policy[kind+'ReplacementAtASI']??0)>0&&(kind!=='arcanum'||c.level>=12))return{key:choice.classId+':asi-versatility',maximum:policy.sharedASIReplacementLimit??1,choiceMaximum:policy[kind+'ReplacementAtASI']};
 const rule=choice.replacementRule;if(!rule||!own&&!rule.anyClass||rule.atASI&&!asi||rule.levels&&!rule.levels.includes((rule.anyClass?advance:c)?.level))return null;
 return{key:rule.group??choice.id,maximum:rule.maximum,choiceMaximum:rule.maximum};
}
