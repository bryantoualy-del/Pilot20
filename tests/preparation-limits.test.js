import test from 'node:test';import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';import {defaultCampaign,campaignCatalog} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression} from '../src/creator/model.js';import{stagePreparation}from '../src/spellbook/service.js';
import{validateBuild}from '../src/character/definition.js';import{singlePath,decisionReady}from '../src/creator/single-path.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
function draft(cls,level=5){const base=ctx.index.class(cls).data;let d=Object.assign(newDraft(),{name:'Préparation — recette synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:cls,level,subclassId:level>=base.subclassLevel?base.subclassIds[0]:null}],classChosen:true});d=suggestChoices(ctx,config,d);for(const q of draftProgression(ctx,config,d).choices.filter(q=>q.kind==='prepared'))d.selections[q.id]=q.options.slice(0,q.count);d.reviewed=d.confirmed=true;return d;}
test('each prepared caster may select zero, fewer than maximum or the full daily quota',()=>{
 for(const cls of ['cleric','druid','wizard','paladin','artificer']){
  const input=draft(cls),q=draftProgression(ctx,config,input).choices.find(q=>q.kind==='prepared');assert.equal(q.minimumCount,0);
  for(const count of [0,1,q.count]){
   const d=stagePreparation(ctx,config,input,{classId:cls,spellIds:q.options.slice(0,count)}),r=compileDraft(ctx,config,d);assert.equal(r.valid,true,JSON.stringify({cls,count,issues:r.issues}));assert.equal(validateBuild(r.character).valid,true);
   const granted=new Set(r.grantedSpells.filter(g=>g.mode==='prepared').map(g=>g.id));assert.equal(r.character.spells.prepared.filter(id=>!granted.has(id)&&ctx.index.get(id)?.data.level>0).length,count);
   for(const id of granted)assert.ok(r.character.spells.prepared.includes(id));
   assert.equal(decisionReady(singlePath(ctx,config,d).decisions.find(q=>q.id==='choice:'+cls+':prepared'),draftProgression(ctx,config,d),d),true);
   if(cls==='wizard')assert.deepEqual(r.character.spells.known,compileDraft(ctx,config,input).character.spells.known);
  }
  assert.throws(()=>stagePreparation(ctx,config,input,{classId:cls,spellIds:q.options.slice(0,q.count+1)}));
  assert.throws(()=>stagePreparation(ctx,config,input,{classId:cls,spellIds:[q.options[0],q.options[0]]}));
 }
});
test('known-spell casters keep exact learning quotas and receive no daily preparation choice',()=>{
 for(const cls of ['bard','sorcerer','warlock','ranger']){const d=draft(cls),q=draftProgression(ctx,config,d).choices.find(q=>q.id===cls+':known-spells');assert.ok(q);d.selections[q.id]=[];assert.equal(compileDraft(ctx,config,d).valid,false);assert.throws(()=>stagePreparation(ctx,config,d,{classId:cls,spellIds:[]}));}
});
test('full preparations retain their prior exact-count character contract while partial sets carry their lower bound',()=>{
 const d=draft('cleric'),q=draftProgression(ctx,config,d).choices.find(q=>q.kind==='prepared'),full=compileDraft(ctx,config,d);assert.equal(full.character.choiceRules.find(r=>r.id===q.id).minimumCount,undefined);
 const reduced=compileDraft(ctx,config,stagePreparation(ctx,config,d,{classId:'cleric',spellIds:[]}));assert.equal(reduced.character.choiceRules.find(r=>r.id===q.id).minimumCount,0);
 const edited=structuredClone(reduced.character);edited.choices.find(c=>c.id===q.id).optionIds=q.options.slice(0,q.count+1);assert.equal(validateBuild(edited).valid,false);
});
