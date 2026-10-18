import {showEntryDetails} from './spell-detail.js';
import {spellMatches} from '../../src/catalog/spell-reference.js';
import {el,button,field,select,check,badge} from './dom.js';
import {migrateSingleDraft,singlePath,decisionReady} from '../../src/creator/single-path.js';
import {compileDraft,retainDecision,restoreDecision,templateScores} from '../../src/creator/model.js';
import {raceOptions,raceSelection,selectRace} from '../../src/creator/race-selection.js';
import {ABILITIES,SKILLS} from '../../src/character/contracts.js';
import {POINT_COST,rollAbilityScores} from '../../src/catalog/origins.js';
import {ARMORS,WEAPONS} from '../../src/catalog/equipment.js';
import {optionName,choiceName,issueMessage} from './editor.js';
import {appearanceControls} from './appearance.js';
import {raceIcon} from './race-icons.js';
import {replacementOptions} from '../../src/catalog/spell-grants.js';

export async function renderCreator(main,input,a) {
  const d=migrateSingleDraft(input),w=(fr,en)=>a.state.locale==='fr'?fr:en;
  if(input.mode!=='single')await a.autosave(d);
  const shell=el('section',{class:'single-creator'});main.append(shell);
  const filters=new Map();
  const swaps=new Map();
  const text=key=>a.t(key);
  const label=decision=>({identity:w('Votre personnage','Your character'),race:w('Choisissez votre race','Choose your race'),subrace:text('subrace'),class:w('Classe et niveau','Class and level'),background:text('background'),scores:text('scores'),equipment:text('equipment'),summary:w('Votre personnage est-il prêt ?','Is your character ready?')})[decision.kind]??(decision.kind==='origin-choice'?w('Un choix de votre origine','An origin choice'):choiceName(decision.choice,a));
  async function update(fn,{navigation=false}={}) {
    d.finalized=false;d.status='draft';d.confirmed=false;d.reviewed=false;fn(d);
    await a.autosave(d);await draw(navigation);
  }
  async function go(id){d.step=id;await a.autosave(d);await draw(true);}
  const details=entry=>showEntryDetails(entry,a);
  function originSpellExchanges(classId){
    const c=d.classes.find(c=>c.id===classId),sub=a.context.index.get(c?.subclassId);if(!sub?.data.spellGrantReplacement)return null;
    const state=swaps.get(classId)??{level:c.level,slot:null};swaps.set(classId,state);
    const recorded=(d.spellGrantReplacements??[]).find(r=>r.originId===sub.id&&r.classLevel===state.level);
    const slots=sub.data.extraSpells.filter(r=>r.mode==='known'&&r.classLevel<=state.level).flatMap(r=>r.spellIds);
    if(!slots.includes(state.slot))state.slot=recorded?.originalSpellId??slots[0];
    const existing=recorded?.originalSpellId===state.slot?recorded.spellId:'';
    return el('details',{},el('summary',{},w('Remplacer un sort d’origine — facultatif','Replace an origin spell — optional')),
      el('p',{},w('Un seul remplacement par niveau d’ensorceleur. Le nouveau sort doit être du même niveau et appartenir aux écoles et listes autorisées. Vous pouvez renseigner ici les choix réellement faits aux niveaux précédents.','One replacement per sorcerer level. The spell must keep its level and use the allowed schools and lists. You may record actual choices from earlier levels.')),
      field(w('Niveau d’ensorceleur du remplacement','Sorcerer level of the exchange'),select(Array.from({length:c.level},(_,i)=>[String(i+1),String(i+1)]),String(state.level),e=>{state.level=Number(e.target.value);state.slot=null;draw();})),
      field(w('Sort accordé à remplacer','Original granted spell'),select(slots.map(id=>[id,a.name(a.context.index.get(id))]),state.slot,e=>{state.slot=e.target.value;draw();})),
      field(w('Nouveau sort','New spell'),select([['',w('Aucun remplacement à ce niveau','No exchange at this level')],...replacementOptions(a.context.index,sub.id,state.slot).filter(s=>s.id!==state.slot).map(s=>[s.id,a.name(s)])],existing,e=>update(x=>{
        x.spellGrantReplacements=(x.spellGrantReplacements??[]).filter(r=>!(r.originId===sub.id&&r.classLevel===state.level));
        if(e.target.value)x.spellGrantReplacements.push({originId:sub.id,originalSpellId:state.slot,spellId:e.target.value,classLevel:state.level});
      }))),
      (d.spellGrantReplacements??[]).filter(r=>r.originId===sub.id).map(r=>el('p',{},w('Niveau ','Level ')+r.classLevel+' : '+a.name(a.context.installed.get(r.originalSpellId))+' → '+a.name(a.context.installed.get(r.spellId)))));
  }
  function choiceList(q,values,onchange,{origin=false}={}) {
    const filter=filters.get(q.id)??{query:'',page:0};filters.set(q.id,filter);
    const wrap=el('div',{'data-choice-id':q.id,class:'single-choice'}),list=el('div',{class:'single-options'}),pages=el('div',{class:'single-pages'});
    const title=q.classId?choiceName(q,a):q.key.replaceAll('-',' ');
    wrap.append(el('p',{class:'single-choice-count',role:'status'},title+' · '+values.length+' / '+q.count));
    const search=el('input',{type:'search','aria-label':w('Rechercher une option','Search options'),placeholder:w('Rechercher en français ou en anglais…','Search French or English…'),value:filter.query,oninput:e=>{filter.query=e.target.value;filter.page=0;fill();}});
    if(q.options.length>8)wrap.append(search);
    function fill(){
      const query=filter.query.toLocaleLowerCase();
      const options=q.options.filter(id=>a.context.index.get(id)?.type==='spell'?spellMatches(id,query,a.context.index.get(id)):[optionName(id,a),...Object.values(a.context.installed.get(id)?.name??{})].join(' ').toLocaleLowerCase().includes(query));
      const pageCount=Math.max(1,Math.ceil(options.length/8));filter.page=Math.min(filter.page,pageCount-1);
      list.replaceChildren();
      if(!options.length)list.append(el('p',{},w('Aucun résultat. Essayez un autre nom.','No results. Try another name.')));
      const others=new Set(q.kind==='skill'?[...(singlePath(a.context,a.config,d).report.origin?.background.skills??[]),...Object.entries(d.selections).filter(([id])=>id!==q.id&&id.endsWith(':skills')).flatMap(([,v])=>v)]:[]);
      for(const id of options.slice(filter.page*8,(filter.page+1)*8)){
        const entry=a.context.index.get(id),selected=values.includes(id),disabled=!selected&&(q.count>1&&values.length>=q.count||others.has(id));
        const input=el('input',{type:q.count===1?'radio':'checkbox',name:q.id,checked:selected,disabled,'aria-label':optionName(id,a),onchange:e=>onchange(e.target.checked?q.count===1?[id]:[...values,id]:values.filter(x=>x!==id))});
        list.append(el('div',{class:'single-option'+(selected?' selected':'')},el('label',{},input,el('span',{},optionName(id,a))),entry?button(w('Détail','Details'),()=>details(entry),'subtle'):null));
      }
      pages.replaceChildren();
      if(options.length>8){const prev=button(w('Page précédente','Previous page'),()=>{filter.page--;fill();}),next=button(w('Page suivante','Next page'),()=>{filter.page++;fill();});prev.disabled=filter.page===0;next.disabled=filter.page===pageCount-1;pages.append(prev,el('span',{},`${filter.page+1} / ${pageCount}`),next);}
    }
    wrap.append(list,pages);fill();return wrap;
  }
  async function draw(focus=false) {
    const plan=singlePath(a.context,a.config,d),{report,current,decisions,position}=plan;
    if(d.step!==current.id){d.step=current.id;await a.autosave(d);}
    const body=el('div',{class:'single-body','data-decision-id':current.id,'data-kind':current.kind},el('p',{class:'eyebrow'},`${position+1} / ${decisions.length} · D&D 2014`),el('h1',{tabindex:-1},label(current)));
    const saveState=el('span',{id:'draft-save-state',role:'status'},text('saved'));
    const header=el('div',{class:'single-heading'},el('span',{},d.name||w('Nouveau personnage','New character')),saveState,button(w('Quitter','Exit'),()=>a.nav('library')));
    const sectionNav=el('details',{class:'single-plan'},el('summary',{},w('Revoir une étape','Review a step')),el('nav',{'aria-label':w('Étapes de création','Creation steps')},decisions.map(decision=>{
      const b=button(label(decision),()=>go(decision.id));if(decision.id===current.id)b.setAttribute('aria-current','step');return b;
    })));
    shell.replaceChildren(header,sectionNav,body);
    if(current.kind==='identity'){
      body.append(field(text('name'),el('input',{id:'character-name',value:d.name,maxlength:200,autocomplete:'off',onchange:e=>update(x=>{x.name=e.target.value;})})),
        el('p',{},w('Un nom suffit pour commencer. Vous pourrez le changer ensuite.','Start with a name. You can change it later.')),
        el('details',{},el('summary',{},w('Portrait et apparence — facultatif','Portrait and appearance — optional')),appearanceControls(a,d,update)),
        el('details',{},el('summary',{},w('Cadre de votre aventure','Adventure settings')),el('p',{},a.context.statuses.filter(s=>s.selected).map(s=>s.name).join(' · ')),button(w('Modifier les sources','Change sources'),()=>a.nav('sources'))));
    }
    if(current.kind==='race'){
      const installed=a.context.index.list('race');
      const choices=el('div',{class:'single-races'});
      for(const entry of installed){const b=button([raceIcon(entry.name.fr),el('span',{},a.name(entry))],()=>update(x=>selectRace(a.context,x,entry.id,a.state.locale)),entry.id===d.raceId?'selected':'');b.setAttribute('aria-pressed',String(entry.id===d.raceId));choices.append(b);}
      body.append(choices);
      const manual=raceOptions(a.context,a.state.locale).filter(([id])=>id.startsWith('manual-race:'));
      body.append(el('details',{open:!!d.manualRace},el('summary',{},w('Autres races et origine personnalisée','Other races and custom origin')),field(text('race'),select([['',w('Choisir','Choose')],...manual],raceSelection(d),e=>update(x=>selectRace(a.context,x,e.target.value,a.state.locale)))),
        field(w('Nom de l’origine','Origin name'),el('input',{value:d.origin,onchange:e=>update(x=>{x.origin=e.target.value;x.raceId=null;x.manualRace=null;x.customOriginRequiresReview=true;})})),
        el('p',{},w('Pour les races dont les règles restent à intégrer, les traits et bonus doivent être renseignés et vérifiés.','For races whose rules are still being integrated, traits and bonuses need to be entered and reviewed.'))));
      if(d.raceId)body.append(button(w('Traits de cette race','Race traits'),()=>details(a.context.index.get(d.raceId))));
    }
    if(current.kind==='subrace'){
      const race=report.origin.race;
      for(const sub of race.data.subraces)body.append(button(sub.name[a.state.locale],()=>update(x=>{x.subraceId=sub.id;}),d.subraceId===sub.id?'selected':''));
    }
    if(current.kind==='class'){
      const cls=d.classes[0];
      body.append(field(text('class'),select([['',w('Choisir une classe','Choose a class')],...a.context.index.list('class').map(c=>[c.data.classId,a.cls(c.data.classId)])],d.classChosen===false?'':cls.id,e=>{
        if(!e.target.value)return;update(x=>{if(x.classes[0].subclassId)retainDecision(x,'subclass',x.classes[0].id);x.classes[0]={id:e.target.value,level:x.classes[0].level,subclassId:null};x.classChosen=true;});
      })),field(text('level'),el('input',{type:'number',min:1,max:20,value:cls.level,onchange:e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n+d.classes.slice(1).reduce((s,c)=>s+c.level,0)<=20)update(x=>{x.classes[0].level=n;});else a.notice(w('Le niveau total doit rester entre 1 et 20.','Total level must stay between 1 and 20.'));}})));
      if(a.config.enabledOptions.includes('multiclass')){
        const advanced=el('details',{},el('summary',{},w('Ajouter une classe','Add a class')));
        for(const [i,c]of d.classes.entries())if(i>0)advanced.append(el('p',{},a.cls(c.id)),field(text('level'),el('input',{type:'number',min:1,max:20,value:c.level,onchange:e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&d.classes.reduce((s,c,j)=>s+(i===j?n:c.level),0)<=20)update(x=>{x.classes[i].level=n;});}})),button(w('Retirer cette classe','Remove this class'),()=>update(x=>{x.classes.splice(i,1);})));
        let id='';advanced.append(select([['',w('Choisir une classe','Choose a class')],...a.context.index.list('class').filter(c=>!d.classes.some(x=>x.id===c.data.classId)).map(c=>[c.data.classId,a.cls(c.data.classId)])],'',e=>{id=e.target.value;}),button(text('add'),()=>{if(id&&d.classes.reduce((n,c)=>n+c.level,0)<20)update(x=>{x.classes.push({id,level:1,subclassId:null});});}));body.append(advanced);
      }
    }
    if(current.kind==='background'){
      body.append(field(text('background'),select([['',w('Historique sur mesure','Custom background')],...a.context.index.list('background').map(b=>[b.id,a.name(b)])],d.backgroundId??'',e=>update(x=>{x.backgroundId=e.target.value||null;}))));
      if(!d.backgroundId){body.append(field(text('name'),el('input',{value:d.background.name,onchange:e=>update(x=>{x.background.name=e.target.value;})})),choiceList({id:'custom:background-skills',key:text('skills'),kind:'skill',options:Object.keys(SKILLS),count:2},d.background.skills,values=>update(x=>{x.background.skills=values;})),el('p',{},w('Langues, outils et capacité de cet historique restent à vérifier avec votre MJ.','Languages, tools and the background feature still need review with your GM.')));}
      else body.append(button(w('Détail de l’historique','Background details'),()=>details(a.context.index.get(d.backgroundId))));
    }
    if(current.kind==='scores'){
      body.append(field(text('method'),select(['standard','point-buy','rolled','manual'].map(k=>[k,text(k==='manual'?'manualScores':k)]),d.scoreMethod,e=>update(x=>{x.scoreMethod=e.target.value;x.scoresAreBase=true;if(x.scoreMethod==='standard')x.scores=templateScores(x.classes[0].id);if(x.scoreMethod==='point-buy')x.scores=Object.fromEntries(ABILITIES.map(k=>[k,8]));}))),
        check(w('Ajouter les bonus raciaux aux valeurs ci-dessous','Add racial bonuses to the scores below'),d.scoresAreBase,e=>update(x=>{x.scoresAreBase=e.target.checked;})));
      if(d.scoreMethod==='rolled')body.append(button(text('rollScores'),()=>update(x=>{const r=rollAbilityScores();x.scoreRolls=r.rolls;x.scores=Object.fromEntries(ABILITIES.map((k,i)=>[k,r.values[i]]));})));
      const grid=el('div',{class:'single-scores'});
      for(const ability of ABILITIES)grid.append(field(a.label(ability),el('input',{type:'number',min:1,max:30,value:d.scores[ability],onchange:e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=30)update(x=>{x.scores[ability]=n;});}}),w('Final : ','Final: ')+(report.scores?.[ability]??'—')));
      body.append(grid);
      if(d.scoreMethod==='point-buy')body.append(el('p',{},Object.values(d.scores).reduce((s,n)=>s+(POINT_COST[n]??100),0)+' / 27'));
      body.append(el('p',{},text('hp')+' : '+(report.hpPreview??'—')+' · '+w('Moyenne des dés de vie','Average Hit Dice')));
    }
    if(current.kind==='origin-choice')body.append(choiceList(current.choice,d.originSelections?.[current.choice.id]??[],values=>update(x=>{x.originSelections??={};x.originSelections[current.choice.id]=values;}),{origin:true}));
    if(current.kind==='class-choice'){
      const q=current.choice;body.append(el('p',{},a.cls(q.classId)+' · '+text('level')+' '+q.level));
      const values=q.kind==='subclass'?[d.classes.find(c=>c.id===q.classId)?.subclassId].filter(Boolean):d.selections[q.id]??[];
      body.append(choiceList(q,values,values=>update(x=>{
        if(q.kind==='subclass'){const c=x.classes.find(c=>c.id===q.classId);if(c.subclassId&&c.subclassId!==values[0])retainDecision(x,'subclass',q.classId);c.subclassId=values[0]??null;}else x.selections[q.id]=values;
      })));
      if(q.id===q.classId+':known-spells'){const exchanges=originSpellExchanges(q.classId);if(exchanges)body.append(exchanges);}
    }
    if(current.kind==='equipment'){
      body.append(field(text('armor'),select(Object.entries(ARMORS).map(([id,v])=>[id,v.name[a.state.locale]]).concat([['none',text('unarmored')]]),d.equipment,e=>update(x=>{x.equipment=e.target.value;}))),check(text('shield'),d.shield,e=>update(x=>{x.shield=e.target.checked;})),
        el('details',{},el('summary',{},text('weapons')),Object.entries(WEAPONS).map(([id,item])=>check(item.name[a.state.locale],d.weapons?.includes(id)??false,e=>update(x=>{x.weapons=e.target.checked?[...(x.weapons??[]),id]:(x.weapons??[]).filter(v=>v!==id);})))),
        el('p',{},w('Les alternatives complètes d’équipement de départ sont encore en cours d’intégration.','Complete starting-equipment alternatives are still being integrated.')));
    }
    if(current.kind==='summary'){
      const compiled=compileDraft(a.context,a.config,{...d,confirmed:true});
      body.append(el('p',{},d.classes.map(c=>a.cls(c.id)+' '+c.level).join(' / ')));
      if(compiled.stats)body.append(el('div',{class:'single-summary'},el('p',{},text('hp')+' '+compiled.stats.maxHp),el('p',{},text('ac')+' '+compiled.stats.ac)));
      for(const issue of compiled.issues){const item=el('div',{class:'single-issue'},el('p',{},issueMessage(issue,report,a)));
        const decision=decisions.find(x=>x.choice?.id===issue.choiceId);if(decision)item.append(button(w('Corriger','Review'),()=>go(decision.id)));
        if(issue.choiceId&&['obsolete-choice','unavailable-selection','obsolete-origin-choice'].includes(issue.code))item.append(button(w('Conserver ce choix à part','Keep this choice for review'),()=>update(x=>retainDecision(x,issue.code==='obsolete-origin-choice'?'origin':'class',issue.choiceId))));
        body.append(item);
      }
      if(d.retainedDecisions?.length)body.append(el('details',{},el('summary',{},w('Choix conservés','Retained choices')),d.retainedDecisions.map((r,i)=>el('div',{},el('p',{},r.values.map(id=>optionName(id,a)).join(', ')),button(text('restore'),()=>update(x=>restoreDecision(x,i)))))));
      body.append(check(w('J’ai vérifié les éléments saisis et les choix à confirmer avec le MJ.','I reviewed my entries and the choices requiring GM confirmation.'),d.reviewed,e=>update(x=>{x.reviewed=e.target.checked;})));
      const save=button(w('Enregistrer le personnage','Save character'),async()=>{
        try{
          const result=compileDraft(a.context,a.config,{...d,confirmed:true});if(!result.valid){a.notice(text('missingChoices'));return;}
          const existing=await a.library.get(d.id),expectedCharacterRevision=existing?.definition.revision??null;
          result.character.revision=expectedCharacterRevision===null?1:expectedCharacterRevision+1;
          d.confirmed=true;d.status=result.status;
          d.sourceReferences=[...new Set([...result.character.features.filter(id=>a.context.index.get(id)),...result.character.spells.known,...[d.raceId,d.backgroundId].filter(Boolean)])];
          await a.autosave(d);const saved=await a.drafts.finalize(d,result.character,{expectedCharacterRevision,expectedDraftRevision:d.revision,spellbook:result.spellbook});Object.assign(d,saved.draft);await a.nav('library');
        }catch(e){a.fail(e);}
      },'primary');save.disabled=!compiled.valid;body.append(save);
    }
    const ready=decisionReady(current,report,d);
    const errors=current.choice?report.issues.filter(i=>i.choiceId===current.choice.id):[];
    if(errors.length)body.append(el('p',{class:'single-help',role:'status'},issueMessage(errors[0],report,a)));
    const actions=el('div',{class:'single-actions'}),back=button(text('back'),()=>position?go(decisions[position-1].id):a.nav('library'));
    actions.append(back);
    if(current.kind!=='summary'){const next=button(text('next'),()=>go(decisions[position+1].id),'primary');next.disabled=!ready;actions.append(next);}
    shell.append(actions);
    if(focus){body.querySelector('h1').focus({preventScroll:true});window.scrollTo({top:0});}
  }
  await draw();
}
