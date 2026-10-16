import {check, json, keys, id} from '../character/contracts.js';
import {createCatalogIndex, validateCatalogV3} from '../catalog/catalog-v3.js';
import {buildCharacter} from '../catalog/character-builder.js';

export const SOURCES=Object.freeze([
 Object.freeze({id:'srd51',name:'SRD 5.1 — D&D 5e 2014'}),
 Object.freeze({id:'xge',name:'Guide complet de Xanathar'}),
 Object.freeze({id:'tce',name:'Chaudron des merveilles de Tasha'})
]);
const uniqueIds=v=>Array.isArray(v)&&v.every(id)&&new Set(v).size===v.length;
export function defaultCampaign(campaignId='default') {
 return {kind:'pilot20-campaign-sources',schemaVersion:1,id:campaignId,revision:1,ruleset:'dnd5e-2014',enabledSourceIds:SOURCES.map(s=>s.id),enabledOptions:[]};
}
export function validateCampaign(c) {
 json(c);keys(c,['kind','schemaVersion','id','revision','ruleset','enabledSourceIds','enabledOptions']);
 check(c.kind==='pilot20-campaign-sources'&&c.schemaVersion===1&&c.ruleset==='dnd5e-2014'&&id(c.id)&&Number.isSafeInteger(c.revision)&&c.revision>0,'Campaign header');
 check(uniqueIds(c.enabledSourceIds)&&c.enabledSourceIds.every(s=>SOURCES.some(r=>r.id===s))&&uniqueIds(c.enabledOptions),'Campaign sources/options');return c;
}
/** Local JSON only. The acknowledgement records the user's authorization, not a rights certification. */
export function parsePrivatePack(raw,{authorized=false}={}) {
 check(authorized===true,'Confirm authorization for local private use');
 check(typeof raw==='string'&&new TextEncoder().encode(raw).length<=8000000,'Private pack size');
 const p=JSON.parse(raw);json(p);keys(p,['kind','schemaVersion','sourceId','catalog']);
 check(p.kind==='pilot20-private-rule-pack'&&p.schemaVersion===1&&['xge','tce'].includes(p.sourceId),'Private pack header');
 validateCatalogV3(p.catalog);check(p.catalog.items.length>0&&p.catalog.items.every(i=>i.source.kind==='private'),'Private provenance required');
 return p;
}
const view=items=>{
 const entries=new Map(items.map(i=>[i.id,structuredClone(i)]));
 const classes=new Map(items.filter(i=>i.type==='class').map(i=>[i.data.classId,i]));
 return Object.freeze({get:k=>structuredClone(entries.get(k)),list:t=>[...entries.values()].filter(i=>!t||i.type===t).map(structuredCloneSafe),class:k=>structuredClone(classes.get(k)),size:entries.size});
};
const structuredCloneSafe=v=>structuredClone(v);
/** Validate the complete installed graph BEFORE filtering, including disabled packs/options. */
export function campaignCatalog(publicPacks,privatePacks,campaign) {
 validateCampaign(campaign);
 check(Array.isArray(publicPacks)&&publicPacks.every(p=>p.items.every(i=>i.source.kind==='srd')),'Only SRD in public packs');
 const wrappers=privatePacks.map(p=>parsePrivatePack(JSON.stringify(p),{authorized:true}));
 const packs=[...publicPacks,...wrappers.map(p=>p.catalog)];
 const options=[...new Set(packs.flatMap(p=>p.items.map(i=>i.data.campaignOption).filter(Boolean)))];
 const installed=createCatalogIndex(packs,{enabledPackIds:wrappers.map(p=>p.catalog.id),enabledOptions:options});
 const origins=new Map(packs.flatMap((p,n)=>p.items.map(i=>[i.id,n<publicPacks.length?'srd51':wrappers[n-publicPacks.length].sourceId])));
 let items=installed.list().filter(i=>campaign.enabledSourceIds.includes(origins.get(i.id))&&(!i.data.campaignOption||campaign.enabledOptions.includes(i.data.campaignOption)));
 // Remove dependent definitions rather than offering incomplete or dangling builds.
 let changed=true;
 while(changed){const ids=new Set(items.map(i=>i.id)),classes=new Set(items.filter(i=>i.type==='class').map(i=>i.data.classId));const previous=items.length;
  items=items.filter(i=>{
   const d=i.data;
   if(['subclass','feature'].includes(i.type)&&!classes.has(d.classId))return false;
   if(i.type==='spell'&&!d.classIds.some(c=>classes.has(c)))return false;
   return [...(d.requires??[]),...(d.replaces??[]),...(d.grants??[]).flatMap(r=>r.featureIds),...(d.extraSpells??[]).flatMap(r=>r.spellIds)].every(ref=>ids.has(ref));
  });changed=items.length!==previous;
 }
 const ids=new Set(items.map(i=>i.id)),classes=new Set(items.filter(i=>i.type==='class').map(i=>i.data.classId));
 for(const i of items){const d=i.data;
  if(d.subclassIds)d.subclassIds=d.subclassIds.filter(ref=>ids.has(ref));
  if(d.classIds)d.classIds=d.classIds.filter(ref=>classes.has(ref));
  if(d.choices)d.choices=d.choices.filter(q=>(!q.subclassId||ids.has(q.subclassId))&&(!q.requiresSelected||ids.has(q.requiresSelected))).map(q=>({...q,options:q.options.filter(ref=>!installed.get(ref)||ids.has(ref))}));
 }
 const index=view(items);
 const statuses=SOURCES.map(s=>{
  const defined=installed.list().filter(i=>origins.get(i.id)===s.id),active=index.list().filter(i=>origins.get(i.id)===s.id);
  return {...s,selected:campaign.enabledSourceIds.includes(s.id),packIds:packs.filter(p=>p.items.some(i=>origins.get(i.id)===s.id)).map(p=>p.id),installedEntries:defined.length,availableEntries:active.length,coverage:Object.fromEntries(['automated','partial','manual','unsupported'].map(k=>[k,active.filter(i=>i.data.automation.status===k).length]))};
 });
 return {index,installed,campaign:structuredClone(campaign),statuses,options:[{id:'feats',name:'Dons (contenu installé uniquement)',sourceIds:['srd51'],enabled:campaign.enabledOptions.includes('feats')},{id:'multiclass',name:'Multiclassage',sourceIds:['srd51'],enabled:campaign.enabledOptions.includes('multiclass')},...options.map(optionId=>({id:optionId,name:installed.list().find(i=>i.data.campaignOption===optionId).name.fr,sourceIds:[...new Set(installed.list().filter(i=>i.data.campaignOption===optionId).map(i=>origins.get(i.id)))],enabled:campaign.enabledOptions.includes(optionId)}))]};
}
/** Does not modify saved selections. Disabled references require review before recompilation. */
export function validateSavedPlan(context,request) {
 const {index,installed}=context,issues=[];
 for(const c of request.classes){if(!index.class(c.id))issues.push({code:'unavailable-class',id:c.id});if(c.subclassId&&!index.get(c.subclassId))issues.push({code:'unavailable-subclass',id:c.subclassId});}
 for(const [choiceId,values] of Object.entries(request.selections??{}))for(const value of values)if(installed.get(value)&&!index.get(value))issues.push({code:'unavailable-selection',choiceId,id:value});
 for(const ref of request.sourceReferences??[])if(!index.get(ref))issues.push({code:'unavailable-selection',id:ref});
 for(const t of request.spellbookTranscriptions??[])if(!index.get(t.spellId))issues.push({code:'unavailable-transcription',id:t.spellId});
 return {valid:issues.length===0,issues};
}
export function buildCampaignCharacter(context,request,campaign) {
 validateCampaign(campaign);
 check(JSON.stringify(context.campaign)===JSON.stringify(campaign),'Stale campaign catalogue; reload before validation');
 const validation=validateSavedPlan(context,request);
 if(request.classes.length>1&&(!campaign.enabledSourceIds.includes('srd51')||!campaign.enabledOptions.includes('multiclass')))validation.issues.push({code:'multiclass-option-disabled'});
 validation.valid=validation.issues.length===0;
 if(!validation.valid)return {...validation,character:null};
 // A complete revalidation always runs on reactivation; no cached compiled character is promoted.
 const result=buildCharacter(context.index,{...structuredClone(request),campaignOptions:campaign.enabledOptions});
 if(result.character){
  const acquired=new Set([...result.character.features,...result.character.spells.known,...request.classes.flatMap(c=>[context.index.class(c.id).id,...(c.subclassId?[c.subclassId]:[])])]);
  result.coverage=[...acquired].map(id=>context.index.get(id)).filter(Boolean).map(i=>({id:i.id,...i.data.automation}));
  result.manualRequirements.push(...result.coverage.filter(i=>i.status!=='automated').map(i=>({entryId:i.id,status:i.status,reason:i.limits.join('; ')||'Manual review required'})));
 }
 return result;
}
