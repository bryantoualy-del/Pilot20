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
} from "../src/creator/model.js";
import { recommendQuick } from "../src/creator/quick.js";
import {
  RACE_FAMILIES,
  RACE_VARIANTS,
  raceLibrary,
} from "../src/catalog/race-discovery.js";
import {
  newHomebrewRace,
  validateHomebrewRace,
  customLineagePack,
  exportRace,
  importRace,
} from "../src/creator/races.js";
import { MemoryStorage } from "../src/persistence/adapters.js";
import { campaignRepository } from "../src/campaign/repository.js";
import { originalPack } from "../e2e/fixtures.mjs";
const packs = [classCatalog, spellCatalog, originCatalog],
  config = defaultCampaign(),
  ctx = campaignCatalog(packs, [], config);
test("59 visual families and 30 variants are distinct from installed mechanics", () => {
  assert.equal(RACE_FAMILIES.length, 59);
  assert.equal(RACE_VARIANTS.length, 30);
  assert.equal(
    raceLibrary(ctx, { query: "kobold" })[0].availability,
    "pack-missing",
  );
  assert.equal(raceLibrary(ctx, { query: "drakeide" })[0].slug, "drakeide");
  assert.equal(
    raceLibrary(ctx, { query: "human" })[0].availability,
    "available",
  );
  const off = campaignCatalog(packs, [], { ...config, enabledSourceIds: [] });
  assert.equal(
    raceLibrary(off, { query: "human" })[0].availability,
    "source-disabled",
  );
});
test("recommendations never select a subclass, spell or ASI and do not mutate drafts", () => {
  const d = newDraft();
  d.classes = [{ id: "bard", level: 10, subclassId: null }];
  d.name = "Bard";
  d.raceId = "srd51:race:human";
  const before = structuredClone(d);
  const q = recommendQuick(ctx, config, d);
  assert.deepEqual(d, before);
  assert.equal(q.classes[0].subclassId, null);
  for (const choice of draftProgression(ctx, config, q).choices.filter((q) =>
    ["spell", "asi", "spellbook", "prepared"].includes(q.kind),
  ))
    assert.equal(q.selections[choice.id], undefined);
  assert.equal(suggestChoices(ctx, config, d).classes[0].subclassId, null);
});
test("fighter recommendations compile only after explicit confirmation", () => {
  const d = newDraft();
  d.name = "Fighter";
  d.raceId = "srd51:race:human";
  let q = recommendQuick(ctx, config, d);
  const r = draftProgression(ctx, config, q);
  for (const c of r.choices.filter((c) => c.kind === "feature"))
    q.selections[c.id] = [c.options[0]];
  assert.equal(compileDraft(ctx, config, q).valid, false);
  q.confirmed = q.reviewed = true;
  const result = compileDraft(ctx, config, q);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.ok(result.stats.maxHp > 0);
});
test("homebrew validates, round-trips, reuses existing statistics and gates by campaign", async () => {
  const r = newHomebrewRace();
  r.name = { fr: "Test original", en: "Original test" };
  r.bonuses = { con: 2 };
  r.skills = ["stealth"];
  r.resistances = ["cold"];
  r.gmApproved = true;
  r.traits = [
    {
      id: "test",
      name: { fr: "Trait original", en: "Original trait" },
      description: "Original synthetic ability",
      charges: 2,
      rest: "long",
    },
  ];
  const p = validateHomebrewRace(r);
  assert.deepEqual(importRace(exportRace(r)), r);
  const on = {
      ...config,
      enabledSourceIds: [...config.enabledSourceIds, "homebrew"],
    },
    c = campaignCatalog(packs, [p], on),
    d = newDraft();
  d.name = "Test";
  d.raceId = r.id;
  let q = recommendQuick(c, on, d);
  for (const ch of draftProgression(c, on, q).choices.filter(
    (c) => c.kind === "feature",
  ))
    q.selections[ch.id] = [ch.options[0]];
  q.confirmed = q.reviewed = true;
  const result = compileDraft(c, on, q);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.equal(result.character.scores.con, 16);
  assert.ok(result.character.defenses.resistances.includes("cold"));
  assert.equal(
    result.character.abilities.find((a) => a.id.endsWith(":test")).combat.mode,
    "manual",
  );
  assert.equal(compileDraft(ctx, config, q).valid, false);
  const storage = new MemoryStorage(),
    repo = campaignRepository(storage, packs);
  await repo.saveUserRace(p);
  assert.ok((await repo.context(on)).index.get(r.id));
  r.version++;
  r.speed = 35;
  await repo.saveUserRace(validateHomebrewRace(r));
  assert.equal((await repo.context(on)).index.get(r.id).data.speed, 35);
  await repo.removeUserRace(r.id + ":pack");
  assert.equal((await repo.context(on)).index.get(r.id), undefined);
  assert.equal(compileDraft(await repo.context(on), on, q).valid, false);
});
test("custom lineage rejects missing authorization, absent feat and unmet prerequisites", () => {
  const d = newDraft(),
    input = {
      name: "Test lineage",
      size: "small",
      ability: "cha",
      variable: "darkvision",
      language: "draconic",
      featId: "missing",
      gmApproved: true,
    };
  assert.throws(() => customLineagePack(input, ctx, d), /authorization/);
  const on = { ...config, enabledOptions: ["tce-custom-lineage"] },
    c = campaignCatalog(packs, [], on);
  assert.throws(() => customLineagePack(input, c, d), /feat/);
  assert.throws(
    () => customLineagePack({ ...input, size: "large" }, c, d),
    /size/,
  );
});
test("duplicate homebrew bonuses and invalid movement are rejected", () => {
  const r = newHomebrewRace();
  r.skills = ["stealth", "stealth"];
  assert.throws(() => validateHomebrewRace(r), /skills/);
  r.skills = [];
  r.bonuses = { str: 4 };
  assert.throws(() => validateHomebrewRace(r), /bonus/);
  r.bonuses = {};
  r.movement = { fly: -5 };
  assert.throws(() => validateHomebrewRace(r), /Movement/);
});
test("strict Tasha configuration compiles +2, eligible feat and exactly one variable trait", () => {
  const on = { ...config, enabledOptions: ["tce-custom-lineage"] },
    d = newDraft();
  d.name = "Lineage";
  const c = campaignCatalog(packs, [], on),
    input = {
      name: "Original lineage",
      size: "small",
      ability: "str",
      variable: "darkvision",
      language: "draconic",
      featId: "srd51:grappler",
      gmApproved: true,
    };
  const pack = customLineagePack(input, c, d),
    ctx = campaignCatalog(packs, [pack], on);
  d.raceId = pack.catalog.items[0].id;
  let q = recommendQuick(ctx, on, d);
  for (const ch of draftProgression(ctx, on, q).choices.filter(
    (q) => q.kind === "feature",
  ))
    q.selections[ch.id] = [ch.options[0]];
  q.confirmed = q.reviewed = true;
  const result = compileDraft(ctx, on, q);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.equal(result.character.scores.str, 17);
  assert.ok(result.character.features.includes("srd51:grappler"));
  assert.equal(result.character.movement.walk, 30);
  assert.ok(
    result.character.abilities.some((a) => a.id.endsWith(":darkvision")),
  );
  const before = structuredClone(q);
  const off = { ...on, enabledOptions: [] };
  assert.equal(
    compileDraft(campaignCatalog(packs, [pack], off), off, q).valid,
    false,
  );
  assert.deepEqual(q, before);
  const weak = { ...d, scores: { ...d.scores, str: 8 } };
  assert.throws(
    () => customLineagePack({ ...input, ability: "cha" }, c, weak),
    /prerequisites/,
  );
  assert.throws(
    () => customLineagePack({ ...input, variable: "both" }, c, d),
    /OR/,
  );
});
test("synthetic kobold versions remain independent and bard 10 saves without claiming official packs", () => {
  const a = newHomebrewRace();
  a.name = { fr: "Kobold de test original", en: "Original test kobold" };
  a.gmApproved = true;
  a.bonuses = { dex: 2 };
  const p1 = validateHomebrewRace(a);
  p1.sourceId = "volo";
  p1.catalog.id = "test:volo";
  p1.catalog.items[0].source = {
    kind: "private",
    document: "Synthetic original test, NOT official Volo rules",
    license: "test-only",
    url: "",
  };
  p1.catalog.items[0].data.raceFamilyId = "kobold";
  p1.catalog.items[0].data.rulesVersionId = "kobold/volo-2016";
  const p2 = structuredClone(p1);
  p2.sourceId = "motm";
  p2.catalog.id = "test:motm";
  p2.catalog.items[0].id = "test:motm:kobold";
  p2.catalog.items[0].data.rulesVersionId = "kobold/motm-2022";
  p2.catalog.items[0].data.bonuses = { con: 1 };
  const on = {
      ...config,
      enabledSourceIds: [...config.enabledSourceIds, "volo", "motm"],
    },
    c = campaignCatalog(packs, [p1, p2, originalPack], on);
  assert.equal(raceLibrary(c, { query: "kobold" })[0].versions.length, 2);
  const d = newDraft();
  d.name = "Original kobold bard";
  d.raceId = p1.catalog.items[0].id;
  d.backgroundId = "srd51:background:acolyte";
  d.classes = [{ id: "bard", level: 10, subclassId: "original:college" }];
  let q = suggestChoices(c, on, d);
  q.confirmed = q.reviewed = true;
  const result = compileDraft(c, on, q);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.ok(result.character.spells.known.length > 0);
  assert.ok(result.character.resources.length > 0);
  const saved = structuredClone(q),
    off = {
      ...on,
      enabledSourceIds: on.enabledSourceIds.filter((s) => s !== "volo"),
    };
  assert.equal(
    compileDraft(campaignCatalog(packs, [p1, p2, originalPack], off), off, q)
      .valid,
    false,
  );
  assert.deepEqual(q, saved);
});
