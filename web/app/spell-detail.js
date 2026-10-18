import {el} from './dom.js';
import {spellTerms} from '../../src/catalog/localization.js';
import {spellReference} from '../../src/catalog/spell-reference.js';
import {spellNotesFr} from '../../src/catalog/spell-notes-fr.js';
export function showEntryDetails(entry,a){
 if(!entry)return;
 const w=(fr,en)=>a.state.locale==='fr'?fr:en,data=entry.data,body=el('section',{},el('h2',{},a.name(entry)));
 if(entry.type==='spell'){
  const terms=spellTerms(entry,a.state.locale);
  body.append(el('dl',{class:'spell-facts'},...['level','school','castingTime','range','duration','components'].flatMap(k=>[el('dt',{},a.t(k)),el('dd',{},terms[k])])),data.concentration?el('p',{},a.t('concentration')):null,data.ritual?el('p',{},a.t('ritual')):null);
 }
 const note=a.state.locale==='fr'?spellNotesFr[entry.id]:null;
 if(note)body.append(el('p',{class:'entry-description'},note));
 const description=a.state.locale==='en'&&data.descriptionEn?data.descriptionEn:data.description,language=a.state.locale==='en'&&data.descriptionEn?'en':data.language;
 if(description)body.append(el('details',{open:!note},el('summary',{},language==='fr'?entry.type==='spell'?w('Effets du sort','Spell effects · French'):w('Effets et règles','Effects and rules · French'):w('Description complète en anglais','Full description')),el('p',{class:'entry-description'},description)));
 const reference=spellReference(entry.id);
 body.append(el('details',{},el('summary',{},w('Référence','Reference')),el('p',{},entry.source.document),reference?el('p',{},reference.references.map(r=>r.sourceId+(r.pages.length?' · p. '+r.pages.join(', '):'')).join(' / ')):null,reference?el('a',{href:reference.detailUrl,target:'_blank',rel:'noopener noreferrer'},w('Fiche AideDD 2014','AideDD 2014 reference')):null));
 a.modal(body);
}
