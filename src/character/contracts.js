import {requireThat as check, id, integer, object} from '../model.js';
export {check, id, integer, object};
export const ABILITIES = ['str','dex','con','int','wis','cha'];
export const SKILLS = {acrobatics:'dex',animalHandling:'wis',arcana:'int',athletics:'str',deception:'cha',history:'int',insight:'wis',intimidation:'cha',investigation:'int',medicine:'wis',nature:'int',perception:'wis',performance:'cha',persuasion:'cha',religion:'int',sleightOfHand:'dex',stealth:'dex',survival:'wis'};
export function json(value, depth=0) {
  check(depth<40,'JSON depth');
  if (value===null || typeof value==='string' || typeof value==='boolean') return;
  if (typeof value==='number') {check(Number.isFinite(value),'Finite number');return;}
  check(Array.isArray(value) || (object(value) && Object.getPrototypeOf(value)===Object.prototype),'Plain JSON only');
  for (const [k,v] of Object.entries(value)) {check(!['__proto__','prototype','constructor'].includes(k),'Unsafe key');json(v,depth+1);}
}
export function keys(v,allowed,required=allowed) {
  check(object(v),'Object required');
  check(Object.keys(v).every(k=>allowed.includes(k)) && required.every(k=>Object.hasOwn(v,k)),'Unexpected or missing fields');
}
export const text = v => typeof v==='string' && v.length<=10000;
export function ids(v) {check(Array.isArray(v) && v.every(id) && new Set(v).size===v.length,'Unique IDs');}
export function source(s) {
  keys(s,['kind','document','license','url']);
  check(['srd','homebrew','private'].includes(s.kind) && text(s.document) && text(s.license) && text(s.url),'Provenance');
  if(s.kind==='srd') check(s.document==='SRD-5.1' && s.license==='CC-BY-4.0','2014 SRD license');
}
export function preferences(p) {
  json(p); keys(p,['kind','schemaVersion','characterId','locale','theme','colors','panels','favorites','shortcuts','hidden']);
  check(p.kind==='dashboard' && p.schemaVersion===2 && id(p.characterId) && ['fr','en'].includes(p.locale) && text(p.theme),'Preferences header');
  check(object(p.colors) && Object.values(p.colors).every(text) && object(p.shortcuts) && Object.values(p.shortcuts).every(text),'Preferences maps');
  for(const k of ['panels','favorites','hidden']) ids(p[k]);
  return p;
}
export const defaultPreferences = characterId => ({kind:'dashboard',schemaVersion:2,characterId,locale:'fr',theme:'default',colors:{},panels:[],favorites:[],shortcuts:{},hidden:[]});
