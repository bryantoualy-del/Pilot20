import test from 'node:test';
import assert from 'node:assert/strict';
import {characterFixture,referenceClasses} from '../examples/characters.mjs';
import {validateBuild} from '../src/character/definition.js';
import {derive} from '../src/character/derive.js';
import {createCombat,executeCombat,validateCombat} from '../src/character/session.js';
import {coverage,validateDecision,validateTransformation,validateTrigger,validateCatalogPack,importCatalogPack} from '../src/rules/contracts.js';
import {SRD} from '../src/catalog/srd51.js';
import {coverageReport} from '../scripts/coverage-report.mjs';
for(const name of referenceClasses) test('universal 2014 contracts, progression, persistence and coverage: '+name,()=>{
  for(const level of [1,5,11,20]) {
    const d=characterFixture(name,{level}),before=structuredClone(d);assert.equal(validateBuild(d).valid,true);
    const derived=derive(d);assert.equal(derived.level,level);assert.equal(derived.proficiency,2+Math.floor((level-1)/4));assert.ok(derived.maxHp>0);
    const s=createCombat('class-test',[{instanceId:'actor',character:d}]);assert.deepEqual(validateCombat(JSON.parse(JSON.stringify(s))),s);
    assert.deepEqual(d,before);
    for(const a of d.abilities) if(derived.coverage[a.id].status==='represented') {
      assert.ok(derived.coverage[a.id].reasons.length);
      assert.throws(()=>executeCombat(s,{id:'blocked',type:'useAbility',actorId:'actor',abilityId:a.id}));
    }
    for(const [id,r] of Object.entries(derived.resources)) assert.equal(s.engine.actors.actor.resources[id],r.max);
  }
});
test('coverage rejects stripping unavailable primitives and distinguishes reference/manual/partial',()=>{
 const base={version:1,mode:'automatic',primitives:['damage','transformation'],requirements:[]};
 assert.deepEqual(coverage(base),{status:'partial',executable:false,missing:['transformation']});
 assert.equal(coverage({...base,mode:'manual'}).status,'manual');assert.equal(coverage({...base,mode:'referenced'}).status,'referenced');
 assert.equal(coverage({...base,requirements:['form eligibility unresolved']}).status,'unsupported');
 assert.throws(()=>coverage({...base,primitives:['executeJavaScript']}));
 const r=coverageReport();assert.equal(r.classesRepresented,12);assert.equal(r.classesValidatedByReport,12);assert.equal(r.classes.length,12);
});
test('generic decision and trigger contracts are structural only',()=>{
 const d={version:1,id:'d',eventId:'hit',actorId:'a',revision:3,status:'pending',options:[{id:'accept',label:'Spend a resource',costs:[{resourceId:'pool',amount:1}]}],continuation:{eventId:'hit',phase:'after-hit'},policy:'block-dependent-resolution'};
 assert.deepEqual(validateDecision(d),d);assert.throws(()=>validateDecision({...d,continuation:{eventId:'other',phase:'after-hit'}}));
 assert.throws(()=>validateDecision({...d,policy:'auto-accept'}));assert.throws(()=>validateDecision({...d,options:[...d.options,...d.options]}));
 validateTrigger({version:1,event:'attack-hit',scope:'self',limit:'turn',whileEffect:null});
 assert.throws(()=>validateTrigger({version:1,event:'rogue-hit',scope:'self',limit:'round',whileEffect:null}));
});
test('transformation requires explicit complete policies and remains non-executable',()=>{
 const t={version:1,id:'shape',profileId:'beast',retained:['int','wis','cha','features'],hpPolicy:'separate-pool',overflow:'original-form',casting:'blocked',concentration:'retain-existing',reversion:['zero-hp','duration','voluntary','unconscious','death'],execution:'unsupported'};
 assert.deepEqual(validateTransformation(t),t);assert.throws(()=>validateTransformation({...t,execution:'automated'}));assert.throws(()=>validateTransformation({...t,overflow:'discard'}));
});
test('catalogue packs are versioned, inert, provenance gated and safely imported',()=>{
 const p={kind:'rules-catalog',schemaVersion:1,ruleset:'dnd5e-2014',id:'pack',version:1,items:[{id:'sample',type:'spell',version:1,source:SRD,references:['SRD 5.1'],rules:{version:1,mode:'referenced',primitives:['damage'],requirements:[]},mechanics:{}}]};
 assert.deepEqual(importCatalogPack(JSON.stringify(p),{distribution:'public'}),p);
 const b=structuredClone(p);b.items[0].source={...SRD,kind:'private'};assert.throws(()=>validateCatalogPack(b,{distribution:'public'}));
 assert.throws(()=>validateCatalogPack({...p,ruleset:'dnd5e-2024'}));assert.throws(()=>validateCatalogPack({...p,items:[...p.items,...p.items]}));
 assert.throws(()=>importCatalogPack(JSON.stringify(p).replace('"mechanics":{}','"mechanics":{"__proto__":{}}')));
 const f=structuredClone(p);f.items[0].mechanics.callback=()=>0;assert.throws(()=>validateCatalogPack(f));
});
