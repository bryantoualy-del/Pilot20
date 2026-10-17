/** Presentation adapters only. The existing progression/compiler remain the rules authorities. */
import { draftProgression, compileDraft, retainDecision } from "./model.js";
export const DISCOVERY = {
  barbarian: ["melee", "protection", "simple"],
  bard: ["magic", "support", "control", "exploration"],
  cleric: ["magic", "support", "protection"],
  druid: ["magic", "control", "exploration"],
  fighter: ["melee", "ranged", "protection", "simple"],
  monk: ["melee", "control"],
  paladin: ["melee", "support", "protection"],
  ranger: ["ranged", "melee", "exploration"],
  rogue: ["melee", "ranged", "exploration", "simple"],
  sorcerer: ["magic", "control"],
  warlock: ["magic", "ranged"],
  wizard: ["magic", "control", "exploration"],
};
export function discoveryMatches(id, tags = []) {
  return tags.every((t) => DISCOVERY[id]?.includes(t));
}
/** An isolated plan; never autosaves, fills choices or approves manual content. */
export function previewDraft(
  context,
  config,
  draft,
  mutate = () => {},
  resolvedReport = null,
) {
  const plan = structuredClone(draft);
  mutate(plan);
  const report = resolvedReport ?? draftProgression(context, config, plan);
  // Review checkboxes gate persistence, not the numerical calculation. Preserve their original state.
  const calculation = { ...plan, confirmed: true };
  let compiled;
  try {
    compiled = compileDraft(context, config, calculation);
  } catch {
    compiled = null;
  }
  const stats = compiled?.valid ? compiled.stats : null;
  return {
    plan,
    report,
    stats,
    provisional: !stats,
    scores: report.scores ?? null,
    hp: report.valid ? (report.hpPreview ?? null) : null,
  };
}
export function issueStep(issue, report) {
  const q = [...(report.choices ?? []), ...(report.origin?.choices ?? [])].find(
    (q) => q.id === issue.choiceId,
  );
  if (q) {
    if (report.origin?.choices?.includes(q)) return "origin";
    if (["skill", "proficiency"].includes(q.kind)) return "skills";
    if (
      [
        "spell",
        "spellbook",
        "prepared",
        "ritual-spell",
        "spell-mastery",
        "signature-spell",
      ].includes(q.kind) &&
      !q.id.includes("magical-secrets")
    )
      return "spells";
    return "features";
  }
  if (/background/.test(issue.code)) return "background";
  if (/score|asi/.test(issue.code)) return "scores";
  if (/class|multiclass/.test(issue.code) && !/subclass/.test(issue.code))
    return "class";
  if (/subclass|optional|feature/.test(issue.code)) return "features";
  if (/origin|race|creator-name/.test(issue.code)) return "origin";
  return "summary";
}
export function diagnosticKind(issue) {
  if (
    /required-choice|origin-choice|creator-name|creator-origin|creator-background-skills/.test(
      issue.code,
    )
  )
    return "required";
  if (/custom-review/.test(issue.code)) return "review";
  if (/unavailable|disabled/.test(issue.code)) return "content";
  if (/partial|manual/.test(issue.code)) return "automation";
  if (/confirmation/.test(issue.code)) return "info";
  return "error";
}
export function comparisonPlan(draft, entry) {
  const d = structuredClone(draft);
  if (entry.type === "class" && d.classes[0].id !== entry.data.classId) {
    if (d.classes[0].subclassId) retainDecision(d, "subclass", d.classes[0].id);
    d.classes[0] = {
      id: entry.data.classId,
      level: d.classes[0].level,
      subclassId: null,
    };
  } else if (entry.type === "subclass") {
    const c = d.classes.find((c) => c.id === entry.data.classId);
    if (c && c.subclassId !== entry.id) {
      if (c.subclassId) retainDecision(d, "subclass", c.id);
      c.subclassId = entry.id;
    }
  }
  return d;
}

export function primaryAbilities(entry) {
  const d = entry?.data;
  return [
    ...new Set([
      ...(d?.casting?.ability ? [d.casting.ability] : []),
      ...(d?.multiclassPrerequisites ?? []).flatMap((group) =>
        group.map((p) => p.score),
      ),
    ]),
  ];
}
