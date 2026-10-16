/** Local fallback until RPG Connect assets and their licence are verified. No external art copied. */
export const CLASS_ICONS = {
  fighter: "⚔",
  barbarian: "◆",
  bard: "♫",
  cleric: "✦",
  druid: "❋",
  monk: "☯",
  paladin: "✧",
  ranger: "➶",
  rogue: "◇",
  sorcerer: "✺",
  warlock: "☾",
  wizard: "✶",
};
export const classIcon = (id) => CLASS_ICONS[id] ?? "◇";
