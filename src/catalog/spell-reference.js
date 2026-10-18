import reference from './data/spell-reference-2014.json' with {type:'json'};
import phb from './data/phb-spell-facts.json' with {type:'json'};
const extra=phb.map(s=>({id:'phb14:spell:'+s.name_en.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,''),name:{fr:s.name_en==='Conjure Barrage'?'Hérissement de projectiles':s.name_fr,en:s.name_en},aliases:[s.name_fr],sourceIds:['phb14'],references:[{sourceId:'phb14',pages:[]}],level:s.level,schoolFr:s.school,classIds:s.classIds,optionalTashaClassIds:s.optionalTashaClassIds,casting:{time:s.castingTime,range:s.range,components:s.components,material:null,duration:s.duration,concentration:/concentration/i.test(s.duration),ritual:s.ritual},detailUrl:s.url,semanticReviewComplete:false}));
const all=[...reference,...extra];
const byId=new Map(all.flatMap(s=>[[s.id,s],...(s.auditId?[[s.auditId,s]]:[])]));
/** Factual reference metadata is distinct from the installed executable catalogue. */
export function spellReference(id){const s=byId.get(id);return s?structuredClone(s):null;}
export function spellReferences(){return all.map(s=>structuredClone(s));}
export function spellMatches(id,query,entry=null){
  const s=byId.get(id);
  const text=[...(s?Object.values(s.name):[]),...(s?.aliases??[]),...Object.values(entry?.name??{})].join(' ');
  const normalize=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  return normalize(text).includes(normalize(query));
}
