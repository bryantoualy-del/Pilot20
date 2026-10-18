import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {defaultCampaign,campaignCatalog,validateCampaign} from '../src/campaign/sources.js';
import {campaignRepository} from '../src/campaign/repository.js';
import {MemoryStorage,openIndexedDB} from '../src/persistence/adapters.js';
import {characterLibrary} from '../src/persistence/library.js';
import {creatorRepository} from '../src/creator/repository.js';
import {newDraft,suggestChoices,compileDraft,templateScores} from '../src/creator/model.js';
const config=defaultCampaign(),context=campaignCatalog(playerCatalogs,[],config);
function build(raceId,classId,subclassId){
 let d=Object.assign(newDraft(),{name:'Source regression',raceId,backgroundId:'srd51:background:acolyte',classChosen:true,classes:[{id:classId,level:10,subclassId}],scores:templateScores(classId)});
 d=suggestChoices(context,config,d);d.confirmed=d.reviewed=true;
 const result=compileDraft(context,config,d);
 assert.equal(result.valid,true,JSON.stringify({raceId,subclassId,issues:result.issues}));
 return {d,result};
}
test('unified default compiles Kobold Bard10 Glamour/Eloquence, Dhampir Hexblade and all Artificer10 specializations',()=>{
 for(const sub of ['xge:bard:glamour','tce:bard:eloquence']){
  const {result}=build('motm:race:kobold','bard',sub);
  assert.ok(result.character.features.some(id=>id.startsWith('motm:race:kobold:')));
  assert.ok(result.character.features.some(id=>id.startsWith(sub+':')));
 }
 const {result}=build('ravenloft:race:dhampir','warlock','xge:warlock:hexblade');
 assert.ok(result.character.features.includes('ravenloft:race:dhampir:spider-climb-hands-free'));
 assert.ok(result.character.features.some(id=>id.startsWith('xge:warlock:hexblade:')));
 const subs=context.index.class('artificer').data.subclassIds;
 assert.equal(subs.length,4);
 for(const sub of subs){const {result}=build('srd51:race:human','artificer',sub);assert.equal(result.stats.resources.slot1.max,4);assert.ok(result.grantedSpells.length);}
});
test('all four Genasi have applied racial traits and innate spells in the unified catalogue',()=>{
 const races=context.index.list('race').filter(r=>r.data.raceFamilyId?.startsWith('genasi'));
 assert.equal(races.length,4);
 for(const race of races){const {result}=build(race.id,'fighter','srd51:champion');assert.ok(result.origin.traits.length>0);assert.ok(result.origin.spells.length>0);assert.ok(result.character.features.some(id=>id.startsWith(race.id+':')));}
});
test('MJ restriction is reversible; dependency filtering and combat coverage remain independent',()=>{
 const restricted={...config,sourceRestrictions:true,enabledSourceIds:['srd51']};
 const off=campaignCatalog(playerCatalogs,[],restricted);
 assert.equal(off.index.class('artificer'),undefined);assert.equal(off.index.get('ravenloft:race:dhampir'),undefined);assert.equal(off.index.get('xge:warlock:hexblade'),undefined);
 assert.equal(off.index.get('tce:artificer:armorer'),undefined);
 const on=campaignCatalog(playerCatalogs,[],{...restricted,sourceRestrictions:false});
 assert.ok(on.index.get('ravenloft:race:dhampir'));assert.ok(on.index.get('xge:warlock:hexblade'));
 assert.deepEqual(on.index.get('xge:warlock:hexblade').data.automation,context.index.get('xge:warlock:hexblade').data.automation);
 const optional=on.installed.list('feature').find(i=>i.data.campaignOption);
 assert.ok(optional);assert.equal(on.index.get(optional.id),undefined,'optional class feature remains opt-in');
 for(const bad of [null,'false',1])assert.throws(()=>validateCampaign({...config,sourceRestrictions:bad}));
});
test('legacy IndexedDB campaign migrates once, preserving allow-list, options, finalized character and draft through reopen',async()=>{
 const name='unified-sources-'+crypto.randomUUID();let s=await openIndexedDB(name,{indexedDB});
 const legacy={...config,revision:7,enabledSourceIds:['srd51'],enabledOptions:['feats']};delete legacy.sourceRestrictions;
 await s.batch([],[{store:'meta',key:'campaign:sources:default',value:legacy}]);
 let library=characterLibrary(s),drafts=creatorRepository(s,library);
 const {d,result}=build('ravenloft:race:dhampir','warlock','xge:warlock:hexblade');
 await drafts.save(d);await drafts.finalize(d,result.character,{expectedDraftRevision:1,spellbook:result.spellbook});
 const before={draft:await drafts.get(d.id),character:await library.get(d.id)};
 const repo=campaignRepository(s,playerCatalogs),migrated=await repo.initialize();
 assert.equal(migrated.revision,8);assert.equal(migrated.sourceRestrictions,false);
 assert.deepEqual(migrated.enabledSourceIds,legacy.enabledSourceIds);assert.deepEqual(migrated.enabledOptions,legacy.enabledOptions);
 assert.deepEqual(await repo.initialize(),migrated);s.close();
 s=await openIndexedDB(name,{indexedDB});try{
  library=characterLibrary(s);drafts=creatorRepository(s,library);
  assert.deepEqual({draft:await drafts.get(d.id),character:await library.get(d.id)},before);
  const c=campaignRepository(s,playerCatalogs),reloaded=await c.get();
  assert.deepEqual(reloaded,migrated);assert.equal(compileDraft(await c.context(reloaded),reloaded,before.draft).valid,true);
 }finally{s.close();}
});
test('migration quota errors leave original legacy config and other records intact',async()=>{
 const s=new MemoryStorage(),old={...config};delete old.sourceRestrictions;
 await s.batch([],[{store:'meta',key:'campaign:sources:default',value:old}]);s.failNext('quota');
 await assert.rejects(campaignRepository(s,playerCatalogs).initialize(),e=>e.code==='quota');
 assert.deepEqual(await s.get('meta','campaign:sources:default'),old);
});
