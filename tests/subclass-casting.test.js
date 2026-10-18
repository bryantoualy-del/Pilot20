import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression} from '../src/creator/model.js';
import {derive} from '../src/character/derive.js';
import {resolveSpellGrants,replacementOptions} from '../src/catalog/spell-grants.js';
const config=defaultCampaign(),context=campaignCatalog(playerCatalogs,[],config);
function draft(id,level){const cls=context.index.get(id).data.classId;let d=newDraft();Object.assign(d,{name:'Recette magie',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:cls,level,subclassId:id}]});d=suggestChoices(context,config,d);d.confirmed=d.reviewed=true;return d;}
test('2014 third-casters use wizard lists, memorized spells, school groups and their own slot progression',()=>{
 for(const id of ['phb14:fighter:eldritch-knight','phb14:rogue:arcane-trickster'])for(const level of [3,4,7,8,10,13,14,19,20]){
  const d=draft(id,level),r=compileDraft(context,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));const cls=d.classes[0].id,stats=derive(r.character);
  assert.equal(r.character.classes[0].casting.progression,'third');assert.equal(r.choices.some(q=>q.kind==='prepared'||q.kind==='spellbook'),false);assert.equal(stats.slotMetadata.casterLevel,Math.ceil(level/3));
  const school=r.choices.find(q=>q.id===cls+':known-spells'),free=r.choices.find(q=>q.id===cls+':known-free-spells');assert.equal(free.count,level<8?1:level<14?2:level<20?3:4);
  assert.ok(school.options.every(id=>context.index.get(d.classes[0].subclassId).data.restrictedSpellSchools.includes(context.index.get(id).data.school)));
  if(cls==='rogue'){assert.ok(r.character.spells.known.includes('srd51:mage-hand'));assert.ok(!d.selections['rogue:cantrips'].includes('srd51:mage-hand'));}
 }
});
test('Tasha sorcerer bonus spells are known outside the quota and never become daily preparation',()=>{
 for(const id of ['tce:sorcerer:aberrant-mind','tce:sorcerer:clockwork-soul'])for(const level of [1,6,10,20]){
  const d=draft(id,level),r=compileDraft(context,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));assert.equal(r.choices.some(q=>q.kind==='prepared'),false);
  const granted=r.spellbook.grants.filter(g=>g.acquisition==='granted');assert.equal(granted.length,(Math.min(5,Math.ceil(level/2))*2)+(id.endsWith('aberrant-mind')?1:0));assert.ok(granted.every(g=>g.preparation==='none'&&g.originId===id&&g.acquiredAt.classLevel!==null));
  assert.ok(!d.selections['sorcerer:known-spells'].some(id=>granted.some(g=>g.spellId===id)));
 }
});
test('origin-spell exchanges preserve the slot, obey schools and allow only one exchange per class level',()=>{
 const id='tce:sorcerer:clockwork-soul',sub=context.index.get(id),rows=sub.data.extraSpells.map(r=>({...r,ownerId:id}));
 const args={id:'sorcerer',level:5},first={originId:id,originalSpellId:'srd51:alarm',spellId:'srd51:shield',classLevel:2};
 assert.ok(replacementOptions(context.index,id,'srd51:alarm').some(s=>s.id==='srd51:shield'));
 const valid=resolveSpellGrants(context.index,args,rows.filter(r=>r.classLevel<=5),[first]);assert.deepEqual(valid.issues,[]);assert.ok(valid.rows.some(g=>g.id==='srd51:shield'&&g.originalSpellId==='srd51:alarm'&&g.classLevel===2));
 const repeated={...first,spellId:'srd51:mage-armor'};assert.ok(resolveSpellGrants(context.index,args,rows,[first,repeated]).issues.length);
 assert.ok(resolveSpellGrants(context.index,args,rows,[{...first,spellId:'srd51:magic-missile'}]).issues.length);
 assert.ok(resolveSpellGrants(context.index,args,rows,[{...first,classLevel:6}]).issues.length);
 assert.ok(resolveSpellGrants(context.index,args,rows,[{...first,spellId:'srd51:counterspell'}]).issues.length);
});
