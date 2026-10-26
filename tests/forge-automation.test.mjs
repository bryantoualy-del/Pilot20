import test from 'node:test';
import assert from 'node:assert/strict';
import {newItem,instanceOf,newResource,assertItem,exportItems,parseImport} from '../src/forge/model.js';
import {guidedAbility,compileCapability,simulateCapability,capabilityKinds} from '../src/forge/automation.js';
import {execute} from '../src/engine.js';
const setup=(kind='damage')=>{const d=newItem();d.abilities=[guidedAbility(kind)];return [d,d.abilities[0]];};
test('guided choices use the existing catalogue schema and round-trip',()=>{for(const kind of Object.keys(capabilityKinds)){const [d]=setup(kind);assertItem(d);assert.deepEqual(parseImport(exportItems([{definition:d}]))[0].definition,d);}});
test('damage, save rounding, resistance, vulnerability use the real combat engine',()=>{
 const [d,a]=setup();a.effects[0].params.dice='2d6';a.save={ability:'dex',dc:{kind:'fixed',value:15},success:'half-damage'};
 for(const [opts,expected] of [[{},7],[{saveRoll:20},3],[{resistances:['fire']},3],[{saveRoll:20,resistances:['fire']},1],[{vulnerabilities:['fire']},14]]) {
  const out=simulateCapability(d,a,{...opts,effectRolls:{0:[3,4]}});assert.equal(out.error,undefined);assert.equal(out.result.results[0].damage,expected);assert.equal(out.diagnostic.status,'automatic');
 }
});
test('action and charges are paid once; collision and spent action are rejected',()=>{
 const [d,a]=setup();const r=newResource();d.resources=[r];a.costs=[{resourceId:r.id,amount:2,timing:'on-use'}];
 const out=simulateCapability(d,a,{effectRolls:{0:[4]}});assert.equal(out.state.actors.source.resources[r.id],3);assert.equal(out.state.actors.source.economy.action,false);
 assert.equal(execute(out.state,out.command).replayed,true);
 assert.throws(()=>execute(out.state,{...out.command,id:'again'}),/Action spent/);
 assert.throws(()=>execute(out.state,{...out.command,effectRolls:{0:[5]}}),/collision/);
 assert.match(simulateCapability(d,a,{charges:1}).error,/depleted/);
});
test('reaction defense applies a timed modifier and expires on source boundary',()=>{
 const [d,a]=setup('protect');const out=simulateCapability(d,a);assert.equal(out.error,undefined);assert.equal(out.state.actors.source.economy.reaction,false);assert.equal(out.state.actors.source.advanced.effects.length,1);
 const next=execute(out.state,{id:'next',type:'startTurn',actorId:'source'});assert.equal(next.state.actors.source.advanced.effects.length,0);
 assert.match(simulateCapability(d,a,{reactionSpent:true}).error,/Action spent/);
});
test('unsupported and missing effects never claim automatic',()=>{
 for(const k of ['spell','transform','condition','summon','other','automatic']){const [d,a]=setup(k);assert.notEqual(compileCapability(d,a).status,'automatic');}
 const [d,a]=setup();a.effects[0].params.damageType=null;assert.equal(compileCapability(d,a).status,'incomplete');a.effects[0].params.damageType='fire';a.area={shape:'cone',size:9,unit:'m'};assert.equal(compileCapability(d,a).status,'partial');
});
test('equipment, attunement, versions and conditions fail closed; simulation is isolated',()=>{
 const [d,a]=setup();const instance=instanceOf(d,'source');const before=structuredClone({d,a,instance});
 assert.equal(simulateCapability(d,a,{instance}).diagnostic.status,'incomplete');assert.deepEqual({d,a,instance},before);
 instance.equipped=true;instance.definitionVersion='0.0.0';assert.equal(simulateCapability(d,a,{instance}).diagnostic.status,'incomplete');
});
test('attack miss deals no damage; critical doubles dice without a second action',()=>{
 const [d,a]=setup('attack');const miss=simulateCapability(d,a,{attackRoll:1});assert.equal(miss.result.hit,false);assert.equal(miss.state.actors.target.hp.current,100);
 const hit=simulateCapability(d,a,{attackRoll:20,effectRolls:{0:[4,5]}});assert.equal(hit.result.critical,true);assert.equal(hit.result.results[0].damage,9);
});
test('healing caps at max and simultaneous typed effects do not double consume',()=>{
 const [d,a]=setup('heal');const out=simulateCapability(d,a,{targetHP:199,effectRolls:{0:[8]}});assert.equal(out.state.actors.source.hp.current,200);
 const [w,b]=setup();b.effects.push({...structuredClone(b.effects[0]),id:'other',params:{dice:'1d6',damageType:'cold',role:'additional'}});
 const multi=simulateCapability(w,b,{effectRolls:{0:[3],1:[5]}});assert.equal(multi.result.results[0].damage,8);
});

test('weapon +1 and extra damage resolve together, magic is added exactly once',async()=>{
 const {effect}=await import('../src/forge/model.js');const {weaponCapability}=await import('../src/forge/automation.js');
 const [d]=setup();d.abilities=[];d.effects=[effect('damage',{dice:'1d8',damageType:'slashing',role:'weapon-base'}),effect('damage',{dice:'2d6',damageType:'fire',role:'additional'}),...['attack','damage'].map(stat=>effect('modifier',{stat,operation:'add',scope:'this-weapon',value:1}))];d.effects[0].trigger=d.effects[1].trigger='on-hit';
 const i={...instanceOf(d,'source'),equipped:true};const built=weaponCapability(d,i,{attackBonus:7,damageBonus:4});
 const out=simulateCapability(d,built.ability,{...built.context,instance:i,attackRoll:10,effectRolls:{0:[5],1:[3,4]}});
 assert.equal(out.result.total,18);assert.equal(out.result.results[0].damage,17);assert.equal(out.diagnostic.status,'automatic');
});

test('random recovery rejects impossible results and caps at maximum',async()=>{
 const {recoverResource}=await import('../src/forge/engine.js');const [d]=setup();const r=newResource();d.resources=[r];const i=instanceOf(d,'source');i.resources[r.id]=3;
 assert.equal(recoverResource(d,i,r.id,'dawn',5).resources[r.id],5);
 assert.throws(()=>recoverResource(d,i,r.id,'dawn',6),/limites/);assert.throws(()=>recoverResource(d,i,r.id,'dawn',0),/limites/);
 assert.equal(i.resources[r.id],3);
});
