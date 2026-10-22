/** Pilot20 approved 2014 UX journey: presentation only, no rule mutations. */
export const JOURNEY_STAGES = Object.freeze([
  {id:'origin',fr:'Origine',en:'Origin'},
  {id:'class',fr:'Classe',en:'Class'},
  {id:'scores',fr:'Caractéristiques',en:'Abilities'},
  {id:'choices',fr:'Choix',en:'Choices'},
  {id:'magic',fr:'Magie & équipement',en:'Magic & equipment'},
  {id:'validation',fr:'Validation',en:'Review'},
]);

export function journeyStage(decision) {
  if(!decision)return 'origin';
  if(['identity','race','subrace'].includes(decision.kind))return 'origin';
  if(decision.kind==='class'||decision.kind==='class-choice'&&decision.choice?.kind==='subclass')return 'class';
  if(['scores','hit-points'].includes(decision.kind))return 'scores';
  if(['equipment','equipment-method','equipment-choice'].includes(decision.kind))return 'magic';
  if(decision.kind==='summary')return 'validation';
  if(decision.kind==='class-choice'&&['spell','spellbook','prepared'].includes(decision.choice?.kind))return 'magic';
  return 'choices';
}

/** Stable sort keeps every conditional rule decision, only regrouping their UI order. */
export function orderJourney(decisions) {
  return decisions.map((decision,index)=>({decision,index}))
    .sort((a,b)=>JOURNEY_STAGES.findIndex(s=>s.id===journeyStage(a.decision))-
      JOURNEY_STAGES.findIndex(s=>s.id===journeyStage(b.decision))||a.index-b.index)
    .map(x=>x.decision);
}

/** Optional duplicate steps are bypassed only if the actual rules resolver accepts them. */
export function resolvedInlineDecision(decision,report,draft,ready) {
  const inlineFeat=decision.kind==='class-choice'&&Object.values(draft.selections??{}).some(values=>values.includes(decision.choice?.ownerId))&&decision.choice?.ownerId?.includes(':feat:');
  return (inlineFeat||decision.kind==='subrace'||decision.kind==='class-choice'&&decision.choice?.kind==='subclass')
    && ready(decision,report,draft);
}
