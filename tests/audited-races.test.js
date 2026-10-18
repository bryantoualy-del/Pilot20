import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {extendedRaces} from '../src/catalog/races-extended.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression} from '../src/creator/model.js';
import {MemoryStorage} from '../src/persistence/adapters.js';
import {characterLibrary} from '../src/persistence/library.js';
import {creatorRepository} from '../src/creator/repository.js';
const config={...defaultCampaign(),sourceRestrictions:true,enabledSourceIds:[...defaultCampaign().enabledSourceIds,'motm','eberron','scag','strixhaven','ravenloft']};
const ctx=campaignCatalog(playerCatalogs,[],config);
function make(id,level=1){let d=Object.assign(newDraft(),{name:id,raceId:id,backgroundId:'srd51:background:acolyte',classChosen:true,scoresAreBase:true,classes:[{id:'fighter',level,subclassId:level>=3?'srd51:champion':null}]});d=suggestChoices(ctx,config,d);d.confirmed=d.reviewed=true;const r=compileDraft(ctx,config,d);assert.equal(r.valid,true,id+' '+JSON.stringify(r.issues));return {d,r};}
test('every audited new profile creates a real fighter with racial bonuses and traits',()=>{
 assert.equal(extendedRaces.items.length,38);
 for(const e of extendedRaces.items){const{r}=make(e.id);assert.equal(r.character.ancestry.id,e.id);assert.ok(r.character.proficiencies.includes('language:common'));assert.ok(r.character.features.length);}
});
test('Aasimar has celestial resistances and Light, and acquires Revelation only at3',()=>{
 const one=make('motm:race:aasimar'),three=make('motm:race:aasimar',3);
 assert.deepEqual(one.r.character.defenses.resistances.sort(),['necrotic','radiant']);
 assert.ok(one.r.origin.spells.some(s=>ctx.index.get(s.id).name.en==='Light'&&s.ability==='cha'));
 assert.equal(one.r.origin.traits.some(t=>t.id==='revelation-celeste'),false);
 assert.equal(three.r.origin.traits.some(t=>t.id==='revelation-celeste'),true);
});
test('flight follows walking speed, permits light armor and stops in medium or heavy armor',()=>{
 for(const armor of ['none','leather','scale','chain']){const{d}=make('motm:race:aarakocra');d.equipment=armor;const r=compileDraft(ctx,config,d);assert.equal(r.valid,true);assert.equal(r.stats.movement.fly,['none','leather'].includes(armor)?30:0);}
});
test('Tortle and Lizardfolk use natural armor; Warforged adds exactly1; Harengon adds proficiency to initiative',()=>{
 assert.equal(make('motm:race:torte').r.stats.ac,17);
 const l=make('motm:race:homme-lezard');assert.equal(l.r.stats.ac,13+Math.floor((l.r.character.scores.dex-10)/2));
 const w=make('eberron:race:forgelier');assert.equal(w.r.stats.ac,11+Math.floor((w.r.character.scores.dex-10)/2));
 const h=make('motm:race:conil');assert.equal(h.r.stats.initiative,2+Math.floor((h.r.character.scores.dex-10)/2));
});
test('innate spells acquire at actual levels, retain chosen ability and share Hexblood free-use pool',()=>{
 assert.equal(make('motm:race:genasi-de-l-air').r.origin.spells.length,1);
 const g=make('motm:race:genasi-de-l-air',5);assert.equal(g.r.origin.spells.length,3);assert.ok(g.r.origin.spells.every(s=>s.ability==='int'));
 const h=make('ravenloft:race:sang-maudit');const pools=h.r.character.resources.filter(r=>r.id.includes('hexblood-magic'));
 assert.equal(pools.length,1);assert.equal(pools[0].max,1);assert.equal(pools[0].recovery,'long');
});
test('a disabled racial source is filtered, while its installed data remain intact',()=>{
 const off=campaignCatalog(playerCatalogs,[],{...defaultCampaign(),sourceRestrictions:true});assert.equal(off.index.get('motm:race:aasimar'),undefined);assert.ok(off.installed.get('motm:race:aasimar'));
});
test('racial decisions and spell origins survive finalize, export and import',async()=>{
 const{d,r}=make('motm:race:aasimar',3),s=new MemoryStorage(),repo=creatorRepository(s,characterLibrary(s));
 await repo.save(d);await repo.finalize(d,r.character,{expectedDraftRevision:1,spellbook:r.spellbook});
 const other=new MemoryStorage(),copy=creatorRepository(other,characterLibrary(other));await copy.import(await repo.export(d.id));
 assert.deepEqual((await copy.get(d.id)).originSelections,d.originSelections);
 const record=await characterLibrary(other).get(d.id);assert.deepEqual(record.spellbook.grants.map(g=>[g.spellId,g.castingAbility]),r.spellbook.grants.map(g=>[g.spellId,g.castingAbility]));
});
