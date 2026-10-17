import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classCatalog,
  spellCatalog,
  originCatalog,
} from "../src/catalog/srd51-catalog.js";
import { campaignCatalog, defaultCampaign } from "../src/campaign/sources.js";
import {
  newDraft,
  suggestChoices,
  compileDraft,
  draftProgression,
  buildRequest,
  retainDecision,
  restoreDecision,
} from "../src/creator/model.js";
import {
  resolveOrigins,
  validateScoreMethod,
  rollAbilityScores,
} from "../src/catalog/origins.js";
import { localizedName } from "../src/catalog/localization.js";
import { validateCatalogV3 } from "../src/catalog/catalog-v3.js";
import { MemoryStorage } from "../src/persistence/adapters.js";
import { creatorRepository } from "../src/creator/repository.js";
import { characterLibrary } from "../src/persistence/library.js";
const config = defaultCampaign(),
  packs = [classCatalog, spellCatalog, originCatalog],
  ctx = campaignCatalog(packs, [], config);
function draft(classId = "fighter", level = 1, race = "human", subrace = null) {
  let d = newDraft();
  Object.assign(d, {
    name: "Acceptance hero",
    classes: [{ id: classId, level, subclassId: null }],
    raceId: "srd51:race:" + race,
    subraceId: subrace,
    backgroundId: "srd51:background:acolyte",
  });
  // Identity is explicitly chosen by the fixture, never by recommendations.
  for (const cl of d.classes)
    if (cl.level >= ctx.index.class(cl.id).data.subclassLevel)
      cl.subclassId =
        ctx.index.list("subclass").find((s) => s.data.classId === cl.id)?.id ??
        null;
  d = suggestChoices(ctx, config, d);
  d.confirmed = d.reviewed = true;
  return d;
}
test("origin catalogue is public SRD 2014, with nine races and one background", () => {
  validateCatalogV3(originCatalog, { distribution: "public" });
  assert.equal(ctx.index.list("race").length, 9);
  assert.equal(ctx.index.list("background").length, 1);
  assert.equal(ctx.index.list("background")[0].name.fr, "Acolyte");
  assert.ok(
    ctx.index.list("race").every((r) => r.source.license === "CC-BY-4.0"),
  );
});
test("fighter 1: human score increases, class saves, acolyte skills/languages/equipment and HP", () => {
  const d = draft(),
    r = compileDraft(ctx, config, d);
  assert.equal(r.valid, true, JSON.stringify(r.issues));
  assert.equal(r.character.scores.str, 16);
  assert.equal(r.character.scores.con, 15);
  assert.equal(r.stats.maxHp, 12);
  assert.equal(r.character.ancestry.id, d.raceId);
  assert.equal(r.character.skills.religion, 1);
  assert.equal(r.character.skills.insight, 1);
  assert.ok(r.character.proficiencies.includes("language:common"));
  assert.equal(
    r.character.proficiencies.filter((x) => x.startsWith("language:")).length,
    4,
  );
  assert.equal(
    r.character.equipment.filter((e) => e.id.startsWith("background:")).length,
    6,
  );
  assert.deepEqual(r.character.saveProficiencies, ["str", "con"]);
  assert.equal(
    r.choices.some((q) => q.kind === "subclass"),
    false,
  );
  assert.equal(d.scores.str, 15);
  assert.equal(compileDraft(ctx, config, d).character.scores.str, 16);
});
test("hill dwarf applies subrace once, HP per level, poison resistance and heavy-armor speed exemption", () => {
  const d = draft("fighter", 3, "dwarf", "srd51:race:hill-dwarf"),
    r = compileDraft(ctx, config, d);
  assert.equal(r.valid, true, JSON.stringify(r.issues));
  assert.equal(r.character.scores.con, 16);
  assert.equal(r.character.scores.wis, 13);
  assert.equal(r.stats.maxHp, 34);
  assert.deepEqual(r.character.defenses.resistances, ["poison"]);
  assert.equal(r.stats.speed, 25);
  assert.equal(r.character.movement.ignoreHeavyPenalty, true);
  assert.ok(
    r.character.features.includes("srd51:race:hill-dwarf:dwarven-toughness"),
  );
});
test("all nine SRD races produce complete fighter 1 characters with explicit suggested origin decisions", () => {
  for (const race of ctx.index.list("race")) {
    const sub = race.data.subraces[0]?.id ?? null;
    const d = draft("fighter", 1, race.id.split(":").at(-1), sub);
    const r = compileDraft(ctx, config, d);
    assert.equal(r.valid, true, race.id + JSON.stringify(r.issues));
    assert.equal(r.character.ancestry.id, race.id);
  }
});
test("official background replaces a skill duplicated by class and retains replacement provenance", () => {
  const d = draft("bard", 10);
  d.selections["bard:skills"] = ["insight", "performance", "deception"];
  let r = draftProgression(ctx, config, d);
  const replacement = r.origin.choices.find((q) =>
    q.id.endsWith("replace-skill-insight"),
  );
  assert.ok(replacement);
  d.originSelections[replacement.id] = ["athletics"];
  r = draftProgression(ctx, config, d);
  assert.ok(
    r.origin.ledger.some(
      (row) => row.value === "athletics" && row.origin === d.backgroundId,
    ),
  );
  assert.ok(!r.issues.some((i) => i.code === "duplicate-skill"));
});
test("bard 10 and wizard 10 use production choices, ASIs and spell pools", () => {
  for (const cls of ["bard", "wizard"]) {
    const d = draft(cls, 10),
      r = compileDraft(ctx, config, d);
    assert.equal(r.valid, true, JSON.stringify(r.issues));
    assert.equal(r.character.classes[0].level, 10);
    assert.ok(r.choices.some((q) => q.kind === "asi"));
    assert.ok(r.choices.some((q) => q.kind === "subclass"));
    if (cls === "bard") {
      assert.ok(r.choices.some((q) => q.id === "bard:magical-secrets-10"));
      assert.equal(
        r.choices.find((q) => q.id === "bard:lore-skills").ownerId,
        "srd51:college-of-lore",
      );
      assert.equal(r.choices.filter((q) => q.kind === "expertise").length, 2);
    } else {
      assert.equal(r.choices.find((q) => q.kind === "spellbook").count, 24);
      assert.ok(
        r.character.spells.known.length > r.character.spells.prepared.length,
      );
    }
  }
});
test("level reduction preserves choices, suppresses preview subclass and blocks invalid compilation", () => {
  const d = draft("bard", 10),
    saved = structuredClone(d.selections);
  d.classes[0].level = 1;
  const r = draftProgression(ctx, config, d);
  assert.ok(r.issues.some((i) => i.code === "inactive-subclass"));
  assert.ok(!r.features.includes("srd51:bard:magical-secrets"));
  assert.ok(!r.choices.some((q) => q.kind === "asi"));
  assert.deepEqual(d.selections, saved);
  assert.equal(compileDraft(ctx, config, d).character, null);
  d.classes[0].level = 10;
  assert.equal(compileDraft(ctx, config, d).valid, true);
});
test("scores revalidate preparation, expertise and ASI ceilings without deleting player choices", () => {
  const d = draft("wizard", 10);
  const before = structuredClone(d.selections);
  d.scores.int = 8;
  const r = draftProgression(ctx, config, d);
  assert.ok(r.issues.some((i) => i.choiceId === "wizard:prepared"));
  assert.deepEqual(d.selections, before);
  const f = draft("fighter", 4);
  f.scores.str = 20;
  assert.equal(compileDraft(ctx, config, f).valid, false);
});
test("standard, point-buy, manual and 4d6 methods reject forged distributions", () => {
  assert.equal(
    validateScoreMethod(
      { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      "standard",
    ),
    true,
  );
  assert.equal(
    validateScoreMethod(
      { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 },
      "point-buy",
    ),
    true,
  );
  assert.equal(
    validateScoreMethod(
      { str: 16, dex: 15, con: 15, int: 8, wis: 8, cha: 8 },
      "point-buy",
    ),
    false,
  );
  assert.equal(
    validateScoreMethod(
      { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 },
      "point-buy",
    ),
    false,
  );
  const r = rollAbilityScores(() => 4);
  assert.deepEqual(r.values, [12, 12, 12, 12, 12, 12]);
  assert.equal(
    validateScoreMethod(
      Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map((k) => [k, 12]),
      ),
      "rolled",
      r.rolls,
    ),
    true,
  );
  assert.equal(
    validateScoreMethod(
      { str: 18, dex: 18, con: 18, int: 18, wis: 18, cha: 18 },
      "rolled",
      r.rolls,
    ),
    false,
  );
});
test("races/background are filtered by source and restored without mutating decisions", () => {
  const d = draft(),
    before = structuredClone(d);
  const off = { ...config, enabledSourceIds: ["tce", "xge"] },
    filtered = campaignCatalog(packs, [], off);
  assert.equal(filtered.index.list("race").length, 0);
  assert.equal(compileDraft(filtered, off, d).valid, false);
  assert.deepEqual(d, before);
  assert.equal(compileDraft(ctx, config, d).valid, true);
});
test("legacy draft final scores and fields remain unchanged across persistence and compilation", async () => {
  const d = draft();
  delete d.raceId;
  delete d.backgroundId;
  delete d.scoresAreBase;
  delete d.scoreMethod;
  d.originSelections = {};
  d.origin = "Legacy";
  d.background = {
    name: "Legacy",
    skills: ["religion", "medicine"],
    proficiencies: [],
  };
  d.step = "equipment";
  d.originSelections = {};
  d.selections = {};
  Object.assign(d, suggestChoices(ctx, config, d));
  d.confirmed = true;
  const storage = new MemoryStorage(),
    repo = creatorRepository(storage, characterLibrary(storage));
  await repo.save(d);
  const reopened = await creatorRepository(
    storage,
    characterLibrary(storage),
  ).get(d.id);
  assert.deepEqual(reopened, d);
  const r = compileDraft(ctx, config, reopened);
  assert.equal(r.valid, true, JSON.stringify(r.issues));
  assert.equal(r.character.scores.str, d.scores.str);
});
test("new draft resumes exact source, step, origin choices and scores after export/import", async () => {
  const d = draft("wizard", 10);
  d.step = "features";
  d.uiLevel = 8;
  d.updatedAt = "2026-10-16T20:00:00Z";
  const s = new MemoryStorage(),
    r = creatorRepository(s, characterLibrary(s));
  await r.save(d);
  const s2 = new MemoryStorage(),
    r2 = creatorRepository(s2, characterLibrary(s2));
  await r2.import(await r.export(d.id));
  assert.deepEqual(await r2.get(d.id), d);
});
test("French spell fallbacks are explicit; English names and IDs remain stable", () => {
  const e = ctx.index.get("srd51:fireball");
  assert.equal(
    localizedName(e, "fr", { "srd51:fireball": "Boule de feu" }),
    "Boule de feu",
  );
  assert.equal(localizedName(e, "en"), "Fireball");
  assert.match(
    localizedName({ ...e, id: "untranslated" }, "fr"),
    /traduction FR indisponible/,
  );
  assert.equal(e.id, "srd51:fireball");
});
test("private origin customization options are independent, source-filtered and never applied twice", () => {
  const source = {
    kind: "private",
    document: "Original synthetic origin option",
    license: "user-data",
    url: "",
  };
  const items = ["abilities", "languages"].map((flag) => ({
    id: "original:origin-" + flag,
    type: "feature",
    name: { fr: "Option originale " + flag, en: "Original option " + flag },
    source,
    data: {
      ruleset: "dnd5e-2014",
      automation: {
        status: "manual",
        handler: null,
        limits: ["Synthetic contract test, not official content."],
      },
      classId: "fighter",
      minimumClassLevel: 1,
      optionalClassFeature: true,
      campaignOption: "original-origin-" + flag,
      originCustomization: { [flag]: true },
    },
  }));
  const wrapper = {
    kind: "pilot20-private-rule-pack",
    schemaVersion: 1,
    sourceId: "tce",
    catalog: {
      kind: "catalog",
      schemaVersion: 3,
      ruleset: "dnd5e-2014",
      id: "original:origin-policy",
      items,
    },
  };
  const campaign = {
      ...config,
      enabledOptions: [
        "original-origin-abilities",
        "original-origin-languages",
      ],
    },
    context = campaignCatalog(packs, [wrapper], campaign);
  let d = draft();
  d.originAdjustments = { abilities: true, languages: true };
  d.originSelections = {};
  d.selections = {};
  d = suggestChoices(context, campaign, d);
  d.confirmed = d.reviewed = true;
  const before = structuredClone(d),
    r = compileDraft(context, campaign, d);
  assert.equal(r.valid, true, JSON.stringify(r.issues));
  assert.deepEqual(r.character.scores, {
    str: 16,
    dex: 14,
    con: 15,
    int: 11,
    wis: 13,
    cha: 9,
  });
  assert.deepEqual(d, before);
  assert.deepEqual(
    compileDraft(context, campaign, d).character.scores,
    r.character.scores,
  );
  const off = { ...campaign, enabledOptions: ["original-origin-languages"] },
    filtered = campaignCatalog(packs, [wrapper], off);
  assert.ok(
    draftProgression(filtered, off, d).issues.some(
      (i) => i.code === "origin-option-disabled",
    ),
  );
  assert.equal(compileDraft(filtered, off, d).valid, false);
  assert.deepEqual(d, before);
});
test("equipment profiles reuse derived weapon proficiency, finesse, armor AC and persistence contracts", () => {
  const d = draft();
  d.weapons = ["longsword", "rapier"];
  d.equipment = "plate";
  d.shield = true;
  let r = compileDraft(ctx, config, d);
  assert.equal(r.valid, true, JSON.stringify(r.issues));
  assert.equal(r.stats.ac, 20);
  assert.equal(
    r.character.equipment.find((w) => w.id === "srd51:weapon:longsword").weapon
      .proficient,
    true,
  );
  assert.equal(
    r.character.equipment.find((w) => w.id === "srd51:weapon:rapier").weapon
      .ability,
    "str",
  );
  d.scores.dex = 20;
  d.scores.str = 8;
  r = compileDraft(ctx, config, d);
  assert.equal(r.valid, false); // human bonus would exceed racial 20 cap
  d.scores.dex = 18;
  r = compileDraft(ctx, config, d);
  assert.equal(
    r.character.equipment.find((w) => w.id === "srd51:weapon:rapier").weapon
      .ability,
    "dex",
  );
});

test("level reduction can be revalidated while every old decision remains explicitly restorable", () => {
  const d = draft("bard", 10),
    original = structuredClone(d.selections),
    sub = d.classes[0].subclassId;
  d.classes[0].level = 1;
  const r = draftProgression(ctx, config, d);
  for (const id of new Set(
    r.issues.filter((i) => i.choiceId).map((i) => i.choiceId),
  ))
    retainDecision(d, "class", id);
  retainDecision(d, "subclass", "bard");
  const lower = suggestChoices(ctx, config, d);
  lower.confirmed = lower.reviewed = true;
  assert.equal(
    compileDraft(ctx, config, lower).valid,
    true,
    JSON.stringify(compileDraft(ctx, config, lower).issues),
  );
  assert.ok(
    lower.retainedDecisions.some(
      (r) => r.kind === "subclass" && r.values[0] === sub,
    ),
  );
  lower.classes[0].level = 10;
  for (let n = lower.retainedDecisions.length - 1; n >= 0; n--)
    restoreDecision(lower, n);
  assert.deepEqual(lower.selections, original);
  assert.equal(lower.classes[0].subclassId, sub);
  lower.confirmed = lower.reviewed = true;
  assert.equal(compileDraft(ctx, config, lower).valid, true);
});
