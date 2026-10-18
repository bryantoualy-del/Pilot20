import {backgroundKit} from './background-equipment.js';
import {ARMORS,WEAPONS,SRD_SOURCE,weaponProfile} from '../catalog/equipment.js';
import {check} from '../character/contracts.js';
const name=(fr,en)=>({fr,en});
export const GEAR_NAMES={
 shield:name('Bouclier','Shield'),'wooden-shield':name('Bouclier en bois','Wooden shield'),
 bolts:name('Carreaux','Bolts'),arrows:name('Flèches','Arrows'),quiver:name('Carquois','Quiver'),
 'explorer-pack':name('Paquetage d’explorateur','Explorer’s pack'),'dungeoneer-pack':name('Paquetage d’exploration souterraine','Dungeoneer’s pack'),
 'priest-pack':name('Paquetage d’ecclésiastique','Priest’s pack'),'scholar-pack':name('Paquetage d’érudit','Scholar’s pack'),
 'diplomat-pack':name('Paquetage de diplomate','Diplomat’s pack'),'entertainer-pack':name('Paquetage d’artiste','Entertainer’s pack'),'burglar-pack':name('Paquetage de cambrioleur','Burglar’s pack'),
 'component-pouch':name('Sacoche à composantes','Component pouch'),'arcane-focus':name('Focaliseur arcanique','Arcane focus'),'druidic-focus':name('Focaliseur druidique','Druidic focus'),
 'holy-symbol':name('Symbole sacré','Holy symbol'),spellbook:name('Grimoire','Spellbook'),'thieves-tools':name('Outils de voleur','Thieves’ tools'),
 bagpipes:name('Cornemuse','Bagpipes'),drum:name('Tambour','Drum'),dulcimer:name('Tympanon','Dulcimer'),flute:name('Flûte','Flute'),lute:name('Luth','Lute'),lyre:name('Lyre','Lyre'),horn:name('Cor','Horn'),'pan-flute':name('Flûte de pan','Pan flute'),shawm:name('Chalemie','Shawm'),viol:name('Viole','Viol'),
};
export const gearName=id=>ARMORS[id]?.name??WEAPONS[id]?.name??GEAR_NAMES[id];
const instruments=['bagpipes','drum','dulcimer','flute','lute','lyre','horn','pan-flute','shawm','viol'];
const weapons=(category,melee=false)=>Object.entries(WEAPONS).filter(([,w])=>w.category===category&&(!melee||!w.ranged)).map(([id])=>id);
const simple=weapons('simple'),simpleMelee=weapons('simple',true),martial=weapons('martial'),martialMelee=weapons('martial',true);
const item=(id,quantity=1)=>({id,quantity});
/** Rules describe the first class only. Later multiclass levels grant no starting kit. */
export function startingEquipment(draft,proficiencies=[]){
 if(draft.equipmentMethod==='wealth'||draft.startingEquipmentEnabled!==true)return {choices:[],items:[],issues:[],valid:true};
 const cls=draft.classes[0].id,selected=draft.startingEquipmentChoices??{},choices=[],items=[],issues=[];
 const fixed=(...ids)=>items.push(...ids.map(v=>typeof v==='string'?item(v):v));
 const choose=(key,fr,en,options)=>{
  const id='starting:'+cls+':'+key,q={id,label:name(fr,en),options:options.map(o=>typeof o==='string'?{id:o,name:gearName(o),items:[item(o)]}:o)};
  choices.push(q);const values=selected[id]??[],option=q.options.find(o=>values.length===1&&o.id===values[0]);
  if(!option){issues.push({code:'starting-equipment-choice',choiceId:id});return null;}
  items.push(...option.items);return option.id;
 };
 const bundle=(id,fr,en,...ids)=>({id,name:name(fr,en),items:ids.map(v=>typeof v==='string'?item(v):v)});
 const pack=(a,b)=>choose('pack','Votre paquetage','Your pack',[a+'-pack',b+'-pack']);
 const bow=(id,ammo)=>bundle(id,gearName(id).fr+' et 20 '+GEAR_NAMES[ammo].fr.toLowerCase(),gearName(id).en+' and 20 '+GEAR_NAMES[ammo].en.toLowerCase(),id,item(ammo,20));
 const crossbow=bow('light-crossbow','bolts');
 const twoMartial=()=>{const form=choose('arms','Votre armement','Your armament',[bundle('shield','Une arme de guerre et un bouclier','One martial weapon and a shield','shield'),bundle('two-weapons','Deux armes de guerre','Two martial weapons')]);if(form){choose('martial-1','Première arme de guerre','First martial weapon',martial);if(form==='two-weapons')choose('martial-2','Seconde arme de guerre','Second martial weapon',martial);}};
 const focus=()=>choose('focus','Votre focaliseur','Your focus',['component-pouch','arcane-focus']);
 if(cls==='barbarian'){
  choose('main-weapon','Votre arme principale','Your primary weapon',martialMelee);
  const branch=choose('secondary','Armes supplémentaires','Additional weapons',[bundle('handaxes','Deux hachettes','Two handaxes',item('handaxe',2)),bundle('simple','Une arme courante','One simple weapon')]);if(branch==='simple')choose('simple','Votre arme courante','Your simple weapon',simple);
  fixed('explorer-pack',item('javelin',4));
 }else if(cls==='bard'){
  const b=choose('weapon','Votre arme','Your weapon',['rapier','longsword',bundle('simple','Une arme courante','One simple weapon')]);if(b==='simple')choose('simple','Arme courante','Simple weapon',simple);
  pack('diplomat','entertainer');choose('instrument','Votre instrument','Your instrument',instruments);fixed('leather','dagger');
 }else if(cls==='cleric'){
  choose('weapon','Votre arme','Your weapon',['mace',...(proficiencies.includes('warhammers')||proficiencies.includes('martial-weapons')?['warhammer']:[])]);
  choose('armor','Votre armure','Your armor',['scale','leather',...(proficiencies.includes('heavy-armor')?['chain']:[])]);
  const b=choose('ranged','Armement complémentaire','Additional armament',[crossbow,bundle('simple','Une arme courante','One simple weapon')]);if(b==='simple')choose('simple','Arme courante','Simple weapon',simple);
  pack('priest','explorer');fixed('shield','holy-symbol');
 }else if(cls==='druid'){
  const a=choose('shield','Bouclier ou arme','Shield or weapon',['wooden-shield',bundle('simple','Une arme courante','One simple weapon')]);if(a==='simple')choose('simple','Arme courante','Simple weapon',simple);
  const b=choose('weapon','Votre arme de mêlée','Your melee weapon',['scimitar',bundle('simple','Une arme courante de mêlée','One simple melee weapon')]);if(b==='simple')choose('melee','Arme courante de mêlée','Simple melee weapon',simpleMelee);
  fixed('leather','explorer-pack','druidic-focus');
 }else if(cls==='fighter'){
  choose('armor','Votre protection','Your protection',['chain',bundle('leather-bow','Cuir, arc long et 20 flèches','Leather, longbow and 20 arrows','leather','longbow',item('arrows',20))]);twoMartial();
  choose('secondary','Armes supplémentaires','Additional weapons',[crossbow,bundle('handaxes','Deux hachettes','Two handaxes',item('handaxe',2))]);pack('dungeoneer','explorer');
 }else if(cls==='monk'){
  const b=choose('weapon','Votre arme','Your weapon',['shortsword',bundle('simple','Une arme courante','One simple weapon')]);if(b==='simple')choose('simple','Arme courante','Simple weapon',simple);pack('dungeoneer','explorer');fixed(item('dart',10));
 }else if(cls==='paladin'){
  twoMartial();const b=choose('secondary','Armes supplémentaires','Additional weapons',[bundle('javelins','Cinq javelines','Five javelins',item('javelin',5)),bundle('simple','Une arme courante de mêlée','One simple melee weapon')]);if(b==='simple')choose('simple','Arme courante de mêlée','Simple melee weapon',simpleMelee);pack('priest','explorer');fixed('chain','holy-symbol');
 }else if(cls==='ranger'){
  choose('armor','Votre armure','Your armor',['scale','leather']);const b=choose('weapons','Vos armes de mêlée','Your melee weapons',[bundle('shortswords','Deux épées courtes','Two shortswords',item('shortsword',2)),bundle('simple','Deux armes courantes de mêlée','Two simple melee weapons')]);if(b==='simple'){choose('simple-1','Première arme','First weapon',simpleMelee);choose('simple-2','Seconde arme','Second weapon',simpleMelee);}pack('dungeoneer','explorer');fixed('longbow',item('arrows',20),'quiver');
 }else if(cls==='rogue'){
  choose('weapon','Votre arme de mêlée','Your melee weapon',['rapier','shortsword']);choose('secondary','Armement complémentaire','Additional armament',[{...bow('shortbow','arrows'),items:[...bow('shortbow','arrows').items,item('quiver')]},'shortsword']);choose('pack','Votre paquetage','Your pack',['burglar-pack','dungeoneer-pack','explorer-pack']);fixed('leather',item('dagger',2),'thieves-tools');
 }else if(cls==='sorcerer'||cls==='warlock'){
  const b=choose('weapon','Votre arme','Your weapon',[crossbow,bundle('simple','Une arme courante','One simple weapon')]);if(b==='simple')choose('simple','Arme courante','Simple weapon',simple);focus();pack(cls==='sorcerer'?'dungeoneer':'scholar',cls==='sorcerer'?'explorer':'dungeoneer');fixed(item('dagger',2));if(cls==='warlock'){fixed('leather');choose('extra-simple','Arme courante supplémentaire','Additional simple weapon',simple);}
 }else if(cls==='wizard'){
  choose('weapon','Votre arme','Your weapon',['quarterstaff','dagger']);focus();pack('scholar','explorer');fixed('spellbook');
 }else if(cls==='artificer'){
  choose('simple-1','Première arme courante','First simple weapon',simple);choose('simple-2','Seconde arme courante','Second simple weapon',simple);choose('armor','Votre armure','Your armor',['studded','scale']);fixed('light-crossbow',item('bolts',20),'thieves-tools','dungeoneer-pack');
 }else issues.push({code:'starting-equipment-class',id:cls});
 if(draft.startingEquipmentVersion>=2){
  for(const [generic,key,fr,en,options]of [
   ['arcane-focus','arcane-focus-type','Votre focaliseur arcanique','Your arcane focus',[['crystal','Cristal','Crystal'],['orb','Orbe','Orb'],['rod','Sceptre','Rod'],['staff','Bâton','Staff'],['wand','Baguette','Wand']]],
   ['druidic-focus','druidic-focus-type','Votre focaliseur druidique','Your druidic focus',[['mistletoe','Brin de gui','Sprig of mistletoe'],['totem','Totem','Totem'],['staff','Bâton','Staff'],['yew-wand','Baguette d’if','Yew wand']]],
   ['holy-symbol','holy-symbol-type','Votre symbole sacré','Your holy symbol',[['amulet','Amulette','Amulet'],['emblem','Emblème','Emblem'],['reliquary','Reliquaire','Reliquary']]]
  ])if(items.some(i=>i.id===generic)){const choice=choose(key,fr,en,options.map(([id,fr,en])=>({id,name:name(fr,en),items:[]})));if(choice){const entry=items.find(i=>i.id===generic);entry.name=name(gearName(generic).fr+' — '+options.find(o=>o[0]===choice)[1],gearName(generic).en+' — '+options.find(o=>o[0]===choice)[2]);if(choice==='staff')entry.weaponId='quarterstaff';}}
 }
 const backgroundItems=draft.startingEquipmentVersion>=2?backgroundKit(draft,choose,gearName):null;
 const totals=new Map();for(const v of items){check(gearName(v.id),'Unknown starting item');totals.set(v.id,(totals.get(v.id)??0)+v.quantity);}
 return {choices,backgroundItems,items:[...totals].map(([id,quantity])=>({id,quantity,name:items.find(i=>i.id===id)?.name??gearName(id),...(items.find(i=>i.id===id)?.weaponId?{weaponId:items.find(i=>i.id===id).weaponId}:{})})),issues,valid:issues.length===0};
}
export function compileStartingEquipment(draft,character){
 const report=startingEquipment(draft,character.proficiencies);check(report.valid,'Incomplete starting equipment');
 const source=draft.classes[0].id==='artificer'?{kind:'reference',document:'Chaudron des merveilles de Tasha — équipement de départ',license:'Pilot20-original-summary',url:'https://www.dndbeyond.com/sources/dnd/tcoe'}:SRD_SOURCE;
 return report.items.map(({id,quantity,name,weaponId})=>{
  const shield=['shield','wooden-shield'].includes(id),armor=ARMORS[id]?.profile??(shield?{base:2,dexCap:0,bonus:0,minStrength:0,heavy:false}:null),weapon=weaponProfile(weaponId??id,character.scores,character.proficiencies);
  return {id:'starting:'+draft.classes[0].id+':'+id,quantity,name,kind:weapon?'weapon':shield?'shield':armor?'armor':'item',equipped:!!(weapon||armor),armor:armor?structuredClone(armor):null,weapon,source};
 });
}
export function startingProficiencies(index,draft,report){
 return [...new Set([
  ...draft.classes.flatMap((c,i)=>index.class(c.id)?.data[i===0?'initialProficiencies':'multiclassProficiencies']??[]),
  ...(report.origin?.background?.proficiencies??[]),
  ...(report.features??[]).flatMap(id=>index.get(id)?.data.buildEffects?.proficiencies??[]),
  ...(report.choices??[]).filter(q=>q.kind==='proficiency').flatMap(q=>draft.selections[q.id]??[]),
 ])];
}
