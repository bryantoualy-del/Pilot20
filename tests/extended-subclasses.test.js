import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression} from '../src/creator/model.js';
import {derive} from '../src/character/derive.js';
const config=defaultCampaign(),context=campaignCatalog(playerCatalogs,[],config);
function make(id,level){const cls=context.index.get(id).data.classId;let d=newDraft();Object.assign(d,{name:'Recette '+id,raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:cls,level,subclassId:id}],classChosen:true});d=suggestChoices(context,config,d);d.confirmed=d.reviewed=true;const r=compileDraft(context,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));return {d,r};}
test('Hexblade, Glamour, Eloquence and Soulknife acquire their actual subclass grants at every tier',()=>{
 for(const id of ['xge:warlock:hexblade','xge:bard:glamour','tce:bard:eloquence','tce:rogue:soulknife'])for(const level of [3,6,10,14,20]){
  const {r}=make(id,level),expected=context.index.get(id).data.grants.filter(g=>g.level<=level).flatMap(g=>g.featureIds);
  for(const feature of expected)assert.ok(r.character.features.includes(feature));
  for(const feature of context.index.get(id).data.grants.filter(g=>g.level>level).flatMap(g=>g.featureIds))assert.ok(!r.character.features.includes(feature));
  assert.equal(r.choices.some(q=>q.kind==='prepared'),false);
 }
});
test('Hexblade expanded spells are available choices, not free known or prepared spells',()=>{
 const {d,r}=make('xge:warlock:hexblade',10),q=draftProgression(context,config,d).choices.find(q=>q.id==='warlock:known-spells');
 assert.ok(q.options.includes('srd51:shield'));assert.ok(q.options.includes('phb14:spell:banishing-smite'));
 const unchosen=context.index.get('xge:warlock:hexblade').data.extraSpells.flatMap(g=>g.spellIds).find(id=>!d.selections[q.id].includes(id));assert.ok(unchosen);assert.ok(!r.character.spells.known.includes(unchosen));assert.equal(r.grantedSpells.length,0);
 assert.ok(r.character.proficiencies.includes('medium-armor'));assert.ok(r.character.proficiencies.includes('martial-weapons'));
 assert.equal(derive(r.character).resources['warlock:hexblades-curse'].recovery,'short');
});
test('Soulknife psionic dice use character proficiency, while die size and powers retain rogue levels',()=>{
 const {d,r}=make('tce:rogue:soulknife',3);assert.equal(derive(r.character).resources['rogue:psionic-energy'].max,4);
 const multi=structuredClone(d);multi.classes.push({id:'fighter',level:6,subclassId:'srd51:champion'});multi.scores.str=14;multi.scores.dex=14;multi.scoreMethod='manual';multi.scoresAreBase=false;
 const enabled={...config,enabledOptions:['multiclass']},ctx=campaignCatalog(playerCatalogs,[],enabled);let next=suggestChoices(ctx,enabled,multi);next.reviewed=next.confirmed=true;const out=compileDraft(ctx,enabled,next);assert.equal(out.valid,true,JSON.stringify(out.issues));assert.equal(derive(out.character).resources['rogue:psionic-energy'].max,8);assert.ok(!out.character.features.includes('tce:rogue:soulknife:soul-blades'));
});
test('source removal hides a subclass and flags the saved choice without deleting it',()=>{
 const {d}=make('xge:bard:glamour',10),saved=structuredClone(d);const disabled={...config,sourceRestrictions:true,enabledSourceIds:['srd51','tce','phb14']},ctx=campaignCatalog(playerCatalogs,[],disabled);
 assert.ok(!ctx.index.class('bard').data.subclassIds.includes('xge:bard:glamour'));assert.equal(compileDraft(ctx,disabled,d).valid,false);assert.deepEqual(d,saved);
});
