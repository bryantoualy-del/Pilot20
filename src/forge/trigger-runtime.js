/** Pure planner. Only Encounter supplies authoritative events/geometry. Receipts
 * are committed with effects by src/engine.js, never at planning time. */
export const TRIGGERS = new Set(['on-attack','on-hit','on-miss','on-critical','damage-taken','source-turn-start','source-turn-end','target-turn-start','target-turn-end','zone-enter','zone-leave','mode-change','reaction-used','rest','short-rest','long-rest','daily-recovery']);
export const FREQUENCIES = new Set(['per-event','per-attack','once-per-turn','once-per-target-per-turn','once-per-target','once-per-rest']);
const identity = x => typeof x === 'string' && x.length > 0 && x.length <= 120;
export function validTriggerRule(r) {
  return !!r && identity(r.id) && identity(r.itemInstanceId) && TRIGGERS.has(r.trigger) &&
    FREQUENCIES.has(r.frequency ?? 'per-event') &&
    ['requireHostile','requireInRange','requireOwnTurn'].every(k=>r[k]===undefined || typeof r[k]==='boolean') &&
    (r.sourceId===undefined || identity(r.sourceId)) &&
    (r.requireSameTargetWeaponHits===undefined || Array.isArray(r.requireSameTargetWeaponHits) && r.requireSameTargetWeaponHits.length===2 && r.requireSameTargetWeaponHits.every(identity) && new Set(r.requireSameTargetWeaponHits).size===2);
}
export function planForgeTriggers({event,rules,receipts=[],turnHits=[]}) {
  if(!event || !identity(event.id) || !TRIGGERS.has(event.type) || !identity(event.sourceId)) throw Error('Événement Encounter incomplet');
  if(!Array.isArray(rules)||!Array.isArray(receipts)||!Array.isArray(turnHits)) throw Error('Contexte invalide');
  const used=new Set(receipts),planned=new Set(),matches=[],pending=[];
  for(const rule of rules){
    const defer=reason=>pending.push({id:rule?.id??null,reason});
    if(!validTriggerRule(rule)){defer('Déclencheur ou fréquence à compléter');continue;}
    if(rule.trigger!==event.type || rule.sourceId && rule.sourceId!==event.sourceId)continue;
    if(rule.requireOwnTurn && event.activeActorId!==event.sourceId){if(!event.activeActorId)defer('Tour du porteur non vérifié');continue;}
    let denied=false;
    for(const [flag,field,label] of [['requireHostile','hostile','Hostilité'],['requireInRange','inRange','Portée']]){
      if(rule[flag] && event[field]!==true){if(typeof event[field]!=='boolean')defer(label+' non vérifiée par Encounter');denied=true;}
    }
    if(denied)continue;
    if(rule.requireSameTargetWeaponHits){
      if(!identity(event.targetId)||!identity(event.turnId)){defer('Cible ou tour manquant');continue;}
      if(!rule.requireSameTargetWeaponHits.every(blade=>turnHits.some(h=>h.turnId===event.turnId && h.sourceId===event.sourceId && h.targetId===event.targetId && h.weaponId===blade && h.hit===true)))continue;
    }
    const frequency=rule.frequency??'per-event';
    let scope;
    if(frequency==='per-event')scope=[event.id,event.targetId??null];
    if(frequency==='per-attack')scope=[event.attackId,event.targetId??null];
    if(frequency==='once-per-turn')scope=[event.turnId];
    if(frequency==='once-per-target-per-turn')scope=[event.turnId,event.targetId];
    if(frequency==='once-per-target')scope=[event.targetId];
    if(frequency==='once-per-rest')scope=[event.restId];
    if(scope.some(x=>x!==null&&!identity(x))){defer('Identifiant de cible, tour, attaque ou repos manquant');continue;}
    // Structured encoding prevents delimiter collisions; per-event includes target
    // so an AoE event does not suppress the second creature.
    const receiptKey=JSON.stringify([rule.itemInstanceId,rule.id,event.sourceId,frequency,scope]);
    if(used.has(receiptKey)||planned.has(receiptKey))continue;
    planned.add(receiptKey);
    matches.push({ruleId:rule.id,itemInstanceId:rule.itemInstanceId,targetId:event.targetId??null,eventId:event.id,receiptKey,effects:structuredClone(rule.effects??[])});
  }
  return {matches,pending};
}
