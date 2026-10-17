/** Reproducible interaction comparison. Build a V0.3 checkout separately; no production writes. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
const baseline = process.env.PILOT20_BASELINE_ROOT;
if (!baseline)
  throw Error("Set PILOT20_BASELINE_ROOT to a packaged V0.3 checkout.");
const browser = await chromium.launch({
  ...(process.env.PILOT20_CHROMIUM
    ? { executablePath: process.env.PILOT20_CHROMIUM }
    : {}),
  args: ["--no-sandbox"],
});
const results = [];
try {
  for (const [version, root, port] of [
    ["V0.3", baseline + "/dist", 4192],
    ["V0.3.1", process.cwd() + "/dist", 4193],
  ]) {
    const server = spawn(process.execPath, ["scripts/serve-web.mjs"], {
      env: { ...process.env, PORT: String(port), PILOT20_WEB_ROOT: root },
      stdio: "pipe",
    });
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
    });
    const ctx = await browser.newContext({
        viewport: { width: 1180, height: 820 },
      }),
      p = await ctx.newPage();
    p.setDefaultTimeout(15000);
    let interactions = 0;
    const screens = [];
    const click = async (l) => {
      interactions++;
      await l.click();
    };
    const fill = async (l, v) => {
      interactions++;
      await l.fill(v);
      await l.blur();
      await p
        .locator("#draft-save-state")
        .filter({ hasText: /Sauvegardé|Enregistré sur cet appareil/ })
        .waitFor();
    };
    const check = async (l) => {
      interactions++;
      await l.check();
    };
    const select = async (l, v) => {
      interactions++;
      await l.selectOption(v);
    };
    const step = async (name) => {
      await click(
        p.locator(".steps").getByRole("button", { name: new RegExp(name) }),
      );
      await p.locator(".editor-main h2").filter({ hasText: name }).waitFor();
      screens.push(name);
    };
    const measure = async () =>
      p.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        excessPixels: Math.max(
          0,
          document.documentElement.scrollHeight - innerHeight,
        ),
      }));
    try {
      await p.goto(`http://127.0.0.1:${port}/web/index.html`);
      await click(
        p
          .getByRole("button", { name: "Créer un personnage", exact: true })
          .first(),
      );
      await fill(
        p.getByLabel("Nom du personnage", { exact: true }),
        "Comparable custom fighter",
      );
      if (version === "V0.3") await step("Origine");
      await fill(
        p.getByLabel(
          version === "V0.3"
            ? "Origine"
            : "Race · Personnalisée · validation MJ",
          { exact: true },
        ),
        "Original custom origin",
      );
      if (version === "V0.3.1") {
        await step("Classe & niveau");
        await step("Capacités de classe");
        await check(p.getByLabel("Défense", { exact: true }));
      }
      await step("Historique");
      await fill(
        p.getByLabel("Historique", { exact: true }),
        "Original custom background",
      );
      await check(p.getByLabel("Religion", { exact: true }));
      await check(p.getByLabel("Médecine", { exact: true }));
      if (version === "V0.3") {
        await step("Classe");
        await step("Niveau");
      }
      await step("Caractéristiques");
      await step(version === "V0.3" ? "Compétences" : "Maîtrises");
      await check(p.getByLabel("Athlétisme", { exact: true }));
      await check(p.getByLabel("Perception", { exact: true }));
      if (version === "V0.3") {
        await step("Progression");
        await check(p.getByLabel("Defense", { exact: true }));
      }
      await step(version === "V0.3" ? "Équipement" : "Sorts & équipement");
      await select(p.getByLabel("Armure", { exact: true }), "chain");
      await check(p.getByLabel("Bouclier", { exact: true }));
      await step(version === "V0.3" ? "Récapitulatif" : "Finalisation");
      await check(
        p.getByLabel("Je confirme les suggestions et les choix affichés.", {
          exact: true,
        }),
      );
      await check(
        p.getByLabel("Le MJ a vérifié ces règles et ajustements.", {
          exact: true,
        }),
      );
      await click(
        p.getByRole("button", { name: "Enregistrer la fiche", exact: true }),
      );
      await p.getByText("Companion Preview", { exact: true }).waitFor();
      results.push({
        version,
        semanticInteractions: interactions,
        stepTransitions: screens.length,
        screens,
        reference:
          "Fighter 1, same declared custom origin/background, two background skills, two class skills, Defense style, chain mail and shield; unchanged manual scores; no suggestions",
        measurement:
          "Fill/select/check/button click each counts as one semantic interaction; blur, waits and screenshots excluded. Not human timing.",
      });
    } finally {
      await ctx.close();
      server.kill();
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  "docs/screenshots/v031/interaction-metrics.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
