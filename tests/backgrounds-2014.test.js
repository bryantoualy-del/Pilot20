import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {backgrounds2014,planarInfusions} from '../src/catalog/backgrounds-2014.js';
import {defaultCampaign,campaignCatalog} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft} from '../src/creator/model.js';
import {validateCatalogV3} from '../src/catalog/catalog-v3.js';
import {economy} from '../src/creator/equipment-economy.js';
import {backgroundKit} from '../src/creator/background-equipment.js';
const cfg=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],cfg);
function draft(id,extra={}){return Object.assign(newDraft(),{name:'Historique',raceId:'srd51:race:human',backgroundId:id,classChosen:true,classes:[{id:'fighter',level:1,subclassId:null}],startingEquipmentEnabled:true,startingEquipmentVersion:2},extra);}
function build(d){d=suggestChoices(ctx,cfg,d);d.confirmed=d.reviewed=true;const r=compileDraft(ctx,cfg,d);assert.equal(r.valid,true,JSON.stringify(r.issues));return {d,r};}
test('30 stable unique entries: all official AideDD builder backgrounds plus Eberron, no community or 2024 options',()=>{
 const all=ctx.index.list('background');assert.equal(all.length,30);assert.equal(new Set(all.map(b=>b.id)).size,30);assert.equal(new Set(all.map(b=>b.name.en)).size,30);
 for(const c of playerCatalogs)validateCatalogV3(c,{distribution:'public'});
 for(const bg of backgrounds2014.items)for(const cls of ['fighter','rogue']){const {d,r}=build(draft(bg.id,{classes:[{id:cls,level:1,subclassId:null}]}));assert.ok(r.character.equipment.some(e=>e.id.startsWith('background:')),bg.id);assert.equal(economy(d).copper,Math.round(bg.data.startingGold*100));assert.ok(!bg.data.bonuses);}
 for(const name of ['Captif','Idiot du village','Voyageur'])assert.ok(!all.some(b=>b.name.fr===name));
});
test('Compagnie Creole backgrounds and specialty aliases resolve without duplicate entries',()=>{
 const pairs=[['Infanterie','phb14:background:soldier'],['Sauvageon','phb14:background:outlander'],['Acolyte','srd51:background:acolyte'],['Arnaqueur','phb14:background:criminal'],['Hanté','cos:background:haunted-one'],['Grand voyageur','scag:background:far-traveler']];
 for(const [name,id]of pairs){const entry=ctx.index.get(id);assert.ok([entry.name.fr,...entry.data.aliases??[]].includes(name));build(draft(id));}
 assert.equal(ctx.index.list('background').filter(b=>b.data.variantOf).length,5);
});
test('Haunted One receives two distinct languages, including one exotic, and 1 sp',()=>{
 const {d,r}=build(draft('cos:background:haunted-one'));const langs=r.origin.ledger.filter(l=>l.origin===d.backgroundId&&l.kind==='language').map(l=>l.value);
 assert.equal(langs.length,2);assert.equal(new Set(langs).size,2);assert.ok(langs.some(l=>['abyssal','celestial','draconic','deep-speech','infernal','primordial','sylvan','undercommon'].includes(l)));assert.equal(economy(d).copper,10);
});
test('all thirteen house branches compile, including rogue duplicate-tool replacement',()=>{
 const id='eberron:background:house-agent',entry=ctx.index.get(id);
 for(const house of entry.data.choices[0].options){const {r}=build(draft(id,{classes:[{id:'rogue',level:1,subclassId:null}],originSelections:{[id+':house']:[house]}}));assert.equal(r.origin.choices.filter(q=>q.id===id+':house').length,1);if(house==='lyrandar')assert.ok(r.character.proficiencies.includes('air-vehicles'));}
});
test('Bigby grants work for a noncaster without spending an ASI',()=>{
 for(const [bg,feat]of [['giant-foundling','strike-of-the-giants'],['rune-carver','rune-shaper']]){const {r}=build(draft('bgg:background:'+bg));assert.ok(r.character.features.includes('bgg:feat:'+feat));if(bg==='rune-carver')assert.ok(r.character.spells.known.includes('srd51:comprehend-languages'));}
});
test('each planar infusion supplies its resistance and cantrip without an ability increase',()=>{
 const feat='planescape:feat:scion-of-the-outer-planes';
 for(const [plane,value]of Object.entries(planarInfusions)){const {r}=build(draft('planescape:background:gate-warden',{selections:{[feat+':plane']:[plane],[feat+':casting-ability']:['wis']}}));assert.ok(r.character.defenses.resistances.includes(value.resistance));assert.ok(r.character.spells.known.includes(value.spell));assert.equal(r.character.scores.wis,r.origin.scores.wis);}
});
test('source restrictions invalidate but never mutate a saved background; legacy IDs stay supported',()=>{
 const {d}=build(draft('cos:background:haunted-one')),saved=structuredClone(d),restricted={...cfg,sourceRestrictions:true,enabledSourceIds:['srd51','phb14']},off=campaignCatalog(playerCatalogs,[],restricted);
 assert.ok(!off.index.get(d.backgroundId));assert.equal(compileDraft(off,restricted,d).valid,false);assert.deepEqual(d,saved);assert.equal(off.index.list('background').length,18);build(d);
 for(const b of off.index.list('background'))build(draft(b.id,{startingEquipmentVersion:1}));
 assert.equal(backgroundKit({backgroundId:'private:background:custom'},()=>null,()=>null),null);
});
