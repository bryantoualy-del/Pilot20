import { suggestChoices, templateScores, draftProgression } from "./model.js";
/** Secondary choices only; this function never selects a subclass, feat or spell. */
export function recommendQuick(context, config, input) {
  const d = structuredClone(input);
  delete d.quickRecommendation;
  if (!d.quickRecommendationsAccepted) {
    if (!d.quickEdited) {
      d.scores = templateScores(d.classes[0].id);
      d.scoreMethod = "standard";
      d.scoresAreBase = true;
    }
    if (!d.backgroundId && !d.background.name) {
      const bg = context.index.list("background")[0];
      if (bg) d.backgroundId = bg.id;
    }
    if (
      !d.quickEdited &&
      d.equipment === "none" &&
      d.classes[0].id === "fighter"
    ) {
      d.equipment = "chain";
      d.shield = true;
      d.weapons ??= ["longsword"];
    }
  }
  return suggestChoices(context, config, d, { preserveIdentity: true });
}
export function quickDecisions(context, config, d) {
  const r = draftProgression(context, config, d);
  return {
    report: r,
    choices: [
      ...(r.origin?.choices ?? [])
        .filter((q) => (d.originSelections?.[q.id]?.length ?? 0) !== q.count)
        .map((q) => ({ ...q, originChoice: true })),
      ...r.choices.filter(
        (q) =>
          q.kind !== "subclass" &&
          (d.selections[q.id]?.length ?? 0) !== q.count,
      ),
    ],
  };
}
