import {draftProgression} from './model.js';
export const BLAST='srd51:eldritch-blast';
const key='warlock:cantrips', inv='warlock:invocations';
export function invocationOptions(context,config,draft){
 const candidate=structuredClone(draft);
 candidate.selections[key]=[...new Set([...(candidate.selections[key]??[]),BLAST])];
 return draftProgression(context,config,candidate).choices.find(q=>q.id===inv)?.options??[];
}
export function needsBlast(index,values){return values.some(id=>index.get(id)?.data.selectionRequires?.includes(BLAST));}
/** Atomic selection: a full quota requires an explicit replacement, never a silent deletion. */
export function selectInvocationChoice(draft,q,values,index,report,replacement=null){
 const selections=draft.selections;
 if(q.id===key&&!values.includes(BLAST)&&needsBlast(index,selections[inv]??[]))return 'required-blast';
 if(q.id===inv&&needsBlast(index,values)&&!Object.values(selections).flat().includes(BLAST)){
  const cantrips=report.choices.find(c=>c.id===key),known=selections[key]??[];
  if(!cantrips?.options.includes(BLAST))return 'unavailable-blast';
  if(known.length>=cantrips.count&&!known.includes(replacement))return 'replace-cantrip';
  selections[key]=[...known.filter(id=>id!==replacement),BLAST];
  selections[q.id]=values;
  return 'added-blast';
 }
 selections[q.id]=values;
 return 'ok';
}
