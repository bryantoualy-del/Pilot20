import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSRD} from '../src/catalog/srd51-catalog.js';
import {buildCharacter} from '../src/catalog/character-builder.js';
import {resolveProgression} from '../src/catalog/progression.js';
import {catalogRequest,catalogCharacter} from './helpers/catalog.js';
import {validateAdvancementHistory,readChoiceHistories,exportBuildPlan,importBuildPlan} from '../src/catalog/advancement.js';
import {derive} from '../src/character/derive.js';
import {createCombat,executeCombat} from '../src/character/session.js';
import {characterLibrary} from '../src/persistence/library.js';
import {MemoryStorage} from '../src/persistence/adapters.js';
const index=loadSRD(),run=(s,c)=>executeCombat(s,c).state;
function snapshots(cls,level){
 const history=[];
 for(let i=1;i<=level;i++){
  const request=catalogRequest(index,cls,{level:i}),previous=history.at(-1)?.selections??{};
  for(const [key,values] of Object.entries(previous))if(!key.endsWith(':prepared')&&request.selections[key])request.selections[key]=[...values,...request.selections[key].filter(v=>!values.includes(v))].slice(0,request.selections[key].length);
  if(cls==='wizard')request.selections['wizard:prepared']=request.selections['wizard:spellbook'].slice(0,request.selections['wizard:prepared'].length);
  history.push({classId:cls,classes:request.classes,selections:request.selections});
 }
 return history;
}
function historyRequest(cls,history){return {...catalogRequest(index,cls,{level:history.length}),selections:structuredClone(history.at(-1).selections)};}

const audit=(request,history)=>validateAdvancementHistory(index,request,history);
test('wizard history verifies 1–5 acquisition at the actual level, and rejects a premature third-level spell',()=>{
 const history=snapshots('wizard',5),request=historyRequest('wizard',history);
 assert.equal(audit(request,history).valid,true,JSON.stringify(audit(request,history).issues));
 const invalid=structuredClone(history);invalid[0].selections['wizard:spellbook'][0]='srd51:fireball';assert.equal(audit(request,invalid).valid,false);
});
test('wizard cannot swap learned book entries; approved transcription is explicit and counted once',()=>{
 let history=snapshots('wizard',3),request=historyRequest('wizard',history);
 const current=history[2],before=history[1].selections['wizard:spellbook'];
 const replacement=resolveProgression(index,request).choices.find(c=>c.id==='wizard:spellbook').options.find(id=>!current.selections['wizard:spellbook'].includes(id));
 current.selections['wizard:spellbook'][current.selections['wizard:spellbook'].indexOf(before[0])]=replacement;
 const report=audit(request,history);assert.ok(report.issues.some(i=>i.code==='spellbook-forgotten'));
 history=snapshots('wizard',3);request=historyRequest('wizard',history);
 const spell='srd51:magic-missile';request.spellbookTranscriptions=[{classId:'wizard',spellId:spell,characterLevel:3,reason:'GM confirms copied spell, cost and time.'}];
 request.selections['wizard:spellbook'].push(spell);history[2].selections['wizard:spellbook'].push(spell);
 assert.equal(audit(request,history).valid,true,JSON.stringify(audit(request,history).issues));
 assert.equal(buildCharacter(index,{...request,advancementHistory:history}).valid,true);
});
test('known-spell replacement budget is per gained class level, not per choice',()=>{
 const history=snapshots('sorcerer',3),request=historyRequest('sorcerer',history);
 const options=resolveProgression(index,request).choices.find(c=>c.id==='sorcerer:known-spells').options;
 const changed=structuredClone(history),old=changed[2].selections['sorcerer:known-spells'];
 const fresh=options.filter(id=>!old.includes(id));old[0]=fresh[0];old[1]=fresh[1];
 const r=audit({...request,selections:changed[2].selections},changed);assert.ok(r.issues.some(i=>i.code==='replacement-limit'));
 const one=structuredClone(history);one[2].selections['sorcerer:known-spells'][0]=fresh[0];
 const valid=audit({...request,selections:one[2].selections},one);assert.equal(valid.valid,true,JSON.stringify(valid.issues));
});
test('history must reach the final snapshot, and learned cantrips/ASI cannot be silently retrained',()=>{
 const history=snapshots('wizard',4),request=historyRequest('wizard',history);
 assert.equal(audit(request,history.slice(0,3)).valid,false);
 const changed=structuredClone(history);changed[3].selections['wizard:cantrips'][0]='srd51:message';
 assert.ok(audit({...request,selections:changed[3].selections},changed).issues.some(i=>i.code==='historical-choice-changed'));
 const bad=structuredClone(history);bad[1].classes[0].level=3;assert.ok(audit(request,bad).issues.some(i=>i.code==='history-class-sequence'));
});
test('verified learning deltas survive character library and build-plan export/import without schema changes',async()=>{
 const history=snapshots('wizard',5),request=historyRequest('wizard',history),r=buildCharacter(index,{...request,advancementHistory:history});
 assert.equal(r.valid,true,JSON.stringify(r.issues));assert.equal(r.history.status,'verified');
 const notes=readChoiceHistories(r.character),book=notes.find(n=>n.choiceId==='wizard:spellbook');assert.equal(book.events[0].add.length,6);assert.equal(book.events.at(-1).characterLevel,5);
 const library=characterLibrary(new MemoryStorage());await library.save(r.character);const saved=(await library.get(r.character.id)).definition;assert.deepEqual(readChoiceHistories(saved),notes);
 const plan=importBuildPlan(index,exportBuildPlan(request,history));assert.deepEqual(plan.history,history);assert.equal(saved.schemaVersion,2);
});
test('expertise cannot confer its own missing proficiency; explicit background skills are eligible',()=>{
 const req=catalogRequest(index,'rogue',{level:3});req.selections['rogue:expertise-1']=['arcana','athletics'];
 assert.equal(resolveProgression(index,req).valid,false);
 req.background={name:'Declared scholarly background',skills:['arcana'],proficiencies:[]};assert.equal(resolveProgression(index,req).valid,true);
 const r=buildCharacter(index,req);assert.equal(r.character.skills.arcana,2);
});
test('precise monk tools and conditional ranger humanoid/language selections are explicit',()=>{
 const monk=resolveProgression(index,catalogRequest(index,'monk',{level:1}));const tool=monk.choices.find(c=>c.id==='monk:tool');assert.ok(tool.options.includes('smith-tools'));assert.equal(tool.options.includes('artisan-tools'),false);
 const req=catalogRequest(index,'ranger',{level:3});req.selections['ranger:favored-enemy-1']=['srd51:ranger:two-humanoid-races'];
 let r=resolveProgression(index,req);assert.ok(r.issues.some(i=>i.choiceId==='ranger:favored-humanoids-1'));
 req.selections['ranger:favored-humanoids-1']=['humanoid:orc','humanoid:goblin'];assert.equal(resolveProgression(index,req).valid,true);
 assert.ok(r.choices.find(c=>c.id==='ranger:enemy-language-1').adjudication);
});
test('Mystic Arcanum is a real level-six spell, with no pact slot cost and one long-rest resource',()=>{
 const req=catalogRequest(index,'warlock',{level:11});req.selections['warlock:arcanum-6']=['srd51:eyebite'];const r=buildCharacter(index,req);assert.equal(r.valid,true);
 const compiled=derive(r.character).abilities['warlock:srd51:eyebite'];assert.equal(compiled.combat.spell.level,6);assert.equal(compiled.combat.spell.available,true);
 let s=createCombat('arcanum',[{instanceId:'a',character:r.character}]);s=run(s,{id:'start',type:'startTurn',actorId:'a'});
 const pact=s.engine.actors.a.resources['pact:warlock'];s=run(s,{id:'cast',type:'declareManual',actorId:'a',abilityId:'warlock:srd51:eyebite',targetIds:['a'],reason:'GM validates all spell requirements.',facts:{a:{arcanumCastingValidated:true}}});
 assert.equal(s.engine.actors.a.resources['pact:warlock'],pact);assert.equal(s.engine.actors.a.resources['warlock:arcanum-6'],0);assert.equal(s.engine.actors.a.advanced.casts[0].level,6);
});
test('wizard mastery preserves its actual level and cannot be upcast for free; signature uses a short-rest charge',()=>{
 const req=catalogRequest(index,'wizard',{level:20});req.selections['wizard:mastery-first']=['srd51:burning-hands'];
 if(!req.selections['wizard:spellbook'].includes('srd51:burning-hands'))req.selections['wizard:spellbook'][0]='srd51:burning-hands';
 if(!req.selections['wizard:prepared'].includes('srd51:burning-hands'))req.selections['wizard:prepared'][0]='srd51:burning-hands';
 const r=buildCharacter(index,req);assert.equal(r.valid,true,JSON.stringify(r.issues));const out=derive(r.character);
 assert.equal(out.abilities['wizard:srd51:burning-hands:mastery'].combat.spell.level,1);
 const signature=r.character.abilities.find(a=>a.id.endsWith(':signature'));assert.ok(signature);assert.equal(out.resources[signature.resource.id].recovery,'short');
 let s=createCombat('mastery',[{instanceId:'a',character:r.character}]);s=run(s,{id:'start',type:'startTurn',actorId:'a'});
 const command={id:'cast',type:'useAbility',actorId:'a',abilityId:'wizard:srd51:burning-hands:mastery',targetIds:['a'],saveRolls:{a:[1]},effectRolls:{0:[1,1,1]},facts:{a:{spellEligibilityValidated:true}}};
 assert.throws(()=>run(s,{...command,slotId:'slot2'}),/Slot-free/);const slots=structuredClone(s.engine.actors.a.resources);s=run(s,command);assert.deepEqual(s.engine.actors.a.resources,slots);
});
test('long casting times are explicit manual adjudications, never instant ordinary casts',()=>{
 const req=catalogRequest(index,'wizard',{level:5,spellIds:['srd51:identify']});const r=buildCharacter(index,req);assert.equal(r.valid,true);
 let s=createCombat('long-cast',[{instanceId:'a',character:r.character}]);const command={id:'cast',type:'declareManual',actorId:'a',abilityId:'wizard:srd51:identify',targetIds:['a'],slotId:'slot1',reason:'GM confirms the entire casting time elapsed.'};
 assert.throws(()=>run(s,command),/external validation/);s=run(s,{...command,facts:{a:{castingTimeAdjudicated:true}}});assert.ok(s.engine.actors.a.advanced.pendingManual);assert.equal(s.engine.actors.a.advanced.casts[0].cost,'none');assert.equal(s.engine.actors.a.advanced.casts[0].level,1);
});
test('prepared spell access never leaks between multiclass spellcasting lists',()=>{
 const classes=[{id:'wizard',level:3,subclassId:'srd51:school-of-evocation'},{id:'cleric',level:1,subclassId:'srd51:life-domain'}];
 const req=catalogRequest(index,'wizard',{classes,spellIds:['srd51:detect-magic']});
 const prepared=req.selections['wizard:prepared'];prepared[prepared.indexOf('srd51:detect-magic')]=req.selections['wizard:spellbook'].find(id=>!prepared.includes(id));
 const r=buildCharacter(index,req);assert.equal(r.valid,true,JSON.stringify(r.issues));assert.ok(r.character.spells.prepared.includes('srd51:detect-magic'));
 const out=derive(r.character);assert.equal(out.abilities['wizard:srd51:detect-magic'],undefined);assert.ok(out.abilities['cleric:srd51:detect-magic']);
});
test('interleaved multiclass history pins chronological HP and acquisition levels',()=>{
 const steps=[['fighter',1,0],['bard',1,1],['fighter',2,1],['bard',2,2],['fighter',3,2]];
 const history=steps.map(([classId,fighter,bard])=>{const classes=[{id:'fighter',level:fighter,subclassId:fighter>=3?'srd51:champion':null},...(bard?[{id:'bard',level:bard,subclassId:null}]:[])],req=catalogRequest(index,'fighter',{classes});return {classId,classes,selections:req.selections};});
 const request={...catalogRequest(index,'fighter',{classes:history.at(-1).classes}),selections:history.at(-1).selections,advancementHistory:history};
 const r=buildCharacter(index,request);assert.equal(r.valid,true,JSON.stringify(r.issues));assert.equal(r.history.status,'verified');assert.deepEqual(r.character.progression.map(p=>p.classId),steps.map(s=>s[0]));
 assert.equal(r.character.choices.find(c=>c.id==='fighter:subclass').level,5);assert.equal(r.character.choices.find(c=>c.id==='bard:known-spells').level,2);
});
test('optional casting contribution metadata represents round-up half casters without altering SRD defaults',async()=>{
 const {spellSlots}=await import('../src/character/derive.js');
 const caster={id:'private-inventor',level:5,casting:{ability:'int',progression:'half',multiclassRounding:'ceil',startsAtClassLevel:1}},wizard={id:'wizard',level:1,casting:{ability:'int',progression:'full'}};
 assert.equal(spellSlots([caster,wizard]).casterLevel,4);assert.equal(spellSlots([{...caster,casting:{ability:'int',progression:'half'}},wizard]).casterLevel,3);
 assert.equal(spellSlots([{...caster,level:1}]).resources.slot1.max,2);assert.equal(spellSlots([{...caster,level:1,casting:{ability:'int',progression:'half'}}]).resources.slot1,undefined);
});
test('manual Wild Shape consumes its declared resource and cannot silently execute automatically',()=>{
 const d=catalogCharacter(index,'druid',{level:5});let s=createCombat('shape',[{instanceId:'a',character:d}]);s=run(s,{id:'start',type:'startTurn',actorId:'a'});
 const command={id:'shape',type:'declareManual',actorId:'a',abilityId:'srd51:druid:wild-shape',reason:'GM chooses an eligible form.',facts:{a:{featureEligibilityValidated:true}}};
 assert.throws(()=>run(s,{...command,type:'useAbility'}),/not automatically/);s=run(s,command);assert.equal(s.engine.actors.a.resources['druid:wild-shape'],1);assert.equal(s.engine.actors.a.economy.action,false);
 assert.ok(s.engine.actors.a.advanced.pendingManual);s=run(s,{id:'resolve',type:'resolveManual',actorId:'a',declarationId:'shape',reason:'Alternative stat block tracked manually.',outcomes:[]});assert.equal(s.engine.actors.a.advanced.pendingManual,null);
});
test('Divine Intervention calendar cooldown is not reset by ordinary long rest',()=>{
 const d=catalogCharacter(index,'cleric',{level:10});let s=createCombat('intervention',[{instanceId:'a',character:d}]);s=run(s,{id:'start',type:'startTurn',actorId:'a'});
 s=run(s,{id:'ask',type:'declareManual',actorId:'a',abilityId:'srd51:cleric:divine-intervention',reason:'GM determines intervention result.',facts:{a:{featureEligibilityValidated:true}}});
 s=run(s,{id:'result',type:'resolveManual',actorId:'a',declarationId:'ask',reason:'Success: GM tracks seven-day cooldown.',outcomes:[]});
 s=run(s,{id:'rest',type:'rest',actorId:'a',kind:'long'});assert.equal(s.engine.actors.a.resources['cleric:divine-intervention'],0);
 s=run(s,{id:'calendar',type:'correct',actorId:'a',field:'resource',resourceId:'cleric:divine-intervention',value:1,reason:'GM confirms the cooldown elapsed.'});assert.equal(s.engine.actors.a.resources['cleric:divine-intervention'],1);
});
test('signature spell has a real level-three ledger entry and recovers its own charge on short rest',()=>{
 const d=catalogCharacter(index,'wizard',{level:20}),ability=d.abilities.find(a=>a.id.endsWith(':signature')&&a.concentration===null);
 assert.ok(ability);let s=createCombat('signature',[{instanceId:'a',character:d}]);s=run(s,{id:'start',type:'startTurn',actorId:'a'});const slots=s.engine.actors.a.resources.slot3;
 s=run(s,{id:'cast',type:'declareManual',actorId:'a',abilityId:ability.id,targetIds:['a'],reason:'GM resolves the signature spell.',facts:{a:{castingTimeAdjudicated:true}}});
 assert.equal(s.engine.actors.a.advanced.casts[0].level,3);assert.equal(s.engine.actors.a.resources.slot3,slots);assert.equal(s.engine.actors.a.resources[ability.resource.id],0);
 s=run(s,{id:'resolve',type:'resolveManual',actorId:'a',declarationId:'cast',reason:'Effect adjudicated.',outcomes:[]});s=run(s,{id:'rest',type:'rest',actorId:'a',kind:'short'});assert.equal(s.engine.actors.a.resources[ability.resource.id],1);
});
test('ritual-only acquisition offers no ordinary slot casting or uncosted generic feature copy',()=>{
 const req=catalogRequest(index,'warlock',{level:5});req.selections['warlock:pact-boon']=['srd51:warlock:pact-of-the-tome'];
 req.selections['warlock:invocations'][0]='srd51:warlock:book-of-ancient-secrets';req.selections['warlock:tome-cantrips']=['srd51:acid-splash','srd51:dancing-lights','srd51:light'];req.selections['warlock:ancient-rituals']=['srd51:identify','srd51:alarm'];
 const r=buildCharacter(index,req);assert.equal(r.valid,true,JSON.stringify(r.issues));const compiled=derive(r.character);
 assert.equal(compiled.abilities['warlock:srd51:identify'],undefined);assert.equal(compiled.abilities['srd51:identify'],undefined);assert.ok(compiled.abilities['warlock:srd51:identify:ritual']);
 let s=createCombat('ritual',[{instanceId:'a',character:r.character}]);const pact=s.engine.actors.a.resources['pact:warlock'];
 s=run(s,{id:'ritual',type:'declareManual',actorId:'a',abilityId:'warlock:srd51:identify:ritual',targetIds:['a'],reason:'GM confirms ritual completion.',facts:{a:{castingTimeAdjudicated:true,ritualEligibilityValidated:true}}});assert.equal(s.engine.actors.a.resources['pact:warlock'],pact);assert.equal(s.engine.actors.a.advanced.casts[0].level,1);
});
test('opted-in private replacement is acquired, suppresses obsolete choices/resources, and rejects ambiguity',async()=>{
 const {classCatalog,spellCatalog}=await import('../src/catalog/srd51-catalog.js'),{createCatalogIndex}=await import('../src/catalog/catalog-v3.js');
 const replacement=structuredClone(index.get('srd51:fighter:second-wind'));replacement.id='private:synthetic-recovery';replacement.name={en:'Synthetic replacement',fr:'Synthetic replacement'};replacement.source={kind:'private',document:'Synthetic compatibility test',license:'private-test',url:''};
 replacement.data.automation={status:'manual',handler:null,limits:['Synthetic manual replacement']};replacement.data.optionalClassFeature=true;replacement.data.campaignOption='synthetic-option';replacement.data.replaces=['srd51:fighter:second-wind'];replacement.data.suppressesChoices=['fighting-style'];replacement.data.suppressesResources=['second-wind'];
 const pack={kind:'catalog',schemaVersion:3,ruleset:'dnd5e-2014',id:'private:optional',items:[replacement]},load=items=>createCatalogIndex([classCatalog,spellCatalog,{...pack,items}],{enabledPackIds:[pack.id],enabledOptions:['synthetic-option']});
 const disabled=createCatalogIndex([classCatalog,spellCatalog,pack],{enabledPackIds:[pack.id]});assert.equal(resolveProgression(disabled,catalogRequest(disabled,'fighter',{level:1})).features.includes(replacement.id),false);
 const enabled=load([replacement]),req=catalogRequest(enabled,'fighter',{level:1});assert.equal(req.selections['fighter:fighting-style'],undefined);
 const report=resolveProgression(enabled,req);assert.equal(report.valid,true);assert.ok(report.features.includes(replacement.id));assert.equal(report.features.includes('srd51:fighter:second-wind'),false);assert.equal(report.resources.some(r=>r.id==='fighter:second-wind'),false);const built=buildCharacter(enabled,req);assert.equal(built.valid,true);assert.equal(derive(built.character).abilities['srd51:fighter:second-wind'],undefined);
 const second={...structuredClone(replacement),id:'private:other-recovery'};const conflict=load([replacement,second]);assert.ok(resolveProgression(conflict,req).issues.some(i=>i.code==='ambiguous-replacement'));
});
test('additive schemas validate real-level free casts, manual-time ledgers and optional casting metadata',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:Ajv}=await import('ajv/dist/2020.js');
 const ajv=new Ajv({strict:false});for(const name of ['../schemas/combat-rules-v1.schema.json','../docs/session-v1.schema.json'])ajv.addSchema(JSON.parse(await readFile(new URL(name,import.meta.url))));
 const valid=ajv.compile(JSON.parse(await readFile(new URL('../schemas/contracts-v2.schema.json',import.meta.url))));
 const warlock=catalogCharacter(index,'warlock',{level:11});assert.equal(valid(warlock),true,JSON.stringify(valid.errors));assert.equal(valid(createCombat('schema-free',[{instanceId:'a',character:warlock}])),true,JSON.stringify(valid.errors));
 const wizard=catalogCharacter(index,'wizard',{level:5,spellIds:['srd51:identify']});let s=createCombat('schema-time',[{instanceId:'a',character:wizard}]);
 s=run(s,{id:'identify',type:'declareManual',actorId:'a',abilityId:'wizard:srd51:identify',targetIds:['a'],slotId:'slot1',reason:'GM confirms time elapsed.',facts:{a:{castingTimeAdjudicated:true}}});assert.equal(valid(s),true,JSON.stringify(valid.errors));
 const synthetic=catalogCharacter(index,'wizard',{level:1});synthetic.classes[0].casting={ability:'int',progression:'half',multiclassRounding:'ceil',startsAtClassLevel:1};assert.equal(valid(synthetic),true,JSON.stringify(valid.errors));assert.equal(derive(synthetic).resources.slot1.max,2);
 const bad=structuredClone(warlock);bad.abilities.find(a=>a.combat?.spell?.slotPolicy==='free').combat.spell.slotPolicy='unknown';assert.equal(valid(bad),false);
});
