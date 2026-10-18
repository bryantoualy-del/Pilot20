import { renderQuick } from "./quick.js";
import { appearanceControls } from "./appearance.js";
import {
  raceOptions,
  raceSelection,
  selectRace,
} from "../../src/creator/race-selection.js";
import { raceGallery, manualRaceControls } from "./races.js";
import { openRaceEditor } from "./race-editor.js";
import {
  discoveryGallery,
  subclassComparison,
  previewView,
  openSimulation,
  helpPanel,
  words,
} from "./experience.js";
import {
  previewDraft,
  issueStep,
  diagnosticKind,
} from "../../src/creator/experience.js";
import { assetImage } from "./asset-registry.js";
import { ARMORS, WEAPONS } from "../../src/catalog/equipment.js";
import { classInfo } from "./class-info.js";
import { modifier, proficiencyBonus } from "../../src/character/derive.js";
import {
  POINT_COST,
  rollAbilityScores,
  originCustomizationPolicy,
} from "../../src/catalog/origins.js";
import { spellTerms } from "../../src/catalog/localization.js";
import { classIcon } from "./class-icons.js";
import {
  newDraft as makeDraft,
  draftProgression,
  compileDraft,
  suggestChoices,
  templateScores,
  CREATION_MODELS,
  retainDecision,
  restoreDecision,
} from "../../src/creator/model.js";
import { ABILITIES, SKILLS } from "../../src/character/contracts.js";
import { el, button, field, select, check, badge } from "./dom.js";
import { stepNames } from "./i18n.js";
export const newDraft = makeDraft;
const colors = {
  fighter: "#c9a17d",
  barbarian: "#d77c67",
  bard: "#c78eac",
  cleric: "#d7ca87",
  druid: "#92bd92",
  monk: "#7dbbc0",
  paladin: "#ddc59a",
  ranger: "#7fb397",
  rogue: "#a89cce",
  sorcerer: "#c78dba",
  warlock: "#a78bce",
  wizard: "#7fadd1",
};
const choiceTitles = {
  skills: ["Compétences", "Skills"],
  instruments: ["Instruments", "Instruments"],
  tool: ["Outil", "Tool"],
  infusions: ["Influx connus", "Infusions known"],
  "armor-model": ["Modèle d’armure", "Armor model"],
  "fighting-style": ["Style de combat", "Fighting style"],
  "additional-style": ["Style supplémentaire", "Additional style"],
  cantrips: ["Tours de magie", "Cantrips"],
  "known-spells": ["Sorts connus", "Known spells"],
  "known-free-spells": ["Sorts au choix — toutes écoles", "Spells of any school"],
  prepared: ["Sorts préparés", "Prepared spells"],
  spellbook: ["Grimoire", "Spellbook"],
  invocations: ["Invocations", "Invocations"],
  metamagic: ["Métamagie", "Metamagic"],
  "pact-boon": ["Pacte", "Pact boon"],
  "favored-enemy": ["Ennemi juré", "Favored enemy"],
  "favored-terrain": ["Terrain de prédilection", "Favored terrain"],
};
const human = (v) =>
  v
    .split(":")
    .at(-1)
    .replace(/[-_]/g, " ")
    .replace(/^./, (x) => x.toUpperCase());
export function optionName(value, a) {
  const entry = a.context.installed.get(value);
  if (entry) return a.name(entry);
  if (value.startsWith("asi:")) {
    const [, x, y] = value.split(":");
    return x === y
      ? "+2 " + a.label(x)
      : "+1 " + a.label(x) + " / +1 " + a.label(y);
  }
  if (Object.hasOwn(SKILLS, value) || ABILITIES.includes(value))
    return a.label(value);
  const terms = {
    'two-one':['+2 à une caractéristique, +1 à une autre','+2 to one ability, +1 to another'],
    'three-ones':['+1 à trois caractéristiques différentes','+1 to three different abilities'],
    small:['Petite','Small'],medium:['Moyenne','Medium'],
    defiance:['Défiance','Defiance'],craftiness:['Astuce','Craftiness'],'draconic-sorcery':['Sorcellerie draconique','Draconic sorcery'],
    artisan:['Outils d’artisan','Artisan’s tools'],navigator:['Outils de navigateur','Navigator’s tools'],language:['Langue supplémentaire','Additional language'],
    drum: ["Tambour", "Drum"],
    flute: ["Flûte", "Flute"],
    lute: ["Luth", "Lute"],
    "thieves-tools": ["Outils de voleur", "Thieves’ tools"],
    'tinkers-tools':['Outils de bricoleur','Tinker’s tools'],
    'alchemists-supplies':['Matériel d’alchimiste','Alchemist’s supplies'],
    'brewers-supplies':['Matériel de brasseur','Brewer’s supplies'],
    'calligraphers-supplies':['Matériel de calligraphe','Calligrapher’s supplies'],
    'carpenters-tools':['Outils de charpentier','Carpenter’s tools'],
    'cartographers-tools':['Outils de cartographe','Cartographer’s tools'],
    'cobblers-tools':['Outils de cordonnier','Cobbler’s tools'],
    'cooks-utensils':['Ustensiles de cuisinier','Cook’s utensils'],
    'glassblowers-tools':['Outils de souffleur de verre','Glassblower’s tools'],
    'jewelers-tools':['Outils de joaillier','Jeweler’s tools'],
    'leatherworkers-tools':['Outils de travail du cuir','Leatherworker’s tools'],
    'masons-tools':['Outils de maçon','Mason’s tools'],
    'painters-supplies':['Matériel de peintre','Painter’s supplies'],
    'potters-tools':['Outils de potier','Potter’s tools'],
    'smiths-tools':['Outils de forgeron','Smith’s tools'],
    'weavers-tools':['Outils de tisserand','Weaver’s tools'],
    'woodcarvers-tools':['Outils de menuisier','Woodcarver’s tools'],
    common: ["Commun", "Common"],
  };
  return terms[value]?.[a.state.locale === "fr" ? 0 : 1] ?? human(value);
}
export function choiceName(q, a) {
  const suffix = q.id.slice(q.classId.length + 1),
    lang = a.state.locale === "fr" ? 0 : 1;
  if (suffix.startsWith("asi-"))
    return (
      (lang === 0
        ? "Amélioration de caractéristiques"
        : "Ability score improvement") +
      " · " +
      suffix.slice(4)
    );
  if (suffix.startsWith("expertise-")) return "Expertise · " + suffix.slice(10);
  if (suffix.startsWith("magical-secrets-"))
    return a.t("secrets") + " · " + suffix.split("-").at(-1);
  return (
    choiceTitles[suffix]?.[lang] ??
    (q.kind === "proficiency" ? a.t("proficiencies") : human(suffix))
  );
}
export function issueMessage(issue, report, a) {
  const q = report.choices?.find((q) => q.id === issue.choiceId),
    title = q ? choiceName(q, a) : "",
    fr = a.state.locale === "fr";
  const messages = {
    'invalid-granted-spell-replacement':fr?'Vérifiez le niveau, l’école et l’origine du sort remplacé ; un seul remplacement est permis par niveau.':'Review the exchanged spell’s level, school and origin; only one exchange is allowed per level.',
    'duplicate-granted-spell':fr?'Deux octrois donnent le même sort. Choisissez un autre remplacement.':'Two grants provide the same spell. Choose another exchange.',
    "creator-name": a.t("requiredName"),
    "creator-origin": a.t("requiredOrigin"),
    "creator-background-skills": fr
      ? "Choisissez deux compétences d’historique."
      : "Choose two background skills.",
    "creator-confirmation": a.t("confirmation"),
    "score-method": a.t("scoreInvalid"),
    "required-subrace": a.t("subrace") + " : " + a.t("choose"),
    "origin-choice": a.t("originChoice") + " : " + a.t("missingChoices"),
    "inactive-subclass": fr
      ? "Sous-classe conservée mais inaccessible à ce niveau. Aucun effet n’est appliqué."
      : "Subclass retained but unavailable at this level. No effects are applied.",
    "unavailable-origin": a.t("unavailable"),
    "obsolete-origin-choice": fr
      ? "Un ancien choix d’origine est conservé et doit être revu."
      : "A previous origin choice is retained and needs review.",
    "origin-option-disabled": fr
      ? "Personnalisation d’origine désactivée : réactivez son option et sa source."
      : "Origin customization is disabled: enable its option and source.",
    "creator-custom-review": a.t("customReview"),
    "required-choice": fr
      ? `Il reste ${q?.count ?? ""} choix à renseigner : ${title}.`
      : `Complete the required ${q?.count ?? ""} selections: ${title}.`,
    "invalid-choice": fr
      ? `Vérifiez le nombre et la disponibilité des choix : ${title}.`
      : `Check selection count and availability: ${title}.`,
    "unavailable-class": a.t("unavailable"),
    "unavailable-subclass": a.t("unavailable"),
    "unavailable-selection": a.t("unavailable"),
    "unavailable-transcription": a.t("unavailable"),
    "multiclass-option-disabled": fr
      ? "Activez le multiclassage dans les paramètres."
      : "Enable multiclassing in campaign settings.",
    "multiclass-prerequisite": fr
      ? "Les prérequis de caractéristiques du multiclassage ne sont pas remplis."
      : "Multiclass ability prerequisites are not met.",
    "obsolete-choice": fr
      ? "Un choix antérieur ne s’applique plus. Examinez-le avant de le retirer."
      : "A previous selection no longer applies. Review it before removing.",
    "duplicate-skill": fr
      ? "Une compétence a été choisie deux fois."
      : "A skill was selected twice.",
    "duplicate-expertise": fr
      ? "Une expertise a été choisie deux fois."
      : "An expertise was selected twice.",
    "duplicate-spell-choice": fr
      ? "Un sort est sélectionné plusieurs fois pour la même classe."
      : "A spell was selected more than once for the same class.",
    "asi-cap": fr
      ? "Une amélioration dépasse le maximum de 20."
      : "An improvement exceeds the maximum score of 20.",
    "ambiguous-replacement": fr
      ? "Deux options remplacent la même capacité."
      : "Two options replace the same feature.",
    "optional-feature-prerequisite": fr
      ? "Les prérequis d’une option ne sont pas remplis."
      : "An optional feature prerequisite is not met.",
  };
  return (
    messages[issue.code] ??
    (fr
      ? "Vérifiez les choix de progression et leurs prérequis."
      : "Review advancement choices and prerequisites.")
  );
}
export function inspectEntry(entry, a) {
  if (!entry) return;
  const d = entry.data;
  a.modal(
    el(
      "section",
      {},
      badge(a.t(d.automation.status)),
      el(
        "h2",
        {},
        entry.type === "spell" ? assetImage("school", entry.data.school) : null,
        a.name(entry),
      ),
      el("p", {}, entry.source.document),
      entry.type === "spell"
        ? el(
            "dl",
            {},
            [
              "level",
              "school",
              "castingTime",
              "range",
              "components",
              "duration",
            ].map((k) =>
              el(
                "div",
                {},
                el("dt", {}, a.t(k)),
                el("dd", {}, String(spellTerms(entry, a.state.locale)[k])),
              ),
            ),
            d.concentration ? badge(a.t("concentration")) : null,
            d.ritual ? badge(a.t("ritual")) : null,
          )
        : null,
      el("p", {}, a.t("reviewHelp")),
      d.description
        ? el(
            "p",
            {},
            (a.state.locale === "fr" && d.language !== "fr"
              ? "Texte de référence en anglais : "
              : "") + d.description,
          )
        : null,
      ...d.automation.limits.map((v) =>
        el(
          "p",
          { class: "warning-text" },
          (a.state.locale === "fr"
            ? "Limite (texte de référence) : "
            : "Limit: ") + v,
        ),
      ),
    ),
  );
}
export async function renderEditor(main, d, a) {
  if (d.mode === "quick") return renderQuick(main, d, a);
  const { t } = a;
  const record = await a.library.get(d.id),
    expectedCharacterRevision = record?.definition.revision ?? null;
  if (d.campaignId !== a.config.id) {
    main.append(
      el("p", { class: "warning-text" }, t("sourceAbsent")),
      button(t("sources"), () => a.nav("sources")),
    );
    return;
  }
  const update = async (fn, redraw = true) => {
    fn(d);
    d.quickEdited = true;
    d.finalized = false;
    d.confirmed = false;
    d.reviewed = false;
    await a.autosave(d);
    if (redraw) await draw();
  };
  const viewUpdate = async (fn) => {
    fn(d);
    await a.autosave(d);
    await draw();
  };
  const shell = el("div", { class: "creator-shell" });
  const uiFilters = new Map();
  const discoveryUI = {};
  let stepsExpanded = false;
  let focusIssue = null;
  const legacySteps = {
    identity: "origin",
    level: "class",
    subclass: "features",
    equipment: "spells",
  };
  if (legacySteps[d.step]) d.step = legacySteps[d.step];
  const localized = (pair) => pair?.[a.state.locale] ?? pair?.en ?? "";
  const originTerms = {
    common: ["Commun", "Common"],
    dwarvish: ["Nain", "Dwarvish"],
    elvish: ["Elfique", "Elvish"],
    gnomish: ["Gnome", "Gnomish"],
    halfling: ["Halfelin", "Halfling"],
    orc: ["Orc", "Orc"],
    draconic: ["Draconique", "Draconic"],
    infernal: ["Infernal", "Infernal"],
    celestial: ["Céleste", "Celestial"],
    abyssal: ["Abyssal", "Abyssal"],
    giant: ["Géant", "Giant"],
    goblin: ["Gobelin", "Goblin"],
    primordial: ["Primordial", "Primordial"],
    sylvan: ["Sylvestre", "Sylvan"],
    "deep-speech": ["Profond", "Deep Speech"],
    undercommon: ["Commun des profondeurs", "Undercommon"],
    black: ["Noir", "Black"],
    blue: ["Bleu", "Blue"],
    brass: ["Airain", "Brass"],
    bronze: ["Bronze", "Bronze"],
    copper: ["Cuivre", "Copper"],
    gold: ["Or", "Gold"],
    green: ["Vert", "Green"],
    red: ["Rouge", "Red"],
    silver: ["Argent", "Silver"],
    white: ["Blanc", "White"],
    "smith-tools": ["Outils de forgeron", "Smith’s tools"],
    "brewer-supplies": ["Matériel de brasseur", "Brewer’s supplies"],
    "mason-tools": ["Outils de maçon", "Mason’s tools"],
    "tinker-tools": ["Outils de bricoleur", "Tinker’s tools"],
  };
  Object.assign(originTerms, {
    "all-armor": ["Toutes les armures", "All armor"],
    "light-armor": ["Armures légères", "Light armor"],
    "medium-armor": ["Armures intermédiaires", "Medium armor"],
    "heavy-armor": ["Armures lourdes", "Heavy armor"],
    shields: ["Boucliers", "Shields"],
    "simple-weapons": ["Armes courantes", "Simple weapons"],
    "martial-weapons": ["Armes de guerre", "Martial weapons"],
    language: ["Langue", "Language"],
    languages: ["Langues", "Languages"],
    skills: ["Compétences", "Skills"],
  });
  for (const w of Object.values(WEAPONS))
    originTerms[w.proficiency] = [w.name.fr, w.name.en];
  const term = (v) =>
    originTerms[v]?.[a.state.locale === "fr" ? 0 : 1] ??
    (v.startsWith("language:") ? term(v.slice(9)) : optionName(v, a));
  main.append(shell);
  async function draw() {
    const report = draftProgression(a.context, a.config, d);
    const spellChoices = report.choices.filter((q) =>
      [
        "spell",
        "spellbook",
        "prepared",
        "ritual-spell",
        "spell-mastery",
        "signature-spell",
      ].includes(q.kind),
    );
    const steps = stepNames;
    if (!steps.includes(d.step)) d.step = steps[0];
    const title = el(
      "div",
      { class: "section-head" },
      el(
        "div",
        {},
        badge("V0.3.2 · " + t("title")),
        el("h1", {}, d.name || t("create")),
      ),
      el(
        "div",
        { class: "mode-switch", "aria-label": t("model") },
        ["quick", "guided", "expert"].map((m) =>
          button(
            t(m),
            async () => {
              d.mode = m;
              await a.autosave(d);
              await draw();
            },
            m === d.mode ? "active" : "",
          ),
        ),
      ),
    );
    const saveState = el(
      "div",
      { class: "draft-status" },
      el(
        "small",
        { id: "draft-save-state", role: "status" },
        (d.updatedAt ? t("saved") : t("saving")) +
          (d.updatedAt
            ? " · " +
              new Date(d.updatedAt).toLocaleTimeString(a.state.locale, {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""),
      ),
      button(t("exitDraft"), async () => {
        await a.autosave(d);
        await a.nav("home");
      }),
    );
    const nav = el(
      "aside",
      { class: "steps", "aria-label": t("title") },
      steps.map((key, n) =>
        button(
          [
            el("span", { class: "step-num" }, String(n + 1).padStart(2, "0")),
            t(key),
          ],
          async () => {
            d.step = key;
            window.scrollTo({ top: 0 });
            await a.autosave(d);
            await draw();
          },
          key === d.step ? "active" : "",
        ),
      ),
    );
    [...nav.querySelectorAll("button")].forEach((b, n) => {
      if (steps[n] === d.step) b.setAttribute("aria-current", "step");
    });
    const body = el(
      "section",
      { class: "panel" },
      el("h2", { tabindex: -1 }, t(d.step)),
    );
    const aside = el("aside", { class: "editor-aside" });
    const w = words(a);
    const currentPreview = previewDraft(
      a.context,
      a.config,
      d,
      undefined,
      report,
    );
    nav.id = "creation-steps";
    nav.classList.toggle("expanded", stepsExpanded);
    const mobileTools = el(
      "div",
      { class: "mobile-tools" },
      el(
        "button",
        {
          type: "button",
          "aria-controls": "creation-steps",
          "aria-expanded": String(stepsExpanded),
          onclick: (e) => {
            stepsExpanded = !stepsExpanded;
            nav.classList.toggle("expanded", stepsExpanded);
            e.currentTarget.setAttribute(
              "aria-expanded",
              String(stepsExpanded),
            );
          },
        },
        w("Étapes", "Steps"),
      ),
    );
    saveState.append(
      el(
        "small",
        { class: "creation-progress" },
        d.classes.map((c) => a.cls(c.id) + " " + c.level).join(" / ") +
          " · " +
          (steps.indexOf(d.step) + 1) +
          " / " +
          steps.length,
      ),
      button(w("Mon personnage", "My character"), () =>
        a.modal(
          el(
            "section",
            {},
            previewView(a, currentPreview),
            ["origin", "class", "features", "scores", "training", "spells"].map(
              (step) =>
                button(w("Modifier : ", "Edit: ") + t(step), async () => {
                  document.querySelector("#dialog").close();
                  d.step = step;
                  await a.autosave(d);
                  await draw();
                }),
            ),
          ),
        ),
      ),
      d.returnToQuick !== undefined
        ? button(w("Revenir au mode Rapide", "Return to Quick"), async () => {
            d.mode = "quick";
            d.quickScreen = d.returnToQuick;
            delete d.returnToQuick;
            await a.autosave(d);
            await a.render();
          })
        : null,
      mobileTools,
    );
    const stepIssues = report.issues;
    [...nav.querySelectorAll("button")].forEach((b, n) => {
      const count = stepIssues.filter(
        (i) => issueStep(i, report) === steps[n],
      ).length;
      if (count) b.append(badge(String(count), "warning"));
    });
    const center = el("div", { class: "editor-main" }, body);
    center.append(
      el(
        "details",
        { class: "editor-tools-container", open: d.mode === "expert" },
        el("summary", {}, w("Outils avancés", "Advanced tools")),
        aside,
      ),
    );
    shell.classList.toggle("guided-creator", d.mode === "guided");
    shell.replaceChildren(
      title,
      saveState,
      el("div", { class: "editor-layout" }, nav, center),
    );
    if (d.mode === "expert") nav.append(helpPanel(a, true));
    if (d.step === "features" && d.mode === "expert")
      body.append(subclassComparison(a, d, update));
    if (d.step === "origin") {
      body.append(
        field(
          t("name"),
          el("input", {
            value: d.name,
            maxlength: 200,
            onchange: (e) =>
              update((x) => {
                x.name = e.target.value;
              }, false),
          }),
        ),
        el(
          "details",
          {},
          el("summary", {}, t("identityDetails")),
          field(
            t("description"),
            el(
              "textarea",
              {
                onchange: (e) =>
                  update((x) => {
                    x.description = e.target.value;
                  }, false),
              },
              d.description,
            ),
          ),
        ),
        appearanceControls(a, d, update),
      );
    }
    function originControl(q) {
      const values = d.originSelections?.[q.id] ?? [];
      return el(
        "section",
        { class: "choice", "data-choice-id": q.id },
        el(
          "details",
          {
            open: (report.origin?.issues ?? []).some(
              (i) => i.choiceId === q.id,
            ),
          },
          el(
            "summary",
            {},
            el(
              "h3",
              {},
              t("originChoice") + " · " + term(q.key),
              badge(values.length + " / " + q.count),
            ),
          ),
          select(
            [["", t("choose")], ...q.options.map((v) => [v, term(v)])],
            "",
            (e) => {
              if (!e.target.value) return;
              update((x) => {
                x.originSelections ??= {};
                const old = x.originSelections[q.id] ?? [];
                x.originSelections[q.id] =
                  q.count === 1
                    ? [e.target.value]
                    : [...new Set([...old, e.target.value])].slice(0, q.count);
              });
            },
          ),
          el(
            "div",
            { class: "row" },
            values.map((v) =>
              button(term(v) + " ×", () =>
                update((x) => {
                  x.originSelections[q.id] = values.filter((k) => k !== v);
                }),
              ),
            ),
          ),
        ),
      );
    }
    if (d.step === "origin") {
      const race = report.origin?.race;
      body.append(
        el("p", {}, t("chooseRace")),
        field(
          t("origin"),
          select(
            [["", t("custom")], ...raceOptions(a.context, a.state.locale)],
            raceSelection(d),
            (e) =>
              update((x) =>
                selectRace(a.context, x, e.target.value, a.state.locale),
              ),
          ),
        ),
      );
      body.append(
        button(w("Créer une race", "Create a race"), () =>
          openRaceEditor(a, d, update),
        ),
        el(
          "details",
          { class: "race-gallery" },
          el("summary", {}, w("Explorer les races", "Explore races")),
          raceGallery(a, d, update),
        ),
      );
      body.append(...[manualRaceControls(a, d, update)].filter(Boolean));
      if (race?.data.homebrewDefinition)
        body.append(
          button(
            w("Modifier cette race maison", "Edit this homebrew race"),
            () => openRaceEditor(a, d, update, race.data.homebrewDefinition),
          ),
        );
      if (race) {
        if (race.data.subraces.length)
          body.append(
            field(
              t("subrace"),
              select(
                [
                  ["", t("choose")],
                  ...race.data.subraces.map((r) => [r.id, localized(r.name)]),
                ],
                d.subraceId ?? "",
                (e) =>
                  update((x) => {
                    x.subraceId = e.target.value || null;
                  }),
              ),
            ),
          );
        body.append(
          el(
            "p",
            {},
            t("size") +
              " : " +
              (a.state.locale === "fr"
                ? { small: "Petite", medium: "Moyenne" }[race.data.size]
                : race.data.size) +
              " · " +
              t("speed") +
              " : " +
              race.data.speed +
              " ft · " +
              race.source.document,
          ),
          el(
            "p",
            {},
            t("racialBonus") +
              " : " +
              Object.entries(report.origin.bonuses)
                .filter(([, v]) => v)
                .map(([k, v]) => a.label(k) + " +" + v)
                .join(", "),
          ),
        );
        for (const q of report.origin.choices.filter(
          (q) => q.ownerId !== d.backgroundId,
        ))
          body.append(originControl(q));
        body.append(
          el(
            "details",
            {},
            el("summary", {}, t("raceTraits")),
            report.origin.traits
              .filter((t) => t.ownerId !== d.backgroundId)
              .map((tr) => el("p", {}, localized(tr.name), " · ", t("manual"))),
          ),
        );
        const policy = originCustomizationPolicy(a.context.index);
        if (Object.keys(policy).length)
          body.append(
            el(
              "details",
              {},
              el("summary", {}, t("originAdjustments")),
              ["abilities", "languages", "proficiencies"]
                .filter((k) => policy[k])
                .map((k) =>
                  check(
                    t(
                      {
                        abilities: "scores",
                        languages: "languages",
                        proficiencies: "proficiencies",
                      }[k],
                    ),
                    !!d.originAdjustments?.[k],
                    (e) =>
                      update((x) => {
                        x.originAdjustments ??= {};
                        x.originAdjustments[k] = e.target.checked;
                      }),
                  ),
                ),
            ),
          );
      } else if (!d.manualRace)
        body.append(
          field(
            t("origin") + " · " + t("custom"),
            el("input", {
              value: d.origin,
              maxlength: 200,
              onchange: (e) =>
                update((x) => {
                  x.origin = e.target.value;
                }, false),
            }),
          ),
          el("p", { class: "warning-text" }, t("customReview")),
          field(
            t("languages"),
            el("input", {
              value: d.languages,
              onchange: (e) =>
                update((x) => {
                  x.languages = e.target.value;
                }, false),
            }),
          ),
          field(
            t("traits"),
            el(
              "textarea",
              {
                onchange: (e) =>
                  update((x) => {
                    x.traits = e.target.value;
                  }, false),
              },
              d.traits,
            ),
          ),
        );
      const problems = (report.origin?.issues ?? []).filter(
        (i) => !i.choiceId?.startsWith(d.backgroundId + ":"),
      );
      if (problems.length)
        body.append(el("p", { class: "warning-text" }, t("missingChoices")));
    }
    if (d.step === "background") {
      body.append(
        el("p", {}, t("backgroundCatalogHelp")),
        field(
          t("chooseBackground"),
          select(
            [
              ["", t("customBackground")],
              ...a.context.index
                .list("background")
                .map((b) => [b.id, a.name(b)]),
            ],
            d.backgroundId ?? "",
            (e) =>
              update((x) => {
                x.backgroundId = e.target.value || null;
              }),
          ),
        ),
      );
      if (d.backgroundId) {
        const entry = a.context.index.get(d.backgroundId);
        if (entry) {
          body.append(
            el("p", {}, localized(entry.data.summary)),
            el("p", {}, entry.data.skills.map((k) => a.label(k)).join(" · ")),
            el(
              "p",
              {},
              localized(entry.data.feature.name) + " · " + t("manual"),
            ),
            el("p", {}, t("duplicateHelp")),
          );
          for (const q of report.origin?.choices.filter(
            (q) => q.ownerId === entry.id,
          ) ?? [])
            body.append(originControl(q));
          body.append(
            el(
              "details",
              {},
              el("summary", {}, t("equipment")),
              entry.data.equipment.map((v) => el("p", {}, localized(v.name))),
            ),
          );
        } else
          body.append(el("p", { class: "warning-text" }, t("unavailable")));
      }
      if (!d.backgroundId)
        body.append(
          field(
            t("background"),
            el("input", {
              value: d.background.name,
              maxlength: 200,
              onchange: (e) =>
                update((x) => {
                  x.background.name = e.target.value;
                }, false),
            }),
          ),
          el("p", {}, t("backgroundHelp")),
          el(
            "div",
            { class: "choice-list" },
            Object.keys(SKILLS).map((k) =>
              check(
                a.label(k),
                d.background.skills.includes(k),
                (e) =>
                  update((x) => {
                    x.background.skills = e.target.checked
                      ? [...x.background.skills, k]
                      : x.background.skills.filter((v) => v !== k);
                  }),
                {
                  disabled:
                    !d.background.skills.includes(k) &&
                    d.background.skills.length >= 2,
                },
              ),
            ),
          ),
          field(
            t("proficiencies"),
            el("input", {
              value: d.background.proficiencies.map(human).join(", "),
              onchange: (e) =>
                update((x) => {
                  x.background.proficiencies = e.target.value
                    .split(",")
                    .map((v) =>
                      v
                        .trim()
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    )
                    .filter(Boolean);
                }, false),
            }),
          ),
        );
      if (!d.backgroundId)
        body.append(
          field(
            t("languages"),
            el("input", {
              value: (d.background.languages ?? []).join(", "),
              placeholder: "common, elvish",
              onchange: (e) =>
                update((x) => {
                  x.background.customized = true;
                  x.background.languages = e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                }, false),
            }),
          ),
          field(
            t("features") + " · " + t("customBackground"),
            el(
              "textarea",
              {
                onchange: (e) =>
                  update((x) => {
                    x.background.customized = true;
                    x.background.feature = e.target.value;
                  }, false),
              },
              d.background.feature ?? "",
            ),
          ),
        );
    }
    if (d.step === "class") {
      const c = d.classes[0],
        cls = a.context.index.class(c.id);
      body.append(
        ...d.classes.map((c, n) =>
          field(
            a.cls(c.id) + " · " + t("level"),
            el("input", {
              type: "number",
              min: 1,
              max: 20,
              value: c.level,
              onchange: (e) => changeLevel(n, e.target.value),
            }),
          ),
        ),
      );
      if (cls)
        body.append(
          el("h3", {}, classIcon(c.id) + " " + a.cls(c.id)),
          el(
            "p",
            {},
            t("hitDie") + " : d" + cls.data.hitDie + " — " + t("hitDieHelp"),
          ),
          el(
            "details",
            {},
            el("summary", {}, t("hitDie")),
            el("p", {}, t("hitDieDetails")),
          ),
          el(
            "p",
            {},
            t("subclassAt") +
              " " +
              cls.data.subclassLevel +
              " · " +
              t("proficiencyBonus") +
              " +" +
              proficiencyBonus(d.classes.reduce((n, c) => n + c.level, 0)),
          ),
          el(
            "p",
            {},
            t("features") +
              " : " +
              report.features.length +
              " · " +
              report.choices.filter((q) =>
                report.issues.some((i) => i.choiceId === q.id),
              ).length +
              " " +
              t("remaining"),
          ),
        );
      const info = classInfo(c.id, a.state.locale);
      if (info)
        body.append(
          el(
            "p",
            {},
            info.role +
              " · " +
              info.description +
              " · " +
              t("complexity") +
              " : " +
              info.complexity,
          ),
        );
      const next = report.choices.find((q) =>
        report.issues.some((i) => i.choiceId === q.id),
      );
      if (next)
        body.append(
          el(
            "p",
            {},
            t("requiredChoice") +
              " : " +
              choiceName(next, a) +
              " · " +
              t("level") +
              " " +
              next.level,
          ),
        );
      const cards = el(
        "details",
        { class: "class-options" },
        el("summary", {}, t("classList")),
      );
      body.append(cards);
      cards.append(discoveryGallery(a, d, update, discoveryUI));
      if (d.mode === "expert") {
        body.append(el("h3", {}, t("added")), el("p", {}, t("historyHelp")));
        for (const [n, c] of d.classes.entries())
          if (n > 0)
            body.append(
              el(
                "div",
                { class: "row" },
                el("span", {}, a.cls(c.id)),
                button("×", () =>
                  update((x) => {
                    x.classes.splice(n, 1);
                  }),
                ),
              ),
              field(
                t("level"),
                el("input", {
                  type: "number",
                  min: 1,
                  max: 20,
                  value: c.level,
                  onchange: (e) => changeLevel(n, e.target.value),
                }),
              ),
            );
        const options = a.context.index
          .list("class")
          .filter((i) => !d.classes.some((c) => c.id === i.data.classId));
        if (options.length) {
          let id = options[0].data.classId;
          body.append(
            el(
              "div",
              { class: "row" },
              select(
                options.map((i) => [i.data.classId, a.cls(i.data.classId)]),
                id,
                (e) => {
                  id = e.target.value;
                },
              ),
              button(t("add"), () =>
                update((x) => {
                  if (x.classes.reduce((n, c) => n + c.level, 0) < 20)
                    x.classes.push({ id, level: 1, subclassId: null });
                }),
              ),
            ),
          );
        }
      }
    }
    if (d.step === "level") {
      body.append(
        ...d.classes.map((c, n) =>
          field(
            a.cls(c.id) + " · " + t("level"),
            el("input", {
              type: "number",
              min: 1,
              max: 20,
              value: c.level,
              onchange: (e) => changeLevel(n, e.target.value),
            }),
          ),
        ),
        el("p", {}, t("historyHelp")),
      );
    }
    async function changeLevel(n, value) {
      const level = Number(value),
        total = d.classes.reduce(
          (sum, c, i) => sum + (i === n ? level : c.level),
          0,
        );
      if (!Number.isInteger(level) || level < 1 || total > 20) {
        a.notice(t("error"));
        return;
      }
      await update((x) => {
        x.classes[n].level = level;
      });
    }
    if (d.step === "scores") {
      body.append(
        check(
          a.state.locale === "fr"
            ? "Ces valeurs sont la base ; ajouter les bonus raciaux."
            : "These are base scores; add racial bonuses.",
          d.scoresAreBase ?? false,
          (e) =>
            update((x) => {
              x.scoresAreBase = e.target.checked;
            }),
        ),
      );
      body.append(
        el(
          "p",
          {},
          t("level") + " " + d.classes.reduce((n, c) => n + c.level, 0),
        ),
        field(
          t("method"),
          select(
            ["standard", "point-buy", "rolled", "manual"].map((k) => [
              k,
              t(k === "manual" ? "manualScores" : k),
            ]),
            d.scoreMethod ?? "manual",
            (e) =>
              update((x) => {
                x.scoreMethod = e.target.value;
                if (x.scoreMethod === "standard")
                  x.scores = templateScores(x.classes[0].id);
                if (x.scoreMethod === "point-buy")
                  x.scores = Object.fromEntries(ABILITIES.map((k) => [k, 8]));
              }),
          ),
        ),
        el("p", {}, t("scoreHelp")),
      );
      if (d.scoreMethod === "rolled")
        body.append(
          button(t("rollScores"), () =>
            update((x) => {
              const rolled = rollAbilityScores();
              x.scoreRolls = rolled.rolls;
              x.scores = Object.fromEntries(
                ABILITIES.map((k, i) => [k, rolled.values[i]]),
              );
            }),
          ),
          el("small", {}, JSON.stringify(d.scoreRolls ?? [])),
        );
      if (d.scoreMethod === "standard")
        body.append(
          button(t("standard") + " · " + a.cls(d.classes[0].id), () =>
            update((x) => {
              x.scores = templateScores(x.classes[0].id);
            }),
          ),
          el("p", {}, "15, 14, 13, 12, 10, 8"),
        );
      if (d.scoreMethod === "point-buy")
        body.append(
          el(
            "p",
            {},
            String(
              Object.values(d.scores).reduce(
                (n, v) => n + (POINT_COST[v] ?? 100),
                0,
              ),
            ) + " / 27",
          ),
        );
      const table = el(
        "table",
        {},
        el(
          "thead",
          {},
          el(
            "tr",
            {},
            ["scores", "base", "racialBonus", "advancementBonus", "final"].map(
              (k) => el("th", {}, t(k)),
            ),
          ),
        ),
      );
      table.append(
        el(
          "tbody",
          {},
          ABILITIES.map((k) =>
            el(
              "tr",
              {},
              el("th", {}, a.label(k)),
              el(
                "td",
                {},
                el("input", {
                  "aria-label": a.label(k),
                  type: "number",
                  min: 1,
                  max: 30,
                  value: d.scores[k],
                  onchange: (e) => {
                    const v = Number(e.target.value);
                    if (Number.isInteger(v) && v >= 1 && v <= 30)
                      update((x) => {
                        x.scores[k] = v;
                      });
                  },
                }),
              ),
              el(
                "td",
                {},
                d.scoresAreBase ? (report.origin?.bonuses[k] ?? 0) : "—",
              ),
              el(
                "td",
                {},
                (report.scores?.[k] ?? d.scores[k]) -
                  (report.origin?.scores[k] ?? d.scores[k]),
              ),
              el(
                "td",
                {},
                String(report.scores?.[k] ?? d.scores[k]) +
                  " (" +
                  modifier(report.scores?.[k] ?? d.scores[k]) +
                  ")",
              ),
            ),
          ),
        ),
      );
      body.append(el("div", { class: "score-table" }, table));
      const simAbility = select(
        ABILITIES.map((k) => [k, a.label(k)]),
        "str",
        () => {},
      );
      const simScore = el("input", {
        type: "number",
        min: 1,
        max: 30,
        value: d.scores.str,
        "aria-label": w("Score simulé", "Simulated score"),
      });
      body.append(
        el(
          "details",
          {},
          el(
            "summary",
            {},
            w("Simuler une caractéristique", "Simulate an ability score"),
          ),
          field(w("Caractéristique simulée", "Simulated ability"), simAbility),
          field(w("Score simulé", "Simulated score"), simScore),
          button(w("Voir les conséquences", "See consequences"), () => {
            const k = simAbility.value,
              v = Number(simScore.value);
            if (!Number.isInteger(v) || v < 1 || v > 30) return;
            openSimulation(
              a,
              d,
              (x) => {
                x.scores[k] = v;
              },
              () =>
                update((x) => {
                  x.scores[k] = v;
                }),
            );
          }),
        ),
      );

      if (report.origin?.issues.some((i) => i.code === "score-method"))
        body.append(el("p", { class: "warning-text" }, t("scoreInvalid")));
      for (const q of report.choices.filter((q) => q.kind === "asi"))
        body.append(
          el(
            "p",
            {},
            choiceName(q, a) +
              " : " +
              (d.selections[q.id] ?? [])
                .map((v) => optionName(v, a))
                .join(", "),
          ),
        );
      body.append(
        el(
          "p",
          {},
          t("hp") +
            " : " +
            (report.hpPreview ?? "—") +
            " · " +
            (a.state.locale === "fr"
              ? "Moyenne des dés de vie, Constitution et bonus racial ; autres effets manuels à vérifier."
              : "Average Hit Dice, Constitution and racial bonus; check other manual effects."),
        ),
      );
      body.append(el("p", {}, t("preparationHelp")));
    }
    if (d.step === "features")
      for (const c of d.classes) {
        const data = a.context.index.class(c.id)?.data;
        if (
          !data ||
          c.level < data.subclassLevel ||
          Number(
            d.uiLevel ??
              report.choices.find((q) =>
                report.issues.some((i) => i.choiceId === q.id),
              )?.level ??
              1,
          ) !== data.subclassLevel
        )
          continue;
        const subs = a.context.index
          .list("subclass")
          .filter((i) => i.data.classId === c.id);
        body.append(
          field(
            a.cls(c.id) + " · " + t("subclass"),
            select(
              [["", t("choose")], ...subs.map((i) => [i.id, a.name(i)])],
              c.subclassId ?? "",
              (e) =>
                update((x) => {
                  const current = x.classes.find((k) => k.id === c.id);
                  if (
                    current.subclassId &&
                    current.subclassId !== e.target.value
                  )
                    retainDecision(x, "subclass", c.id);
                  current.subclassId = e.target.value || null;
                }),
            ),
          ),
        );
        if (c.subclassId && !a.context.index.get(c.subclassId))
          body.append(el("p", { class: "warning-text" }, t("unavailable")));
      }
    if (d.step === "skills") {
      body.append(el("p", {}, t("grantHelp")));
      const ledger = [...(report.origin?.ledger ?? [])];
      d.classes.forEach((c, n) => {
        const entry = a.context.index.class(c.id);
        for (const p of (n === 0
          ? entry?.data.initialProficiencies
          : entry?.data.multiclassProficiencies) ?? [])
          ledger.push({
            kind: "proficiency",
            value: p,
            name: { ...entry.name, [a.state.locale]: a.cls(c.id) },
          });
        if (n === 0)
          for (const p of entry?.data.saves ?? [])
            ledger.push({
              kind: "save",
              value: p,
              name: { ...entry.name, [a.state.locale]: a.cls(c.id) },
            });
      });
      for (const q of report.choices.filter((q) =>
        ["skill", "expertise", "proficiency"].includes(q.kind),
      ))
        for (const value of d.selections[q.id] ?? [])
          ledger.push({
            kind: q.kind,
            value,
            name:
              q.ownerId && a.context.index.get(q.ownerId)?.type !== "class"
                ? {
                    ...a.context.index.get(q.ownerId)?.name,
                    [a.state.locale]: a.name(a.context.index.get(q.ownerId)),
                  }
                : {
                    ...a.context.index.class(q.classId)?.name,
                    [a.state.locale]: a.cls(q.classId),
                  },
          });
      const category = (r) =>
        r.kind === "skill"
          ? t("skills")
          : r.kind === "save"
            ? t("saveThrows")
            : r.kind === "expertise"
              ? "Expertise"
              : r.kind === "language"
                ? t("languages")
                : r.value === "shields"
                  ? t("shield")
                  : r.value.includes("armor")
                    ? t("armor")
                    : r.value.includes("weapons") ||
                        Object.values(WEAPONS).some(
                          (w) => w.proficiency === r.value,
                        )
                      ? t("weapons")
                      : a.state.locale === "fr"
                        ? "Outils"
                        : "Tools";
      body.append(
        el(
          "details",
          {},
          el("summary", {}, t("proficiencies") + " · " + ledger.length),
          el(
            "table",
            {},
            el(
              "thead",
              {},
              el(
                "tr",
                {},
                el("th", {}, t("proficiencies")),
                el("th", {}, t("filter")),
                el("th", {}, t("provenance")),
              ),
            ),
            el(
              "tbody",
              {},
              ledger.map((r) =>
                el(
                  "tr",
                  {},
                  el(
                    "td",
                    {},
                    term(r.value) +
                      (r.kind === "expertise"
                        ? " · Expertise"
                        : r.kind === "save"
                          ? " · " + t("saveThrows")
                          : ""),
                  ),
                  el("td", {}, category(r)),
                  el("td", {}, localized(r.name)),
                ),
              ),
            ),
          ),
        ),
      );
      for (const q of report.origin?.choices.filter((q) =>
        ["skill", "language", "proficiency"].includes(q.kind),
      ) ?? [])
        body.append(originControl(q));
    }
    if (["skills", "spells", "features"].includes(d.step)) {
      const pending = (q) => report.issues.some((i) => i.choiceId === q.id);
      const featureChoices = report.choices.filter(
        (q) =>
          !["skill", "proficiency", "subclass"].includes(q.kind) &&
          (!spellChoices.includes(q) || q.id.includes("magical-secrets")),
      );
      const allFeatureChoices = report.choices.filter(
        (q) =>
          !["skill", "proficiency"].includes(q.kind) &&
          (!spellChoices.includes(q) || q.id.includes("magical-secrets")),
      );
      if (d.step === "features") {
        const levels = [
          ...new Set(
            allFeatureChoices
              .map((q) => q.level)
              .concat(
                d.classes.flatMap((c) =>
                  Array.from({ length: c.level }, (_, n) => n + 1),
                ),
              ),
          ),
        ].sort((a, b) => a - b);
        const focus = Number(
          d.uiLevel ?? allFeatureChoices.find(pending)?.level ?? 1,
        );
        if (!levels.includes(focus)) d.uiLevel = 1;
        const timeline = el(
          "div",
          {
            class: "level-timeline",
            "aria-label": w("Progression par niveau", "Level timeline"),
          },
          levels.map((l) => {
            const needs = allFeatureChoices.filter(
              (q) => q.level === l && pending(q),
            ).length;
            const b = button(
              String(l) + (needs ? " · " + needs : " ✓"),
              () =>
                viewUpdate((x) => {
                  x.uiLevel = l;
                }),
              l === Number(d.uiLevel ?? focus) ? "active" : "",
            );
            b.setAttribute(
              "aria-label",
              t("level") +
                " " +
                l +
                " · " +
                (needs
                  ? w("À choisir", "To choose")
                  : w("Automatique ou terminé", "Automatic or complete")),
            );
            b.setAttribute(
              "aria-pressed",
              String(l === Number(d.uiLevel ?? focus)),
            );
            return b;
          }),
        );
        body.append(timeline);
        body.append(
          el(
            "div",
            { class: "row" },
            badge(
              allFeatureChoices.filter(pending).length + " " + t("remaining"),
              "warning",
            ),
            field(
              t("levelFocus"),
              select(
                levels.map((l) => [
                  String(l),
                  t("level") +
                    " " +
                    l +
                    " · " +
                    allFeatureChoices.filter((q) => q.level === l && pending(q))
                      .length,
                ]),
                String(d.uiLevel ?? focus),
                (e) =>
                  viewUpdate((x) => {
                    x.uiLevel = Number(e.target.value);
                  }),
              ),
            ),
          ),
        );
      }

      let qs =
        d.step === "skills"
          ? report.choices.filter((q) =>
              ["skill", "proficiency"].includes(q.kind),
            )
          : d.step === "spells"
            ? spellChoices
            : featureChoices.filter(
                (q) =>
                  q.level ===
                  Number(
                    d.uiLevel ?? allFeatureChoices.find(pending)?.level ?? 1,
                  ),
              );
      if (d.step === "spells" && qs.length) {
        if (!qs.some((q) => q.id === d.uiSpellChoice))
          d.uiSpellChoice = qs.find(pending)?.id ?? qs[0].id;
        body.append(
          el("p", {}, t("spellsHelp")),
          field(
            t("choiceFocus"),
            select(
              qs.map((q) => [
                q.id,
                choiceName(q, a) +
                  " · " +
                  (d.selections[q.id]?.length ?? 0) +
                  " / " +
                  q.count,
              ]),
              d.uiSpellChoice,
              (e) =>
                viewUpdate((x) => {
                  x.uiSpellChoice = e.target.value;
                }),
            ),
          ),
        );
        qs = qs.filter((q) => q.id === d.uiSpellChoice);
      }
      for (const q of qs) body.append(choiceControl(q));
      if (d.step === "features") {
        body.append(
          el(
            "details",
            {},
            el("summary", {}, t("features") + " · " + report.features.length),
            el(
              "ul",
              { class: "summary-list" },
              report.features
                .filter((id) => {
                  const focus = Number(
                    d.uiLevel ?? allFeatureChoices.find(pending)?.level ?? 1,
                  );
                  return (
                    d.classes.some((c) =>
                      [
                        ...(a.context.index.class(c.id)?.data.grants ?? []),
                        ...(a.context.index.get(c.subclassId)?.data.grants ??
                          []),
                      ].some(
                        (row) =>
                          row.level === focus && row.featureIds.includes(id),
                      ),
                    ) ||
                    (a.context.index.get(id)?.data.optionalClassFeature &&
                      a.context.index.get(id).data.minimumClassLevel === focus)
                  );
                })
                .map((id) =>
                  el(
                    "li",
                    {},
                    button(
                      a.name(a.context.installed.get(id)) || t("unavailable"),
                      () => inspectEntry(a.context.installed.get(id), a),
                    ),
                    badge(
                      t(
                        a.context.installed.get(id)?.data.optionalClassFeature
                          ? "optionalChoice"
                          : "automatic",
                      ),
                    ),
                    badge(
                      t(
                        a.context.installed.get(id)?.data.automation.status ??
                          "manual",
                      ),
                    ),
                  ),
                ),
            ),
          ),
        );
        const obsolete = report.issues.filter((i) =>
          ["obsolete-choice", "unavailable-selection"].includes(i.code),
        );
        if (obsolete.length)
          body.append(
            el(
              "p",
              { class: "warning-text" },
              issueMessage(obsolete[0], report, a),
            ),
            button(t("clear"), () =>
              update((x) => {
                for (const i of obsolete) {
                  if (i.choiceId) retainDecision(x, "class", i.choiceId);
                  else if (i.id) {
                    x.sourceReferences = (x.sourceReferences ?? []).filter(
                      (id) => id !== i.id,
                    );
                    for (const key of Object.keys(x.selections))
                      x.selections[key] = x.selections[key].filter(
                        (id) => id !== i.id,
                      );
                  }
                }
              }),
            ),
          );
      }
    }
    function choiceControl(q) {
      const view = uiFilters.get(q.id) ?? { query: "", page: 0, level: "all" };
      uiFilters.set(q.id, view);
      const values = d.selections[q.id] ?? [],
        count = badge(
          values.length + " / " + q.count,
          values.length === q.count ? "" : "warning",
        ),
        list = el("div", { class: "choice-list" }),
        search = el("input", {
          type: "search",
          placeholder: t("spellSearch"),
          "aria-label": choiceName(q, a) + " " + t("search"),
          value: view.query,
          oninput: () => {
            view.query = search.value;
            view.page = 0;
            fill();
          },
        });
      function fill() {
        list.replaceChildren();
        const filtered = q.options
          .filter((v) =>
            [
              optionName(v, a),
              ...Object.values(a.context.installed.get(v)?.name ?? {}),
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(view.query.toLocaleLowerCase()),
          )
          .filter(
            (v) =>
              view.level === "all" ||
              a.context.index.get(v)?.data.level === Number(view.level),
          );
        const pages = Math.max(1, Math.ceil(filtered.length / 8));
        view.page = Math.min(view.page, pages - 1);
        for (const value of filtered.slice(
          view.page * 8,
          (view.page + 1) * 8,
        )) {
          const entry = a.context.index.get(value),
            label = optionName(value, a);
          list.append(
            el(
              "div",
              { class: "choice-row" },
              check(
                label,
                values.includes(value),
                (e) =>
                  update((x) => {
                    x.selections[q.id] = e.target.checked
                      ? [...(x.selections[q.id] ?? []), value]
                      : (x.selections[q.id] ?? []).filter((k) => k !== value);
                  }),
                {
                  disabled: !values.includes(value) && values.length >= q.count,
                },
              ),
              entry ? button(t("inspect"), () => inspectEntry(entry, a)) : null,
            ),
          );
        }
      }
      const pageNav = el("div", { class: "row choice-pages" });
      const originalFill = fill;
      const refresh = () => {
        originalFill();
        pageNav.replaceChildren(
          button(t("previousPage"), () => {
            view.page = Math.max(0, view.page - 1);
            refresh();
          }),
          el("small", {}, String(view.page + 1)),
          button(t("nextPage"), () => {
            view.page++;
            refresh();
          }),
        );
      };
      // Search and filters reset pagination and update the same list.
      search.addEventListener("input", refresh);
      refresh();
      const levels = [
        ...new Set(
          q.options
            .map((v) => a.context.index.get(v)?.data.level)
            .filter((v) => v !== undefined),
        ),
      ].sort((a, b) => a - b);
      return el(
        "section",
        { class: "choice", "data-choice-id": q.id },
        el(
          "details",
          { open: report.issues.some((i) => i.choiceId === q.id) },
          el("summary", {}, el("h3", {}, choiceName(q, a), count)),
          q.adjudication
            ? el("p", { class: "warning-text" }, t("reviewHelp"))
            : null,
          q.options.length > 10 ? search : null,
          levels.length > 1
            ? field(
                t("level"),
                select(
                  [
                    ["all", t("allChoices")],
                    ...levels.map((l) => [
                      String(l),
                      l === 0 ? t("cantrips") : t("level") + " " + l,
                    ]),
                  ],
                  view.level,
                  (e) => {
                    view.level = e.target.value;
                    view.page = 0;
                    refresh();
                  },
                ),
              )
            : null,
          list,
          q.options.length > 8 ? pageNav : null,
          values.length
            ? el(
                "details",
                {},
                el("summary", {}, t("selected") + " · " + values.length),
                values.map((v) =>
                  button(optionName(v, a) + " ×", () =>
                    update((x) => {
                      x.selections[q.id] = values.filter((k) => k !== v);
                    }),
                  ),
                ),
              )
            : null,
        ),
      );
    }
    if (d.step === "spells") {
      const equip = el(
        "details",
        { open: spellChoices.length ? null : true },
        el("summary", {}, t("equipment")),
      );
      body.append(equip);
      equip.append(
        el("p", {}, t("equipmentHelp")),
        field(
          t("armor"),
          select(
            [
              ["none", t("unarmored")],
              ...Object.entries(ARMORS).map(([id, v]) => [
                id,
                localized(v.name),
              ]),
            ],
            d.equipment,
            (e) =>
              update((x) => {
                x.equipment = e.target.value;
              }),
          ),
        ),
        check(t("shield"), d.shield, (e) =>
          update((x) => {
            x.shield = e.target.checked;
          }),
        ),
      );
      equip.append(
        field(
          t("weapons"),
          select(
            [
              ["", t("choose")],
              ...Object.entries(WEAPONS).map(([id, w]) => [
                id,
                localized(w.name) + " · " + w.dice,
              ]),
            ],
            "",
            (e) => {
              if (e.target.value)
                update((x) => {
                  x.weapons = [
                    ...new Set([...(x.weapons ?? []), e.target.value]),
                  ];
                });
            },
          ),
        ),
        el(
          "div",
          { class: "row" },
          (d.weapons ?? []).map((id) =>
            button(localized(WEAPONS[id]?.name) + " ×", () =>
              update((x) => {
                x.weapons = x.weapons.filter((v) => v !== id);
              }),
            ),
          ),
        ),
      );
      equip.append(
        field(
          t("equipmentNotes"),
          el(
            "textarea",
            {
              onchange: (e) =>
                update((x) => {
                  x.equipmentNotes = e.target.value;
                }, false),
            },
            d.equipmentNotes ?? "",
          ),
        ),
        el(
          "p",
          {},
          (report.origin?.equipment ?? [])
            .map((v) => localized(v.name))
            .join(" · "),
        ),
      );
      const auto = [
        ...(report.grantedSpells ?? []),
        ...(report.origin?.spells ?? []),
      ];
      if (auto.length)
        body.append(
          el(
            "details",
            {},
            el("summary", {}, t("knownAuto")),
            auto.map((v) => el("p", {}, a.name(a.context.index.get(v.id)))),
          ),
        );
    }
    function issueControl(i) {
      const target = issueStep(i, report),
        kind = diagnosticKind(i);
      const names = {
        required: w("Choix requis", "Required choice"),
        review: w("Revue MJ", "GM review"),
        content: w("Contenu indisponible", "Unavailable content"),
        automation: w("Automatisation partielle", "Partial automation"),
        info: w("Information", "Information"),
        error: w("Erreur bloquante", "Blocking error"),
      };
      return el(
        "li",
        { class: "diagnostic " + kind },
        badge(names[kind], "warning"),
        button(issueMessage(i, report, a), async () => {
          d.step = target;
          const q = report.choices.find((q) => q.id === i.choiceId);
          if (q) {
            d.uiLevel = q.level;
            d.uiSpellChoice = q.id;
            focusIssue = q.id;
          }
          await a.autosave(d);
          await draw();
          const control =
            focusIssue &&
            [...shell.querySelectorAll("[data-choice-id]")].find(
              (e) => e.dataset.choiceId === focusIssue,
            );
          control?.querySelector("details")?.setAttribute("open", "");
          (
            control?.querySelector("input,select,button") ??
            shell.querySelector(".editor-main h2")
          )?.focus();
        }),
      );
    }
    if (d.step === "summary") {
      const r = compileDraft(a.context, a.config, d);
      body.append(
        el("h3", {}, d.name || t("create")),
        el(
          "p",
          {},
          d.classes.map((c) => a.cls(c.id) + " " + c.level).join(" / "),
        ),
        el(
          "p",
          {},
          (report.origin?.race ? a.name(report.origin.race) : d.origin) +
            " · " +
            report.origin?.background.name,
        ),
        el(
          "div",
          { class: "score-grid" },
          ABILITIES.map((k) =>
            el(
              "div",
              { class: "stat" },
              el("small", {}, a.label(k)),
              el("strong", {}, report.scores?.[k] ?? d.scores[k]),
            ),
          ),
        ),
        check(t("confirmation"), d.confirmed, async (e) => {
          d.confirmed = e.target.checked;
          await a.autosave(d);
          await draw();
        }),
        check(t("approved"), d.reviewed, async (e) => {
          d.reviewed = e.target.checked;
          await a.autosave(d);
          await draw();
        }),
        badge(t(r.status), r.status === "ready" ? "" : "warning"),
      );
      body.append(
        el(
          "details",
          { class: "final-details" },
          el("summary", {}, w("Détail du personnage", "Character details")),
          el(
            "p",
            {},
            w("Sources activées : ", "Enabled sources: ") +
              (a.config.enabledSourceIds ?? []).join(" · "),
          ),
          el(
            "p",
            {},
            d.classes
              .map((c) =>
                c.subclassId ? a.name(a.context.index.get(c.subclassId)) : "",
              )
              .filter(Boolean)
              .join(" · "),
          ),
          el("h3", {}, t("features")),
          report.features.map((id) =>
            el("p", {}, a.name(a.context.index.get(id))),
          ),
          el("h3", {}, t("proficiencies")),
          el(
            "p",
            {},
            Object.entries(d.selections)
              .filter(([k]) => /skill|expertise/.test(k))
              .map(([, v]) => v.map((id) => optionName(id, a)).join(" · "))
              .join(" · "),
          ),
          el("h3", {}, t("spells")),
          el(
            "p",
            {},
            r.character?.spells.known
              .map((id) => a.name(a.context.index.get(id)))
              .join(" · ") ??
              w(
                "Complétez les décisions pour obtenir la liste validée.",
                "Complete decisions for a validated spell list.",
              ),
          ),
          el("h3", {}, t("equipment")),
          el(
            "p",
            {},
            d.equipment +
              " · " +
              (d.weapons ?? [])
                .map((id) => localized(WEAPONS[id]?.name))
                .join(" · "),
          ),
        ),
      );
      if (r.issues.length)
        body.append(el("ul", { class: "issues" }, r.issues.map(issueControl)));
      if (r.valid)
        body.append(
          el("p", {}, t("reviewHelp")),
          el(
            "div",
            { class: "stat-grid" },
            el(
              "div",
              { class: "stat" },
              t("hp"),
              el("strong", {}, r.stats.maxHp),
            ),
            el("div", { class: "stat" }, t("ac"), el("strong", {}, r.stats.ac)),
          ),
        );
      body.append(
        button(
          t("save"),
          async () => {
            try {
              const result = compileDraft(a.context, a.config, d);
              if (!result.valid) {
                a.notice(t("missingChoices"));
                return;
              }
              result.character.revision =
                expectedCharacterRevision === null
                  ? 1
                  : expectedCharacterRevision + 1;
              d.status = result.status;
              d.sourceReferences = [
                ...new Set([
                  ...result.character.features.filter((id) =>
                    a.context.index.get(id),
                  ),
                  ...[d.raceId, d.backgroundId].filter(Boolean),
                  ...result.character.spells.known,
                  ...result.character.classes.flatMap((c) => [
                    a.context.index.class(c.id).id,
                    ...(c.subclassId ? [c.subclassId] : []),
                  ]),
                ]),
              ];
              await a.autosave(d);
              const saved = await a.drafts.finalize(d, result.character, {
                expectedCharacterRevision,
                expectedDraftRevision: d.revision,
                spellbook: result.spellbook,
              });
              Object.assign(d, saved.draft);
              await a.nav("companion", d.id);
            } catch (e) {
              a.fail(e);
            }
          },
          "primary",
        ),
      );
    }
    const reviewIssues = report.issues.filter(
      (i) => !["required-choice", "origin-choice"].includes(i.code),
    );
    if (reviewIssues.length)
      aside.append(
        el(
          "details",
          { open: true },
          el("summary", {}, t("review") + " · " + reviewIssues.length),
          el("ul", { class: "issues" }, reviewIssues.map(issueControl)),
        ),
      );
    const invalidChoices = [
      ...new Set(
        report.issues
          .filter(
            (i) =>
              i.choiceId &&
              !["required-choice", "origin-choice"].includes(i.code),
          )
          .map((i) => i.choiceId),
      ),
    ];
    const invalidOrigins = (report.origin?.issues ?? []).filter(
      (i) =>
        i.choiceId &&
        ["obsolete-origin-choice", "origin-choice"].includes(i.code) &&
        d.originSelections?.[i.choiceId]?.length,
    );
    const inactive = d.classes.filter(
      (c) =>
        c.subclassId &&
        c.level < (a.context.index.class(c.id)?.data.subclassLevel ?? 99),
    );
    if (invalidChoices.length || invalidOrigins.length || inactive.length)
      aside.append(
        button(
          a.state.locale === "fr"
            ? "Conserver à part les décisions invalides"
            : "Retain invalid decisions separately",
          () =>
            update((x) => {
              for (const id of invalidChoices) retainDecision(x, "class", id);
              for (const i of invalidOrigins)
                retainDecision(x, "origin", i.choiceId);
              for (const c of inactive) retainDecision(x, "subclass", c.id);
            }),
        ),
      );
    if (d.retainedDecisions?.length)
      aside.append(
        el(
          "details",
          {},
          el(
            "summary",
            {},
            (a.state.locale === "fr"
              ? "Décisions conservées"
              : "Retained decisions") +
              " · " +
              d.retainedDecisions.length,
          ),
          d.retainedDecisions.map((r, n) =>
            el(
              "div",
              {},
              el(
                "p",
                {},
                (report.choices.find((q) => q.id === r.choiceId)
                  ? choiceName(
                      report.choices.find((q) => q.id === r.choiceId),
                      a,
                    )
                  : a.state.locale === "fr"
                    ? "Choix antérieur"
                    : "Previous decision") +
                  " : " +
                  r.values.map((v) => optionName(v, a)).join(", "),
              ),
              button(t("restore"), () => update((x) => restoreDecision(x, n))),
            ),
          ),
        ),
      );
    const allChoices = [...report.choices, ...(report.origin?.choices ?? [])];
    const selected = allChoices.filter(
      (q) =>
        ((!report.choices.includes(q)
          ? d.originSelections?.[q.id]
          : d.selections[q.id]
        )?.length ??
          (q.kind === "subclass" &&
          d.classes.find((c) => c.id === q.classId)?.subclassId
            ? 1
            : 0)) === q.count,
    ).length;
    aside.append(
      el(
        "section",
        { class: "panel draft-tools" },
        badge(t(d.status === "ready" && d.finalized ? "ready" : "draft")),
        el("h3", {}, d.name || t("create")),
        el(
          "p",
          {},
          d.classes.map((c) => a.cls(c.id) + " " + c.level).join(" / "),
        ),
        el(
          "small",
          {},
          report.origin?.race ? a.name(report.origin.race) : d.origin,
        ),
        el("small", {}, report.origin?.background.name ?? d.background.name),
        el(
          "p",
          {},
          ABILITIES.map(
            (k) =>
              a.label(k).slice(0, 3) +
              " " +
              (report.scores?.[k] ?? d.scores[k]),
          ).join(" · "),
        ),
        el(
          "small",
          {},
          t("required") + " · " + selected + " / " + allChoices.length,
        ),
        el(
          "div",
          { class: "progress-bar" },
          el("div", {
            style:
              "width:" +
              Math.round((selected / Math.max(1, allChoices.length)) * 100) +
              "%",
          }),
        ),
        el(
          "details",
          { class: "template-tools" },
          el("summary", {}, t("model")),
          field(
            t("model"),
            select(
              CREATION_MODELS.map((key) => [key, t("model_" + key)]),
              d.model ?? "balanced",
              async (e) => {
                d.model = e.target.value;
                await a.autosave(d);
              },
            ),
          ),
          button(t("preset"), async () => {
            Object.assign(d, suggestChoices(a.context, a.config, d));
            await a.autosave(d);
            await draw();
          }),
          el("p", {}, t("presetHelp")),
        ),
        button(t("sources"), () => a.nav("sources")),
      ),
    );
    const index = steps.indexOf(d.step);
    center.append(
      el(
        "div",
        { class: "editor-actions" },
        button(t("back"), async () => {
          if (index) {
            d.step = steps[index - 1];
            await a.autosave(d);
            await draw();
          } else await a.nav("library");
        }),
        button(
          t("next"),
          async () => {
            const path = steps;
            const position = path.indexOf(d.step);
            d.step =
              position >= 0
                ? path[Math.min(position + 1, path.length - 1)]
                : steps[Math.min(index + 1, steps.length - 1)];
            await a.autosave(d);
            await draw();
          },
          "primary",
        ),
      ),
    );
  }
  await draw();
}
