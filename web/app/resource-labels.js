import {optionName} from "./editor.js";
const words = {
  inspiration: ["Inspiration bardique", "Bardic Inspiration"],
  "second-wind": ["Second souffle", "Second Wind"],
  "action-surge": ["Fougue", "Action Surge"],
  rage: ["Rages", "Rages"],
  "sorcery-points": ["Points de sorcellerie", "Sorcery points"],
  'divine-sense': ['Sens divin', 'Divine Sense'],
  channel: ['Conduit divin', 'Channel Divinity'],
  'fixed-spell': ['Sort accordé par un don', 'Feat-granted spell'],
  'chosen-spell': ['Sort choisi par un don', 'Chosen feat spell'],
  'experimental-elixirs': ['Élixirs expérimentaux', 'Experimental Elixirs'],
  'chemical-greater-restoration': ['Restauration supérieure · Maîtrise chimique', 'Greater Restoration · Chemical Mastery'],
  'chemical-heal': ['Guérison · Maîtrise chimique', 'Heal · Chemical Mastery'],
  'free-cannon': ['Canon occulte · création gratuite', 'Eldritch Cannon · free creation'],
  'psionic-recovery': ['Récupération d’un dé psionique', 'Psionic die recovery'],
  'psychic-whispers-free': ['Murmures psychiques · utilisation gratuite', 'Psychic Whispers · free use'],
  superiority: ['Dés de supériorité', 'Superiority dice'],
  'psionic-energy': ['Dés d’énergie psionique', 'Psionic energy dice'],
  'wild-shape': ['Forme sauvage', 'Wild Shape'],
  ki: ["Points de ki", "Ki points"],
  "arcane-recovery": ["Récupération arcanique", "Arcane Recovery"],
  "lay-on-hands": ["Imposition des mains", "Lay on Hands"],
};
export function resourceLabel(id, a, definition = {}) {
  if (/^slot\d$/.test(id)) return a.t("slot") + " " + id.slice(4);
  const fr = a.state.locale === 'fr';
  if (/^warlock:arcanum-[6-9]$/.test(id)) return (fr ? 'Arcanum mystique · niveau ' : 'Mystic Arcanum · level ') + id.at(-1);
  if (id.startsWith('pact:')) return fr ? 'Emplacements de pacte' : 'Pact slots';
  const suffix = id.split(':').at(-1);
  if (words[suffix] && !['fixed-spell', 'chosen-spell'].includes(suffix)) return words[suffix][fr ? 0 : 1];
  // Resolve the actual spell for feat/racial uses, including previously saved characters.
  const spells = [...new Set((definition.abilities ?? [])
    .filter(ability => ability.resource?.id === id && ability.combat?.spell?.id)
    .map(ability => ability.combat.spell.id))]
    .map(spellId => a.context.installed.get(spellId)).filter(Boolean);
  if (spells.length) return spells.map(entry => a.name(entry)).join(' / ');
  if (words[suffix]) return words[suffix][fr ? 0 : 1];
  const owned = (definition.features ?? []).map(key => a.context.installed.get(key)).filter(Boolean);
  const declared = owned.find(entry => entry.data.resources?.some(resource => resource.id === suffix));
  if (declared) return a.name(declared);
  const normalizedSuffix = suffix.replace(/-free$/, '');
  const feature = owned.find(entry => entry.id === id || entry.id.endsWith(':' + normalizedSuffix) && (!entry.data.classId || id.startsWith(entry.data.classId + ':')));
  if (feature) return a.name(feature);
  const linked = (definition.abilities ?? []).find(ability => ability.resource?.id === id && a.context.installed.get(ability.id));
  if (linked) return a.name(a.context.installed.get(linked.id));
  return fr ? 'Ressource à identifier · ' + id : optionName(id, a);
}
