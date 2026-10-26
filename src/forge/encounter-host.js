/** Opt-in Encounter host boundary over the existing combat repository.
 * The transport authenticates identity; it must never copy identity from payload.
 * No second health store, character patch, or client-provided resolved damage.
 */
import {check,id,integer,keys,json} from '../character/contracts.js';
import {diceSpec} from '../model.js';
import {attackModes,saveModes} from '../rules/combat.js';
import {d20} from '../engine.js';
import {transactionView,combatView} from '../public-view.js';

/** The Companion sends only a choice. Generation and revision are host-issued. */
export function forgeActivationIntent({actionId,characterId,combatId,generation,revision,abilityId,targetIds}) {
  check(id(actionId)&&actionId.length<=65&&id(characterId)&&id(combatId)&&id(abilityId),'Forge intent identity');
  check(integer(generation)&&integer(revision),'Forge intent revision');
  check(Array.isArray(targetIds)&&targetIds.length>0&&targetIds.length<=20&&targetIds.every(id)&&new Set(targetIds).size===targetIds.length,'Forge intent targets');
  return {v:1,type:'event',event:{id:actionId,type:'forge:activate',characterId,resolutionGeneration:generation,payload:{combatId,revision,abilityId,targetIds:[...targetIds]}}};
}

/** Dice come from Encounter. The same pinned effects are then resolved by execute. */
export function rollForgeCommand(state,command,die=sides=>1+Math.floor(Math.random()*sides)) {
  const c=structuredClone(command),source=state.actors[c.actorId],a=source?.definition.abilities[c.abilityId];
  check(a,'Unknown pinned Forge ability');
  const targets=a.target==='self'?[c.actorId]:c.targetIds;
  check(targets.every(k=>Object.hasOwn(state.actors,k)),'Unknown Forge target');
  const roll=(sides,count)=>Array.from({length:count},()=>{const n=die(sides);check(integer(n,1,sides),'Invalid authoritative die');return n;});
  let critical=false;
  if(a.attack){const m=attackModes(source,state.actors[targets[0]]);c.attackRolls=roll(20,!!m.advantage===!!m.disadvantage?1:2);critical=d20(c.attackRolls,!!m.advantage,!!m.disadvantage)===20;}
  if(a.save)c.saveRolls=Object.fromEntries(targets.map(k=>{const m=saveModes(state.actors[k],a.save.ability);return [k,roll(20,!!m.advantage===!!m.disadvantage?1:2)];}));
  c.effectRolls=Object.fromEntries(a.effects.flatMap((e,i)=>{if(e.dice===undefined)return [];const d=diceSpec(e.dice);return [[i,roll(d.sides,d.count*(critical&&e.kind==='damage'?2:1))]];}));
  return c;
}

/** Construct only inside the authoritative host. Bindings are pinned at combat start.
 * `facts` is an Encounter-owned geometry/visibility provider, never client input.
 * `bindings`: { authenticatedCharacterId: { actorId, abilityIds } }.
 * No WebSocket is opened and no capability is advertised by importing this module.
 */
export function createForgeEncounterHost({repository,combatId,generation,bindings,die,facts=()=>({})}) {
  check(id(combatId)&&integer(generation),'Forge host identity');
  const pinned=structuredClone(bindings);
  for(const [key,b]of Object.entries(pinned)){check(id(key)&&id(b.actorId)&&Array.isArray(b.abilityIds)&&b.abilityIds.every(id),'Forge host binding');}
  async function load(){const s=await repository.load(combatId);check(s?.engine.mode==='encounter','Encounter combat required');return s;}
  function binding(identity){const b=pinned[identity];check(b,'Unbound Forge player');return b;}
  return {
    async sync(authenticatedCharacterId){const b=binding(authenticatedCharacterId),s=await load();return {combatId,generation,...combatView(s.engine,{role:'player',actorId:b.actorId})};},
    async activate(envelope,authenticatedCharacterId){
      json(envelope);keys(envelope,['v','type','event']);check(envelope.v===1&&envelope.type==='event','Forge envelope');
      const e=envelope.event;keys(e,['id','type','characterId','resolutionGeneration','payload']);
      const p=e.payload;keys(p,['combatId','revision','abilityId','targetIds']);
      const normalized=forgeActivationIntent({actionId:e.id,characterId:e.characterId,combatId:p.combatId,generation:e.resolutionGeneration,revision:p.revision,abilityId:p.abilityId,targetIds:p.targetIds});
      check(e.type==='forge:activate'&&e.characterId===authenticatedCharacterId,'Forge authenticated identity mismatch');
      check(p.combatId===combatId&&e.resolutionGeneration===generation,'Stale Forge combat or generation');
      const b=binding(authenticatedCharacterId);check(b.abilityIds.includes(p.abilityId),'Unbound Forge ability');
      const s=await load(),a=s.engine.actors[b.actorId]?.definition.abilities[p.abilityId];
      check(a&&!a.combat?.trigger,'Player cannot emit automatic Forge triggers');
      const prior=s.engine.receipts[e.id];let command;
      if(prior){
        command=JSON.parse(prior.fingerprint);
        check(JSON.stringify(command.forgeIntent)===JSON.stringify(normalized),'Forge intent ID collision');
      } else {
        check(p.revision===s.engine.revision,'Revision conflict');
        command=rollForgeCommand(s.engine,{id:e.id,type:'useAbility',actorId:b.actorId,abilityId:p.abilityId,targetIds:[...p.targetIds],expectedRevision:p.revision,forgeIntent:normalized},die);
        command.facts=await facts(structuredClone(s.engine),structuredClone(command));
      }
      const out=await repository.commit(combatId,command,{authority:'encounter',role:'player'});
      // ACK is emitted by the caller only after this durable commit resolves.
      // message:gm is already allowed by the RPG Connect command channel.
      const presentation=transactionView({...out,state:out.state.engine},{role:'player',actorId:b.actorId});
      return {ack:{type:'event-ack',id:e.id},command:{type:'command',characterId:authenticatedCharacterId,event:{id:e.id+':result',type:'message:gm',characterId:authenticatedCharacterId,payload:{forge:{combatId,generation,...presentation}}}}};
    },
  };
}
