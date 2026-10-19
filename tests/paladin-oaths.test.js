import test from 'node:test';import assert from 'node:assert/strict';import{playerCatalogs}from '../src/catalog/player-catalogs.js';import{campaignCatalog,defaultCampaign}from '../src/campaign/sources.js';import{newDraft,suggestChoices,compileDraft,draftProgression}from '../src/creator/model.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
function build(subclassId,level){let d=Object.assign(newDraft(),{name:'Serment synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:'paladin',level,subclassId}],classChosen:true});d=suggestChoices(ctx,config,d);for(const q of draftProgression(ctx,config,d).choices.filter(q=>q.kind==='prepared'))d.selections[q.id]=(d.selections[q.id]??[]).filter(id=>q.options.includes(id));d.reviewed=d.confirmed=true;const r=compileDraft(ctx,config,d);assert.equal(r.valid,true,subclassId+' '+level+JSON.stringify(r.issues));return r;}
test('all seven oaths acquire real features and always-prepared oath spells outside the daily quota',()=>{assert.equal(ctx.index.class('paladin').data.subclassIds.length,7);for(const sub of ctx.index.class('paladin').data.subclassIds)for(const level of [3,7,15,18,20]){const r=build(sub,level);for(const row of ctx.index.get(sub).data.extraSpells??[])if(row.classLevel<=level)for(const id of row.spellIds)assert.ok(r.spellbook.grants.some(g=>g.spellId===id&&g.preparation==='always'));for(const row of ctx.index.get(sub).data.grants)for(const id of row.featureIds)assert.equal(r.character.features.includes(id),row.level<=level);}});
test('oath Channel Divinity shares the class pool; Glory applies only its permanent own speed increase',()=>{const c=build('xge:paladin:conquest',3);assert.equal(c.character.abilities.find(a=>a.id==='xge:paladin:conquest:conquering-presence').resource.id,'paladin:channel');assert.equal(build('tce:paladin:glory',7).stats.speed,40);assert.equal(build('phb14:paladin:ancients',7).character.defenses.resistances.length,0);assert.equal(build('phb14:paladin:ancients',20).stats.resources['paladin:oath-avatar'].max,1);});

test('Conquest grants Armor of Agathys as always prepared at level 3, searchable even outside the paladin list',()=>{
 const id='phb14:spell:armor-of-agathys',entry=ctx.index.get(id),r=build('xge:paladin:conquest',3);
 assert.equal(entry?.name.fr,"Armure d'Agathys");
 assert.equal(entry.data.classIds.includes('paladin'),false);
 assert.ok(r.character.spells.known.includes(id));
 assert.ok(r.character.spells.prepared.includes(id));
 assert.ok(r.spellbook.grants.some(g=>g.spellId===id&&g.classId==='paladin'&&g.preparation==='always'&&g.originId==='xge:paladin:conquest'));
 assert.ok(!r.choices.some(c=>c.kind==='prepared'&&c.options.includes(id)),'oath spell must not consume daily quota');
});
