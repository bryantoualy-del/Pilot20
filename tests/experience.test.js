import { test } from "node:test";
import assert from "node:assert/strict";
import { classCatalog, spellCatalog } from "../src/catalog/srd51-catalog.js";
import { campaignCatalog, defaultCampaign } from "../src/campaign/sources.js";
import {
  newDraft,
  suggestChoices,
  compileDraft,
} from "../src/creator/model.js";
import {
  previewDraft,
  comparisonPlan,
  issueStep,
  diagnosticKind,
  discoveryMatches,
} from "../src/creator/experience.js";
const config = defaultCampaign(),
  ctx = campaignCatalog([classCatalog, spellCatalog], [], config);
function complete(id = "fighter", level = 1) {
  const d = newDraft();
  Object.assign(d, {
    name: "Original test",
    origin: "Original custom",
    background: {
      name: "Original background",
      skills: ["religion", "medicine"],
      proficiencies: [],
    },
    classes: [{ id, level, subclassId: null }],
    reviewed: true,
    confirmed: true,
  });
  // Identity is explicitly chosen by the fixture, never by recommendations.
  for (const cl of d.classes)
    if (cl.level >= ctx.index.class(cl.id).data.subclassLevel)
      cl.subclassId =
        ctx.index.list("subclass").find((s) => s.data.classId === cl.id)?.id ??
        null;
  const p = suggestChoices(ctx, config, d);
  p.reviewed = true;
  p.confirmed = true;
  return p;
}
test("preview and repeated simulations do not mutate saved decisions or approvals", () => {
  const d = complete(),
    before = structuredClone(d);
  const actual = previewDraft(ctx, config, d),
    sim = previewDraft(ctx, config, d, (x) => {
      x.scores.str = 18;
      x.equipment = "chain";
      x.shield = true;
    });
  assert.deepEqual(d, before);
  assert.equal(sim.stats.ac, 18);
  assert.equal(sim.scores.str, 18);
  assert.deepEqual(actual.stats, compileDraft(ctx, config, d).stats);
  assert.notDeepEqual(sim.plan, d);
});
test("incomplete and source-disabled previews do not manufacture armor or casting statistics", () => {
  const d = newDraft();
  const p = previewDraft(ctx, config, d);
  assert.equal(p.stats, null);
  assert.equal(p.provisional, true);
  const off = { ...config, sourceRestrictions:true,enabledSourceIds: ["xge"] },
    filtered = campaignCatalog([classCatalog, spellCatalog], [], off);
  assert.equal(previewDraft(filtered, off, complete()).stats, null);
});
test("bard and wizard level 10 previews reuse real derived resources and spell DCs", () => {
  for (const id of ["bard", "wizard"]) {
    const d = complete(id, 10),
      before = structuredClone(d),
      p = previewDraft(ctx, config, d);
    assert.ok(p.stats.casting[id]);
    assert.deepEqual(p.stats, compileDraft(ctx, config, d).stats);
    assert.deepEqual(d, before);
  }
});
test("comparing a class retains the previous subclass without deleting class decisions", () => {
  const d = complete("bard", 10),
    before = structuredClone(d),
    entry = ctx.index.class("fighter");
  const p = comparisonPlan(d, entry);
  assert.deepEqual(d, before);
  assert.equal(p.classes[0].id, "fighter");
  assert.deepEqual(p.selections, d.selections);
  assert.ok(
    p.retainedDecisions.some((r) => r.values.includes(d.classes[0].subclassId)),
  );
  assert.deepEqual(comparisonPlan(d, ctx.index.class("bard")), d);
});
test("diagnostics distinguish missing choice, missing content, automation and invalid rule", () => {
  assert.equal(diagnosticKind({ code: "required-choice" }), "required");
  assert.equal(diagnosticKind({ code: "unavailable-subclass" }), "content");
  assert.equal(diagnosticKind({ code: "manual-effect" }), "automation");
  assert.equal(diagnosticKind({ code: "asi-cap" }), "error");
  assert.equal(
    issueStep(
      { code: "required-choice", choiceId: "x" },
      { choices: [{ id: "x", kind: "prepared" }] },
    ),
    "spells",
  );
  assert.equal(
    issueStep(
      { code: "required-choice", choiceId: "x" },
      { choices: [{ id: "x", kind: "expertise" }] },
    ),
    "features",
  );
  assert.equal(issueStep({ code: "score-method" }, {}), "scores");
});
test("discovery guidance filters do not restrict the rules catalogue", () => {
  assert.equal(discoveryMatches("fighter", ["melee", "simple"]), true);
  assert.equal(discoveryMatches("wizard", ["simple"]), false);
  assert.equal(ctx.index.list("class").length, 12);
});

test("vendored assets have auditable hashes and are included in offline packaging", async () => {
  const { readFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const manifest = JSON.parse(
    await readFile(
      new URL("../web/assets/shared/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.assets.length, 67);
  let bytes = 0;
  for (const a of manifest.assets) {
    const b = await readFile(new URL("../web/" + a.path, import.meta.url));
    assert.equal(createHash("sha256").update(b).digest("hex"), a.sha256);
    assert.equal(b.length, a.bytes);
    bytes += b.length;
  }
  assert.equal(bytes, 166648);
  const { assetURL } = await import("../web/app/asset-registry.js");
  assert.equal(assetURL("class", "../secret"), null);
  assert.equal(assetURL("unknown", "bard"), null);
  assert.ok(
    assetURL("class", "bard").endsWith("/assets/shared/classes/bard.webp"),
  );
});
