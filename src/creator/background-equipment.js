import {backgrounds2014} from '../catalog/backgrounds-2014.js';
/** PHB 2014 factual equipment lists; prose and labels are original. */
export const BACKGROUND_GOLD={acolyte:15,charlatan:15,criminal:15,spy:15,entertainer:15,gladiator:15,'folk-hero':10,'guild-artisan':15,'guild-merchant':15,hermit:5,noble:25,knight:25,outlander:10,sage:10,sailor:10,pirate:10,soldier:10,urchin:10};
for(const bg of backgrounds2014.items)BACKGROUND_GOLD[bg.id.split(':').at(-1)]=bg.data.startingGold;
const names={
 'prayer-book':['Livre de prières','Prayer book'],'prayer-wheel':['Moulin à prières','Prayer wheel'],vestments:['Vêtements liturgiques','Vestments'],incense:['Bâton d’encens','Incense stick'],
 'weighted-dice':['Dés pipés','Weighted dice'],'marked-cards':['Cartes marquées','Marked cards'],'fake-signet':['Fausse chevalière','False signet ring'],
 'admirer-gift':['Présent d’un admirateur','Admirer’s gift'],'guild-letter':['Lettre d’introduction de guilde','Guild introduction letter'],'notes-case':['Étui de notes ou prières','Notes or prayer scroll case'],pedigree:['Document de lignée','Pedigree document'],'hunting-trap':['Piège de chasse','Hunting trap'],'animal-trophy':['Trophée animal','Animal trophy'],'question-letter':['Lettre relative à une question irrésolue','Letter about an unanswered question'],'lucky-charm':['Porte-bonheur','Lucky charm'],'rank-insignia':['Insigne de grade','Rank insignia'],'enemy-trophy':['Trophée d’un ennemi','Enemy trophy'],'city-map':['Carte de votre ville','City map'],mouse:['Souris apprivoisée','Pet mouse'],'family-token':['Souvenir familial','Family token'],'playing-cards':['Jeu de cartes','Playing cards'],mule:['Mule','Mule'],cart:['Charrette','Cart'],banner:['Bannière reçue d’un noble','Banner given by a noble'],
};
const instruments=[['bagpipes','Cornemuse','Bagpipes'],['drum','Tambour','Drum'],['dulcimer','Tympanon','Dulcimer'],['flute','Flûte','Flute'],['lute','Luth','Lute'],['lyre','Lyre','Lyre'],['horn','Cor','Horn'],['pan-flute','Flûte de pan','Pan flute'],['shawm','Chalemie','Shawm'],['viol','Viole','Viol']];
const tools=[['alchemists-supplies','Matériel d’alchimiste','Alchemist’s supplies',50],['brewers-supplies','Matériel de brasseur','Brewer’s supplies',20],['calligraphers-supplies','Matériel de calligraphe','Calligrapher’s supplies',10],['carpenters-tools','Outils de charpentier','Carpenter’s tools',8],['cartographers-tools','Outils de cartographe','Cartographer’s tools',15],['cobblers-tools','Outils de cordonnier','Cobbler’s tools',5],['cooks-utensils','Ustensiles de cuisinier','Cook’s utensils',1],['glassblowers-tools','Outils de souffleur de verre','Glassblower’s tools',30],['jewelers-tools','Outils de joaillier','Jeweler’s tools',25],['leatherworkers-tools','Outils de tanneur','Leatherworker’s tools',5],['masons-tools','Outils de maçon','Mason’s tools',10],['painters-supplies','Matériel de peintre','Painter’s supplies',10],['potters-tools','Outils de potier','Potter’s tools',10],['smiths-tools','Outils de forgeron','Smith’s tools',20],['tinkers-tools','Outils de bricoleur','Tinker’s tools',50],['weavers-tools','Outils de tisserand','Weaver’s tools',1],['woodcarvers-tools','Outils de sculpteur sur bois','Woodcarver’s tools',1]];
export const ARTISAN_TOOLS=tools;
for(const[id,fr,en]of [...instruments,...tools])names[id]=[fr,en];
export function backgroundKit(d,choose,gearName){
 const extended=backgrounds2014.items.find(b=>b.id===d.backgroundId);
 if(extended){
  const data=extended.data,parts=data.equipment[0].name.fr.split(', '),rows=[];
  for(const [i,label]of parts.entries()){
   const variable=label.startsWith('instrument ou jeu')||label==='jeu'||label.startsWith('Outils d’artisan');
   if(variable){const q=data.choices.find(q=>q.kind==='proficiency');const chosen=d.originSelections?.[extended.id+':'+q?.key]??[];const ids=chosen.length?chosen:q?.options??[];const selected=choose('background-tool','Votre matériel d’historique','Background equipment',ids.map(id=>({id,name:gearName(id)??{fr:names[id]?.[0]??id,en:names[id]?.[1]??id},items:[]})));if(selected)rows.push({id:selected,quantity:1,name:gearName(selected)??{fr:names[selected]?.[0]??selected,en:names[selected]?.[1]??selected}});}
   else rows.push({id:extended.id.split(':').at(-1)+'-gear-'+i,quantity:1,name:{fr:label,en:label}});
  }
  rows.push({id:'pouch',quantity:1,name:{fr:'Bourse',en:'Pouch'}});return rows;
 }
 const original=d.backgroundId?.split(':').at(-1),key=({spy:'criminal',gladiator:'entertainer','guild-merchant':'guild-artisan',knight:'noble',pirate:'sailor'})[original]??original,rows=[];
 const add=(id,quantity=1)=>rows.push({id,quantity,name:gearName(id)??(names[id]?{fr:names[id][0],en:names[id][1]}:{fr:id,en:id})});
 const pick=(key,fr,en,ids)=>{const selected=choose('background-'+key,fr,en,ids.map(row=>{const[id,fr,en]=Array.isArray(row)?row:[row,names[row]?.[0]??gearName(row)?.fr,names[row]?.[1]??gearName(row)?.en];return{id,name:{fr,en},items:[]};}));if(selected)add(selected);return selected;};
 if(key==='acolyte'){add('holy-symbol');pick('prayers','Votre support de prières','Your prayer aid',['prayer-book','prayer-wheel']);add('incense',5);add('vestments');add('common-clothes');}
 if(key==='charlatan'){add('fine-clothes');add('disguise-kit');pick('trick','Votre instrument de tricherie','Your con tool',['weighted-dice','marked-cards','fake-signet']);}
 if(key==='criminal'){add('crowbar');add('common-clothes');}
 if(key==='entertainer'){if(original==='gladiator')pick('performance','Instrument ou arme de spectacle peu coûteuse','Instrument or inexpensive performance weapon',[...instruments,['trident','Trident','Trident'],['net','Filet','Net']]);else pick('instrument','Votre instrument d’historique','Your background instrument',instruments);add('admirer-gift');add('costume');}
 if(key==='folk-hero'){pick('tools','Vos outils d’artisan','Your artisan’s tools',tools);add('shovel');add('iron-pot');add('common-clothes');}
 if(key==='guild-artisan'){const wagon=original==='guild-merchant'?pick('merchant','Votre matériel de négociant','Your merchant’s gear',[['tools','Outils d’artisan','Artisan’s tools'],['mule-cart','Mule et charrette','Mule and cart']]):null;if(wagon==='mule-cart'){rows.splice(rows.findIndex(r=>r.id==='mule-cart'),1);add('mule');add('cart');}else{const i=rows.findIndex(r=>r.id==='tools');if(i>=0)rows.splice(i,1);pick('tools','Vos outils d’artisan','Your artisan’s tools',tools);}add('guild-letter');add('travelers-clothes');}
 if(key==='hermit'){add('notes-case');add('blanket');add('common-clothes');add('herbalism-kit');}
 if(key==='noble'){add('fine-clothes');add('signet-ring');add('pedigree');if(original==='knight')add('banner');}
 if(key==='outlander'){add('quarterstaff');add('hunting-trap');add('animal-trophy');add('travelers-clothes');}
 if(key==='sage'){for(const id of ['ink','ink-pen','small-knife','question-letter','common-clothes'])add(id);}
 if(key==='sailor'){for(const id of ['club','rope-silk','lucky-charm','common-clothes'])add(id);}
 if(key==='soldier'){add('rank-insignia');add('enemy-trophy');pick('gaming','Votre jeu','Your gaming set',[['gaming-set','Jeu de dés','Dice set'],'playing-cards']);add('common-clothes');}
 if(key==='urchin')for(const id of ['small-knife','city-map','mouse','family-token','common-clothes'])add(id);
 if(BACKGROUND_GOLD[original])add('pouch');return Object.hasOwn(BACKGROUND_GOLD,original)?rows:null;
}
