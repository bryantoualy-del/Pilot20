import { ABILITIES, SKILLS, check } from "../character/contracts.js";

export const LANGUAGES = [
  "common",
  "dwarvish",
  "elvish",
  "giant",
  "gnomish",
  "goblin",
  "halfling",
  "orc",
  "abyssal",
  "celestial",
  "draconic",
  "deep-speech",
  "infernal",
  "primordial",
  "sylvan",
  "undercommon",
];
export const POINT_COST = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export function validateScoreMethod(scores, method = "manual", rolls = null) {
  if (method === "standard")
    return (
      Object.values(scores)
        .sort((a, b) => b - a)
        .join() === STANDARD_ARRAY.join()
    );
  if (method === "point-buy")
    return (
      Object.values(scores).every((v) => Object.hasOwn(POINT_COST, v)) &&
      Object.values(scores).reduce((n, v) => n + POINT_COST[v], 0) <= 27
    );
  if (method === "rolled")
    return (
      Array.isArray(rolls) &&
      rolls.length === 6 &&
      rolls.every(
        (row) =>
          Array.isArray(row) &&
          row.length === 4 &&
          row.every((v) => Number.isInteger(v) && v >= 1 && v <= 6),
      ) &&
      Object.values(scores)
        .sort((a, b) => a - b)
        .join() ===
        rolls
          .map((row) =>
            [...row]
              .sort((a, b) => b - a)
              .slice(0, 3)
              .reduce((a, b) => a + b, 0),
          )
          .sort((a, b) => a - b)
          .join()
    );
  return method === "manual";
}
export function rollAbilityScores(
  randomDie = () => {
    const a = new Uint32Array(1);
    let n;
    do {
      crypto.getRandomValues(a);
      n = a[0];
    } while (n >= 4294967292);
    return (n % 6) + 1;
  },
) {
  const rolls = Array.from({ length: 6 }, () =>
    Array.from({ length: 4 }, randomDie),
  );
  check(
    rolls.flat().every((v) => Number.isInteger(v) && v >= 1 && v <= 6),
    "Ability dice",
  );
  return {
    rolls,
    values: rolls.map((row) =>
      [...row]
        .sort((a, b) => b - a)
        .slice(0, 3)
        .reduce((a, b) => a + b, 0),
    ),
  };
}
export function originCustomizationPolicy(index) {
  return index
    .list("feature")
    .filter((f) => f.data.originCustomization)
    .reduce((out, f) => {
      const p = f.data.originCustomization;
      return {
        ...out,
        ...p,
        ...(p.proficiencies
          ? {
              proficiencies: {
                ...(out.proficiencies ?? {}),
                ...p.proficiencies,
              },
            }
          : {}),
      };
    }, {});
}
export const originEntry = (index, id, type) => {
  const e = index.get(id);
  return e?.type === type ? e : null;
};
/** One resolver for UI and compiler. No bonuses are added to legacy final-score drafts. */
export function resolveOrigins(index, request) {
  const {
    raceId = null,
    subraceId = null,
    backgroundId = null,
    originSelections = {},
    originAdjustments = {},
    scores,
    scoreMethod = "manual",
    scoreRolls = null,
    scoresAreBase = false,
  } = request;
  const issues = [],
    choices = [],
    ledger = [],
    bonuses = Object.fromEntries(ABILITIES.map((k) => [k, 0])),
    traits = [],
    spells = [];
  const race = originEntry(index, raceId, "race"),
    bg = originEntry(index, backgroundId, "background");
  if (raceId && !race) issues.push({ code: "unavailable-origin", id: raceId });
  if (backgroundId && !bg)
    issues.push({ code: "unavailable-origin", id: backgroundId });
  const sub = race?.data.subraces?.find((s) => s.id === subraceId);
  if (race?.data.subraces?.length && !sub)
    issues.push({ code: "required-subrace" });
  if (subraceId && !sub) issues.push({ code: "invalid-subrace" });
  if (scoresAreBase && !validateScoreMethod(scores, scoreMethod, scoreRolls))
    issues.push({ code: "score-method" });
  const data = [
    ...(race ? [{ entry: race, data: race.data }] : []),
    ...(sub
      ? [{ entry: { ...race, id: sub.id, name: sub.name }, data: sub }]
      : []),
    ...(bg ? [{ entry: bg, data: bg.data }] : []),
  ];
  const classSkills = new Set();
  for (const c of request.classes ?? []) {
    const cls = index.class(c.id),
      subclass = index.get(c.subclassId);
    for (const q of [
      { key: "skills", kind: "skill", level: 1 },
      ...(cls?.data.choices ?? []),
      ...(subclass?.data.choices ?? []),
    ])
      if (q.kind === "skill" && q.level <= c.level)
        for (const s of request.selections?.[c.id + ":" + q.key] ?? [])
          if (Object.hasOwn(SKILLS, s)) classSkills.add(s);
  }
  const grantedSkills = new Set(classSkills),
    proficiencies = new Set(),
    languages = new Set();
  const ask = (entry, spec, options = spec.options) => {
    const q = {
        ...spec,
        id: entry.id + ":" + spec.key,
        ownerId: entry.id,
        options,
      },
      values = originSelections[q.id] ?? [];
    choices.push(q);
    if (
      values.length !== q.count ||
      new Set(values).size !== values.length ||
      values.some((v) => !options.includes(v))
    ) {
      issues.push({ code: "origin-choice", choiceId: q.id });
      return [];
    }
    return values;
  };
  const grant = (entry, kind, value) => {
    ledger.push({
      kind,
      value,
      origin: entry.id,
      name: entry.name,
      source: entry.source,
    });
    if (kind === "skill") grantedSkills.add(value);
    if (kind === "proficiency") proficiencies.add(value);
    if (kind === "language") languages.add(value);
  };
  const policy = originCustomizationPolicy(index);
  for (const flag of ["abilities", "languages", "proficiencies"])
    if (originAdjustments[flag] && !policy[flag])
      issues.push({ code: "origin-option-disabled", option: flag });

  for (const { entry, data: d } of data) {
    for (const [k, n] of Object.entries(d.bonuses ?? {})) {
      if (
        entry.type !== "background" &&
        originAdjustments.abilities &&
        policy.abilities
      ) {
        const selected = ask(entry, {
          key: "ability-" + k,
          kind: "score",
          count: 1,
          options: ABILITIES.filter((k) => !bonuses[k]),
          amount: n,
        });
        if (selected.length) {
          if (bonuses[selected[0]])
            issues.push({ code: "origin-bonus-duplicate" });
          bonuses[selected[0]] += n;
        }
      } else bonuses[k] += n;
    }
    for (const s of d.skills ?? []) {
      let v = s;
      if (grantedSkills.has(v))
        v = ask(entry, {
          key: "replace-skill-" + s,
          kind: "skill",
          count: 1,
          options: Object.keys(SKILLS).filter((k) => !grantedSkills.has(k)),
        })[0];
      if (v) grant(entry, "skill", v);
    }
    for (const v of d.proficiencies ?? []) {
      let value = v;
      if (originAdjustments.proficiencies && policy.proficiencies) {
        const options = policy.proficiencies[v];
        if (options)
          value = ask(entry, {
            key: "replace-proficiency-" + v,
            kind: "proficiency",
            count: 1,
            options,
          })[0];
      }
      if (value) grant(entry, "proficiency", value);
    }
    for (const v of d.languages ?? []) {
      let value = v;
      if (originAdjustments.languages && policy.languages)
        value = ask(entry, {
          key: "replace-language-" + v,
          kind: "language",
          count: 1,
          options: LANGUAGES.filter((k) => !languages.has(k)),
        })[0];
      if (value) grant(entry, "language", value);
    }
    for (const spec of d.choices ?? []) {
      let options = spec.options;
      if (spec.kind === "racial-spell")
        options = index
          .list("spell")
          .filter(
            (s) => s.data.level === 0 && s.data.classIds.includes(spec.classId),
          )
          .map((s) => s.id);
      if (spec.kind === "language")
        options = options.filter((k) => !languages.has(k));
      if (spec.kind === "skill")
        options = options.filter((k) => !grantedSkills.has(k));
      for (const v of ask(entry, spec, options)) {
        if (spec.kind === "score") {
          if (bonuses[v]) issues.push({ code: "origin-bonus-duplicate" });
          bonuses[v] += spec.amount ?? 1;
        } else if (spec.kind === "racial-spell")
          spells.push({
            id: v,
            ability: spec.ability,
            level: 1,
            source: entry.source,
          });
        else if (spec.kind === "draconic") grant(entry, "draconic", v);
        else grant(entry, spec.kind, v);
      }
    }
    traits.push(
      ...(d.traits ?? []).map((t) => ({
        ...t,
        source: entry.source,
        ownerId: entry.id,
      })),
      ...(d.feature
        ? [{ ...d.feature, source: entry.source, ownerId: entry.id }]
        : []),
    );
    spells.push(
      ...(d.spells ?? [])
        .filter(
          (s) =>
            s.level <= (request.classes ?? []).reduce((n, c) => n + c.level, 0),
        )
        .map((s) => ({ ...s, source: entry.source })),
    );
  }
  for (const key of Object.keys(originSelections))
    if (!choices.some((q) => q.id === key))
      issues.push({ code: "obsolete-origin-choice", choiceId: key });
  const effectiveScores = Object.fromEntries(
    ABILITIES.map((k) => [k, scores[k] + (scoresAreBase ? bonuses[k] : 0)]),
  );
  if (Object.values(effectiveScores).some((v) => v > 20) && scoresAreBase)
    issues.push({ code: "origin-score-cap" });
  // Custom background has explicit per-grant provenance too. Existing drafts are left intact.
  if (!backgroundId) {
    for (const s of request.background?.skills ?? [])
      grant(
        {
          id: "user:background",
          name: { fr: "Historique personnalisé", en: "Custom background" },
          source: null,
        },
        "skill",
        s,
      );
    for (const l of request.background?.languages ?? []) {
      if (!LANGUAGES.includes(l))
        issues.push({ code: "custom-background-language" });
      else
        grant(
          {
            id: "user:background",
            name: { fr: "Historique personnalisé", en: "Custom background" },
            source: null,
          },
          "language",
          l,
        );
    }
    if (
      request.background?.customized &&
      (request.background.proficiencies.length +
        (request.background.languages?.length ?? 0) !==
        2 ||
        !request.background.feature?.trim())
    )
      issues.push({ code: "custom-background-choices" });
    for (const p of request.background?.proficiencies ?? [])
      grant(
        {
          id: "user:background",
          name: { fr: "Historique personnalisé", en: "Custom background" },
          source: null,
        },
        "proficiency",
        p,
      );
  }
  const background = {
    name: bg?.name.en ?? request.background?.name ?? "",
    skills: [
      ...new Set(ledger.filter((r) => r.kind === "skill").map((r) => r.value)),
    ],
    proficiencies: [
      ...new Set([
        ...proficiencies,
        ...[...languages].map((v) => "language:" + v),
      ]),
    ],
  };
  return {
    valid: issues.length === 0,
    issues,
    choices,
    ledger,
    bonuses,
    scores: effectiveScores,
    background,
    race,
    subrace: sub ?? null,
    traits,
    spells,
    languages: [...languages],
    size: race?.data.size ?? "medium",
    speed: race?.data.speed ?? 30,
    hpPerLevel: sub?.hpPerLevel ?? race?.data.hpPerLevel ?? 0,
    ignoreHeavyPenalty: race?.data.ignoreHeavyPenalty ?? false,
    resistances: [
      ...(race?.data.resistances ?? []),
      ...(sub?.resistances ?? []),
    ],
    equipment: bg?.data.equipment ?? [],
  };
}
