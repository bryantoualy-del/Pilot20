import test from 'node:test';
import assert from 'node:assert/strict';
import {advancedCharacter,profile,timedEffect} from '../examples/advanced-characters.mjs';
import {ability} from '../examples/characters.mjs';
import {createCombat,executeCombat,validateCombat} from '../src/character/session.js';
import {derive} from '../src/character/derive.js';
import {statistic,activeEffects} from '../src/rules/combat.js';
import {serialize,deserialize} from '../src/model.js';
const fresh=()=>createCombat('p0',[
 {instanceId:'fighter',character:advancedCharacter('fighter',{level:11})},
 {instanceId:'caster',character:advancedCharacter('sorcerer',{level:11})},
 ...Array.from({length:5},(_,i)=>{const d=advancedCharacter('fighter',{level:11});if(i===1)d.defenses.resistances=['fire'];if(i===2)d.defenses.immunities=['fire'];if(i===3)d.defenses.vulnerabilities=['fire'];return {instanceId:'t'+i,character:d};})]);
const run=(s,c)=>executeCombat(s,c).state;
const turn=(s,id,actorId)=>run(s,{id,type:'startTurn',actorId});
const use=(id,actorId,abilityId,extra={})=>({id,type:'useAbility',actorId,abilityId,...extra});
const swing=(id,budget)=>use(id,'fighter','blade',{targetIds:['t0'],attackRolls:[19],effectRolls:{0:[4]},...(budget?{budget}:{})});
const fb=(id,extra={})=>use(id,'caster','fireball',{targetIds:['t0','t1','t2','t3','t4'],slotId:'slot3',effectRolls:{0:Array(8).fill(3)},saveRolls:{t0:[1],t1:[20],t2:[1],t3:[20],t4:[20]},...extra});
const haste=(id='haste')=>use(id,'caster','haste',{targetIds:['fighter'],slotId:'slot3'});
const undo=(s,id,actionId)=>run(s,{id,type:'undo',actionId});
const rejects=(s,c,pattern)=>{const before=structuredClone(s);assert.throws(()=>run(s,c),pattern);assert.deepEqual(s,before);};
test('A: three attacks, an independent full action, and one restricted weapon attack',()=>{
 let s=turn(fresh(),'caster-turn','caster');s=run(s,haste());s=turn(s,'fighter-turn','fighter');
 const before=structuredClone(s.engine.actors.fighter.definition),targetHp=s.engine.actors.t0.hp.current;
 for(let i=0;i<3;i++)s=run(s,swing('normal'+i));
 rejects(s,swing('fourth'),/Action spent/);
 s=run(s,use('surge','fighter','action-surge'));assert.equal(s.engine.actors.fighter.advanced.extraActions,1);
 for(let i=0;i<3;i++)s=run(s,swing('extra'+i,'extra'));
 rejects(s,swing('extra4','extra'),/Extra action spent/);
 const budget=s.engine.actors.fighter.advanced.effects[0].id;
 s=run(s,swing('hasted',budget));rejects(s,swing('hasted2',budget),/Restricted action spent/);
 assert.equal(s.engine.actors.t0.hp.current,targetHp-7*8);assert.deepEqual(s.engine.actors.fighter.definition,before);
 assert.equal(statistic(s.engine.actors.fighter,'ac',before.ac),18);assert.equal(statistic(s.engine.actors.fighter,'speed',before.speed),60);
 const restored=undo(s,'undo-hasted','hasted');assert.equal(restored.engine.actors.t0.hp.current,targetHp-6*8);assert.equal(restored.engine.actors.fighter.advanced.restrictedUsed.length,0);
 assert.equal(executeCombat(restored,swing('hasted',budget)).replayed,true);
});
test('additional action before normal action does not overwrite either attack budget',()=>{
 let s=run(fresh(),use('surge','fighter','action-surge'));s=run(s,swing('extra','extra'));
 assert.equal(s.engine.actors.fighter.economy.action,true);assert.equal(s.engine.actors.fighter.advanced.extraAttacks,2);
 for(let i=0;i<3;i++)s=run(s,swing('normal'+i));
 for(let i=0;i<2;i++)s=run(s,swing('remain'+i,'extra'));
 rejects(s,use('surge2','fighter','action-surge'),/depleted|Grant limit/);
});
test('restricted budget rejects casting, multiple weapon attacks and unsupported action kinds',()=>{
 let s=turn(fresh(),'ct','caster');s=run(s,haste());s=turn(s,'ft','fighter');const budget=s.engine.actors.fighter.advanced.effects[0].id;
 const c=use('cast-hasted','caster','cantrip',{targetIds:['t0'],attackRolls:[19],budget});rejects(s,c,/Not actor turn/);
 s=run(s,use('dash','fighter','dash',{budget}));assert.equal(s.engine.actors.fighter.advanced.dashCount,1);
 rejects(s,swing('second',budget),/Restricted action spent/);
});
test('B: shared fireball roll, five saves and defenses with atomic slot expenditure and undo',()=>{
 let s=turn(fresh(),'ct','caster');const before=structuredClone(s),out=executeCombat(s,fb('fire'));
 assert.deepEqual(out.result.results.map(r=>r.damage),[24,6,0,24,12]);
 assert.deepEqual(out.result.results.map(r=>r.save.success),[false,true,false,true,true]);
 assert.equal(out.result.slotLevel,3);assert.equal(out.state.engine.actors.caster.resources.slot3,s.engine.actors.caster.resources.slot3-1);
 assert.equal(executeCombat(out.state,fb('fire')).replayed,true);rejects(out.state,fb('fire',{slotId:'slot4'}),/collision/);
 s=undo(out.state,'undo','fire');assert.deepEqual(s.engine.actors,before.engine.actors);assert.equal(executeCombat(s,fb('fire')).replayed,true);
});
test('save rounding precedes defenses, no attack is required, natural 1 and 20 are numeric saves',()=>{
 let s=turn(fresh(),'ct','caster');const out=executeCombat(s,fb('fire',{effectRolls:{0:[3,3,3,3,3,3,3,2]}}));
 assert.equal(out.result.total,null);assert.equal(out.result.results[1].damage,5); // floor(floor(23/2)/2)
 const b=structuredClone(s);b.engine.actors.t0.definition.saves.dex=100;
 assert.equal(executeCombat(b,fb('one')).result.results[0].save.success,true);
});
test('upcast uses chosen level and rejects low/depleted slot or invalid final target atomically',()=>{
 let s=turn(fresh(),'ct','caster');const out=executeCombat(s,fb('up',{slotId:'slot4',effectRolls:{0:Array(9).fill(3)}}));
 assert.equal(out.result.slotLevel,4);assert.equal(out.result.results[0].damage,27);
 rejects(s,fb('low',{slotId:'slot2'}),/slot/);rejects(s,fb('wrong-dice',{slotId:'slot4'}),/dice/);
 rejects(s,fb('bad-save',{saveRolls:{t0:[1],t1:[20],t2:[1],t3:[20],t4:[21]}}),/dice/);
 rejects(s,fb('bad-target',{targetIds:['t0','missing']}),/Unknown actor/);
});
test('C: concentration damage/save failure removes all dependent effects and undo restores them',()=>{
 let s=turn(fresh(),'ct','caster');s=run(s,haste());const permanent=structuredClone(s.engine.actors.fighter.definition);
 s=run(s,{id:'hurt',type:'damage',actorId:'caster',amount:1,damageType:'fire'});
 const pending=structuredClone(s);s=run(s,{id:'fail',type:'concentrationSave',actorId:'caster',checkId:'hurt',rolls:[1]});
 assert.equal(s.engine.actors.caster.concentration,null);assert.equal(s.engine.actors.fighter.advanced.effects.length,0);
 assert.equal(statistic(s.engine.actors.fighter,'ac',permanent.ac),permanent.ac);assert.deepEqual(s.engine.actors.fighter.definition,permanent);
 s=undo(s,'undo','fail');assert.deepEqual(s.engine.actors,pending.engine.actors);
});
test('concentration replacement establishes one instance and retires old target effects',()=>{
 let s=turn(fresh(),'ct','caster');s=run(s,haste('first'));s=turn(s,'ct2','caster');
 s=run(s,use('second','caster','haste',{targetIds:['t0'],slotId:'slot3'}));
 assert.equal(s.engine.actors.caster.concentration.instanceId,'second');assert.equal(s.engine.actors.fighter.advanced.effects.length,0);
 assert.equal(s.engine.actors.t0.advanced.effects[0].concentrationInstanceId,'second');
 rejects(s,{id:'stale',type:'concentrationSave',actorId:'caster',checkId:'first',rolls:[20]},/Stale/);
});
test('F: runtime buffs expire at explicit boundaries, Haste ends with no actions until next turn end',()=>{
 let s=turn(fresh(),'ct','caster');s=run(s,haste());s=run(s,{id:'stop',type:'endConcentration',actorId:'caster'});
 s=turn(s,'ft','fighter');rejects(s,swing('blocked'),/cannot act/);rejects(s,{id:'move',type:'move',actorId:'fighter',distance:5},/cannot act/);
 s=run(s,{id:'end',type:'endTurn',actorId:'fighter'});s=turn(s,'ft2','fighter');s=run(s,swing('back'));assert.equal(s.engine.actors.fighter.advanced.lethargyUntil,0);
});
test('Haste minute expires at tenth source start; refresh does not grant extra reaction or budget use',()=>{
 let s=turn(fresh(),'ct','caster');s=run(s,haste());
 for(let i=0;i<9;i++)s=turn(s,'ct'+i,'caster');assert.equal(s.engine.actors.fighter.advanced.effects.length,1);
 s=turn(s,'ct-last','caster');assert.equal(s.engine.actors.fighter.advanced.effects.length,0);assert.ok(s.engine.actors.fighter.advanced.lethargyUntil);assert.equal(s.engine.actors.caster.concentration,null);
});
test('G/H: explicit manual declaration persists, blocks dependent commands, resolves once and undoes in two stages',()=>{
 let s=turn(fresh(),'ct','caster');s=run(s,haste());s=turn(s,'ct2','caster');const before=structuredClone(s);
 const declaration={id:'manual',type:'declareManual',actorId:'caster',abilityId:'manual-illusion',targetIds:['t0'],slotId:'slot1',reason:'MJ validated components and visible destination; illusion adjudicated manually'};
 s=run(s,declaration);assert.equal(s.engine.actors.caster.resources.slot1,before.engine.actors.caster.resources.slot1-1);
 s=validateCombat({...JSON.parse(JSON.stringify(s)),engine:deserialize(serialize(s.engine))});
 rejects(s,fb('blocked'),/pending manual/);assert.equal(executeCombat(s,declaration).replayed,true);
 const resolution={id:'resolve',type:'resolveManual',actorId:'caster',declarationId:'manual',reason:'MJ accepted consequence',outcomes:[{actorId:'t0',kind:'damage',amount:7,reason:'Adjudicated final damage, defenses already included'},{actorId:'t0',kind:'effect',rule:timedEffect(),reason:'Temporary cover decided by MJ'}]};
 const pending=structuredClone(s);s=run(s,resolution);assert.equal(s.engine.actors.t0.hp.current,pending.engine.actors.t0.hp.current-7);assert.equal(s.engine.actors.caster.advanced.pendingManual,null);
 assert.equal(executeCombat(s,resolution).replayed,true);rejects(s,{...resolution,id:'duplicate'},/Stale/);
 s=undo(s,'undo-result','resolve');assert.deepEqual(s.engine.actors,pending.engine.actors);
 s=undo(s,'undo-declaration','manual');assert.deepEqual(s.engine.actors,before.engine.actors);
});
test('manual resolution is atomic including earlier outcomes, resources, reason and target validation',()=>{
 let s=turn(fresh(),'ct','caster');s=run(s,{id:'declare',type:'declareManual',actorId:'caster',abilityId:'manual-illusion',slotId:'slot1',targetIds:['t0'],reason:'Adjudicate manually'});
 rejects(s,{id:'resolve',type:'resolveManual',actorId:'caster',declarationId:'declare',reason:'MJ',outcomes:[{actorId:'t0',kind:'damage',amount:8,reason:'First'},{actorId:'t1',kind:'heal',amount:3,reason:'Undeclared'}]},/not declared/);
 rejects(s,{id:'resolve-empty',type:'resolveManual',actorId:'caster',declarationId:'declare',reason:'',outcomes:[]},/reason/);
});
test('D/E deferred reaction and post-hit mechanics remain blocked, never simulated',()=>{
 const d=advancedCharacter('paladin');d.abilities.push(ability('deferred',{cost:'reaction',combat:profile({deferred:['reactionWindow','decision']}),effects:[{kind:'damage',amount:99,damageType:'radiant'}]}));
 const derived=derive(d);assert.equal(derived.coverage.deferred.status,'represented');assert.equal(derived.abilities.deferred,undefined);
 const s=createCombat('deferred',[{instanceId:'a',character:d}]);rejects(s,use('attempt','a','deferred'),/Unknown ability/);
});
test('spell known/prepared/granted availability is validated independently of mere references',()=>{
 const d=advancedCharacter('wizard'),fire=d.abilities.find(a=>a.id==='fireball');d.spells.known=d.spells.known.filter(x=>x!=='fireball');assert.equal(derive(d).abilities.fireball,undefined);
 fire.combat.spell.access='prepared';d.spells.known.push('fireball');d.spells.prepared.push('fireball');assert.ok(derive(d).abilities.fireball);
 d.spells.prepared=[];assert.equal(derive(d).abilities.fireball,undefined);
 fire.combat.spell.access='granted';assert.equal(derive(d).abilities.fireball,undefined);d.features.push('fireball');assert.ok(derive(d).abilities.fireball);
});
test('2014 bonus-action spell restriction in both orders including bonus cantrip and same-turn reactions',()=>{
 const caster=advancedCharacter('sorcerer',{level:11}),fb=caster.abilities.find(a=>a.id==='fireball');
 const bonus=structuredClone(fb);bonus.id='bonus';bonus.cost='bonus';bonus.combat.spell.id='bonus';caster.spells.known.push('bonus');caster.abilities.push(bonus);
 const reaction=structuredClone(caster.abilities.find(a=>a.id==='cantrip'));reaction.id='reaction';reaction.cost='reaction';caster.abilities.push(reaction);
 let s=createCombat('bonus',[{instanceId:'caster',character:caster},{instanceId:'t0',character:advancedCharacter('fighter',{level:11})}]);
 s=run(s,use('bonus','caster','bonus',{targetIds:['t0'],slotId:'slot3',effectRolls:{0:Array(8).fill(1)},saveRolls:{t0:[1]}}));
 rejects(s,fbCommand('levelled'),/Bonus-action/);rejects(s,use('rx','caster','reaction',{targetIds:['t0'],attackRolls:[19]}),/Bonus-action/);
 s=run(s,use('allowed','caster','cantrip',{targetIds:['t0'],attackRolls:[19]}));assert.equal(s.engine.actors.caster.advanced.casts.length,2);
 let reverse=createCombat('reverse',[{instanceId:'caster',character:caster},{instanceId:'t0',character:advancedCharacter('fighter',{level:11})}]);
 reverse=run(reverse,fbCommand('first'));rejects(reverse,use('bonus2','caster','bonus',{targetIds:['t0'],slotId:'slot3',effectRolls:{0:Array(8).fill(1)},saveRolls:{t0:[1]}}),/Bonus-action/);
 function fbCommand(id){return use(id,'caster','fireball',{targetIds:['t0'],slotId:'slot3',effectRolls:{0:Array(8).fill(1)},saveRolls:{t0:[1]}});}
});
test('pact level selected separately from count, short-rest recovery and undo',()=>{
 const d=advancedCharacter('warlock',{level:9});let s=createCombat('pact',[{instanceId:'caster',character:d},{instanceId:'t0',character:advancedCharacter('fighter',{level:11})}]);
 const c=use('pact','caster','fireball',{targetIds:['t0'],slotId:'pact:warlock',effectRolls:{0:Array(10).fill(2)},saveRolls:{t0:[1]}});
 const out=executeCombat(s,c);assert.equal(out.result.slotLevel,5);assert.equal(out.state.engine.actors.caster.resources['pact:warlock'],1);
 s=run(out.state,{id:'rest',type:'rest',actorId:'caster',kind:'short'});assert.equal(s.engine.actors.caster.resources['pact:warlock'],2);
 s=undo(s,'undo','rest');assert.equal(s.engine.actors.caster.resources['pact:warlock'],1);
});
test('movement spent respects temporary speed, Dash and turn reset',()=>{
 let s=fresh();s=run(s,{id:'move',type:'move',actorId:'fighter',distance:20});rejects(s,{id:'far',type:'move',actorId:'fighter',distance:11},/budget/);
 s=run(s,use('dash','fighter','dash'));s=run(s,{id:'move2',type:'move',actorId:'fighter',distance:40});assert.equal(s.engine.actors.fighter.advanced.movementSpent,60);
 s=turn(s,'turn','fighter');assert.equal(s.engine.actors.fighter.advanced.movementSpent,0);
});
test('revision conflict, authority and failed commands do not mutate or spend',()=>{
 const s=fresh();rejects(s,{...swing('stale'),expectedRevision:9},/Revision conflict/);
 const connected=structuredClone(s);connected.engine.mode='encounter';rejects(connected,swing('no-authority'),/Encounter authority/);
 const valid=executeCombat(connected,swing('authoritative'),{authority:'encounter'});assert.ok(valid.result.hit);
});

test('explicit stacking keeps multiple sources, suppresses rather than adds, and rejects incompatible replacements',()=>{
 const d=advancedCharacter('fighter'),ward=(id,rule)=>ability(id,{target:'self',cost:'bonus',combat:profile({ongoing:[rule]})});
 d.abilities.push(ward('one',timedEffect({duration:{unit:'round',value:3,anchor:'target',boundary:'start'}})),ward('two',timedEffect({stack:{key:'ward',policy:'priority',priority:2},modifiers:[{stat:'ac',operation:'add',value:5}]})));
 let s=createCombat('stack',[{instanceId:'a',character:d}]);s=run(s,use('one','a','one'));s=turn(s,'next','a');s=run(s,use('two','a','two'));
 assert.equal(s.engine.actors.a.advanced.effects.length,2);assert.equal(activeEffects(s.engine.actors.a).length,1);assert.equal(statistic(s.engine.actors.a,'ac',16),21);
 s=turn(s,'expire-two','a');assert.equal(statistic(s.engine.actors.a,'ac',16),18);
 const before=structuredClone(s);s=run(s,{id:'remove',type:'removeEffect',actorId:'a',effectId:s.engine.actors.a.advanced.effects[0].id,reason:'MJ dispelled the ward'});
 assert.equal(statistic(s.engine.actors.a,'ac',16),16);s=undo(s,'undo-remove','remove');assert.deepEqual(s.engine.actors,before.engine.actors);
});
test('turn-end debuff, source/target anchors, replacement and invalid stacking are atomic',()=>{
 const d=advancedCharacter('fighter'),slow=timedEffect({id:'slow',stack:{key:'slow',policy:'replace',priority:1},duration:{unit:'turn',value:1,anchor:'target',boundary:'end'},modifiers:[{stat:'speed',operation:'multiply',value:0}]});
 d.abilities.push(ability('slow',{target:'self',cost:'bonus',combat:profile({ongoing:[slow]})}));
 let s=createCombat('slow',[{instanceId:'a',character:d}]);s=run(s,use('slow','a','slow'));assert.equal(statistic(s.engine.actors.a,'speed',30),0);
 s=run(s,{id:'end',type:'endTurn',actorId:'a'});assert.equal(s.engine.actors.a.advanced.effects.length,0);assert.equal(statistic(s.engine.actors.a,'speed',30),30);
 rejects(s,use('ended','a','slow'),/Turn ended/);
});
test('conditional immediate and durable effects follow the target save result, success consumes the slot',()=>{
 const d=advancedCharacter('sorcerer',{level:11}),f=d.abilities.find(a=>a.id==='fireball');
 f.save.onSuccess='none';f.effects=[{kind:'damage',amount:9,damageType:'fire',when:'failure'}];delete f.combat.upcast;
 f.combat.ongoing=[timedEffect({when:'failure'}),timedEffect({id:'success',stack:{key:'success',policy:'priority',priority:1},when:'success'})];
 let s=createCombat('save-effects',[{instanceId:'caster',character:d},{instanceId:'target',character:advancedCharacter('fighter',{level:11})}]);
 const out=executeCombat(s,use('saved','caster','fireball',{targetIds:['target'],slotId:'slot3',saveRolls:{target:[20]}}));
 assert.equal(out.state.engine.actors.target.hp.current,s.engine.actors.target.hp.current);assert.equal(out.state.engine.actors.caster.resources.slot3,2);
 assert.equal(out.state.engine.actors.target.advanced.effects.length,1);assert.equal(out.state.engine.actors.target.advanced.effects[0].rule.id,'success');
});
test('a multicaster may cast two action spells with a granted action under the 2014 rules',()=>{
 const d=advancedCharacter('sorcerer',{level:11});d.resources.push({id:'extra',max:1,recovery:'short',source:d.abilities[0].source});
 d.abilities.push(ability('grant',{target:'self',cost:'none',resource:{id:'extra',amount:1},combat:profile({grant:{count:1,maxPerTurn:1}})}));
 let s=createCombat('two-casts',[{instanceId:'caster',character:d},{instanceId:'target',character:advancedCharacter('fighter',{level:11})}]);
 const cast=id=>use(id,'caster','fireball',{targetIds:['target'],slotId:'slot3',effectRolls:{0:Array(8).fill(1)},saveRolls:{target:[20]}});
 s=run(s,cast('first'));s=run(s,use('grant','caster','grant'));s=run(s,{...cast('second'),budget:'extra'});
 assert.equal(s.engine.actors.caster.resources.slot3,1);assert.equal(s.engine.actors.caster.advanced.casts.length,2);
});
test('persist P0 runtime and manual decision through memory and IndexedDB repositories without double spending',async()=>{
 const {MemoryStorage,openIndexedDB}=await import('../src/persistence/adapters.js');
 const {combatRepository}=await import('../src/persistence/combat-repository.js');
 const {indexedDB}=await import('fake-indexeddb');
 for(const adapter of [new MemoryStorage(),await openIndexedDB('p0-persist-'+Date.now(),{indexedDB})]) {
   const repo=combatRepository(adapter);let s=fresh();await repo.create(s);
   await repo.commit(s.id,{id:'ct',type:'startTurn',actorId:'caster'});await repo.commit(s.id,haste());
   await repo.commit(s.id,{id:'ct2',type:'startTurn',actorId:'caster'});
   const c={id:'declare',type:'declareManual',actorId:'caster',abilityId:'manual-illusion',targetIds:['t0'],slotId:'slot1',reason:'MJ adjudicates'};
   await repo.commit(s.id,c);s=await repo.load(s.id);assert.ok(s.engine.actors.caster.advanced.pendingManual);assert.equal(s.engine.actors.fighter.advanced.effects.length,1);
   const slot=s.engine.actors.caster.resources.slot1;assert.equal((await repo.commit(s.id,c)).replayed,true);
   await repo.commit(s.id,{id:'resolve',type:'resolveManual',actorId:'caster',declarationId:'declare',reason:'MJ approved',outcomes:[]});
   s=await repo.load(s.id);assert.equal(s.engine.actors.caster.resources.slot1,slot);assert.equal(s.engine.actors.caster.advanced.pendingManual,null);
 }
});

test('new schema accepts all producer documents and rejects corrupt advanced runtime fields',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:Ajv}=await import('ajv/dist/2020.js');
 const ajv=new Ajv({strict:false});
 const rules=JSON.parse(await readFile(new URL('../schemas/combat-rules-v1.schema.json',import.meta.url))),legacy=JSON.parse(await readFile(new URL('../docs/session-v1.schema.json',import.meta.url))),character=JSON.parse(await readFile(new URL('../schemas/contracts-v2.schema.json',import.meta.url)));
 ajv.addSchema(rules);ajv.addSchema(legacy);const valid=ajv.compile(character);
 const d=advancedCharacter('sorcerer',{level:11});assert.equal(valid(d),true,JSON.stringify(valid.errors));
 let s=turn(fresh(),'ct','caster');s=run(s,haste());s=turn(s,'ct2','caster');s=run(s,{id:'manual',type:'declareManual',actorId:'caster',abilityId:'manual-illusion',slotId:'slot1',targetIds:['t0'],reason:'MJ validated'});
 assert.equal(valid(s),true,JSON.stringify(valid.errors));
 const {runtimeOf}=await import('../src/character/session.js');assert.equal(valid(runtimeOf(s,'caster')),true,JSON.stringify(valid.errors));
 const bad=structuredClone(s);delete bad.engine.actors.caster.advanced.casts;assert.equal(valid(bad),false);assert.throws(()=>validateCombat(bad));
 const orphan=structuredClone(s);orphan.engine.actors.fighter.advanced.effects[0].concentrationInstanceId='stale';assert.throws(()=>validateCombat(orphan),/Orphan/);
});
test('Haste advantage on Dexterity saves uses two injected dice and disappears with concentration',()=>{
 const d=advancedCharacter('sorcerer',{level:11});let s=createCombat('advantage',[{instanceId:'caster',character:d},{instanceId:'fighter',character:advancedCharacter('fighter',{level:11})}]);
 s=run(s,haste());s=turn(s,'next','caster');
 const c=use('blast','caster','fireball',{targetIds:['fighter'],slotId:'slot3',effectRolls:{0:Array(8).fill(3)},saveRolls:{fighter:[1,20]}});
 const out=executeCombat(s,c);assert.equal(out.result.results[0].save.success,true);assert.equal(out.result.results[0].damage,12);
 rejects(s,{...c,id:'one-die',saveRolls:{fighter:[20]}},/dice/);
});
test('short-duration independent effects do not accidentally terminate a longer concentration clock',()=>{
 const d=advancedCharacter('sorcerer',{level:11}),spell=d.abilities.find(a=>a.id==='haste');spell.combat.ongoing=[timedEffect({concentration:true})];
 let s=createCombat('clock',[{instanceId:'caster',character:d},{instanceId:'fighter',character:advancedCharacter('fighter',{level:11})}]);s=run(s,haste());s=turn(s,'ft','fighter');
 assert.equal(s.engine.actors.fighter.advanced.effects.length,0);assert.equal(s.engine.actors.caster.concentration.instanceId,'haste');
 s=run(s,{id:'stop',type:'endConcentration',actorId:'caster'});assert.equal(s.engine.actors.caster.advanced.concentrationClock,null);
});
test('runtime stacking and rules are validated before publication; no ignored unknown profile fields',()=>{
 const d=advancedCharacter('fighter');d.abilities[0].combat.extraJavaScript='evil()';assert.throws(()=>derive(d),/Unexpected/);
 const s=fresh();rejects(s,{...swing('fn'),callback:()=>1},/Plain JSON/);
});

test('normal and additional Attack actions can interleave without overwriting remaining attacks',()=>{
 let s=fresh();s=run(s,swing('normal-1'));s=run(s,use('surge','fighter','action-surge'));s=run(s,swing('extra-1','extra'));
 assert.equal(s.engine.actors.fighter.economy.attacks,2);assert.equal(s.engine.actors.fighter.advanced.extraAttacks,2);
 s=run(s,swing('normal-2'));s=run(s,swing('extra-2','extra'));s=run(s,swing('normal-3'));s=run(s,swing('extra-3','extra'));
 assert.equal(s.engine.actors.fighter.economy.attacks,0);assert.equal(s.engine.actors.fighter.advanced.extraAttacks,0);
});

test('temporary attack/damage/save modifiers and explicit restrictions execute without editing sheets',()=>{
 const d=advancedCharacter('fighter',{level:11}),buff=timedEffect({id:'focus',duration:{unit:'round',value:2,anchor:'target',boundary:'start'},modifiers:[{stat:'attack',operation:'add',value:1},{stat:'damage',operation:'add',value:2},{stat:'save.con',operation:'add',value:1}]});
 d.abilities.push(ability('focus',{target:'self',cost:'bonus',combat:profile({ongoing:[buff]})}));
 let s=createCombat('modifiers',[{instanceId:'fighter',character:d},{instanceId:'t0',character:advancedCharacter('fighter',{level:11})}]);const definition=structuredClone(s.engine.actors.fighter.definition);
 s=run(s,use('focus','fighter','focus'));const result=executeCombat(s,swing('hit'));
 assert.equal(statistic(result.state.engine.actors.fighter,'save.con',definition.saves.con),definition.saves.con+1);
 assert.equal(result.result.total,28);assert.equal(result.result.results[0].damage,10);assert.deepEqual(result.state.engine.actors.fighter.definition,definition);
});
test('manual supported inhibition effects block casting and concentration until removed',()=>{
 let s=turn(fresh(),'ct','caster');s=run(s,{id:'decl',type:'declareManual',actorId:'caster',abilityId:'manual-illusion',targetIds:['caster'],slotId:'slot1',reason:'MJ applies a casting restriction'});
 s=run(s,{id:'restriction',type:'resolveManual',actorId:'caster',declarationId:'decl',reason:'Adjudicated restriction',outcomes:[{kind:'effect',actorId:'caster',reason:'Concentration interference',rule:timedEffect({duration:{unit:'round',value:2,anchor:'target',boundary:'start'},conditions:['cannotConcentrate','cannotCast'],modifiers:[]})}]});
 s=turn(s,'ct2','caster');
 rejects(s,haste('blocked-concentration'),/Concentration restricted/);
 rejects(s,use('blocked-cast','caster','cantrip',{targetIds:['t0'],attackRolls:[19]}),/Spellcasting restricted/);
 s=run(s,{id:'remove-restriction',type:'removeEffect',actorId:'caster',effectId:s.engine.actors.caster.advanced.effects[0].id,reason:'MJ ends restriction'});
 s=run(s,haste('allowed'));assert.equal(s.engine.actors.caster.concentration.instanceId,'allowed');
});

test('conflicting stacking policies and simultaneous statistic replacements reject atomically',()=>{
 const d=advancedCharacter('fighter'),ward=(id,rule)=>ability(id,{target:'self',cost:'bonus',combat:profile({ongoing:[rule]})});
 const duration={unit:'round',value:5,anchor:'target',boundary:'start'};
 d.abilities.push(ward('one',timedEffect({duration})),ward('conflict',timedEffect({duration,stack:{key:'ward',policy:'independent',priority:1}})),ward('set-one',timedEffect({duration,stack:{key:'set-one',policy:'independent',priority:1},modifiers:[{stat:'ac',operation:'set',value:15}]})),ward('set-two',timedEffect({duration,stack:{key:'set-two',policy:'independent',priority:1},modifiers:[{stat:'ac',operation:'set',value:17}]})));
 let s=createCombat('conflicts',[{instanceId:'a',character:d}]);s=run(s,use('first','a','one'));s=turn(s,'turn','a');
 rejects(s,use('conflict','a','conflict'),/Incompatible stacking/);
 s=run(s,use('set-one','a','set-one'));s=turn(s,'next','a');rejects(s,use('set-two','a','set-two'),/Incompatible statistic/);
});
