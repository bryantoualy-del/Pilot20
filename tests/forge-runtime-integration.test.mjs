import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSession,serialize,deserialize} from '../src/model.js';
import {execute} from '../src/engine.js';
import {statistic,advanced,attackModes} from '../src/rules/combat.js';
import {newItem,instanceOf} from '../src/forge/model.js';
import {guidedAbility,compileCapability} from '../src/forge/automation.js';
import {prepareForgeActor} from '../src/forge/loadout.js';
import {planForgeTriggers} from '../src/forge/trigger-runtime.js';
const actor=id=>({id,name:id,level:10,maxHp:100,ac:15,attacksPerAction:2,saves:{str:0,dex:0,con:0,int:0,wis:0,cha:0},resources:{},abilities:{},resistances:[],immunities:[],vulnerabilities:[]});
const ctx={authority:'encounter',role:'gm'};
function auraSession(){
 const d=newItem(),a=guidedAbility('automatic'),i={...instanceOf(d,'brack'),instanceId:'pyro',equipped:true};d.abilities=[a];a.effects[0].params.dice='2d6';
 const triggerBinding={id:'aura',itemInstanceId:'pyro',trigger:'target-turn-start',frequency:'once-per-target-per-turn',requireHostile:true,requireInRange:true};
 const compiled=compileCapability(d,a,{instance:i,context:{triggerBinding}});assert.equal(compiled.status,'automatic');
 const b=actor('brack');b.abilities.aura=compiled.ability;
 let s=createSession([b,actor('orc'),actor('goblin')]);s.mode='encounter';
 s=execute(s,{id:'end-brack',type:'endTurn',actorId:'brack'},ctx).state;
 s=execute(s,{id:'start-orc',type:'startTurn',actorId:'orc'},ctx).state;
 const c={id:'aura-event',type:'triggerAbility',actorId:'brack',abilityId:'aura',targetIds:['orc'],event:{id:'turn-orc',sourceId:'brack',targetId:'orc',turnId:String(s.turnId),type:'target-turn-start',hostile:true,inRange:true},effectRolls:{0:[3,4]}};
 return {s,c};
}
test('authoritative aura resolves off turn after owner ended: no action, typed defenses, replay after reconnect',()=>{
 const {s,c}=auraSession();s.actors.orc.definition.resistances=['fire'];const before=structuredClone(s);
 const out=execute(s,c,ctx);assert.equal(out.result.results[0].damage,3);assert.deepEqual(out.state.actors.brack.economy,s.actors.brack.economy);assert.deepEqual(s,before);
 const restored=deserialize(serialize(out.state));assert.equal(execute(restored,c,ctx).replayed,true);
 const repeat=execute(restored,{...c,id:'different-envelope',event:{...c.event,id:'same-turn-new-id'}},ctx);assert.equal(repeat.result.skipped,true);assert.equal(repeat.state.actors.orc.hp.current,97);
 const next=execute(repeat.state,{id:'goblin-turn',type:'startTurn',actorId:'goblin'},ctx);
 const other=execute(next.state,{...c,id:'other-target',targetIds:['goblin'],event:{...c.event,turnId:String(next.state.turnId),targetId:'goblin'}},ctx);assert.equal(other.result.results[0].damage,7);
});
test('authoritative trigger fails closed on authority, player spoof, geometry, stale turn, target and invalid roll',()=>{
 const {s,c}=auraSession();const before=structuredClone(s);
 for(const context of [{},{authority:'encounter',role:'player'}])assert.throws(()=>execute(s,c,context));
 for(const event of [{...c.event,inRange:undefined},{...c.event,turnId:'900'},{...c.event,sourceId:'orc'},{...c.event,targetId:'goblin'}])assert.throws(()=>execute(s,{...c,event},ctx));
 assert.throws(()=>execute(s,{...c,effectRolls:{0:[9,3]}},ctx));assert.deepEqual(s,before);
 assert.throws(()=>execute(s,{...c,type:'useAbility'},ctx),/authoritative/);
 const friendly=execute(s,{...c,event:{...c.event,hostile:false}},ctx);assert.equal(friendly.result.skipped,true);
});
test('recovery at dawn uses pinned dice, caps, validates and deduplicates independently of envelope',()=>{
 const a=actor('rufus');a.resources.hexen={max:5,recovery:'none',recharge:{event:'dawn',formula:'1d4+1'}};
 const s=createSession([a]);s.mode='encounter';s.actors.rufus.resources.hexen=0;
 const c={id:'dawn1',type:'recoverResource',actorId:'rufus',resourceId:'hexen',event:'dawn',periodId:'day1',rolls:[4]};
 const out=execute(s,c,ctx);assert.equal(out.state.actors.rufus.resources.hexen,5);
 assert.equal(execute(out.state,{...c,id:'dawn2'},ctx).result.skipped,true);
 assert.throws(()=>execute(s,{...c,rolls:[5]},ctx));assert.throws(()=>execute(s,{...c,event:'short-rest'},ctx));assert.equal(s.actors.rufus.resources.hexen,0);
});
test('Volto mechanics: atomic bonus-action switch, AC recomputation, form-gated attack and no mode stacking',()=>{
 const item=JSON.parse(fs.readFileSync('src/forge/catalog/compagnie-creole.items.json')).find(d=>d.name.fr==='Volto-Fendoir');
 // Explicit test ruling only. Catalogue attunement stays unknown, never silently overwritten.
 item.attunement.required=false;
 const i={...instanceOf(item,'nans'),instanceId:'volto',equipped:true,modeIds:['sword']};
 const base=actor('nans');base.ac=16;
 const gear=prepareForgeActor(base,[{definition:item,instance:i}],{attackBonus:8,damageBonus:4});
 let s=createSession([gear.definition,actor('orc')]);advanced(s.actors.nans).forms=gear.forms;
 assert.equal(statistic(s.actors.nans,'ac',16),18);
 const change={id:'axe',type:'useAbility',actorId:'nans',abilityId:'volto:forme-axe',targetIds:['nans']};
 s=execute(s,change).state;assert.equal(s.actors.nans.economy.bonus,false);assert.equal(statistic(s.actors.nans,'ac',16),16);
 assert.throws(()=>execute(s,{...change,id:'second',abilityId:'volto:forme-sword'}),/Action spent/);
 const attack={id:'hit',type:'useAbility',actorId:'nans',targetIds:['orc'],attackRolls:[15],effectRolls:{0:[6]}};
 assert.throws(()=>execute(s,{...attack,abilityId:'volto:weapon-sword'}),/form inactive/);
 assert.equal(execute(s,{...attack,abilityId:'volto:weapon-axe'}).result.results[0].damage,10);
 s=execute(s,{id:'turn2',type:'startTurn',actorId:'nans'}).state;
 s=execute(s,{...change,id:'sword',abilityId:'volto:forme-sword'}).state;assert.equal(statistic(s.actors.nans,'ac',16),18);assert.equal(s.actors.nans.advanced.forms.length,1);
});
test('partial capabilities cannot execute in real combat even if their individual dice preview works',()=>{
 const d=newItem(),a=guidedAbility('damage');a.area={shape:'cone',size:9,unit:'m'};
 const compiled=compileCapability(d,a);assert.equal(compiled.status,'partial');const b=actor('brack');b.abilities.power=compiled.ability;
 assert.throws(()=>execute(createSession([b,actor('orc')]),{id:'use',type:'useAbility',actorId:'brack',abilityId:'power',targetIds:['orc'],effectRolls:{0:[4]}}),/not automatically/);
});
test('event frequency handles untargeted rests, multiple targets and distinct weapon requirement',()=>{
 const rule={id:'r',itemInstanceId:'i',trigger:'rest',frequency:'once-per-rest'};
 const event={id:'e',type:'rest',sourceId:'s',restId:'r1'};assert.equal(planForgeTriggers({event,rules:[rule]}).matches.length,1);
 assert.equal(planForgeTriggers({event:{...event,restId:undefined},rules:[rule]}).matches.length,0);
 assert.equal(planForgeTriggers({event,rules:[{...rule,requireSameTargetWeaponHits:['one','one']}]}).pending.length,1);
 for(const type of ['on-attack','on-hit','on-miss','on-critical','damage-taken','source-turn-start','source-turn-end','target-turn-start','target-turn-end','zone-enter','zone-leave','mode-change','reaction-used','short-rest','long-rest','daily-recovery'])assert.equal(planForgeTriggers({event:{...event,type},rules:[{...rule,trigger:type,frequency:'per-event'}]}).matches.length,1);
});
test('eclipse requires two real weapon hits in own turn; mark benefits only its source and expires',()=>{
 const k=actor('kentaro'),strike={name:'blade',cost:'action',attackAction:true,target:'selected',maxTargets:1,attack:{bonus:5},effects:[{kind:'damage',amount:1,damageType:'slashing'}]};
 k.abilities={sun:structuredClone(strike),moon:structuredClone(strike),seal:{name:'seal',cost:'none',target:'selected',maxTargets:1,effects:[{kind:'damage',dice:'1d8',damageType:'radiant'},{kind:'damage',dice:'1d8',damageType:'psychic'}],combat:{version:1,mode:'automatic',requirements:[],trigger:{id:'seal',itemInstanceId:'blades',trigger:'on-hit',frequency:'once-per-target-per-turn',requireOwnTurn:true,requireSameTargetWeaponHits:['sun','moon']},ongoing:[{id:'mark',stack:{key:'mark',policy:'replace',priority:0},duration:{unit:'turn',value:2,anchor:'source',boundary:'end'},modifiers:[],conditions:['attacks-from-source-advantage'],concentration:false}]}}};
 let s=createSession([k,actor('orc'),actor('ally')]);s.mode='encounter';
 const hit={id:'sun-hit',type:'useAbility',actorId:'kentaro',abilityId:'sun',targetIds:['orc'],attackRolls:[15]};
 s=execute(s,hit,ctx).state;
 const c={id:'seal1',type:'triggerAbility',actorId:'kentaro',abilityId:'seal',targetIds:['orc'],event:{id:'hit',type:'on-hit',sourceId:'kentaro',targetId:'orc',turnId:'0'},effectRolls:{0:[4],1:[5]}};
 assert.equal(execute(s,c,ctx).result.skipped,true);
 s=execute(s,{...hit,id:'moon-hit',abilityId:'moon'},ctx).state;
 const out=execute(s,{...c,id:'seal2'},ctx);s=out.state;assert.equal(out.result.results[0].damage,9);
 assert.equal(attackModes(s.actors.kentaro,s.actors.orc).advantage,true);assert.equal(attackModes(s.actors.ally,s.actors.orc).advantage,false);
 s=execute(s,{id:'end1',type:'endTurn',actorId:'kentaro'},ctx).state;assert.equal(s.actors.orc.advanced.effects.length,1);
 s=execute(s,{id:'start2',type:'startTurn',actorId:'kentaro'},ctx).state;
 s=execute(s,{id:'end2',type:'endTurn',actorId:'kentaro'},ctx).state;assert.equal(s.actors.orc.advanced.effects.length,0);
});
test('next-attack disadvantage survives turns, applies once even on miss, and succeeds/fails saves',()=>{
 const d=newItem(),a=guidedAbility('condition');a.effects[0].params.condition='next-attack-disadvantage';a.effects[0].duration={unit:'until-next-attack',value:null,endsAt:null};
 a.save={ability:'wis',dc:{kind:'fixed',value:15},success:'no-effect'};
 const src=actor('source'),target=actor('target');src.abilities.mark=compileCapability(d,a).ability;
 target.abilities.attack={name:'attack',cost:'action',target:'selected',maxTargets:1,attack:{bonus:0},effects:[{kind:'damage',amount:5,damageType:'slashing'}]};
 let s=createSession([src,target]);s=execute(s,{id:'mark',type:'useAbility',actorId:'source',abilityId:'mark',targetIds:['target'],saveRolls:{target:[1]}}).state;
 s=execute(s,{id:'turn',type:'startTurn',actorId:'target'}).state;assert.equal(s.actors.target.advanced.effects.length,1);
 const out=execute(s,{id:'miss',type:'useAbility',actorId:'target',abilityId:'attack',targetIds:['source'],attackRolls:[1,20]});assert.equal(out.result.hit,false);assert.equal(out.state.actors.target.advanced.effects.length,0);
 const success=execute(createSession([src,target]),{id:'save',type:'useAbility',actorId:'source',abilityId:'mark',targetIds:['target'],saveRolls:{target:[20]}});assert.equal(success.state.actors.target.advanced?.effects.length??0,0);
});
test('trigger receipts and effects persist atomically under concurrent commits and storage failure',async()=>{
 const {MemoryStorage}=await import('../src/persistence/adapters.js');const {combatRepository}=await import('../src/persistence/combat-repository.js');
 const {s,c}=auraSession();s.history=[];s.receipts={};s.revision=0;
 const session={kind:'combat',schemaVersion:2,id:'forge-combat',participants:Object.fromEntries(Object.keys(s.actors).map(id=>[id,{characterId:id,definitionRevision:1}])),engine:s,initiative:[],targets:[]};
 const storage=new MemoryStorage(),repo=combatRepository(storage);await repo.create(session);
 storage.failNext('quota');await assert.rejects(repo.commit(session.id,c,ctx));assert.equal((await repo.load(session.id)).engine.actors.orc.hp.current,100);
 const commits=await Promise.allSettled([repo.commit(session.id,{...c,id:'a',expectedRevision:0},ctx),repo.commit(session.id,{...c,id:'b',expectedRevision:0},ctx)]);
 assert.equal(commits.filter(r=>r.status==='fulfilled').length,1);
 const loaded=await repo.load(session.id);assert.equal(loaded.engine.actors.orc.hp.current,93);
 const duplicate=await repo.commit(session.id,{...c,id:'retry'},ctx);assert.equal(duplicate.result.skipped,true);
 assert.equal((await repo.load(session.id)).engine.actors.orc.hp.current,93);
});
test('existing executable spell contracts retain saves and consume item charges instead of slots',()=>{
 const d=newItem(),a=guidedAbility('spell');a.effects[0].params={spellId:'srd51:test',level:1,dc:{kind:'fixed',value:15},attackBonus:null};d.resources=[{id:'charges',maximum:5,unit:'charges',recovery:{formula:'1d4+1',event:'dawn',capAtMaximum:true},lastCharge:null}];a.costs=[{resourceId:'charges',amount:2,timing:'on-use'}];
 const spell={name:'test',cost:'action',target:'selected',maxTargets:1,effects:[{kind:'damage',dice:'1d6',damageType:'cold'}],save:{ability:'dex',dc:12,onSuccess:'half'},combat:{version:1,mode:'automatic',requirements:[],spell:{id:'srd51:test',classId:'item',level:1,access:'granted',available:true}}};
 const c=compileCapability(d,a,{context:{spells:{'srd51:test':spell}}});assert.equal(c.status,'automatic');assert.equal(c.ability.save.dc,15);
 const source=actor('source');source.resources.charges={max:5,recovery:'none'};source.abilities.cast=c.ability;
 const out=execute(createSession([source,actor('target')]),{id:'cast',type:'useAbility',actorId:'source',abilityId:'cast',targetIds:['target'],saveRolls:{target:[20]},effectRolls:{0:[5]}});
 assert.equal(out.state.actors.source.resources.charges,3);assert.equal(out.result.results[0].damage,2);
 assert.equal(compileCapability(d,a).status,'partial');
});
test('legacy network capabilities do not falsely certify a universal Forge connection',async()=>{
 const {forgeConnectionReadiness}=await import('../src/connect.js');
 assert.equal(forgeConnectionReadiness('brackmard',['hybrid-resolution-v4','state-revisions','event-receipts']).ready,false);
});
test('trigger results cross the existing presentation boundary without private receipts or duplicate FX',async()=>{
 const {transactionView}=await import('../src/public-view.js');const {s,c}=auraSession();const out=execute(s,c,ctx);
 const view=transactionView(out,{role:'player',actorId:'brack'});assert.equal(view.events.length,1);assert.equal(JSON.stringify(view).includes('triggerReceipt'),false);
 const duplicate=execute(out.state,{...c,id:'duplicate'},ctx);assert.equal(transactionView(duplicate,{role:'gm'}).events.length,0);
});

test('automatic damage continues through a persisted reaction without spending owner action or repeating the trigger',async()=>{
 const {answer,rule}=await import('./helpers/reactive.js');
 const {s,c}=auraSession();
 s.actors.orc.definition.rules=[rule('reduce-aura',{trigger:{version:1,event:'ability-targeted',scope:'target',limit:'none',whileEffect:null},conditions:[],options:[{id:'reduce',label:'Protection',costs:[],reaction:true,effects:[{kind:'adjust',field:'damageDivisor',amount:2}]}]})];
 const out=execute(s,c,ctx);assert.ok(out.result.pending);assert.ok(out.result.triggerReceipt);
 assert.equal(out.state.actors.orc.hp.current,100);
 const restored=deserialize(serialize(out.state));assert.equal(execute(restored,c,ctx).replayed,true);
 assert.throws(()=>execute(restored,{...c,id:'racing-trigger'},ctx),/pending/);
 const done=execute(restored,answer(restored),ctx);
 assert.equal(done.result.triggerReceipt,out.result.triggerReceipt);
 assert.equal(done.state.actors.orc.hp.current,97);assert.equal(done.state.actors.orc.economy.reaction,false);
 assert.deepEqual(done.state.actors.brack.economy,s.actors.brack.economy);
 assert.equal(execute(done.state,{...c,id:'transport-retry'},ctx).result.skipped,true);
 assert.equal(execute(done.state,answer(restored),ctx).replayed,true);
});

test('two blade hits completed after reactions qualify for the seal; provisional hits changed to misses do not',async()=>{
 const {answer,rule}=await import('./helpers/reactive.js');
 for(const preventHit of [false,true]){
  const source=actor('source'),target=actor('target');
  const strike={name:'Lame',cost:'action',attackAction:true,target:'selected',maxTargets:1,attack:{bonus:5},effects:[{kind:'damage',amount:1,damageType:'slashing'}]};
  source.abilities={sun:structuredClone(strike),moon:structuredClone(strike),seal:{name:'Sceau',cost:'none',target:'selected',maxTargets:1,effects:[{kind:'damage',amount:9,damageType:'radiant'}],combat:{version:1,mode:'automatic',requirements:[],trigger:{id:'seal',itemInstanceId:'blades',trigger:'on-hit',frequency:'once-per-target-per-turn',requireOwnTurn:true,requireSameTargetWeaponHits:['sun','moon']}}}};
  target.rules=[rule('parry',{trigger:{version:1,event:'ability-targeted',scope:'target',limit:'none',whileEffect:null},phase:'after-roll',conditions:[{fact:'attack',equals:true}],options:[{id:'choice',label:'Parade',costs:[],reaction:true,effects:[{kind:'effect',rule:{id:'defense',stack:{key:'defense',policy:'replace',priority:0},duration:{unit:'turn',value:1,anchor:'target',boundary:'start'},modifiers:[{stat:'ac',operation:'add',value:20}],conditions:[],concentration:false}}]}]})];
  let s=createSession([source,target]);
  for(const [n,abilityId]of ['sun','moon'].entries()){
   s=execute(s,{id:'strike'+n,type:'useAbility',actorId:'source',abilityId,targetIds:['target'],attackRolls:[15]}).state;
   if(s.reactive?.event?.status==='pending')s=execute(s,answer(s,preventHit?'accept':'decline')).state;
  }
  const out=execute(s,{id:'seal',type:'triggerAbility',actorId:'source',abilityId:'seal',targetIds:['target'],event:{id:'hit',type:'on-hit',sourceId:'source',targetId:'target',turnId:'0'}});
  assert.equal(out.result.skipped===true,preventHit);
  assert.equal(out.state.actors.target.hp.current,preventHit?100:89);
 }
});

test('temporary typed defenses apply once, expire, and restore underlying defenses without mutating definitions',async()=>{
 const {effect}=await import('../src/forge/model.js');
 for(const [kind,expected]of [['resistance',4],['immunity',0],['vulnerability',18]]){
  const d=newItem(),a=guidedAbility('protect');a.activation='bonus-action';
  const e=effect('defense',{kind,damageType:'fire',condition:null});e.target={kind:'self',count:1,filter:null};e.duration={unit:'turn',value:1,endsAt:'start-of-source-turn'};a.effects=[e];
  const compiled=compileCapability(d,a);assert.equal(compiled.status,'automatic');
  const source=actor('source');source.abilities.protect=compiled.ability;
  if(kind==='resistance')source.resistances=['fire'];
  let s=createSession([source,actor('enemy')]);const definition=structuredClone(s.actors.source.definition);
  s=execute(s,{id:'protect',type:'useAbility',actorId:'source',abilityId:'protect'}).state;
  let out=execute(s,{id:'fire',type:'damage',actorId:'source',amount:9,damageType:'fire'});
  assert.equal(out.result.damage,expected);
  assert.equal(execute(s,{id:'cold',type:'damage',actorId:'source',amount:9,damageType:'cold'}).result.damage,9);
  s=execute(out.state,{id:'new-turn',type:'startTurn',actorId:'source'}).state;
  assert.equal(execute(s,{id:'expired',type:'damage',actorId:'source',amount:9,damageType:'fire'}).result.damage,kind==='resistance'?4:9);
  assert.deepEqual(s.actors.source.definition,definition);
 }
});

test('source-scoped next attack disadvantage does not penalize allies and is spent on a missed attack against its source',()=>{
 const d=newItem(),a=guidedAbility('condition');a.effects[0].params.condition='next-attack-against-source-disadvantage';a.effects[0].duration={unit:'until-next-attack',value:null,endsAt:null};a.save={ability:'wis',dc:{kind:'fixed',value:15},success:'no-effect'};
 const source=actor('kentaro'),target=actor('enemy');source.abilities.mark=compileCapability(d,a).ability;
 target.abilities.attack={name:'Attaque',cost:'action',attackAction:true,target:'selected',maxTargets:1,attack:{bonus:0},effects:[{kind:'damage',amount:5,damageType:'slashing'}]};
 let s=createSession([source,target,actor('ally')]);
 s=execute(s,{id:'mark',type:'useAbility',actorId:'kentaro',abilityId:'mark',targetIds:['enemy'],saveRolls:{enemy:[1]}}).state;
 s=execute(s,{id:'enemy-turn',type:'startTurn',actorId:'enemy'}).state;
 assert.equal(attackModes(s.actors.enemy,s.actors.ally).disadvantage,false);
 s=execute(s,{id:'attack-ally',type:'useAbility',actorId:'enemy',abilityId:'attack',targetIds:['ally'],attackRolls:[1]}).state;
 assert.equal(s.actors.enemy.advanced.effects.length,1);assert.equal(attackModes(s.actors.enemy,s.actors.kentaro).disadvantage,true);
 s=execute(s,{id:'attack-source',type:'useAbility',actorId:'enemy',abilityId:'attack',targetIds:['kentaro'],attackRolls:[1,20]}).state;
 assert.equal(s.actors.kentaro.hp.current,100);assert.equal(s.actors.enemy.advanced.effects.length,0);
});
