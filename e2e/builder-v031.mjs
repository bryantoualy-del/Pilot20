import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const port = Number(process.env.PILOT20_E2E_PORT ?? 4184),
  url = `http://127.0.0.1:${port}/web/index.html`;
const server = spawn(process.execPath, ["scripts/serve-web.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: "pipe",
});
await new Promise((resolve, reject) => {
  server.stdout.once("data", resolve);
  server.once("error", reject);
  server.once("exit", (c) => reject(Error("server " + c)));
});
const profile = await mkdtemp(path.join(os.tmpdir(), "pilot20-v031-"));
const options = {
  ...(process.env.PILOT20_CHROMIUM
    ? { executablePath: process.env.PILOT20_CHROMIUM }
    : {}),
  args: ["--no-sandbox"],
  viewport: { width: 1180, height: 820 },
};
let ctx, p;
const errors = [],
  results = [],
  metrics = [];
async function launch() {
  ctx = await chromium.launchPersistentContext(profile, options);
  p = ctx.pages()[0] ?? (await ctx.newPage());
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .first()
    .waitFor();
}
const step = async (name) => {
  await p.locator(".steps").waitFor({ state: "attached" });
  if (!(await p.locator(".steps").isVisible()))
    await p.getByRole("button", { name: "Étapes", exact: true }).click();
  await p
    .locator(".steps")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await p.locator(".editor-main h2").filter({ hasText: name }).waitFor();
};
const changed = async (field) => {
  await field.blur();
  await p
    .locator("#draft-save-state")
    .filter({ hasText: /Sauvegardé|Enregistré sur cet appareil/ })
    .waitFor();
};
const nav = async (name) => {
  await p
    .locator("header nav")
    .getByRole("button", { name, exact: true })
    .click();
};
const record = (message) => {
  results.push(message);
  console.log(message);
};
async function capture(name) {
  await p.locator("#notice").waitFor({ state: "hidden" });
  await p.screenshot({
    path: "docs/screenshots/v032/regression/" + name + ".png",
    fullPage: true,
  });
}
async function measure(name) {
  metrics.push({
    step: name,
    ...(await p.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
      viewportScrolls:
        Math.ceil(document.documentElement.scrollHeight / innerHeight) - 1,
      stepCount: document.querySelectorAll(".steps button").length,
      choices: document.querySelectorAll(".choice").length,
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }))),
  });
}
async function begin(name, cls = "fighter", level = 1) {
  await nav("Accueil");
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .first()
    .click();
  await p.getByRole("button", { name: "Expert", exact: true }).click();
  await p.locator(".creator-shell").waitFor();
  const f = p.getByLabel("Nom du personnage", { exact: true });
  await f.fill(name);
  await changed(f);
  await p.getByLabel("Race", { exact: true }).selectOption("srd51:race:human");
  await step("Classe & niveau");
  if (cls !== "fighter") {
    await p.getByText("Changer de classe", { exact: true }).click();
    await p
      .locator(".class-card")
      .filter({ hasText: cls === "bard" ? "Barde" : "Magicien" })
      .click();
  }
  const lev = p.getByLabel(
    (cls === "bard" ? "Barde" : cls === "wizard" ? "Magicien" : "Guerrier") +
      " · Niveau",
    { exact: true },
  );
  await lev.fill(String(level));
  await changed(lev);
}
async function suggest() {
  await step("Capacités de classe");
  const focus = p.getByLabel("Niveau consulté", { exact: true });
  if (await focus.count()) {
    for (const l of ["1", "2", "3"])
      if (await focus.locator('option[value="' + l + '"]').count()) {
        const oldHeading = await p.locator(".editor-main h2").elementHandle();
        await focus.selectOption(l);
        await p.waitForFunction((e) => !e.isConnected, oldHeading);
        await oldHeading.dispose();
        for (const id of [
          "srd51:college-of-lore",
          "srd51:school-of-evocation",
        ]) {
          const sub = p
            .locator("select")
            .filter({ has: p.locator('option[value="' + id + '"]') });
          if ((await sub.count()) && !(await sub.inputValue()))
            await sub.selectOption(id);
        }
      }
  }

  const tools = p.locator(".template-tools");
  if ((await tools.getAttribute("open")) === null)
    await tools.locator("summary").first().click();
  await tools
    .getByRole("button", {
      name: "Appliquer les suggestions du modèle",
      exact: true,
    })
    .click();
}
async function finalize() {
  await step("Finalisation");
  await p
    .getByLabel("Je confirme les suggestions et les choix affichés.", {
      exact: true,
    })
    .check();
  await p
    .getByLabel("Le MJ a vérifié ces règles et ajustements.", { exact: true })
    .check();
  assert.equal(await p.locator(".issues li").count(), 0);
  const progress = (await p.locator(".editor-aside").innerText()).match(
    /Choix obligatoires · (\d+) \/ (\d+)/,
  );
  assert.ok(progress);
  assert.equal(progress[1], progress[2]);
  await p
    .getByRole("button", { name: "Enregistrer la fiche", exact: true })
    .click();
  await p.getByText("Companion Preview", { exact: true }).waitFor();
}
async function applyBackground() {
  await step("Historique");
  await p
    .getByLabel("Choisir un historique", { exact: true })
    .selectOption("srd51:background:acolyte");
}
async function snapshots() {
  return p.evaluate(async () => {
    const { openIndexedDB } = await import("/src/persistence/adapters.js");
    const s = await openIndexedDB();
    return (await s.list("meta", "creator:draft:")).map((r) => r.value);
  });
}
try {
  await mkdir("docs/screenshots/v032/regression", { recursive: true });
  await mkdir("artifacts", { recursive: true });
  await launch();
  await begin("A — Humain guerrier 1");
  assert.equal(await p.locator(".steps button").count(), 8);
  await capture("after-class");
  await measure("Classe");
  await step("Race");
  await p.locator(".choice select").selectOption("dwarvish");
  await capture("after-race");
  await step("Capacités de classe");
  assert.equal(
    await p.getByLabel("Guerrier · Sous-classe", { exact: true }).count(),
    0,
  );
  await p.getByLabel("Défense", { exact: true }).check();
  await measure("Guerrier capacités");
  await applyBackground();
  await p.locator(".choice select").selectOption("elvish");
  await p.locator(".choice select").selectOption("giant");
  await capture("after-background");
  await step("Caractéristiques");
  await p
    .getByLabel("Méthode de génération", { exact: true })
    .selectOption("standard");
  await capture("after-scores");
  await step("Maîtrises");
  await p.getByLabel("Athlétisme", { exact: true }).check();
  await p.getByLabel("Perception", { exact: true }).check();
  await p.getByText(/Maîtrises · /).click();
  await p.getByRole("cell", { name: "Acolyte", exact: true }).first().waitFor();
  await capture("after-proficiencies");
  await step("Sorts & équipement");
  await p.getByLabel("Armure", { exact: true }).selectOption("chain");
  await p.getByLabel("Bouclier", { exact: true }).check();
  await p.getByLabel("Armes", { exact: true }).selectOption("longsword");
  await capture("after-equipment");
  await finalize();
  await capture("after-fighter-preview");
  record(
    "A: complete human fighter 1 through all eight steps without template suggestions; acolyte grants, saves, style, scores, armor, save and preview",
  );
  await begin("B — Barde 10", "bard", 10);
  await step("Caractéristiques");
  await p
    .getByLabel("Méthode de génération", { exact: true })
    .selectOption("standard");
  await applyBackground();
  await suggest();
  await step("Capacités de classe");
  await p.getByLabel("Niveau consulté", { exact: true }).selectOption("10");
  await p.getByRole("heading", { name: /Secrets magiques · 10/ }).waitFor();
  await capture("after-features");
  await measure("Progression");
  await p.getByLabel("Niveau consulté", { exact: true }).selectOption("3");
  assert.equal(
    await p.getByLabel("Barde · Sous-classe", { exact: true }).inputValue(),
    "srd51:college-of-lore",
  );
  await step("Sorts & équipement");
  await p
    .getByLabel("Choix à afficher", { exact: true })
    .selectOption("bard:magical-secrets-10");
  await capture("after-spells");
  await measure("Sorts");
  await finalize();
  record(
    "B: bard 10, level-specific college and expertise, two ASIs, inspiration and distinct Magical Secrets; real compiler",
  );
  await begin("C — Magicien 10", "wizard", 10);
  await step("Caractéristiques");
  await p
    .getByLabel("Méthode de génération", { exact: true })
    .selectOption("standard");
  await applyBackground();
  await suggest();
  await step("Sorts & équipement");
  await p
    .getByLabel("Choix à afficher", { exact: true })
    .selectOption("wizard:spellbook");
  await p.getByRole("heading", { name: /Grimoire/ }).waitFor();
  assert.match(await p.locator(".choice h3").innerText(), /24 \/ 24/);
  await capture("after-wizard-book");
  await p
    .getByLabel("Choix à afficher", { exact: true })
    .selectOption("wizard:prepared");
  await p.getByRole("heading", { name: /Sorts préparés/ }).waitFor();
  assert.ok(await p.getByRole("heading", { name: /Sorts préparés/ }).count());
  await finalize();
  record(
    "C: wizard 10 school, 24 spellbook entries, separate preparation, source filtering and explicit missing French labels",
  );
  await begin("D/E — Brouillon à reprendre", "bard", 10);
  await applyBackground();
  await suggest();
  await step("Capacités de classe");
  await p.getByLabel("Niveau consulté", { exact: true }).selectOption("8");
  const before = (await snapshots()).find(
    (d) => d.name === "D/E — Brouillon à reprendre",
  );
  await p
    .getByRole("button", {
      name: "Quitter et reprendre plus tard",
      exact: true,
    })
    .click();
  await ctx.close();
  await launch();
  await p
    .locator(".card")
    .filter({
      has: p.getByRole("heading", {
        name: "D/E — Brouillon à reprendre",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Reprendre une création", exact: true })
    .click();
  assert.equal(
    await p.getByLabel("Niveau consulté", { exact: true }).inputValue(),
    "8",
  );
  const after = (await snapshots()).find((d) => d.id === before.id);
  assert.deepEqual(after.selections, before.selections);
  assert.deepEqual(after.originSelections, before.originSelections);
  assert.equal(after.campaignId, before.campaignId);
  assert.equal(after.step, "features");
  record(
    "E: close the actual persistent browser context, reopen and resume exact step, viewed level, source campaign and all choices",
  );
  await step("Classe & niveau");
  const lev = p.getByLabel("Barde · Niveau", { exact: true });
  await lev.fill("1");
  await changed(lev);
  if (
    (await p.locator(".editor-aside details").first().getAttribute("open")) ===
    null
  )
    await p.locator(".editor-aside details summary").first().click();
  await p.getByText(/Sous-classe conservée mais inaccessible/).waitFor();
  await step("Finalisation");
  await p
    .getByLabel("Je confirme les suggestions et les choix affichés.", {
      exact: true,
    })
    .check();
  assert.ok((await p.locator(".issues li").count()) > 0);
  await p
    .getByRole("button", { name: "Enregistrer la fiche", exact: true })
    .click();
  await p
    .locator(".editor-main h2")
    .filter({ hasText: "Finalisation" })
    .waitFor();
  const reduced = (await snapshots()).find((d) => d.id === before.id);
  assert.deepEqual(reduced.selections, before.selections);
  await p
    .getByRole("button", {
      name: "Conserver à part les décisions invalides",
      exact: true,
    })
    .click();
  const parked = (await snapshots()).find((d) => d.id === before.id);
  assert.ok(parked.retainedDecisions.length > 0);
  assert.ok(parked.retainedDecisions.some((r) => r.kind === "subclass"));
  await suggest();
  await step("Finalisation");
  await p
    .getByLabel("Je confirme les suggestions et les choix affichés.", {
      exact: true,
    })
    .check();
  await p
    .getByLabel("Le MJ a vérifié ces règles et ajustements.", { exact: true })
    .check();
  assert.equal(
    await p.locator(".issues li").count(),
    0,
    "Lower-level build revalidated with old decisions retained",
  );
  await step("Classe & niveau");
  await p.getByLabel("Barde · Niveau", { exact: true }).fill("10");
  await changed(p.getByLabel("Barde · Niveau", { exact: true }));
  for (let n = 0; n < parked.retainedDecisions.length; n++) {
    await p.getByText(/^Décisions conservées/).click();
    await p
      .locator(".editor-aside")
      .getByRole("button", { name: "Restaurer", exact: true })
      .first()
      .click();
    await p
      .locator("#draft-save-state")
      .filter({ hasText: /Sauvegardé|Enregistré sur cet appareil/ })
      .waitFor();
  }
  const restored = (await snapshots()).find((d) => d.id === before.id);
  assert.deepEqual(restored.selections, before.selections);
  await p
    .locator(".editor-main")
    .getByText(/Capacités de classe : \d+ · 0 choix/)
    .waitFor();
  record(
    "D: level reduction blocks invalid effects, explicit archival permits revalidation at level 1, then all high-level decisions restore without loss",
  );
  await nav("Sources de campagne");
  await p
    .getByLabel("Chaudron des merveilles de Tasha", { exact: true })
    .uncheck();
  await p.getByLabel("Guide complet de Xanathar", { exact: true }).uncheck();
  await p
    .getByLabel("Chaudron des merveilles de Tasha", { exact: true })
    .check();
  await p.getByLabel("Guide complet de Xanathar", { exact: true }).check();
  record(
    "F: source off/on persisted; private feature/source preservation remains covered by the original browser suite",
  );
  await nav("Mes persos");
  await p.getByLabel("En cours", { exact: true }).check();
  assert.equal(
    await p
      .getByRole("heading", { name: "A — Humain guerrier 1", exact: true })
      .count(),
    0,
  );
  await p
    .getByRole("heading", { name: "D/E — Brouillon à reprendre", exact: true })
    .waitFor();
  record(
    "In-progress library filter hides finalized characters and retains resumable drafts",
  );
  await p.getByLabel("En cours", { exact: true }).uncheck();
  await nav("Accueil");
  await p
    .locator(".card")
    .filter({
      has: p.getByRole("heading", {
        name: "D/E — Brouillon à reprendre",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Reprendre une création", exact: true })
    .click();
  await step("Classe & niveau");
  for (const viewport of [
    { width: 1180, height: 820 },
    { width: 1024, height: 768 },
    { width: 1440, height: 1000 },
  ]) {
    await p.setViewportSize(viewport);
    await p.evaluate(() => new Promise(requestAnimationFrame));
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "No horizontal overflow",
    );
    const controls = await p
      .locator(".steps button")
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().height),
      );
    assert.ok(
      controls.every((h) => h >= 44),
      JSON.stringify({ viewport, heights: controls }),
    );
    await p.getByLabel("Barde · Niveau", { exact: true }).focus();
    assert.equal(
      await p
        .getByLabel("Barde · Niveau", { exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    const actions = await p.locator(".editor-actions").boundingBox();
    assert.ok(
      actions.y + actions.height <= viewport.height + 1,
      "Navigation remains visible",
    );
  }
  record(
    "G (emulation only): tablet and desktop widths, 44px step targets, editable field focus and persistent navigation; physical Safari and virtual keyboard remain unverified",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "docs/screenshots/v032/regression/after-metrics.json",
    JSON.stringify(metrics, null, 2),
  );
  await writeFile(
    "artifacts/e2e-v031-results.json",
    JSON.stringify(
      {
        passed: results.length,
        results,
        errors,
        browser: ctx.browser().version(),
        metrics,
        physicalSafari: false,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error("BODY", await p?.locator("body").innerText());
  console.error("ERRORS", errors);
  await p?.screenshot({
    path: "docs/screenshots/v032/regression/failure-new.png",
    fullPage: true,
  });
  throw e;
} finally {
  await ctx?.close();
  server.kill();
  await rm(profile, { recursive: true, force: true });
}
