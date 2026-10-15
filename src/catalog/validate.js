import {check,keys,id,json,source,text} from '../character/contracts.js';
export function validateCatalog(c,{distribution='private'}={}) {
  json(c);keys(c,['kind','schemaVersion','ruleset','id','items']);
  check(c.kind==='catalog' && c.schemaVersion===2 && c.ruleset==='dnd5e-2014' && id(c.id) && Array.isArray(c.items),'Catalog header');
  check(new Set(c.items.map(i=>i.id)).size===c.items.length,'Duplicate content');
  for(const i of c.items) {
    keys(i,['id','type','name','source','data']);source(i.source);
    check(id(i.id) && ['weapon','armor','spell','class','race','feature','item','feat'].includes(i.type),'Catalog item');
    keys(i.name,['en','fr']);check(text(i.name.en) && text(i.name.fr) && i.data && typeof i.data==='object' && !Array.isArray(i.data),'Catalog data');
    check(distribution!=='public' || i.source.kind!=='private','Private content cannot be distributed');
  }
  return c;
}
