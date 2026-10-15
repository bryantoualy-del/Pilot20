import test from 'node:test';
import assert from 'node:assert/strict';
import {characterFixture,referenceClasses,ability,resource} from '../examples/characters.mjs';
import {validateCharacter,validateBuild,migrateCharacter} from '../src/character/definition.js';
import {derive,modifier,proficiencyBonus,spellSlots} from '../src/character/derive.js';
import {createCombat,executeCombat,runtimeOf,migrateLegacyCombat} from '../src/character/session.js';
import {expression} from '../src/character/rules.js';
import {catalog,HOMEBREW} from '../src/catalog/srd51.js';
import {validateCatalog} from '../src/catalog/validate.js';
import {defaultPreferences,preferences} from '../src/character/contracts.js';
test('2014 modifiers and proficiency boundaries',()=>{
  assert.deepEqual([1,8,9,10,18,20,30].map(modifier),[-5,-1,-1,0,4,5,10]);
  assert.deepEqual([1,4,5,8,9,12,13,16,17,20].map(proficiencyBonus),[2,2,3,3,4,4,5,5,6,6]);
  assert.throws(()=>proficiencyBonus(0));assert.throws(()=>modifier(31));
});
for(const c of referenceClasses) test('shared construction and execution: '+c,()=>{
  const d=characterFixture(c),before=structuredClone(d),s=derive(d);
  assert.equal(validateBuild(d).valid,true);assert.ok(s.maxHp>0);assert.equal(s.level,5);assert.equal(s.proficiency,3);
  const combat=createCombat('combat-'+c,[{instanceId:'actor',character:d},{instanceId:'target',character:characterFixture('fighter')}]);
  const out=executeCombat(combat,{id:'attack',type:'useAbility',actorId:'actor',abilityId:'blade',targetIds:['target'],attackRolls:[19],effectRolls:{0:[4]}});
  assert.equal(out.result.hit,true);assert.ok(out.state.engine.actors.target.hp.current<combat.engine.actors.target.hp.current);
  assert.deepEqual(d,before);assert.equal(combat.engine.revision,0);assert.equal(runtimeOf(out.state,'actor').characterId,d.id);
});
test('derived fighter statistics, attacks and equipment',()=>{
 const d=characterFixture('fighter'),s=derive(d);
 assert.equal(s.maxHp,49);assert.equal(s.ac,16);assert.equal(s.weapons.blade.attack,7);assert.equal(s.saves.con,6);assert.equal(s.attacksPerAction,2);
 assert.equal(derive(characterFixture('fighter',{level:11})).attacksPerAction,3);
 assert.equal(derive(characterFixture('fighter',{level:20})).attacksPerAction,4);
 d.scores.str=20;assert.equal(derive(d).weapons.blade.attack,8);
 d.scores.con=18;assert.equal(derive(d).maxHp,54);
});
test('skills expertise, saves, casting, initiative',()=>{
 const r=derive(characterFixture('rogue'));assert.equal(r.skills.perception,7);assert.equal(r.saves.dex,7);assert.equal(r.initiative,4);
 const s=derive(characterFixture('sorcerer'));assert.deepEqual(s.casting.sorcerer,{attack:7,dc:15});
 assert.equal(s.resources.slot3.max,2);assert.equal(s.resources['sorcery-points'].max,5);
});
test('armor alternatives, negative dex, shields, heavy strength speed penalty',()=>{
 const d=characterFixture('barbarian');assert.equal(derive(d).ac,15);
 d.scores.dex=8;assert.equal(derive(d).ac,12);
 const shield={id:'shield',kind:'shield',equipped:true,source:HOMEBREW,weapon:null,armor:{base:2,dexCap:0,bonus:0,minStrength:0,heavy:false}};
 d.equipment.push(shield);assert.equal(derive(d).ac,14);
 d.equipment.push(structuredClone({...characterFixture('fighter').equipment[1]}));d.scores.str=8;
 assert.equal(derive(d).ac,17);assert.equal(derive(d).speed,20);
 d.movement.ignoreHeavyPenalty=true;assert.equal(derive(d).speed,30);
});
test('explicit adjustments are traced and cannot touch identity',()=>{
 const d=characterFixture('fighter');d.modifiers.push({id:'gm-ac',stat:'ac',operation:'add',value:2,reason:'Magic correction',source:HOMEBREW});
 const s=derive(d);assert.equal(s.ac,18);assert.equal(s.trace.find(t=>t.id==='gm-ac').before,16);assert.equal(s.trace.find(t=>t.id==='gm-ac').reason,'Magic correction');
 d.modifiers[0].stat='identity.name';assert.throws(()=>derive(d));
});
test('incomplete data gives diagnostics without inventing missing HP or choices',()=>{
 const d=characterFixture('fighter');d.progression.pop();
 assert.equal(validateCharacter(d),d);assert.equal(validateBuild(d).valid,false);assert.throws(()=>derive(d),/Incomplete build/);
 d.progression.push({classId:'fighter',hp:6});
 d.choiceRules.push({id:'style',level:1,count:1,options:['a','b'],requires:['training'],incompatible:['forbidden']});
 assert.ok(validateBuild(d).issues.some(i=>i.code==='required-choice'));
 d.choices.push({id:'style',level:1,optionIds:['a'],note:''});
 assert.ok(validateBuild(d).issues.some(i=>i.code==='prerequisite'));
 d.choiceRules[0].requires=[];assert.equal(validateBuild(d).valid,true);
 d.choiceRules[0].incompatible=['a'];assert.ok(validateBuild(d).issues.some(i=>i.code==='incompatible'));
});
test('multiclass HP order, per-class levels and caster rounding',()=>{
 const d=characterFixture('fighter',{level:2});const sorc=characterFixture('sorcerer',{level:3});
 d.classes.push(sorc.classes[0]);d.progression.push(...sorc.progression.map(p=>({...p,hp:4})));
 assert.equal(derive(d).level,5);assert.equal(derive(d).resources.slot2.max,2);
 d.progression[0].hp=6;assert.equal(validateBuild(d).valid,false);
 const half={level:3,id:'paladin',casting:{progression:'half'}},third={level:4,id:'third',casting:{progression:'third'}};
 assert.equal(spellSlots([half]).casterLevel,2);assert.equal(spellSlots([half,third]).casterLevel,2);
});
test('pact slot level is separate from slot count and recovers short rest',()=>{
 const s=derive(characterFixture('warlock',{level:10}));
 assert.equal(s.resources['pact:warlock'].max,2);assert.equal(s.resources['pact:warlock'].recovery,'short');assert.equal(s.slotMetadata.pactLevels.warlock,5);
});
test('expressions cannot execute code or reference unknown data',()=>{
 assert.throws(()=>expression({op:'eval',args:['alert(1)']},{}));
 assert.throws(()=>expression({ref:'window.location'},{}));
 assert.throws(()=>expression(()=>1,{}));
 assert.throws(()=>expression({op:'floor',args:[{op:'multiply',args:[5,0.5]}]},{}));
});
test('unsupported mechanics cannot be activated through stripped fields',()=>{
 const d=characterFixture('fighter'),s=derive(d);
 assert.equal(s.coverage['action-surge'].status,'represented');assert.ok(!Object.hasOwn(s.abilities,'action-surge'));
 assert.equal(s.coverage['maneuver-case'].status,'represented');
 const c=createCombat('blocked',[{instanceId:'actor',character:d}]);
 assert.throws(()=>executeCombat(c,{id:'surge',type:'useAbility',actorId:'actor',abilityId:'action-surge'}));
 d.abilities[0].effects.push({kind:'executeJavaScript',parameters:{code:'evil'}});
 assert.throws(()=>validateCharacter(d));
});
test('save, duration, trigger, passive are represented only',()=>{
 const d=characterFixture('sorcerer');
 d.abilities.push(ability('save-spell',{kind:'spell',save:{ability:'dex',dc:{ref:'spellDC.sorcerer'},onSuccess:'half'},effects:[{kind:'damage',dice:'8d6',damageType:'fire'}]}));
 assert.equal(derive(d).coverage['save-spell'].status,'represented');
});
test('resource references, profiles, no functions/unsafe keys/future rulesets',()=>{
 const d=characterFixture('fighter');d.abilities[0].resource={id:'missing',amount:1};assert.throws(()=>validateCharacter(d));
 const fresh=characterFixture('fighter');fresh.identity.extra=1;assert.throws(()=>validateCharacter(fresh));
 const fn=characterFixture('fighter');fn.abilities[0].attack.bonus=()=>9;assert.throws(()=>validateCharacter(fn));
 const future=characterFixture('fighter');future.ruleset='dnd5e-2024';assert.throws(()=>validateCharacter(future));
 const unsafe=JSON.parse(JSON.stringify(characterFixture('fighter')).replace('"skills":{','"skills":{"__proto__":0,'));assert.throws(()=>validateCharacter(unsafe));
});
test('same definition can create multiple independent instances and sessions',()=>{
 const d=characterFixture('fighter'),s=createCombat('one',[{instanceId:'a',character:d},{instanceId:'b',character:d}]);
 const t=createCombat('two',[{instanceId:'a',character:d}]);
 const out=executeCombat(s,{id:'damage',type:'damage',actorId:'a',amount:9,damageType:'force'});
 assert.equal(out.state.engine.actors.b.hp.current,49);assert.equal(t.engine.actors.a.hp.current,49);assert.equal(d.revision,1);
 d.scores.con=20;assert.equal(s.engine.actors.a.definition.maxHp,49);
});
test('dashboard preferences never affect derived values; shared creation modes use same data',()=>{
 const d=characterFixture('fighter'),s=derive(d),p=defaultPreferences(d.id);p.theme='copper';p.panels=['combat','resources'];preferences(p);
 assert.deepEqual(derive(d),s);
 for(const mode of ['guided','quick','expert']) {const draft=structuredClone(d);assert.deepEqual(derive(draft),s,mode);}
});
test('explicit prototype migration is pure; future versions rejected',()=>{
 const d=characterFixture('fighter');d.schemaVersion=1;delete d.revision;
 const v2=migrateCharacter(d);assert.equal(v2.revision,1);assert.equal(d.schemaVersion,1);assert.equal(d.revision,undefined);
 const f={...v2,schemaVersion:3};assert.throws(()=>migrateCharacter(f));
});
test('catalog provenance and public/private boundary',()=>{
 validateCatalog(catalog,{distribution:'public'});
 const c=structuredClone(catalog);c.items[0].source.kind='private';assert.throws(()=>validateCatalog(c,{distribution:'public'}));validateCatalog(c);
});

test('legacy session migration preserves full history, receipts and independence',()=>{
 const c=createCombat('legacy-source',[{instanceId:'a',character:characterFixture('fighter')}]);
 const out=executeCombat(c,{id:'old',type:'damage',actorId:'a',amount:4,damageType:'fire'});
 const legacy=structuredClone(out.state.engine),before=structuredClone(legacy);
 const migrated=migrateLegacyCombat('legacy-import',legacy,{a:{characterId:'fighter-fixture',definitionRevision:1}});
 assert.deepEqual(migrated.engine.receipts,legacy.receipts);assert.deepEqual(migrated.engine.history,legacy.history);assert.deepEqual(legacy,before);
 assert.equal(executeCombat(migrated,{id:'old',type:'damage',actorId:'a',amount:4,damageType:'fire'}).replayed,true);
});
