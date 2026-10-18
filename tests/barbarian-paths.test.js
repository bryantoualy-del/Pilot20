import test from 'node:test';import assert from 'node:assert/strict';
import{playerCatalogs}from '../src/catalog/player-catalogs.js';import{campaignCatalog,defaultCampaign}from '../src/campaign/sources.js';import{newDraft,suggestChoices,compileDraft,draftProgression}from '../src/creator/model.js';import{derive}from '../src/character/derive.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
function input(sub,level){return Object.assign(newDraft(),{name:'Barbare — recette synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:'barbarian',level,subclassId:sub}],classChosen:true});}
function build(d,c=config,x=ctx){d=suggestChoices(x,c,d);d.reviewed=d.confirmed=true;const r=compileDraft(x,c,d);assert.equal(r.valid,true,JSON.stringify(r.issues));return{d,r,stats:derive(r.character)};}
test('five XGE/TCE paths acquire each grant at its actual class level',()=>{
 const paths=ctx.index.class('barbarian').data.subclassIds.filter(id=>!id.startsWith('srd51:'));assert.equal(paths.length,5);
 for(const sub of paths)for(const level of [3,6,10,14,20]){const{r}=build(input(sub,level));for(const row of ctx.index.get(sub).data.grants)for(const id of row.featureIds)assert.equal(r.character.features.includes(id),row.level<=level);assert.ok(r.choices.every(q=>q.kind!=='prepared'));}
});
test('Storm Herald persistent environment applies resistance only from level6 and sea swimming independently of rage',()=>{
 const sub='xge:barbarian:storm-herald';for(const [env,res]of [['desert','fire'],['sea','lightning'],['tundra','cold']])for(const level of [3,6,14]){const d=input(sub,level);d.selections['barbarian:storm-environment']=[sub+':'+env];const{r,stats}=build(d);assert.equal(r.character.defenses.resistances.includes(res),level>=6);assert.equal(stats.movement.swim,env==='sea'&&level>=6?30:undefined);assert.equal(r.choices.filter(q=>q.id==='barbarian:storm-environment').length,1);}
});
test('Ancestral Guardian spell grants retain Wisdom, short-rest shared pool, provenance and concentration',()=>{
 const sub='xge:barbarian:ancestral-guardian',before=build(input(sub,6)),after=build(input(sub,10));assert.equal(before.r.character.spells.known.length,0);assert.equal(after.r.spellbook.grants.length,2);
 for(const g of after.r.spellbook.grants){assert.equal(g.originId,sub+':consult-the-spirits');assert.equal(g.castingAbility,'wis');assert.equal(g.route,'origin');assert.equal(g.source.kind,'reference');assert.equal(g.acquiredAt.classLevel,10);assert.equal(g.classId,null);}
 const resource=after.r.character.resources.find(r=>r.id==='barbarian:consult-the-spirits');assert.equal(resource.max,1);assert.equal(resource.recovery,'short');assert.equal(resource.source.kind,'reference');
 const abilities=after.r.character.abilities.filter(a=>a.id.startsWith(sub+':consult-the-spirits:spell:'));assert.equal(abilities.length,2);assert.ok(abilities.every(a=>a.resource.id===resource.id));assert.ok(abilities.find(a=>a.id.endsWith('srd51:clairvoyance')).concentration);
});
test('Beast and Wild Magic resources scale with character proficiency, and transient forms are not creator questions',()=>{
 for(const sub of ['tce:barbarian:beast','tce:barbarian:wild-magic'])for(const level of [3,6,10,14,20]){const{r,stats}=build(input(sub,level));for(const id of sub.endsWith(':beast')?['infectious-fury','call-the-hunt']:['magic-awareness','bolstering-magic']){const res=stats.resources['barbarian:'+id];if(res)assert.equal(res.max,stats.proficiency);}assert.equal(r.choices.some(q=>/bestial|form-of-the-beast|wild-surge/.test(q.id)),false);}
 assert.equal(ctx.index.get('tce:barbarian:wild-magic:wild-surge').data.randomTable.length,8);
 const {r}=build(input('xge:barbarian:zealot',14));assert.equal(r.character.resources.find(r=>r.id==='barbarian:zealous-presence').max,1);assert.equal(ctx.index.get('xge:barbarian:zealot:fanatical-focus').data.usageLimits[0].refresh,'enter-rage');
});
test('Tasha barbarian optional features are independent, add actual distinct skills and respect levels',()=>{
 const sub='tce:barbarian:beast';assert.equal(build(input(sub,10)).r.character.features.includes('tce:barbarian:primal-knowledge'),false);
 for(const level of [1,3,7,10]){const c={...config,enabledOptions:['tce:barbarian:primal-knowledge','tce:barbarian:instinctive-pounce']},x=campaignCatalog(playerCatalogs,[],c),{r}=build(input(level<3?null:sub,level),c,x);
  assert.equal(r.character.features.includes('tce:barbarian:primal-knowledge'),level>=3);assert.equal(r.character.features.includes('tce:barbarian:instinctive-pounce'),level>=7);assert.equal(r.choices.filter(q=>q.id.startsWith('barbarian:primal-knowledge-')).length,level<3?0:level<10?1:2);assert.equal(Object.values(r.character.skills).filter(v=>v>=1).length,4+(level<3?0:level<10?1:2));
 }
});
