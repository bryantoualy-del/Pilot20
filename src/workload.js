/** Deterministic circuit breakers, not device-performance predictions or history eviction. */
export const WORKLOAD_LIMITS=Object.freeze({historyWarning:250,historyStop:1000,receiptWarning:1000,receiptStop:5000,unitsWarning:20000,unitsStop:100000});
export function workloadStatus(state) {
  const history=state.history?.length??0,receipts=Object.keys(state.receipts??{}).length;
  const actorUnits=Object.values(state.actors??{}).reduce((n,a)=>n+1+Object.keys(a?.definition?.abilities??{}).length+
    (a?.definition?.rules?.length??0)+(a?.advanced?.effects?.length??0)+(a?.advanced?.tokens?.length??0),0);
  const units=actorUnits*(history+1),l=WORKLOAD_LIMITS;
  const warnings=[];
  if(history>=l.historyWarning)warnings.push('history');
  if(receipts>=l.receiptWarning)warnings.push('receipts');
  if(units>=l.unitsWarning)warnings.push('snapshot-work');
  return {history,receipts,units,warnings,blocked:history>=l.historyStop || receipts>=l.receiptStop || units>=l.unitsStop};
}
/** Check before recursively validating or cloning an oversized transaction input.
 * Existing receipts still go through normal validation/collision checks. Undo remains available.
 * A pending answer must remain possible even at a limit; after closing, new work is blocked.
 */
export function guardWorkload(state,command) {
  if(!state || !Array.isArray(state.history) || !state.receipts || !state.actors)return;
  const recovery=command?.type==='undo' || command?.type==='respondDecision' && state.reactive?.event?.status==='pending';
  if(recovery || Object.hasOwn(state.receipts,command?.id??''))return;
  if(workloadStatus(state).blocked)throw Error('Session workload limit: export/archive this session before starting new work; undo and pending decisions remain available');
}
