import test from 'node:test';import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,changePrimaryClass} from '../src/creator/model.js';
import {singlePath,decisionReady} from '../src/creator/single-path.js';
import {startingEquipment} from '../src/creator/starting-equipment.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
function draft(cls='fighter',level=1){const def=ctx.index.class(cls).data;return Object.assign(newDraft(),{name:'Équipement — recette synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:cls,level,subclassId:level>=def.subclassLevel?def.subclassIds[0]:null}],classChosen:true,startingEquipmentEnabled:true,startingEquipmentChoices:{}});}
function build(d){d=suggestChoices(ctx,config,d);d.reviewed=d.confirmed=true;const r=compileDraft(ctx,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));return{d,r};}
test('all 13 initial classes compile actual named equipment, quantities and matching profiles',()=>{
 for(const cls of ctx.index.list('class')){
  const {r}=build(draft(cls.data.classId)),kit=r.character.equipment.filter(e=>e.id.startsWith('starting:'));
  assert.ok(kit.length>=3);for(const e of kit){assert.ok(e.name.fr&&e.name.en);assert.ok(e.quantity>=1);assert.equal(e.kind==='weapon',e.weapon!==null);assert.equal(['armor','shield'].includes(e.kind),e.armor!==null);}
  if(cls.data.classId==='artificer'){assert.equal(kit.find(e=>e.id.endsWith(':bolts')).quantity,20);assert.ok(kit.some(e=>e.id.endsWith(':thieves-tools')));}
 }
});
test('fighter alternatives change armor, weapons and derived AC without granting extra multiclass kits',()=>{
 const base=draft();base.selections['fighter:fighting-style']=['srd51:fighter:archery'];const {d,r}=build(base);assert.equal(r.stats.ac,18);assert.equal(r.character.equipment.find(e=>e.id.endsWith(':bolts')).quantity,20);
 const changed=structuredClone(d);changed.startingEquipmentChoices['starting:fighter:armor']=['leather-bow'];changed.startingEquipmentChoices['starting:fighter:arms']=['two-weapons'];changed.startingEquipmentChoices['starting:fighter:martial-1']=['rapier'];changed.startingEquipmentChoices['starting:fighter:martial-2']=['rapier'];
 const next=build(changed);assert.equal(next.r.character.equipment.some(e=>e.kind==='shield'),false);assert.equal(next.r.character.equipment.find(e=>e.id.endsWith(':rapier')).quantity,2);assert.ok(next.r.character.equipment.some(e=>e.id.endsWith(':longbow')));assert.ok(next.r.stats.ac<18);
 const before=structuredClone(next.d.startingEquipmentChoices);changePrimaryClass(next.d,'wizard');const wizard=build(next.d);assert.deepEqual(Object.fromEntries(Object.entries(wizard.d.startingEquipmentChoices).filter(([id])=>id.startsWith('starting:fighter:'))),before);assert.ok(!wizard.r.character.equipment.some(e=>e.id.startsWith('starting:fighter:')));
 const multi=structuredClone(d);multi.classes.push({id:'rogue',level:1,subclassId:null});const kit=startingEquipment(multi,r.character.proficiencies);assert.ok(kit.choices.every(q=>q.id.startsWith('starting:fighter:')));
});
test('missing equipment decisions block finalization while old drafts retain their equipment exactly',()=>{
 const input=draft(),path=singlePath(ctx,config,input),q=path.decisions.find(d=>d.kind==='equipment-choice');assert.ok(q);assert.equal(decisionReady(q,path.report,input),false);
 const complete=build(input),missing=structuredClone(complete.d);delete missing.startingEquipmentChoices[q.choice.id];assert.equal(compileDraft(ctx,config,missing).valid,false);
 const legacy=structuredClone(complete.d);delete legacy.startingEquipmentEnabled;legacy.equipment='chain';legacy.shield=true;const result=compileDraft(ctx,config,legacy);assert.equal(result.valid,true);assert.ok(result.character.equipment.some(e=>e.id==='user:armor'));assert.ok(!result.character.equipment.some(e=>e.id.startsWith('starting:')));
});
test('cleric chain mail requires actual heavy-armor proficiency, including Life domain',()=>{
 const life=build(draft('cleric'));assert.ok(life.r.character.proficiencies.includes('heavy-armor'));assert.ok(startingEquipment(life.d,life.r.character.proficiencies).choices.find(q=>q.id.endsWith(':armor')).options.some(o=>o.id==='chain'));
 assert.equal(startingEquipment(life.d,['light-armor','medium-armor']).choices.find(q=>q.id.endsWith(':armor')).options.some(o=>o.id==='chain'),false);
});
test('saved starting kit survives reopening and a wizard book update without changing inventory',async()=>{
 const {MemoryStorage}=await import('../src/persistence/adapters.js'),{characterLibrary}=await import('../src/persistence/library.js'),{creatorRepository}=await import('../src/creator/repository.js'),{campaignRepository}=await import('../src/campaign/repository.js'),{grimoireService}=await import('../src/spellbook/service.js');
 const storage=new MemoryStorage(),library=characterLibrary(storage),drafts=creatorRepository(storage,library),campaigns=campaignRepository(storage,playerCatalogs);await campaigns.initialize();
 const {d,r}=build(draft('wizard',10));await drafts.save(d);const saved=await drafts.finalize(d,r.character,{expectedDraftRevision:1,spellbook:r.spellbook});
 const reopened=await drafts.get(d.id);assert.deepEqual(reopened.startingEquipmentChoices,d.startingEquipmentChoices);assert.deepEqual((await library.get(d.id)).definition.equipment,r.character.equipment);
 const q=singlePath(ctx,config,reopened).report.choices.find(q=>q.kind==='spellbook'),spellId=q.options.find(id=>!reopened.selections[q.id].includes(id));assert.ok(spellId);
 const updated=await grimoireService({library,drafts,campaigns}).apply(d.id,{type:'copy',spellId,confirmedCopy:true,note:'Conditions et frais de copie vérifiés pour ce test.'},{expectedCharacterRevision:1,expectedDraftRevision:saved.draft.revision});
 assert.deepEqual(updated.record.definition.equipment,r.character.equipment);assert.ok(updated.record.definition.spells.known.includes(spellId));
});
