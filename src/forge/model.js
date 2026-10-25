import validate from "./validate-item.js";
export const uid = () => crypto.randomUUID();
export const categories = {
  weapon: "Arme",
  ammunition: "Munition",
  armor: "Armure",
  shield: "Bouclier",
  ring: "Anneau",
  amulet: "Amulette",
  jewelry: "Bijou",
  headwear: "Couvre-chef",
  gloves: "Gants",
  boots: "Bottes",
  cloak: "Cape",
  belt: "Ceinture",
  staff: "Bâton",
  wand: "Baguette",
  rod: "Sceptre",
  spellbook: "Grimoire",
  focus: "Focaliseur",
  potion: "Potion",
  scroll: "Parchemin",
  consumable: "Consommable",
  instrument: "Instrument",
  wondrous: "Objet merveilleux / autre",
};
export const rarities = {
  common: "Commun",
  uncommon: "Peu commun",
  rare: "Rare",
  "very-rare": "Très rare",
  legendary: "Légendaire",
  artifact: "Artefact",
  varies: "Variable",
  unknown: "Non précisée",
};
export const damageTypes = {
  acid: "Acide",
  bludgeoning: "Contondant",
  cold: "Froid",
  fire: "Feu",
  force: "Force",
  lightning: "Foudre",
  necrotic: "Nécrotique",
  piercing: "Perforant",
  poison: "Poison",
  psychic: "Psychique",
  radiant: "Radiant",
  slashing: "Tranchant",
  thunder: "Tonnerre",
};
export function effect(type, params) {
  return {
    id: uid(),
    templateId: `p20:effect:${type}`,
    params,
    conditions: [],
    modeId: null,
    duration: null,
    trigger: null,
    save: null,
    target: null,
  };
}
export function newItem(category = "weapon") {
  const id = `p20:mi:2014:forge:${uid()}`;
  return {
    id,
    version: "1.0.0",
    familyId: id,
    recordKind: "variant",
    name: { fr: "Nouvel objet", en: null },
    aliases: [],
    category,
    subcategory: null,
    ruleset: "dnd5e-2014",
    origin: "custom",
    provenance: [],
    legal: { status: "original", attributionId: null },
    rarity: "unknown",
    baseItem: { id: null, label: null, properties: [], material: null },
    price: null,
    weight: null,
    attunement: { required: false, prerequisites: null },
    equipment: {
      slots: [],
      hands: ["weapon", "shield", "staff", "wand"].includes(category) ? 1 : 0,
      requiresEquipped: true,
    },
    traits: { cursed: false, sentient: false, evolving: false },
    effects: [],
    abilities: [],
    resources: [],
    modes: [],
    description: { fr: null, en: null },
    rulesNotes: [],
    unknowns: [],
    mechanicsStatus: "structured",
    relatedIds: [],
  };
}
export function copyItem(item) {
  const copy = structuredClone(item);
  copy.id = `p20:mi:2014:forge:${uid()}`;
  copy.familyId = copy.id;
  copy.recordKind = "variant";
  copy.name.fr += " (copie)";
  copy.origin = "custom";
  copy.relatedIds = [...new Set([...copy.relatedIds, item.id])];
  return copy;
}
export function newAbility() {
  return {
    id: uid(),
    name: { fr: "Nouveau pouvoir", en: null },
    activation: "action",
    costs: [],
    effects: [],
    range: null,
    area: null,
    duration: null,
    save: null,
    prerequisites: null,
  };
}
export function newResource() {
  return {
    id: uid(),
    maximum: 5,
    unit: "charges",
    recovery: { formula: "1d4+1", event: "dawn", capAtMaximum: true },
    lastCharge: null,
  };
}
export function assertItem(item) {
  if (!validate(item))
    throw Error(
      "Objet non conforme au catalogue : " +
        validate.errors
          .slice(0, 3)
          .map((e) => `${e.instancePath} ${e.message}`)
          .join("; "),
    );
  if (item.ruleset !== "dnd5e-2014")
    throw Error("La Forge utilise les règles 2014.");
  const unique = (rows, label) => {
    if (new Set(rows.map((x) => x.id)).size !== rows.length)
      throw Error("Identifiants dupliqués : " + label);
  };
  unique(item.resources, "ressources");
  unique(item.abilities, "pouvoirs");
  unique(item.modes, "modes");
  const effects = [
    ...item.effects,
    ...item.abilities.flatMap((a) => a.effects),
    ...item.modes.flatMap((m) => m.effects),
  ];
  unique(effects, "effets");
  const profiles = item.effects.filter(
    (e) =>
      e.templateId === "p20:effect:custom" &&
      e.params.key === "forge:base-profile",
  );
  if (profiles.length > 1) throw Error("Un seul profil physique est autorisé.");
  for (const e of profiles) {
    const p = e.params.payload;
    for (const key of [
      "range",
      "longRange",
      "baseAC",
      "shieldBase",
      "dexCap",
      "minimumStrength",
    ])
      if (
        p[key] !== null &&
        p[key] !== undefined &&
        (!Number.isFinite(p[key]) || p[key] < 0)
      )
        throw Error("Profil physique incorrect : " + key);
    if (p.versatileDice && !/^\d+d\d+(?:[+-]\d+)?$/i.test(p.versatileDice))
      throw Error("Dés de polyvalence incorrects.");
  }

  for (const a of item.abilities) {
    for (const c of a.costs)
      if (!item.resources.some((r) => r.id === c.resourceId))
        throw Error("Ressource du pouvoir introuvable.");
  }
  for (const e of effects) {
    if (e.modeId && !item.modes.some((m) => m.id === e.modeId))
      throw Error("Mode de l’effet introuvable.");
  }
  return item;
}
export function parseImport(text) {
  if (text.length > 5_000_000)
    throw Error("Fichier trop volumineux (5 Mo maximum).");
  const data = JSON.parse(text);
  let rows;
  if (
    data.format === "pilot20-forge" &&
    data.version === 1 &&
    Array.isArray(data.items)
  )
    rows = data.items;
  else if (Array.isArray(data))
    rows = data.map((definition) => ({ definition }));
  else if (data.id) rows = [{ definition: data }];
  else throw Error("Format JSON non reconnu.");
  if (!rows.length || rows.length > 1000)
    throw Error("Import limité à 1–1000 objets.");
  return rows.map((row) => ({
    definition: assertItem(row.definition),
    illustration: safeImage(row.illustration) ? row.illustration : null,
  }));
}
export function safeImage(value) {
  return (
    typeof value === "string" &&
    value.length < 2_000_000 &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}
export function exportItems(rows) {
  return JSON.stringify(
    {
      format: "pilot20-forge",
      version: 1,
      items: rows.map((r) => ({
        definition: r.definition,
        illustration: r.illustration ?? null,
      })),
    },
    null,
    2,
  );
}
export function instanceOf(item, ownerId = null) {
  return {
    instanceId: uid(),
    definitionId: item.id,
    definitionVersion: item.version,
    ownerId,
    quantity: 1,
    equipped: false,
    attuned: false,
    active: true,
    consumed: false,
    modeIds: [],
    resources: Object.fromEntries(item.resources.map((r) => [r.id, r.maximum])),
    revision: 1,
  };
}
/** Optional physical profile uses the catalogue's existing named custom extension. */
export function baseProfile(item) {
  return item.effects.find(
    (e) =>
      e.templateId === "p20:effect:custom" &&
      e.params.key === "forge:base-profile",
  );
}
export function addBaseProfile(item) {
  let e = baseProfile(item);
  if (e) return e;
  e = effect("custom", {
    key: "forge:base-profile",
    summary: "Profil physique",
    payload: {
      kind: item.category,
      range: null,
      longRange: null,
      versatileDice: null,
      baseAC: null,
      shieldBase: item.category === "shield" ? 2 : null,
      dexCap: null,
      minimumStrength: null,
      stealthDisadvantage: false,
    },
    fallback: "manual",
  });
  item.effects.push(e);
  return e;
}
