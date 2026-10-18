import {selectRace} from '../src/creator/race-selection.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {playerCatalogs}from '../src/catalog/player-catalogs.js';import {defaultCampaign,campaignCatalog}from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression,changePrimaryClass}from '../src/creator/model.js';import {hitPointPlan,rollHitDie}from '../src/creator/hit-points.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
function draft(cls='fighter',level=3){const def=ctx.index.class(cls).data;let d=Object.assign(newDraft(),{name:'PV — recette synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:cls,level,subclassId:level>=def.subclassLevel?def.subclassIds[0]:null}],classChosen:true,hpMode:'rolled',hpRolls:{}});d=suggestChoices(ctx,config,d);d.reviewed=d.confirmed=true;return d;}
test('each class maximizes the initial character Hit Die and validates later rolls against its own die',()=>{
 for(const cls of ctx.index.list('class')){
  const d=draft(cls.data.classId),die=cls.data.hitDie;assert.equal(compileDraft(ctx,config,d).valid,false);
  d.hpRolls={[cls.data.classId+':2']:1,[cls.data.classId+':3']:die};const r=compileDraft(ctx,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));assert.deepEqual(r.character.progression.map(p=>p.hp),[die,1,die]);assert.equal(draftProgression(ctx,config,d).hpPreview,r.stats.maxHp);
  d.hpRolls[cls.data.classId+':2']=die+1;assert.equal(compileDraft(ctx,config,d).valid,false);
 }
});
test('Constitution applies retroactively with at least one HP each level; racial gains remain separate',()=>{
 const d=draft('wizard');Object.assign(d,{scoreMethod:'manual',scoresAreBase:false});d.scores.con=1;d.hpRolls={'wizard:2':1,'wizard:3':1};let r=compileDraft(ctx,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));assert.equal(r.stats.maxHp,3);
 d.scores.con=18;r=compileDraft(ctx,config,d);assert.equal(r.stats.maxHp,20);assert.deepEqual(r.character.progression.map(p=>p.hp),[6,1,1]);
 selectRace(ctx,d,'srd51:race:dwarf');d.subraceId='srd51:race:hill-dwarf';const fixed=suggestChoices(ctx,config,d);fixed.reviewed=fixed.confirmed=true;const dwarf=compileDraft(ctx,config,fixed);assert.equal(dwarf.valid,true,JSON.stringify(dwarf.issues));assert.equal(dwarf.stats.maxHp,23);
});
test('increasing level requires its die result and preserves earlier results and inactive methods',()=>{
 const d=draft();d.hpRolls={'fighter:2':3,'fighter:3':7};const before=structuredClone(d.hpRolls);d.classes[0].level=4;assert.equal(hitPointPlan(ctx.index,d).valid,false);d.hpRolls['fighter:4']=2;assert.equal(hitPointPlan(ctx.index,d).valid,true);
 d.hpMode='average';assert.deepEqual(hitPointPlan(ctx.index,d).progression.map(p=>p.hp),[10,6,6,6]);d.hpMode='rolled';assert.deepEqual(Object.fromEntries(Object.entries(d.hpRolls).filter(([k])=>k!=='fighter:4')),before);
 changePrimaryClass(d,'wizard');assert.equal(hitPointPlan(ctx.index,d).valid,false);assert.deepEqual(d.hpRolls,{'fighter:2':3,'fighter:3':7,'fighter:4':2});
});
test('multiclass Hit Dice follow explicit advancement chronology rather than maximizing each first class level',()=>{
 const d=draft();d.classes=[{id:'fighter',level:2,subclassId:null},{id:'wizard',level:2,subclassId:null}];d.advancementHistory=[{classId:'fighter'},{classId:'wizard'},{classId:'fighter'},{classId:'wizard'}];d.hpRolls={'fighter:2':2,'wizard:1':1,'wizard:2':3};const p=hitPointPlan(ctx.index,d);assert.equal(p.valid,true);assert.deepEqual(p.progression,[{classId:'fighter',hp:10},{classId:'wizard',hp:1},{classId:'fighter',hp:2},{classId:'wizard',hp:3}]);
});
test('explicit die action samples bounded results and never rolls during compilation',()=>{
 for(const die of [6,8,10,12]){assert.equal(rollHitDie(die,()=>0),1);assert.equal(rollHitDie(die,()=>die-1),die);}
 let calls=0;assert.equal(rollHitDie(6,()=>calls++===0?4294967295:5),6);assert.equal(calls,2);assert.throws(()=>rollHitDie(20));
});
