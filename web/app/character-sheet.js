import {ABILITIES,SKILLS} from '../../src/character/contracts.js';
import {el,button} from './dom.js';
import {optionName} from './editor.js';
import {showEntryDetails} from './spell-detail.js';
import {renderGrimoire} from './grimoire.js';
import {readableText} from '../../src/catalog/readable-text.js';

const signed=n=>(n>=0?'+':'')+n;
/** Compact presentation of the saved definition and the existing preview runtime. */
export function characterSheet({record,draft,stats,runtime,a,tab,onTab,actions,simulation,resourceName,compatible}){
 const d=record.definition,fr=a.state.locale==='fr',w=(f,e)=>fr?f:e;
 const root=el('section',{class:'character-sheet','data-character-id':d.id}),panes=new Map();
 const entryName=id=>{const e=a.context.installed.get(id);return e?a.name(e):optionName(id,a);};
 const itemName=e=>typeof e.name==='string'?e.name:e.name?.[a.state.locale]??e.id;
 const line=(name,value,note)=>el('div',{class:'sheet-line'},el('span',{},name,note?el('small',{},note):null),el('strong',{},value));
 root.append(el('div',{class:'sheet-navigation'},button('← '+a.t('library'),()=>a.nav('library')),draft?button(a.t('edit'),()=>a.nav('creator',d.id)):null));
 root.append(el('div',{class:'sheet-identity'},el('div',{class:'avatar'},d.identity.portrait?el('img',{src:d.identity.portrait,alt:''}):d.identity.name.slice(0,1)),el('div',{},el('h1',{},d.identity.name),el('p',{},d.classes.map(c=>a.cls(c.id)+' '+c.level).join(' / ')),el('small',{},[d.ancestry?.subraceId?entryName(d.ancestry.subraceId):d.ancestry?.id?entryName(d.ancestry.id):null,...d.classes.map(c=>c.subclassId?entryName(c.subclassId):null)].filter(Boolean).join(' · ')))));
 const vital=(label,value)=>el('div',{class:'sheet-vital'},el('small',{},label),el('strong',{},value));
 root.append(el('div',{class:'sheet-vitals'},vital(a.t('hp'),runtime?runtime.hp.current+' / '+runtime.hp.max:stats.maxHp+' / '+stats.maxHp),vital(a.t('ac'),stats.ac),vital(w('Initiative','Initiative'),signed(stats.initiative)),vital(w('Vitesse','Speed'),fr?(stats.speed*.3).toLocaleString('fr')+' m':stats.speed+' ft.')));
 root.append(el('div',{class:'sheet-quick'},el('span',{},w('Maîtrise ','Proficiency ')+signed(stats.proficiency)),el('span',{},w('Dés de vie ','Hit dice ')+d.classes.map(c=>c.level+'d'+c.hitDie).join(' + ')),el('span',{},w('Perception passive ','Passive Perception ')+stats.passives.perception)));
 if(runtime)root.append(el('p',{class:'sheet-note'},w('PV et ressources : simulation locale active.','HP and resources: local simulation active.')));
 if(!compatible)root.append(el('p',{class:'warning-text'},a.t('sourceAbsent')),button(a.t('sources'),()=>a.nav('sources')));
 const nav=el('nav',{class:'sheet-tabs','aria-label':w('Rubriques de la fiche','Character sections')}),body=el('div',{class:'sheet-content'});
 root.append(nav,body);
 const overview=el('section',{},el('h2',{},w('Caractéristiques & sauvegardes','Abilities & saving throws')),
 el('div',{class:'sheet-abilities'},ABILITIES.map(k=>el('div',{class:'sheet-ability'},el('span',{class:'sheet-ability-label'},a.label(k)),el('strong',{},signed(stats.modifiers[k])),el('small',{},w('Valeur ','Score ')+d.scores[k]),el('span',{class:'sheet-save'},d.saveProficiencies.includes(k)?el('span',{'aria-label':w('Sauvegarde maîtrisée','Proficient saving throw')},'● '):null,w('Sauv. ','Save ')+signed(stats.saves[k]))))));
 overview.append(el('p',{class:'sheet-note'},w('● Sauvegarde maîtrisée.','● Proficient saving throw.')));
 const attacks=el('section',{},el('h2',{},w('Attaques','Attacks')));
 for(const item of d.equipment.filter(e=>e.equipped&&stats.weapons[e.id])){const v=stats.weapons[item.id];attacks.append(line(itemName(item),signed(v.attack),[item.weapon?.dice??item.weapon?.damageDice,w('Bonus aux dégâts ','Damage bonus ')+signed(v.damageBonus)].filter(Boolean).join(' · ')));}
 attacks.append(line(w('Action Attaquer','Attack action'),stats.attacksPerAction+' '+w('attaque(s)','attack(s)')));
 const resources=el('section',{},el('h2',{},a.t('resource')));
 for(const [key,r]of Object.entries(stats.resources))resources.append(line(resourceName(key,a),(runtime?.resources[key]??r.max)+' / '+r.max,r.recovery==='short'?w('Repos court','Short rest'):r.recovery==='long'?w('Repos long','Long rest'):null));
 if(!Object.keys(stats.resources).length)resources.append(el('p',{class:'sheet-note'},w('Aucune réserve limitée.','No limited resources.')));
 overview.append(el('div',{class:'sheet-columns'},attacks,resources));
 for(const [key,label]of [['resistances',w('Résistances','Resistances')],['immunities',w('Immunités','Immunities')],['vulnerabilities',w('Vulnérabilités','Vulnerabilities')]])if(d.defenses?.[key]?.length)overview.append(el('p',{class:'sheet-note'},label+' : '+d.defenses[key].map(id=>optionName(id,a)).join(' · ')));
 panes.set('overview',overview);
 const skills=el('section',{}),skillList=el('div',{class:'sheet-skills'});let trained=false;
 const skillToggle=button(w('Maîtrisées seules','Proficient only'),()=>{trained=!trained;skillToggle.setAttribute('aria-pressed',String(trained));drawSkills();});skillToggle.setAttribute('aria-pressed','false');
 skills.append(el('div',{class:'sheet-section-head'},el('h2',{},w('Compétences','Skills')),skillToggle),el('p',{class:'sheet-note'},w('● Maîtrise · ◆ Expertise · ○ Sans maîtrise','● Proficient · ◆ Expertise · ○ Untrained')),skillList);
 function drawSkills(){skillList.replaceChildren(...Object.entries(stats.skills).filter(([k])=>!trained||d.skills[k]>0).map(([k,v])=>el('div',{class:'sheet-skill'},el('span',{'aria-label':d.skills[k]>=2?w('Expertise','Expertise'):d.skills[k]>0?w('Maîtrisée','Proficient'):w('Sans maîtrise','Untrained')},d.skills[k]>=2?'◆':d.skills[k]>0?'●':'○'),el('span',{},a.label(k)),el('small',{},a.label(SKILLS[k]).slice(0,3)),el('strong',{},signed(v)))));}
 drawSkills();panes.set('skills',skills);
 const powers=el('section',{},el('h2',{},w('Capacités & traits','Features & traits')));
 for(const id of [...new Set(d.features)]){const e=a.context.installed.get(id);const text=e?(fr?(e.data.language==='en'?'':e.data.description):(e.data.descriptionEn??(e.data.language==='fr'?'':e.data.description))):'';powers.append(el('details',{},el('summary',{},entryName(id)),text?el('p',{class:'entry-description'},readableText(text)):null,e?button(w('Fiche complète','Full entry'),()=>showEntryDetails(e,a),'subtle'):el('p',{},w('Détail indisponible dans les sources installées.','Details unavailable in the installed sources.'))));}
 if(!d.features.length)powers.append(el('p',{},w('Aucune capacité enregistrée.','No recorded features.')));
 powers.append(el('details',{class:'sheet-simulation'},el('summary',{},w('Tester les actions · simulation locale','Test actions · local simulation')),simulation,el('h2',{},a.t('actions')),actions));panes.set('powers',powers);
 const gear=el('section',{},el('h2',{},w('Inventaire','Inventory')));
 for(const item of d.equipment)gear.append(line(itemName(item),'× '+(item.quantity??1),item.equipped?w('Équipé','Equipped'):w('Rangé','Stowed')));
 if(!d.equipment.length)gear.append(el('p',{class:'sheet-note'},w('Aucun équipement enregistré.','No recorded equipment.')));
 gear.append(el('details',{},el('summary',{},w('Langues & maîtrises','Languages & proficiencies')),el('p',{},d.proficiencies.map(id=>optionName(id,a)).join(' · '))),el('details',{},el('summary',{},w('Identité & notes','Identity & notes')),el('p',{},d.identity.gender?(fr?(d.identity.gender==='femme'?'Femme':'Homme'):(d.identity.gender==='femme'?'Woman':'Man')):''),el('p',{},d.identity.description??'')));
 panes.set('gear',gear);const spells=el('section',{});panes.set('spells',spells);let spellsLoaded=false;
 for(const [key,label]of [['overview',w('Fiche','Sheet')],['skills',w('Compétences','Skills')],['powers',w('Capacités','Features')],['gear',w('Inventaire','Inventory')],['spells',w('Sorts','Spells')]]){const b=button(label,()=>selectTab(key));b.dataset.pane=key;nav.append(b);const pane=panes.get(key);pane.id='sheet-pane-'+key; b.setAttribute('aria-controls',pane.id);body.append(pane);}
 async function selectTab(key){if(!panes.has(key))key='overview';onTab(key);for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.pane===key));for(const [k,pane]of panes)pane.hidden=k!==key;if(key==='spells'&&!spellsLoaded){spellsLoaded=true;try{await renderGrimoire(spells,d.id,a,{embedded:true});}catch(e){spellsLoaded=false;a.fail(e);}}}
 selectTab(tab);return root;
}
