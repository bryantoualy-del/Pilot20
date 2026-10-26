import { conditionMet } from "./conditions.js";
export { conditionMet } from "./conditions.js";
import { compileCapability } from "./automation.js";
import { diceSpec } from "../model.js";
/** Read-only adapter: describes contributions; never mutates a character or resolves combat. */
export function itemSource(definition, instance, context = {}) {
  const result = {
    sourceId: instance.instanceId,
    definitionId: definition.id,
    contributions: [],
    actions: [],
    pending: [],
  };
  const pending = (id, reason) => result.pending.push({ id, reason });
  if (
    instance.definitionId !== definition.id ||
    instance.definitionVersion !== definition.version
  ) {
    pending(definition.id, "Version à migrer explicitement");
    return result;
  }
  if (
    !instance.ownerId ||
    instance.quantity < 1 ||
    instance.consumed ||
    instance.active === false
  )
    return result;
  if (!instance.equipped && definition.equipment.requiresEquipped !== false)
    return result;
  if (definition.attunement.required === true && !instance.attuned)
    return result;
  if (definition.attunement.required === null && !instance.attuned) {
    pending(definition.id, "Harmonisation à confirmer");
    return result;
  }
  if (
    conditionMet(definition.attunement.prerequisites, instance, context) !==
    true
  ) {
    pending(definition.id, "Prérequis non satisfaits ou à confirmer");
    return result;
  }
  const modes = definition.modes.filter((m) => instance.modeIds.includes(m.id));
  if (
    instance.modeIds.some((id) => !definition.modes.some((m) => m.id === id))
  ) {
    pending(definition.id, "Mode inconnu");
    return result;
  }
  if (
    modes.some((m) => m.exclusiveGroup === null) ||
    new Set(modes.map((m) => m.exclusiveGroup)).size !== modes.length
  ) {
    pending(definition.id, "Compatibilité des modes à confirmer");
    return result;
  }
  function collect(e) {
    if (e.modeId && !instance.modeIds.includes(e.modeId)) return;
    const cond = e.conditions.map((c) => conditionMet(c, instance, context));
    if (cond.includes(false)) return;
    if (cond.includes(null)) {
      pending(e.id, "Condition manuelle");
      return;
    }
    if (e.trigger && e.trigger !== context.event) {
      pending(e.id, "En attente du déclencheur");
      return;
    }
    if (e.save || e.duration || (e.target && e.target.kind !== "self")) {
      pending(e.id, "Résolution de cible, durée ou sauvegarde par le combat");
      return;
    }
    if (
      e.templateId === "p20:effect:custom" ||
      e.templateId === "p20:effect:narrative"
    ) {
      pending(e.id, "Résolution manuelle");
      return;
    }
    if (e.templateId === "p20:effect:damage" && !e.params.damageType) {
      pending(e.id, "Type de dégâts inconnu");
      return;
    }
    if (e.templateId === "p20:effect:defense" && e.params.condition) {
      pending(e.id, "Défense conditionnelle à confirmer");
      return;
    }
    result.contributions.push({
      key: `${instance.instanceId}/${e.id}`,
      itemName: definition.name.fr,
      stackingId: definition.relatedIds[0] ?? definition.familyId,
      sourceId: instance.instanceId,
      effect: structuredClone(e),
    });
  }
  definition.effects.forEach(collect);
  modes.forEach((m) => m.effects.forEach(collect));
  for (const ability of definition.abilities) {
    const allowed = conditionMet(ability.prerequisites, instance, context);
    const automation = compileCapability(definition, ability, {instance, context});
    result.actions.push({
      automation,
      sourceId: instance.instanceId,
      ability: structuredClone(ability),
      available:
        automation.status === 'automatic' &&
        allowed === true &&
        ability.activation !== "unknown" &&
        ability.costs.every(
          (c) =>
            Number.isInteger(instance.resources[c.resourceId]) &&
            instance.resources[c.resourceId] >= c.amount,
        ),
      manual:
        automation.status !== "automatic",
    });
  }
  return result;
}
/** Only additive, explicitly scoped bonuses are summed. Set/multiply conflicts stay pending. */
export function resolvePassive(sources, { scores = {} } = {}) {
  const result = {
      bonuses: {},
      scores: { ...scores },
      resistances: [],
      immunities: [],
      pending: sources.flatMap((s) => s.pending),
    },
    seen = new Set(),
    names = new Set(),
    floors = {};
  for (const s of sources)
    for (const c of s.contributions) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      const e = c.effect,
        p = e.params,
        nameKey = `${c.stackingId ?? c.itemName}|${p.scope === "this-weapon" ? c.sourceId : ""}|${e.templateId}|${JSON.stringify(p)}`;
      if (names.has(nameKey)) continue;
      names.add(nameKey);
      if (e.templateId === "p20:effect:modifier") {
        if (p.operation !== "add") {
          result.pending.push({
            id: e.id,
            reason: "Modification non additive à arbitrer",
          });
          continue;
        }
        const key = `${p.stat}:${p.scope}${p.scope === "this-weapon" ? ":" + c.sourceId : ""}`;
        result.bonuses[key] = (result.bonuses[key] ?? 0) + p.value;
      } else if (e.templateId === "p20:effect:ability-score") {
        if (p.operation === "floor")
          floors[p.ability] = Math.max(floors[p.ability] ?? 0, p.value);
        else
          result.pending.push({
            id: e.id,
            reason:
              "Valeur fixée ou plafond à arbitrer avec les autres sources",
          });
      } else if (
        e.templateId === "p20:effect:defense" &&
        ["resistance", "immunity"].includes(p.kind)
      ) {
        const key = p.kind === "resistance" ? "resistances" : "immunities";
        if (!result[key].includes(p.damageType)) result[key].push(p.damageType);
      } else
        result.pending.push({
          id: e.id,
          reason:
            "Contribution transmise ; interprétation par le module destinataire",
        });
    }
  for (const [ability, value] of Object.entries(floors))
    if (Number.isFinite(scores[ability]))
      result.scores[ability] = Math.max(scores[ability], value);
    else
      result.pending.push({
        id: ability,
        reason: "Caractéristique de base manquante",
      });
  return result;
}
export function validateLoadout(
  entries,
  { attunementLimit = 3, ...context } = {},
) {
  const issues = [];
  const owned = entries.filter(
    (x) =>
      x.instance.ownerId && !x.instance.consumed && x.instance.quantity > 0,
  );
  if (owned.filter((x) => x.instance.attuned).length > attunementLimit)
    issues.push("Limite d’harmonisation dépassée");
  let hands = 0;
  const slots = new Set();
  for (const category of ["shield", "armor"])
    if (
      owned.filter(
        (x) => x.instance.equipped && x.definition.category === category,
      ).length > 1
    )
      issues.push(
        category === "shield"
          ? "Un seul bouclier peut contribuer à la CA"
          : "Une seule armure peut être portée",
      );
  for (const { definition: d, instance: i } of owned) {
    if (
      i.attuned &&
      conditionMet(d.attunement.prerequisites, i, context) !== true
    )
      issues.push(`${d.name.fr} : prérequis à vérifier`);
    if (!i.equipped) continue;
    if (d.equipment.hands === null)
      issues.push(`${d.name.fr} : nombre de mains à confirmer`);
    else hands += d.equipment.hands;
    for (const slot of d.equipment.slots) {
      if (slots.has(slot)) issues.push(`Emplacement déjà occupé : ${slot}`);
      slots.add(slot);
    }
  }
  if (hands > 2) issues.push("Plus de deux mains nécessaires");
  return issues;
}
/** Pure transactions; caller persists with expected revision and its own event receipt. */
export function spendResource(
  item,
  instance,
  abilityId,
  { timing = "on-use", context = {} } = {},
) {
  const ability = item.abilities.find((a) => a.id === abilityId);
  if (!ability) throw Error("Pouvoir inconnu");
  if (
    instance.definitionId !== item.id ||
    instance.definitionVersion !== item.version
  )
    throw Error("Version incorrecte");
  if (
    instance.consumed ||
    !instance.ownerId ||
    instance.active === false ||
    (!instance.equipped && item.equipment.requiresEquipped !== false) ||
    (item.attunement.required !== false && !instance.attuned)
  )
    throw Error("Objet inactif");
  if (
    ability.activation === "unknown" ||
    conditionMet(ability.prerequisites, instance, context) !== true
  )
    throw Error("Activation à confirmer");
  const totals = {};
  for (const c of ability.costs.filter((c) => c.timing === timing))
    totals[c.resourceId] = (totals[c.resourceId] ?? 0) + c.amount;
  const next = structuredClone(instance);
  for (const [id, amount] of Object.entries(totals)) {
    if (!Number.isInteger(next.resources[id]) || next.resources[id] < amount)
      throw Error("Charges insuffisantes");
    next.resources[id] -= amount;
  }
  next.revision++;
  return next;
}
export function recoverResource(item, instance, resourceId, event, rolled) {
  const r = item.resources.find((x) => x.id === resourceId);
  if (
    !r ||
    ["unknown", "daily-unspecified", "never"].includes(r.recovery.event) ||
    event !== r.recovery.event
  )
    throw Error("Récupération à confirmer");
  if (
    instance.definitionId !== item.id ||
    instance.definitionVersion !== item.version ||
    !Number.isInteger(rolled) ||
    rolled < 0 ||
    !Number.isInteger(instance.resources[resourceId])
  )
    throw Error("Récupération incorrecte");
  const formula = r.recovery.formula;
  if(formula === null) throw Error("Quantité de récupération à confirmer");
  let minimum, maximum;
  if(/^\d+$/.test(formula)) minimum=maximum=Number(formula);
  else {const spec=diceSpec(formula);minimum=Math.max(0,spec.count+spec.bonus);maximum=spec.count*spec.sides+spec.bonus;}
  if(rolled<minimum || rolled>maximum) throw Error("Jet de récupération hors limites");
  const next = structuredClone(instance);
  next.resources[resourceId] = Math.min(
    r.maximum,
    next.resources[resourceId] + rolled,
  );
  next.revision++;
  return next;
}
/** Explicit AC contract: input excludes shield and item magic, never an already-totalled sheet AC. */
export function shieldAC(
  definition,
  instance,
  baseACWithoutShield,
  context = {},
) {
  if (!Number.isFinite(baseACWithoutShield))
    throw Error("CA de base manquante");
  const source = itemSource(definition, instance, context);
  if (definition.category !== "shield") throw Error("Un bouclier est requis");
  if (
    !instance.equipped ||
    !instance.ownerId ||
    instance.quantity < 1 ||
    instance.consumed
  )
    return { ac: baseACWithoutShield, pending: source.pending };
  const profile = definition.effects.find(
    (e) =>
      e.templateId === "p20:effect:custom" &&
      e.params.key === "forge:base-profile",
  );
  const base = profile?.params.payload.shieldBase ?? 2;
  const magic = resolvePassive([source]).bonuses["ac:wearer"] ?? 0;
  return { ac: baseACWithoutShield + base + magic, pending: source.pending };
}
