import { el, button, field, select, check, badge, download } from "./dom.js";
import {
  newItem,
  baseProfile,
  addBaseProfile,
  copyItem,
  newAbility,
  newResource,
  effect,
  uid,
  categories,
  rarities,
  damageTypes,
  exportItems,
} from "../../src/forge/model.js";
import { spellReference } from "../../src/catalog/spell-reference.js";
import { localizedName } from "../../src/catalog/localization.js";
import { forgeRepository } from "../../src/forge/repository.js";
const entries = Object.entries;
const abilities = {
  str: "Force",
  dex: "Dextérité",
  con: "Constitution",
  int: "Intelligence",
  wis: "Sagesse",
  cha: "Charisme",
};
const activations = {
  passive: "Permanent",
  action: "Action",
  "bonus-action": "Action bonus",
  reaction: "Réaction",
  triggered: "Déclenchement",
  special: "Spécial",
  unknown: "À confirmer",
};
const triggers = {
  "": "Aucun",
  "on-attack": "Jet d’attaque",
  "on-hit": "Coup réussi",
  "damage-taken": "Dégâts subis",
  "source-turn-start": "Début de mon tour",
  "source-turn-end": "Fin de mon tour",
  "target-turn-start": "Début du tour de la cible",
  "target-turn-end": "Fin du tour de la cible",
};
const recovery = {
  dawn: "À l’aube",
  dusk: "Au crépuscule",
  midnight: "À minuit",
  "short-rest": "Repos court",
  "long-rest": "Repos long",
  "daily-unspecified": "Quotidien, moment à préciser",
  never: "Aucune",
  unknown: "À confirmer",
};
const units = {
  round: "Round",
  turn: "Tour",
  minute: "Minute",
  hour: "Heure",
  day: "Jour",
  permanent: "Permanent",
  "until-next-attack": "Prochaine attaque",
  "until-dispelled": "Jusqu’à dissipation",
  special: "Spéciale",
};
const templates = {
  modifier: [
    "Bonus ou modification",
    { stat: "attack", value: 1, operation: "add", scope: "this-weapon" },
  ],
  damage: ["Dégâts", { dice: "1d6", damageType: "fire", role: "additional" }],
  defense: [
    "Résistance / immunité",
    { kind: "resistance", damageType: "fire", condition: null },
  ],
  "ability-score": [
    "Caractéristique",
    { ability: "str", operation: "floor", value: 19 },
  ],
  healing: ["Soins / régénération", { dice: "1d8" }],
  "cast-spell": [
    "Sort",
    { spellId: "", level: null, dc: null, attackBonus: null },
  ],
  "roll-mode": [
    "Avantage / désavantage",
    { roll: "attack", mode: "advantage", context: "" },
  ],
  condition: ["État", { condition: "prone", operation: "apply" }],
  movement: [
    "Déplacement",
    { mode: "walk", operation: "add", value: 3, unit: "m" },
  ],
  light: ["Lumière", { radius: 9, unit: "m", intensity: "bright" }],
  "mode-switch": [
    "Transformation / mode",
    { modeId: "", exclusiveGroup: "forme" },
  ],
  "grant-action": ["Action supplémentaire", { abilityId: "" }],
  custom: [
    "Effet personnalisé",
    { key: "forge:custom", summary: "", payload: {}, fallback: "manual" },
  ],
};
const customPresets = {
  "temporary-hp": "Points de vie temporaires",
  teleport: "Téléportation",
  aura: "Aura",
  summon: "Invocation de créatures",
  "damage-reduction": "Réduction de dégâts",
  "extra-attack": "Attaque supplémentaire",
};
let catalogPromise,
  queue = Promise.resolve(),
  saveError = null;
export async function flushForge() {
  await queue;
  if (saveError) throw saveError;
}
async function catalog() {
  return (catalogPromise ??= Promise.all(
    ["official.items", "compagnie-creole.items"].map(async (file) => {
      const r = await fetch(
        new URL(`../../src/forge/catalog/${file}.json`, import.meta.url),
      );
      if (!r.ok) throw Error("Catalogue indisponible");
      return r.json();
    }),
  ).then((rows) => rows.flat()).catch(error => { catalogPromise = null; throw error; }));
}
const detail = (title, ...content) =>
  el("details", {}, el("summary", {}, title), ...content);
const grid = (...children) => el("div", { class: "forge-fields" }, ...children);
function describe(e) {
  const p = e.params,
    t = e.templateId.split(":").at(-1);
  switch (t) {
    case "modifier":
      return `${{ attack: "Attaque", damage: "Dégâts", ac: "CA", "spell-attack": "Attaque de sort", "spell-save-dc": "DD des sorts", "saving-throws": "Sauvegardes", initiative: "Initiative" }[p.stat]} ${p.operation === "add" && p.value >= 0 ? "+" : ""}${p.value}`;
    case "damage":
      return `${p.dice} ${damageTypes[p.damageType] ?? "(type à préciser)"}${p.role === "weapon-base" ? " · base" : ""}`;
    case "defense":
      return `${{ resistance: "Résistance", immunity: "Immunité", vulnerability: "Vulnérabilité" }[p.kind]} : ${damageTypes[p.damageType]}`;
    case "ability-score":
      return `${abilities[p.ability]} ${p.operation === "floor" ? "au moins" : p.operation === "set" ? "fixée à" : "modifiée de"} ${p.value}`;
    case "healing":
      return `Soins ${p.dice}`;
    case "cast-spell":
      return `Sort : ${spellReference(p.spellId)?.name.fr ?? "à préciser"}${p.dc?.kind === "fixed" ? " · DD " + p.dc.value : ""}`;
    case "custom":
      return p.key === "forge:base-profile"
        ? `Profil : ${p.payload.baseAC ? "CA " + p.payload.baseAC : p.payload.shieldBase !== null ? "bouclier +" + p.payload.shieldBase : "arme"}${p.payload.versatileDice ? " · polyvalent " + p.payload.versatileDice : ""}${p.payload.range ? " · portée " + p.payload.range + " m" : ""}`
        : p.summary || "Effet manuel à décrire";
    case "movement":
      return `Déplacement ${p.value} ${p.unit}`;
    case "light":
      return `Lumière ${p.radius} ${p.unit}`;
    case "roll-mode":
      return p.mode === "advantage" ? "Avantage" : "Désavantage";
    case "condition":
      return `État : ${{ prone: "À terre", blinded: "Aveuglé", frightened: "Effrayé", poisoned: "Empoisonné", stunned: "Étourdi", restrained: "Entravé", invisible: "Invisible" }[p.condition] ?? p.condition}`;
    case "mode-switch":
      return "Changement de configuration";
    default:
      return templates[t]?.[0] ?? "Effet conservé";
  }
}
export async function renderForge(root, a) {
  const repo = forgeRepository(a.storage);
  let rows = await repo.list(),
    current = null,
    tab = "Identité",
    query = "",
    browse = false,
    filter = "",
    screen = "editor";
  const openSections = new Set();
  editorOpenListener();
  function editorOpenListener() {
    root.addEventListener(
      "toggle",
      (e) => {
        if (e.target.tagName === "DETAILS") {
          const key = e.target.querySelector(":scope > summary")?.textContent;
          if (e.target.open) openSections.add(key);
          else if (e.target.isConnected) openSections.delete(key);
        }
      },
      true,
    );
  }
  const status = el(
      "span",
      { class: "forge-save", role: "status" },
      "Sauvegarde locale",
    ),
    sidebar = el("aside", { class: "forge-library" }),
    editor = el("section", { class: "forge-editor" }),
    preview = el("aside", { class: "forge-preview" }),
    workspace = el(
      "div",
      { class: "forge-workspace" },
      sidebar,
      editor,
      preview,
    );
  const mobile = el(
    "div",
    { class: "forge-mobile-tabs" },
    ...["Bibliothèque", "Éditeur", "Aperçu"].map((label, i) =>
      button(label, () => {
        screen = ["library", "editor", "preview"][i];
        workspace.dataset.screen = screen;
      }),
    ),
  );
  root.classList.add("forge-page");
  root.append(
    el(
      "div",
      { class: "section-head" },
      el(
        "div",
        {},
        el("p", { class: "eyebrow" }, "ATELIER D’OBJETS MAGIQUES"),
        el("h1", {}, "La Forge"),
      ),
      status,
    ),
    mobile,
    workspace,
  );
  workspace.dataset.screen = screen;
  function info(title, text) {
    const b = button(
      "ⓘ",
      () => a.modal(el("section", {}, el("h2", {}, title), el("p", {}, text))),
      "forge-info",
    );
    b.setAttribute("aria-label", title);
    return b;
  }
  function drawPreview() {
    preview.replaceChildren();
    if (!current) {
      preview.append(
        el(
          "div",
          { class: "forge-empty" },
          el("span", { class: "forge-sigil" }, "✧"),
          el("h2", {}, "Donnez forme à la magie"),
          el("p", {}, "Une lame, un talisman, un artefact…"),
        ),
      );
      return;
    }
    const d = current.definition;
    preview.append(
      el("p", { class: "eyebrow" }, "APERÇU DE L’OBJET"),
      current.illustration
        ? el("img", {
            class: "forge-art",
            src: current.illustration,
            alt: d.name.fr,
          })
        : el("div", { class: "forge-sigil", "aria-hidden": "true" }, "✧"),
      el("h2", {}, d.name.fr),
      el(
        "p",
        { class: "muted" },
        `${categories[d.category]} · ${rarities[d.rarity]}`,
      ),
      badge(d.origin === "official" ? "Officiel" : "Personnalisé"),
      el(
        "p",
        {},
        d.attunement.required === true
          ? "Harmonisation requise"
          : d.attunement.required === false
            ? "Sans harmonisation"
            : "Harmonisation à confirmer",
      ),
    );
    if (d.baseItem.label) preview.append(el("p", {}, d.baseItem.label));
    if (d.baseItem.properties.length)
      preview.append(
        el("p", { class: "muted" }, d.baseItem.properties.join(" · ")),
      );
    for (const e of d.effects)
      preview.append(el("p", { class: "forge-stat" }, describe(e)));
    for (const m of d.modes)
      preview.append(
        el(
          "div",
          { class: "forge-preview-power" },
          el("strong", {}, m.name.fr),
          ...m.effects.map((e) => el("p", {}, describe(e))),
        ),
      );
    for (const r of d.resources)
      preview.append(
        el(
          "p",
          { class: "forge-resource" },
          `${r.maximum} ${r.unit === "uses" ? "utilisation(s)" : "charges"} · ${r.recovery.formula ?? "Quantité à préciser"} · ${recovery[r.recovery.event]}`,
        ),
      );
    for (const p of d.abilities)
      preview.append(
        el(
          "div",
          { class: "forge-preview-power" },
          el("strong", {}, p.name.fr),
          el(
            "small",
            {},
            `${activations[p.activation]}${p.costs.length ? " · " + p.costs.map((c) => c.amount + (d.resources.find(r=>r.id===c.resourceId)?.unit === "uses" ? " utilisation(s)" : " charge(s)")).join(", ") : ""}`,
          ),
          ...p.effects.map((e) => el("p", {}, describe(e))),
          p.save
            ? el(
                "p",
                {},
                `${abilities[p.save.ability]} · ${p.save.dc.kind === "fixed" ? "DD " + p.save.dc.value : "DD du porteur"}`,
              )
            : null,
          p.area
            ? el(
                "p",
                {},
                `${{ cone: "Cône", sphere: "Sphère", cube: "Cube", line: "Ligne", cylinder: "Cylindre", radius: "Rayon" }[p.area.shape]} ${p.area.size} ${p.area.unit}`,
              )
            : null,
        ),
      );
    if (d.description.fr)
      preview.append(el("p", { class: "forge-description" }, d.description.fr));
    if (d.unknowns.length)
      preview.append(
        detail(
          `${d.unknowns.length} point(s) à confirmer`,
          el(
            "ul",
            {},
            d.unknowns.map((s) => el("li", {}, s)),
          ),
        ),
      );
    if (d.rulesNotes.length)
      preview.append(
        detail(
          "Notes de règles",
          d.rulesNotes.map((s) => el("p", {}, s)),
        ),
      );
  }
  function save() {
    const record = current,
      snapshot = structuredClone(record.definition),
      illustration = record.illustration;
    status.textContent = "Enregistrement…";
    drawPreview();
    queue = queue
      .then(async () => {
        const saved = await repo.save(snapshot, {
          expectedRevision: record.revision,
          illustration,
        });
        record.revision = saved.revision;
        record.updatedAt = saved.updatedAt;
        saveError = null;
        status.textContent = "Enregistré sur cet appareil";
        rows = await repo.list();
        drawLibrary();
      })
      .catch((e) => {
        saveError = e;
        status.textContent = "Non enregistré : " + e.message;
      });
  }
  const change = (fn, redraw = false) => {
    fn();
    save();
    if (redraw) drawEditor();
  };
  const input = (
    label,
    value,
    set,
    { number = false, min = 0, ...attrs } = {},
  ) =>
    field(
      label,
      el("input", {
        type: number ? "number" : "text",
        value: value ?? "",
        ...(number ? { min } : {}),
        ...attrs,
        oninput: (e) => {
          if (number && (!e.target.value || !e.target.validity.valid)) return;
          change(() => set(number ? Number(e.target.value) : e.target.value));
        },
      }),
    );
  const choice = (label, options, value, set, redraw = false) =>
    field(
      label,
      select(entries(options), value ?? "", (e) =>
        change(() => set(e.target.value), redraw),
      ),
    );
  const text = (label, value, set) =>
    field(
      label,
      el(
        "textarea",
        { rows: 3, oninput: (e) => change(() => set(e.target.value)) },
        value ?? "",
      ),
    );
  const remove = (array, item) =>
    button(
      "Retirer",
      () => change(() => array.splice(array.indexOf(item), 1), true),
      "quiet",
    );
  async function open(record) {
    await flushForge();
    current = structuredClone(record);
    status.textContent = "Enregistré sur cet appareil";
    tab = "Identité";
    screen = "editor";
    workspace.dataset.screen = screen;
    drawEditor();
    drawPreview();
    drawLibrary();
  }
  async function create(template) {
    await flushForge();
    const definition = template ? copyItem(template) : newItem();
    const saved = await repo.save(definition);
    rows = await repo.list();
    browse = false;
    await open(saved);
  }
  function drawLibrary() {
    sidebar.replaceChildren(
      el("h2", {}, "Mes objets"),
      button("Créer un objet", () => create().catch(a.fail), "primary"),
      button("Partir du catalogue", async () => {
        try {
          await flushForge();
          browse = true;
          drawEditor();
          screen = "editor";
          workspace.dataset.screen = screen;
        } catch (e) {
          a.fail(e);
        }
      }),
    );
    const imp = el("input", {
      type: "file",
      accept: ".json,application/json",
      "aria-label": "Importer des objets JSON",
      onchange: async (e) => {
        try {
          await flushForge();
          const f = e.target.files[0];
          if (!f) return;
          if (f.size > 5_000_000) throw Error("Fichier trop volumineux");
          await repo.import(await f.text());
          rows = await repo.list();
          drawLibrary();
          status.textContent = "Import effectué";
        } catch (err) {
          status.textContent = err.message;
        }
      },
    });
    sidebar.append(
      detail(
        "Importer / exporter",
        field("Importer JSON", imp),
        button("Exporter mes objets", () =>
          download(exportItems(rows), "pilot20-objets.json"),
        ),
      ),
    );
    const search = el("input", {
        type: "search",
        placeholder: "Rechercher mes objets",
        value: query,
        "aria-label": "Rechercher mes objets",
        oninput: (e) => {
          query = e.target.value;
          drawList();
        },
      }),
      list = el("div", { class: "forge-item-list" });
    sidebar.append(search, list);
    function drawList() {
      list.replaceChildren(
        ...rows
          .filter((r) =>
            r.definition.name.fr
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()),
          )
          .map((r) =>
            button(
              [
                el("strong", {}, r.definition.name.fr),
                el(
                  "small",
                  {},
                  `${categories[r.definition.category]} · ${rarities[r.definition.rarity]}`,
                ),
              ],
              () => open(r).catch(a.fail),
              current?.definition.id === r.definition.id ? "selected" : "",
            ),
          ),
      );
      if (!rows.length)
        list.append(
          el("p", { class: "muted" }, "Vos créations apparaîtront ici."),
        );
    }
    drawList();
  }
  function advancedEffect(e) {
    return detail(
      "Déclencheur, cible et durée",
      choice(
        "Déclencheur",
        {
          ...triggers,
          ...(e.trigger && !triggers[e.trigger]
            ? { [e.trigger]: e.trigger }
            : {}),
        },
        e.trigger ?? "",
        (v) => (e.trigger = v || null),
      ),
      choice(
        "Mode requis",
        {
          "": "Tous",
          ...Object.fromEntries(
            current.definition.modes.map((m) => [m.id, m.name.fr]),
          ),
        },
        e.modeId ?? "",
        (v) => (e.modeId = v || null),
      ),
      text(
        "Condition particulière (validation manuelle)",
        e.conditions
          .filter((c) => c.op === "manual")
          .map((c) => c.text)
          .join("\n"),
        (v) => {
          e.conditions = [
            ...e.conditions.filter((c) => c.op !== "manual"),
            ...(v ? [{ op: "manual", text: v }] : []),
          ];
        },
      ),
      choice(
        "Cible",
        {
          "": "Non précisée",
          self: "Porteur",
          creature: "Créature",
          object: "Objet",
          point: "Point",
          manual: "Manuelle",
        },
        e.target?.kind ?? "",
        (v) => (e.target = v ? { kind: v, count: 1, filter: null } : null),
        true,
      ),
      e.target
        ? input(
            "Nombre de cibles",
            e.target.count,
            (v) => (e.target.count = v),
            { number: true, min: 1 },
          )
        : null,
      durationEditor(e),
      saveEditor(e),
    );
  }
  function durationEditor(obj) {
    return el(
      "div",
      {},
      choice(
        "Durée",
        { "": "Non précisée", ...units },
        obj.duration?.unit ?? "",
        (v) => (obj.duration = v ? { value: 1, unit: v, endsAt: null } : null),
        true,
      ),
      obj.duration
        ? grid(
            input(
              "Nombre",
              obj.duration.value,
              (v) => (obj.duration.value = v),
              { number: true, min: 0 },
            ),
            choice(
              "Expiration",
              {
                "": "À préciser",
                "start-of-source-turn": "Début du tour du porteur",
                "end-of-source-turn": "Fin du tour du porteur",
                "start-of-target-turn": "Début du tour de la cible",
                "end-of-target-turn": "Fin du tour de la cible",
                manual: "Manuelle",
              },
              obj.duration.endsAt ?? "",
              (v) => (obj.duration.endsAt = v || null),
            ),
          )
        : null,
    );
  }
  function saveEditor(obj) {
    return el(
      "div",
      {},
      choice(
        "Jet de sauvegarde",
        { "": "Aucun", ...abilities },
        obj.save?.ability ?? "",
        (v) =>
          (obj.save = v
            ? {
                ability: v,
                dc: { kind: "fixed", value: 15 },
                success: "half-damage",
              }
            : null),
        true,
      ),
      obj.save
        ? grid(
            choice(
              "Calcul du DD",
              {
                fixed: "Fixe",
                "wearer-spell-save": "DD des sorts du porteur",
                ...(obj.save.dc.kind === "formula"
                  ? { formula: "Formule conservée" }
                  : {}),
              },
              obj.save.dc.kind,
              (v) =>
                (obj.save.dc =
                  v === "fixed" ? { kind: v, value: 15 } : { kind: v }),
              true,
            ),
            obj.save.dc.kind === "fixed"
              ? input("DD", obj.save.dc.value, (v) => (obj.save.dc.value = v), {
                  number: true,
                  min: 1,
                })
              : null,
            choice(
              "Sur réussite",
              {
                "half-damage": "Moitié des dégâts",
                "no-effect": "Aucun effet",
                unknown: "À préciser",
                custom: "Spécial",
              },
              obj.save.success,
              (v) => (obj.save.success = v),
            ),
          )
        : null,
    );
  }
  function effectsEditor(list) {
    const box = el("div", { class: "forge-effects" });
    for (const e of list) {
      if (
        e.templateId === "p20:effect:custom" &&
        e.params.key === "forge:base-profile"
      )
        continue;
      const p = e.params,
        t = e.templateId.split(":").at(-1),
        fields = [];
      const num = (label, key, min = 0) =>
        input(label, p[key], (v) => (p[key] = v), { number: true, min });
      const txt = (label, key) =>
        input(
          label,
          p[key],
          (v) =>
            (p[key] =
              v || (key === "condition" && t === "defense" ? null : "")),
        );
      const sel = (label, key, options) =>
        choice(
          label,
          options,
          p[key] ?? "",
          (v) =>
            (p[key] =
              v || (key === "damageType" || key === "intensity" ? null : "")),
        );
      if (t === "modifier")
        fields.push(
          sel("Valeur modifiée", "stat", {
            attack: "Attaque",
            damage: "Dégâts",
            ac: "CA",
            "spell-attack": "Attaque de sort",
            "spell-save-dc": "DD des sorts",
            "saving-throws": "Sauvegardes",
            initiative: "Initiative",
          }),
          num("Valeur", "value", -99),
          sel("Opération", "operation", {
            add: "Ajouter",
            set: "Fixer",
            multiply: "Multiplier",
          }),
          sel("Périmètre", "scope", {
            "this-weapon": "Cette arme",
            wearer: "Porteur",
            ...(!["this-weapon", "wearer"].includes(p.scope)
              ? { [p.scope]: p.scope }
              : {}),
          }),
        );
      else if (t === "damage")
        fields.push(
          txt("Dés", "dice"),
          sel("Type de dégâts", "damageType", {
            "": "À préciser",
            ...damageTypes,
          }),
          sel("Rôle", "role", {
            "weapon-base": "Dégâts de base",
            additional: "Dégâts supplémentaires",
            standalone: "Dégâts du pouvoir",
          }),
        );
      else if (t === "defense")
        fields.push(
          sel("Défense", "kind", {
            resistance: "Résistance",
            immunity: "Immunité",
            vulnerability: "Vulnérabilité",
          }),
          sel("Type de dégâts", "damageType", damageTypes),
          txt("Restriction éventuelle", "condition"),
        );
      else if (t === "ability-score")
        fields.push(
          sel("Caractéristique", "ability", abilities),
          sel("Opération", "operation", {
            floor: "Valeur minimale",
            set: "Fixer la valeur",
            add: "Ajouter",
            maximum: "Plafond",
          }),
          num("Valeur", "value"),
        );
      else if (t === "healing") fields.push(txt("Dés de soins", "dice"));
      else if (t === "cast-spell")
        fields.push(
          sel("Sort", "spellId", {
            "": "Choisir un sort",
            ...Object.fromEntries(
              a.context.index
                .list("spell")
                .map((s) => [s.id, localizedName(s, "fr")]),
            ),
            ...(p.spellId && !a.context.index.get(p.spellId)
              ? { [p.spellId]: "Sort du modèle à identifier" }
              : {}),
          }),
          num("Niveau du sort", "level"),
          choice(
            "DD du sort",
            {
              "": "Non précisé",
              fixed: "Fixe",
              "wearer-spell-save": "DD des sorts du porteur",
              ...(p.dc?.kind === "formula"
                ? { formula: "Formule conservée" }
                : {}),
            },
            p.dc?.kind ?? "",
            (v) =>
              (p.dc =
                v === "fixed"
                  ? { kind: v, value: 15 }
                  : v
                    ? { kind: v }
                    : null),
            true,
          ),
          p.dc?.kind === "fixed"
            ? input("DD du sort fixe", p.dc.value, (v) => (p.dc.value = v), {
                number: true,
                min: 1,
              })
            : null,
        );
      else if (t === "roll-mode")
        fields.push(
          sel("Jet", "roll", {
            attack: "Attaque",
            save: "Sauvegarde",
            check: "Test",
            ...(p.roll && !["attack", "save", "check"].includes(p.roll)
              ? { [p.roll]: p.roll }
              : {}),
          }),
          sel("Mode de jet", "mode", {
            advantage: "Avantage",
            disadvantage: "Désavantage",
          }),
          txt("Contexte", "context"),
        );
      else if (t === "condition")
        fields.push(
          txt("État imposé", "condition"),
          sel("Opération", "operation", {
            apply: "Appliquer",
            remove: "Retirer",
            suppress: "Suspendre",
          }),
        );
      else if (t === "movement")
        fields.push(
          sel("Déplacement", "mode", {
            walk: "Marche",
            fly: "Vol",
            swim: "Nage",
            climb: "Escalade",
            burrow: "Fouissement",
          }),
          num("Distance", "value"),
          sel("Opération", "operation", {
            add: "Ajouter",
            set: "Fixer",
            multiply: "Multiplier",
          }),
          sel("Unité", "unit", { m: "Mètres", ft: "Pieds" }),
        );
      else if (t === "light")
        fields.push(
          num("Rayon", "radius"),
          sel("Unité", "unit", { m: "Mètres", ft: "Pieds" }),
          sel("Intensité", "intensity", {
            "": "À préciser",
            bright: "Vive",
            dim: "Faible",
          }),
        );
      else if (t === "mode-switch")
        fields.push(
          sel(
            "Configuration",
            "modeId",
            Object.fromEntries(
              current.definition.modes.map((m) => [m.id, m.name.fr]),
            ),
          ),
          txt("Groupe exclusif", "exclusiveGroup"),
        );
      else if (t === "grant-action")
        fields.push(
          sel(
            "Pouvoir associé",
            "abilityId",
            Object.fromEntries(
              current.definition.abilities.map((b) => [b.id, b.name.fr]),
            ),
          ),
        );
      else if (t === "custom") {
        if (p.key.startsWith("forge:") && p.key !== "forge:custom") {
          fields.push(
            input(
              "Valeur ou dés",
              p.payload.value ?? "",
              (v) => (p.payload.value = v),
            ),
            input(
              "Portée / rayon (m)",
              p.payload.distance ?? 0,
              (v) => (p.payload.distance = v),
              { number: true },
            ),
            input(
              "Nombre de cibles / créatures",
              p.payload.count ?? 1,
              (v) => (p.payload.count = v),
              { number: true, min: 1 },
            ),
          );
        }
        fields.push(
          text(
            "Effet à résoudre manuellement",
            p.summary,
            (v) => (p.summary = v),
          ),
          info(
            "Effet manuel",
            "Cette description est conservée et affichée. Elle ne produit aucun bonus ni action mécanique automatiquement.",
          ),
        );
      } else
        fields.push(
          el("p", {}, describe(e)),
          info(
            "Effet du catalogue",
            "Cet effet est conservé à l’identique. Ses paramètres spécialisés ne sont pas encore éditables ici.",
          ),
        );
      box.append(
        detail(
          describe(e),
          grid(...fields),
          advancedEffect(e),
          remove(list, e),
        ),
      );
    }
    let chosen = "modifier";
    const options = {
      ...Object.fromEntries(entries(templates).map(([k, v]) => [k, v[0]])),
      ...customPresets,
    };
    box.append(
      el(
        "div",
        { class: "forge-add" },
        select(entries(options), chosen, (e) => (chosen = e.target.value), {
          "aria-label": "Type d’effet",
        }),
        button("Ajouter un effet", () =>
          change(() => {
            const custom = customPresets[chosen];
            list.push(
              custom
                ? effect("custom", {
                    key: "forge:" + chosen,
                    summary: custom,
                    payload: {},
                    fallback: "manual",
                  })
                : effect(chosen, structuredClone(templates[chosen][1])),
            );
          }, true),
        ),
      ),
    );
    return box;
  }
  async function drawEditor() {
    editor.replaceChildren();
    queueMicrotask(() => {
      for (const x of editor.querySelectorAll("details"))
        if (openSections.has(x.querySelector(":scope > summary")?.textContent))
          x.open = true;
    });
    if (browse) {
      editor.append(
        el("h2", {}, "Choisir un modèle"),
        el("p", { class: "muted" }, "Une copie personnelle sera créée."),
      );
      const results = el("div", { class: "forge-catalog" }),
        search = el("input", {
          type: "search",
          placeholder: "Nom de l’objet",
          "aria-label": "Rechercher dans le catalogue",
          value: filter,
          oninput: (e) => {
            filter = e.target.value;
            show();
          },
        });
      editor.append(search, results);
      let data;
      try {
        data = await catalog();
      } catch (e) {
        results.textContent = e.message;
        return;
      }
      function show() {
        const q = filter.toLocaleLowerCase();
        const found = (data ?? []).filter((d) =>
          [d.name.fr, ...d.aliases].join(" ").toLocaleLowerCase().includes(q),
        );
        results.replaceChildren(
          el(
            "small",
            {},
            `${found.length} modèles · ${Math.min(50, found.length)} affichés`,
          ),
          ...found
            .slice(0, 50)
            .map((d) =>
              button(
                [
                  el("strong", {}, d.name.fr),
                  el(
                    "small",
                    {},
                    `${rarities[d.rarity]} · ${d.origin === "official" ? "Officiel" : "Compagnie Créole"}${d.mechanicsStatus === "reference-only" ? " · référence à compléter" : ""}`,
                  ),
                ],
                () => create(d).catch(a.fail),
              ),
            ),
        );
      }
      show();
      return;
    }
    if (!current) {
      editor.append(
        el(
          "div",
          { class: "forge-welcome" },
          el("p", { class: "eyebrow" }, "VOTRE PROCHAINE RELIQUE"),
          el("h2", {}, "Tout commence par une idée."),
          el(
            "p",
            {},
            "Créez un objet ou personnalisez un modèle du catalogue.",
          ),
          button("Créer un objet", () => create().catch(a.fail), "primary"),
          button("Explorer le catalogue", () => {
            browse = true;
            drawEditor();
          }),
        ),
      );
      return;
    }
    const d = current.definition;
    editor.append(
      el(
        "div",
        { class: "forge-toolbar" },
        button("Dupliquer", async () => {
          try {
            await flushForge();
            const saved = await repo.save(copyItem(d), {
              illustration: current.illustration,
            });
            rows = await repo.list();
            await open(saved);
          } catch (e) {
            a.fail(e);
          }
        }),
        button("Exporter JSON", () =>
          download(exportItems([current]), "pilot20-objet.json"),
        ),
        button("Enregistrer", () => save()),
      ),
      el(
        "nav",
        { class: "forge-steps", "aria-label": "Étapes de la Forge" },
        ["Identité", "Propriétés", "Pouvoirs", "Aperçu"].map((s) =>
          button(
            s,
            () => {
              tab = s;
              drawEditor();
            },
            tab === s ? "active" : "",
          ),
        ),
      ),
    );
    if (tab === "Aperçu") {
      editor.append(
        el("h2", {}, "Prêt pour votre bibliothèque"),
        el(
          "p",
          {},
          "Les modifications sont enregistrées en continu sur cet appareil.",
        ),
        button("Voir la fiche", () => {
          screen = "preview";
          workspace.dataset.screen = screen;
          preview.scrollIntoView({ behavior: "smooth", block: "start" });
        }),
        info(
          "Compatibilité Compagnon",
          "L’objet exporte les définitions et pouvoirs du catalogue. Les effets ne sont pas appliqués aux personnages dans cette version.",
        ),
      );
      return;
    }
    if (tab === "Identité") {
      editor.append(
        grid(
          input("Nom", d.name.fr, (v) => (d.name.fr = v)),
          choice(
            "Type d’objet",
            categories,
            d.category,
            (v) => (d.category = v),
            true,
          ),
          input("Sous-type", d.subcategory, (v) => (d.subcategory = v || null)),
          choice("Rareté", rarities, d.rarity, (v) => (d.rarity = v)),
        ),
        choice(
          "Harmonisation",
          { true: "Requise", false: "Non requise", unknown: "À confirmer" },
          String(d.attunement.required ?? "unknown"),
          (v) =>
            (d.attunement.required = v === "unknown" ? null : v === "true"),
        ),
        text(
          "Description courte",
          d.description.fr,
          (v) => (d.description.fr = v || null),
        ),
        detail(
          "Illustration",
          field(
            "Importer une illustration",
            el("input", {
              type: "file",
              accept: "image/png,image/jpeg,image/webp",
              onchange: async (e) => {
                try {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 1_400_000)
                    throw Error("Illustration : 1,4 Mo maximum.");
                  const reader = new FileReader();
                  const record = current;
                  reader.onload = () => {
                    if(current === record)change(() => (current.illustration = reader.result), true);
                  };
                  reader.readAsDataURL(file);
                } catch (e) {
                  status.textContent = e.message;
                }
              },
            }),
          ),
          current.illustration
            ? button("Retirer l’illustration", () =>
                change(() => (current.illustration = null), true),
              )
            : null,
        ),
        detail(
          "Conditions d’harmonisation",
          text(
            "Restriction particulière",
            d.attunement.prerequisites?.op === "manual"
              ? d.attunement.prerequisites.text
              : "",
            (v) =>
              (d.attunement.prerequisites = v
                ? { op: "manual", text: v }
                : null),
          ),
          d.attunement.prerequisites &&
            d.attunement.prerequisites.op !== "manual"
            ? el(
                "p",
                {},
                "Prérequis structurés du catalogue conservés ; saisir un texte remplace cette règle par une validation manuelle.",
              )
            : null,
        ),
      );
    }
    if (tab === "Propriétés") {
      editor.append(
        grid(
          input(
            "Objet de base",
            d.baseItem.label,
            (v) => (d.baseItem.label = v || null),
          ),
          input(
            "Propriétés de maniement / physiques",
            d.baseItem.properties.join(", "),
            (v) =>
              (d.baseItem.properties = v
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)),
          ),
        ),
        grid(
          choice(
            "Mains nécessaires",
            {
              unknown: "À confirmer",
              0: "Aucune",
              1: "Une main",
              2: "Deux mains",
            },
            d.equipment.hands ?? "unknown",
            (v) => (d.equipment.hands = v === "unknown" ? null : Number(v)),
          ),
          input(
            "Emplacements (séparés par une virgule)",
            d.equipment.slots.join(", "),
            (v) =>
              (d.equipment.slots = v
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)),
          ),
        ),
        choice(
          "Condition d’équipement",
          {
            true: "Doit être équipé",
            false: "Peut agir sans être équipé",
            unknown: "À confirmer",
          },
          String(d.equipment.requiresEquipped ?? "unknown"),
          (v) =>
            (d.equipment.requiresEquipped =
              v === "unknown" ? null : v === "true"),
        ),
      );
      if (["weapon", "ammunition", "staff"].includes(d.category))
        editor.append(
          button("Ajouter le profil de dégâts", () =>
            change(() => {
              if (
                !d.effects.some(
                  (e) =>
                    e.templateId === "p20:effect:damage" &&
                    e.params.role === "weapon-base",
                )
              ) {
                const e = effect("damage", {
                  dice: "1d8",
                  damageType: "slashing",
                  role: "weapon-base",
                });
                e.trigger = "on-hit";
                d.effects.push(e);
              }
            }, true),
          ),
          info(
            "Profil de l’arme",
            "Les dés de base sont distincts des dégâts supplémentaires. La portée et la polyvalence peuvent être définies dans les propriétés ou par des configurations séparées.",
          ),
        );
      if (d.category === "shield")
        editor.append(
          el(
            "p",
            { class: "forge-hint" },
            "Bouclier standard : +2 de base. Ajoutez uniquement le bonus magique en effet de CA. Le total +5 d’un bouclier +3 ne doit pas être ajouté une deuxième fois.",
          ),
        );
      if (d.category === "armor")
        editor.append(
          info(
            "Profil d’armure",
            "La CA de base se définit comme une valeur fixée ; le bonus magique comme une addition distincte. Les restrictions restent des conditions explicites.",
          ),
        );
      const profile = baseProfile(d);
      if (
        ["weapon", "ammunition", "staff", "armor", "shield"].includes(
          d.category,
        )
      ) {
        if (!profile)
          editor.append(
            button("Préciser le profil physique", () =>
              change(() => addBaseProfile(d), true),
            ),
          );
        else {
          const p = profile.params.payload,
            controls = [];
          if (["weapon", "ammunition", "staff"].includes(d.category))
            controls.push(
              input("Portée normale (m)", p.range, (v) => (p.range = v), {
                number: true,
              }),
              input(
                "Portée longue (m)",
                p.longRange,
                (v) => (p.longRange = v),
                { number: true },
              ),
              input(
                "Dés à deux mains (polyvalence)",
                p.versatileDice,
                (v) => (p.versatileDice = v || null),
              ),
            );
          if (d.category === "armor")
            controls.push(
              input(
                "CA de base (sans magie)",
                p.baseAC,
                (v) => (p.baseAC = v),
                { number: true },
              ),
              input(
                "Plafond du bonus de Dextérité",
                p.dexCap,
                (v) => (p.dexCap = v),
                { number: true },
              ),
              input(
                "Force minimale",
                p.minimumStrength,
                (v) => (p.minimumStrength = v),
                { number: true },
              ),
              check("Désavantage en Discrétion", p.stealthDisadvantage, (e) =>
                change(() => (p.stealthDisadvantage = e.target.checked)),
              ),
            );
          if (d.category === "shield")
            controls.push(
              input(
                "Bonus normal du bouclier (sans magie)",
                p.shieldBase,
                (v) => (p.shieldBase = v),
                { number: true },
              ),
            );
          editor.append(detail("Profil physique", grid(...controls)));
        }
      }
      editor.append(
        el("h2", {}, "Propriétés permanentes"),
        effectsEditor(d.effects),
      );
      const modes = detail(
        "Configurations et formes",
        el(
          "p",
          { class: "muted" },
          "Deux modes du même groupe sont exclusifs. Un groupe vide signifie que leur compatibilité reste à confirmer.",
        ),
      );
      for (const m of d.modes)
        modes.append(
          detail(
            m.name.fr,
            input("Nom de la configuration", m.name.fr, (v) => (m.name.fr = v)),
            input(
              "Groupe exclusif",
              m.exclusiveGroup,
              (v) => (m.exclusiveGroup = v || null),
            ),
            input(
              "Propriétés de cette forme",
              m.properties.join(", "),
              (v) =>
                (m.properties = v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)),
            ),
            effectsEditor(m.effects),
            remove(d.modes, m),
          ),
        );
      modes.append(
        button("Ajouter une configuration", () =>
          change(
            () =>
              d.modes.push({
                id: uid(),
                name: { fr: "Nouvelle forme", en: null },
                exclusiveGroup: "forme",
                baseItemId: null,
                properties: [],
                effects: [],
              }),
            true,
          ),
        ),
      );
      editor.append(modes);
    }
    if (tab === "Pouvoirs") {
      const resources = detail(
        `Charges et récupération (${d.resources.length})`,
      );
      for (const r of d.resources)
        resources.append(
          el(
            "div",
            { class: "forge-resource-editor" },
            grid(
              input("Réserve maximale", r.maximum, (v) => (r.maximum = v), {
                number: true,
                min: 1,
              }),
              choice(
                "Unité",
                {
                  charges: "Charges",
                  uses: "Utilisations",
                  minutes: "Minutes",
                  ammunition: "Munitions",
                },
                r.unit,
                (v) => (r.unit = v),
              ),
              choice(
                "Récupération",
                recovery,
                r.recovery.event,
                (v) => (r.recovery.event = v),
              ),
              input(
                "Quantité récupérée",
                r.recovery.formula,
                (v) => (r.recovery.formula = v || null),
              ),
            ),
            d.abilities.some((b) => b.costs.some((c) => c.resourceId === r.id))
              ? el("small", {}, "Réserve utilisée par un pouvoir.")
              : remove(d.resources, r),
          ),
        );
      resources.append(
        button("Ajouter une réserve", () =>
          change(() => d.resources.push(newResource()), true),
        ),
      );
      editor.append(resources);
      for (const b of d.abilities) {
        const power = detail(
          b.name.fr,
          input("Nom du pouvoir", b.name.fr, (v) => (b.name.fr = v)),
          choice(
            "Activation",
            activations,
            b.activation,
            (v) => (b.activation = v),
          ),
          effectsEditor(b.effects),
        );
        const advanced = detail("Coût, portée et limites");
        for (const c of b.costs)
          advanced.append(
            grid(
              choice(
                "Réserve",
                Object.fromEntries(
                  d.resources.map((r, i) => [
                    r.id,
                    `Réserve ${i + 1} · ${r.maximum} ${r.unit === "uses" ? "utilisations" : "charges"}`,
                  ]),
                ),
                c.resourceId,
                (v) => (c.resourceId = v),
              ),
              input("Coût", c.amount, (v) => (c.amount = v), {
                number: true,
                min: 1,
              }),
              choice(
                "Consommation",
                {
                  "on-use": "À l’utilisation",
                  "on-hit": "Sur coup réussi",
                  "on-confirmation": "Après confirmation",
                },
                c.timing,
                (v) => (c.timing = v),
              ),
              remove(b.costs, c),
            ),
          );
        if (d.resources.length)
          advanced.append(
            button("Ajouter un coût", () =>
              change(
                () =>
                  b.costs.push({
                    resourceId: d.resources[0].id,
                    amount: 1,
                    timing: "on-use",
                  }),
                true,
              ),
            ),
          );
        advanced.append(
          choice(
            "Portée",
            {
              "": "Non précisée",
              self: "Personnelle",
              touch: "Contact",
              distance: "Distance",
              sight: "À vue",
              special: "Spéciale",
            },
            b.range?.kind ?? "",
            (v) =>
              (b.range = v
                ? { kind: v, normal: 9, long: null, unit: "m" }
                : null),
            true,
          ),
          b.range?.kind === "distance"
            ? grid(
                input(
                  "Portée normale",
                  b.range.normal,
                  (v) => (b.range.normal = v),
                  { number: true },
                ),
                input(
                  "Portée longue",
                  b.range.long,
                  (v) => (b.range.long = v),
                  { number: true },
                ),
              )
            : null,
          choice(
            "Zone",
            {
              "": "Aucune",
              cone: "Cône",
              sphere: "Sphère",
              cube: "Cube",
              line: "Ligne",
              cylinder: "Cylindre",
              radius: "Rayon",
            },
            b.area?.shape ?? "",
            (v) => (b.area = v ? { shape: v, size: 9, unit: "m" } : null),
            true,
          ),
          b.area
            ? input(
                "Taille de la zone (m)",
                b.area.size,
                (v) => (b.area.size = v),
                { number: true },
              )
            : null,
          durationEditor(b),
          saveEditor(b),
          text(
            "Condition d’utilisation (manuelle)",
            b.prerequisites?.op === "manual" ? b.prerequisites.text : "",
            (v) => (b.prerequisites = v ? { op: "manual", text: v } : null),
          ),
        );
        power.append(advanced, remove(d.abilities, b));
        editor.append(power);
      }
      editor.append(
        button(
          "Ajouter un pouvoir",
          () => change(() => d.abilities.push(newAbility()), true),
          "primary",
        ),
      );
    }
  }
  drawLibrary();
  drawEditor();
  drawPreview();
}
