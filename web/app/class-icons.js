/** Local monochrome class symbols; no network asset dependency. */
export const CLASS_ICONS = {
  artificer: "⚙",
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
