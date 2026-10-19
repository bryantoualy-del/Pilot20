import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionName } from '../web/app/editor.js';
import { decisionReady } from '../src/creator/single-path.js';
import { POINT_COST } from '../src/catalog/origins.js';

const translations={
  fr:{'alchemist-supplies':'Matériel d’alchimiste','brewer-supplies':'Matériel de brasseur','calligrapher-supplies':'Matériel de calligraphe','carpenter-tools':'Outils de charpentier','cartographer-tools':'Outils de cartographe','cobbler-tools':'Outils de cordonnier','cook-utensils':'Ustensiles de cuisinier','smith-tools':'Outils de forgeron'},
  en:{'alchemist-supplies':'Alchemist’s supplies','brewer-supplies':'Brewer’s supplies','cook-utensils':'Cook’s utensils'}
};
function context(locale){
  return {state:{locale},context:{installed:new Map(),index:{class:()=>null}},label:k=>k,cls:k=>k};
}
test('les outils historiques au singulier sont traduits en français, sans changer leurs identifiants',()=>{
  for(const [id,label] of Object.entries(translations.fr))assert.equal(optionName(id,context('fr')),label,id);
  assert.equal(optionName('Alchemist supplies',context('fr')),'Matériel d’alchimiste');
  assert.equal(optionName('brewers-supplies',context('fr')),'Matériel de brasseur');
});
test('les mêmes outils restent anglais lorsque la langue anglaise est sélectionnée',()=>{
  for(const [id,label] of Object.entries(translations.en))assert.equal(optionName(id,context('en')),label,id);
});
test('le parcours impose 27 points en achat de points sans modifier la règle du tableau standard',()=>{
  const report={issues:[],origin:{choices:[]}};
  const draft=scores=>({scores,scoreMethod:'point-buy',scoreRolls:null});
  const complete={str:15,dex:14,con:13,int:12,wis:10,cha:8};
  const incomplete={...complete,wis:9};
  const tooMuch={...complete,cha:9};
  assert.equal(Object.values(complete).reduce((n,v)=>n+POINT_COST[v],0),27);
  assert.equal(decisionReady({kind:'scores'},report,draft(incomplete)),false);
  assert.equal(decisionReady({kind:'scores'},report,draft(complete)),true);
  assert.equal(decisionReady({kind:'scores'},report,draft(tooMuch)),false);
  assert.equal(decisionReady({kind:'scores'},report,{...draft(complete),scoreMethod:'standard'}),true);
});
