import { el } from './dom.js';

/** Existing local artwork, also included in the offline bundle. */
export const CLASS_ICONS = Object.fromEntries([
  'artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
].map(id => [id, './assets/shared/classes/' + id + '.webp']));

export function classIcon(id) {
  return Object.hasOwn(CLASS_ICONS, id)
    ? el('img', { src: CLASS_ICONS[id], alt: '', 'aria-hidden': 'true',
      class: 'class-icon', width: 40, height: 40, decoding: 'async' })
    : el('span', { 'aria-hidden': 'true' }, '◇');
}
