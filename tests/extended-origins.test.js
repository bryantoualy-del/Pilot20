import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression} from '../src/creator/model.js';
import {derive} from '../src/character/derive.js';
import {validateCatalogV3} from '../src/catalog/catalog-v3.js';
import {canonicalProficiency} from '../src/catalog/proficiencies.js';
const config={...defaultCampaign(),sourceRestrictions:true,enabledSourceIds:['srd51','xge','tce','phb14','ravenloft','volo','motm']},ctx=campaignCatalog(playerCatalogs,[],config);
function draft(overrides={}){return Object.assign(newDraft(),{name:'Origines — recette synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:'fighter',level:1,subclassId:null}],classChosen:true},overrides);}
function build(input){let d=suggestChoices(ctx,config,input);d.confirmed=d.reviewed=true;const r=compileDraft(ctx,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));return {d,r,stats:derive(r.character)};}
test('all 18 backgrounds compile with fighter, high-level rogue and Artificer without duplicate training',()=>{
 assert.equal(ctx.index.list('background').length,18);
 for(const bg of ctx.index.list('background'))for(const cls of [{id:'fighter',level:1,subclassId:null},{id:'rogue',level:11,subclassId:'tce:rogue:soulknife'},{id:'artificer',level:3,subclassId:'tce:artificer:alchemist'}]){
  const {r}=build(draft({backgroundId:bg.id,classes:[cls]}));
  const tools=r.character.proficiencies.map(canonicalProficiency);assert.equal(new Set(tools).size,tools.length,bg.id);
  assert.ok(r.character.equipment.some(e=>e.id.startsWith('background:')),bg.id);
 }
});
test('dhampir native bonuses, humanoid size, climbing and empowerment acquire at actual levels',()=>{
 const raceId='ravenloft:race:dhampir';
 for(const level of [1,3,9,20]){const {r,stats}=build(draft({raceId,classes:[{id:'monk',level,subclassId:level<3?null:'srd51:way-of-the-open-hand'}]}));
  assert.equal(r.character.ancestry.creatureType,'humanoid');assert.equal(r.character.ancestry.size,'small');
  assert.equal(stats.movement.climb,stats.movement.walk);assert.ok(stats.movement.walk>=35);
  assert.equal(r.character.features.includes(raceId+':spider-climb-hands-free'),level>=3);
  assert.equal(stats.resources[raceId+':bite-empowerment:uses'].max,stats.proficiency);
  assert.equal(stats.resources[raceId+':bite-empowerment:uses'].recovery,'long');
  assert.ok(!stats.resources[raceId+':vampiric-bite:uses']);
 }
 const d=draft({raceId});d.originSelections={[raceId+':ability-pattern']:['three-ones']};const out=build(d);
 assert.equal(out.r.origin.choices.find(q=>q.id===raceId+':ability-bonus-1').count,3);
 assert.equal(out.r.origin.choices.some(q=>q.id===raceId+':ability-bonus-2'),false);
});
test('kobold editions and each conditional legacy remain separate',()=>{
 const old=build(draft({raceId:'volo:race:kobold'}));assert.ok(old.r.character.features.includes('volo:race:kobold:pack-tactics'));assert.equal(old.r.character.features.some(id=>id.includes('draconic-cry')),false);
 for(const legacy of ['defiance','craftiness','draconic-sorcery']){const raceId='motm:race:kobold',input=draft({raceId});input.originSelections={[raceId+':legacy']:[legacy],[raceId+':draconic-ability']:['wis']};
  // Only save the ability choice when that branch actually exists.
  if(legacy!=='draconic-sorcery')delete input.originSelections[raceId+':draconic-ability'];
  const {r,stats}=build(input),choices=r.origin.choices;
  assert.equal(choices.some(q=>q.id===raceId+':draconic-cantrip'),legacy==='draconic-sorcery');
  assert.equal(choices.some(q=>q.id===raceId+':craftiness-skill'),legacy==='craftiness');
  assert.equal(r.character.features.includes(raceId+':defiance'),legacy==='defiance');
  assert.ok(!r.character.features.some(id=>id.includes('sunlight-sensitivity')||id.includes('pack-tactics')));
  assert.equal(stats.resources[raceId+':draconic-cry:uses'].max,2);
  if(legacy==='draconic-sorcery'){assert.equal(r.origin.spells.length,1);assert.equal(r.origin.spells[0].ability,'wis');}
 }
});
test('five PHB subraces apply bonuses, distinct traits and source provenance',()=>{
 for(const [race,sub]of [['dwarf','mountain-dwarf'],['elf','wood-elf'],['elf','drow'],['halfling','stout-halfling'],['gnome','forest-gnome']]){
  const {d,r,stats}=build(draft({raceId:'srd51:race:'+race,subraceId:'phb14:race:'+sub,classes:[{id:'fighter',level:5,subclassId:'srd51:champion'}]}));
  assert.equal(r.character.ancestry.source.kind,'reference');
  if(sub==='wood-elf')assert.equal(stats.movement.walk,35);
  if(sub==='drow'){assert.ok(!r.character.features.includes('srd51:race:elf:darkvision'));assert.ok(r.character.spells.known.includes('srd51:darkness'));}
  if(sub==='stout-halfling')assert.ok(r.character.defenses.resistances.includes('poison'));
  const disabled={...config,sourceRestrictions:true,enabledSourceIds:['srd51']},off=campaignCatalog(playerCatalogs,[],disabled),saved=structuredClone(d);assert.equal(compileDraft(off,disabled,d).valid,false);assert.deepEqual(d,saved);
 }
});
test('public catalogue validation rejects a private source nested in a subrace',()=>{
 const c=structuredClone(playerCatalogs.find(c=>c.items.some(i=>i.id==='srd51:race:elf'))),elf=c.items.find(i=>i.id==='srd51:race:elf');
 elf.data.subraces[0].source={kind:'private',document:'Private',license:'All rights reserved',url:'https://example.org/private'};
 assert.throws(()=>validateCatalogV3(c,{distribution:'public'}));
});
