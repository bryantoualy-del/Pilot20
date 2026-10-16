import {check,id,json} from '../character/contracts.js';
import {StorageError} from '../persistence/adapters.js';
import {defaultCampaign,validateCampaign,parsePrivatePack,campaignCatalog} from './sources.js';

/** Versioned records in existing IndexedDB meta store; no character/session migration. */
export function campaignRepository(storage,publicPacks) {
 const planKey=(campaignId,characterId)=>'campaign:plan:'+JSON.stringify([campaignId,characterId]);
 const configKey=id=>'campaign:sources:'+id,packPrefix='campaign:private-pack:';
 async function packs(){return (await storage.list('meta',packPrefix)).map(r=>r.value);}
 return {
  async initialize(campaignId='default'){
   check(id(campaignId),'Campaign ID');const key=configKey(campaignId),old=await storage.get('meta',key);if(old!==undefined)return validateCampaign(old);
   const config=defaultCampaign(campaignId);try{await storage.batch([{store:'meta',key,value:undefined}],[{store:'meta',key,value:config}]);return config;}catch(e){if(e instanceof StorageError&&e.code==='conflict')return validateCampaign(await storage.get('meta',key));throw e;}
  },
  async get(campaignId='default'){check(id(campaignId),'Campaign ID');return validateCampaign((await storage.get('meta',configKey(campaignId)))??defaultCampaign(campaignId));},
  async save(config,{expectedRevision=null}={}){
   validateCampaign(config);const key=configKey(config.id),old=await storage.get('meta',key);
   check(old?expectedRevision===old.revision&&config.revision===old.revision+1:expectedRevision===null&&config.revision===1,'Campaign revision conflict');
   await storage.batch([{store:'meta',key,value:old}],[{store:'meta',key,value:config}]);return structuredClone(config);
  },
  async context(config){return campaignCatalog(publicPacks,await packs(),config);},
  async importPack(raw,authorization){
   const pack=parsePrivatePack(raw,authorization),key=packPrefix+pack.catalog.id;
   const old=await storage.get('meta',key);check(old===undefined,'Private pack ID already installed');
   const registry=await storage.get('meta','campaign:pack-registry');
   const existing=await packs();campaignCatalog(publicPacks,[...existing,pack],defaultCampaign());
   // Registry CAS also prevents concurrent imports bypassing collision validation.
   check(JSON.stringify(existing)===JSON.stringify(await packs()),'Private pack import conflict');
   await storage.batch([{store:'meta',key,value:old},{store:'meta',key:'campaign:pack-registry',value:registry}],[{store:'meta',key,value:pack},{store:'meta',key:'campaign:pack-registry',value:(registry??0)+1}]);
   return {id:pack.catalog.id,sourceId:pack.sourceId};
  },
  async savePlan(campaignId,characterId,request){check(id(campaignId)&&id(characterId),'Plan identity');json(request);const key=planKey(campaignId,characterId),old=await storage.get('meta',key);await storage.batch([{store:'meta',key,value:old}],[{store:'meta',key,value:{kind:'pilot20-source-build-plan',schemaVersion:1,campaignId,characterId,request:structuredClone(request)}}]);},
  async getPlan(campaignId,characterId){check(id(campaignId)&&id(characterId),'Plan identity');return storage.get('meta',planKey(campaignId,characterId));}
 };
}
