/** Presentation boundary, not storage or authentication. Never publish raw engine state. */
import {validate,copy,requireThat as check} from './model.js';

function audience(state,viewer) {
  check(viewer && ['gm','player'].includes(viewer.role),'Explicit viewer role required');
  check(viewer.role==='gm' || Object.hasOwn(state.actors,viewer.actorId),'Player actor required');
}
function visibleDecision(d) {
  return {id:d.id,eventId:d.eventId,actorId:d.actorId,revision:d.revision,phase:d.phase,
    status:d.status,options:d.options.map(o=>({id:o.id,label:o.label,costs:copy(o.costs)})),
    validationRequired:[...(d.validationRequired??[])]};
}
function outcome(result,viewer,sourceActorId) {
  const out={};
  for(const k of ['hit','critical','cancelled','success'])if(typeof result[k]==='boolean')out[k]=result[k];
  if((viewer.role==='gm' || viewer.actorId===sourceActorId) && typeof result.total==='number')out.total=result.total;
  if(viewer.role==='gm' && Object.hasOwn(result,'dc'))out.dc=result.dc;
  if(Array.isArray(result.results))out.results=result.results.map(r=>{
    const row={};
    for(const k of ['targetId','actorId','negated'])if(Object.hasOwn(r,k))row[k]=r[k];
    const own=viewer.role==='gm' || (r.targetId??r.actorId)===viewer.actorId;
    if(own)for(const k of ['damage','tempLost','hpLost'])if(Object.hasOwn(r,k))row[k]=r[k];
    if(r.save) {row.save={success:r.save.success};if(own)row.save.total=r.save.total;if(viewer.role==='gm')row.save.dc=r.save.dc;}
    return row;
  });
  return out;
}
/** Own private resources only; roster identity is assumed approved by the host application. */
export function combatView(state,viewer) {
  validate(state);audience(state,viewer);
  const gm=viewer.role==='gm',event=state.reactive?.event;
  return {version:1,revision:state.revision,turnId:state.turnId,activeActorId:state.activeActorId,
    actors:Object.entries(state.actors).map(([id,a])=>({id,name:a.definition.name,
      ...(gm || id===viewer.actorId?{hp:copy(a.hp),resources:copy(a.resources),economy:copy(a.economy),
        concentrationChecks:a.checks.map(q=>({id:q.id,...(gm?{dc:q.dc}:{})}))}:{})})),
    decisions:(event?.decisions??[]).filter(d=>d.status==='pending' && (gm || d.actorId===viewer.actorId)).map(visibleDecision)};
}
/** Structured presentation events for a future FX consumer; no animation or raw result spread.
 * Replayed receipts produce no new events. Undo identifies a correction, not a new attack.
 */
export function transactionView(transaction,viewer) {
  const state=transaction.state,view=combatView(state,viewer),events=[];
  if(transaction.replayed)return {view,events,replayed:true};
  const latest=state.history.at(-1),result=transaction.result;
  if(result.undone)events.push({version:1,type:'combat.transaction.undone',actionId:result.undone,revision:state.revision});
  else if(result.pending) {
    const d=view.decisions.find(d=>d.id===result.pending);
    if(d)events.push({version:1,type:'combat.decision.requested',eventId:d.eventId,decisionId:d.id,phase:d.phase,revision:state.revision});
  } else if(latest && ['useAbility','respondDecision'].includes(latest.command.type)) {
    const e=state.reactive?.event,c=latest.command;
    const sourceId=c.type==='respondDecision'?e?.actorId:c.actorId;
    const targets=c.type==='respondDecision'?e?.targetIds:c.targetIds??[sourceId];
    if(viewer.role==='gm' || sourceId===viewer.actorId || targets?.includes(viewer.actorId)) {
      events.push({version:1,type:'combat.resolution.completed',eventId:c.type==='respondDecision'?e.id:c.id,
        actionId:latest.id,sourceActorId:sourceId,targetIds:[...targets],revision:state.revision,outcome:outcome(result,viewer,sourceId)});
    }
  }
  return {view,events,replayed:false};
}
