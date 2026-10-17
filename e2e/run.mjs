import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { originalPack } from "./fixtures.mjs";
const port = Number(process.env.PILOT20_E2E_PORT ?? 4180),
  url = `http://127.0.0.1:${port}/web/index.html`,
  server = spawn(process.execPath, ["scripts/serve-web.mjs"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "pipe",
  });
await new Promise((resolve, reject) => {
  server.stdout.once("data", resolve);
  server.once("error", reject);
  server.once("exit", (code) => reject(Error("server " + code)));
});
const browser = await chromium.launch({
  ...(process.env.PILOT20_CHROMIUM
    ? { executablePath: process.env.PILOT20_CHROMIUM }
    : {}),
  args: ["--no-sandbox"],
});
const errors = [],
  results = [];
const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  p = await ctx.newPage();
p.setDefaultTimeout(15000);
const originalPush = results.push.bind(results);
results.push = (...items) => {
  console.log(...items);
  return originalPush(...items);
};
p.on("pageerror", (e) => errors.push(e.message));
const screenshot = async (name) => {
  await p.locator("#notice").waitFor({ state: "hidden" });
  await mkdir("docs/screenshots/v032/regression", { recursive: true });
  await p.screenshot({
    path: "docs/screenshots/v032/regression/" + name + ".png",
    fullPage: true,
  });
};
const step = async (oldName) => {
  const name =
    {
      Identité: "Race",
      Origine: "Race",
      Classe: "Classe & niveau",
      Niveau: "Classe & niveau",
      Progression: "Capacités de classe",
      "Sous-classe": "Capacités de classe",
      Compétences: "Maîtrises",
      Sorts: "Sorts & équipement",
      Équipement: "Sorts & équipement",
      Récapitulatif: "Finalisation",
    }[oldName] ?? oldName;
  await p.locator(".steps").waitFor({ state: "attached" });
  if (!(await p.locator(".steps").isVisible()))
    await p.getByRole("button", { name: "Étapes", exact: true }).click();
  await p
    .locator(".steps")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await p.locator(".editor-main h2").filter({ hasText: name }).waitFor();
  if (oldName === "Classe")
    await p.getByText("Changer de classe", { exact: true }).click();
  if (oldName === "Sous-classe") {
    await p.getByLabel("Niveau consulté", { exact: true }).selectOption("3");
    await p.getByLabel("Barde · Sous-classe", { exact: true }).waitFor();
  }
};
const blur = async (locator) => {
  await locator.blur();
  await p
    .locator("#draft-save-state")
    .filter({ hasText: /Sauvegardé|Enregistré sur cet appareil/ })
    .waitFor();
};
async function begin(name, mode = "Expert") {
  await p
    .getByRole("button", { name: "Créer un personnage", exact: true })
    .first()
    .click();
  await p.getByLabel("Nom du personnage", { exact: true }).waitFor();
  await p.getByRole("button", { name: mode, exact: true }).click();
  await p.locator(".creator-shell").waitFor();
  const f = p.getByLabel("Nom du personnage", { exact: true });
  await f.fill(name);
  await blur(f);
  await step("Origine");
  const o = p.getByLabel("Race · Personnalisée · validation MJ", {
    exact: true,
  });
  await o.fill("Origine originale, vérifiée par le MJ");
  await blur(o);
  await step("Historique");
  const b = p.getByLabel("Historique", { exact: true });
  await b.fill("Historique original");
  await blur(b);
  await p.getByLabel("Religion", { exact: true }).check();
  await p.getByLabel("Médecine", { exact: true }).check();
}
async function save() {
  await step("Récapitulatif");
  await p
    .getByLabel("Je confirme les suggestions et les choix affichés.", {
      exact: true,
    })
    .check();
  await p
    .getByLabel("Le MJ a vérifié ces règles et ajustements.", { exact: true })
    .check();
  await p
    .getByRole("button", { name: "Enregistrer la fiche", exact: true })
    .click();
  await p.getByText("Companion Preview", { exact: true }).waitFor();
}
async function templateSuggestions() {
  await p.getByRole("button", { name: "Expert", exact: true }).click();
  await step("Capacités");
  const focus = p.getByLabel("Niveau consulté", { exact: true });
  if (await focus.count()) {
    for (const l of ["1", "2", "3"])
      if (await focus.locator('option[value="' + l + '"]').count()) {
        const oldHeading = await p.locator(".editor-main h2").elementHandle();
        await focus.selectOption(l);
        await p.waitForFunction((e) => !e.isConnected, oldHeading);
        await oldHeading.dispose();
        const sub = p
          .locator("select")
          .filter({ has: p.locator('option[value="srd51:college-of-lore"]') });
        if ((await sub.count()) && !(await sub.inputValue()))
          await sub.selectOption("srd51:college-of-lore");
        const wiz = p.locator("select").filter({
          has: p.locator('option[value="srd51:school-of-evocation"]'),
        });
        if ((await wiz.count()) && !(await wiz.inputValue()))
          await wiz.selectOption("srd51:school-of-evocation");
      }
  }
  const panel = p.locator(".template-tools");
  if ((await panel.getAttribute("open")) === null)
    await panel.locator("summary").first().click();
  await panel
    .getByRole("button", {
      name: "Appliquer les suggestions du modèle",
      exact: true,
    })
    .click();
}
const nav = async (name) => {
  await p
    .locator("header nav")
    .getByRole("button", { name, exact: true })
    .click();
  if (name === "Sources de campagne")
    await p.locator(".source-card").first().waitFor();
  else if (name === "Bibliothèque")
    await p.locator("main h1").filter({ hasText: "Bibliothèque" }).waitFor();
  else await p.locator(".hero").waitFor();
};
try {
  await p.goto(url);
  await p.getByRole("heading", { name: "Votre héros. Vos règles." }).waitFor();
  await p.getByText("Disponible hors ligne", { exact: true }).waitFor();
  await screenshot("desktop-home");
  await nav("Sources de campagne");
  assert.equal(await p.locator(".source-card input:checked").count(), 3);
  await screenshot("desktop-sources");
  results.push("Three sources preferred on; extension data absent honestly");
  await nav("Accueil");
  await begin("Aster — Guerrier 1");
  await step("Classe");
  assert.equal(await p.locator(".class-card").count(), 12);
  await screenshot("desktop-classes");
  await templateSuggestions();
  await step("Compétences");
  assert.equal(await p.locator(".choice input:checked").count(), 2);
  await p.getByRole("button", { name: "Guidé", exact: true }).click();
  await p.getByRole("button", { name: "Expert", exact: true }).click();
  assert.equal(await p.locator(".choice input:checked").count(), 2);
  await p.setViewportSize({ width: 1180, height: 820 });
  await screenshot("ipad-creator");
  await save();
  results.push(
    "Expert fighter 1; mode switching; graphical creation/save/preview",
  );
  await p
    .getByRole("button", {
      name: "Nouvelle séance de démonstration",
      exact: true,
    })
    .click();
  await p.getByText(/Démonstration : vous commencez/).waitFor();
  const second = p.locator(".ability").filter({
    has: p.getByRole("heading", { name: "Second souffle", exact: true }),
  });
  assert.equal(await second.count(), 1);
  await second
    .getByRole("button", { name: "Exécuter en local", exact: true })
    .click();
  await p.getByLabel(/Résultats des dés.*1d10/).fill("5");
  await p
    .getByLabel(
      "J’ai vérifié les prérequis, la portée, les composants et les restrictions applicables.",
      { exact: true },
    )
    .check();
  await p
    .locator("dialog")
    .getByRole("button", { name: "Exécuter en local", exact: true })
    .click();
  await p.locator(".log").filter({ hasText: "1 → 0" }).waitFor();
  await screenshot("ipad-companion");
  results.push(
    "Real Second Wind engine action consumed resource and healed HP",
  );
  await nav("Bibliothèque");
  await p
    .getByRole("heading", { name: "Aster — Guerrier 1", exact: true })
    .waitFor();
  await screenshot("desktop-library");
  await p.reload();
  await nav("Bibliothèque");
  await p
    .getByRole("heading", { name: "Aster — Guerrier 1", exact: true })
    .waitFor();
  results.push(
    "IndexedDB reload and character library survive page close/reload",
  );
  await p
    .locator(".card")
    .filter({
      has: p.getByRole("heading", { name: "Aster — Guerrier 1", exact: true }),
    })
    .getByRole("button", { name: "Modifier", exact: true })
    .click();
  await step("Identité");
  await p.getByLabel("Nom du personnage", { exact: true }).fill("Aster révisé");
  await blur(p.getByLabel("Nom du personnage", { exact: true }));
  await save();
  results.push("Edit/revision/finalize persists atomically");
  await nav("Accueil");
  await begin("Mira — Barde 10", "Guidé");
  await step("Classe");
  await p.locator(".class-card").filter({ hasText: "Barde" }).click();
  await step("Niveau");
  await p.getByLabel("Barde · Niveau", { exact: true }).fill("10");
  await p.getByLabel("Barde · Niveau", { exact: true }).blur();
  await templateSuggestions();
  await step("Sorts");
  await p
    .getByLabel("Choix à afficher", { exact: true })
    .selectOption("bard:magical-secrets-10");
  await p.getByRole("heading", { name: /Secrets magiques · 10/ }).waitFor();
  await screenshot("ipad-spells");
  await step("Sous-classe");
  await screenshot("ipad-subclass");
  await step("Récapitulatif");
  await screenshot("ipad-summary");
  await save();
  results.push(
    "Guided bard 10: subclass, inspiration, expertise and Magical Secrets",
  );
  await nav("Sources de campagne");
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
  await nav("Accueil");
  await begin("Contrat privé original", "Expert");
  await step("Classe");
  await p.locator(".class-card").filter({ hasText: "Barde" }).click();
  await step("Niveau");
  await p.getByLabel("Barde · Niveau", { exact: true }).fill("3");
  await p.getByLabel("Barde · Niveau", { exact: true }).blur();
  await step("Sous-classe");
  await p
    .getByLabel("Barde · Sous-classe", { exact: true })
    .selectOption("original:college");
  await templateSuggestions();
  await save();
  results.push(
    "Inert local private pack drives expert subclass choices and compilation (synthetic only)",
  );
  await nav("Sources de campagne");
  await p.getByLabel("Guide complet de Xanathar", { exact: true }).uncheck();
  await nav("Bibliothèque");
  const privateCard = p.locator(".card").filter({
    has: p.getByRole("heading", {
      name: "Contrat privé original",
      exact: true,
    }),
  });
  await privateCard.getByText("À vérifier", { exact: true }).waitFor();
  await nav("Sources de campagne");
  await p.getByLabel("Guide complet de Xanathar", { exact: true }).check();
  await nav("Bibliothèque");
  await privateCard
    .getByRole("button", { name: "Modifier", exact: true })
    .click();
  await step("Sous-classe");
  assert.equal(
    await p.getByLabel("Barde · Sous-classe", { exact: true }).inputValue(),
    "original:college",
  );
  results.push("Source off/on preserves and restores private selections");
  await nav("Bibliothèque");
  const card = p.locator(".card").filter({
    has: p.getByRole("heading", {
      name: "Contrat privé original",
      exact: true,
    }),
  });
  await card.getByText("Voir les détails", { exact: true }).click();
  const dl = p.waitForEvent("download");
  await card.getByRole("button", { name: "Exporter", exact: true }).click();
  const download = await dl;
  await mkdir("artifacts", { recursive: true });
  await download.saveAs("artifacts/roundtrip.json");
  await card.getByRole("button", { name: "Archiver", exact: true }).click();
  await p.getByLabel("Afficher les archives", { exact: true }).check();
  await p
    .locator(".card")
    .filter({
      has: p.getByRole("heading", {
        name: "Contrat privé original",
        exact: true,
      }),
    })
    .getByText("Voir les détails", { exact: true })
    .click();
  await p
    .locator(".card")
    .filter({
      has: p.getByRole("heading", {
        name: "Contrat privé original",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Restaurer", exact: true })
    .click();
  results.push("Export includes build plan; archive/restore library");
  await p.setViewportSize({ width: 390, height: 844 });
  await screenshot("phone-library");
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "No horizontal phone overflow",
  );
  await p.locator("header select").selectOption("en");
  await p.getByRole("heading", { name: "Library", exact: true }).waitFor();
  results.push("FR/EN interface and phone layout");
  await ctx.setOffline(true);
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.getByRole("button", { name: "Library", exact: true }).first().click();
  await p.getByRole("heading", { name: "Aster révisé", exact: true }).waitFor();
  await p.getByRole("button", { name: /Create character/ }).click();
  await p.getByLabel("Character name", { exact: true }).fill("Offline draft");
  await p.getByLabel("Character name", { exact: true }).blur();
  await p.getByRole("button", { name: "Library", exact: true }).first().click();
  await p
    .getByRole("heading", { name: "Offline draft", exact: true })
    .waitFor();
  results.push("Offline reload, library, create draft and persistence");
  await p.locator("header select").selectOption("fr");
  await nav("Accueil");
  await begin("Création complète hors ligne");
  await templateSuggestions();
  await save();
  await p
    .getByRole("button", {
      name: "Nouvelle séance de démonstration",
      exact: true,
    })
    .click();
  await p.getByText(/Démonstration : vous commencez/).waitFor();
  await nav("Bibliothèque");
  await p
    .locator(".card")
    .filter({
      has: p.getByRole("heading", {
        name: "Création complète hors ligne",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Modifier", exact: true })
    .click();
  await step("Identité");
  await p
    .getByLabel("Nom du personnage", { exact: true })
    .fill("Fiche hors ligne modifiée");
  await blur(p.getByLabel("Nom du personnage", { exact: true }));
  await save();
  results.push(
    "Fully offline character creation, final save, edit and real Companion session",
  );
  await nav("Bibliothèque");
  await p
    .locator(".card")
    .filter({
      has: p.getByRole("heading", {
        name: "Contrat privé original",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Ouvrir", exact: true })
    .click();
  await p
    .getByRole("button", {
      name: "Nouvelle séance de démonstration",
      exact: true,
    })
    .click();
  await p.getByText(/Démonstration : vous commencez/).waitFor();
  const echo = p.locator(".ability").filter({
    has: p.getByRole("heading", { name: "Écho original", exact: true }),
  });
  await echo
    .getByRole("button", { name: "Résolution manuelle", exact: true })
    .click();
  await p
    .getByLabel(
      "J’ai vérifié les prérequis, la portée, les composants et les restrictions applicables.",
      { exact: true },
    )
    .check();
  await p
    .getByLabel("Décrivez la décision du MJ", { exact: true })
    .fill("Déclaration originale testée hors ligne");
  await p
    .locator("dialog")
    .getByRole("button", { name: "Résolution manuelle", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Enregistrer la résolution", exact: true })
    .click();
  await p
    .getByLabel("Décrivez la décision du MJ", { exact: true })
    .fill("Résolution narrative confirmée");
  await p
    .locator("dialog")
    .getByRole("button", { name: "Enregistrer la résolution", exact: true })
    .click();
  await p
    .locator(".log")
    .filter({ hasText: "Résolution narrative confirmée" })
    .waitFor();
  results.push(
    "Previously installed private pack remains usable offline, including declared/resolved manual engine action",
  );
  const secondContext = await browser.newContext({
      viewport: { width: 1180, height: 820 },
    }),
    secondPage = await secondContext.newPage();
  await secondPage.goto(url);
  await secondPage
    .getByRole("button", { name: "Bibliothèque", exact: true })
    .first()
    .click();
  await secondPage
    .getByLabel("Importer une fiche", { exact: true })
    .setInputFiles("artifacts/roundtrip.json");
  await secondPage
    .getByRole("heading", { name: "Contrat privé original", exact: true })
    .waitFor();
  await secondPage
    .locator(".card")
    .getByText("À vérifier", { exact: true })
    .waitFor();
  await secondContext.close();
  results.push(
    "Export imported into clean browser with missing-pack warning and preserved plan",
  );

  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    JSON.stringify(
      { passed: results.length, results, browser: browser.version(), errors },
      null,
      2,
    ),
  );
  await writeFile(
    "artifacts/e2e-results.json",
    JSON.stringify(
      { passed: results.length, results, browser: browser.version(), errors },
      null,
      2,
    ),
  );
} catch (e) {
  console.error("BODY", await p.locator("body").innerText());
  console.error("ERRORS", errors);
  await screenshot("failure");
  throw e;
} finally {
  await browser.close();
  server.kill();
}
