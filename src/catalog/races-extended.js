import facts from './data/races-aidedd-2014.json' with {type:'json'};
import {ABILITIES,SKILLS} from '../character/contracts.js';
import {LANGUAGES} from './origins.js';
import {WEAPONS} from './equipment.js';
import {TOOL_PROFICIENCIES} from './proficiencies.js';
import {spellReferences} from './spell-reference.js';
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const family={"genasi-de-l-air":'genasi',"genasi-de-l-eau":'genasi','genasi-du-feu':'genasi','genasi-de-la-terre':'genasi','halfelin-sagespectre':'halfelin'};
const refs=spellReferences();
const q=(key,kind,count,options,fr,en=fr)=>({key,kind,count,options,label:{fr,en}});
const skill=(count,options=Object.keys(SKILLS))=>q('racial-skills','skill',count,options,'Compétences raciales','Racial skills');
const action=(cost='action',target='self')=>({cost,target,maxTargets:1});
const uses=(max=1,recovery='long')=>max==='pb'?{proficiency:true,recovery}:{max,recovery};
const notes={
'vol':'Vol à la vitesse indiquée ; l’armure intermédiaire ou lourde empêche ce vol. Une Fadette ne peut pas voler avec ces armures.',
'puissamment-bati':'La capacité de port et les limites de pousser, tirer ou soulever sont calculées comme pour une taille supérieure.',
'ascendance-feerique':'Avantage aux sauvegardes contre l’état charmé.',
'resistance-a-la-magie':'Avantage aux jets de sauvegarde contre les sorts ; les autres effets magiques ne sont pas inclus par cette version.',
'memoire-de-kenku':'Après un jet de caractéristique utilisant une compétence maîtrisée, vous pouvez lui donner l’avantage ; usages égaux au bonus de maîtrise par repos long.',
'copie-de-maitre':'Avantage aux tests de caractéristique pour produire une copie d’un écrit ou d’un objet existant.',
'imitation-des-sons':'Reproduisez les sons entendus, y compris les voix. Une créature peut identifier l’imitation par Sagesse (Intuition), DD 8 + maîtrise + Charisme.',
'savoir-astral':'Après un repos long, choisissez une compétence et une maîtrise d’arme ou d’outil, conservées jusqu’au prochain repos long.',
'petit-geant':'Maîtrise d’Athlétisme ; capacité de port et limites de traction comme une taille supérieure.',
'montagnard':'Résistance au froid et adaptation à la haute altitude.',
'longs-membres':'Pendant votre tour, votre allonge augmente de 1,50 m pour vos attaques au corps à corps.',
'attaque-surprise-2d6':'Une attaque touchant une créature qui n’a pas encore joué son tour dans ce combat inflige 2d6 dégâts supplémentaires.',
'fureur-des-petits':'Après avoir infligé des dégâts à une créature plus grande que vous, ajoutez votre bonus de maîtrise aux dégâts. Une fois par tour, bonus de maîtrise utilisations par repos long.',
'fuite-agile':'Vous pouvez vous Désengager ou vous Cacher par une action bonus.',
'endurance-implacable':'Lorsque des dégâts vous font tomber à 0 PV sans vous tuer sur le coup, vous pouvez rester à 1 PV ; une fois par repos long.',
'montee-d-adrenaline':'Action bonus : Foncer et obtenir autant de PV temporaires que votre bonus de maîtrise. Bonus de maîtrise utilisations par repos long.',
'agilite-feline':'Doublez votre vitesse pendant un tour ; il faut ensuite passer un tour sans vous déplacer pour pouvoir réutiliser ce trait.',
'demarrage-du-lievre':'Ajoutez votre bonus de maîtrise aux jets d’initiative.',
'pas-chanceux':'Réaction après une sauvegarde de Dextérité ratée : ajoutez 1d4, à condition de ne pas être neutralisé et d’avoir une vitesse supérieure à 0.',
'saut-de-lapin':'Action bonus : sautez de 1,50 m × bonus de maîtrise sans provoquer d’attaque d’opportunité. Votre vitesse doit être supérieure à 0 ; bonus de maîtrise utilisations par repos long.',
'carapace-protectrice':'Action : rentrez dans votre carapace. +4 à la CA, avantage aux sauvegardes de Force et Constitution, désavantage aux sauvegardes de Dextérité, vitesse 0. Vous êtes à terre, ne pouvez pas réagir et ne pouvez agir que pour sortir par une action bonus.',
'armure-naturelle':'Votre armure naturelle fournit une formule de CA alternative, sans cumul avec une armure portée. Le bouclier reste compatible.',
'protection-integree':'Bonus permanent de +1 à la CA. Intégrer ou retirer une armure maîtrisée demande 1 heure ; elle ne peut être retirée contre votre volonté tant que vous vivez.',
'repos-de-la-sentinelle':'Pendant un repos long, vous restez immobile et inactif au moins 6 heures, conscient de votre environnement.',
'resistance-des-forgeliers':'Résistance au poison et avantage aux sauvegardes contre le poison. Immunité aux maladies ; pas besoin de manger, boire ou respirer, ni de dormir ; la magie ne peut vous endormir.',
'communication-silencieuse-telepathie-a-9-m':'Vous pouvez parler télépathiquement à une créature située à 9 m ou moins qui comprend une langue commune avec vous.',
'affinite-avec-le-trepas':'Avantage aux sauvegardes contre maladie et poison, résistance au poison, avantage aux sauvegardes contre la mort. Aucun besoin de manger, boire, respirer ou dormir ; repos long en 4 heures immobiles en restant conscient.',
'savoir-d-une-vie-anterieure':'Après un test de caractéristique utilisant une compétence, ajoutez 1d6. Bonus de maîtrise utilisations par repos long.',
'gage-irreel':'Détachez une mèche, un ongle ou une dent comme gage. Jusqu’au prochain repos long, communiquez à courte distance par télépathie ou percevez depuis son emplacement selon les limites du trait ; la création du gage se récupère au repos long.',
'langage-des-betes-et-des-feuilles':'Vous pouvez transmettre vos idées à des bêtes, plantes et végétaux ; vous n’obtenez pas leur langage en retour. Avantage aux tests de Charisme pour les influencer.',
'pas-cache':'Action bonus : devenez invisible jusqu’au début de votre prochain tour, ou jusqu’à ce que vous attaquiez, infligiez des dégâts ou forciez une sauvegarde ; bonus de maîtrise utilisations par repos long.',
'main-guerisseuse-bmd4-pv-repos-long':'Action : touchez une créature et restaurez un nombre de d4 PV égal à votre bonus de maîtrise. Une utilisation par repos long.',
'porteur-de-lumiere':'Vous connaissez Lumière, utilisant le Charisme.',
'memoire-de-labyrinthe':'Vous savez toujours où est le nord et avez l’avantage aux tests de Sagesse (Survie) pour naviguer ou suivre une piste.',
'sauts-de-joie':'Lorsque vous sautez, ajoutez 1d8 pieds à la distance, même sans élan ; elle ne peut dépasser votre déplacement disponible.',
'equin':'Capacité de port comme une taille supérieure ; escalader avec mains et pieds coûte 4 pieds de mouvement supplémentaires par pied gravi.',
'machoires-affamees':'Action bonus : faites une attaque de morsure. Si elle touche une créature qui n’est ni artificielle ni morte-vivante, gagnez des PV temporaires égaux au bonus de maîtrise. Bonus de maîtrise utilisations par repos long.',
'cornes-martelantes':'Après avoir touché avec une attaque au corps à corps pendant votre action Attaquer, une action bonus peut repousser une cible d’au plus une taille supérieure, proche de vous, de 3 m sur un échec à une sauvegarde de Force DD 8 + maîtrise + Force.',
};
const items=facts.map(row=>{
 const id=row.sourceId+':race:'+row.slug;
 const data={ruleset:'dnd5e-2014',rulesSourceId:row.sourceId,raceFamilyId:family[row.slug]??row.slug,rulesVersionId:row.slug+'/'+row.sourceId+'-'+(row.sourceId==='motm'?'2022':row.sourceId==='eberron'?'2019':row.sourceId==='scag'?'2015':'2021'),automation:{status:'partial',handler:null,limits:['Situational racial actions require player/GM resolution.']},summary:{fr:'Traits de '+row.name.fr+' et choix raciaux de la version '+row.sourceDocument+'.',en:row.name.en+' racial traits and choices, '+row.sourceDocument+'.'},bonuses:{},languages:['common'],speed:row.speed,size:row.size,subraces:[],skills:[],proficiencies:[],choices:[q('language','language',1,LANGUAGES,'Langue supplémentaire','Additional language')],traits:row.traits.map(fr=>({id:slug(fr),name:{fr,en:fr},description:notes[slug(fr)]??fr,automation:'manual'})),spells:[],auditReference:row.evidence};
 if(row.flexible)data.flexibleAbilityBoosts=true;
 if(row.darkvision)data.traits.push({id:'darkvision',name:{fr:'Vision dans le noir',en:'Darkvision'},description:'Vision dans le noir à '+(row.darkvision*.3)+' m.',automation:'manual'});
 const entry={id,type:'race',name:row.name,source:{kind:'reference',document:row.sourceDocument,license:'Pilot20-original-summary',url:'https://www.aidedd.org/dnd-filters/index.php'},data};
 return entry;
});
const find=slug=>items.find(i=>i.id.endsWith(':'+slug)).data;
const addSkill=(key,n,options)=>find(key).choices.push(skill(n,options));
const resistance=(keys,types)=>{for(const k of keys)find(k).resistances=types;};
resistance(['aasimar'],['necrotic','radiant']);resistance(['genasi-de-l-air'],['lightning']);resistance(['genasi-de-l-eau'],['acid']);resistance(['genasi-du-feu'],['fire']);resistance(['githyanki','githzerai'],['psychic']);resistance(['goliath','triton'],['cold']);resistance(['shadar-kai'],['necrotic']);resistance(['yuan-ti','forgelier','ressuscite','duergar'],['poison']);
for(const k of ['elfe-aquatique','eladrin','shadar-kai'])find(k).skills=['perception'];
find('tabaxi').skills=['perception','stealth'];find('gobelours').skills=['stealth'];find('goliath').skills=['athletics'];find('hiboulin').skills=['stealth'];find('conil').skills=['perception'];find('conil').initiativeProficiency=true;find('satyre').skills=['performance','persuasion'];
addSkill('centaure',1,['animalHandling','medicine','nature','survival']);addSkill('changelin',2,['deception','insight','intimidation','performance','persuasion']);addSkill('kenku',2);addSkill('homme-lezard',2,['animalHandling','nature','perception','stealth','survival']);addSkill('torte',1,['animalHandling','medicine','nature','perception','stealth','survival']);
find('forgelier').bonuses={con:2};find('forgelier').choices.push(q('ability','score',1,ABILITIES.filter(k=>k!=='con'),'Autre caractéristique +1','Other ability +1'),skill(1),q('tool','proficiency',1,TOOL_PROFICIENCIES,'Outil maîtrisé','Tool proficiency'));find('forgelier').armorBonus=1;
find('halfelin-sagespectre').bonuses={dex:2,wis:1};find('halfelin-sagespectre').languages=['common','halfling'];find('halfelin-sagespectre').choices=[];
for(const k of ['fadette','centaure','changelin','satyre'])find(k).creatureType='fey';find('sang-maudit').creatureType='fey';
find('torte').armorProhibited=true;find('torte').naturalArmor={base:17,abilities:[],shieldAllowed:true};find('homme-lezard').naturalArmor={base:13,abilities:['dex'],shieldAllowed:true};
for(const k of ['aarakocra','fadette','hiboulin'])find(k).movementModes={fly:find(k).speed,flyMatchesWalk:true,flightArmorRestricted:true};
for(const k of ['elfe-aquatique','genasi-de-l-eau','homme-lezard','triton'])find(k).movementModes={swim:find(k).speed};find('tabaxi').movementModes={climb:find('tabaxi').speed,climbMatchesWalk:true};
function active(key,match,cost,resource,min=1){const t=find(key).traits.find(t=>t.id.startsWith(match));if(!t)throw Error(key+':'+match);t.activation=action(cost);if(resource)t.resource=resource;t.minimumCharacterLevel=min;}
for(const [key,match,cost,pool,min]of [
 ['aasimar','main-guerisseuse','action',uses()],['aasimar','revelation-celeste','bonus',uses(),3],['conil','pas-chanceux','reaction'],['conil','saut-de-lapin','bonus',uses('pb')],['duergar','magie-duergar','action'],['eladrin','foulee-feerique','bonus',uses('pb')],['feral','changement','bonus',uses('pb')],['firbolg','pas-cache','bonus',uses('pb')],['githyanki','savoir-astral','none'],['gnome-des-profondeurs','camouflage','bonus',uses('pb')],['gobelin','fureur-des-petits','none',uses('pb')],['gobelin','fuite-agile','bonus'],['goliath','endurance-de-la-pierre','reaction',uses('pb')],['hobgobelin','don-feerique','bonus',uses('pb')],['hobgobelin','effet-de-groupe','none',uses('pb')],['homme-lezard','machoires-affamees','bonus',uses('pb')],['kenku','memoire-de-kenku','none',uses('pb')],['minotaure','cornes-martelantes','bonus'],['orc','endurance-implacable','none',uses()],['orc','montee-d-adrenaline','bonus',uses('pb')],['ressuscite','savoir-d-une-vie','none',uses('pb')],['sang-maudit','gage-irreel','action',uses()],['shadar-kai','benediction','bonus',uses('pb')],['torte','carapace','action']])active(key,match,cost,pool,min);
find('aasimar').choices.push(q('revelation','ancestry-option',1,['necrotic-shroud','radiant-consumption','radiant-soul'],'Révélation céleste','Celestial Revelation'));find('aasimar').choices.at(-1).minimumCharacterLevel=3;
find('eladrin').choices.push(q('season','ancestry-option',1,['autumn','winter','spring','summer'],'Saison','Season'));
find('feral').choices.push(q('form','ancestry-option',1,['beasthide','longtooth','swiftstride','wildhunt'],'Forme du changement','Shifting form'),q('instinct','skill',1,['acrobatics','athletics','intimidation','survival'],'Instinct bestial','Bestial instinct'));
for(const k of ['ressuscite','sang-maudit'])addSkill(k,2);
find('githyanki').choices.push(skill(1),q('astral-training','proficiency',1,[...TOOL_PROFICIENCIES,...new Set(Object.values(WEAPONS).map(w=>w.proficiency))],'Savoir astral — arme ou outil','Astral Knowledge — weapon or tool'));
find('satyre').choices.push(q('instrument','proficiency',1,['bagpipes','drum','dulcimer','flute','lute','lyre','horn','pan-flute','shawm','viol'],'Instrument maîtrisé','Musical instrument'));
function spell(key,en,level,ability='choice'){
 const ref=refs.find(r=>r.name.en===en);if(!ref)throw Error('Missing spell '+en);
 const d=find(key);if(ability==='choice'&&!d.choices.some(q=>q.key==='spell-ability'))d.choices.push(q('spell-ability','ancestry-option',1,['int','wis','cha'],'Caractéristique des sorts raciaux','Racial spellcasting ability'));
 d.spells.push({id:ref.id,level,ability:ability==='choice'?null:ability,...(ability==='choice'?{abilityChoiceKey:'spell-ability'}:{}),...(ref.level>0?{racialUses:{max:1,recovery:'long'},requirements:'Une utilisation gratuite par repos long ; incantation avec vos emplacements également permise par cette version.'}:{})});
}
for(const [key,rows,ability]of [
 ['aarakocra',[['Gust of Wind',3]],'choice'],['aasimar',[['Light',1]],'cha'],['duergar',[['Enlarge/Reduce',3],['Invisibility',5]],'choice'],['fadette',[['Druidcraft',1],['Faerie Fire',3],['Enlarge/Reduce',5]],'choice'],['firbolg',[['Detect Magic',1],['Disguise Self',1]],'choice'],['genasi-de-l-air',[['Shocking Grasp',1],['Feather Fall',3],['Levitate',5]],'choice'],['genasi-de-l-eau',[['Acid Splash',1],['Create or Destroy Water',3],['Water Walk',5]],'choice'],['genasi-du-feu',[['Produce Flame',1],['Burning Hands',3],['Flame Blade',5]],'choice'],['genasi-de-la-terre',[['Blade Ward',1],['Pass without Trace',5]],'choice'],['githyanki',[['Mage Hand',1],['Jump',3],['Misty Step',5]],'choice'],['githzerai',[['Mage Hand',1],['Shield',3],['Detect Thoughts',5]],'choice'],['gnome-des-profondeurs',[['Disguise Self',3],['Nondetection',5]],'choice'],['sang-maudit',[['Disguise Self',1],['Hex',1]],'choice'],['triton',[['Fog Cloud',1],['Gust of Wind',3],['Water Walk',5]],'choice'],['yuan-ti',[['Poison Spray',1],['Animal Friendship',1],['Suggestion',3]],'choice'],
])for(const [en,level]of rows)spell(key,en,level,ability);
// MotM casting is spell-specific; these limits remain visible next to the grants.
find('yuan-ti').spells.find(s=>refs.find(r=>r.id===s.id)?.name.en==='Animal Friendship').racialUses=null;
find('yuan-ti').spells.find(s=>refs.find(r=>r.id===s.id)?.name.en==='Animal Friendship').requirements='À volonté, uniquement sur les serpents.';
find('sang-maudit').spells.forEach(s=>{s.racialPool='hexblood-magic';s.requirements='Une seule incantation gratuite par repos long, partagée entre Déguisement et Maléfice ; emplacements également utilisables.';});
export const extendedRaces={kind:'catalog',schemaVersion:3,ruleset:'dnd5e-2014',id:'pilot20:audited-races-2014',items};
// Human variant uses actual feat definitions and their existing prerequisite engine.
items.push({id:'phb14:race:variant-human',type:'race',name:{fr:'Humain (don)',en:'Variant Human'},source:{kind:'reference',document:'Player’s Handbook 2014',license:'Pilot20-original-summary',url:'https://www.aidedd.org/dnd-filters/index.php'},data:{ruleset:'dnd5e-2014',rulesSourceId:'phb14',raceFamilyId:'humain',rulesVersionId:'humain/variante-2014',automation:{status:'partial',handler:null,limits:['Feat combat effects retain their declared coverage.']},bonuses:{},languages:['common'],speed:30,size:'medium',subraces:[],choices:[q('language','language',1,LANGUAGES,'Langue supplémentaire','Additional language'),q('abilities','score',2,ABILITIES,'Deux caractéristiques distinctes +1','Two different abilities +1'),skill(1),q('feat','feat',1,[],'Don racial','Racial feat')],traits:[]}});

// Conditional transformations remain actions; their temporary bonuses never become permanent stats.
function describe(key,match,description){const t=find(key).traits.find(t=>t.id.startsWith(match));if(!t)throw Error(key+':'+match);t.description=description;}
describe('aasimar','revelation-celeste','À partir du niveau3, une action bonus révèle votre nature céleste pendant1 minute ; une fois par repos long. Une fois par tour, une attaque ou un sort infligeant des dégâts peut ajouter votre bonus de maîtrise en dégâts nécrotiques (Voile) ou radiants (autres révélations). Âme radiante donne le vol à votre vitesse de marche. Lumière radiante éclaire et inflige le bonus de maîtrise en dégâts radiants aux autres créatures à 3 m à la fin de votre tour. Voile nécrotique peut effrayer les créatures visibles à3 m sur sauvegarde de Charisme DD8+maîtrise+Charisme.');
describe('eladrin','foulee-feerique','Action bonus : téléportez-vous jusqu’à9 m vers un espace inoccupé visible. Bonus de maîtrise utilisations par repos long. À partir du niveau3, la saison ajoute son effet : Automne charme jusqu’à deux créatures proches, Hiver peut en effrayer une, Printemps peut téléporter un allié touché à votre place, Été peut infliger votre bonus de maîtrise en dégâts de feu à des créatures proches de votre arrivée. Les sauvegardes utilisent Intelligence, Sagesse ou Charisme, au choix à la création.');
find('eladrin').choices.push(q('season-ability','ancestry-option',1,['int','wis','cha'],'Caractéristique de la Foulée féerique','Fey Step ability'));
describe('shadar-kai','benediction','Action bonus : téléportez-vous jusqu’à9 m vers un espace inoccupé visible. Bonus de maîtrise utilisations par repos long. À partir du niveau3, vous gagnez la résistance à tous les dégâts jusqu’au début de votre prochain tour.');
describe('feral','changement','Action bonus : changez de forme pendant1 minute ou jusqu’à votre mort, ou interrompez-la par une action bonus. Gagnez des PV temporaires égaux à deux fois votre bonus de maîtrise et le bénéfice de votre forme choisie. Bonus de maîtrise utilisations par repos long.');
for(const [id,fr,description]of [
 ['beasthide','Peau de bête','Pendant le changement, gagnez1d6 PV temporaires supplémentaires et+1 à la CA.'],
 ['longtooth','Longues dents','Lors de la transformation puis comme action bonus pendant le changement, vous pouvez attaquer avec vos crocs :1d6+Force dégâts perforants.'],
 ['swiftstride','Longue foulée','Pendant le changement,+3 m à la vitesse de marche. Réaction : lorsqu’une créature finit son tour à1,50 m de vous, déplacez-vous jusqu’à3 m sans provoquer d’attaque d’opportunité.'],
 ['wildhunt','Traque sauvage','Pendant le changement, avantage aux tests de Sagesse. Les créatures à9 m ou moins ne peuvent avoir l’avantage aux attaques contre vous, sauf si vous êtes neutralisé.']])find('feral').traits.push({id:'form-'+id,name:{fr,en:fr},description,requiresChoice:{key:'form',optionId:id},automation:'manual'});
describe('hobgobelin','don-feerique','Action bonus : Aider. Bonus de maîtrise utilisations par repos long. À partir du niveau3, choisissez Hospitalité (1d6+maîtrise PV temporaires pour vous et la créature aidée), Passage (+3 m à vos vitesses jusqu’au début de votre prochain tour) ou Rancune (si l’allié touche, la cible a le désavantage à sa prochaine attaque dans la minute).');
describe('hobgobelin','effet-de-groupe','Après avoir raté une attaque, un test de caractéristique ou une sauvegarde, ajoutez le nombre d’alliés visibles à9 m, au maximum+3. Bonus de maîtrise utilisations par repos long.');
describe('gnome-des-profondeurs','camouflage','Action bonus : avantage aux tests de Dextérité (Discrétion) pendant1 minute. Bonus de maîtrise utilisations par repos long.');
describe('githzerai','discipline-mentale','Avantage aux sauvegardes pour éviter ou terminer les états charmé et effrayé.');
describe('duergar','vigueur-psionique','Avantage aux sauvegardes pour éviter ou terminer les états charmé et étourdi.');
describe('goliath','endurance-de-la-pierre','Réaction lorsque vous subissez des dégâts : réduisez-les de1d12+modificateur de Constitution. Bonus de maîtrise utilisations par repos long.');
find('genasi-de-la-terre').traits.push({id:'quick-blade-ward',name:{fr:'Garde de la terre',en:'Quick Blade Ward'},description:'Vous pouvez lancer Protection contre les armes par une action bonus, un nombre de fois égal au bonus de maîtrise par repos long. L’incantation normale par une action reste possible sans utiliser cette réserve.',activation:action('bonus'),resource:uses('pb'),automation:'manual'});

describe('centaure','charge','Après avoir parcouru au moins9 m en ligne droite vers une créature et l’avoir touchée avec une attaque d’arme au corps à corps ce tour, vous pouvez faire une attaque de sabots contre elle par une action bonus.');
describe('minotaure','charge','Après l’action Foncer et un déplacement d’au moins6 m ce tour, vous pouvez faire une attaque de cornes par une action bonus.');
active('centaure','charge','bonus');active('minotaure','charge','bonus');
for(const k of ['eladrin','elfe-aquatique','shadar-kai'])find(k).choices.push(q('trance-training','proficiency',2,[...TOOL_PROFICIENCIES,...new Set(Object.values(WEAPONS).map(w=>w.proficiency))],'Transe — deux armes ou outils','Trance — two weapons or tools'));
