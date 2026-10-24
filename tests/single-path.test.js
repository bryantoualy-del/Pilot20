import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSRD,classCatalog,spellCatalog,originCatalog} from '../src/catalog/srd51-catalog.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices} from '../src/creator/model.js';
import {singlePath,migrateSingleDraft,decisionReady} from '../src/creator/single-path.js';
import {validateDraft} from '../src/creator/repository.js';
const config=defaultCampaign(),context=campaignCatalog([classCatalog,spellCatalog,originCatalog],[],config);
test('new draft enters the single route; legacy navigation migrates without losing decisions',()=>{
 assert.equal(newDraft().mode,'single');
 for(const mode of ['quick','guided','expert']){
  const d=newDraft();d.mode=mode;d.step='features';d.selections={'fighter:skills':['athletics','perception']};d.retainedDecisions=[{kind:'class',choiceId:'old',values:['original']}];
  const before=structuredClone(d),m=migrateSingleDraft(d);assert.equal(m.mode,'single');assert.deepEqual(m.selections,d.selections);assert.deepEqual(m.retainedDecisions,d.retainedDecisions);assert.deepEqual(m.legacyCreation,{mode,step:'features'});assert.deepEqual(d,before);validateDraft(m);
 }
});
test('fighter1 gets no premature subclass, spell or automatic-feature form',()=>{
 const d=newDraft(),p=singlePath(context,config,d);
 assert.ok(!p.decisions.some(x=>x.choice?.kind==='subclass'));
 assert.ok(!p.decisions.some(x=>['spell','prepared','spellbook'].includes(x.choice?.kind)));
 assert.ok(!p.decisions.some(x=>x.choice?.id==='srd51:fighter:second-wind'));
 assert.equal(decisionReady(p.decisions.find(x=>x.id==='class'),p.report,d),false);
});
test('subrace and caster decisions adapt to the actual character and keep stable IDs across backtracking',()=>{
 const d=newDraft();d.name='Wizard';d.raceId='srd51:race:elf';d.subraceId='srd51:race:high-elf';d.backgroundId='srd51:background:acolyte';d.classes=[{id:'wizard',level:10,subclassId:'srd51:school-of-evocation'}];
 const p=singlePath(context,config,d),ids=p.decisions.map(x=>x.id);
 assert.ok(ids.includes('subrace'));assert.ok(ids.includes('choice:wizard:spellbook'));assert.ok(ids.includes('choice:wizard:prepared'));
 d.step='choice:wizard:spellbook';assert.equal(singlePath(context,config,d).current.id,d.step);
 d.step='race';assert.deepEqual(singlePath(context,config,d).decisions.map(x=>x.id),ids);
 const before=structuredClone(d);singlePath(context,config,d);assert.deepEqual(d,before);
});
test('an invalid or duplicate selection never marks a decision complete',()=>{
 const d=newDraft(),p=singlePath(context,config,d),training=p.decisions.find(x=>x.kind==='training'),q={kind:'class-choice',choice:training.classChoices.find(x=>x.kind==='skill')};
 d.selections[q.choice.id]=[q.choice.options[0],q.choice.options[0]];
 assert.equal(decisionReady(q,singlePath(context,config,d).report,d),false);
});
test('level reduction retains old selections for review instead of silently deleting them',()=>{
 let d=newDraft();d.classes=[{id:'bard',level:10,subclassId:'srd51:college-of-lore'}];d=suggestChoices(context,config,d);
 const before=structuredClone(d.selections);d.classes[0].level=1;const p=singlePath(context,config,d);
 assert.deepEqual(d.selections,before);assert.ok(p.report.issues.some(i=>i.code==='obsolete-choice'||i.code==='inactive-subclass'));
 assert.equal(decisionReady(p.decisions.find(x=>x.id==='summary'),p.report,d),false);
});

test('target-level invocation selection follows the pact choice',async()=>{
 const {playerCatalogs}=await import('../src/catalog/player-catalogs.js');
 const fullContext=campaignCatalog(playerCatalogs,[],config);
 for(const level of [3,10,12]){
 const d=newDraft();d.classes=[{id:'warlock',level,subclassId:'srd51:the-fiend'}];
 d.raceId='srd51:race:human';d.backgroundId='srd51:background:acolyte';
 const {decisions}=singlePath(fullContext,config,d);
 const pact=decisions.findIndex(x=>x.choice?.id==='warlock:pact-boon');
 const invocations=decisions.findIndex(x=>x.choice?.id==='warlock:invocations');
 assert.ok(pact>=0&&invocations>pact);
 }
});
