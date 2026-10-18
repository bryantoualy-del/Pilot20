import test from 'node:test';import assert from 'node:assert/strict';
import{playerCatalogs}from '../src/catalog/player-catalogs.js';import{campaignCatalog,defaultCampaign}from '../src/campaign/sources.js';import{newDraft,suggestChoices,compileDraft,draftProgression}from '../src/creator/model.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
function base(level=5,pact='blade'){let d=Object.assign(newDraft(),{name:'Occultiste synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:'warlock',level,subclassId:'xge:warlock:hexblade'}],classChosen:true});d.selections['warlock:pact-boon']=[pact==='talisman'?'tce:warlock:pact-of-the-talisman':'srd51:warlock:pact-of-the-'+pact];return suggestChoices(ctx,config,d);}
const opts=d=>draftProgression(ctx,config,d).choices.find(q=>q.id==='warlock:invocations').options;
test('all 22 published XGE/TCE invocations are source-filtered, class-level gated and compile with their resources',()=>{
 const entries=ctx.index.list('feature').filter(f=>f.data.optionKind==='invocation'&&f.source.kind==='reference');assert.equal(entries.length,22);
 for(const e of entries){let pact=e.data.selectionRequires?.find(id=>id.includes('pact-of-the-'))?.split('-').at(-1)??'blade',d=base(Math.max(3,e.data.minimumClassLevel),pact);if(e.data.selectionRequires?.includes('srd51:eldritch-blast'))d.selections['warlock:cantrips'][0]='srd51:eldritch-blast';assert.ok(opts(d).includes(e.id),e.id);d.selections['warlock:invocations']=[e.id,...d.selections['warlock:invocations'].filter(v=>v!==e.id)].slice(0,ctx.index.class('warlock').data.invocationsKnown[d.classes[0].level-1]);d.reviewed=d.confirmed=true;const r=compileDraft(ctx,config,d);assert.equal(r.valid,true,e.id+JSON.stringify(r.issues));assert.ok(r.character.features.includes(e.id));assert.ok(r.character.abilities.some(a=>a.id===e.id));}
 const off=campaignCatalog(playerCatalogs,[],{...config,sourceRestrictions:true,enabledSourceIds:['srd51']});assert.equal(off.index.list('feature').some(f=>f.id==='tce:warlock:eldritch-mind'),false);
});
test('Eldritch Smite uses a pact slot, not a general slot; class level and pact are mandatory',()=>{
 let d=base(),r;d.selections['warlock:invocations'][0]='xge:warlock:eldritch-smite';d.reviewed=d.confirmed=true;r=compileDraft(ctx,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));assert.deepEqual(r.character.abilities.find(a=>a.id==='xge:warlock:eldritch-smite').resource,{id:'pact:warlock',amount:1});
 assert.equal(opts(base(4)).includes('xge:warlock:eldritch-smite'),false);assert.equal(opts(base(5,'tome')).includes('xge:warlock:eldritch-smite'),false);const multi=base(4);multi.classes.unshift({id:'fighter',level:8,subclassId:'srd51:champion'});assert.equal(opts(multi).includes('xge:warlock:eldritch-smite'),false);
});
test('blast and curse prerequisites are conditional; Talisman scales with total proficiency',()=>{
 const d=base(7,'talisman');d.selections['warlock:cantrips']=d.selections['warlock:cantrips'].filter(id=>id!=='srd51:eldritch-blast');assert.ok(!opts(d).includes('xge:warlock:grasp-of-hadar'));assert.ok(opts(d).includes('xge:warlock:maddening-hex'));
 d.classes[0].subclassId='srd51:the-fiend';d.selections['warlock:known-spells']=d.selections['warlock:known-spells'].filter(id=>id!=='phb14:spell:hex');assert.ok(!opts(d).includes('xge:warlock:maddening-hex'));
 const r=draftProgression(ctx,config,base(7,'talisman'));assert.equal(r.resources.find(r=>r.id==='warlock:talisman').max,3);
});
