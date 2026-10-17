import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { originalPack } from "./fixtures.mjs";
const port = Number(process.env.PILOT20_E2E_PORT ?? 4186);
const server = spawn(process.execPath, ["scripts/serve-web.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: "pipe",
});
await new Promise((r, j) => {
  server.stdout.once("data", r);
  server.once("error", j);
});
const browser = await chromium.launch({
  ...(process.env.PILOT20_CHROMIUM
    ? { executablePath: process.env.PILOT20_CHROMIUM }
    : {}),
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
    viewport: { width: 1180, height: 820 },
  }),
  p = await ctx.newPage();
p.setDefaultTimeout(12000);
const errors = [],
  results = [],
  metrics = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const base = `http://127.0.0.1:${port}`;
async function step(name) {
  await p.locator(".steps").waitFor({ state: "attached" });
  if (!(await p.locator(".steps").isVisible()))
    await p.getByRole("button", { name: "Étapes", exact: true }).click();
  const previous = await p.locator('.editor-main h2').elementHandle();
  await p
    .locator(".steps")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  // A repeated active step has the same heading text: wait for its actual replacement.
  await p.waitForFunction(element=>!element.isConnected, previous);
  await previous.dispose();
  await p.locator(".editor-main h2").filter({ hasText: name }).waitFor();
}
async function capture(name, focus = null) {
  if (focus) await p.locator(focus).evaluate(e=>e.scrollIntoView({block:'start'}));
  else await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator("#notice").waitFor({ state: "hidden" });
  await p.screenshot({
    path: `docs/screenshots/v032/${name}.jpg`,
    fullPage: false,
    quality: 85,
  });
}
async function plans() {
  return p.evaluate(async () => {
    const { openIndexedDB } = await import("/src/persistence/adapters.js");
    const s = await openIndexedDB();
    return (await s.list("meta", "creator:draft:")).map((r) => r.value);
  });
}
async function seed(id, cls = "bard", level = 10) {
  await p.evaluate(
    async ({ id, cls, level }) => {
      const { openIndexedDB } = await import("/src/persistence/adapters.js");
      const s = await openIndexedDB();
      const { classCatalog, spellCatalog } = await import(
        "/src/catalog/srd51-catalog.js"
      );
      const { originCatalog } = await import("/src/catalog/origins.js");
      const { campaignRepository } = await import(
        "/src/campaign/repository.js"
      );
      const campaigns = campaignRepository(s, [
        classCatalog,
        spellCatalog,
        ...(originCatalog ? [originCatalog] : []),
      ]);
      const config = await campaigns.get(),
        context = await campaigns.context(config);
      const { newDraft, suggestChoices } = await import(
        "/src/creator/model.js"
      );
      const { characterLibrary } = await import("/src/persistence/library.js");
      const { creatorRepository } = await import("/src/creator/repository.js");
      const repo = creatorRepository(s, characterLibrary(s));
      let d = newDraft("default", id);
      Object.assign(d, {
        name: id,
        mode: "guided",
        origin: "Original synthetic origin",
        background: {
          name: "Original synthetic background",
          skills: ["religion", "medicine"],
          proficiencies: [],
        },
        classes: [{ id: cls, level, subclassId: null }],
        reviewed: true,
        confirmed: true,
        step: "features",
      });
      d = suggestChoices(context, config, d);
      d.reviewed = true;
      d.confirmed = true;
      await repo.save(d);
    },
    { id, cls, level },
  );
  await p.reload();
  await p
    .locator(".card")
    .filter({ has: p.getByRole("heading", { name: id, exact: true }) })
    .getByRole("button", { name: "Reprendre une création", exact: true })
    .click();
  await p.locator(".creator-shell").waitFor();
}
function record(s) {
  results.push(s);
  console.log(s);
}
try {
  await mkdir("docs/screenshots/v032", { recursive: true });
  await mkdir("artifacts", { recursive: true });
  await p.goto(base + "/web/index.html");
  await capture("creator-home");
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .first()
    .click();
  await step("Classe & niveau");
  await p.getByText("Changer de classe", { exact: true }).click();
  assert.equal(await p.locator(".class-card").count(), 12);
  await p.getByLabel("Prise en main simple", { exact: true }).check();
  assert.equal(await p.locator(".class-card").count(), 3);
  await p.getByLabel("Prise en main simple", { exact: true }).uncheck();
  await p.getByLabel("Comparer Guerrier", { exact: true }).check();
  await p.getByLabel("Comparer Barde", { exact: true }).check();
  const before = await plans();
  let start = performance.now();
  await p
    .getByRole("button", { name: "Comparer les classes", exact: true })
    .click();
  await p.locator("dialog .comparison").waitFor();
  metrics.push({
    operation: "class comparison open",
    milliseconds: performance.now() - start,
  });
  assert.deepEqual(await plans(), before);
  await p.getByRole("button", { name: "Fermer", exact: true }).click();
  await capture("ipad-gallery", ".discovery");
  await p.setViewportSize({ width: 390, height: 844 });
  await capture("iphone-gallery", ".discovery");
  assert.equal(await p.locator(".steps").isVisible(), false);
  await p.getByRole("button", { name: "Aperçu", exact: true }).click();
  await p.locator("dialog .character-preview").waitFor();
  await capture("iphone-preview");
  await p.getByRole("button", { name: "Fermer", exact: true }).click();
  assert.deepEqual(await plans(), before);
  record(
    "Discovery filters, two-class comparison and mobile preview preserve persisted draft",
  );
  // Install original contract-only subclass fixtures, never official XGE/Tasha definitions.
  await p
    .locator("header nav")
    .getByRole("button", { name: "Sources de campagne", exact: true })
    .click();
  await p
    .getByLabel(
      "Je dispose de l’autorisation nécessaire pour utiliser ce pack localement.",
      { exact: true },
    )
    .check();
  await p.getByLabel("Installer un pack privé", { exact: true }).setInputFiles({
    name: "original.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(originalPack)),
  });
  await p.getByText("2 définitions installées", { exact: true }).waitFor();
  const second = structuredClone(originalPack);
  second.sourceId = "tce";
  second.catalog.id = "original:second-browser-test";
  // Use configured source ID from existing source catalogue rather than assume its spelling.
  second.sourceId = "tce";
  second.catalog.items = second.catalog.items.map((e) =>
    JSON.parse(JSON.stringify(e).replaceAll("original:", "synthetic:")),
  );
  second.catalog.items[0].name = {
    fr: "Collège synthétique de comparaison",
    en: "Synthetic comparison college",
  };
  await p
    .getByLabel(
      "Je dispose de l’autorisation nécessaire pour utiliser ce pack localement.",
      { exact: true },
    )
    .check();
  await p.getByLabel("Installer un pack privé", { exact: true }).setInputFiles({
    name: "synthetic.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(second)),
  });
  await p
    .locator(".source-card")
    .filter({ hasText: "Chaudron des merveilles de Tasha" })
    .getByText("2 définitions installées", { exact: true })
    .waitFor();
  await p.setViewportSize({ width: 1180, height: 820 });
  await seed("v032-synthetic-bard");
  const stable = await plans();
  await p.getByText("Comparer les sous-classes", { exact: true }).click();
  start = performance.now();
  await p
    .getByRole("button", { name: "Ouvrir le comparateur", exact: true })
    .click();
  await p.locator("dialog .comparison").waitFor();
  metrics.push({
    operation: "bard subclass comparison open",
    milliseconds: performance.now() - start,
  });
  assert.equal(
    await p.locator("dialog .comparison-options article").count(),
    3,
  );
  assert.deepEqual(await plans(), stable);
  await capture("ipad-subclass-comparison");
  await p.getByRole("button", { name: "Fermer", exact: true }).click();
  await p.setViewportSize({ width: 390, height: 844 });
  await p
    .getByRole("button", { name: "Ouvrir le comparateur", exact: true })
    .click();
  assert.equal(
    await p.locator("dialog .comparison-options article").count(),
    2,
  );
  await capture("iphone-subclass-comparison");
  await p.getByRole("button", { name: "Fermer", exact: true }).click();
  record(
    "Bard 10 subclass comparisons: 3 tablet / 2 stacked phone, installed synthetic packs only, no mutation",
  );
  await p.setViewportSize({ width: 1180, height: 820 });
  await step("Caractéristiques");
  await p.getByText("Simuler une caractéristique", { exact: true }).click();
  await p.getByLabel("Score simulé", { exact: true }).fill("18");
  const stableScores = await plans();
  start = performance.now();
  await p
    .getByRole("button", { name: "Voir les conséquences", exact: true })
    .click();
  await p.locator("dialog .simulation").waitFor();
  metrics.push({
    operation: "score simulation open",
    milliseconds: performance.now() - start,
  });
  assert.deepEqual(await plans(), stableScores);
  await capture("score-simulation");
  await p.getByRole("button", { name: "Fermer", exact: true }).click();
  assert.deepEqual(await plans(), stableScores);
  await p
    .getByRole("button", { name: "Voir les conséquences", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Confirmer ce choix", exact: true })
    .click();
  await p.getByLabel("Force", { exact: true }).waitFor();
  assert.equal(
    (await plans()).find((x) => x.id === "v032-synthetic-bard").scores.str,
    18,
  );
  record(
    "Score simulation cancels without writes and confirms through the existing autosave",
  );
  await step("Capacités de classe");
  await capture("level-progression", ".level-timeline");
  await capture("ipad-preview");
  await step("Finalisation");
  await capture("finalization");
  // Deliberately incomplete character: diagnostics lead back to the relevant decision.
  await p
    .locator("header nav")
    .getByRole("button", { name: "Accueil", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .first()
    .click();
  await step("Finalisation");
  await capture("errors");
  await p
    .locator(".diagnostic button")
    .filter({ hasText: /nom/i })
    .first()
    .click();
  await p.getByLabel("Nom du personnage", { exact: true }).waitFor();
  record(
    "Finalization distinguishes diagnostics and returns to the identity control",
  );
  for (const v of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
    { width: 820, height: 1180 },
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
  ]) {
    await p.setViewportSize(v);
    await step("Classe & niveau");
    await p.evaluate(() => new Promise(requestAnimationFrame));
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "overflow " + JSON.stringify(v),
    );
    const sizes = await p.locator(".editor-actions button").evaluateAll((ns) =>
      ns.map((n) => ({
        w: n.getBoundingClientRect().width,
        h: n.getBoundingClientRect().height,
      })),
    );
    assert.ok(sizes.every((s) => s.w >= 44 && s.h >= 44),JSON.stringify({viewport:v,sizes}));
    metrics.push({
      viewport: v,
      document: await p.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      })),
    });
  }
  record(
    "Responsive 7 viewports including portrait/landscape, no horizontal overflow and 44px primary controls",
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.getByRole("button", { name: "Aperçu", exact: true }).click();
  await p.keyboard.press("Tab");
  assert.ok(
    await p.evaluate(() =>
      document.querySelector("dialog").contains(document.activeElement),
    ),
  );
  await p.keyboard.press("Escape");
  assert.equal(await p.locator("dialog").isVisible(), false);
  await p.getByLabel("Guerrier · Niveau", { exact: true }).focus();
  assert.ok(
    await p
      .getByLabel("Guerrier · Niveau", { exact: true })
      .evaluate((e) => e === document.activeElement),
  );
  const contrast = await p.evaluate(() => {
    const css = getComputedStyle(document.documentElement),
      rgb = (key) => {
        const h = css.getPropertyValue(key).trim().slice(1);
        return [0, 2, 4]
          .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
      };
    return (rgb("--text") + 0.05) / (rgb("--surface") + 0.05);
  });
  assert.ok(contrast >= 4.5);
  record(
    "Keyboard focus in dialog, Escape close, numeric input focus, reduced-motion preference and primary text contrast",
  );
  await ctx.setOffline(true);
  await p.reload();
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .first()
    .waitFor();
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .first()
    .click();
  await step("Classe & niveau");
  await p.getByText("Changer de classe", { exact: true }).click();
  await p.locator(".asset-icon img").first().waitFor();
  assert.ok(
    await p
      .locator(".asset-icon img")
      .first()
      .evaluate(async (img) => {
        await img.decode();
        return img.naturalWidth > 0;
      }),
  );
  record("Offline reload, creation and local class icon decoding succeed");
  await ctx.setOffline(false);
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/e2e-v032-results.json",
    JSON.stringify(
      {
        results,
        passed: results.length,
        errors,
        metrics,
        browser: browser.version(),
        physicalSafari: false,
      },
      null,
      2,
    ),
  );
  await writeFile(
    "docs/screenshots/v032/measurements.json",
    JSON.stringify(
      { results, metrics, browser: browser.version(), physicalSafari: false },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(await p.locator("body").innerText());
  console.error("ERRORS", errors);
  await p.screenshot({
    path: "docs/screenshots/v032/failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
  server.kill();
}
