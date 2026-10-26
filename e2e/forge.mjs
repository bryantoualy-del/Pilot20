import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
const port = 4188,
  server = spawn(process.execPath, ["scripts/serve-web.mjs"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "pipe",
  });
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
  });
  const engine =
    process.env.PILOT20_E2E_BROWSER === "webkit" ? webkit : chromium;
  browser = await engine.launch({
    ...(process.env.PILOT20_CHROMIUM_PATH
      ? { executablePath: process.env.PILOT20_CHROMIUM_PATH }
      : {}),
    ...(engine === chromium
      ? { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] }
      : {}),
    headless: true,
  });
  const context = await browser.newContext({
      viewport: { width: 1180, height: 820 },
    }),
    p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.setDefaultTimeout(20000);
  await p.goto(`http://127.0.0.1:${port}/web/index.html`);
  await p
    .locator("header")
    .getByRole("button", { name: "Forge", exact: true })
    .click();
  await p
    .locator(".forge-library")
    .getByRole("button", { name: "Créer un objet", exact: true })
    .click();
  await p.getByLabel("Nom", { exact: true }).fill("Lame de test");
  await p.getByLabel("Rareté", { exact: true }).selectOption("rare");
  await p
    .getByRole("status")
    .filter({ hasText: "Enregistré sur cet appareil" })
    .waitFor();
  const nameField = await p.getByLabel("Nom", { exact: true }).elementHandle();
  await p
    .getByLabel("Description courte")
    .fill("Une lame forgée pour le test.");
  assert.ok(
    await nameField.evaluate((e) => e.isConnected),
    "typing does not redraw editor",
  );
  await p.getByRole("button", { name: "Propriétés", exact: true }).click();
  await p
    .getByRole("button", { name: "Ajouter le profil de dégâts", exact: true })
    .click();
  await p.locator(".forge-effects summary").first().click();
  await p.getByLabel("Dés · Dé", { exact: true }).selectOption("10");
  await p.getByLabel("Bonus magique",{exact:true}).fill("1");
  await p.getByRole("button", {name:"Réserves",exact:true}).click();
  await p.getByRole("button", {name:"Ajouter une réserve",exact:true}).click();
  await p.getByLabel("Réserve maximale",{exact:true}).fill("10");
  await p.getByLabel("Quantité récupérée · Calcul").selectOption("dice");
  await p.getByLabel("Quantité récupérée · Dé",{exact:true}).selectOption("4");
  await p.getByLabel("Quantité récupérée · Bonus",{exact:true}).fill("1");
  await p.getByRole("button", {name:"Capacités",exact:true}).click();
  await p.locator(".forge-power-picker").getByRole("button", {name:"Infliger des dégâts",exact:true}).click();
  await p.getByLabel("Nom du pouvoir").fill("Souffle de test");
  await p.getByLabel("Dés de dégâts · Nombre",{exact:true}).fill("2");
  await p.getByLabel("Dés de dégâts · Dé",{exact:true}).selectOption("8");
  await p.getByRole("button",{name:"Augmenter · Dés de dégâts · Bonus",exact:true}).click();
  await p.getByRole("button", {name:"Simuler",exact:true}).click();
  await p.getByRole("button", {name:"Lancer la simulation",exact:true}).click();
  await p.locator(".forge-simulation").getByText(/Dégâts :/).waitFor();
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "Identité", exact: true }).click();
  await p
    .getByRole("status")
    .filter({ hasText: "Enregistré sur cet appareil" })
    .waitFor();
  await fs.mkdir("docs/forge/screenshots", { recursive: true });
  await p.screenshot({
    path: "docs/forge/screenshots/ipad.png",
    fullPage: true,
  });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "iPad overflow",
  );
  const [download] = await Promise.all([
    p.waitForEvent("download"),
    p.getByRole("button", { name: "Exporter JSON", exact: true }).click(),
  ]);
  const file = await download.path(),
    exported = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(exported.items[0].definition.name.fr, "Lame de test");
  assert.equal(exported.items[0].definition.effects.find(e=>e.params.role==="weapon-base").params.dice,"1d10");
  assert.equal(exported.items[0].definition.resources[0].recovery.formula,"1d4+1");
  assert.equal(exported.items[0].definition.abilities[0].effects[0].params.dice,"2d8+1");
  for(const stat of ["attack","damage"]){const rows=exported.items[0].definition.effects.filter(e=>e.templateId==="p20:effect:modifier"&&e.params.stat===stat);assert.equal(rows.length,1);assert.equal(rows[0].params.value,1);}

  await p.getByRole("button", { name: "Dupliquer", exact: true }).click();
  await p
    .locator(".forge-library")
    .getByRole("button", { name: /Lame de test \(copie\)/ })
    .waitFor();
  await p.reload();
  await p
    .locator("header")
    .getByRole("button", { name: "Forge", exact: true })
    .click();
  await p.locator(".forge-item-list button").nth(1).waitFor();
  assert.equal(await p.locator(".forge-item-list button").count(), 2);
  await p
    .locator(".forge-library summary")
    .filter({ hasText: "Importer / exporter" })
    .click();
  await p
    .getByLabel("Importer des objets JSON")
    .setInputFiles({
      name: "item.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
  await p.getByRole("status").filter({ hasText: "Import effectué" }).waitFor();
  assert.equal(await p.locator(".forge-item-list button").count(), 3);
  await p
    .getByRole("button", { name: "Partir du catalogue", exact: true })
    .click();
  await p.getByLabel("Rechercher dans le catalogue").fill("PyroMerlin");
  await p
    .locator(".forge-catalog")
    .getByRole("button", { name: /PyroMerlin/ })
    .click();
  await p.getByLabel("Nom", { exact: true }).waitFor();
  assert.equal(
    await p.getByLabel("Nom", { exact: true }).inputValue(),
    "PyroMerlin (copie)",
  );
  await p.getByRole("button", {name:"Capacités",exact:true}).click();
  await p.locator(".forge-editor > details > summary").filter({hasText:"Souffle de la forge"}).click();
  assert.equal(await p.getByLabel("Jet de sauvegarde",{exact:true}).first().inputValue(),"dex");
  await p.screenshot({
    path: "docs/forge/screenshots/ipad-pyromerlin.png",
    fullPage: true,
  });
  for (const width of [390, 375]) {
    await p.setViewportSize({ width, height: 844 });
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "phone overflow",
    );
    await p.getByLabel("Nom du pouvoir").first().waitFor();
    assert.ok(await p.getByLabel("Sur réussite",{exact:true}).first().evaluate(e=>e.getBoundingClientRect().width>250),"Save outcome uses full phone width");
    await p.screenshot({
      path: `docs/forge/screenshots/iphone-${width}.png`,
      fullPage: true,
    });
  }
  await p
    .locator(".forge-mobile-tabs")
    .getByRole("button", { name: "Aperçu", exact: true })
    .click();
  assert.ok(await p.locator(".forge-preview").isVisible());
  await p.screenshot({
    path: "docs/forge/screenshots/iphone-preview.png",
    fullPage: true,
  });
  await p.waitForFunction(() => navigator.serviceWorker.controller);
  // Stop the origin: WebKit automation can fail internally on setOffline + reload.
  // A successful reload now proves assets are served from the installed cache.
  await new Promise(resolve => { server.once("exit", resolve); server.kill(); });
  await p.reload();
  await p
    .locator("header")
    .getByRole("button", { name: "Forge", exact: true })
    .click();
  await p
    .locator(".forge-mobile-tabs")
    .getByRole("button", { name: "Bibliothèque", exact: true })
    .click();
  await p.locator(".forge-item-list button").nth(3).waitFor();
  assert.equal(await p.locator(".forge-item-list button").count(), 4);
  await p.locator(".forge-item-list button").first().click();
  assert.equal(
    await p.getByLabel("Nom", { exact: true }).inputValue(),
    "PyroMerlin (copie)",
  );

  await p
    .locator("header")
    .getByRole("button", { name: "Accueil", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .click();
  await p.locator("#character-name").waitFor();
  assert.ok(await p.locator(".journey-steps").isVisible());
  assert.deepEqual(errors, []);
  console.log(
    "Forge E2E PASS: edit, duplicate, export/import, reload, catalogue, offline, iPad/iPhone, creator smoke",
  );
} finally {
  await browser?.close();
  server.kill();
}
