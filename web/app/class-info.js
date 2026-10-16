/** Editorial guidance; mechanical values always come from the catalogue. */
const rows = {
  barbarian: [
    "Mêlée résistante",
    "Robust frontline",
    "Force brute et endurance.",
    "Strength and endurance.",
    "Simple",
    "Low",
  ],
  bard: [
    "Soutien et influence",
    "Support and influence",
    "Magie, inspiration et polyvalence.",
    "Magic, inspiration and versatility.",
    "Élevée",
    "High",
  ],
  cleric: [
    "Soutien divin",
    "Divine support",
    "Sorts préparés et pouvoirs divins.",
    "Prepared spells and divine powers.",
    "Moyenne",
    "Medium",
  ],
  druid: [
    "Nature et métamorphose",
    "Nature and shapeshifting",
    "Magie préparée et formes animales.",
    "Prepared magic and animal shapes.",
    "Élevée",
    "High",
  ],
  fighter: [
    "Combat et défense",
    "Combat and defense",
    "Armes, armures et techniques martiales.",
    "Weapons, armor and martial techniques.",
    "Simple",
    "Low",
  ],
  monk: [
    "Mobilité et discipline",
    "Mobility and discipline",
    "Combat sans armure et points de ki.",
    "Unarmored combat and ki points.",
    "Moyenne",
    "Medium",
  ],
  paladin: [
    "Protection et mêlée",
    "Protection and melee",
    "Serment, soins et magie divine.",
    "Oath, healing and divine magic.",
    "Moyenne",
    "Medium",
  ],
  ranger: [
    "Exploration et combat",
    "Exploration and combat",
    "Pistage, armes et magie de la nature.",
    "Tracking, weapons and nature magic.",
    "Moyenne",
    "Medium",
  ],
  rogue: [
    "Expertise et précision",
    "Expertise and precision",
    "Compétences, discrétion et attaque sournoise.",
    "Skills, stealth and Sneak Attack.",
    "Simple",
    "Low",
  ],
  sorcerer: [
    "Magie spontanée",
    "Innate magic",
    "Sorts connus et métamagie.",
    "Known spells and Metamagic.",
    "Élevée",
    "High",
  ],
  warlock: [
    "Magie de pacte",
    "Pact magic",
    "Pacte, invocations et repos courts.",
    "Pact, invocations and short rests.",
    "Élevée",
    "High",
  ],
  wizard: [
    "Magie et préparation",
    "Magic and preparation",
    "Grimoire et vaste choix de sorts.",
    "Spellbook and broad spell selection.",
    "Élevée",
    "High",
  ],
};
export function classInfo(id, locale = "fr") {
  const row = rows[id];
  return row
    ? {
        role: row[locale === "fr" ? 0 : 1],
        description: row[locale === "fr" ? 2 : 3],
        complexity: row[locale === "fr" ? 4 : 5],
      }
    : null;
}
