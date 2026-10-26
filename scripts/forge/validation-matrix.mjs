import fs from 'node:fs';
import assert from 'node:assert/strict';
import {instanceOf,newAbility} from '../../src/forge/model.js';
import {itemSource,resolvePassive} from '../../src/forge/engine.js';
import {compileCapability,simulateCapability,weaponCapability} from '../../src/forge/automation.js';
import {diceSpec} from '../../src/model.js';
const items=JSON.parse(fs.readFileSync('src/forge/catalog/compagnie-creole.items.json'));
const rows=[];
const scores={str:10,dex:10,con:10,int:10,wis:10,cha:10};
for(const d of items){
 const i={...instanceOf(d,'source'),equipped:true,attuned:true};
 const prefix={owner:d.ownerLabel,item:d.name.fr,definitionId:d.id,version:d.version,source:d.provenance};
 const record=(r)=>rows.push({...prefix,...r});
 for(const [mode,effects] of [['',d.effects],...d.modes.map(m=>[m.id,m.effects])])for(const e of effects){
  const instance={...i,modeIds:mode?[mode]:[]};
  const isolated={...d,effects:[{...e,modeId:null}],modes:[]};instance.modeIds=[];
  const source=itemSource(isolated,instance,{scores,event:e.trigger});
  const out=resolvePassive([source],{scores});
  let expected=null,observed=null;
  if(e.templateId==='p20:effect:modifier'&&e.params.operation==='add'&&!e.duration&&!e.save){const p=e.params;expected=p.value;observed=out.bonuses[p.stat+':'+p.scope+(p.scope==='this-weapon'?':'+i.instanceId:'')];}
  if(e.templateId==='p20:effect:ability-score'&&e.params.operation==='floor'){expected=Math.max(10,e.params.value);observed=out.scores[e.params.ability];}
  if(e.templateId==='p20:effect:defense'&&e.params.kind==='resistance'&&!e.params.condition){expected=true;observed=out.resistances.includes(e.params.damageType);}
  const passed=expected!==null&&observed===expected;
  if(expected!==null)assert.equal(observed,expected,d.name.fr+' '+e.id);
  record({capability:(mode?mode+' / ':'')+e.id,expected:expected??e.params,calculated:passed?observed:null,observed:passed?observed:'Non exécuté dans ce scénario',status:passed?'Automatique (contribution passive isolée)':'Partiellement automatisé',blockers:passed?[]:source.pending.concat(out.pending).map(x=>x.reason),scope:'Contexte équipé et harmonisé synthétique ; aucune fiche modifiée'});
 }
 for(const a of d.abilities){
  const diagnostic=compileCapability(d,a,{instance:i});
  const effectRolls={};for(const [index,e]of diagnostic.ability.effects.entries())try{const spec=diceSpec(e.dice);effectRolls[index]=Array(spec.count).fill(1);}catch{}
  const result=simulateCapability(d,a,{instance:i,effectRolls,saveRoll:1,attackRoll:10});
  let expected=null;
  if(a.effects.length===1&&a.effects[0].templateId==='p20:effect:damage'&&!a.effects[0].conditions.length&&!a.effects[0].duration){try{const n=diceSpec(a.effects[0].params.dice);expected=n.count+n.bonus;}catch{}}
  const observed=result.result?.results?.[0]?.damage??null;
  if(expected!==null&&diagnostic.status==='automatic')assert.equal(observed,expected);
  record({capability:a.name.fr,expected:expected??a.effects.map(e=>e.params),calculated:diagnostic.missing.length?null:diagnostic.ability,observed:result.timeline,status:diagnostic.label,blockers:[...diagnostic.missing,...diagnostic.limitations],scope:'Dés fixés à 1 ; cible CA15 / sauvegarde 1 ; moteur execute réel'});
 }
 if(!d.effects.length&&!d.abilities.length&&!d.modes.length)record({capability:'Propriétés à documenter',expected:d.description.fr,calculated:null,observed:'Aucune mécanique inventée',status:'À compléter',blockers:d.unknowns,scope:'Inventaire documentaire'});
}
// Concrete numerical regression examples independent of JSON conformance.
const pyro=items.find(d=>d.name.fr==='PyroMerlin'),breath=pyro.abilities.find(a=>a.id==='souffle');
for(const [name,opts,expected] of [['Échec',{},18],['Réussite',{saveRoll:20},9],['Résistance',{resistances:['fire']},9],['Réussite + résistance',{saveRoll:20,resistances:['fire']},4]]){
 const out=simulateCapability(pyro,breath,{...opts,effectRolls:{0:[3,3,3,3,3,3]}});assert.equal(out.result.results[0].damage,expected);
 rows.push({owner:'Brack',item:'PyroMerlin',capability:'Souffle / '+name,expected,calculated:expected,observed:out.result.results[0].damage,status:'Partiellement automatisé',blockers:out.diagnostic.limitations,scope:'Résolution réelle sur une cible sélectionnée ; géométrie non résolue'});
}
fs.mkdirSync('docs/forge/validation',{recursive:true});fs.writeFileSync('docs/forge/validation/cc-matrix.json',JSON.stringify({generatedAt:'2026-10-26',itemCount:items.length,scenarioCount:rows.length,rows},null,2)+'\n');
const cell=v=>JSON.stringify(v??'—').replaceAll('|','/').replaceAll('\n',' ');
fs.writeFileSync('docs/forge/validation/CC-MATRIX.md','# Matrice exécutée des objets CC\n\n'+items.length+' objets/références, '+rows.length+' lignes. Les contributions isolées ne certifient pas l’automatisation de l’objet entier. Aucun scénario narratif n’est présenté comme exécuté.\n\n| Porteur | Objet / capacité | Attendu | Calculé | Observé | Statut | Blocage |\n|---|---|---|---|---|---|---|\n'+rows.map(r=>`| ${r.owner} | ${r.item} / ${r.capability} | ${cell(r.expected)} | ${cell(typeof r.calculated==='object'&&r.calculated!==null?'Contrat de combat dans cc-matrix.json':r.calculated)} | ${cell(r.observed)} | ${r.status} | ${cell(r.blockers)} |`).join('\n')+'\n');
console.log(`${items.length} objets, ${rows.length} résultats consignés ; contrôles numériques réussis.`);
