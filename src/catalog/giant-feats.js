/** The eight 2014-compatible AideDD/Bigby feats. Texts are original summaries.
 * Runtime combat effects stay manual; acquisition, prerequisites, scores,
 * passive resistances, rune choices and limited-use resources are structured.
 */
const source={kind:'reference',document:'Bigby Presents: Glory of the Giants (2023) — options D&D 5e 2014',license:'Pilot20-original-summary',url:'https://www.dndbeyond.com/sources/dnd/gotg'};
const automation={status:'partial',handler:null,limits:['Temporary effects, hit triggers and saving throws require the player/GM or Encounter. No automatic damage roll is implied.']};
const feat=(key,fr,en,description,data={})=>({id:'bgg:feat:'+key,type:'feat',name:{fr,en},source,data:{ruleset:'dnd5e-2014',rulesSourceId:'bgg',description,language:'fr',automation,...data}});
const afterStrike=(type)=>({minimumCharacterLevel:4,giantStrike:type});
const ability=['str','con','wis'];
const power=(key,fr,en,description,giant,{resistances=[],limited=true}={})=>feat(key,fr,en,description,{
 abilityOptions:ability,requirements:afterStrike(giant),
 ...(resistances.length?{buildEffects:{resistances}}:{}),
 ...(limited?{featResource:{maximum:'proficiency',recovery:'long'}}:{})
});
export const giantFeats={kind:'catalog',schemaVersion:3,ruleset:'dnd5e-2014',id:'pilot20:giants-feats-2014',items:[
 feat('strike-of-the-giants','Frappe des géants','Strike of the Giants',
 'Maîtrise d’une arme de guerre ou historique Gigantin. Choisissez un type de frappe : Nuages (+1d4 tonnerre, sauvegarde de Sagesse ou invisibilité à cette cible), Feu (+1d10 feu), Givre (+1d6 froid, sauvegarde de Constitution ou vitesse 0), Collines (+1d6 du type de l’arme, sauvegarde de Force ou à terre), Pierres (+1d6 force, sauvegarde de Force ou repoussement 3 m), Tempêtes (+1d6 foudre, sauvegarde de Constitution ou désavantage aux attaques). DD = 8 + BM + modificateur de Force ou Constitution. Une fois par tour après une attaque d’arme de mêlée ou une attaque d’arme à distance avec une arme de jet réussie ; utilisations égales au bonus de maîtrise par repos long.',{
  requirements:{martialWeapon:true,backgroundNames:['Giant Foundling']},
  giantStrikeChoices:['cloud','fire','frost','hill','stone','storm'],
  featResource:{maximum:'proficiency',recovery:'long'},
  aliases:['Impact des géants'],
 }),
 feat('rune-shaper','Façonneur de runes','Rune Shaper',
 'Requiert Incantation ou l’historique Ciseleur de runes. Apprenez Compréhension des langues et choisissez un nombre de runes égal à la moitié du bonus de maîtrise (arrondi à l’inférieur). Après un repos long, chaque rune peut être inscrite sur un objet non magique et donne accès à un sort de niveau 1, lançable sans emplacement une fois par repos long ou avec vos emplacements.',{
  requirements:{casting:true,backgroundNames:['Rune Carver']},runeShaper:true,
  aliases:['Rune Shaper','Tailleur de runes'],
 }),
 power('ember-of-the-fire-giant','Braises du géant du feu','Ember of the Fire Giant',
 '+1 en Force, Constitution ou Sagesse (max. 20) ; résistance permanente au feu. Une attaque de l’action Attaquer peut être remplacée par une explosion proche : sauvegarde de Dextérité, dégâts de feu et aveuglement temporaire en cas d’échec. Utilisations égales au bonus de maîtrise par repos long.',
 'fire',{resistances:['fire']}),
 power('fury-of-the-frost-giant','Fureur du géant du givre','Fury of the Frost Giant',
 '+1 en Force, Constitution ou Sagesse (max. 20) ; résistance permanente au froid. Réaction après des dégâts subis d’une créature proche : sauvegarde de Constitution, dégâts de froid et immobilisation temporaire sur échec. Utilisations par repos long égales au bonus de maîtrise.',
 'frost',{resistances:['cold']}),
 power('guile-of-the-cloud-giant','Ruse du géant des nuages','Guile of the Cloud Giant',
 '+1 en Force, Constitution ou Sagesse (max. 20). Réaction lorsque vous êtes touché : résistance aux dégâts de cette attaque puis téléportation dans un espace visible à 9 m. Utilisations égales au bonus de maîtrise par repos long.',
 'cloud'),
 power('keenness-of-the-stone-giant','Adresse du géant des pierres','Keenness of the Stone Giant',
 '+1 en Force, Constitution ou Sagesse (max. 20) ; vision dans le noir sur 18 m ou portée augmentée si déjà possédée. En action bonus, jet d’attaque magique de pierre à distance (18 m) : 1d10 force et sauvegarde de Force contre la chute à terre. Utilisations par repos long égales au bonus de maîtrise.',
 'stone',{resistances:[]}),
 power('soul-of-the-storm-giant','Âme du géant des tempêtes','Soul of the Storm Giant',
 '+1 en Force, Constitution ou Sagesse (max. 20) ; résistances permanentes à la foudre et au tonnerre. Action bonus : aura temporaire limitant la vitesse des adversaires et leur imposant le désavantage aux attaques contre vous. Utilisations égales au bonus de maîtrise par repos long.',
 'storm',{resistances:['lightning','thunder']}),
 power('vigor-of-the-hill-giant','Vigueur du géant des collines','Vigor of the Hill Giant',
 '+1 en Force, Constitution ou Sagesse (max. 20) ; vous résistez mieux aux effets qui cherchent à vous mettre à terre. Lors d’un repos court, chaque dé de vie dépensé restaure un bonus de points de vie égal au modificateur de Constitution + votre bonus de maîtrise.',
 'hill',{limited:false}),
]};