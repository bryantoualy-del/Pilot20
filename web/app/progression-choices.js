/** Split cumulative feature quotas for display; the engine keeps its original flat selection. */
export function progressionChoices(index,draft,decisions) {
 return decisions.flatMap(decision=>{
  const q=decision.choice;
  if(decision.kind!=='class-choice'||q.kind!=='feature')return [decision];
  const cls=draft.classes.find(c=>c.id===q.classId),data=index.class(q.classId)?.data;
  const specs=[...(data?.choices??[]),...(index.get(cls?.subclassId)?.data.choices??[]),...(index.get(q.ownerId)?.data.choices??[])];
  const schedule=q.id===q.classId+':invocations'?data.invocationsKnown:specs.find(s=>q.id===q.classId+':'+s.key)?.countByLevel;
  if(!schedule)return [decision];
  let before=0;const slices=[];
  for(let level=1;level<=cls.level;level++){
   const total=schedule[level-1]??before,count=total-before;
   if(count>0)slices.push({...decision,id:decision.id+'@'+level,choice:{...q,level,count,allocation:{baseId:q.id,level,offset:before}}});
   before=total;
  }
  return slices.length?slices:[decision];
 });
}
export function allocatedValues(draft,q,all) {
 if(!q.allocation)return all;
 const slots=draft.progressionAllocations?.[q.id];
 // Metadata is only authoritative while it matches the actual canonical selection.
 if(slots&&JSON.stringify(Object.values(slots).flat())===JSON.stringify(all))return slots[q.level]??[];
 return all.slice(q.allocation.offset,q.allocation.offset+q.count);
}
export function selectAllocation(draft,q,values,siblings) {
 const all=draft.selections[q.id]??[];
 const slots=Object.fromEntries(siblings.map(s=>[s.choice.level,allocatedValues(draft,s.choice,all)]));
 slots[q.level]=values;
 draft.progressionAllocations??={};draft.progressionAllocations[q.id]=slots;
 draft.selections[q.id]=Object.values(slots).flat();
}
