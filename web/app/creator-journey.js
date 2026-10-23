/** Presentation-only navigation; decisions retain their rule-engine IDs. */
export const JOURNEY_STAGES = Object.freeze([
  {id:'origin',fr:'Race',en:'Race'},
  {id:'class',fr:'Classe',en:'Class'},
  {id:'background',fr:'Historique',en:'Background'},
  {id:'scores',fr:'Niveau & caractéristiques',en:'Level & abilities'},
  {id:'progression',fr:'Capacités & progression',en:'Features & progression'},
  {id:'training',fr:'Maîtrises',en:'Proficiencies'},
  {id:'spells',fr:'Sorts',en:'Spells'},
  {id:'equipment',fr:'Équipement',en:'Equipment'},
  {id:'identity',fr:'Identité & portrait',en:'Identity & portrait'},
  {id:'validation',fr:'Résumé',en:'Summary'},
]);
const magic = new Set(['spell','spellbook','prepared','racial-spell']);
export function journeyStage(decision) {
  if(!decision)return 'origin';
  if(['race','subrace','human-variant'].includes(decision.kind))return 'origin';
  if(['class','background','identity','training'].includes(decision.kind))return decision.kind;
  if(['scores','hit-points'].includes(decision.kind))return 'scores';
  if(['equipment','equipment-method','equipment-choice'].includes(decision.kind))return 'equipment';
  if(decision.kind==='summary')return 'validation';
  if(magic.has(decision.choice?.kind))return 'spells';
  if(decision.choice?.kind==='expertise')return 'training';
  if(decision.kind==='origin-choice'&&decision.choice?.kind!=='feat')return 'origin';
  return 'progression';
}
export function orderJourney(decisions) {
  return decisions.map((decision,index)=>({decision,index}))
    .sort((a,b)=>JOURNEY_STAGES.findIndex(s=>s.id===journeyStage(a.decision))-
      JOURNEY_STAGES.findIndex(s=>s.id===journeyStage(b.decision))||
      (journeyStage(a.decision)==='progression'?(a.decision.choice?.level??1)-(b.decision.choice?.level??1):0)||a.index-b.index)
    .map(x=>x.decision);
}
/** Feat child choices are rendered once inside their owning feat. */
export function inlineDecision(decision,report,draft) {
  if(decision.kind!=='class-choice'||!decision.choice?.ownerId?.includes(':feat:'))return false;
  return [...Object.values(draft.selections??{}),...Object.values(draft.originSelections??{})].some(values=>values.includes(decision.choice.ownerId));
}
export function resolvedInlineDecision(decision,report,draft,ready) {
  return inlineDecision(decision,report,draft)&&ready(decision,report,draft);
}
