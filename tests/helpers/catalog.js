import {resolveProgression} from '../../src/catalog/progression.js';
import {buildCharacter} from '../../src/catalog/character-builder.js';
/** Explicit synthetic selections for tests only. Production never calls this helper. */
export function catalogRequest(index,classId,{level=10,subclass=true,classes=null,spellIds=[]}={}) {
 const cls=index.class(classId);
 const request={id:'catalog-'+classId,name:'Catalog '+classId,classes:classes??[{id:classId,level,subclassId:subclass&&level>=cls.data.subclassLevel?cls.data.subclassIds[0]:null}],scores:{str:13,dex:13,con:12,int:13,wis:13,cha:13},selections:{}};
 for(let pass=0;pass<4;pass++) {
  const report=resolveProgression(index,request);const expertise=new Set(),skills=new Set(),features=new Set(),spellsByClass=new Map(),groups=new Map();
  for(const choice of report.choices) {
   if(choice.kind==='subclass')continue;
   if(choice.kind==='asi') {
    const stats={...request.scores};for(const [key,values] of Object.entries(request.selections))if(key!==choice.id&&key.includes(':asi-'))for(const v of values){const [,a,b]=v.split(':');stats[a]++;stats[b]++;}
    const v=choice.options.find(v=>{const [,a,b]=v.split(':');return stats[a]+(a===b?2:1)<=20&&stats[b]+(a===b?2:1)<=20;});request.selections[choice.id]=[v];continue;
   }
   const spellSet=spellsByClass.get(choice.classId)??new Set();
   const group=choice.distinctGroup?(groups.get(choice.distinctGroup)??new Set()):new Set();
   const preferred=spellIds.filter(s=>choice.options.includes(s));
   const options=[...new Set([...preferred,...choice.options])].filter(v=>(choice.kind!=='expertise'||!expertise.has(v))&&(choice.kind!=='skill'||!skills.has(v))&&(choice.kind!=='feature'||!features.has(v))&&(choice.kind!=='spell'||!spellSet.has(v))&&!group.has(v));
   request.selections[choice.id]=options.slice(0,choice.count);
   if(choice.distinctGroup){request.selections[choice.id].forEach(v=>{if(v!=='language:none')group.add(v);});groups.set(choice.distinctGroup,group);}
   if(choice.kind==='spell'){request.selections[choice.id].forEach(v=>spellSet.add(v));spellsByClass.set(choice.classId,spellSet);}
   if(choice.kind==='skill')request.selections[choice.id].forEach(v=>skills.add(v));
   if(choice.kind==='feature')request.selections[choice.id].forEach(v=>features.add(v));
   if(choice.kind==='expertise')request.selections[choice.id].forEach(v=>expertise.add(v));
  }
 }
 return request;
}
export function catalogCharacter(index,classId,options={}) {
 const request=catalogRequest(index,classId,options),r=buildCharacter(index,request);
 if(!r.valid)throw Error(JSON.stringify(r.issues));return r.character;
}
