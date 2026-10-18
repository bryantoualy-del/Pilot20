import test from 'node:test';
import assert from 'node:assert/strict';
import {classCatalog,spellCatalog,originCatalog} from '../src/catalog/srd51-catalog.js';
import {MemoryStorage} from '../src/persistence/adapters.js';
import {characterLibrary} from '../src/persistence/library.js';
import {creatorRepository} from '../src/creator/repository.js';
import {campaignRepository} from '../src/campaign/repository.js';
import {newDraft,suggestChoices,compileDraft,draftProgression} from '../src/creator/model.js';
import {grimoireService,grimoireView,stagePreparation,stageWizardCopy} from '../src/spellbook/service.js';
async function fixture(cls='wizard',level=5){
 const storage=new MemoryStorage(),library=characterLibrary(storage),drafts=creatorRepository(storage,library),campaigns=campaignRepository(storage,[classCatalog,spellCatalog,originCatalog]);
 const config=await campaigns.initialize(),context=await campaigns.context(config);let d=newDraft();
 Object.assign(d,{name:'Grimoire test',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:cls,level,subclassId:context.index.class(cls).data.subclassIds[0]}],classChosen:true});
 if(level<context.index.class(cls).data.subclassLevel)d.classes[0].subclassId=null;
 d=suggestChoices(context,config,d);
 for(const q of draftProgression(context,config,d).choices.filter(q=>q.kind==='prepared'))d.selections[q.id]=q.options.slice(0,q.count);
 d.confirmed=d.reviewed=true;await drafts.save(d);
 const result=compileDraft(context,config,d);assert.equal(result.valid,true,JSON.stringify(result.issues));
 const saved=await drafts.finalize(d,result.character,{expectedDraftRevision:1,spellbook:result.spellbook});
 return {storage,library,drafts,campaigns,context,config,draft:saved.draft,record:saved.record,service:grimoireService({library,drafts,campaigns})};
}
test('preparation is a staged complete set; known casters get no preparation command',async()=>{
 const f=await fixture('cleric',5),q=draftProgression(f.context,f.config,f.draft).choices.find(q=>q.kind==='prepared');
 const before=structuredClone(f.draft);
 assert.deepEqual(stagePreparation(f.context,f.config,f.draft,{classId:'cleric',spellIds:[]}).selections['cleric:prepared'],[]);assert.deepEqual(f.draft,before);
 const b=await fixture('bard',10);assert.equal(grimoireView(b.context,b.config,b.draft,b.record).choices.some(q=>q.kind==='prepared'),false);
 assert.throws(()=>stagePreparation(b.context,b.config,b.draft,{classId:'bard',spellIds:[]}));
 const replacement=q.options.filter(id=>!(f.draft.selections[q.id]??[]).includes(id))[0];
 const selected=[replacement,...f.draft.selections[q.id].slice(1)];
 const out=await f.service.apply(f.draft.id,{type:'prepare',classId:'cleric',spellIds:selected},{expectedCharacterRevision:1,expectedDraftRevision:2});
 assert.equal(out.record.definition.revision,2);assert.ok(out.record.definition.spells.prepared.includes(replacement));
 assert.equal(out.record.spellbook.characterRevision,2);assert.deepEqual(f.draft,before);
});
test('wizard copy adds a book entry without using a daily preparation slot or deleting previous entries',async()=>{
 const f=await fixture('wizard',10),report=draftProgression(f.context,f.config,f.draft),q=report.choices.find(q=>q.kind==='spellbook');
 const id=q.options.find(id=>!f.draft.selections[q.id].includes(id));assert.ok(id);
 const args={type:'copy',spellId:id,confirmedCopy:true,note:'Source, time and copying cost confirmed by player'};
 assert.throws(()=>stageWizardCopy(f.context,f.config,f.draft,{...args,confirmedCopy:false}));
 const out=await f.service.apply(f.draft.id,args,{expectedCharacterRevision:1,expectedDraftRevision:2});
 assert.ok(out.record.definition.spells.known.includes(id));assert.deepEqual(out.record.definition.spells.prepared,f.record.definition.spells.prepared);
 assert.equal(out.draft.spellbookTranscriptions.length,1);assert.ok(out.record.spellbook.grants.some(g=>g.spellId===id&&g.acquisition==='copy'));
 for(const old of f.record.definition.spells.known)assert.ok(out.record.definition.spells.known.includes(old));
});
test('quota failures and stale edits leave the saved character, draft and spellbook unchanged',async()=>{
 const f=await fixture('cleric',5),q=draftProgression(f.context,f.config,f.draft).choices.find(q=>q.kind==='prepared'),command={type:'prepare',classId:'cleric',spellIds:f.draft.selections[q.id]};
 const before=await f.library.get(f.draft.id),draft=await f.drafts.get(f.draft.id);f.storage.failNext('quota');
 await assert.rejects(f.service.apply(f.draft.id,command,{expectedCharacterRevision:1,expectedDraftRevision:2}));
 assert.deepEqual(await f.library.get(f.draft.id),before);assert.deepEqual(await f.drafts.get(f.draft.id),draft);
 await assert.rejects(f.service.apply(f.draft.id,command,{expectedCharacterRevision:0,expectedDraftRevision:2}));
});
test('manual definition edits and disabled sources cannot be overwritten through an old build plan',async()=>{
 const f=await fixture(),manual=structuredClone(f.record.definition);manual.revision=2;manual.identity.description='Manual player note';await f.library.save(manual,{expectedRevision:1});
 const q=draftProgression(f.context,f.config,f.draft).choices.find(q=>q.kind==='prepared'),command={type:'prepare',classId:'wizard',spellIds:f.draft.selections[q.id]};
 await assert.rejects(f.service.apply(f.draft.id,command,{expectedCharacterRevision:2,expectedDraftRevision:2}),/differs from its build plan/);
 assert.equal((await f.library.get(f.draft.id)).definition.identity.description,'Manual player note');
 const g=await fixture('cleric',5),config={...g.config,revision:2,sourceRestrictions:true,enabledSourceIds:['xge','tce']};await g.campaigns.save(config,{expectedRevision:1});
 await assert.rejects(g.service.apply(g.draft.id,{type:'prepare',classId:'cleric',spellIds:[]},{expectedCharacterRevision:1,expectedDraftRevision:2}));
 assert.equal((await g.library.get(g.draft.id)).definition.revision,1);
});
