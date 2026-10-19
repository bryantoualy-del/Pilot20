import { el } from './dom.js';

/** Existing local artwork, also included in the offline bundle. */
export const CLASS_ICONS = Object.fromEntries([
  'artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
].map(id => [id, './assets/shared/classes/' + id + '.webp']));

// The sorcerer icon is normalized at asset level, not offset in CSS.
const bounds={wizard:[0,16,33,49]};
export function classIcon(id) {
  if(bounds[id]){const [x,y,right,bottom]=bounds[id],scale=36/Math.max(right-x,bottom-y);return el('span',{class:'class-icon-frame','aria-hidden':'true'},el('img',{src:CLASS_ICONS[id],alt:'',class:'class-icon',width:40,height:40,style:`position:absolute;width:${64*scale}px;height:${64*scale}px;max-width:none;left:${(40-(right-x)*scale)/2-x*scale}px;top:${(40-(bottom-y)*scale)/2-y*scale}px;`}));}
  return Object.hasOwn(CLASS_ICONS, id)
    ? el('img', { src: CLASS_ICONS[id], alt: '', 'aria-hidden': 'true',
      class: 'class-icon', width: 40, height: 40, decoding: 'async' })
    : el('span', { 'aria-hidden': 'true' }, '◇');
}
