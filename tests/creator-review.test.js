import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {defaultCampaign,campaignCatalog} from '../src/campaign/sources.js';
import {newDraft} from '../src/creator/model.js';
import {singlePath,decisionReady} from '../src/creator/single-path.js';
import {subclassSummary} from '../src/catalog/subclass-summaries.js';
import {readableText} from '../src/catalog/readable-text.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
test('point buy rejects raw 16 and 28 points but permits 27 or fewer before racial bonuses',()=>{
 const d=newDraft();d.scoreMethod='point-buy';d.raceId='srd51:race:human';
 for(const [scores,valid]of [[{str:15,dex:14,con:13,int:12,wis:10,cha:8},true],[{str:16,dex:8,con:8,int:8,wis:8,cha:8},false],[{str:15,dex:15,con:15,int:9,wis:8,cha:8},false],[{str:8,dex:8,con:8,int:8,wis:8,cha:8},true]]){d.scores=scores;const p=singlePath(ctx,config,d);assert.equal(decisionReady({kind:'scores'},p.report,d),valid);}
});
test('all built-in subclasses have separate French and English editorial introductions',()=>{
 for(const entry of ctx.index.list('subclass'))for(const lang of ['fr','en'])assert.ok(subclassSummary(entry,lang),entry.id);
 assert.match(subclassSummary(ctx.index.get('phb14:paladin:vengeance')),/poursuit/);
 assert.match(subclassSummary(ctx.index.get('xge:paladin:conquest')),/peur/);
});
test('training and equipment consolidate old steps without losing selections',()=>{
 const d=newDraft();d.startingEquipmentEnabled=true;d.classes=[{id:'bard',level:4,subclassId:null}];d.backgroundId='srd51:background:acolyte';
 const plan=singlePath(ctx,config,d),training=plan.decisions.find(x=>x.kind==='training');assert.ok(training.classChoices.length);assert.ok(training.originChoices.length);assert.equal(plan.decisions.filter(x=>x.kind.startsWith('equipment')).length,1);
 d.step='choice:'+training.classChoices[0].id;assert.equal(singlePath(ctx,config,d).current.id,'training');d.step='equipment-method';assert.equal(singlePath(ctx,config,d).current.id,'equipment');
});
test('numeric spacing keeps dice and decimals intact',()=>{
 assert.equal(readableText('Votre CA augmente de1 ; à9 m,1 minute. Ajoutez2d6 et1,50 m.'),'Votre CA augmente de 1 ; à 9 m, 1 minute. Ajoutez 2d6 et 1,50 m.');
});
test('conditional background training stays in the same proficiency screen',()=>{
 const d=newDraft();d.raceId='srd51:race:human';d.backgroundId='phb14:background:guild-merchant';
 let p=singlePath(ctx,config,d);assert.ok(p.decisions.find(x=>x.kind==='training').originChoices.some(q=>q.key==='trade-training'));
 d.originSelections['phb14:background:guild-merchant:trade-training']=['artisan'];p=singlePath(ctx,config,d);
 const training=p.decisions.find(x=>x.kind==='training');assert.ok(training.originChoices.some(q=>q.ownerId===d.backgroundId&&q.kind==='proficiency'));
 assert.ok(!p.decisions.some(x=>x.kind==='origin-choice'&&x.choice.ownerId===d.backgroundId));
});
