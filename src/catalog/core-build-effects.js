/** Construction effects from the SRD 5.1 feature definitions, separate from combat state. */
export const CORE_BUILD_EFFECTS={
 'srd51:barbarian:primal-champion':{scoreIncreases:{str:{amount:4,maximum:24},con:{amount:4,maximum:24}}},
 'srd51:draconic-bloodline:draconic-resilience':{hpPerClassLevel:1,naturalArmor:{base:13,abilities:['dex'],shieldAllowed:true}},
 'srd51:bard:jack-of-all-trades':{halfProficiency:'all'},
 'srd51:champion:remarkable-athlete':{halfProficiency:'physical'},
 ...Object.fromEntries(['fighter','paladin','ranger'].map(cls=>['srd51:'+cls+':defense',{defenseStyle:true}])),
 ...Object.fromEntries(['fighter','ranger'].map(cls=>['srd51:'+cls+':archery',{rangedWeaponAttackBonus:2}])),
};
export const CORE_FRENCH={
 'srd51:barbarian:primal-champion':['Champion primitif','Au niveau20 de barbare, Force et Constitution augmentent de4, avec un maximum de24 pour ces valeurs. Ce gain s’ajoute après les améliorations de caractéristiques ordinaires.'],
 'srd51:draconic-bloodline:draconic-resilience':['Résistance draconique','Votre maximum de PV augmente de1 par niveau d’ensorceleur. Sans armure portée, votre CA peut être13+Dextérité. Ce calcul ne s’additionne pas à un autre calcul de base de CA.'],
 'srd51:bard:jack-of-all-trades':['Touche-à-tout','Ajoutez la moitié du bonus de maîtrise, arrondie à l’inférieur, aux tests de caractéristique qui ne bénéficient pas déjà de ce bonus. Cela inclut normalement l’initiative, mais pas les sauvegardes.'],
 'srd51:champion:remarkable-athlete':['Athlète remarquable','Ajoutez la moitié du bonus de maîtrise, arrondie au supérieur, aux tests de Force, Dextérité ou Constitution qui ne bénéficient pas déjà de la maîtrise. Les sauts en longueur avec élan gagnent aussi une distance en pieds égale au modificateur de Force.'],
 ...Object.fromEntries(['fighter','paladin','ranger'].map(cls=>['srd51:'+cls+':defense',['Défense','Votre CA augmente de1 lorsque vous portez une armure. Un bouclier seul ne suffit pas.'] ])),
 ...Object.fromEntries(['fighter','ranger'].map(cls=>['srd51:'+cls+':archery',['Archerie','Vous gagnez+2 aux jets d’attaque effectués avec des armes à distance. Ce bonus ne s’ajoute pas aux dégâts et ne transforme pas une arme de mêlée lancée en arme à distance.'] ])),
};
export const DRAGON_ANCESTRY=[['black','Noir','acid','acide'],['blue','Bleu','lightning','foudre'],['brass','Airain','fire','feu'],['bronze','Bronze','lightning','foudre'],['copper','Cuivre','acid','acide'],['gold','Or','fire','feu'],['green','Vert','poison','poison'],['red','Rouge','fire','feu'],['silver','Argent','cold','froid'],['white','Blanc','cold','froid']];
CORE_BUILD_EFFECTS['srd51:draconic-bloodline:dragon-ancestor']={proficiencies:['language:draconic']};
CORE_FRENCH['srd51:draconic-bloodline:dragon-ancestor']=['Ancêtre draconique','Choisissez votre dragon ancestral et son type de dégâts. Vous connaissez le draconique. Lors d’un test de Charisme avec des dragons, doublez la maîtrise si ce test en bénéficie déjà. Le choix ne vous accorde pas de résistance permanente.'];

for(const cls of ['fighter','paladin','ranger'])for(const [key,fr,note]of [
 ['dueling','Duel','Avec une seule arme de mêlée tenue dans une main et aucune autre arme tenue, ajoutez2 à ses jets de dégâts. Un bouclier n’est pas une autre arme.'],
 ['two-weapon-fighting','Combat à deux armes','Pour l’attaque supplémentaire du combat à deux armes, vous pouvez ajouter votre modificateur de caractéristique aux dégâts. Les autres conditions du combat à deux armes restent nécessaires.'],
 ['great-weapon-fighting','Armes à deux mains','Avec une arme de mêlée tenue à deux mains et ayant la propriété à deux mains ou polyvalente, relancez une fois chaque dé de dégâts d’arme donnant1 ou2 ; utilisez le nouveau résultat.'],
 ['protection','Protection','Réaction quand une autre cible à1,50 m de vous est attaquée par une créature visible : imposez le désavantage à cette attaque. Vous devez manier un bouclier.'],
])if((cls==='fighter')||(cls==='paladin'&&key!=='two-weapon-fighting')||(cls==='ranger'&&['dueling','two-weapon-fighting'].includes(key)))CORE_FRENCH['srd51:'+cls+':'+key]=[fr,note];
