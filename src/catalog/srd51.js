/** Minimal transformed mechanical data; attribution in docs/CONTENT-LICENSES.md. */
export const SRD={kind:'srd',document:'SRD-5.1',license:'CC-BY-4.0',url:'https://www.dndbeyond.com/srd'};
export const HOMEBREW={kind:'homebrew',document:'Pilot20 synthetic regression cases',license:'project-test-data',url:''};
export const catalog={kind:'catalog',schemaVersion:2,ruleset:'dnd5e-2014',id:'pilot20:srd51-minimal',items:[
  {id:'srd51:longsword',type:'weapon',name:{en:'Longsword',fr:'Épée longue'},source:SRD,data:{dice:'1d8',damageType:'slashing'}},
  {id:'srd51:chain-mail',type:'armor',name:{en:'Chain mail',fr:'Cotte de mailles'},source:SRD,data:{base:16,dexCap:0,minStrength:13}},
  {id:'srd51:fire-bolt',type:'spell',name:{en:'Fire Bolt',fr:'Trait de feu'},source:SRD,data:{level:0,damageType:'fire',attack:true}}
]};
// Deliberately no non-SRD subclass/race text and no import of historical Companion catalogs.
