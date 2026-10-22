import {el,button} from './dom.js';
import {readableText} from '../../src/catalog/readable-text.js';
import {optionName} from './editor.js';

/** A single disclosure keeps search inside the chooser and the selected feat visible. */
export function featPicker(ids,selected,a,onSelect){
 const w=(fr,en)=>a.state.locale==='fr'?fr:en;
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const root=el('details',{class:'feat-picker'}),summary=el('summary',{'aria-label':w('Choisir un don','Choose a feat')},selected?optionName(selected,a):w('Choisir un don','Choose a feat'));
 const results=el('div',{class:'feat-picker-results','aria-label':w('Dons disponibles','Available feats')});
 const search=el('input',{type:'search','aria-label':w('Rechercher un don','Search feats'),placeholder:w('Rechercher un don…','Search feats…'),oninput:refresh});
 function refresh(){
  const query=normalize(search.value);
  const matches=ids.filter(id=>{const f=a.context.index.get(id);return normalize([...Object.values(f?.name??{}),...(f?.data.aliases??[])].join(' ')).includes(query);});
  results.replaceChildren(...matches.map(id=>button(optionName(id,a),()=>{root.open=false;summary.textContent=optionName(id,a);summary.focus();onSelect(id);},id===selected?'selected':'')));
  if(!matches.length)results.append(el('p',{role:'status'},w('Aucun don correspondant.','No matching feats.')));
 }
 root.addEventListener('keydown',e=>{
  if(e.key==='Escape'){root.open=false;summary.focus();e.preventDefault();}
  if(root.open&&['ArrowDown','ArrowUp'].includes(e.key)){
   const items=[search,...results.querySelectorAll('button')],at=items.indexOf(document.activeElement);
   items[Math.max(0,Math.min(items.length-1,at+(e.key==='ArrowDown'?1:-1)))]?.focus();e.preventDefault();
  }
 });
 root.append(summary,el('div',{class:'feat-picker-panel'},search,results));refresh();return root;
}

export function featPreview(entry,a,choices=[]){
 const w=(fr,en)=>a.state.locale==='fr'?fr:en,d=entry.data,r=d.requirements??{};
 const description=readableText(a.state.locale==='en'?(d.descriptionEn??d.description):d.description??'');
 const requirements=[...(d.requiresScores??[]),...(r.scores??[])].map(p=>a.label(p.score)+' ≥ '+p.minimum);
 if(r.scoreAny)requirements.push(r.scoreAny.map(p=>a.label(p.score)+' ≥ '+p.minimum).join(w(' ou ',' or ')));
 if(r.minimumCharacterLevel)requirements.push(w('Niveau ','Level ')+r.minimumCharacterLevel);
 if(r.armor)requirements.push(optionName(r.armor,a));
 if(r.casting||r.classCasting)requirements.push(w('Capacité de lancer des sorts','Spellcasting ability'));
 if(r.martialWeapon)requirements.push(w('Maîtrise d’une arme de guerre','Martial weapon proficiency'));
 if(r.raceFamilies)requirements.push(r.raceFamilies.map(id=>optionName(id,a)).join(' / '));
 if(r.subraceTokens)requirements.push(r.subraceTokens.map(id=>optionName(id,a)).join(' / '));
 if(r.smallOrDwarf)requirements.push(w('Petite taille ou nain','Small size or dwarf'));
 if(r.giantStrike)requirements.push(w('Frappe des géants : ','Strike of the Giants: ')+optionName(r.giantStrike,a));
 const points=description.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý+])/u).filter(Boolean);
 return el('section',{class:'background-preview feat-preview','aria-label':w('Avantages du don','Feat benefits')},
  el('h2',{},a.name(entry)),
  requirements.length?el('p',{},el('strong',{},w('Prérequis : ','Prerequisites: ')),requirements.join(' · ')):null,
  el('ul',{class:'feat-effects'},points.map(p=>el('li',{},p))),
  ...choices,
  el('details',{},el('summary',{},w('Détail du don','Feat details')),el('p',{class:'entry-description'},description),
   ...(d.draconicCapabilities??[]).map(c=>el('div',{},el('h3',{},c.name[a.state.locale]),el('p',{},readableText(c.summary)),el('p',{},w('Utilisations : ','Uses: ')+(c.maximum==='proficiency'?w('bonus de maîtrise','proficiency bonus'):c.maximum)+w(' par repos long.',' per long rest.'))))));
}
