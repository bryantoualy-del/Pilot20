/** Optional FX-facing projection of committed engine output. Does not drive rules. */
import {check} from '../character/contracts.js';
export function confirmedActionEvent(before,command,outcome) {
 check(outcome?.state?.engine&&outcome.result,'Engine outcome required');
 const s=outcome.state.engine,receipt=s.receipts[command.id];
 check(receipt&&s.revision>before.engine.revision&&!outcome.replayed,'Confirmed, new transaction required');
 const event=s.reactive?.event;
 const original=command.type==='respondDecision'&&event?.status!=='pending'?event?.plan?.command??command:command;
 const ability=before.engine.actors[original.actorId]?.definition.abilities[original.abilityId];
 return {id:before.id+':'+original.id,type:original.type,abilityId:original.abilityId??null,spellId:ability?.combat?.spell?.id??null,category:ability?.combat?.spell?'spell':ability?.combat?.weapon?'weapon':'other',damageTypes:[...new Set((ability?.effects??[]).filter(e=>e.kind==='damage').map(e=>e.damageType))],healing:(ability?.effects??[]).some(e=>e.kind==='heal'||e.kind==='tempHp'),targetIds:original.targetIds??(ability?.target==='self'?[original.actorId]:[]),confirmed:event?.status!=='pending'&&!Object.values(s.actors).some(a=>a.advanced?.pendingManual),result:structuredClone(command.type==='respondDecision'&&event?.outcome?event.outcome:outcome.result)};
}
