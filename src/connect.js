import {validate,copy,requireThat as check,id} from './model.js';
export const LEGACY_IDS = ['kentaro','brackmard','samoth','nans','rufus','zephyr'];
/** Boundary only. No WebSocket, credentials, implicit fallback, or local combat mutation. */
export function connectionReadiness(characterId, capabilities = []) {
  const reasons=[];
  if (!LEGACY_IDS.includes(characterId)) reasons.push('Current RPG Connect server restricts character identifiers');
  for (const capability of ['hybrid-resolution-v4','state-revisions','event-receipts']) if (!capabilities.includes(capability)) reasons.push('Missing capability: '+capability);
  return {ready:reasons.length === 0,reasons};
}
export function healthIntent(state,{id:actionId,actorId,targetIds,amount,source,combatId}) {
  validate(state);
  check(state.mode === 'encounter' && id(actionId) && id(combatId) && Object.hasOwn(state.actors,actorId),'Connected intent context');
  check(Array.isArray(targetIds) && targetIds.length>0 && targetIds.length<=6 && new Set(targetIds).size===targetIds.length && targetIds.every(id),'Intent targets');
  check(Number.isSafeInteger(amount) && amount>0 && amount<=100000 && typeof source==='string' && source.trim(),'Intent amount/source');
  return {v:1,type:'event',event:{id:actionId,type:'heal:request',characterId:actorId,payload:{actionId,combatId,targetIds:copy(targetIds),amount,source}}};
}
// This envelope still requires transport metadata (resolutionGeneration), handshake,
// reservation/ACK/reconciliation and Encounter binding. It is NOT a live client.
