import { loadSRD } from "../src/catalog/srd51-catalog.js";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const index = loadSRD(),
  manifest = JSON.parse(
    readFileSync(
      new URL("../src/catalog/data/srd51-manifest.json", import.meta.url),
    ),
  );
export function catalogCoverage() {
  const spells = index.list("spell"),
    classes = index.list("class");
  assert.deepEqual(spells.map((s) => s.id).sort(), manifest.spellIds);
  for (const [cls, names] of Object.entries(manifest.classLists))
    assert.deepEqual(
      spells
        .filter((s) => s.data.classIds.includes(cls))
        .map((s) => s.name.en)
        .sort(),
      names,
    );
  const entries = index
    .list()
    .map((i) => ({
      id: i.id,
      type: i.type,
      classId: i.data.classId ?? i.data.classIds ?? null,
      minimumClassLevel: i.data.minimumClassLevel ?? null,
      source: i.source.document,
      license: i.source.license,
      availability: "public",
      coverage: i.data.automation.status,
      handler: i.data.automation.handler,
      tests: {
        structural: ["race", "background"].includes(i.type)
          ? ["tests/builder-v031.test.js"]
          : ["tests/catalog-progression.test.js"],
        mechanical: ["race", "background"].includes(i.type)
          ? ["tests/builder-v031.test.js"]
          : i.data.automation.handler
            ? [
                "tests/catalog-combat.test.js",
                "tests/catalog-refinements.test.js",
                "tests/combat-reactions.test.js",
                "tests/conditional-rules.test.js",
              ]
            : [],
        mechanicalEvidenceScope:
          "Catalogue scenarios for simple spells, healing, Haste, fighter, rage and bard demo; remaining handlers reuse primitive regression tests. Not every entry is executed.",
      },
      limits: i.data.automation.limits,
    }));
  return {
    ruleset: "dnd5e-2014",
    denominators: {
      racesExpected: 9,
      racesPresent: index.list("race").length,
      backgroundsExpected: 1,
      backgroundsPresent: index.list("background").length,
      classesExpected: 12,
      classesPresent: classes.length,
      classLevelRowsExpected: 240,
      classLevelRowsPresent: classes.reduce(
        (n, c) => n + c.data.grants.length,
        0,
      ),
      productionBuildLevelScenarios: 60,
      subclassesExpected: 12,
      subclassesPresent: index.list("subclass").length,
      spellsExpected: manifest.descriptionCount,
      spellsPresent: spells.length,
      spellsStructurallyValidated: spells.length,
      officialFeatureExpectedCount: null,
      officialFeatureDenominatorReason:
        "Class-table grants, SRD subclass headings and option inventory are present; source text includes additional nested choices not yet normalized. No exhaustive feature percentage claimed.",
      classFeatureEntriesPresent: index.list("feature").length,
      privatePackOfficialContentExpected: 0,
      privatePackOfficialContentPresent: 0,
    },
    automation: Object.fromEntries(
      ["automated", "partial", "manual", "unsupported"].map((status) => [
        status,
        entries.filter((e) => e.coverage === status).length,
      ]),
    ),
    progression: {
      classTables: "represented-1-20",
      numericScaling: "declared",
      knownPreparedAndSlots: "implemented-current-build",
      historicalAcquisition:
        "verified-when-level-snapshots-provided; otherwise explicitly not-recorded",
      remainingNestedChoices: "explicit-selections-with-GM-eligibility",
    },
    releaseGate: {
      status: "review-ready-with-documented-manual-scopes",
      acceptance:
        "Implemented catalogue/progression scope is ready for review. No claim of whole-rulebook automation or exhaustive nested-feature percentage.",
      manualScopes: [
        "Geometry, components, narrative and complex feature effects are GM-adjudicated.",
        "History is verified only when snapshots are supplied; calendar recovery and approved retraining remain explicit GM decisions.",
        "Artificer content requires an authorized private pack; no iPad performance claim.",
      ],
      privateReferenceReview:
        "Representative Tasha/Xanathar requirements reviewed locally; no protected book content published.",
      safeNextStep:
        "Review the PR and accept the documented manual workflows before freezing V0.3 contracts.",
    },
    entries,
  };
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const text = JSON.stringify(catalogCoverage(), null, 2) + "\n",
    path = new URL("../docs/catalog-coverage-report.json", import.meta.url);
  if (process.argv.includes("--check"))
    assert.equal(readFileSync(path, "utf8"), text);
  else if (process.argv.includes("--write")) writeFileSync(path, text);
  else process.stdout.write(text);
}
