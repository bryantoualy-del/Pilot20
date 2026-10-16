import classes from './data/classes.json' with {type:'json'};
import spells from './data/spells.json' with {type:'json'};
import {createCatalogIndex} from './catalog-v3.js';
export const classCatalog=classes;
export const spellCatalog=spells;
/** Call once per campaign load, then reuse the immutable index. */
export const loadSRD=()=>createCatalogIndex([classes,spells],{distribution:'public'});
