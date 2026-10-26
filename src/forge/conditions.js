export function conditionMet(c, instance, context = {}) {
  if (!c) return true;
  switch (c.op) {
    case "equipped":
      return instance.equipped === true;
    case "attuned":
      return instance.attuned === true;
    case "state":
      return Object.hasOwn(context.state ?? {}, c.key)
        ? context.state[c.key] === c.value
        : null;
    case "class-level":
      return context.classes
        ? (context.classes[c.classId] ?? 0) >= c.minimum
        : null;
    case "ability-minimum":
      return context.scores?.[c.ability] === undefined
        ? null
        : context.scores[c.ability] >= c.minimum;
    case "wearing-armor":
      return context.wearingArmor ?? null;
    case "wielding-shield":
      return context.wieldingShield ?? null;
    case "manual":
      return null;
    case "not": {
      const v = conditionMet(c.condition, instance, context);
      return v === null ? null : !v;
    }
    case "all": {
      const v = c.conditions.map((x) => conditionMet(x, instance, context));
      return v.includes(false) ? false : v.includes(null) ? null : true;
    }
    case "any": {
      const v = c.conditions.map((x) => conditionMet(x, instance, context));
      return v.includes(true) ? true : v.includes(null) ? null : false;
    }
    default:
      return null;
  }
}
