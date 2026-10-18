import {check,keys,id,integer} from '../character/contracts.js';
export function validateGrantReplacements(rows){
 check(Array.isArray(rows)&&rows.length<=100,'Spell grant replacement list');
 for(const row of rows){keys(row,['originId','originalSpellId','spellId','classLevel']);check(id(row.originId)&&id(row.originalSpellId)&&id(row.spellId)&&integer(row.classLevel,1,20),'Spell grant replacement');}
 return rows;
}
export function replacementOptions(index,originId,originalSpellId){
 const spec=index.get(originId)?.data.spellGrantReplacement,original=index.get(originalSpellId);
 if(!spec||original?.type!=='spell')return [];
 return index.list('spell').filter(s=>s.data.level===original.data.level&&spec.schools.includes(s.data.school)&&s.data.classIds.some(id=>spec.classIds.includes(id)));
}
/** Preserve a slot's original identity and record only explicit player exchanges. */
export function resolveSpellGrants(index,cls,extraSpells,replacements){
 const issues=[],rows=extraSpells.filter(r=>['known','prepared','book'].includes(r.mode)).flatMap(r=>r.spellIds.map(id=>({id,originalSpellId:id,classId:cls.id,mode:r.mode,ownerId:r.ownerId,classLevel:r.classLevel})));
 const used=new Set();
 for(const swap of replacements.filter(r=>index.get(r.originId)?.data.classId===cls.id).sort((a,b)=>a.classLevel-b.classLevel)){
  const row=rows.find(r=>r.ownerId===swap.originId&&r.originalSpellId===swap.originalSpellId),key=swap.originId+':'+swap.classLevel;
  if(!row||row.mode!=='known'||swap.classLevel>cls.level||swap.classLevel<row.classLevel||used.has(key)||!replacementOptions(index,swap.originId,swap.originalSpellId).some(s=>s.id===swap.spellId)||row.id===swap.spellId){issues.push({code:'invalid-granted-spell-replacement',id:swap.spellId});continue;}
  used.add(key);row.id=swap.spellId;row.classLevel=swap.classLevel;
 }
 for(const row of rows)if(rows.some(other=>other!==row&&other.classId===row.classId&&other.id===row.id))issues.push({code:'duplicate-granted-spell',id:row.id});
 return {rows,issues};
}
