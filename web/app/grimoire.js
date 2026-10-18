import {el,button,field,select,check,badge} from './dom.js';
import {grimoireView,grimoireService} from '../../src/spellbook/service.js';
import {spellMatches,spellReference} from '../../src/catalog/spell-reference.js';
import {choiceName} from './editor.js';
import {showEntryDetails} from './spell-detail.js';
import {spellSchool} from '../../src/catalog/localization.js';

export async function renderGrimoire(main,characterId,a){
 const record=await a.library.get(characterId);
 if(!record){main.append(el('p',{},a.t('emptyLibrary')));return;}
 const draft=await a.drafts.get(characterId),view=grimoireView(a.context,a.config,draft,record);
 const w=(fr,en)=>a.state.locale==='fr'?fr:en,metaKey='grimoire:view:'+characterId;
 const persisted=await a.storage.get('meta',metaKey);
 const ui={tab:'mine',classId:view.classIds[0]??'all',query:'',level:'all',school:'all',favorites:false,concentration:false,ritual:false,source:'all',...persisted};
 if(!['all',...view.classIds].includes(ui.classId))ui.classId=view.classIds[0]??'all';
 let editing=false,staged=[],page=0;
 const service=grimoireService({library:a.library,drafts:a.drafts,campaigns:a.campaigns});
 const shell=el('section',{class:'grimoire','data-character-id':characterId,'data-character-revision':record.definition.revision});main.append(shell);
 const grants=()=>view.book.grants.filter(g=>ui.classId==='all'||g.classId===ui.classId);
 const prepared=()=>view.choices.find(q=>q.kind==='prepared'&&q.classId===ui.classId);
 const wizardBook=()=>view.choices.find(q=>q.kind==='spellbook'&&q.classId==='wizard');
 async function remember(){await a.storage.batch([],[{store:'meta',key:metaKey,value:ui}]);}
 async function toggleFavorite(id){
  const current=await a.library.get(characterId),favorites=current.preferences.favorites;
  await a.library.setPreferences(characterId,{...current.preferences,favorites:favorites.includes(id)?favorites.filter(v=>v!==id):[...favorites,id]});
  record.preferences=(await a.library.get(characterId)).preferences;await draw();
 }
 async function apply(command){
  try{
   await service.apply(characterId,command,{expectedCharacterRevision:record.definition.revision,expectedDraftRevision:draft.revision});
   document.querySelector('#dialog')?.close();await a.render();
  }catch(e){a.notice(w('Impossible d’enregistrer ces choix. Vérifiez la fiche et les sources, puis rouvrez le Grimoire.','These choices could not be saved. Review the character and sources, then reopen the spellbook.'));console.error(e);}
 }
 function copy(entry){
  let confirmed=false;
  const save=button(w('Confirmer la copie','Confirm copy'),()=>apply({type:'copy',spellId:entry.id,confirmedCopy:confirmed,note:w('Le joueur confirme l’accès au sort et le respect du temps et du coût de copie.','Player confirms spell access, copying time and material cost.')}),'primary');save.disabled=true;
  a.modal(el('section',{},el('h2',{},w('Inscrire dans votre livre','Add to your spellbook')),el('p',{},a.name(entry)),el('p',{},w('Cette copie ajoute le sort à votre livre sans modifier votre préparation.','Copying adds this spell to your book without changing preparation.')),check(w('J’ai accès à ce sort et j’ai respecté le temps et le coût de copie applicables.','I have access to this spell and have met the applicable copying time and cost.'),false,e=>{confirmed=e.target.checked;save.disabled=!confirmed;}),save));
 }
 async function draw(){
  const currentGrants=grants(),selected=new Set(view.book.preparedGrantIds),q=prepared();
  const header=el('div',{class:'section-head'},el('div',{},el('p',{class:'eyebrow'},record.definition.identity.name),el('h1',{},w('Votre grimoire','Your spellbook'))),button(w('Modifier le personnage','Edit character'),()=>a.nav('creator',characterId)));
  const tabs=el('div',{class:'grimoire-tabs',role:'tablist','aria-label':w('Vue du Grimoire','Spellbook view')});
  for(const [id,title]of [['mine',w('Mes sorts','My spells')],['catalogue',w('Catalogue','Catalogue')]]){const b=button(title,async()=>{ui.tab=id;page=0;await remember();await draw();},ui.tab===id?'active':'');b.setAttribute('role','tab');b.setAttribute('aria-selected',String(ui.tab===id));tabs.append(b);}
  const toolbar=el('div',{class:'grimoire-toolbar'});
  if(view.classIds.length>1||view.book.grants.some(g=>g.classId===null))toolbar.append(field(w('Origine de magie','Spellcasting origin'),select([['all',w('Toutes les origines','All origins')],...view.classIds.map(id=>[id,a.cls(id)])],ui.classId,async e=>{ui.classId=e.target.value;editing=false;page=0;await remember();await draw();})));
  const search=el('input',{type:'search',value:ui.query,placeholder:w('Nom français ou anglais…','French or English name…'),'aria-label':w('Rechercher un sort','Search spells'),oninput:async e=>{ui.query=e.target.value;page=0;await remember();fill();}});
  toolbar.append(search);
  const status=el('div',{class:'grimoire-status',role:'status'}),list=el('div',{class:'grimoire-list'}),pages=el('div',{class:'single-pages'});
  const filters=el('details',{},el('summary',{},w('Filtres','Filters')),
   field(a.t('level'),select([['all',w('Tous les niveaux','All levels')],...Array.from({length:10},(_,n)=>[String(n),n===0?w('Sorts mineurs','Cantrips'):String(n)])],ui.level,async e=>{ui.level=e.target.value;page=0;await remember();fill();})),
   field(w('École','School'),select([['all',w('Toutes les écoles','All schools')],...['abjuration','conjuration','divination','enchantment','evocation','illusion','necromancy','transmutation'].map(id=>[id,spellSchool(id,a.state.locale)])],ui.school,async e=>{ui.school=e.target.value;page=0;await remember();fill();})),
   field(w('Source','Source'),select([['all',w('Toutes les sources','All sources')],...a.context.statuses.filter(s=>s.selected).map(s=>[s.id,s.name])],ui.source,async e=>{ui.source=e.target.value;page=0;await remember();fill();})),
   check(w('Concentration','Concentration'),ui.concentration,async e=>{ui.concentration=e.target.checked;page=0;await remember();fill();}),
   check(w('Rituel','Ritual'),ui.ritual,async e=>{ui.ritual=e.target.checked;page=0;await remember();fill();}),
   check(w('Favoris uniquement','Favorites only'),ui.favorites,async e=>{ui.favorites=e.target.checked;page=0;await remember();fill();}));
  shell.replaceChildren(header,tabs,toolbar,filters,status,list,pages);
  if(!currentGrants.length&&ui.tab==='mine')shell.insertBefore(el('p',{},w('Vous n’avez aucun sort acquis pour cette origine.','No spells have been acquired for this origin.')),list);
  if(view.book.unresolved.includes('legacy-origins-and-acquisition-levels'))shell.insertBefore(el('p',{},w('Les sorts de cette ancienne fiche sont conservés. Vérifiez leurs origines dans le Créateur avant de les modifier.','Spells from this older character have been preserved. Review their origins in the creator before editing.')),list);
  if(q&&view.editable){
   const prep=el('div',{class:'grimoire-preparation'});
   if(!editing)prep.append(button(w('Modifier la préparation','Change preparation'),()=>{editing=true;staged=[...(draft.selections[q.id]??[])];ui.tab='catalogue';page=0;draw();}));
   else{
    const save=button(w('Enregistrer la préparation','Save preparation'),()=>apply({type:'prepare',classId:ui.classId,spellIds:staged}),'primary');save.disabled=staged.length>q.count||staged.length<(q.minimumCount??q.count);
    prep.append(el('p',{},`${staged.length} / ${q.count} `+w('sorts préparés au maximum — les sorts toujours préparés sont à part.','prepared spells maximum — always-prepared spells are separate.')),save,button(w('Annuler','Cancel'),()=>{editing=false;draw();}));
   }
   shell.insertBefore(prep,list);
  }else if(view.classIds.length&&ui.classId!=='all')shell.insertBefore(el('p',{},w('Vos sorts connus et choix spéciaux évoluent lors de la progression du personnage.','Known spells and special choices change when your character advances.')),list);
  function fill(){
   const ids=new Set(currentGrants.map(g=>g.spellId));
   if(ui.tab==='catalogue'){
    const choices=view.choices.filter(c=>ui.classId==='all'||c.classId===ui.classId);
    for(const choice of choices)for(const id of choice.options)ids.add(id);
    if(!view.classIds.length)for(const entry of a.context.index.list('spell'))ids.add(entry.id);
   }
   let rows=[...ids].map(id=>a.context.index.get(id)??a.context.installed.get(id)).filter(e=>e?.type==='spell');
   if(editing)rows=rows.filter(e=>q.options.includes(e.id)||currentGrants.some(g=>g.spellId===e.id&&g.preparation==='always'));
   const acquired=new Set(currentGrants.map(g=>g.spellId)),dailyCount=q?(draft.selections[q.id]?.length??0):0;
   status.textContent=`${acquired.size} `+w('sorts acquis','acquired spells')+(q?` · ${dailyCount} / ${q.count} `+w('préparés','prepared'):'');
   rows=rows.filter(e=>spellMatches(e.id,ui.query,e)&&(ui.level==='all'||e.data.level===Number(ui.level))&&(ui.school==='all'||e.data.school===ui.school)&&(!ui.favorites||record.preferences.favorites.includes(e.id))&&(!ui.concentration||e.data.concentration)&&(!ui.ritual||e.data.ritual)&&(ui.source==='all'||spellReference(e.id)?.sourceIds.includes(ui.source))).sort((x,y)=>x.data.level-y.data.level||a.name(x).localeCompare(a.name(y)));
   const pageCount=Math.max(1,Math.ceil(rows.length/12));page=Math.min(page,pageCount-1);list.replaceChildren();
   if(!rows.length&&!(ui.tab==='mine'&&!currentGrants.length))list.append(el('p',{},w('Aucun résultat avec ces filtres.','No results match these filters.')),button(w('Effacer les filtres','Clear filters'),async()=>{ui.level='all';ui.school='all';ui.favorites=false;ui.concentration=false;ui.ritual=false;ui.source='all';page=0;await remember();draw();}));
   for(const entry of rows.slice(page*12,(page+1)*12)){
    const own=currentGrants.filter(g=>g.spellId===entry.id),always=own.some(g=>g.preparation==='always'),isPrepared=always||own.some(g=>selected.has(g.id));
    const row=el('article',{class:'grimoire-spell','data-spell-id':entry.id},el('div',{},button(a.name(entry),()=>showEntryDetails(entry,a),'spell-title'),el('small',{},(entry.data.level===0?w('Sort mineur','Cantrip'):w('Niveau ','Level ')+entry.data.level)+(entry.data.concentration?' · '+a.t('concentration'):'')+(entry.data.ritual?' · '+a.t('ritual'):''))));
    if(own.length)row.append(el('div',{class:'grimoire-badges'},badge(always?w('Toujours préparé','Always prepared'):isPrepared?w('Préparé','Prepared'):own.some(g=>['book','copy'].includes(g.acquisition))?w('Inscrit','In book'):w('Connu','Known')),own.length>1?badge(w('Plusieurs origines','Multiple origins')):null));
    if(own.length)row.append(el('details',{},el('summary',{},w('Origines','Origins')),own.map(g=>el('p',{},g.classId?(view.choices.find(q=>q.id===g.originId)?a.cls(g.classId)+' · '+choiceName(view.choices.find(q=>q.id===g.originId),a):a.cls(g.classId)+' · '+w('Octroi automatique','Automatic grant')):a.name(a.context.installed.get(g.originId))||w('Autre origine à vérifier','Other origin to review')))));
    if(editing&&q.options.includes(entry.id))row.append(check(w('Préparer','Prepare'),staged.includes(entry.id),e=>{staged=e.target.checked?[...staged,entry.id]:staged.filter(id=>id!==entry.id);draw();},{disabled:!staged.includes(entry.id)&&staged.length>=q.count}));
    if(!editing&&ui.classId==='wizard'&&view.editable&&!record.definition.spells.known.includes(entry.id)&&wizardBook()?.options.includes(entry.id)&&entry.data.level>0)row.append(button(w('Inscrire','Copy to book'),()=>copy(entry)));
    row.append(button(record.preferences.favorites.includes(entry.id)?'★':'☆',()=>toggleFavorite(entry.id),'favorite'));
    row.querySelector('.favorite').setAttribute('aria-label',(record.preferences.favorites.includes(entry.id)?w('Retirer des favoris : ','Remove favorite: '):w('Ajouter aux favoris : ','Favorite: '))+a.name(entry));
    list.append(row);
   }
   pages.replaceChildren();if(rows.length>12){const previous=button(w('Précédent','Previous'),()=>{page--;fill();}),next=button(w('Suivant','Next'),()=>{page++;fill();});previous.disabled=page===0;next.disabled=page===pageCount-1;pages.append(previous,el('span',{},`${page+1} / ${pageCount}`),next);}
  }
  fill();
 }
 await draw();
}
