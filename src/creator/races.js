import { sourceEnabled } from "../campaign/sources.js";
import { ABILITIES, SKILLS, check, id } from "../character/contracts.js";
import { LANGUAGES } from "../catalog/origins.js";
import { validateCatalogV3 } from "../catalog/catalog-v3.js";
export function newHomebrewRace() {
  return {
    id: "homebrew:race:" + crypto.randomUUID(),
    version: 1,
    name: { fr: "Nouvelle race", en: "New ancestry" },
    description: "",
    appearance: "",
    size: "medium",
    creatureType: "humanoid",
    speed: 30,
    movement: {},
    languages: ["common"],
    bonuses: {},
    senses: [],
    skills: [],
    proficiencies: [],
    resistances: [],
    traits: [],
    subraces: [],
    gmApproved: false,
    provenance: "homebrew/user-data",
  };
}
export function validateHomebrewRace(r) {
  check(
    r && id(r.id) && Number.isSafeInteger(r.version) && r.version > 0,
    "Race identity/version",
  );
  check(
    r.provenance === "homebrew/user-data" && typeof r.gmApproved === "boolean",
    "Homebrew provenance/review",
  );
  check(
    ["small", "medium"].includes(r.size) &&
      Number.isInteger(r.speed) &&
      r.speed >= 0 &&
      r.speed <= 200,
    "Size/speed",
  );
  check(
    typeof r.creatureType === "string" &&
      r.creatureType.trim() &&
      r.creatureType.length <= 80,
    "Creature type",
  );
  for (const k of ["description", "appearance"])
    check(typeof r[k] === "string" && r[k].length <= 5000, "Race description");
  check(Array.isArray(r.traits) && r.traits.length <= 100, "Race traits");
  for (const t of r.traits)
    check(
      id(t.id) &&
        t.name?.fr &&
        t.name?.en &&
        typeof t.description === "string" &&
        t.description.length <= 5000,
      "Trait identity",
    );
  for (const [k, v] of Object.entries(r.movement))
    check(
      ["fly", "swim", "climb", "burrow"].includes(k) &&
        Number.isInteger(v) &&
        v >= 0 &&
        v <= 200,
      "Movement",
    );
  for (const [k, v] of Object.entries(r.bonuses))
    check(
      ABILITIES.includes(k) && Number.isInteger(v) && v >= 1 && v <= 2,
      "Ability bonus",
    );
  check(
    new Set(r.skills).size === r.skills.length &&
      r.skills.every((k) => Object.hasOwn(SKILLS, k)),
    "Unique skills",
  );
  check(
    r.languages.every((k) => LANGUAGES.includes(k)) &&
      new Set(r.languages).size === r.languages.length,
    "Unique languages",
  );
  check(
    r.resistances.every((k) =>
      [
        "acid",
        "cold",
        "fire",
        "force",
        "lightning",
        "necrotic",
        "poison",
        "psychic",
        "radiant",
        "thunder",
        "bludgeoning",
        "piercing",
        "slashing",
      ].includes(k),
    ) && new Set(r.resistances).size === r.resistances.length,
    "Unique resistances",
  );
  check(
    new Set(r.traits.map((t) => t.id)).size === r.traits.length,
    "Duplicate trait IDs",
  );
  check(
    new Set(r.subraces.map((s) => s.id)).size === r.subraces.length,
    "Duplicate subrace IDs",
  );
  for (const t of r.traits) {
    if (t.charges !== undefined)
      check(
        Number.isInteger(t.charges) && t.charges >= 0 && t.charges <= 100,
        "Trait charges",
      );
    if (t.rest !== undefined)
      check(["none", "short", "long"].includes(t.rest), "Trait recovery");
    if (t.activation !== undefined)
      check(
        ["passive", "action", "bonus", "reaction"].includes(t.activation),
        "Trait activation",
      );
  }
  const data = {
    ruleset: "dnd5e-2014",
    automation: {
      status: "partial",
      handler: null,
      limits: [
        "Bonuses, proficiencies, resistances and walking speed compiled. Other movement, senses, creature type and user-defined abilities require GM adjudication.",
      ],
    },
    size: r.size,
    speed: r.speed,
    creatureType: r.creatureType,
    bonuses: r.bonuses,
    languages: r.languages,
    skills: r.skills,
    proficiencies: r.proficiencies,
    resistances: r.resistances,
    subraces: r.subraces,
    traits: [
      ...r.traits.map((t) => ({ ...t, automation: "manual" })),
      ...(r.creatureType !== "humanoid" ||
      r.senses.length ||
      Object.values(r.movement).some((v) => v > 0)
        ? [
            {
              id: "manual-origin-details",
              name: {
                fr: "Particularités d’origine (manuel)",
                en: "Origin details (manual)",
              },
              description: JSON.stringify({
                creatureType: r.creatureType,
                movement: r.movement,
                senses: r.senses,
              }),
              automation: "manual",
            },
          ]
        : []),
    ],
    raceFamilyId: r.id,
    visualAssetId: "custom",
    rulesVersionId: r.id + ":v" + r.version,
    sourceDocument: "User-created ancestry",
    packId: r.id + ":pack",
    sourceVersion: String(r.version),
    license: "user-data",
    availability: "homebrew",
    automationCoverage: "partial",
    homebrewDefinition: structuredClone(r),
  };
  const pack = {
    kind: "pilot20-private-rule-pack",
    schemaVersion: 1,
    sourceId: "homebrew",
    catalog: {
      kind: "catalog",
      schemaVersion: 3,
      ruleset: "dnd5e-2014",
      id: r.id + ":pack",
      items: [
        {
          id: r.id,
          type: "race",
          name: r.name,
          source: {
            kind: "homebrew",
            document: "User-created ancestry v" + r.version,
            license: "user-data",
            url: "",
          },
          data,
        },
      ],
    },
  };
  validateCatalogV3(pack.catalog);
  return pack;
}
/** A strict UI assistant; never claims a pack is installed because the source is selected. */
export function customLineagePack(input, context, draft) {
  check(
    sourceEnabled(context.campaign, "tce") &&
      context.campaign.enabledOptions.includes("tce-custom-lineage"),
    "Tasha lineage requires campaign and GM authorization",
  );
  check(input.gmApproved === true, "GM approval required");
  check(
    ["small", "medium"].includes(input.size) &&
      ABILITIES.includes(input.ability),
    "Lineage size/ability",
  );
  check(
    ["darkvision", "skill"].includes(input.variable),
    "Choose darkvision OR a skill",
  );
  check(
    input.variable !== "skill" || Object.hasOwn(SKILLS, input.skill),
    "Choose a valid skill",
  );
  check(
    LANGUAGES.includes(input.language) && input.language !== "common",
    "Choose an additional authorized language",
  );
  const feat = context.index.get(input.featId);
  check(feat?.type === "feat", "Choose an installed, active feat");
  const scores = {
    ...draft.scores,
    [input.ability]: draft.scores[input.ability] + 2,
  };
  check(
    (feat.data.requiresScores ?? []).every((p) => scores[p.score] >= p.minimum),
    "Feat ability prerequisites not met",
  );
  check(
    !feat.data.requires?.length,
    "Feat dependencies need explicit engine support",
  );
  const r = newHomebrewRace();
  r.id = input.id ?? r.id;
  r.name = {
    fr: input.name || "Lignée sur mesure",
    en: input.name || "Custom lineage",
  };
  r.size = input.size;
  r.bonuses = { [input.ability]: 2 };
  r.languages = ["common", input.language];
  r.skills = input.variable === "skill" ? [input.skill] : [];
  r.appearance = input.appearance ?? "";
  r.gmApproved = true;
  if (input.variable === "darkvision")
    r.traits = [
      {
        id: "darkvision",
        name: { fr: "Vision dans le noir · 18 m", en: "Darkvision · 60 ft" },
        description:
          "Range recorded; situational perception requires GM adjudication.",
      },
    ];
  const p = validateHomebrewRace(r);
  p.sourceId = "tce";
  const e = p.catalog.items[0];
  e.source = {
    kind: "private",
    document: "User-local Custom Lineage configuration (Tasha 2014)",
    license: "private-user-reference",
    url: "",
  };
  e.data.campaignOption = "tce-custom-lineage";
  e.data.customLineage = {
    featId: input.featId,
    ability: input.ability,
    variable: input.variable,
    language: input.language,
    size: input.size,
  };
  e.data.homebrewDefinition = null;
  e.data.originFeatId = input.featId;
  e.data.sourceVersion = "2020";
  return p;
}
export const exportRace = (r) =>
  JSON.stringify(
    { kind: "pilot20-homebrew-race", schemaVersion: 1, race: r },
    null,
    2,
  );
export function importRace(raw) {
  check(typeof raw === "string" && raw.length < 1000000, "Race file size");
  const v = JSON.parse(raw);
  check(
    v.kind === "pilot20-homebrew-race" && v.schemaVersion === 1,
    "Homebrew file header",
  );
  validateHomebrewRace(v.race);
  return structuredClone(v.race);
}
