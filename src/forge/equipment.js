/** Catalogue selection -> existing Forge format. Reading old objects never rewrites them. */
import {WEAPONS, ARMORS} from '../catalog/equipment.js';
import {categories, effect, addBaseProfile, baseProfile, damageTypes} from './model.js';
export const propertyLabels={simple:'Arme courante',martial:'Arme de guerre',melee:'Corps à corps',ranged:'Distance',finesse:'Finesse',light:'Légère',heavy:'Lourde','two-handed':'Deux mains',versatile:'Polyvalente',reach:'Allonge',thrown:'Lancer',loading:'Chargement',ammunition:'Munitions',special:'Spéciale'};
export const slotLabels={hand:'Main',body:'Corps',head:'Tête',neck:'Cou',finger:'Doigt',back:'Dos',feet:'Pieds',waist:'Taille',hands:'Mains'};
const instruments={drum:'Tambour',bagpipes:'Cornemuse',dulcimer:'Tympanon',flute:'Flûte',lute:'Luth',lyre:'Lyre',horn:'Cor','pan-flute':'Flûte de Pan',shawm:'Chalemie',viol:'Viole'};
const extra={shield:{shield:'Bouclier standard'},wondrous:{ring:'Anneau',amulet:'Amulette',cloak:'Cape',boots:'Bottes',belt:'Ceinture',instrument:'Instrument de musique',...instruments},instrument:instruments,ammunition:{arrows:'Flèches',bolts:'Carreaux','sling-bullets':'Billes de fronde','blowgun-needles':'Aiguilles'},staff:{staff:'Bâton magique',quarterstaff:'Bâton de combat'},wand:{wand:'Baguette'},rod:{rod:'Sceptre'},potion:{potion:'Potion',oil:'Huile'},scroll:{scroll:'Parchemin de sort'},consumable:{potion:'Potion',scroll:'Parchemin',oil:'Huile',dust:'Poudre',other:'Autre consommable'},focus:{arcane:'Focaliseur arcanique',druidic:'Focaliseur druidique',holy:'Symbole sacré'}};
export function subtypes(category){return category==='weapon'?Object.fromEntries(Object.entries(WEAPONS).map(([id,w])=>[id,w.name.fr])):category==='armor'?Object.fromEntries(Object.entries(ARMORS).map(([id,a])=>[id,a.name.fr])):extra[category]??{[category]:categories[category]};}
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function resolveSubtype(item){
 const choices=subtypes(item.category),values=[item.baseItem.id,item.subcategory,item.baseItem.label].filter(Boolean);
 const aliases={plate:['armure de plates','plates'],leather:['armure de cuir'],studded:['armure de cuir clouté'],quarterstaff:['bâton de combat'],shield:['bouclier']};
 const matches=Object.keys(choices).filter(id=>values.some(v=>[id,'srd51:'+id,choices[id],...(aliases[id]??[]),WEAPONS[id]?.name.en,ARMORS[id]?.name.en].filter(Boolean).some(x=>normalize(x)===normalize(v))));
 return matches.length===1?matches[0]:null;
}
export function hasBaseMechanics(item){return !!baseProfile(item)||item.effects.some(e=>e.params.role==='weapon-base');}
export function applySubtype(item,id,{replace=false}={}){
 const label=subtypes(item.category)[id];if(!label)throw Error('Sous-type incompatible avec cette catégorie.');
 if(hasBaseMechanics(item)&&!replace)throw Error('Profil existant : remplacement explicite requis. Les pouvoirs seront conservés.');
 // Only the base physical/damage profile changes; magical modifiers and every power survive.
 item.effects=item.effects.filter(e=>e.params.key!=='forge:base-profile'&&e.params.role!=='weapon-base');
 item.subcategory=id;item.baseItem.id=id;item.baseItem.label=label;item.baseItem.properties=[];
 const w=item.category==='weapon'||item.category==='staff'&&id==='quarterstaff'?WEAPONS[id]:null;
 const a=item.category==='armor'?ARMORS[id]:null;
 item.equipment.hands=w?.hands??(item.category==='shield'?1:0);
 item.equipment.slots=w||item.category==='shield'?['hand']:a?['body']:[];
 item.equipment.requiresEquipped=true;
 if(w){
  item.baseItem.properties=[w.category,w.ranged?'ranged':'melee',...w.properties];
  Object.assign(addBaseProfile(item).params.payload,{range:w.range,longRange:w.longRange,versatileDice:w.versatileDice,proficiency:w.proficiency,weaponCategory:w.category,ranged:w.ranged});
  if(w.dice){const e=effect('damage',{dice:w.dice,damageType:w.damageType,role:'weapon-base'});e.trigger='on-hit';item.effects.push(e);}
 }else if(a)Object.assign(addBaseProfile(item).params.payload,{baseAC:a.profile.base,dexCap:a.profile.dexCap,minimumStrength:a.profile.minStrength,armorCategory:a.category,stealthDisadvantage:a.stealthDisadvantage});
 else if(item.category==='shield')addBaseProfile(item);
 return item;
}
export function magicModifiers(item){const weapon=['weapon','ammunition','staff'].includes(item.category),stats=weapon?['attack','damage']:['ac'],scope=weapon?'this-weapon':'wearer';return item.effects.filter(e=>e.templateId==='p20:effect:modifier'&&stats.includes(e.params.stat)&&e.params.scope===scope&&e.params.operation==='add'&&!e.trigger&&!e.duration&&!e.modeId&&!e.conditions.length);}
export function setMagicBonus(item,value){
 if(!Number.isInteger(value)||value<0||value>20)throw Error('Bonus magique incorrect.');
 const rows=magicModifiers(item),stats=['weapon','ammunition','staff'].includes(item.category)?['attack','damage']:['ac'];
 if(stats.some(stat=>rows.filter(e=>e.params.stat===stat).length>1))throw Error('Bonus multiples conservés : modifiez les effets dans les réglages avancés.');
 for(const stat of stats){const e=rows.find(e=>e.params.stat===stat);if(e)e.params.value=value;else item.effects.push(effect('modifier',{stat,value,operation:'add',scope:stat==='ac'?'wearer':'this-weapon'}));}
}
export function profileSummary(item){
 const p=baseProfile(item)?.params.payload,b=item.effects.find(e=>e.params.role==='weapon-base'),rows=[];
 if(b)rows.push(`${b.params.dice??'Dés à préciser'} ${damageTypes[b.params.damageType]?.toLowerCase()??'type à préciser'}`);
 if(p?.versatileDice)rows.push(`Polyvalente : ${p.versatileDice} à deux mains`);
 if(p?.baseAC!=null)rows.push(`CA ${p.baseAC}${p.dexCap===0?'':p.dexCap==null?' + Dextérité':` + Dextérité (maximum ${p.dexCap})`}`);
 if(p?.shieldBase!=null)rows.push(`Bouclier : +${p.shieldBase} CA de base`);
 for(const e of magicModifiers(item))rows.push(`${{attack:'Bonus d’attaque magique',damage:'Bonus de dégâts magique',ac:'Bonus magique de CA'}[e.params.stat]} : +${e.params.value}`);
 if(item.category==='shield')rows.push(`Bonus total du bouclier : +${(p?.shieldBase??2)+magicModifiers(item).reduce((n,e)=>n+e.params.value,0)} CA`);
 if(!b&&!p)rows.push('Aucun profil de combat.');
 rows.push(...item.baseItem.properties.map(x=>propertyLabels[x]??x));return rows;
}
/** Character values are resolved at session/use time, never stored in an item. */
export function weaponContext(item,context={}){
 const explicit=baseProfile(item)?.params.payload,w=WEAPONS[resolveSubtype(item)];
 const p=explicit??(w?{proficiency:w.proficiency,weaponCategory:w.category,ranged:w.ranged}:null);
 const props=explicit?item.baseItem.properties:[...new Set([...item.baseItem.properties,...(w?.properties??[])])];
 const hands=context.hands??item.equipment.hands;
 if(context.distance!=null&&(explicit?.longRange??explicit?.range)!=null&&context.distance>(explicit.longRange??explicit.range))throw Error('Cible hors de portée.');
 if(props.includes('ammunition')&&context.ammunitionAvailable===false)throw Error('Munitions indisponibles.');
 if(props.includes('loading')&&context.loadingAttackSpent===true)throw Error('Chargement : une seule attaque par action, action bonus ou réaction.');
 if(props.includes('two-handed')&&hands!==2)throw Error('Cette arme exige deux mains.');
 if(context.availableHands!=null&&hands>context.availableHands)throw Error('Mains disponibles insuffisantes.');
 if(props.includes('special'))throw Error('Propriété spéciale : validation du MJ requise.');
 const weaponTraits={melee:!p?.ranged&&!props.includes('ranged'),ranged:!!p?.ranged||props.includes('ranged'),finesse:props.includes('finesse'),strength:context.attackAbility==='str'};
 if(!context.scores)return {...context,weaponTraits}; // backwards-compatible explicit precomputed contract
 const scores=context.scores,override=context.weaponAbilityOverrides?.[item.id]??context.attackAbility;
 const ability=override??(props.includes('finesse')?(scores.dex>scores.str?'dex':'str'):p?.ranged||props.includes('ranged')?'dex':'str');
 if(!Number.isFinite(scores[ability]))throw Error('Caractéristique du porteur manquante.');
 const mod=Math.floor((scores[ability]-10)/2),profs=context.proficiencies??[];
 const proficient=context.proficient??(profs.includes(p?.proficiency)||profs.includes((p?.weaponCategory??(props.includes('martial')?'martial':'simple'))+'-weapons'));
 const proficiencyBonus=context.proficiencyBonus??(context.level?2+Math.floor((context.level-1)/4):null);
 if(proficient&&!Number.isFinite(proficiencyBonus))throw Error('Bonus de maîtrise du porteur manquant.');
 return {...context,weaponTraits:{...weaponTraits,strength:ability==='str'},attackAbility:ability,attackBonus:mod+(proficient?proficiencyBonus:0)+(context.extraAttackBonus??0),damageBonus:mod+(context.extraDamageBonus??0)};
}
