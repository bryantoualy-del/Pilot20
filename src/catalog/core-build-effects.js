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
