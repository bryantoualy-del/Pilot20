import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {reactiveCharacter} from './reactive-characters.mjs';
import {ability} from './characters.mjs';
import {profile} from './advanced-characters.mjs';
import {createCombat,executeCombat,validateCombat} from '../src/character/session.js';
import {serialize,deserialize,diceSpec} from '../src/model.js';
import {pendingDecisions} from '../src/rules/reactive.js';
import {SRD,HOMEBREW} from '../src/catalog/srd51.js';
export function runReactiveDemo() {
 const rows=['Pilot20 V0.2b.3 — deterministic five-round mechanic demonstration.',
 'Synthetic class fixtures, five durable adversaries. Explicit external eligibility facts.',
 'Agathys: temp-HP primitive demonstrated; retaliation NOT automated. Nested Counterspell: manual.',
 'No full official spell/class automation, positioning, UI or network simulation.'];
 const classes=['sorcerer','bard','fighter','rogue','paladin','barbarian','warlock'];
 const participants=classes.map(id=>({instanceId:id,character:reactiveCharacter(id)}));
 const warlock=participants.find(p=>p.instanceId==='warlock').character;warlock.spells.known.push('ward');warlock.abilities.push(ability('ward',{kind:'spell',target:'self',effects:[{kind:'tempHp',amount:20}],combat:profile({spell:{id:'ward',classId:'warlock',level:1,access:'known'}}),source:HOMEBREW}));
 for(let i=0;i<5;i++){const character=reactiveCharacter('fighter');character.reactiveRules=[];character.modifiers.push({id:'durable-demo-target',stat:'maxHp',operation:'set',value:500,reason:'Durable target for five rounds of deterministic mechanics',source:HOMEBREW});participants.push({instanceId:'enemy'+i,character});}
 let state=createCombat('reactive-demo',participants),sequence=0,round=0,saved=false,declined=false,defended=false,postHit=false;
 function execute(c) {if(c.type==='useAbility')c={...c,facts:Object.fromEntries(Object.keys(state.engine.actors).map(id=>[id,{hostileSpell:false,...c.facts?.[id]}]))};const out=executeCombat(state,{id:'demo'+ ++sequence,...c});state=out.state;return out;}
 function resolveWindows() {
  for(let count=0;pendingDecisions(state.engine).length;count++) {
   assert.ok(count<30,'bounded demo decisions');const d=pendingDecisions(state.engine)[0];
   if(!saved && round===2 && d.actorId==='rogue') {const before=JSON.stringify(state);state=validateCombat({...JSON.parse(before),engine:deserialize(serialize(state.engine))});assert.equal(JSON.stringify(state),before);rows.push('SAVE/RELOAD while '+d.id+' pending: same event/resources/continuation.');saved=true;}
   const refuse=d.ruleId==='uncanny-dodge' || d.ruleId==='shield' && round===4;
   const optionId=d.options[0].id,source=state.engine.actors[d.actorId],r=source.definition.rules?.find(r=>r.id===d.ruleId),o=r?.options.find(o=>o.id===optionId),rolls={};
   if(o)for(const [i,op] of o.effects.entries())if(op.kind==='damage'){const spec=diceSpec(op.dice);rolls[i]=Array(spec.count*(state.engine.reactive.event.plan.critical?2:1)).fill(2);}
   else if(op.kind==='rollAdjustment')rolls[i]=[2];
   if(!r)rolls[0]=[4];
   const out=execute({type:'respondDecision',actorId:d.actorId,decisionId:d.id,decisionRevision:d.revision,expectedRevision:state.engine.revision,choice:refuse?'decline':'accept',optionId,rolls,checkRolls:[18]});
   rows.push('DECISION '+d.actorId+' '+d.ruleId+' '+(refuse?'DECLINED':'ACCEPTED')+' => '+JSON.stringify(out.result));
   declined ||=refuse;defended ||=d.ruleId==='shield' && !refuse;postHit ||=d.ruleId.startsWith('divine-smite') && !refuse;
  }
 }
 function command(c) {const out=execute(c);rows.push(c.type+' '+(c.actorId??'')+' '+(c.abilityId??'')+' => '+JSON.stringify(out.result));resolveWindows();return out;}
 const turn=actorId=>{
  command({type:'startTurn',actorId});const a=state.engine.actors[actorId];
  for(const q of [...a.checks])command({type:'concentrationSave',actorId,checkId:q.id,rolls:[20]});
 };
 function weapon(actorId,targetId,extra={}) {return command({type:'useAbility',actorId,abilityId:'blade',targetIds:[targetId],attackRolls:[15],effectRolls:{0:[4]},facts:{[actorId]:{hostileTarget:true,fiendOrUndead:false},[targetId]:{attackerVisible:true,canCastShield:true,reactionSpellUnopposed:true}},...extra});}
 for(round=1;round<=5;round++) {
  rows.push('\nROUND '+round);
  turn('sorcerer');
  if(round===1)command({type:'useAbility',actorId:'sorcerer',abilityId:'haste',targetIds:['fighter'],slotId:'slot3'});
  else if(round===2 || round===3)command({type:'useAbility',actorId:'sorcerer',abilityId:'fireball',targetIds:['enemy0','enemy1','enemy2','enemy3','enemy4'],slotId:'slot3',castingModifiers:[round===2?'quickened':'heightened'],...(round===3?{modifierTargets:{heightened:'enemy0'}}:{}),effectRolls:{0:Array(8).fill(3)},saveRolls:{enemy0:round===3?[19,1]:[20],enemy1:[1],enemy2:[20],enemy3:[1],enemy4:[20]}});
  else command({type:'useAbility',actorId:'sorcerer',abilityId:'cantrip',targetIds:['enemy0'],attackRolls:[15]});
  turn('bard');if(round===1)command({type:'useAbility',actorId:'bard',abilityId:'inspire',targetIds:['rogue'],facts:{rogue:{within60ft:true,canHear:true}}});else weapon('bard','enemy1');
  turn('fighter');weapon('fighter','enemy0');weapon('fighter','enemy0');
  if(round===1){command({type:'useAbility',actorId:'fighter',abilityId:'action-surge'});weapon('fighter','enemy0',{budget:'extra'});weapon('fighter','enemy0',{budget:'extra'});}
  const haste=state.engine.actors.fighter.advanced.effects.find(e=>e.rule.actionGrant);if(haste)weapon('fighter','enemy0',{budget:haste.id});
  turn('rogue');weapon('rogue','enemy1',{advantage:true,attackRolls:[15,16],facts:{rogue:{hostileTarget:true}}});
  turn('paladin');weapon('paladin','enemy2');
  turn('barbarian');if(round===1)command({type:'useAbility',actorId:'barbarian',abilityId:'rage',facts:{barbarian:{notHeavyArmor:true}}});weapon('barbarian','enemy3');
  turn('warlock');if(round===1)command({type:'useAbility',actorId:'warlock',abilityId:'ward',slotId:'pact:warlock'});else command({type:'useAbility',actorId:'warlock',abilityId:'cantrip',targetIds:['enemy4'],attackRolls:[15]});
  turn('enemy4');weapon('enemy4',round===2?'rogue':'sorcerer',{attackRolls:[7]});
  rows.push('STATE '+JSON.stringify(Object.fromEntries(Object.entries(state.engine.actors).map(([id,a])=>[id,{hp:a.hp,resources:a.resources,reaction:a.economy.reaction,concentration:a.concentration?.effectId??null,stance:a.advanced?.stance?.rule.id??null}]))));
 }
 assert.ok(saved && declined && defended && postHit);assert.equal(pendingDecisions(state.engine).length,0);assert.equal(state.engine.actors.warlock.hp.temp,20);assert.ok(state.engine.actors.enemy0.hp.current<500);
 rows.push('\nPASS: five rounds, seven classes, five adversaries, defensive reaction, post-hit cost, Haste, Rage, transfer, both casting modifiers, refusal, pending JSON resume.');
 return {state,transcript:rows.join('\n')+'\n',proof:{rounds:5,classes,adversaries:5,saved,declined,defended,postHit}};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
 const {transcript}=runReactiveDemo(),path=new URL('../docs/V0.2b.3-DEMO.txt',import.meta.url);
 if(process.argv.includes('--write'))writeFileSync(path,transcript);
 else if(process.argv.includes('--check'))assert.equal(readFileSync(path,'utf8'),transcript,'Regenerate reactive demonstration');
 else process.stdout.write(transcript);
}
