import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession} from '../src/model.js';
import {MemoryStorage} from '../src/persistence/adapters.js';
import {combatRepository} from '../src/persistence/combat-repository.js';
import {createForgeEncounterHost,forgeActivationIntent} from '../src/forge/encounter-host.js';
const actor=id=>({id,name:id,level:10,maxHp:100,ac:15,attacksPerAction:2,saves:{con:0,dex:0},resources:{},abilities:{},resistances:[],immunities:[],vulnerabilities:[]});
async function fixture(){
 const a=actor('brack'),target=actor('enemy');a.resources.charges={max:1,recovery:'long'};
 a.abilities.breath={name:'Souffle',cost:'action',target:'selected',maxTargets:2,resource:{id:'charges',amount:1},effects:[{kind:'damage',dice:'6d6',damageType:'fire'}],save:{ability:'dex',dc:16,onSuccess:'half'},combat:{version:1,mode:'automatic',requirements:[]}};
 target.resistances=['fire'];const engine=createSession([a,target]);engine.mode='encounter';
 const session={kind:'combat',schemaVersion:2,id:'fight',participants:{brack:{characterId:'brackmard',definitionRevision:1},enemy:{characterId:'enemy',definitionRevision:1}},engine,initiative:[],targets:[]};
 const storage=new MemoryStorage(),repository=combatRepository(storage);await repository.create(session);
 let rolls=0;const options={repository,combatId:'fight',generation:3,bindings:{brackmard:{actorId:'brack',abilityIds:['breath']}},die:sides=>{rolls++;return sides===20?20:3;}};
 const host=createForgeEncounterHost(options),intent=forgeActivationIntent({actionId:'breath1',characterId:'brackmard',combatId:'fight',generation:3,revision:0,abilityId:'breath',targetIds:['enemy']});
 return {storage,repository,host,intent,options,rolls:()=>rolls};
}
test('Encounter host resolves pinned intent with authoritative dice and persisted charge, reconnect returns current private view without reroll',async()=>{
 const f=await fixture(),out=await f.host.activate(f.intent,'brackmard');
 assert.equal(out.ack.id,'breath1');assert.equal(out.command.event.type,'message:gm');
 let state=await f.repository.load('fight');assert.equal(state.engine.actors.enemy.hp.current,96);assert.equal(state.engine.actors.brack.resources.charges,0);assert.equal(state.engine.actors.brack.economy.action,false);
 const count=f.rolls(),reconnected=createForgeEncounterHost(f.options),again=await reconnected.activate(f.intent,'brackmard');
 assert.equal(f.rolls(),count);assert.equal(again.command.event.payload.forge.replayed,true);assert.deepEqual(again.command.event.payload.forge.events,[]);
 const view=await reconnected.sync('brackmard');assert.equal(view.actors.find(a=>a.id==='enemy').hp,undefined);assert.equal(JSON.stringify(out).includes('triggerReceipt'),false);assert.equal(JSON.stringify(out).includes('forgeIntent'),false);
});
test('Encounter host rejects forged identity, client damage, stale generation/revision and colliding intent IDs',async()=>{
 const f=await fixture();await assert.rejects(f.host.activate(f.intent,'rufus'));
 for(const edit of [x=>x.event.payload.amount=999,x=>x.event.resolutionGeneration=2,x=>x.event.payload.revision=1,x=>x.event.payload.abilityId='forged']){
  const x=structuredClone(f.intent);edit(x);await assert.rejects(f.host.activate(x,'brackmard'));
 }
 assert.equal((await f.repository.load('fight')).engine.revision,0);
 await f.host.activate(f.intent,'brackmard');const collision=structuredClone(f.intent);collision.event.payload.targetIds=['brack'];await assert.rejects(f.host.activate(collision,'brackmard'),/collision/);
});
test('Encounter host emits no ACK on storage failure and concurrent intentions commit only once',async()=>{
 const f=await fixture();f.storage.failNext('quota');await assert.rejects(f.host.activate(f.intent,'brackmard'));assert.equal((await f.repository.load('fight')).engine.actors.enemy.hp.current,100);
 const other=structuredClone(f.intent);other.event.id='breath2';
 const result=await Promise.allSettled([f.host.activate(f.intent,'brackmard'),f.host.activate(other,'brackmard')]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await f.repository.load('fight')).engine.actors.enemy.hp.current,96);
});
