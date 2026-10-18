import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {defaultCampaign,campaignCatalog,validateSavedPlan} from '../src/campaign/sources.js';
import {campaignRepository} from '../src/campaign/repository.js';
import {newDraft,suggestChoices,compileDraft,buildRequest} from '../src/creator/model.js';
import {openIndexedDB} from '../src/persistence/adapters.js';
import {characterLibrary} from '../src/persistence/library.js';
import {creatorRepository} from '../src/creator/repository.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
function complete(raceId,classId,subclassId){
 let d=Object.assign(newDraft(),{name:'Sources regression',raceId,backgroundId:'srd51:background:acolyte',classes:[{id:classId,level:10,subclassId}],classChosen:true});
 d=suggestChoices(ctx,config,d);d.reviewed=d.confirmed=true;
 const result=compileDraft(ctx,config,d);
 assert.equal(result.valid,true,JSON.stringify(result.issues));return {d,result};
}
test('all installed 2014 content is visible by default, independent of automation; optional mechanics stay opt-in',()=>{
 for(const entry of ctx.installed.list()){
  if(entry.data.campaignOption)assert.equal(ctx.index.get(entry.id),undefined,entry.id);
  else assert.ok(ctx.index.get(entry.id),entry.id);
 }
 assert.equal(ctx.index.class('artificer').data.subclassIds.length,4);
 assert.ok(ctx.index.list().some(i=>i.data.automation.status==='manual'));
 assert.ok(ctx.index.list().every(i=>i.data.ruleset==='dnd5e-2014'));
});
test('Kobold Bard10 Glamour and Eloquence, Dhampir Hexblade, four Genasi with traits and Artificer10 specializations compile',()=>{
 for(const sub of ['xge:bard:glamour','tce:bard:eloquence']){
  const {result}=complete('motm:race:kobold','bard',sub);
  assert.ok(result.character.features.some(id=>id.startsWith(sub+':')));
 }
 const dhampir=complete('ravenloft:race:dhampir','warlock','xge:warlock:hexblade');
 assert.ok(dhampir.result.character.features.includes('ravenloft:race:dhampir:spider-climb-hands-free'));
 for(const race of ctx.index.list('race').filter(r=>r.id.includes('genasi'))){
  const {result}=complete(race.id,'fighter','srd51:champion');
  assert.ok(result.character.features.some(id=>id.startsWith(race.id+':')),race.id);
 }
 for(const sub of ctx.index.class('artificer').data.subclassIds)complete('srd51:race:human','artificer',sub);
});
test('MJ restrictions toggle without changing saved choices, retained allowlist or installed automation',()=>{
 const {d}=complete('ravenloft:race:dhampir','warlock','xge:warlock:hexblade'),saved=structuredClone(d),allowlist=['srd51'];
 const restricted={...config,sourceRestrictionsEnabled:true,enabledSourceIds:allowlist};
 const off=campaignCatalog(playerCatalogs,[],restricted);
 assert.equal(validateSavedPlan(off,buildRequest(d)).valid,false);
 assert.equal(off.index.class('artificer'),undefined);
 const restored=campaignCatalog(playerCatalogs,[],{...restricted,sourceRestrictionsEnabled:false});
 assert.equal(validateSavedPlan(restored,buildRequest(d)).valid,true);
 assert.deepEqual(restored.index.get(d.raceId).data.automation,ctx.index.get(d.raceId).data.automation);
 assert.deepEqual(d,saved);assert.deepEqual(restricted.enabledSourceIds,allowlist);
});
test('legacy configuration migration is atomic and preserves drafts, plans and finalized characters across IndexedDB reopen',async()=>{
 const db='unified-sources-'+crypto.randomUUID();let storage=await openIndexedDB(db,{indexedDB});
 let campaigns=campaignRepository(storage,playerCatalogs),library=characterLibrary(storage),drafts=creatorRepository(storage,library);
 const {d,result}=complete('motm:race:kobold','bard','tce:bard:eloquence');
 await drafts.save(d);await drafts.finalize(d,result.character,{expectedDraftRevision:d.revision,spellbook:result.spellbook});
 await campaigns.savePlan('default',d.id,buildRequest(d));
 const legacy={...config,enabledSourceIds:['srd51'],enabledOptions:['feats']};delete legacy.sourceRestrictionsEnabled;
 await storage.batch([],[{store:'meta',key:'campaign:sources:default',value:legacy}]);
 const beforeDraft=await drafts.get(d.id),beforeCharacter=await library.get(d.id),beforePlan=await campaigns.getPlan('default',d.id);
 const migrated=await campaigns.initialize();assert.deepEqual(migrated,{...legacy,revision:2,sourceRestrictionsEnabled:false});
 assert.equal((await campaigns.initialize()).revision,2);storage.close();
 storage=await openIndexedDB(db,{indexedDB});campaigns=campaignRepository(storage,playerCatalogs);library=characterLibrary(storage);drafts=creatorRepository(storage,library);
 assert.deepEqual(await drafts.get(d.id),beforeDraft);assert.deepEqual(await library.get(d.id),beforeCharacter);assert.deepEqual(await campaigns.getPlan('default',d.id),beforePlan);
 assert.equal(validateSavedPlan(await campaigns.context(await campaigns.get()),beforePlan.request).valid,true);storage.close();
});
