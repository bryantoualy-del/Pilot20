import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSRD} from '../src/catalog/srd51-catalog.js';
import {spellReference,spellReferences,spellMatches} from '../src/catalog/spell-reference.js';
import {localizedName,spellTerms} from '../src/catalog/localization.js';
const index=loadSRD();
test('484 distinct references preserve every installed SRD spell ID and do not install unverified effects',()=>{
 const all=spellReferences();assert.equal(all.length,484);assert.equal(new Set(all.map(s=>s.id)).size,484);
 for(const entry of index.list('spell')){const r=spellReference(entry.id);assert.ok(r);assert.equal(r.level,entry.data.level);assert.ok(r.name.fr);assert.equal(r.semanticReviewComplete,false);}
 assert.equal(all.filter(s=>index.get(s.id)).length,319);
});
test('French spell details and aliases are available without changing canonical English labels',()=>{
 const fire=index.get('srd51:fireball');assert.equal(localizedName(fire,'fr'),'Boule de feu');assert.equal(localizedName(fire,'en'),'Fireball');
 assert.equal(spellTerms(fire,'fr').castingTime,'1 action');
 assert.ok(spellMatches('srd51:acid-arrow','Melf'));assert.ok(spellMatches('srd51:acid-arrow','flèche'));assert.ok(spellMatches('srd51:acid-arrow','Acid Arrow'));
 const clone=spellReference('srd51:fireball');clone.name.fr='changed';assert.equal(spellReference('srd51:fireball').name.fr,'Boule de feu');
});

