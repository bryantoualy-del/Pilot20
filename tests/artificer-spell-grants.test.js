import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression} from '../src/creator/model.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
test('all four Artificer specialties grant automatically prepared spells outside daily slots',()=>{
 const subs=ctx.index.class('artificer').data.subclassIds;
 assert.equal(subs.length,4);
 for(const sub of subs)for(const level of [3,5,9,13,17]){
  let d=Object.assign(newDraft(),{name:'Artificier des sorts',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:'artificer',level,subclassId:sub}],classChosen:true});
  d=suggestChoices(ctx,config,d);
  for(const q of draftProgression(ctx,config,d).choices.filter(q=>q.kind==='prepared'))
   d.selections[q.id]=(d.selections[q.id]??[]).filter(id=>q.options.includes(id)).slice(0,q.count);
  d.confirmed=d.reviewed=true;
  const r=compileDraft(ctx,config,d);
  assert.equal(r.valid,true,sub+' niveau '+level+' '+JSON.stringify(r.issues));
  for(const group of ctx.index.get(sub).data.extraSpells??[])if(group.classLevel<=level)for(const id of group.spellIds){
   assert.ok(r.character.spells.prepared.includes(id),sub+' missing prepared '+id);
   assert.ok(r.spellbook.grants.some(g=>g.spellId===id&&g.originId===sub&&g.preparation==='always'),sub+' missing always '+id);
   assert.ok(!r.choices.some(q=>q.kind==='prepared'&&q.options.includes(id)),sub+' included in daily quota '+id);
  }
 }
});