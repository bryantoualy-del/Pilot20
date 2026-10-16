/** Registry is code-owned. Packs may describe, never register, an executor. */
export const HANDLERS=Object.freeze({
 'spell-attack':['srd51:fire-bolt','srd51:ray-of-frost','srd51:shocking-grasp'],
 'spell-save':['srd51:sacred-flame','srd51:acid-splash','srd51:fireball','srd51:lightning-bolt','srd51:burning-hands'],
 'spell-heal':['srd51:cure-wounds','srd51:healing-word','srd51:mass-healing-word','srd51:mass-cure-wounds'],
 'spell-temp-hp':['srd51:false-life'],haste:['srd51:haste'],shield:['srd51:shield'],counterspell:['srd51:counterspell'],
 'second-wind':['srd51:fighter:second-wind'],'action-surge':['srd51:fighter:action-surge'],'extra-attack':['srd51:fighter:extra-attack'],
 'sneak-attack':['srd51:rogue:sneak-attack'],'uncanny-dodge':['srd51:rogue:uncanny-dodge'],
 'divine-smite':['srd51:paladin:divine-smite'],'lay-on-hands':['srd51:paladin:lay-on-hands'],rage:['srd51:barbarian:rage'],
 'bardic-inspiration':['srd51:bard:bardic-inspiration'],quickened:['srd51:sorcerer:quickened-spell'],heightened:['srd51:sorcerer:heightened-spell']
});
