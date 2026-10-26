import test from 'node:test';
import assert from 'node:assert/strict';
import {planForgeTriggers} from '../src/forge/trigger-runtime.js';
const evt={id:'evt1',type:'target-turn-start',sourceId:'brack',targetId:'orc',turnId:'turn12',hostile:true,inRange:true};
const aura={id:'aura',itemInstanceId:'pyromerlin-1',trigger:'target-turn-start',frequency:'once-per-target-per-turn',requireHostile:true,requireInRange:true,effects:[{kind:'damage',dice:'2d6',type:'fire'}]};
test('PyroMerlin: aura plans once per hostile target and turn, with no action cost',()=>{
 const first=planForgeTriggers({event:evt,rules:[aura,aura]});
 assert.equal(first.matches.length,1);assert.equal(first.matches[0].effects[0].dice,'2d6');
 const again=planForgeTriggers({event:{...evt,id:'evt2'},rules:[aura],receipts:[first.matches[0].receiptKey]});
 assert.equal(again.matches.length,0);
 assert.equal(planForgeTriggers({event:{...evt,turnId:'turn13'},rules:[aura],receipts:[first.matches[0].receiptKey]}).matches.length,1);
});
test('Unknown proximity and hostility are never assumed',()=>{
 const {matches,pending}=planForgeTriggers({event:{...evt,inRange:undefined},rules:[aura]});
 assert.equal(matches.length,0);assert.match(pending[0].reason,/Portée/);
});
test('Eclipse seal triggers only when both distinct blades hit same target in same turn',()=>{
 const rule={id:'eclipse',itemInstanceId:'kentaro-dual',trigger:'on-hit',frequency:'once-per-target-per-turn',requireSameTargetWeaponHits:['solinar','selhane'],effects:[{kind:'damage',dice:'1d8',type:'radiant'},{kind:'damage',dice:'1d8',type:'psychic'}]};
 const e={...evt,type:'on-hit',sourceId:'kentaro',targetId:'enemy'};
 const hits=[{turnId:'turn12',sourceId:'kentaro',targetId:'enemy',weaponId:'solinar',hit:true}];
 assert.equal(planForgeTriggers({event:e,rules:[rule],turnHits:hits}).matches.length,0);
 hits.push({...hits[0],weaponId:'selhane'});
 assert.equal(planForgeTriggers({event:e,rules:[rule],turnHits:hits}).matches.length,1);
 assert.equal(planForgeTriggers({event:e,rules:[rule],turnHits:[...hits,{...hits[1],targetId:'other'}]}).matches.length,1);
});
test('Missing target and unknown frequency fail closed',()=>{
 assert.equal(planForgeTriggers({event:{...evt,targetId:undefined},rules:[aura]}).matches.length,0);
 assert.equal(planForgeTriggers({event:evt,rules:[{...aura,frequency:'every-frame'}]}).pending.length,1);
});
