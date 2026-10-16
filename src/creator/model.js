import {
  EQUIPMENT,
  WEAPONS,
  weaponProfile,
  SRD_SOURCE,
} from "../catalog/equipment.js";
export { EQUIPMENT } from "../catalog/equipment.js";
import { check, ABILITIES, SKILLS } from "../character/contracts.js";
import { resolveProgression } from "../catalog/progression.js";
import {
  buildCampaignCharacter,
  validateSavedPlan,
} from "../campaign/sources.js";
import {
  derive,
  averageHpProgression,
  hitPointTotal,
} from "../character/derive.js";
import { validateCharacter, validateBuild } from "../character/definition.js";
export const newDraft = (campaignId = "default", id = crypto.randomUUID()) => ({
  kind: "pilot20-creator-draft",
  schemaVersion: 1,
  id,
  campaignId,
  revision: 1,
  mode: "quick",
  name: "",
  portrait: "",
  classes: [{ id: "fighter", level: 1, subclassId: null }],
  scores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  selections: {},
  background: { name: "", skills: [], proficiencies: [] },
  origin: "",
  languages: "",
  traits: "",
  description: "",
  equipment: "none",
  shield: false,
  reviewed: false,
  confirmed: false,
  step: "origin",
  scoresAreBase: true,
  scoreMethod: "manual",
  originSelections: {},
  finalized: false,
  status: "draft",
  advancementHistory: [],
});
const customSource = {
  kind: "homebrew",
  document: "Player declared origin and equipment; GM reviewed",
  license: "user-data",
  url: "",
};
export function buildRequest(d) {
  return {
    raceId: d.raceId ?? null,
    subraceId: d.subraceId ?? null,
    backgroundId: d.backgroundId ?? null,
    originSelections: structuredClone(d.originSelections ?? {}),
    originAdjustments: structuredClone(d.originAdjustments ?? {}),
    scoresAreBase: d.scoresAreBase ?? false,
    scoreMethod: d.scoreMethod ?? "manual",
    scoreRolls: d.scoreRolls ?? null,
    id: d.id,
    name: d.name,
    sourceReferences: structuredClone(d.sourceReferences ?? []),
    classes: structuredClone(d.classes),
    scores: structuredClone(d.scores),
    selections: structuredClone(d.selections),
    background: structuredClone(d.background),
    advancementHistory: structuredClone(d.advancementHistory ?? []),
  };
}
export function draftProgression(context, config, d) {
  const unavailable = validateSavedPlan(context, d);
  if (unavailable.issues.some((i) => i.code === "unavailable-class"))
    return { ...unavailable, choices: [], features: [], resources: [] };
  try {
    const report = resolveProgression(context.index, {
      ...buildRequest(d),
      classes: d.classes.map((c) => ({
        ...c,
        subclassId:
          context.index.get(c.subclassId) &&
          c.level >= (context.index.class(c.id)?.data.subclassLevel ?? 99)
            ? c.subclassId
            : null,
      })),
      campaignOptions: config.enabledOptions,
    });
    return {
      ...report,
      hpPreview:
        hitPointTotal(
          averageHpProgression(
            d.classes.map((c) => ({
              ...c,
              hitDie: context.index.class(c.id).data.hitDie,
            })),
          ),
          report.scores,
        ) +
        (report.origin?.hpPerLevel ?? 0) *
          d.classes.reduce((n, c) => n + c.level, 0),
      valid:
        report.valid &&
        unavailable.valid &&
        !d.classes.some(
          (c) =>
            c.subclassId &&
            c.level < (context.index.class(c.id)?.data.subclassLevel ?? 99),
        ),
      issues: [
        ...unavailable.issues,
        ...report.issues,
        ...d.classes
          .filter(
            (c) =>
              c.subclassId &&
              c.level < (context.index.class(c.id)?.data.subclassLevel ?? 99),
          )
          .map((c) => ({ code: "inactive-subclass", id: c.subclassId })),
      ],
    };
  } catch {
    return {
      valid: false,
      issues: [{ code: "invalid-build" }],
      choices: [],
      features: [],
      resources: [],
    };
  }
}
/** UI orchestration only: all progression and statistics are produced by existing authorities. */
export function compileDraft(context, config, d) {
  const issues = [];
  if (!d.name.trim()) issues.push({ code: "creator-name" });
  if (
    (!d.raceId && !d.origin.trim()) ||
    (!d.backgroundId && !d.background.name.trim())
  )
    issues.push({ code: "creator-origin" });
  if (!d.backgroundId && d.background.skills.length !== 2)
    issues.push({ code: "creator-background-skills" });
  if (!d.confirmed) issues.push({ code: "creator-confirmation" });
  let r;
  try {
    r = buildCampaignCharacter(context, buildRequest(d), config);
  } catch {
    r = {
      valid: false,
      character: null,
      issues: [{ code: "invalid-build" }],
      manualRequirements: [],
    };
  }
  issues.push(...r.issues);
  if (!r.character || issues.length)
    return { ...r, valid: false, character: null, issues, status: "draft" };
  const c = r.character;
  if ((d.customOriginRequiresReview || d.background.customized) && !d.reviewed)
    issues.push({ code: "creator-custom-review" });
  if (issues.length)
    return { ...r, valid: false, character: null, issues, status: "draft" };
  c.identity = {
    name: d.name,
    portrait: d.portrait,
    description: [
      d.description,
      d.origin,
      d.languages,
      d.traits,
      d.equipmentNotes,
      d.background.feature,
    ]
      .filter(Boolean)
      .join("\n"),
  };
  if (!d.raceId)
    c.ancestry = {
      id: "user:custom-origin",
      subraceId: null,
      source: customSource,
    };
  if (d.equipment !== "none") {
    check(Object.hasOwn(EQUIPMENT, d.equipment), "Equipment profile");
    c.equipment.push({
      id: "user:armor",
      kind: "armor",
      equipped: true,
      armor: structuredClone(EQUIPMENT[d.equipment]),
      weapon: null,
      source: customSource,
    });
  }
  if (d.shield)
    c.equipment.push({
      id: "user:shield",
      kind: "shield",
      equipped: true,
      armor: { base: 2, dexCap: 0, bonus: 0, minStrength: 0, heavy: false },
      weapon: null,
      source: customSource,
    });
  for (const id of d.weapons ?? []) {
    check(WEAPONS[id], "Unknown weapon");
    c.equipment.push({
      id: "srd51:weapon:" + id,
      kind: "weapon",
      equipped: true,
      armor: null,
      weapon: weaponProfile(id, c.scores, c.proficiencies),
      source: SRD_SOURCE,
    });
  }
  validateCharacter(c);
  check(validateBuild(c).valid, "Creator modifiers invalid");
  const stats = derive(c);
  return {
    ...r,
    character: c,
    stats,
    valid: true,
    issues: [],
    status: d.reviewed ? "ready" : "review",
    manualRequirements: [
      ...(r.manualRequirements ?? []),
      {
        reason:
          "Origin traits, final ability scores, background, equipment proficiency and historical acquisition require explicit GM review.",
      },
    ],
  };
}
const priorities = {
  fighter: ["str", "con", "dex", "wis", "int", "cha"],
  barbarian: ["str", "con", "dex", "wis", "cha", "int"],
  rogue: ["dex", "con", "cha", "wis", "int", "str"],
  bard: ["cha", "dex", "con", "wis", "int", "str"],
  wizard: ["int", "con", "dex", "wis", "cha", "str"],
  cleric: ["wis", "con", "str", "dex", "cha", "int"],
  druid: ["wis", "con", "dex", "int", "cha", "str"],
  sorcerer: ["cha", "con", "dex", "wis", "int", "str"],
  warlock: ["cha", "con", "dex", "wis", "int", "str"],
  paladin: ["str", "cha", "con", "wis", "dex", "int"],
  ranger: ["dex", "wis", "con", "str", "int", "cha"],
  monk: ["dex", "wis", "con", "str", "int", "cha"],
};
export function templateScores(classId) {
  return Object.fromEntries(
    (priorities[classId] ?? ABILITIES).map((k, i) => [
      k,
      [15, 14, 13, 12, 10, 8][i],
    ]),
  );
}
/** Explicit user-invoked suggestions, never auto-finalize or replace nonempty decisions. */
export const CREATION_MODELS = ["balanced", "support", "offensive"];
const modelPreferences = {
  balanced: [
    "athletics",
    "perception",
    "insight",
    "arcana",
    "stealth",
    "persuasion",
    "srd51:fighter:defense",
    "srd51:healing-word",
    "srd51:fire-bolt",
    "srd51:mage-hand",
    "srd51:minor-illusion",
    "srd51:light",
    "srd51:magic-missile",
    "srd51:shield",
    "srd51:detect-magic",
    "srd51:heroism",
    "srd51:faerie-fire",
    "srd51:invisibility",
    "srd51:shatter",
    "srd51:dispel-magic",
    "srd51:hypnotic-pattern",
    "srd51:fireball",
    "srd51:haste",
    "srd51:counterspell",
    "srd51:revivify",
  ],
  support: [
    "persuasion",
    "insight",
    "perception",
    "srd51:healing-word",
    "srd51:cure-wounds",
    "srd51:heroism",
    "srd51:bless",
    "srd51:faerie-fire",
    "srd51:light",
    "srd51:mage-hand",
    "srd51:invisibility",
    "srd51:dispel-magic",
    "srd51:hypnotic-pattern",
    "srd51:haste",
    "srd51:counterspell",
    "srd51:revivify",
  ],
  offensive: [
    "athletics",
    "stealth",
    "perception",
    "srd51:fire-bolt",
    "srd51:ray-of-frost",
    "srd51:magic-missile",
    "srd51:burning-hands",
    "srd51:thunderwave",
    "srd51:shatter",
    "srd51:fireball",
    "srd51:lightning-bolt",
    "srd51:haste",
  ],
};
export function suggestChoices(context, config, input) {
  const d = structuredClone(input);
  for (const c of d.classes) {
    const entry = context.index.class(c.id);
    if (!entry) continue;
    if (!c.subclassId && c.level >= entry.data.subclassLevel)
      c.subclassId =
        context.index.list("subclass").find((i) => i.data.classId === c.id)
          ?.id ?? null;
  }
  for (let pass = 0; pass < 5; pass++) {
    const r = draftProgression(context, config, d),
      usedSkills = new Set(r.origin?.background.skills ?? d.background.skills),
      usedExpertise = new Set(),
      features = new Set(),
      spells = new Map(),
      groups = new Map();
    for (const q of r.origin?.choices ?? []) {
      d.originSelections ??= {};
      if (!d.originSelections[q.id]?.length) {
        const current =
          draftProgression(context, config, d).origin?.choices.find(
            (v) => v.id === q.id,
          ) ?? q;
        d.originSelections[q.id] = current.options.slice(0, current.count);
      }
    }
    for (const q of r.choices) {
      if (q.kind === "subclass") continue;
      const current = d.selections[q.id] ?? [],
        spellSet = spells.get(q.classId) ?? new Set(),
        group = groups.get(q.distinctGroup) ?? new Set();
      if (!current.length) {
        let options = q.options.filter(
          (v) =>
            (q.kind !== "skill" || !usedSkills.has(v)) &&
            (q.kind !== "expertise" || !usedExpertise.has(v)) &&
            (q.kind !== "feature" || !features.has(v)) &&
            (q.kind !== "spell" || !spellSet.has(v)) &&
            (!q.distinctGroup || !group.has(v)),
        );
        if (q.kind === "asi") {
          const scores = { ...d.scores };
          for (const values of Object.values(d.selections))
            for (const v of values)
              if (v.startsWith("asi:")) {
                const [, a, b] = v.split(":");
                scores[a]++;
                scores[b]++;
              }
          const priority = priorities[q.classId] ?? ABILITIES;
          options = options
            .filter((v) => {
              if (!v.startsWith("asi:")) return false;
              const [, a, b] = v.split(":");
              return (
                scores[a] + (a === b ? 2 : 1) <= 20 &&
                scores[b] + (a === b ? 2 : 1) <= 20
              );
            })
            .sort(
              (a, b) =>
                priority.indexOf(a.split(":")[1]) -
                priority.indexOf(b.split(":")[1]),
            );
        }
        if (q.kind === "spell")
          options.sort(
            (a, b) =>
              (context.index.get(a)?.data.level ?? 0) -
              (context.index.get(b)?.data.level ?? 0),
          );
        if (q.kind !== "asi") {
          const preferred = [
            ...(modelPreferences[d.model ?? "balanced"] ?? []),
            ...modelPreferences.balanced,
          ];
          options.sort((a, b) => {
            const x = preferred.indexOf(a),
              y = preferred.indexOf(b);
            return (x < 0 ? 10000 : x) - (y < 0 ? 10000 : y);
          });
        }
        d.selections[q.id] = options.slice(0, q.count);
      }
      const values = d.selections[q.id] ?? [];
      if (q.kind === "skill") values.forEach((v) => usedSkills.add(v));
      if (q.kind === "expertise") values.forEach((v) => usedExpertise.add(v));
      if (q.kind === "feature") values.forEach((v) => features.add(v));
      if (q.kind === "spell") {
        values.forEach((v) => spellSet.add(v));
        spells.set(q.classId, spellSet);
      }
      if (q.distinctGroup) {
        values.forEach((v) => {
          if (v !== "language:none") group.add(v);
        });
        groups.set(q.distinctGroup, group);
      }
    }
  }
  d.confirmed = false;
  d.reviewed = false;
  return d;
}

/** Explicit review action: park an invalid decision in the draft, never destroy its values. */
export function retainDecision(d, kind, choiceId) {
  const values =
    kind === "subclass"
      ? [d.classes.find((c) => c.id === choiceId)?.subclassId].filter(Boolean)
      : [
          ...((kind === "origin" ? d.originSelections : d.selections)?.[
            choiceId
          ] ?? []),
        ];
  if (!values.length) return;
  d.retainedDecisions ??= [];
  d.retainedDecisions.push({ kind, choiceId, values });
  if (kind === "subclass")
    d.classes.find((c) => c.id === choiceId).subclassId = null;
  else delete (kind === "origin" ? d.originSelections : d.selections)[choiceId];
}
export function restoreDecision(d, position) {
  const old = d.retainedDecisions?.[position];
  check(
    old && ["class", "origin", "subclass"].includes(old.kind),
    "Retained decision",
  );
  if (old.kind === "subclass")
    check(
      d.classes.some((c) => c.id === old.choiceId),
      "Restore the class before its subclass",
    );
  d.retainedDecisions.splice(position, 1);
  retainDecision(d, old.kind, old.choiceId);
  if (old.kind === "subclass")
    d.classes.find((c) => c.id === old.choiceId).subclassId = old.values[0];
  else {
    const key = old.kind === "origin" ? "originSelections" : "selections";
    d[key] ??= {};
    d[key][old.choiceId] = [...old.values];
  }
  d.confirmed = d.reviewed = d.finalized = false;
}
