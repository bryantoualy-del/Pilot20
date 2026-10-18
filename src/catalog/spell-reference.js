import reference from './data/spell-reference-2014.json' with {type:'json'};
const byId=new Map(reference.flatMap(s=>[[s.id,s],[s.auditId,s]]));
/** Factual reference metadata is distinct from the installed executable catalogue. */
export function spellReference(id){const s=byId.get(id);return s?structuredClone(s):null;}
export function spellReferences(){return reference.map(s=>structuredClone(s));}
export function spellMatches(id,query,entry=null){
  const s=byId.get(id);
  const text=[...(s?Object.values(s.name):[]),...(s?.aliases??[]),...Object.values(entry?.name??{})].join(' ');
  const normalize=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  return normalize(text).includes(normalize(query));
}
