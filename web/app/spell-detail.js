import {subclassSummary} from '../../src/catalog/subclass-summaries.js';
import {readableText} from '../../src/catalog/readable-text.js';
import {el} from './dom.js';
import {spellTerms} from '../../src/catalog/localization.js';
import {spellReference} from '../../src/catalog/spell-reference.js';
import {spellNotesFr} from '../../src/catalog/spell-notes-fr.js';
export function showEntryDetails(entry,a){
 if(!entry)return;
 const w=(fr,en)=>a.state.locale==='fr'?fr:en,data=entry.data,body=el('section',{},el('h2',{},a.name(entry)));
 if(entry.type==='spell'){
  const terms=spellTerms(entry,a.state.locale);
  body.append(el('dl',{class:'spell-facts'},...['level','school','castingTime','range','duration','components'].flatMap(k=>[el('dt',{},el('strong',{},a.t(k))),el('dd',{},terms[k])])),...(data.concentration?[el('p',{},a.t('concentration'))]:[]),...(data.ritual?[el('p',{},a.t('ritual'))]:[]));
 }
 if(entry.type==='subclass'){const features=(data.grants??[]).flatMap(row=>row.featureIds.map(id=>({level:row.level,entry:a.context.index.get(id)}))).filter(x=>x.entry);body.append(el('p',{},subclassSummary(entry,a.state.locale)??''),el('details',{},el('summary',{},w('Capacités par niveau','Features by level')),features.map(x=>el('div',{},el('strong',{},a.t('level')+' '+x.level+' · '+a.name(x.entry)),el('p',{class:'entry-description'},readableText(a.state.locale==='en'?(x.entry.data.descriptionEn??(x.entry.data.language==='fr'?'':x.entry.data.description)):(x.entry.data.language==='en'?'':x.entry.data.description)))))));}
 const note=a.state.locale==='fr'?spellNotesFr[entry.id]:null;
 if(note)body.append(el('p',{class:'eyebrow'},w('Résumé original · règles 2014','Original summary · 2014 rules')),el('p',{class:'entry-description'},note));
 const description=a.state.locale==='en'&&data.descriptionEn?data.descriptionEn:data.description,language=a.state.locale==='en'&&data.descriptionEn?'en':data.language;
 if(description&&entry.type!=='subclass'&&(a.state.locale==='en'||language!=='en'))body.append(el('details',{open:!note},el('summary',{},language==='fr'?entry.type==='spell'?w('Effets du sort','Spell effects · French'):w('Description','Description · French'):w('Description complète en anglais','Full description')),el('p',{class:'entry-description'},readableText(description))));
 const reference=spellReference(entry.id);
 body.append(el('details',{},el('summary',{},w('Référence','Reference')),el('p',{},entry.source.document),... (reference?[el('p',{},reference.references.map(r=>r.sourceId+(r.pages.length?' · p. '+r.pages.join(', '):'')).join(' / '))]:[]),...(reference?[el('a',{href:reference.detailUrl,target:'_blank',rel:'noopener noreferrer'},w('Fiche AideDD 2014','AideDD 2014 reference'))]:[])));
 a.modal(body);
}
