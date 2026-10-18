import {spellReference} from './spell-reference.js';
/** Stable IDs remain language independent. A missing French label is explicit, never presented as a verified translation. */
export function localizedName(entry, locale = "fr", verified = {}) {
  if (!entry) return "";
  if (locale === "en") return entry.name.en;
  if (entry.type === "spell" && spellReference(entry.id)) return spellReference(entry.id).name.fr;
  const name = verified[entry.id] ?? entry.name.fr;
  if (name && name !== entry.name.en) return name;
  if (name && entry.type !== "spell") return name;
  return entry.name.en + " · traduction FR indisponible";
}
export function spellTerms(entry, locale = "fr") {
  const d = entry.data;
  const reference = spellReference(entry.id);
  if(locale === "fr" && reference) return {level:reference.level,school:reference.schoolFr,castingTime:reference.casting.time,range:reference.casting.range,components:reference.casting.components + (reference.casting.material ? " ("+reference.casting.material+")" : ""),duration:reference.casting.duration};
  if (locale === "en")
    return {
      level: d.level,
      school: d.school,
      castingTime: d.castingTime,
      range: d.range,
      components: d.components,
      duration: d.duration,
    };
  const schools = {
    abjuration: "Abjuration",
    conjuration: "Invocation",
    divination: "Divination",
    enchantment: "Enchantement",
    evocation: "Évocation",
    illusion: "Illusion",
    necromancy: "Nécromancie",
    transmutation: "Transmutation",
  };
  const translate = (v) =>
    ({
      Instantaneous: "Instantanée",
      Self: "Personnelle",
      Touch: "Contact",
      "1 action": "1 action",
      "1 bonus action": "1 action bonus",
      "1 reaction": "1 réaction",
      "1 minute": "1 minute",
      "1 hour": "1 heure",
      "8 hours": "8 heures",
      "24 hours": "24 heures",
      "10 minutes": "10 minutes",
      "1 round": "1 round",
      "Concentration, up to 1 minute": "Concentration, jusqu’à 1 minute",
      "Concentration, up to 10 minutes": "Concentration, jusqu’à 10 minutes",
      "Concentration, up to 1 hour": "Concentration, jusqu’à 1 heure",
    })[v] ??
    (/^\d+ feet$/.test(v)
      ? v.replace("feet", "pieds")
      : v + " · texte FR indisponible");
  return {
    level: d.level,
    school: schools[d.school],
    castingTime: translate(d.castingTime),
    range: translate(d.range),
    components: d.components,
    duration: translate(d.duration),
  };
}
