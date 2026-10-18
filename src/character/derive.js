import {
  check,
  keys,
  integer,
  id,
  source,
  ABILITIES,
  SKILLS,
} from "./contracts.js";
import { validateBuild } from "./definition.js";
import { expression, resourceDefinitions, compileAbilities } from "./rules.js";
export const modifier = (score) => {
  check(integer(score, 1, 30), "Score");
  return Math.floor((score - 10) / 2);
};
/** Shared creation/derived HP policy, without automatic rolling. Class order is explicit. */
export const averageHpProgression = (classes) =>
  classes.flatMap((c, n) =>
    Array.from({ length: c.level }, (_, l) => ({
      classId: c.id,
      hp: n === 0 && l === 0 ? c.hitDie : c.hitDie / 2 + 1,
    })),
  );
export const hitPointTotal = (progression, scores) =>
  progression.reduce((n, p) => n + Math.max(1, p.hp + modifier(scores.con)), 0);
export const proficiencyBonus = (level) => {
  check(integer(level, 1, 20), "Level");
  return 2 + Math.floor((level - 1) / 4);
};
const SLOTS = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
export function spellSlots(classes) {
  const cs = classes.filter(
    (c) => c.casting && c.casting.progression !== "pact",
  );
  const multi = cs.length > 1;
  const casterLevel = cs.reduce((n, c) => {
    const p = c.casting.progression;
    if (p === "full") return n + c.level;
    if (c.level < (c.casting.startsAtClassLevel ?? (p === "half" ? 2 : 3)))
      return n;
    return (
      n +
      (multi ? Math[c.casting.multiclassRounding ?? "floor"] : Math.ceil)(
        c.level / (p === "half" ? 2 : 3),
      )
    );
  }, 0);
  const slots = Object.fromEntries(
    (SLOTS[casterLevel - 1] || []).map((n, i) => [
      "slot" + (i + 1),
      { max: n, recovery: "long", slotLevel: i + 1, pool: "standard" },
    ]),
  );
  for (const c of classes.filter((c) => c.casting?.progression === "pact")) {
    slots["pact:" + c.id] = {
      max: c.level === 1 ? 1 : c.level < 11 ? 2 : c.level < 17 ? 3 : 4,
      recovery: "short",
      slotLevel: Math.min(5, Math.ceil(c.level / 2)),
      pool: "pact",
    };
  }
  return {
    resources: slots,
    casterLevel,
    pactLevels: Object.fromEntries(
      classes
        .filter((c) => c.casting?.progression === "pact")
        .map((c) => [c.id, Math.min(5, Math.ceil(c.level / 2))]),
    ),
  };
}
export function derive(d) {
  const report = validateBuild(d);
  check(report.valid, "Incomplete build: " + JSON.stringify(report.issues));
  const level = d.classes.reduce((n, c) => n + c.level, 0),
    pb = proficiencyBonus(level),
    stats = { level, proficiency: pb, attacksPerAction: 1,untrainedCheckBonus:0,untrainedPhysicalCheckBonus:0,rangedWeaponAttackBonus:0 };
  for (const c of d.classes) stats["class." + c.id] = c.level;
  for (const k of ABILITIES){stats["mod." + k] = modifier(d.scores[k]);stats["checkBonus."+k]=0;}
  const skills = {},
    saves = {},
    casting = {};
  for (const [k, a] of Object.entries(SKILLS))
    skills[k] = stats["mod." + a] + pb * (d.skills[k] || 0);
  for (const k of ABILITIES)
    saves[k] = stats["mod." + k] + (d.saveProficiencies.includes(k) ? pb : 0);
  let maxHp = hitPointTotal(d.progression, d.scores);
  const worn = d.equipment.find((e) => e.equipped && e.kind === "armor"),
    shield = d.equipment.find((e) => e.equipped && e.kind === "shield");
  const shieldBonus = shield ? shield.armor.base + shield.armor.bonus : 0;
  const acOptions = [
    {
      id: worn?.id || "unarmored",
      value: worn
        ? worn.armor.base +
          worn.armor.bonus +
          (worn.armor.heavy
            ? 0
            : Math.min(stats["mod.dex"], worn.armor.dexCap ?? 100)) +
          shieldBonus
        : 10 + stats["mod.dex"] + shieldBonus,
    },
  ];
  if (!worn)
    for (const a of d.armorRules.filter((a) => !shield || a.shieldAllowed))
      acOptions.push({
        id: a.id,
        value:
          a.base +
          a.abilities.reduce((n, k) => n + stats["mod." + k], 0) +
          (a.shieldAllowed ? shieldBonus : 0),
      });
  let ac = Math.max(...acOptions.map((a) => a.value));
  let speed =
    d.movement.walk -
    (worn?.armor.heavy &&
    d.scores.str < worn.armor.minStrength &&
    !d.movement.ignoreHeavyPenalty
      ? 10
      : 0);
  Object.assign(stats, {
    maxHp,
    ac,
    speed: Math.max(0, speed),
    initiative: stats["mod.dex"],
  });
  for (const k of ABILITIES) stats["save." + k] = saves[k];
  for (const k of Object.keys(SKILLS)) stats["skill." + k] = skills[k];
  for (const c of d.classes)
    if (c.casting) {
      stats["spellAttack." + c.id] = stats["mod." + c.casting.ability] + pb;
      stats["spellDC." + c.id] = 8 + stats["spellAttack." + c.id];
    }
  const trace = [];
  for (const m of d.modifiers) {
    keys(m, ["id", "stat", "operation", "value", "reason", "source","condition"],["id", "stat", "operation", "value", "reason", "source"]);
    if(m.condition!==undefined){check(['wearing-armor','wearing-heavy-armor','unarmored-unshielded'].includes(m.condition),'Modifier condition');if(m.condition==='unarmored-unshielded'?(worn||shield):(!worn||m.condition==='wearing-heavy-armor'&&!worn.armor.heavy))continue;}
    source(m.source);
    const allowed = [
      "ac",
      "maxHp",
      "speed",
      "initiative",
      "attacksPerAction",
      "untrainedCheckBonus","untrainedPhysicalCheckBonus","rangedWeaponAttackBonus",
      ...ABILITIES.map((k) => "save." + k),
      ...ABILITIES.map(k=>"checkBonus."+k),
      ...Object.keys(SKILLS).map((k) => "skill." + k),
      ...d.classes.flatMap((c) => ["spellAttack." + c.id, "spellDC." + c.id]),
    ];
    check(
      id(m.id) &&
        allowed.includes(m.stat) &&
        ["add", "set", "max"].includes(m.operation) &&
        typeof m.reason === "string" &&
        m.reason.trim(),
      "Explicit modifier",
    );
    const n = expression(m.value, stats);
    check(integer(n, -100000, 100000), "Modifier integer");
    const before = stats[m.stat];
    check(before !== undefined, "Modifier target");
    stats[m.stat] =
      m.operation === "add"
        ? before + n
        : m.operation === "max"
          ? Math.max(before, n)
          : n;
    trace.push({
      id: m.id,
      stat: m.stat,
      before,
      after: stats[m.stat],
      reason: m.reason,
      source: structuredClone(m.source),
    });
  }
  const halfBonus=ability=>Math.max(stats.untrainedCheckBonus,['str','dex','con'].includes(ability)?stats.untrainedPhysicalCheckBonus:0);
  for(const [skill,ability]of Object.entries(SKILLS))stats['skill.'+skill]+=(d.skills[skill]?0:halfBonus(ability))+stats['checkBonus.'+ability];
  stats.initiative+=(d.proficiencies.includes('initiative')?pb:halfBonus('dex'))+stats['checkBonus.dex'];
  const checks=Object.fromEntries(ABILITIES.map(a=>[a,stats['mod.'+a]+halfBonus(a)+stats['checkBonus.'+a]]));
  check(
    integer(stats.maxHp, 1) &&
      integer(stats.ac, 0, 100) &&
      integer(stats.speed, 0, 1000) &&
      integer(stats.attacksPerAction, 1, 10),
    "Derived bounds",
  );
  for (const k of ABILITIES) saves[k] = stats["save." + k];
  for (const k of Object.keys(SKILLS)) skills[k] = stats["skill." + k];
  for (const c of d.classes)
    if (c.casting)
      casting[c.id] = {
        attack: stats["spellAttack." + c.id],
        dc: stats["spellDC." + c.id],
      };
  const weapons = {};
  for (const w of d.equipment.filter((e) => e.kind === "weapon")) {
    const m = stats["mod." + w.weapon.ability];
    stats["weaponAttack." + w.id] =
      m + (w.weapon.proficient ? pb : 0) + w.weapon.bonus+(w.weapon.ranged?stats.rangedWeaponAttackBonus:0);
    stats["weaponDamage." + w.id] = m + w.weapon.bonus;
    weapons[w.id] = {
      attack: stats["weaponAttack." + w.id],
      damageBonus: stats["weaponDamage." + w.id],
    };
  }
  const slots = spellSlots(d.classes),
    resources = resourceDefinitions(d, stats);
  for (const [k, r] of Object.entries(slots.resources)) {
    check(!Object.hasOwn(resources, k), "Reserved spell resource");
    resources[k] = r;
  }
  const compiled = compileAbilities(d, stats, resources);
  return {
    reactiveRules: structuredClone(d.reactiveRules ?? []),
    castingModifiers: structuredClone(d.castingModifiers ?? []),
    level,
    proficiency: pb,
    modifiers: Object.fromEntries(ABILITIES.map((k) => [k, stats["mod." + k]])),
    skills,
    saves,
    checks,
    casting,
    weapons,
    ac: stats.ac,
    maxHp: stats.maxHp,
    speed: stats.speed,
    movement:{walk:stats.speed,...(d.movement.climb!==undefined?{climb:d.movement.climbMatchesWalk?stats.speed:d.movement.climb}:{}),...(d.movement.swim!==undefined?{swim:d.movement.swim}:{}),...(d.movement.fly!==undefined?{fly:d.movement.fly}:{})},
    initiative: stats.initiative,
    attacksPerAction: stats.attacksPerAction,
    acOptions,
    resources,
    slotMetadata: {
      casterLevel: slots.casterLevel,
      pactLevels: slots.pactLevels,
    },
    ...compiled,
    trace,
  };
}
