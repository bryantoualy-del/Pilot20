import {integer,check} from '../character/contracts.js';
/** Keep explicit die results by class level, so backtracking cannot erase rolls. */
export function hitPointPlan(index,draft){
 const issues=[],counts=new Map(),total=draft.classes.reduce((n,c)=>n+c.level,0),history=draft.advancementHistory??[];
 const order=history.length?history.map(row=>row.classId):draft.classes.flatMap(c=>Array(c.level).fill(c.id));
 if(order.length!==total)issues.push({code:'hp-chronology'});
 const mode=draft.hpMode??'average';if(!['average','rolled'].includes(mode))issues.push({code:'hp-method'});
 const levels=order.map((classId,i)=>{
  const classLevel=(counts.get(classId)??0)+1;counts.set(classId,classLevel);
  const hitDie=index.class(classId)?.data.hitDie,key=classId+':'+classLevel;
  if(!hitDie){issues.push({code:'hp-class',id:classId});return {classId,classLevel,key,hitDie:0,hp:0};}
  const hp=i===0?hitDie:mode==='average'?hitDie/2+1:draft.hpRolls?.[key]??null;
  if(!integer(hp,1,hitDie))issues.push({code:'hp-roll',id:key,characterLevel:i+1});
  return {classId,classLevel,key,hitDie,hp,characterLevel:i+1,first:i===0};
 });
 if(order[0]!==draft.classes[0].id||draft.classes.some(c=>counts.get(c.id)!==c.level))issues.push({code:'hp-chronology'});
 return {mode,levels,progression:levels.map(({classId,hp})=>({classId,hp})),valid:issues.length===0,issues};
}
export function rollHitDie(sides,random=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0];}){
 check([6,8,10,12].includes(sides),'Hit Die');const limit=4294967296-4294967296%sides;let n;
 do{n=random();check(integer(n,0,4294967295),'Random die input');}while(n>=limit);
 return n%sides+1;
}
