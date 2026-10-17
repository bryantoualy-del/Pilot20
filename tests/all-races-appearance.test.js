import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classCatalog,
  spellCatalog,
  originCatalog,
} from "../src/catalog/srd51-catalog.js";
import { campaignCatalog, defaultCampaign } from "../src/campaign/sources.js";
import { RACE_FAMILIES } from "../src/catalog/race-discovery.js";
import {
  newDraft,
  draftProgression,
  compileDraft,
} from "../src/creator/model.js";
import { recommendQuick } from "../src/creator/quick.js";
import { validateDraft } from "../src/creator/repository.js";
import {
  raceOptions,
  raceSelection,
  selectRace,
  manualRaceVariants,
  selectRaceVariant,
} from "../src/creator/race-selection.js";
import {
  GENDERS,
  portraitAsset,
  refreshPortrait,
  isBuiltInPortrait,
} from "../src/creator/appearance.js";
const config = defaultCampaign(),
  context = campaignCatalog(
    [classCatalog, spellCatalog, originCatalog],
    [],
    config,
  );
function ready(input) {
  const d = recommendQuick(context, config, input);
  for (const q of draftProgression(context, config, d).choices.filter(
    (q) => q.kind === "feature",
  ))
    d.selections[q.id] = q.options.slice(0, q.count);
  d.confirmed = d.reviewed = true;
  return d;
}
test("all 59 families selectable with both gender portraits and no fabricated mechanics", () => {
  const options = raceOptions(context);
  assert.equal(
    options.filter(([id]) => id.startsWith("manual-race:")).length,
    59,
  );
  for (const f of RACE_FAMILIES) {
    const option = options.find(
      ([id]) =>
        id === "manual-race:" + f.slug ||
        context.index.get(id)?.name.en === f.name_en,
    );
    assert.ok(option, f.slug);
    for (const gender of GENDERS) {
      const d = newDraft();
      d.name = f.nom_fr;
      d.gender = gender;
      selectRace(context, d, option[0]);
      assert.equal(d.portrait, portraitAsset(f.slug, gender));
      validateDraft(d);
      if (d.raceId) {
        const race = context.index.get(d.raceId);
        d.subraceId = race.data.subraces[0]?.id ?? null;
      }
      const q = ready(d),
        result = compileDraft(context, config, q);
      assert.equal(result.valid, true, f.slug + JSON.stringify(result.issues));
      assert.equal(result.character.identity.gender, gender);
      assert.equal(result.character.identity.portrait, d.portrait);
      if (d.manualRace) {
        assert.deepEqual(result.character.scores, q.scores);
        assert.equal(result.character.ancestry.id, "user:race:" + f.slug);
        assert.match(result.character.identity.description, /manuellement/);
        q.reviewed = false;
        assert.equal(compileDraft(context, config, q).valid, false);
      }
    }
    assert.notEqual(
      portraitAsset(f.slug, "femme"),
      portraitAsset(f.slug, "homme"),
    );
  }
});
test("race variants, manual speed and identity survive JSON round trip", () => {
  const d = newDraft();
  d.name = "Kobold";
  selectRace(context, d, "manual-race:kobold");
  const variants = manualRaceVariants(d);
  assert.ok(variants.length >= 2);
  selectRaceVariant(d, variants.at(-1).rulesVersionId);
  d.gender = "femme";
  refreshPortrait(context, d);
  d.manualSpeed = 25;
  const copy = validateDraft(JSON.parse(JSON.stringify(d)));
  assert.equal(raceSelection(copy), "manual-race:kobold");
  assert.equal(copy.manualRace.variantId, variants.at(-1).rulesVersionId);
  const result = compileDraft(context, config, ready(copy));
  assert.equal(result.character.movement.walk, 25);
  assert.equal(result.character.identity.gender, "femme");
  assert.match(result.character.identity.description, /Kobold/);
});
test("changing race or gender preserves an imported portrait until explicit reset", () => {
  const d = newDraft();
  d.portrait = "data:image/png;base64,AAAA";
  selectRace(context, d, "manual-race:kobold");
  d.gender = "femme";
  refreshPortrait(context, d);
  assert.equal(d.portrait, "data:image/png;base64,AAAA");
  refreshPortrait(context, d, { force: true });
  assert.equal(d.portrait, portraitAsset("kobold", "femme"));
  selectRace(context, d, "srd51:race:human");
  assert.equal(d.manualRace, null);
  assert.equal(d.portrait, portraitAsset("humain", "femme"));
});
test("external portrait paths, unknown genders and mismatched variants rejected", () => {
  assert.equal(isBuiltInPortrait("https://example.org/portrait.webp"), false);
  const d = newDraft();
  d.portrait = "./assets/shared/races/../../x.webp";
  assert.throws(() => validateDraft(d));
  d.portrait = "";
  d.gender = "other";
  assert.throws(() => validateDraft(d));
  d.gender = "";
  selectRace(context, d, "manual-race:kobold");
  d.manualRace.variantId = "unknown";
  assert.throws(() => validateDraft(d));
  assert.throws(() => selectRace(context, d, "manual-race:unknown"));
});

test("every race has two distinct shipped portraits with verified manifest hashes", async () => {
  const { readFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const manifest = JSON.parse(
    await readFile(
      new URL("../web/assets/shared/races/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const assets = [...manifest.families, ...manifest.portraitVariants];
  const paths = new Set();
  for (const f of RACE_FAMILIES)
    for (const gender of ["femme", "homme"]) {
      const relative = "web/" + portraitAsset(f.slug, gender).slice(2);
      paths.add(relative);
      const record = assets.find((a) => a.file === relative);
      assert.ok(record, relative);
      const bytes = await readFile(new URL("../" + relative, import.meta.url));
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        record.sha256,
        relative,
      );
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    }
  assert.equal(paths.size, 118);
});
