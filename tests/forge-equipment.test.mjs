import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WEAPONS,ARMORS} from '../src/catalog/equipment.js';
import {categories,newItem,effect,baseProfile,instanceOf,assertItem,exportItems,parseImport} from '../src/forge/model.js';
import {subtypes,applySubtype,resolveSubtype,setMagicBonus,weaponContext} from '../src/forge/equipment.js';
import {weaponCapability,compileCapability,simulateCapability} from '../src/forge/automation.js';
import {prepareForgeActor} from '../src/forge/loadout.js';
import {createSession} from '../src/model.js';
import {execute} from '../src/engine.js';
const make=(id,category='weapon')=>applySubtype(newItem(category),id);
const worn=d=>({...instanceOf(d,'source'),equipped:true,attuned:true});
const actor=id=>({id,name:id,level:10,maxHp:100,ac:10,attacksPerAction:1,saves:{con:0,dex:0},resources:{},abilities:{},resistances:[],immunities:[],vulnerabilities:[]});
const ctx={scores:{str:20,dex:16,cha:18},level:10,proficiencies:['martial-weapons','simple-weapons']};
test('every category has contextual choices, complete 2014 weapon/armor profiles use existing schema',()=>{
 assert.equal(Object.keys(WEAPONS).length,37);assert.equal(Object.keys(ARMORS).length,12);
 for(const cat of Object.keys(categories))for(const id of Object.keys(subtypes(cat)))assertItem(make(id,cat));
 assert.throws(()=>make('plate'),/incompatible/);
});
test('warhammer selection always bludgeoning, versatile 1d10, magic once and additional fire preserved',()=>{
 const d=make('warhammer');setMagicBonus(d,2);setMagicBonus(d,2);
 const fire=effect('damage',{dice:'2d8',damageType:'fire',role:'additional'});fire.trigger='on-hit';d.effects.push(fire);
 for(const [hands,dice] of [[1,'1d8+7'],[2,'1d10+7']]){
  const w=weaponCapability(d,worn(d),{...ctx,hands});assert.equal(w.context.attackBonus,11);
  assert.equal(w.ability.effects[0].params.dice,dice);assert.equal(w.ability.effects[0].params.damageType,'bludgeoning');assert.equal(w.ability.effects[1].params.dice,'2d8');
  const result=simulateCapability(d,w.ability,{...w.context,instance:worn(d),effectRolls:{0:[5],1:[3,4]}});assert.equal(result.result.results[0].damage,19);
 }
 assert.equal(d.effects.filter(e=>e.params.stat==='attack').length,1);
});
test('Kane uses chosen Charisma at use, finesse chooses Dexterity and proficiency is not assumed',()=>{
 const d=make('longsword');setMagicBonus(d,1);
 const w=weaponCapability(d,worn(d),{...ctx,weaponAbilityOverrides:{[d.id]:'cha'},hands:2});assert.equal(w.context.attackBonus,9);assert.equal(w.ability.effects[0].params.dice,'1d10+5');
 const r=make('shortsword');setMagicBonus(r,1);const c={...ctx,scores:{str:8,dex:16,cha:20}};
 assert.equal(weaponCapability(r,worn(r),c).context.attackBonus,8);
 assert.equal(weaponCapability(r,worn(r),{...c,proficiencies:[]}).context.attackBonus,4);
 assert.ok(r.baseItem.properties.includes('light'));assert.equal(weaponContext(r,c).attackAbility,'dex');
});
test('two-handed restrictions, ammunition/ranges, fixed blowgun damage and special net without artificial damage',()=>{
 const d=make('greatsword');assert.throws(()=>weaponCapability(d,worn(d),{...ctx,hands:1}),/deux mains/);
 assert.throws(()=>weaponCapability(d,worn(d),{...ctx,availableHands:1}),/insuffisantes/);
 const bow=make('longbow');assert.equal(baseProfile(bow).params.payload.longRange,180);assert.ok(bow.baseItem.properties.includes('ammunition'));
 const gun=make('blowgun');assert.equal(weaponCapability(gun,worn(gun),ctx).ability.effects[0].params.dice,'4');
 const net=make('net');assert.equal(net.effects.filter(e=>e.params.role==='weapon-base').length,0);assert.throws(()=>weaponCapability(net,worn(net),ctx),/spéciale/);
});
test('armor Dexterity caps, plate Strength/stealth, shield +3 totals +5 exactly once in actual actor',()=>{
 for(const [id,ac] of [['leather',14],['half-plate',17],['plate',18]]){
  const d=make(id,'armor');const g=prepareForgeActor(actor('source'),[{definition:d,instance:worn(d)}],ctx);assert.equal(g.definition.ac,ac);
 }
 const armor=make('plate','armor');setMagicBonus(armor,1);const shield=make('shield','shield');setMagicBonus(shield,3);
 const entries=[armor,shield].map(d=>({definition:d,instance:worn(d)}));const g=prepareForgeActor(actor('source'),entries,ctx);assert.equal(g.definition.ac,24);
 const p=baseProfile(armor).params.payload;assert.equal(p.minimumStrength,15);assert.equal(p.stealthDisadvantage,true);
 entries[1].instance.equipped=false;assert.equal(prepareForgeActor(actor('source'),entries,ctx).definition.ac,19);
 entries[1].instance.equipped=true;entries[1].instance.active=false;assert.equal(prepareForgeActor(actor('source'),entries,ctx).definition.ac,19);
});
test('instruments and wondrous objects get no fabricated attack, their powers survive explicit selection',()=>{
 const d=newItem('wondrous'),power={id:'p',name:{fr:'Son',en:null},activation:'bonus-action',costs:[],effects:[],range:null,area:null,duration:null,save:null,prerequisites:null};d.abilities=[power];applySubtype(d,'drum');
 assert.equal(d.effects.length,0);assert.deepEqual(d.abilities,[power]);assert.throws(()=>weaponCapability(d,worn(d),ctx),/profil/);
});
test('legacy aliases resolve without changing JSON; custom values and all CC powers roundtrip intact',()=>{
 const cc=JSON.parse(fs.readFileSync('src/forge/catalog/compagnie-creole.items.json'));
 for(const d of cc){const before=structuredClone(d);resolveSubtype(d);assert.deepEqual(d,before);assert.deepEqual(parseImport(exportItems([{definition:d}]))[0].definition,before);}
 const d=newItem();d.subcategory='Marteau de guerre';assert.equal(resolveSubtype(d),'warhammer');d.subcategory='Marteau du néant';assert.equal(resolveSubtype(d),null);
 const w=make('warhammer'),extra=effect('damage',{dice:'2d8',damageType:'fire',role:'additional'});w.effects.push(extra);const before=structuredClone(w);assert.throws(()=>applySubtype(w,'dagger'),/explicite/);assert.deepEqual(w,before);applySubtype(w,'dagger',{replace:true});assert.deepEqual(w.effects.find(e=>e.id===extra.id),extra);
});
test('generated weapon reaches real combat contract, costs an action, cannot fire unequipped',()=>{
 const d=make('warhammer');setMagicBonus(d,1);const i=worn(d),g=prepareForgeActor(actor('source'),[{definition:d,instance:i}],ctx);
 const id=i.instanceId+':weapon-attack';assert.ok(g.definition.abilities[id]);assert.equal(g.definition.abilities[id].attack.bonus,10);
 const state=createSession([g.definition,actor('target')]);const command={id:'strike',type:'useAbility',actorId:'source',abilityId:id,targetIds:['target'],attackRolls:[15],effectRolls:{0:[4]}};
 const out=execute(state,command);assert.equal(out.result.results[0].damage,10);assert.equal(out.state.actors.source.economy.action,false);assert.throws(()=>execute(out.state,{...command,id:'again'}),/Action spent/);
 i.equipped=false;assert.equal(prepareForgeActor(actor('source'),[{definition:d,instance:i}],ctx).definition.abilities[id],undefined);
});
test('multiple manual magic modifiers are rejected atomically rather than silently replaced',()=>{
 const d=make('longsword');setMagicBonus(d,1);d.effects.push(effect('modifier',{stat:'damage',scope:'this-weapon',operation:'add',value:2}));const before=structuredClone(d);assert.throws(()=>setMagicBonus(d,3),/multiples/);assert.deepEqual(d,before);
});
test('legacy Hexen resolves finesse using the catalogue without replacing charges or base dice',()=>{
 const d=JSON.parse(fs.readFileSync('src/forge/catalog/compagnie-creole.items.json')).find(x=>x.name.fr==='Hexen Blade'),before=structuredClone(d);
 const w=weaponCapability(d,worn(d),{...ctx,scores:{str:8,dex:16,cha:10}});assert.equal(w.context.attackBonus,8);assert.equal(w.ability.effects[0].params.dice,'1d6+4');assert.equal(d.resources[0].maximum,5);assert.deepEqual(d,before);
});
test('declared ammunition, loading and maximum distance constraints reject invalid use',()=>{
 const d=make('light-crossbow');for(const c of [{ammunitionAvailable:false},{loadingAttackSpent:true},{distance:100}])assert.throws(()=>weaponCapability(d,worn(d),{...ctx,...c}));
});
test('Companion participant replaces ordinary equipment only in detached session; library and charges remain intact',async()=>{
 const {forgeParticipant}=await import('../src/forge/character-loadout.js');
 const character={equipment:[{kind:'weapon',equipped:true},{kind:'armor',equipped:true}]};
 const d=make('warhammer'),before=structuredClone(character);const p=forgeParticipant(character,[d],{[d.id]:{hands:2,attackAbility:'cha'}});
 assert.deepEqual(character,before);assert.equal(p.character.equipment[0].equipped,false);assert.equal(p.character.equipment[1].equipped,true);assert.equal(p.forgeItems[0].instance.ownerId,'hero');assert.equal(p.forgeItems[0].instance.attuned,false);
 assert.equal(p.forgeContext.itemContexts[d.id].attackAbility,'cha');assert.deepEqual(p.forgeItems[0].definition,d);
});
test('selected Forge weapon reaches Companion runtime with wearer stats and survives combat JSON reload',async()=>{
 const {characterFixture}=await import('../examples/characters.mjs');
 const {forgeParticipant}=await import('../src/forge/character-loadout.js');
 const {createCombat,executeCombat,runtimeOf,validateCombat}=await import('../src/character/session.js');
 const character=characterFixture('fighter'),target=characterFixture('rogue'),d=make('warhammer');setMagicBonus(d,2);
 const participant=forgeParticipant(character,[d],{[d.id]:{hands:2}}),id=participant.forgeItems[0].instance.instanceId+':weapon-attack';
 const combat=createCombat('forge-test',[participant,{instanceId:'target',character:target}]);
 assert.equal(combat.engine.actors.hero.definition.abilities[id].effects[0].damageType,'bludgeoning');
 assert.match(combat.engine.actors.hero.definition.abilities[id].effects[0].dice,/^1d10/);
 const out=executeCombat(combat,{id:'hit',type:'useAbility',actorId:'hero',abilityId:id,targetIds:['target'],attackRolls:[19],effectRolls:{0:[6]}});
 assert.ok(out.result.hit);assert.equal(runtimeOf(validateCombat(JSON.parse(JSON.stringify(out.state))),'hero').economy.action,false);
});
test('equipped shield prevents a two-handed Forge weapon from entering the executable loadout',()=>{
 const weapon=make('greatsword'),shield=make('shield','shield'),wi=worn(weapon);
 const gear=prepareForgeActor(actor('source'),[{definition:weapon,instance:wi},{definition:shield,instance:worn(shield)}],ctx);
 assert.equal(gear.definition.abilities[wi.instanceId+':weapon-attack'],undefined);assert.ok(gear.diagnostics.some(d=>d.reason?.includes('Mains')));
 const blade=make('longsword');assert.throws(()=>weaponCapability(blade,worn(blade),{...ctx,distance:3}),/portée/);
});
