import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression} from '../src/creator/model.js';
import {spellMatches,spellReference} from '../src/catalog/spell-reference.js';
const config=defaultCampaign(), ctx=campaignCatalog(playerCatalogs,[],config);
const ice='fizban:spell:rimes-binding-ice', dragon='fizban:spell:summon-draconic-spirit';

test('Fizban is available by default, searchable in both languages, and respects explicit MJ restrictions',()=>{
 const spells=ctx.index.list('spell').filter(s=>s.data.rulesSourceId==='fizban');
 assert.equal(spells.length,7);
 for(const s of spells){
  assert.match(s.source.document,/Fizban/);
  assert.match(s.source.url,/aidedd.org\/dnd\/sorts.php/);
  assert.equal(s.data.automation.status,'manual');
  assert.equal(s.data.ritual,false);
  assert.equal(s.data.level,spellReference(s.id).level);
 }
 assert.ok(spellMatches(ice,'Entrave de givre'));
 assert.ok(spellMatches(ice,"Rime's Binding Ice"));
 assert.ok(spellMatches(dragon,"Convocation d'esprit draconique"));
 assert.equal(ctx.index.get(ice).data.concentration,false);
 assert.equal(ctx.index.get(dragon).data.concentration,true);
 assert.match(ctx.index.get(dragon).data.components,/500 po/);
 const restricted={...config,sourceRestrictions:true};
 assert.equal(campaignCatalog(playerCatalogs,[],restricted).index.get(ice),undefined);
 assert.ok(campaignCatalog(playerCatalogs,[],{...restricted,enabledSourceIds:[...restricted.enabledSourceIds,'fizban']}).index.get(dragon));
});

test('level 10 draconic sorcerer can select, compile and round-trip both Samoth spells; levels 6 and 7 stay unavailable',()=>{
 let d=Object.assign(newDraft(),{name:'Samoth regression',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classChosen:true,classes:[{id:'sorcerer',level:10,subclassId:'srd51:draconic-bloodline'}],scores:{str:14,dex:14,con:14,int:14,wis:14,cha:16}});
 d=suggestChoices(ctx,config,d);
 const choice=draftProgression(ctx,config,d).choices.find(q=>q.id==='sorcerer:known-spells');
 assert.ok(choice.options.includes(ice)); assert.ok(choice.options.includes(dragon));
 assert.ok(!choice.options.includes('fizban:spell:fizbans-platinum-shield'));
 assert.ok(!choice.options.includes('fizban:spell:draconic-transformation'));
 d.selections[choice.id]=[ice,dragon,...d.selections[choice.id].filter(id=>![ice,dragon].includes(id))].slice(0,choice.count);
 d.reviewed=d.confirmed=true;
 d=JSON.parse(JSON.stringify(d));
 const result=compileDraft(ctx,config,d);
 assert.equal(result.valid,true,JSON.stringify(result.issues));
 for(const id of [ice,dragon]){
  assert.ok(result.character.spells.known.includes(id));
  assert.ok(result.spellbook.grants.some(g=>g.spellId===id&&g.classId==='sorcerer'&&g.castingAbility==='cha'));
 }
});
