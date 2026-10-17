import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const port = 4195,
  server = spawn(process.execPath, ["scripts/serve-web.mjs"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "pipe",
  });
await new Promise((r) => server.stdout.once("data", r));
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
p.setDefaultTimeout(15000);
const errors = [],
  results = [],
  metrics = { interactions: 0, screens: 0, heights: [] };
p.on("pageerror", (e) => errors.push(e.message));
await mkdir("docs/screenshots/races", { recursive: true });
await mkdir("artifacts", { recursive: true });
let measuring = true;
const click = async (l) => {
    await l.click();
    if (measuring) metrics.interactions++;
  },
  change = async (l, value) => {
    const old = await p.locator(".quick-header").elementHandle();
    if (await l.evaluate((e) => e.tagName === "SELECT"))
      await l.selectOption(value);
    else {
      await l.fill(value);
      await l.blur();
    }
    if (measuring) metrics.interactions++;
    await p.waitForFunction((e) => !e.isConnected, old);
    await old.dispose();
    await p
      .locator("#draft-save-state")
      .filter({ hasText: /Sauvegardé|Enregistré/ })
      .waitFor();
  };
const next = async (title) => {
  await click(p.getByRole("button", { name: "Continuer", exact: true }));
  await p.getByRole("heading", { name: title, exact: true }).waitFor();
  metrics.screens++;
  metrics.heights.push(
    await p.evaluate(() => ({
      title: document.querySelector(".quick-header h1").textContent,
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
    })),
  );
};
try {
  await p.goto(`http://127.0.0.1:${port}/web/index.html`);
  await p.getByText("Disponible hors ligne", { exact: true }).waitFor();
  const start = performance.now();
  await click(
    p.getByRole("button", { name: "Créer un personnage", exact: true }).first(),
  );
  metrics.screens++;
  await change(
    p.getByLabel("Nom du personnage", { exact: true }),
    "Quick fighter",
  );
  await change(p.getByLabel("Classe", { exact: true }), "fighter");
  await change(p.getByLabel("Race", { exact: true }), "srd51:race:human");
  assert.equal(
    await p
      .locator("main")
      .evaluate((e) => /(^|\s)null(\s|$)/.test(e.textContent)),
    false,
  );
  for (const [name, width, height] of [
    ["ipad-landscape", 1180, 820],
    ["ipad-portrait", 820, 1180],
    ["iphone-375", 375, 812],
    ["iphone-390", 390, 844],
    ["iphone-430", 430, 932],
    ["desktop", 1440, 900],
  ]) {
    await p.setViewportSize({ width, height });
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await p.screenshot({
      path: `docs/screenshots/races/quick-${name}.png`,
      fullPage: true,
    });
  }
  await p.setViewportSize({ width: 1180, height: 820 });
  await next("Donnez-lui votre style");
  assert.equal(
    await p.getByRole("heading", { name: "Sous-classe", exact: true }).count(),
    0,
  );
  await next("Prêt à jouer");
  await click(
    p.getByRole("button", {
      name: "Accepter ces recommandations",
      exact: true,
    }),
  );
  await p
    .getByRole("heading", { name: "Choix confirmés", exact: true })
    .waitFor();
  for (const field of await p.locator("fieldset").all()) {
    const options = field.locator("input[type=checkbox]");
    await click(options.first());
    await p.waitForFunction(
      () => document.querySelectorAll("fieldset").length === 0,
    );
  }
  await click(
    p.getByLabel("Je confirme les suggestions et les choix affichés.", {
      exact: true,
    }),
  );
  await click(
    p.getByLabel("Vérifications manuelles confirmées", { exact: true }),
  );
  await p.screenshot({
    path: "docs/screenshots/races/quick-ready.png",
    fullPage: true,
  });
  metrics.heights.push(
    await p.evaluate(() => ({
      stage: "confirmed-summary",
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
    })),
  );
  const save = p.getByRole("button", {
    name: "Sauvegarder et ouvrir le Companion",
    exact: true,
  });
  assert.equal(await save.isEnabled(), true);
  await click(save);
  await p.getByText("Companion Preview", { exact: true }).waitFor();
  metrics.milliseconds = performance.now() - start;
  assert.equal(metrics.screens, 3);
  assert.ok(metrics.interactions < 22);
  results.push(
    "A: quick fighter human SRD, three screens, explicit confirmation, saved Companion",
  );
  measuring = false;
  await p.getByRole("button", { name: "Accueil", exact: true }).first().click();
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .first()
    .click();
  await change(
    p.getByLabel("Nom du personnage", { exact: true }),
    "Subclass test",
  );
  await change(p.getByLabel("Race", { exact: true }), "srd51:race:human");
  await change(p.getByLabel("Niveau", { exact: true }), "3");
  await p.getByRole("button", { name: "Continuer", exact: true }).click();
  await p.getByRole("heading", { name: "Sous-classe", exact: true }).waitFor();
  assert.equal(
    await p.getByRole("button", { name: "Continuer", exact: true }).isEnabled(),
    false,
  );
  const previousSubclassHeader = await p
    .locator(".quick-header")
    .elementHandle();
  await p.getByRole("button", { name: /Champion/ }).click();
  await p.waitForFunction(
    (element) => !element.isConnected,
    previousSubclassHeader,
  );
  await previousSubclassHeader.dispose();
  assert.equal(
    await p.getByRole("button", { name: "Continuer", exact: true }).isEnabled(),
    true,
  );
  results.push("B: fighter 3 requires explicit active subclass");
  await p.getByRole("button", { name: "Mon personnage", exact: true }).click();
  await p.locator("dialog[open]").waitFor();
  assert.ok(
    await p.locator("dialog").getByText("Champion", { exact: false }).count(),
  );
  await p.keyboard.press("Escape");
  assert.equal(await p.locator("dialog[open]").count(), 0);
  results.push(
    "My character dialog, keyboard Escape and return to same screen",
  );
  await p.getByRole("button", { name: "Retour", exact: true }).click();
  await p
    .locator("details")
    .filter({
      has: p.locator("summary").filter({ hasText: "Explorer les 59 peuples" }),
    })
    .locator(":scope > summary")
    .click();
  await p.getByLabel("Rechercher une race", { exact: true }).fill("kobold");
  await p.locator(".race-card h3").filter({ hasText: "Kobold" }).waitFor();
  assert.equal(await p.locator(".race-card").count(), 1);
  assert.ok(
    await p
      .locator(".race-card")
      .getByText("Traits manuels", { exact: true })
      .count(),
  );
  await p
    .locator(".race-card")
    .getByRole("button", { name: "Choisir Kobold", exact: true })
    .click();
  await p
    .getByLabel("Race", { exact: true })
    .locator("option:checked")
    .filter({ hasText: "Kobold" })
    .waitFor({ state: "attached" });
  await change(p.getByLabel("Femme / Homme", { exact: true }), "femme");
  assert.match(
    await p
      .getByAltText("Portrait du personnage", { exact: true })
      .getAttribute("src"),
    /kobold-femme.webp$/,
  );
  await p
    .getByLabel("Variante / version", { exact: true })
    .selectOption("kobold/motm-2022");
  await p
    .getByLabel("Variante / version", { exact: true })
    .locator("option:checked")
    .filter({ hasText: "motm" })
    .waitFor({ state: "attached" });
  await p.screenshot({
    path: "docs/screenshots/races/kobold-discovery.png",
    fullPage: true,
  });
  results.push(
    "All 59 races selectable; Kobold woman portrait and MotM metadata variant without pack",
  );
  await ctx.setOffline(true);
  await p.reload();
  await p
    .getByRole("button", { name: "Bibliothèque", exact: true })
    .first()
    .click();
  await p
    .locator(".card")
    .filter({ hasText: "Subclass test" })
    .getByRole("button", { name: "Reprendre une création", exact: true })
    .click();
  await p.locator(".quick-creator").waitFor();
  assert.equal(
    await p.getByLabel("Femme / Homme", { exact: true }).inputValue(),
    "femme",
  );
  assert.equal(
    await p.getByLabel("Race", { exact: true }).inputValue(),
    "manual-race:kobold",
  );
  assert.equal(
    await p.getByLabel("Variante / version", { exact: true }).inputValue(),
    "kobold/motm-2022",
  );
  await ctx.setOffline(false);
  results.push(
    "Offline reload restores race, variant, gender, draft and local assets",
  );
  await p.getByRole("button", { name: "Créer une race", exact: true }).click();
  const dialog = p.locator("dialog");
  await dialog
    .getByLabel("Nom", { exact: true })
    .fill("Race originale navigateur");
  await dialog.getByLabel("Nom", { exact: true }).blur();
  await dialog
    .getByLabel("Race relue par le MJ, autoriser dans cette campagne", {
      exact: true,
    })
    .check();
  await dialog
    .getByRole("button", { name: "Aperçu sans sauvegarder", exact: true })
    .click();
  await dialog
    .getByRole("alert")
    .filter({ hasText: "Aperçu provisoire" })
    .waitFor();
  await dialog.screenshot({ path: "docs/screenshots/races/race-editor.png" });
  await dialog
    .getByRole("button", { name: "Enregistrer et utiliser", exact: true })
    .click();
  await p.locator("dialog[open]").waitFor({ state: "hidden" });
  await p
    .getByLabel("Race", { exact: true })
    .locator("option:checked")
    .filter({ hasText: "Race originale navigateur" })
    .waitFor({ state: "attached" });
  results.push(
    "Homebrew graphical creation, non-saving preview, GM authorization and reusable installation",
  );
  await p.getByRole("button", { name: "Créer une race", exact: true }).click();
  await dialog.getByLabel("Parcours", { exact: true }).selectOption("tasha");
  await dialog
    .getByLabel("Autoriser l’option Lignée sur mesure dans cette campagne", {
      exact: true,
    })
    .check();
  await dialog.getByLabel("Nom", { exact: true }).fill("Lignée navigateur");
  await dialog.getByLabel("Nom", { exact: true }).blur();
  await dialog
    .getByLabel("Don installé", { exact: true })
    .selectOption("srd51:grappler");
  await dialog
    .getByLabel("Le MJ autorise cette lignée et cette langue", { exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Enregistrer et utiliser", exact: true })
    .click();
  await p.locator("dialog[open]").waitFor({ state: "hidden" });
  await p
    .getByLabel("Race", { exact: true })
    .locator("option:checked")
    .filter({ hasText: "Lignée navigateur" })
    .waitFor({ state: "attached" });
  results.push(
    "Tasha assistant: campaign authorization, installed feat, GM review and resume",
  );
  await p.getByRole("button", { name: "Accueil", exact: true }).first().click();
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .first()
    .click();
  await change(
    p.getByLabel("Nom du personnage", { exact: true }),
    "Kobold aventurière",
  );
  await change(p.getByLabel("Race", { exact: true }), "manual-race:kobold");
  await change(p.getByLabel("Femme / Homme", { exact: true }), "homme");
  assert.match(
    await p
      .getByAltText("Portrait du personnage", { exact: true })
      .getAttribute("src"),
    /kobold.webp$/,
  );
  await p.getByText("Personnaliser le portrait", { exact: true }).click();
  await p.getByLabel("Importer un portrait", { exact: true }).setInputFiles({
    name: "portrait.webp",
    mimeType: "image/webp",
    buffer: await readFile("web/assets/shared/races/humain.webp"),
  });
  await p.waitForFunction(() =>
    document
      .querySelector(".character-portrait")
      ?.src.startsWith("data:image/jpeg"),
  );
  await change(p.getByLabel("Femme / Homme", { exact: true }), "femme");
  assert.match(
    await p
      .getByAltText("Portrait du personnage", { exact: true })
      .getAttribute("src"),
    /^data:image\/jpeg/,
  );
  await p.getByText("Personnaliser le portrait", { exact: true }).click();
  await p
    .getByRole("button", { name: "Utiliser le portrait proposé", exact: true })
    .click();
  await p.waitForFunction(() =>
    document
      .querySelector(".character-portrait")
      ?.src.endsWith("kobold-femme.webp"),
  );
  results.push(
    "Uploaded portrait survives gender change; explicit reset restores built-in portrait",
  );
  const portrait = p.getByAltText("Portrait du personnage", { exact: true });
  await p.waitForFunction(() => {
    const img = document.querySelector(".character-portrait");
    return img?.complete && img.naturalWidth > 0;
  });
  await p.getByRole("button", { name: "Continuer", exact: true }).click();
  await p
    .getByRole("heading", { name: "Donnez-lui votre style", exact: true })
    .waitFor();
  await p.getByRole("button", { name: "Continuer", exact: true }).click();
  await p.getByRole("heading", { name: "Prêt à jouer", exact: true }).waitFor();
  await p
    .getByRole("button", { name: "Accepter ces recommandations", exact: true })
    .click();
  await p
    .getByRole("heading", { name: "Choix confirmés", exact: true })
    .waitFor();
  for (const field of await p.locator("fieldset").all()) {
    await field.locator("input[type=checkbox]").first().click();
    await p.waitForFunction(
      () => document.querySelectorAll("fieldset").length === 0,
    );
  }
  await p
    .getByLabel("Je confirme les suggestions et les choix affichés.", {
      exact: true,
    })
    .click();
  await p
    .getByLabel("Vérifications manuelles confirmées", { exact: true })
    .click();
  await p
    .getByRole("button", {
      name: "Sauvegarder et ouvrir le Companion",
      exact: true,
    })
    .click();
  await p.getByText("Companion Preview", { exact: true }).waitFor();
  await p
    .getByRole("heading", { name: "Kobold aventurière", exact: true })
    .waitFor();
  assert.ok(await p.getByText("Femme", { exact: true }).count());
  assert.match(
    await p.locator(".companion-head img").getAttribute("src"),
    /kobold-femme.webp$/,
  );
  await p.screenshot({
    path: "docs/screenshots/races/kobold-woman-companion.png",
    fullPage: true,
  });
  results.push(
    "Manual Kobold woman finalized in three screens with portrait visible in Companion",
  );
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    "artifacts/e2e-races-quick-results.json",
    JSON.stringify(
      {
        results,
        errors,
        metrics,
        browser: browser.version(),
        emulationOnly: true,
      },
      null,
      2,
    ),
  );
  await writeFile(
    "docs/screenshots/races/benchmark-quick.json",
    JSON.stringify(metrics, null, 2),
  );
  await browser.close();
  server.kill();
}
console.log(results.join("\n"));
console.log(JSON.stringify(metrics));
