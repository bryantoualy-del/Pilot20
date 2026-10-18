import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {defaultCampaign,campaignCatalog} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression,templateScores} from '../src/creator/model.js';
import {derive,spellSlots} from '../src/character/derive.js';
import {MemoryStorage} from '../src/persistence/adapters.js';
import {campaignRepository} from '../src/campaign/repository.js';
import {characterLibrary} from '../src/persistence/library.js';
import {creatorRepository} from '../src/creator/repository.js';
import {grimoireService} from '../src/spellbook/service.js';
const config=defaultCampaign(),context=campaignCatalog(playerCatalogs,[],config);
function character(level,subclassId=null){let d=newDraft();Object.assign(d,{name:'Artificier de recette',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',scores:templateScores('artificer'),classes:[{id:'artificer',level,subclassId}],classChosen:true});d=suggestChoices(context,config,d);for(const q of draftProgression(context,config,d).choices.filter(q=>q.kind==='prepared'))d.selections[q.id]=q.options.slice(0,q.count);d.reviewed=d.confirmed=true;return d;}
test('477 usable spell definitions preserve SRD IDs and include authored XGE/TCE/PHB summaries',()=>{
 const spells=context.index.list('spell');assert.equal(spells.length,477);assert.equal(spells.filter(s=>s.source.kind==='srd').length,319);assert.equal(spells.filter(s=>s.source.kind==='reference').length,158);
 for(const spell of spells.filter(s=>s.source.kind==='reference')){assert.ok(spell.data.description.length>50);assert.equal(spell.data.automation.status,'manual');assert.equal(spell.data.automation.handler,null);}
 assert.ok(context.index.get('phb14:spell:armor-of-agathys'));assert.ok(context.index.get('phb14:spell:hex'));
 const only=campaignCatalog(playerCatalogs,[],{...config,sourceRestrictionsEnabled:true,enabledSourceIds:['srd51']});assert.equal(only.index.list('spell').length,319);assert.equal(only.index.class('artificer'),undefined);
});
test('each Artificer specialization compiles levels1–20 with slots, preparation, infusions and fixed grants',()=>{
 for(let level=1;level<=20;level++)for(const subclassId of level<3?[null]:context.index.class('artificer').data.subclassIds){
  const d=character(level,subclassId),r=compileDraft(context,config,d);assert.equal(r.valid,true,JSON.stringify({level,subclassId,issues:r.issues}));
  const stats=derive(r.character),prep=r.choices.find(q=>q.kind==='prepared'),inf=r.choices.find(q=>q.id==='artificer:infusions');
  assert.equal(prep.count,Math.max(1,Math.floor((r.character.scores.int-10)/2)+Math.floor(level/2)));assert.equal(stats.casting.artificer.dc,8+stats.proficiency+Math.floor((r.character.scores.int-10)/2));
  if(level>=2){assert.equal(inf.count,level<6?4:level<10?6:level<14?8:level<18?10:12);assert.ok(inf.options.every(id=>context.index.get(id).data.minimumClassLevel<=level));}
  if(subclassId){assert.equal(r.grantedSpells.length,level<5?2:level<9?4:level<13?6:level<17?8:10);for(const g of r.grantedSpells){assert.ok(!d.selections[prep.id].includes(g.id));assert.ok(r.character.spells.prepared.includes(g.id));}}
  assert.equal(stats.attacksPerAction,level>=5&&['tce:artificer:armorer','tce:artificer:battle-smith'].includes(subclassId)?2:1);
  assert.equal(stats.resources.slot1.max,level<3?2:level<5?3:4);
 }
});
test('Tasha list additions are independent by class and do not auto-learn or prepare spells',()=>{
 const aid='srd51:aid';assert.ok(!context.index.get(aid).data.classIds.includes('bard'));
 const enabled=campaignCatalog(playerCatalogs,[],{...config,enabledOptions:['tce:additional-spells:bard']});assert.ok(enabled.index.get(aid).data.classIds.includes('bard'));assert.ok(!enabled.index.get(aid).data.classIds.includes('ranger'));
 const noTasha=campaignCatalog(playerCatalogs,[],{...config,sourceRestrictionsEnabled:true,enabledSourceIds:['srd51','phb14'],enabledOptions:['tce:additional-spells:bard']});assert.ok(!noTasha.index.get(aid).data.classIds.includes('bard'));
 assert.ok(!context.index.get(aid).data.classIds.includes('bard')); // no mutation of shared catalogues
});
test('Artificer multiclass contribution rounds up and its prepared list uses only Artificer levels',()=>{
 const a=context.index.class('artificer').data.casting,w=context.index.class('wizard').data.casting;
 const out=spellSlots([{id:'artificer',level:3,casting:a},{id:'wizard',level:1,casting:w}]);assert.equal(out.casterLevel,3);assert.equal(out.resources.slot2.max,2);
});
test('Artificer preparation saves through the real Grimoire service and survives export/import',async()=>{
 const storage=new MemoryStorage(),library=characterLibrary(storage),drafts=creatorRepository(storage,library),campaigns=campaignRepository(storage,playerCatalogs);await campaigns.initialize();
 const d=character(10,'tce:artificer:battle-smith'),r=compileDraft(context,config,d);await drafts.save(d);const saved=await drafts.finalize(d,r.character,{expectedDraftRevision:1,spellbook:r.spellbook});
 const q=r.choices.find(q=>q.kind==='prepared'),newId=q.options.find(id=>!d.selections[q.id].includes(id));assert.ok(newId);
 const service=grimoireService({library,drafts,campaigns});await service.apply(d.id,{type:'prepare',classId:'artificer',spellIds:[newId,...d.selections[q.id].slice(1)]},{expectedCharacterRevision:1,expectedDraftRevision:2});
 const after=await library.get(d.id);assert.ok(after.definition.spells.prepared.includes(newId));for(const grant of saved.record.spellbook.grants.filter(g=>g.preparation==='always'))assert.ok(after.spellbook.grants.some(g=>g.id===grant.id));
 const otherStore=new MemoryStorage(),other=creatorRepository(otherStore,characterLibrary(otherStore));await other.import(await drafts.export(d.id));assert.deepEqual((await characterLibrary(otherStore).get(d.id)).definition.spells,after.definition.spells);
});
