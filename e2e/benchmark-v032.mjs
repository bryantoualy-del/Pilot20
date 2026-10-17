/** Identical manual fighter scenario, no suggestions, same choices on both revisions. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const label = process.argv[2] ?? "v032",
  root = process.argv[3] ?? "dist",
  port = 4192;
const server = spawn(process.execPath, ["scripts/serve-web.mjs"], {
  env: { ...process.env, PORT: String(port), PILOT20_WEB_ROOT: root },
  stdio: "pipe",
});
await new Promise((r) => server.stdout.once("data", r));
const browser = await chromium.launch({
  ...(process.env.PILOT20_CHROMIUM
    ? { executablePath: process.env.PILOT20_CHROMIUM }
    : {}),
  args: ["--no-sandbox"],
});
const p = await browser.newPage({ viewport: { width: 1180, height: 820 } });
p.setDefaultTimeout(15000);
let interactions = 0,
  screenChanges = 0;
const heights = [],
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const click = async (l) => {
  await l.click();
  interactions++;
};
const fill = async (l, v) => {
  await l.fill(v);
  await l.blur();
  await p
    .locator("#notice")
    .filter({ hasText: "Enregistré sur cet appareil" })
    .waitFor();
  interactions++;
};
const choose = async (l, v) => {
  await l.selectOption(v);
  await p
    .locator("#notice")
    .filter({ hasText: "Enregistré sur cet appareil" })
    .waitFor();
  interactions++;
};
const check = async (l) => {
  await l.check();
  await p
    .locator("#notice")
    .filter({ hasText: "Enregistré sur cet appareil" })
    .waitFor();
  interactions++;
};
async function step(s) {
  await p
    .locator(".steps")
    .getByRole("button", { name: new RegExp(s) })
    .click();
  interactions++;
  screenChanges++;
  await p.locator(".editor-main h2").filter({ hasText: s }).waitFor();
  heights.push({
    step: s,
    ...(await p.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      viewport: innerHeight,
    }))),
  });
}
try {
  await p.goto(`http://127.0.0.1:${port}/web/index.html`);
  const start = performance.now();
  await click(
    p.getByRole("button", { name: "Créer un personnage", exact: true }).first(),
  );
  screenChanges++;
  await click(p.getByRole("button", { name: "Guidé", exact: true }));
  await fill(
    p.getByLabel("Nom du personnage", { exact: true }),
    "Benchmark fighter",
  );
  await fill(
    p.getByLabel("Race · Personnalisée · validation MJ", { exact: true }),
    "Original reviewed origin",
  );
  await step("Classe & niveau");
  await step("Capacités de classe");
  await check(p.getByLabel("Défense", { exact: true }));
  await step("Historique");
  await fill(
    p.getByLabel("Historique", { exact: true }),
    "Original reviewed background",
  );
  await check(p.getByLabel("Religion", { exact: true }));
  await check(p.getByLabel("Médecine", { exact: true }));
  await step("Caractéristiques");
  await step("Maîtrises");
  await check(p.getByLabel("Athlétisme", { exact: true }));
  await check(p.getByLabel("Perception", { exact: true }));
  await step("Sorts & équipement");
  await choose(p.getByLabel("Armure", { exact: true }), "chain");
  await check(p.getByLabel("Bouclier", { exact: true }));
  await step("Finalisation");
  await check(
    p.getByLabel("Je confirme les suggestions et les choix affichés.", {
      exact: true,
    }),
  );
  await check(
    p.getByLabel("Le MJ a vérifié ces règles et ajustements.", { exact: true }),
  );
  const unresolved = await p.locator(".editor-main .issues li").count();
  assert.equal(unresolved, 0);
  await click(
    p.getByRole("button", { name: "Enregistrer la fiche", exact: true }),
  );
  await p.getByText("Companion Preview", { exact: true }).waitFor();
  screenChanges++;
  const elapsed = performance.now() - start;
  assert.deepEqual(errors, []);
  await mkdir("docs/screenshots/v032", { recursive: true });
  await writeFile(
    `docs/screenshots/v032/benchmark-${label}.json`,
    JSON.stringify(
      {
        revision: label,
        scenario:
          "Same custom fighter 1: default scores, Defense, Athletics/Perception, Religion/Medicine background, chain and shield. No suggestions.",
        interactions,
        screenChanges,
        corrections: 0,
        unresolvedAtFinalization: unresolved,
        heights,
        automatedElapsedMs: elapsed,
        browser: browser.version(),
        humanTest: false,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(label, { interactions, screenChanges, unresolved, elapsed });
} finally {
  await browser.close();
  server.kill();
}
