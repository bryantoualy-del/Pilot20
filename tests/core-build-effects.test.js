import test from 'node:test';import assert from 'node:assert/strict';
import{playerCatalogs}from '../src/catalog/player-catalogs.js';import{campaignCatalog,defaultCampaign}from '../src/campaign/sources.js';import{newDraft,suggestChoices,compileDraft,draftProgression}from '../src/creator/model.js';import{hitPointTotal,modifier}from '../src/character/derive.js';import{SKILLS}from '../src/character/contracts.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
function input(cls,level){const def=ctx.index.class(cls).data;return Object.assign(newDraft(),{name:'Statistiques — recette synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:cls,level,subclassId:level>=def.subclassLevel?def.subclassIds[0]:null}],classChosen:true});}
function build(d,c=config,x=ctx){d=suggestChoices(x,c,d);d.reviewed=d.confirmed=true;const r=compileDraft(x,c,d);assert.equal(r.valid,true,JSON.stringify(r.issues));return{d,r};}
test('Primal Champion applies after ordinary ASIs, raises the cap to24 and recalculates every Hit Die',()=>{
 const d=input('barbarian',20);Object.assign(d,{scoreMethod:'manual',scoresAreBase:false,scores:{str:20,dex:14,con:20,int:10,wis:12,cha:8}});
 const out=build(d);assert.equal(out.r.character.scores.str,24);assert.equal(out.r.character.scores.con,24);assert.equal(out.r.stats.maxHp,285);assert.equal(draftProgression(ctx,config,out.d).hpPreview,285);assert.equal(out.r.scoresBeforeFeatureIncreases.str,20);
 const repeated=compileDraft(ctx,config,out.d);assert.equal(repeated.character.scores.str,24);
 out.d.classes[0].level=19;const lower=compileDraft(ctx,config,out.d);assert.equal(lower.valid,true);assert.equal(lower.character.scores.str,20);assert.equal(lower.character.scores.con,20);
});
test('Draconic Resilience supplies13+Dex unarmored AC and one HP per sorcerer level',()=>{
 const {d,r}=build(input('sorcerer',10));assert.equal(r.stats.ac,13+modifier(r.character.scores.dex));assert.equal(r.stats.maxHp,hitPointTotal(r.character.progression,r.character.scores)+10);assert.equal(draftProgression(ctx,config,d).hpPreview,r.stats.maxHp);
 d.equipment='leather';const worn=compileDraft(ctx,config,d);assert.equal(worn.stats.ac,11+modifier(worn.character.scores.dex));
 const c={...config,enabledOptions:['multiclass']},x=campaignCatalog(playerCatalogs,[],c),multi=input('sorcerer',3);multi.classes.push({id:'fighter',level:2,subclassId:null});Object.assign(multi,{scores:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,14])),scoreMethod:'manual',scoresAreBase:false});const m=build(multi,c,x).r;assert.equal(m.stats.maxHp,hitPointTotal(m.character.progression,m.character.scores)+3);
});
test('Jack of All Trades and Remarkable Athlete apply their respective rounding and never stack',()=>{
 for(const [cls,level,physical]of [['bard',5,false],['fighter',7,true]]){
  const {r}=build(input(cls,level)),pb=r.stats.proficiency;
  for(const [skill,ability]of Object.entries(SKILLS)){const rank=r.character.skills[skill]??0,extra=rank?0:physical?['str','dex','con'].includes(ability)?Math.ceil(pb/2):0:Math.floor(pb/2);assert.equal(r.stats.skills[skill],modifier(r.character.scores[ability])+pb*rank+extra);}
  assert.equal(r.stats.initiative,modifier(r.character.scores.dex)+(physical?Math.ceil(pb/2):Math.floor(pb/2)));
 }
 const c={...config,enabledOptions:['multiclass']},x=campaignCatalog(playerCatalogs,[],c),d=input('fighter',11);d.classes.push({id:'bard',level:2,subclassId:null});Object.assign(d,{scores:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,14])),scoreMethod:'manual',scoresAreBase:false});const {r}=build(d,c,x);assert.equal(r.stats.proficiency,5);assert.equal(r.stats.initiative,modifier(r.character.scores.dex)+3);assert.equal(r.stats.checks.wis,modifier(r.character.scores.wis)+2);assert.equal(r.stats.checks.str,modifier(r.character.scores.str)+3);
});
test('Defense requires worn armor and Archery changes ranged weapon attacks only',()=>{
 const d=input('fighter',1);d.selections['fighter:fighting-style']=['srd51:fighter:defense'];d.equipment='chain';d.shield=true;const out=build(d);assert.equal(out.r.stats.ac,19);out.d.equipment='none';const unarmored=compileDraft(ctx,config,out.d);assert.equal(unarmored.stats.ac,12+modifier(unarmored.character.scores.dex));
 const archer=input('fighter',1);archer.selections['fighter:fighting-style']=['srd51:fighter:archery'];archer.weapons=['longbow','javelin','dagger'];const {r}=build(archer);const bow=r.character.equipment.find(e=>e.id.endsWith(':longbow'));assert.equal(r.stats.weapons[bow.id].attack,modifier(r.character.scores.dex)+r.stats.proficiency+2);assert.equal(r.stats.weapons[bow.id].damageBonus,modifier(r.character.scores.dex));
 const javelin=r.character.equipment.find(e=>e.id.endsWith(':javelin'));assert.equal(r.stats.weapons[javelin.id].attack,modifier(r.character.scores.str)+r.stats.proficiency);
});
test('a fighting style already selected through another class is unavailable and its old decision is preserved',()=>{
 const c={...config,enabledOptions:['multiclass']},x=campaignCatalog(playerCatalogs,[],c),d=input('fighter',3);d.classes.push({id:'ranger',level:2,subclassId:null});Object.assign(d,{scores:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,14])),scoreMethod:'manual',scoresAreBase:false});d.selections['fighter:fighting-style']=['srd51:fighter:archery'];let out=build(d,c,x);assert.ok(!out.r.choices.find(q=>q.id==='ranger:fighting-style').options.includes('srd51:ranger:archery'));
 out.d.selections['ranger:fighting-style']=['srd51:ranger:archery'];assert.equal(compileDraft(x,c,out.d).valid,false);assert.deepEqual(out.d.selections['ranger:fighting-style'],['srd51:ranger:archery']);
});
test('multiclassing cannot grant Unarmored Defense a second time',()=>{
 const c={...config,enabledOptions:['multiclass']},x=campaignCatalog(playerCatalogs,[],c);
 for(const first of ['barbarian','monk']){const d=input(first,1);d.classes.push({id:first==='barbarian'?'monk':'barbarian',level:1,subclassId:null});Object.assign(d,{scores:{str:14,dex:14,con:12,int:10,wis:18,cha:10},scoreMethod:'manual',scoresAreBase:false});const{r}=build(d,c,x);assert.equal(r.character.features.filter(id=>id.endsWith(':unarmored-defense')).length,1);assert.ok(r.character.features.includes('srd51:'+first+':unarmored-defense'));assert.equal(r.stats.ac,first==='barbarian'?13:16);}
});
test('a Bard Counterspell check includes Jack of All Trades without changing its spellcasting ability',()=>{
 const d=input('bard',10);d.classes[0].subclassId='xge:bard:glamour';d.selections['bard:magical-secrets-10']=['srd51:counterspell','srd51:fireball'];const{r}=build(d);
 const reaction=r.character.reactiveRules.find(rule=>rule.id==='counterspell');assert.ok(reaction);const effect=reaction.options.flatMap(o=>o.effects).find(e=>e.kind==='counter');assert.equal(effect.bonus,modifier(r.character.scores.cha)+Math.floor(r.stats.proficiency/2));
});
