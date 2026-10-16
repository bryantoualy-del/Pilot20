import {characterFixture,referenceClasses} from '../examples/characters.mjs';
import {advancedCharacter} from '../examples/advanced-characters.mjs';
import {derive} from '../src/character/derive.js';
import {validateBuild} from '../src/character/definition.js';
import {createCombat,executeCombat} from '../src/character/session.js';
import {validateCombat} from '../src/character/session.js';
import {PRIMITIVES} from '../src/rules/contracts.js';
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export function coverageReport() {
  const classes=referenceClasses.map(name=>{
    const d=characterFixture(name),derived=derive(d),s=createCombat('coverage-'+name,[{instanceId:'actor',character:d}]);
    assert.equal(validateBuild(d).valid,true);validateCombat(JSON.parse(JSON.stringify(s)));
    const abilities=d.abilities.map(a=>{
      const c=derived.coverage[a.id];
      if(c.status==='represented') assert.throws(()=>executeCombat(s,{id:'blocked-'+a.id,type:'useAbility',actorId:'actor',abilityId:a.id}));
      return {id:a.id,status:c.coverageStatus??(c.status==='represented'?'unsupported':'automated'),primitiveExecutable:c.status==='executable',automatedExecutable:c.status==='executable',missing:c.reasons};
    });
    return {name,validated:true,abilities};
  });
  const advancedCases=['fighter','sorcerer','warlock'].map(name=>{
    const d=advancedCharacter(name,{level:11}),out=derive(d);
    return {name,level:11,abilities:d.abilities.filter(a=>a.combat).map(a=>({id:a.id,status:out.coverage[a.id].coverageStatus,automaticResolutionEnabled:out.coverage[a.id].status==='executable',manualDeclarationEnabled:out.coverage[a.id].coverageStatus==='manual',...(a.kind==='spell'?{wholeOfficialSpellStatus:'partial',scope:'Selected declared targets only; components, spatial eligibility and environmental consequences require adjudication'}:{})}))};
  });
  const abilities=classes.flatMap(c=>c.abilities);
  return {scope:'Synthetic level-5 fixture abilities only; not full class or SRD automation',classesRepresented:classes.length,classesValidatedByReport:classes.filter(c=>c.validated).length,
    classesWithStructuralTests:referenceClasses.length,classesWithDeepCombatScenarios:advancedCases.map(c=>c.name),
    fixtureTestSuite:'tests/universal-rules.test.js (12 classes; no full class-completeness claim)',
    totals:Object.fromEntries(['referenced','manual','partial','automated','unsupported'].map(s=>[s,abilities.filter(a=>a.status===s).length])),
    primitives:PRIMITIVES,missingPrimitives:Object.keys(PRIMITIVES).filter(k=>PRIMITIVES[k]==='unsupported'),
    advancedCaseTotals:Object.fromEntries(['referenced','manual','partial','automated','unsupported'].map(status=>[status,advancedCases.flatMap(c=>c.abilities).filter(a=>a.status===status).length])),
    testedSpellFamilies:['selected-target spell attacks','selected-target saving throws','typed multi-target damage','concentration buffs with explicit duration','pact/upcast selection','manual adjudication'],fullOfficialSpellsAutomated:0,advancedCases,classes};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  const raw=JSON.stringify(coverageReport(),null,2)+'\n',path=new URL('../docs/coverage-report.json',import.meta.url);
  if(process.argv.includes('--check')) assert.equal(readFileSync(path,'utf8'),raw,'Regenerate coverage report');
  else if(process.argv.includes('--write')) writeFileSync(path,raw);
  else process.stdout.write(raw);
}
