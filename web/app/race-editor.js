import { refreshPortrait } from "../../src/creator/appearance.js";
import {
  newHomebrewRace,
  validateHomebrewRace,
  customLineagePack,
  exportRace,
  importRace,
} from "../../src/creator/races.js";
import { compileDraft, draftProgression } from "../../src/creator/model.js";
import { ABILITIES, SKILLS } from "../../src/character/contracts.js";
import { LANGUAGES } from "../../src/catalog/origins.js";
import { el, button, field, select, check, download } from "./dom.js";
export function openRaceEditor(a, d, update, initial = null, { lineageOnly = false } = {}) {
  const fr = a.state.locale === "fr",
    w = (f, e) => (fr ? f : e);
  let race = initial ? structuredClone(initial) : newHomebrewRace(),
    mode = lineageOnly ? "tasha" : "homebrew",
    lineage = {
      size: "medium",
      ability: "cha",
      variable: "darkvision",
      language: "draconic",
      featId: "",
      gmApproved: false,
    };
  if (initial) race.gmApproved = false;
  if (lineageOnly) race.name = { fr: "Lignée sur mesure", en: "Custom lineage" };
  const pane = el(
      "section",
      {},
      el("h2", {}, lineageOnly ? w("Lignée sur mesure — Tasha", "Custom lineage — Tasha") : w("Créer une race", "Create a race")),
    ),
    errors = el("p", { role: "alert", class: "warning-text" }),
    form = el("div");
  a.modal(pane);
  function draw() {
    form.replaceChildren();
    pane.replaceChildren(
      el("h2", {}, lineageOnly ? w("Lignée sur mesure — Tasha", "Custom lineage — Tasha") : w("Créer une race", "Create a race")),
      !lineageOnly ? field(
        w("Parcours", "Path"),
        select(
          [
            ["homebrew", w("Race maison", "Homebrew")],
            ["tasha", w("Lignée sur mesure — Tasha", "Custom lineage — Tasha")],
          ],
          mode,
          (e) => {
            mode = e.target.value;
            draw();
          },
        ),
      ) : null,
      form,
      errors,
    );
    const name = el("input", {
        value: race.name.fr,
        maxlength: 200,
        onchange: (e) => {
          race.name.fr = e.target.value;
          race.name.en = e.target.value;
        },
      }),
      appearance = el(
        "textarea",
        { onchange: (e) => (race.appearance = e.target.value) },
        race.appearance,
      );
    form.append(
      field(w("Nom", "Name"), name),
      field(w("Apparence", "Appearance"), appearance),
    );
    if (mode === "tasha") {
      form.append(
        check(
          w(
            "Autoriser l’option Lignée sur mesure dans cette campagne",
            "Authorize Custom lineage in this campaign",
          ),
          a.config.enabledOptions.includes("tce-custom-lineage"),
          async (e) => {
            try {
              const old = a.config,
                next = {
                  ...old,
                  revision: old.revision + 1,
                  enabledOptions: e.target.checked
                    ? [
                        ...new Set([
                          ...old.enabledOptions,
                          "tce-custom-lineage",
                        ]),
                      ]
                    : old.enabledOptions.filter(
                        (v) => v !== "tce-custom-lineage",
                      ),
                };
              await a.campaigns.save(next, { expectedRevision: old.revision });
              a.config = next;
              a.context = await a.campaigns.context(next);
              draw();
            } catch (err) {
              errors.textContent = err.message;
            }
          },
        ),
        el(
          "p",
          {},
          w(
            "Humanoïde · 9 m · +2 · un don admissible · commun + une langue. Autorisation MJ et option Tasha requises.",
            "Humanoid · 30 ft · +2 · eligible feat · common + one language. Requires GM authorization and Tasha option.",
          ),
        ),
        field(
          w("Taille", "Size"),
          select(
            [
              ["small", w("Petite", "Small")],
              ["medium", w("Moyenne", "Medium")],
            ],
            lineage.size,
            (e) => (lineage.size = e.target.value),
          ),
        ),
        field(
          w("Caractéristique +2", "Ability +2"),
          select(
            ABILITIES.map((k) => [k, a.label(k)]),
            lineage.ability,
            (e) => (lineage.ability = e.target.value),
          ),
        ),
        field(
          w("Don installé", "Installed feat"),
          select(
            [
              ["", w("Choisir un don", "Choose a feat")],
              ...a.context.index.list("feat").map((f) => [f.id, a.name(f)]),
            ],
            lineage.featId,
            (e) => (lineage.featId = e.target.value),
          ),
        ),
        field(
          w("Trait variable", "Variable trait"),
          select(
            [
              ["darkvision", w("Vision dans le noir 18 m", "Darkvision 60 ft")],
              ["skill", w("Une compétence", "One skill")],
            ],
            lineage.variable,
            (e) => {
              lineage.variable = e.target.value;
              draw();
            },
          ),
        ),
        lineage.variable === "skill"
          ? field(
              a.t("skills"),
              select(
                [
                  ["", a.t("choose")],
                  ...Object.keys(SKILLS).map((k) => [k, a.label(k)]),
                ],
                lineage.skill ?? "",
                (e) => (lineage.skill = e.target.value),
              ),
            )
          : null,
        field(
          w("Langue supplémentaire", "Additional language"),
          select(
            LANGUAGES.filter((l) => l !== "common").map((l) => [l, l]),
            lineage.language,
            (e) => (lineage.language = e.target.value),
          ),
        ),
        check(
          w(
            "Le MJ autorise cette lignée et cette langue",
            "The GM approves this lineage and language",
          ),
          lineage.gmApproved,
          (e) => (lineage.gmApproved = e.target.checked),
        ),
      );
    } else {
      form.append(
        field(
          w("Nom anglais", "English name"),
          el("input", {
            value: race.name.en,
            onchange: (e) => (race.name.en = e.target.value),
          }),
        ),
        field(
          w("Taille", "Size"),
          select(
            [
              ["small", w("Petite", "Small")],
              ["medium", w("Moyenne", "Medium")],
            ],
            race.size,
            (e) => (race.size = e.target.value),
          ),
        ),
        field(
          w("Vitesse au sol (pieds)", "Walking speed (feet)"),
          el("input", {
            type: "number",
            value: race.speed,
            min: 0,
            max: 200,
            onchange: (e) => (race.speed = Number(e.target.value)),
          }),
        ),
        field(
          w("Description", "Description"),
          el(
            "textarea",
            { onchange: (e) => (race.description = e.target.value) },
            race.description,
          ),
        ),
      );
      const options = el(
        "details",
        {},
        el(
          "summary",
          {},
          w("Traits et caractéristiques", "Traits and abilities"),
        ),
      );
      options.append(
        field(
          w("Type de créature (manuel)", "Creature type (manual)"),
          el("input", {
            value: race.creatureType,
            onchange: (e) => (race.creatureType = e.target.value),
          }),
        ),
        el("h3", {}, w("Bonus de caractéristiques", "Ability bonuses")),
        ABILITIES.map((k) =>
          field(
            a.label(k),
            select(
              [
                ["0", "—"],
                ["1", "+1"],
                ["2", "+2"],
              ],
              String(race.bonuses[k] ?? 0),
              (e) => {
                if (Number(e.target.value))
                  race.bonuses[k] = Number(e.target.value);
                else delete race.bonuses[k];
              },
            ),
          ),
        ),
        el(
          "h3",
          {},
          w(
            "Déplacements supplémentaires (pieds, manuel)",
            "Additional movement (feet, manual)",
          ),
        ),
        ["fly", "swim", "climb", "burrow"].map((k) =>
          field(
            k,
            el("input", {
              type: "number",
              min: 0,
              max: 200,
              value: race.movement[k] ?? 0,
              onchange: (e) => {
                race.movement[k] = Number(e.target.value);
              },
            }),
          ),
        ),
        field(
          w("Sens (manuel)", "Senses (manual)"),
          el("input", {
            value: race.senses.join(", "),
            onchange: (e) =>
              (race.senses = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)),
          }),
        ),
        el("h3", {}, w("Langues", "Languages")),
        LANGUAGES.map((k) =>
          check(k, race.languages.includes(k), (e) => {
            race.languages = e.target.checked
              ? [...race.languages, k]
              : race.languages.filter((v) => v !== k);
          }),
        ),
        el("h3", {}, w("Compétences", "Skills")),
        Object.keys(SKILLS).map((k) =>
          check(a.label(k), race.skills.includes(k), (e) => {
            race.skills = e.target.checked
              ? [...race.skills, k]
              : race.skills.filter((v) => v !== k);
          }),
        ),
        field(
          w(
            "Autres maîtrises (identifiants séparés par des virgules)",
            "Other proficiencies (comma-separated IDs)",
          ),
          el("input", {
            value: race.proficiencies.join(", "),
            onchange: (e) =>
              (race.proficiencies = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)),
          }),
        ),
        el("h3", {}, w("Résistances", "Resistances")),
        [
          "acid",
          "cold",
          "fire",
          "force",
          "lightning",
          "necrotic",
          "poison",
          "psychic",
          "radiant",
          "thunder",
          "bludgeoning",
          "piercing",
          "slashing",
        ].map((k) =>
          check(k, race.resistances.includes(k), (e) => {
            race.resistances = e.target.checked
              ? [...race.resistances, k]
              : race.resistances.filter((v) => v !== k);
          }),
        ),
        el("h3", {}, w("Capacités manuelles", "Manual abilities")),
        race.traits.map((tr, i) =>
          el(
            "fieldset",
            {},
            field(
              w("Nom FR", "French name"),
              el("input", {
                value: tr.name.fr,
                onchange: (e) => (tr.name.fr = e.target.value),
              }),
            ),
            field(
              w("Nom EN", "English name"),
              el("input", {
                value: tr.name.en,
                onchange: (e) => (tr.name.en = e.target.value),
              }),
            ),
            field(
              w("Effet / description", "Effect / description"),
              el(
                "textarea",
                { onchange: (e) => (tr.description = e.target.value) },
                tr.description,
              ),
            ),
            field(
              w("Activation", "Activation"),
              select(
                [
                  ["passive", "Passive"],
                  ["action", "Action"],
                  ["bonus", "Bonus"],
                  ["reaction", w("Réaction", "Reaction")],
                ],
                tr.activation ?? "passive",
                (e) => (tr.activation = e.target.value),
              ),
            ),
            field(
              w("Charges", "Charges"),
              el("input", {
                type: "number",
                min: 0,
                max: 100,
                value: tr.charges ?? 0,
                onchange: (e) => (tr.charges = Number(e.target.value)),
              }),
            ),
            field(
              w("Récupération", "Recovery"),
              select(
                [
                  ["none", w("Aucune", "None")],
                  ["short", w("Repos court", "Short rest")],
                  ["long", w("Repos long", "Long rest")],
                ],
                tr.rest ?? "none",
                (e) => (tr.rest = e.target.value),
              ),
            ),
            field(
              w("Prérequis (validation MJ)", "Prerequisites (GM reviewed)"),
              el("input", {
                value: tr.prerequisites ?? "",
                onchange: (e) => (tr.prerequisites = e.target.value),
              }),
            ),
            button(w("Retirer cette capacité", "Remove ability"), () => {
              race.traits.splice(i, 1);
              draw();
            }),
          ),
        ),
        button(w("Ajouter une capacité", "Add ability"), () => {
          race.traits.push({
            id: "trait:" + crypto.randomUUID(),
            name: { fr: "Nouvelle capacité", en: "New ability" },
            description: "",
            activation: "passive",
            charges: 0,
            rest: "none",
            prerequisites: "",
          });
          draw();
        }),
      );
      form.append(options);
      const advanced = el(
          "details",
          {},
          el(
            "summary",
            {},
            w(
              "Avancé : traits, bonus, sens, langues, variantes et ressources",
              "Advanced: traits, bonuses, senses, languages, variants and resources",
            ),
          ),
        ),
        json = el(
          "textarea",
          {
            "aria-label": w(
              "Définition avancée JSON",
              "Advanced JSON definition",
            ),
            rows: 14,
          },
          JSON.stringify(race, null, 2),
        );
      advanced.append(
        el(
          "p",
          {},
          w(
            "Les bonus, maîtrises, résistances et vitesse au sol sont calculés. Vol, sens, charges, repos et effets libres restent manuels. Un trait peut préciser activation, charges, rest et prerequisites.",
            "Bonuses, proficiencies, resistances and walking speed are calculated. Flight, senses, charges, rest and free-form effects remain manual. Traits may include activation, charges, rest and prerequisites.",
          ),
        ),
        json,
        button(w("Appliquer la définition", "Apply definition"), () => {
          try {
            race = JSON.parse(json.value);
            validateHomebrewRace(race);
            draw();
          } catch (e) {
            errors.textContent = e.message;
          }
        }),
      );
      form.append(
        advanced,
        check(
          w(
            "Race relue par le MJ, autoriser dans cette campagne",
            "GM reviewed; authorize in this campaign",
          ),
          race.gmApproved,
          (e) => (race.gmApproved = e.target.checked),
        ),
        button(w("Exporter JSON", "Export JSON"), () => {
          try {
            validateHomebrewRace(race);
            download(exportRace(race), "pilot20-homebrew-race.json");
          } catch (e) {
            errors.textContent = e.message;
          }
        }),
        field(
          w("Importer JSON", "Import JSON"),
          el("input", {
            type: "file",
            accept: ".json,application/json",
            onchange: async (e) => {
              try {
                race = importRace(await e.target.files[0].text());
                draw();
              } catch (e) {
                errors.textContent = e.message;
              }
            },
          }),
        ),
        button(w("Dupliquer", "Duplicate"), () => {
          race.id = "homebrew:race:" + crypto.randomUUID();
          race.version = 1;
          race.gmApproved = false;
          race.name.fr += " (copie)";
          draw();
        }),
      );
    }
    if (initial)
      form.append(
        button(
          w("Supprimer cette race réutilisable", "Delete reusable race"),
          async () => {
            try {
              await a.campaigns.removeUserRace(race.id + ":pack");
              document.querySelector("#dialog").close();
              await a.render();
            } catch (e) {
              errors.textContent = e.message;
            }
          },
        ),
      );
    function makePack() {
      if (mode === "tasha")
        return customLineagePack(
          {
            ...lineage,
            id: race.id,
            name: race.name.fr,
            appearance: race.appearance,
          },
          a.context,
          d,
        );
      return validateHomebrewRace(race);
    }
    form.append(
      button(
        w("Aperçu sans sauvegarder", "Preview without saving"),
        async () => {
          try {
            const pack = makePack(),
              previewConfig = {
                ...a.config,
                enabledSourceIds: [
                  ...new Set([...a.config.enabledSourceIds, pack.sourceId]),
                ],
              },
              ctx = await a.campaigns.previewPack(pack, previewConfig),
              copy = structuredClone(d);
            copy.raceId = pack.catalog.items[0].id;
            copy.subraceId = null;
            copy.originSelections = {};
            const result = compileDraft(ctx, previewConfig, copy),
              impact = draftProgression(ctx, previewConfig, copy);
            errors.textContent =
              Object.entries(impact.scores ?? {})
                .map(([k, v]) => a.label(k) + " " + v)
                .join(" · ") +
              " · PV " +
              (impact.hpPreview ?? "—") +
              " · " +
              w("Aperçu provisoire : ", "Provisional preview: ") +
              (result.valid
                ? w("valide", "valid")
                : result.issues.map((i) => i.code).join(", "));
          } catch (e) {
            errors.textContent = e.message;
          }
        },
      ),
      button(
        w("Enregistrer et utiliser", "Save and use"),
        async () => {
          try {
            const pack = makePack();
            if (!race.gmApproved && mode !== "tasha")
              throw Error(w("Validation MJ requise.", "GM approval required."));
            if (initial) {
              race.version++;
              const newPack = makePack();
              Object.assign(pack, newPack);
            }
            await a.campaigns.saveUserRace(pack);
            if (
              mode === "homebrew" &&
              !a.config.enabledSourceIds.includes("homebrew")
            ) {
              const old = a.config,
                next = {
                  ...old,
                  revision: old.revision + 1,
                  enabledSourceIds: [...old.enabledSourceIds, "homebrew"],
                };
              await a.campaigns.save(next, { expectedRevision: old.revision });
              a.config = next;
              a.context = await a.campaigns.context(next);
            }
            a.context = await a.campaigns.context(a.config);
            await update((x) => {
              x.manualRace = null;
              x.raceId = pack.catalog.items[0].id;
              refreshPortrait(a.context, x);
              x.subraceId = null;
              x.originSelections = {};
              x.originAdjustments = {};
              x.scoresAreBase = true;
              x.origin = race.name.fr;
              x.customOriginRequiresReview = false;
            });
            document.querySelector("#dialog").close();
            await a.render();
          } catch (e) {
            errors.textContent = e.message;
          }
        },
        "primary",
      ),
    );
  }
  draw();
}
