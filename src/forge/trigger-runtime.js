/**
 * Forge event adapter. Encounter is authoritative for event timing, target identity,
 * hostile/geometry validation and final effect resolution.
 * Pure planning: no damage, resource consumption or state mutation happens here.
 * Persist returned receipt keys only after Encounter commits the effect.
 */
const TRIGGERS = new Set(['on-attack','on-hit','on-miss','on-critical','damage-taken','source-turn-start','source-turn-end','target-turn-start','target-turn-end','zone-enter','zone-leave','mode-change','rest']);
const FREQUENCIES = new Set(['per-event','once-per-turn','once-per-target-per-turn','once-per-target']);
export function planForgeTriggers({event,rules,receipts=[],turnHits=[]}) {
  if(!event || typeof event.id!=='string' || !event.id || typeof event.type!=='string' ||
     !event.sourceId || !event.turnId) throw Error('Événement Encounter incomplet');
  if(!Array.isArray(rules)||!Array.isArray(receipts)||!Array.isArray(turnHits)) throw Error('Contexte invalide');
  const used=new Set(receipts),planned=new Set(),matches=[],pending=[];
  for(const rule of rules){
    if(!rule?.id || !rule?.itemInstanceId || !TRIGGERS.has(rule.trigger) ||
       !FREQUENCIES.has(rule.frequency??'per-event')) {
      pending.push({id:rule?.id??null,reason:'Déclencheur ou fréquence à compléter'}); continue;
    }
    if(rule.trigger!==event.type)continue;
    // Target assignment and proximity must come from Encounter, never guessed from a name.
    if(rule.requireHostile && event.hostile!==true) {
      if(event.hostile===undefined)pending.push({id:rule.id,reason:'Hostilité non vérifiée par Encounter'});
      continue;
    }
    if(rule.requireInRange && event.inRange!==true) {
      if(event.inRange===undefined)pending.push({id:rule.id,reason:'Portée non vérifiée par Encounter'});
      continue;
    }
    if(rule.requireSameTargetWeaponHits){
      const [first,second]=rule.requireSameTargetWeaponHits;
      if(!event.targetId || !first || !second){pending.push({id:rule.id,reason:'Cible ou lames à préciser'});continue;}
      const hit=blade=>turnHits.some(h=>h.turnId===event.turnId && h.sourceId===event.sourceId &&
        h.targetId===event.targetId && h.weaponId===blade && h.hit===true);
      if(!hit(first)||!hit(second))continue;
    }
    const frequency=rule.frequency??'per-event';
    if(frequency!=='once-per-turn' && !event.targetId) {
      pending.push({id:rule.id,reason:'Identifiant de cible manquant'});continue;
    }
    const scope=frequency==='per-event'?event.id:
      frequency==='once-per-turn'?event.turnId:
      frequency==='once-per-target-per-turn'?event.turnId+':'+event.targetId:event.targetId;
    const receiptKey=[rule.itemInstanceId,rule.id,event.sourceId,frequency,scope].join('/');
    if(used.has(receiptKey)||planned.has(receiptKey))continue;
    planned.add(receiptKey);
    matches.push({ruleId:rule.id,itemInstanceId:rule.itemInstanceId,targetId:event.targetId??null,
      eventId:event.id,receiptKey,effects:structuredClone(rule.effects??[])});
  }
  return {matches,pending};
}
