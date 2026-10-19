import {inventoryControls} from './inventory.js';
import {beginAdvancement,cancelAdvancement} from '../../src/creator/advancement.js';
import {sameDefinition} from '../../src/creator/revision.js';
import {classIcon} from './class-icons.js';
import {classInfo} from './class-info.js';
import {rollHitDie} from '../../src/creator/hit-points.js';
import {showEntryDetails} from './spell-detail.js';
import {spellMatches} from '../../src/catalog/spell-reference.js';
import {el,button,field,select,check,badge} from './dom.js';
import {migrateSingleDraft,singlePath,decisionReady} from '../../src/creator/single-path.js';
import {compileDraft,retainDecision,restoreDecision,templateScores,changePrimaryClass} from '../../src/creator/model.js';
import {renderRacePicker} from './race-picker.js';
import {ABILITIES,SKILLS} from '../../src/character/contracts.js';
import {POINT_COST,rollAbilityScores} from '../../src/catalog/origins.js';
import {ARMORS,WEAPONS} from '../../src/catalog/equipment.js';
import {optionName,choiceName,issueMessage} from './editor.js';
import {appearanceControls} from './appearance.js';
import {replacementOptions} from '../../src/catalog/spell-grants.js';

export async function renderCreator(main,input,a) {
  const d=migrateSingleDraft(input),w=(fr,en)=>a.state.locale==='fr'?fr:en;
  if(input.mode!=='single')await a.autosave(d);
  const initialBuild=compileDraft(a.context,a.config,{...d,confirmed:true}),initialRecord=await a.library.get(d.id);
  const expectedBaseDefinition=d.buildBaseline??initialBuild.character;
  const externalEdits=initialRecord&&!sameDefinition(initialRecord.definition,expectedBaseDefinition);
  const shell=el('section',{class:'single-creator'});main.append(shell);
  const filters=new Map();
  const swaps=new Map();
  const text=key=>a.t(key);
  const label=decision=>({identity:w('Votre personnage','Your character'),race:w('Choisissez votre race','Choose your race'),subrace:text('subrace'),class:w('Classe et niveau','Class and level'),background:text('background'),scores:text('scores'),'hit-points':w('Points de vie','Hit points'),'equipment-method':w('Votre équipement de départ','Your starting equipment'),equipment:text('equipment'),training:w('Maîtrises','Proficiencies'),summary:w('Votre personnage est-il prêt ?','Is your character ready?')})[decision.kind]??(decision.kind==='origin-choice'?(decision.choice.label?.[a.state.locale]??optionName(decision.choice.key,a)):decision.kind==='equipment-choice'?decision.choice.label[a.state.locale]:choiceName(decision.choice,a));
  async function update(fn,{navigation=false}={}) {
    d.finalized=false;d.status='draft';d.confirmed=false;d.reviewed=false;fn(d);
    await equipmentDefaults();await a.autosave(d);await draw(navigation);
  }
  async function equipmentDefaults(){
    if(!d.startingEquipmentEnabled||d.equipmentMethod==='wealth')return;
    for(let pass=0;pass<8;pass++){const report=singlePath(a.context,a.config,d).report;const missing=(report.startingEquipment?.choices??[]).filter(q=>!d.startingEquipmentChoices?.[q.id]?.length);if(!missing.length)return;d.startingEquipmentChoices??={};for(const q of missing)if(q.options[0])d.startingEquipmentChoices[q.id]=[q.options[0].id];}
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
    const single=q.count===1&&q.kind!=='prepared';
    const filter=filters.get(q.id)??{query:'',page:0};filters.set(q.id,filter);
    const wrap=el('div',{'data-choice-id':q.id,class:'single-choice'}),list=el('div',{class:'single-options'}),pages=el('div',{class:'single-pages'});
    const title=q.classId?choiceName(q,a):q.label?.[a.state.locale]??q.key.replaceAll('-',' ');
    wrap.append(el('p',{class:'single-choice-count',role:'status'},title+' · '+values.length+' / '+q.count+(q.kind==='prepared'?w(' au maximum',' maximum'):'')));
    const search=el('input',{type:'search','aria-label':w('Rechercher une option','Search options'),placeholder:w('Rechercher en français ou en anglais…','Search French or English…'),value:filter.query,oninput:e=>{filter.query=e.target.value;filter.page=0;fill();}});
    if(q.options.length>8)wrap.append(search);
    function fill(){
      const query=filter.query.toLocaleLowerCase();
      const options=q.options.filter(id=>a.context.index.get(id)?.type==='spell'?spellMatches(id,query,a.context.index.get(id)):[optionName(id,a),...Object.values(a.context.installed.get(id)?.name??{}),...(a.context.installed.get(id)?.data.aliases??[])].join(' ').toLocaleLowerCase().includes(query));
      const pageCount=Math.max(1,Math.ceil(options.length/8));filter.page=Math.min(filter.page,pageCount-1);
      list.replaceChildren();
      if(!options.length)list.append(el('p',{},w('Aucun résultat. Essayez un autre nom.','No results. Try another name.')));
      const others=new Set(q.kind==='skill'?[...(singlePath(a.context,a.config,d).report.origin?.background.skills??[]),...Object.entries(d.selections).filter(([id])=>id!==q.id&&id.endsWith(':skills')).flatMap(([,v])=>v)]:[]);
      for(const id of options.slice(filter.page*8,(filter.page+1)*8)){
        const entry=a.context.index.get(id),selected=values.includes(id),disabled=!selected&&(!single&&values.length>=q.count||others.has(id));
        const input=el('input',{type:single?'radio':'checkbox',name:q.id,checked:selected,disabled:disabled||q.requiredOptions?.includes(id),'aria-label':optionName(id,a),onchange:e=>onchange(e.target.checked?single?[id]:[...values,id]:values.filter(x=>x!==id))});
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
    const body=el('div',{class:'single-body','data-decision-id':current.id,'data-kind':current.kind},el('h1',{tabindex:-1},label(current)),el('p',{class:'single-edition'},'D&D 2014'));
    const saveState=el('span',{id:'draft-save-state',role:'status'},text(d.finalized?'saved':'draftSaved'));
    const exit=button(w('Quitter','Exit'),async()=>{try{await a.autosave(d);await a.nav('library');}catch(e){a.fail(e);}});
    exit.setAttribute('aria-label',text('saveAndExit'));exit.title=text('saveAndExit');
    const header=el('div',{class:'single-heading'},el('span',{},d.name||w('Nouveau personnage','New character')),saveState,exit);
    const groupOf=x=>x.kind==='origin-choice'?'origin':x.kind==='class-choice'?(['spell','spellbook','prepared'].includes(x.choice.kind)?'spells':'features'):['equipment-choice','equipment-method'].includes(x.kind)?'equipment':x.kind==='subrace'?'race':x.kind;
    const groups=[...new Set(decisions.map(groupOf))];
    const groupNames={identity:text('name'),race:text('race'),class:text('class'),background:text('background'),scores:text('scores'),'hit-points':text('hp'),origin:w('Origine et maîtrises','Origin and training'),features:w('Capacités','Features'),spells:w('Sorts','Spells'),equipment:text('equipment'),training:w('Maîtrises','Proficiencies'),summary:w('Récapitulatif','Summary')};
    const sectionNav=el('details',{class:'single-plan'},el('summary',{},el('span',{},w('Création du personnage','Character creation')),el('span',{class:'single-step-count'},`${position+1} / ${decisions.length}`)),el('nav',{'aria-label':w('Étapes de création','Creation steps')},groups.map(group=>{
      const decision=decisions.find(x=>groupOf(x)===group);const b=button(groupNames[group],()=>go(decision.id));if(group===groupOf(current))b.setAttribute('aria-current','step');return b;
    })));
    const progress=el('progress',{class:'single-progress',value:position+1,max:decisions.length,'aria-label':w('Progression de la création','Character creation progress'),'aria-valuetext':`${position+1} / ${decisions.length} · ${label(current)}`});
    shell.replaceChildren(header,sectionNav,progress,body);
    if(d.pendingAdvancement)body.append(el('p',{role:'status'},w('Progression en cours : ','Level gain in progress: ')+a.cls(d.pendingAdvancement.classId)),button(w('Annuler ce gain de niveau','Cancel this level gain'),async()=>{const restored=cancelAdvancement(d);Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,restored);await a.autosave(d);await draw(true);}));
    if(current.kind==='identity'){
      body.append(field(text('name'),el('input',{id:'character-name',value:d.name,maxlength:200,autocomplete:'off',onchange:e=>update(x=>{x.name=e.target.value;})})),
        el('p',{},w('Un nom suffit pour commencer. Vous pourrez le changer ensuite.','Start with a name. You can change it later.')),
        el('details',{},el('summary',{},w('Portrait et apparence — facultatif','Portrait and appearance — optional')),appearanceControls(a,d,update)));
    }
    if(current.kind==='race'){
      body.append(renderRacePicker(d,a,update,filters));
      if(report.origin?.race){const o=report.origin;body.append(el('section',{class:'race-facts','aria-live':'polite'},el('h2',{},a.name(o.race)),el('dl',{class:'spell-facts'},...[[w('Bonus','Bonuses'),Object.entries(o.bonuses??{}).filter(([,v])=>v).map(([k,v])=>a.label(k)+' +'+v).join(', ')||w('À choisir dans Caractéristiques','Choose in Ability scores')],[w('Taille','Size'),optionName(o.size,a)],[w('Vitesse','Speed'),(o.speed/5*1.5).toLocaleString(a.state.locale)+' m'],[w('Langues','Languages'),(o.languages??[]).map(id=>optionName(id,a)).join(', ')]].flatMap(([k,v])=>[el('dt',{},k),el('dd',{},v)])),el('ul',{},(o.traits??[]).filter(t=>[o.race.id,o.subrace?.id].includes(t.ownerId)).map(t=>el('li',{},t.name?.[a.state.locale]??t.id,t.description?el('p',{},t.description):null))),button(w('Tous les détails','All details'),()=>details(o.race))));}
    }
    if(current.kind==='subrace'){
      const race=report.origin.race;
      for(const sub of race.data.subraces)body.append(button(sub.name[a.state.locale],()=>update(x=>{x.subraceId=sub.id;}),d.subraceId===sub.id?'selected':''));
    }
    if(current.kind==='class'){
      const cls=d.classes[0];
      const classes=el('div',{class:'single-classes',role:'group','aria-label':text('class')});
      for(const entry of a.context.index.list('class').sort((a1,b1)=>a.cls(a1.data.classId).localeCompare(a.cls(b1.data.classId),a.state.locale))){const id=entry.data.classId,selected=d.classChosen!==false&&cls.id===id,b=button([classIcon(id),el('span',{},a.cls(id))],()=>update(x=>{changePrimaryClass(x,id);}),selected?'selected':'');b.setAttribute('aria-pressed',String(selected));b.disabled=d.classes.slice(1).some(c=>c.id===id);classes.append(b);}
      body.append(classes);
      if(d.classChosen!==false){const info=classInfo(cls.id,a.state.locale);if(info)body.append(el('p',{},info.description));const primary=Object.entries(templateScores(cls.id)).find(([,value])=>value===15)?.[0];body.append(el('p',{},w('Caractéristique conseillée : ','Suggested ability: ')+a.label(primary)));}
      const grants=[...(a.context.index.class(cls.id)?.data.grants??[]),...(a.context.index.get(cls.subclassId)?.data.grants??[])].filter(row=>row.level<=cls.level);
      const levels=[...new Set(grants.map(row=>row.level))].sort((a,b)=>a-b);
      body.append(el('details',{},el('summary',{},w('Capacités par niveau','Features by level')),levels.map(level=>el('div',{class:'feature-level'},el('strong',{},text('level')+' '+level),el('div',{class:'feature-buttons'},grants.filter(row=>row.level===level).flatMap(row=>row.featureIds).map(id=>{const entry=a.context.index.get(id);return entry?button(a.name(entry),()=>details(entry),'subtle'):null;}))))));
      body.append(field(text('level'),el('input',{type:'number',min:1,max:20,value:cls.level,onchange:e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n+d.classes.slice(1).reduce((s,c)=>s+c.level,0)<=20)update(x=>{x.classes[0].level=n;});else a.notice(w('Le niveau total doit rester entre 1 et 20.','Total level must stay between 1 and 20.'));}})));
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
        d.scoreMethod==='point-buy'?null:check(w('Ajouter les bonus raciaux aux valeurs ci-dessous','Add racial bonuses to the scores below'),d.scoresAreBase,e=>update(x=>{x.scoresAreBase=e.target.checked;})));
      if(d.scoreMethod==='rolled')body.append(button(text('rollScores'),()=>update(x=>{const r=rollAbilityScores();x.scoreRolls=r.rolls;x.scores=Object.fromEntries(ABILITIES.map((k,i)=>[k,r.values[i]]));})));
      const spent=Object.values(d.scores).reduce((sum,n)=>sum+(POINT_COST[n]??100),0);
      if(d.scoreMethod==='point-buy'){
        const validScores=Object.values(d.scores).every(n=>Object.hasOwn(POINT_COST,n));
        const remaining=Math.max(0,27-spent);
        body.append(el('section',{class:'score-budget point-budget','aria-label':w('Budget de points','Point-buy budget')},
          el('div',{class:'score-budget-head'},el('span',{},w('Points utilisés','Points spent')),
            el('strong',{class:'score-budget-total',role:'status','aria-live':'polite'},validScores?spent+' / 27':w('Valeurs invalides','Invalid scores'))),
          el('progress',{value:validScores?Math.min(27,spent):0,max:27,'aria-label':w('Points utilisés sur 27','Points spent out of 27')}),
          el('p',{class:'single-help'},validScores?(remaining?remaining+' '+w('points restants · utilisez les + et − pour les répartir.','points remaining · use + and − to allocate them.'):w('27 points attribués.','All 27 points allocated.')):w('Les valeurs de base doivent être comprises entre 8 et 15.','Base scores must be between 8 and 15.'))));
      }else if(d.scoreMethod==='standard'){
        body.append(el('div',{class:'score-mode-hint'},el('span',{},w('Le tableau standard est fixe. Le budget de 27 points appartient à la méthode Achat de points.','The standard array is fixed. The 27-point budget is available with Point buy.')),
          button(w('Répartir 27 points','Use 27-point buy'),()=>update(x=>{x.scoreMethod='point-buy';x.scoresAreBase=true;x.scores=Object.fromEntries(ABILITIES.map(k=>[k,8]));}),'subtle')));
      }
      const grid=el('table',{class:'score-table'},el('thead',{},el('tr',{},['',w('Valeur brute','Base'),w('Coût','Cost'),w('Bonus racial','Racial bonus'),w('Valeur finale','Final')].map(t=>el('th',{},t))))),rows=el('tbody',{});
      const scoreChoices=(report.origin?.choices??[]).filter(q=>q.kind==='score');
      const patterns=(report.origin?.choices??[]).filter(q=>q.key==='ability-pattern');
      for(const q of patterns)body.append(field(q.label[a.state.locale],select([['',w('Choisir','Choose')],...q.options.map(id=>[id,optionName(id,a)])],d.originSelections?.[q.id]?.[0]??'',e=>update(x=>{x.originSelections??={};x.originSelections[q.id]=e.target.value?[e.target.value]:[];for(const key of Object.keys(x.originSelections))if(key.startsWith(q.ownerId+':ability-bonus-'))delete x.originSelections[key];}))));
      for(const ability of ABILITIES){
        const n=d.scores[ability],min=d.scoreMethod==='point-buy'?8:1,max=d.scoreMethod==='point-buy'?15:30;
        const change=delta=>update(x=>{
          const current=x.scores[ability],next=current+delta;
          if(next<min||next>max)return;
          const total=Object.values(x.scores).reduce((sum,v)=>sum+(POINT_COST[v]??100),0);
          if(x.scoreMethod==='point-buy'&&total+(POINT_COST[next]??100)-(POINT_COST[current]??100)>27)return;
          x.scores[ability]=next;
        });
        const minus=button('−',()=>change(-1)),plus=button('+',()=>change(1));
        minus.setAttribute('aria-label',w('Diminuer ','Decrease ')+a.label(ability));plus.setAttribute('aria-label',w('Augmenter ','Increase ')+a.label(ability));
        minus.disabled=n<=min;plus.disabled=n>=max||(d.scoreMethod==='point-buy'&&spent+POINT_COST[n+1]-POINT_COST[n]>27);
        const bonus=el('div',{class:'racial-bonus'});
        for(const q of scoreChoices){const values=d.originSelections?.[q.id]??[],selected=values.includes(ability);bonus.append(el('label',{},el('input',{type:q.count===1?'radio':'checkbox',name:q.id,checked:selected,disabled:!selected&&(!q.options.includes(ability)||values.length>=q.count&&q.count!==1),'aria-label':a.label(ability)+' +'+q.amount,onchange:e=>update(x=>{x.originSelections??={};x.originSelections[q.id]=e.target.checked?(q.count===1?[ability]:[...values,ability]):values.filter(v=>v!==ability);})}),el('span',{},'+'+q.amount)));}
        if(!scoreChoices.length)bonus.append(el('span',{},'+'+(report.origin?.bonuses?.[ability]??0)));
        const final=report.scores?.[ability]??n,mod=Math.floor((final-10)/2);
        rows.append(el('tr',{},el('th',{scope:'row'},a.label(ability)),el('td',{},el('div',{class:'score-stepper'},minus,el('output',{},n),plus)),el('td',{},d.scoreMethod==='point-buy'?(POINT_COST[n]??'—'):'—'),el('td',{},bonus),el('td',{},el('strong',{},final+' ('+(mod>=0?'+':'')+mod+')'))));
      }
      grid.append(rows);body.append(grid);
      body.append(el('p',{},w('Points de vie prévus : ','Estimated hit points: ')+(report.hpPreview??'—')));
    }
    if(current.kind==='hit-points'){
      body.append(field(w('Gain de points de vie','Hit point gains'),select([['average',w('Valeur fixe des dés','Fixed die values')],['rolled',w('Résultats des dés lancés','Rolled die results')]],d.hpMode??'average',e=>update(x=>{x.hpMode=e.target.value;}))),
        el('p',{},w('Au premier niveau du personnage, le dé de vie donne automatiquement sa valeur maximale. La Constitution s’applique à chaque niveau, avec au moins 1 PV gagné.','At the character’s first level, the Hit Die automatically gives its maximum. Constitution applies at each level, with at least 1 HP gained.')));
      const rows=el('div',{class:'single-hp'});
      for(const row of report.hitPoints?.levels??[]){
        const title=w('Niveau ','Level ')+row.characterLevel+' · '+a.cls(row.classId)+' '+row.classLevel+' · d'+row.hitDie;
        if(row.first||report.hitPoints.mode==='average')rows.append(el('p',{},title+' : '+row.hp));
        else rows.append(field(title,el('input',{type:'number',min:1,max:row.hitDie,value:d.hpRolls?.[row.key]??'','aria-label':title,onchange:e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=row.hitDie)update(x=>{x.hpRolls??={};x.hpRolls[row.key]=n;});}}),button(w('Lancer le dé','Roll die'),()=>update(x=>{x.hpRolls??={};x.hpRolls[row.key]=rollHitDie(row.hitDie);})))) ;
      }
      body.append(rows,el('p',{role:'status'},w('Total prévu : ','Estimated total: ')+(report.hpPreview??'—')));
    }
    if(current.kind==='training'){
      const fixed=[...(report.origin?.background?.skills??[]),...(report.origin?.languages??[]),...(report.origin?.background?.proficiencies??[])];
      if(fixed.length)body.append(el('p',{},w('Déjà accordées : ','Already granted: ')+[...new Set(fixed)].map(id=>optionName(id,a)).join(', ')));
      for(const q of current.classChoices)body.append(el('section',{},el('h2',{},choiceName(q,a)),choiceList(q,report.selections?.[q.id]??d.selections[q.id]??[],values=>update(x=>{x.selections[q.id]=values;}))));
      for(const q of current.originChoices)body.append(el('section',{},el('h2',{},q.label?.[a.state.locale]??optionName(q.key,a)),choiceList(q,d.originSelections?.[q.id]??[],values=>update(x=>{x.originSelections??={};x.originSelections[q.id]=values;}))));
    }
    if(current.kind==='origin-choice')body.append(choiceList(current.choice,d.originSelections?.[current.choice.id]??[],values=>update(x=>{x.originSelections??={};x.originSelections[current.choice.id]=values;}),{origin:true}));
    if(current.kind==='class-choice'){
      const q=current.choice;body.append(el('p',{},a.cls(q.classId)+' · '+text('level')+' '+q.level));
      const values=q.kind==='subclass'?[d.classes.find(c=>c.id===q.classId)?.subclassId].filter(Boolean):report.selections?.[q.id]??d.selections[q.id]??[];
      const saveChoice=values=>update(x=>{
        if(q.kind==='subclass'){const c=x.classes.find(c=>c.id===q.classId);if(c.subclassId&&c.subclassId!==values[0])retainDecision(x,'subclass',q.classId);c.subclassId=values[0]??null;}else x.selections[q.id]=values;
      });
      if(q.kind==='asi'){
        if(!a.config.enabledOptions.includes('feats'))body.append(el('p',{},w('Les dons sont désactivés dans cette campagne. Vous pouvez les autoriser ci-dessous.','Feats are disabled for this campaign. You can enable them below.')),button(w('Autoriser les dons pour cette campagne','Enable feats for this campaign'),async()=>{const next={...a.config,revision:a.config.revision+1,enabledOptions:[...a.config.enabledOptions,'feats']};await a.campaigns.save(next,{expectedRevision:a.config.revision});await a.nav('creator',d.id);}));
        const selected=values[0]??'',isFeat=selected&&!selected.startsWith('asi:'),feats=q.options.filter(id=>!id.startsWith('asi:'));
        const state=filters.get(q.id)??{mode:isFeat?'feat':'scores',pair:selected.startsWith('asi:')?selected.split(':').slice(1):['','']};filters.set(q.id,state);
        body.append(field(w('Choix','Choice'),select([['scores',w('Caractéristiques','Ability scores')],['feat',w('Don','Feat')]],state.mode,e=>{state.mode=e.target.value;saveChoice([]);})));
        if(state.mode==='feat')body.append(field(w('Don','Feat'),select([['',w('Choisir un don','Choose a feat')],...feats.map(id=>[id,optionName(id,a)])],isFeat?selected:'',e=>saveChoice(e.target.value?[e.target.value]:[]))));
        else for(const i of [0,1])body.append(field('+1 · '+(i+1),select([['',w('Choisir une caractéristique','Choose an ability')],...ABILITIES.map(id=>[id,a.label(id)])],state.pair[i],e=>{state.pair[i]=e.target.value;const [x,y]=state.pair,id=q.options.find(id=>id===`asi:${x}:${y}`||id===`asi:${y}:${x}`);saveChoice(id?[id]:[]);})));
      }else body.append(choiceList(q,values,saveChoice));
      if(q.id==='cleric:nature-cantrip')body.append(el('p',{class:'single-help'},w('Le domaine de la Nature accorde un sort mineur de druide. Il reste un sort de clerc pour vous.','The Nature domain grants one druid cantrip, which counts as a cleric cantrip for you.')));
      if(q.id==='ranger:beast-companion'&&values.includes('phb14:ranger:companion:other'))body.append(field(w('Nom de la bête, FP et référence du profil','Beast name, CR and profile reference'),el('textarea',{value:d.companionNotes??'',maxlength:3000,onchange:e=>update(x=>{x.companionNotes=e.target.value;})})));
      if(q.id===q.classId+':known-spells'){const exchanges=originSpellExchanges(q.classId);if(exchanges)body.append(exchanges);}
    }
    if(current.kind==='equipment-method')body.append(el('p',{},w('Choisissez le matériel de classe et d’historique, ou la richesse initiale pour acheter votre matériel. Les choix de chaque méthode restent conservés.','Choose class and background equipment, or starting wealth to buy your gear. Each method retains its choices.')),field(w('Méthode','Method'),select([['kit',w('Matériel de classe et d’historique','Class and background equipment')],['wealth',w('Richesse initiale et achats','Starting wealth and purchases')]],d.equipmentMethod??'kit',e=>update(x=>{x.equipmentMethod=e.target.value;}))));
    if(current.kind==='equipment-choice'){
      const q=current.choice,selected=d.startingEquipmentChoices?.[q.id]?.[0];
      body.append(el('div',{class:'single-options'},q.options.map(o=>el('div',{class:'single-option'+(o.id===selected?' selected':'')},el('label',{},el('input',{type:'radio',name:q.id,checked:o.id===selected,'aria-label':o.name[a.state.locale],onchange:()=>update(x=>{x.startingEquipmentChoices??={};x.startingEquipmentChoices[q.id]=[o.id];})}),el('span',{},o.name[a.state.locale]))))));
    }
    if(current.kind==='equipment'&&d.startingEquipmentEnabled===true){
      body.append(field(w('Méthode','Method'),select([['kit',w('Matériel de départ','Starting kit')],['wealth',w('Achats','Purchases')]],d.equipmentMethod??'kit',e=>update(x=>{x.equipmentMethod=e.target.value;}))));
      for(const q of report.startingEquipment?.choices??[])body.append(field(q.label[a.state.locale],select(q.options.map(o=>[o.id,o.name[a.state.locale]]),d.startingEquipmentChoices?.[q.id]?.[0]??'',e=>update(x=>{x.startingEquipmentChoices??={};x.startingEquipmentChoices[q.id]=[e.target.value];}))));
      body.append(el('p',{},w('Votre matériel de départ, en complément de celui de votre historique.','Your starting kit, in addition to your background equipment.')),
        el('ul',{},(report.startingEquipment?.items??[]).map(i=>el('li',{},i.quantity+' × '+i.name[a.state.locale]))),
        el('details',{},el('summary',{},w('Équipement de l’historique','Background equipment')),(report.origin?.equipment??[]).map(i=>el('p',{},i.name[a.state.locale]))),
        el('p',{},w('Les sélections ci-dessus modifient votre matériel.','Change your kit with the selectors above.')));
    }
    if(current.kind==='equipment'&&d.startingEquipmentEnabled!==true){
      body.append(field(text('armor'),select(Object.entries(ARMORS).map(([id,v])=>[id,v.name[a.state.locale]]).concat([['none',text('unarmored')]]),d.equipment,e=>update(x=>{x.equipment=e.target.value;}))),check(text('shield'),d.shield,e=>update(x=>{x.shield=e.target.checked;})),
        el('details',{},el('summary',{},text('weapons')),Object.entries(WEAPONS).map(([id,item])=>check(item.name[a.state.locale],d.weapons?.includes(id)??false,e=>update(x=>{x.weapons=e.target.checked?[...(x.weapons??[]),id]:(x.weapons??[]).filter(v=>v!==id);})))),
        el('p',{},w('Ancienne fiche : ces sélections d’équipement sont conservées. Le matériel supplémentaire peut être ajouté ci-dessous.','Legacy sheet: existing equipment choices are retained. Additional equipment can be added below.')));
    }
    if(current.kind==='equipment'){body.append(inventoryControls(d,a,update));const built=compileDraft(a.context,a.config,{...d,confirmed:true,reviewed:true});if(built.character||built.equipmentPreview)body.append(el('details',{},el('summary',{},w('Porter ou ranger le matériel','Equip or stow equipment')),(built.equipmentPreview??built.character.equipment).filter(e=>['armor','shield','weapon'].includes(e.kind)).map(e=>check(e.name?.[a.state.locale]??e.id,e.equipped,event=>update(x=>{x.unequippedItems=event.target.checked?(x.unequippedItems??[]).filter(id=>id!==e.id):[...new Set([...(x.unequippedItems??[]),e.id])];})))));} 
    if(current.kind==='summary'){
      const compiled=compileDraft(a.context,a.config,{...d,confirmed:true});
      body.append(el('p',{},d.classes.map(c=>a.cls(c.id)+' '+c.level).join(' / ')));
      if(compiled.stats)body.append(el('div',{class:'single-summary'},el('p',{},text('hp')+' '+compiled.stats.maxHp),el('p',{},text('ac')+' '+compiled.stats.ac)));
      // Le récapitulatif se construit à partir du même état que le parcours :
      // aucun choix manquant n'est remplacé par une suggestion silencieuse.
      const recap=el('div',{class:'single-recap','aria-label':w('Récapitulatif des choix','Choice recap')});
      const recapRow=(name,value,target,valid=true)=>{
        const row=el('div',{class:'recap-row'+(valid?'':' recap-incomplete')},
          el('div',{class:'recap-content'},el('strong',{},name),
            el('p',{},value||w('À compléter','To complete'))),
          button(w('Modifier','Edit'),()=>go(target),'subtle'));
        return row;
      };
      const recapSection=(heading,rows)=>{
        if(!rows.length)return;
        recap.append(el('section',{class:'recap-section'},el('h2',{},heading),...rows));
      };
      const chosen=x=>{
        const q=x.choice;
        if(x.kind==='origin-choice')return d.originSelections?.[q.id]??[];
        if(q.kind==='subclass')return [d.classes.find(c=>c.id===q.classId)?.subclassId].filter(Boolean);
        return report.selections?.[q.id]??d.selections?.[q.id]??[];
      };
      const decisionRow=x=>{
        const values=chosen(x),readyChoice=decisionReady(x,report,d);
        const name=x.kind==='origin-choice'?(x.choice.label?.[a.state.locale]??optionName(x.choice.key,a)):choiceName(x.choice,a);
        const empty=readyChoice?w('Aucun choix requis','No selection required'):w('À compléter','To complete');
        return recapRow(name,values.map(id=>optionName(id,a)).join(' · ')||empty,x.id,readyChoice);
      };
      const origin=report.origin??{};
      const ancestry=[origin.race&&a.name(origin.race),origin.subrace&&a.name(origin.subrace)].filter(Boolean).join(' · ');
      const classes=d.classes.map(c=>{
        const subclass=c.subclassId?a.context.index.get(c.subclassId):null;
        return a.cls(c.id)+' '+c.level+(subclass?' · '+a.name(subclass):'');
      }).join(' / ');
      const backgroundEntry=d.backgroundId?a.context.index.get(d.backgroundId):null;
      const background=backgroundEntry?a.name(backgroundEntry):d.background.name;
      const points=Object.values(d.scores).reduce((total,n)=>total+(POINT_COST[n]??100),0);
      const scores=ABILITIES.map(key=>{
        const n=report.scores?.[key]??d.scores[key],mod=Math.floor((n-10)/2);
        return a.label(key)+' '+n+' ('+(mod>=0?'+':'')+mod+')';
      }).join(' · ');
      recapSection(w('Personnage','Character'),[
        recapRow(w('Nom','Name'),d.name,'identity'),
        recapRow(w('Race et ascendance','Race and ancestry'),ancestry,'race',!!origin.race),
        recapRow(w('Classe, niveau et spécialisation','Class, level and specialization'),classes,'class'),
        recapRow(w('Historique','Background'),background,'background',!!background),
        recapRow(w('Caractéristiques finales','Final ability scores'),scores+(d.scoreMethod==='point-buy'?' · '+points+' / 27':''),'scores',decisionReady({kind:'scores'},report,d)),
        recapRow(w('Points de vie','Hit points'),String(report.hpPreview??'—'),'hit-points',report.hitPoints?.valid===true)
      ]);
      const training=decisions.find(x=>x.kind==='training');
      const fixedTraining=[...(origin.background?.skills??[]),...(origin.languages??[]),...(origin.background?.proficiencies??[])];
      const trainingRows=fixedTraining.length?[recapRow(w('Accordées par l’origine','Granted by origin'),[...new Set(fixedTraining)].map(id=>optionName(id,a)).join(' · '),'training')]:[];
      if(training)for(const q of [...training.classChoices,...training.originChoices]){
        const x={kind:training.originChoices.includes(q)?'origin-choice':'class-choice',choice:q,id:'training'};
        trainingRows.push(recapRow(q.classId?choiceName(q,a):(q.label?.[a.state.locale]??optionName(q.key,a)),
          chosen(x).map(id=>optionName(id,a)).join(' · ')||w('À compléter','To complete'),'training',decisionReady(x,report,d)));
      }
      recapSection(w('Maîtrises et langues','Proficiencies and languages'),trainingRows);
      const extraChoices=decisions.filter(x=>['origin-choice','class-choice'].includes(x.kind));
      const magicKinds=new Set(['spell','spellbook','prepared']);
      recapSection(w('Capacités, dons et autres choix','Features, feats and other choices'),extraChoices.filter(x=>!magicKinds.has(x.choice.kind)).map(decisionRow));
      recapSection(w('Sorts et grimoire','Spells and spellbook'),extraChoices.filter(x=>magicKinds.has(x.choice.kind)).map(decisionRow));
      const equipment=[...(report.startingEquipment?.items??[]),...(origin.equipment??[])].map(item=>(item.quantity??1)+' × '+(item.name?.[a.state.locale]??item.id));
      const additional=(d.inventoryLedger??[]).map(item=>item.quantity+' × '+(item.customName||item.itemId));
      recapSection(w('Équipement','Equipment'),[
        recapRow(w('Méthode','Method'),d.equipmentMethod==='wealth'?w('Richesse initiale et achats','Starting wealth and purchases'):w('Matériel de départ','Starting equipment'),'equipment'),
        recapRow(w('Équipement choisi','Chosen equipment'),[...equipment,...additional].join(' · ')||w('Aucun équipement sélectionné','No equipment selected'),'equipment',report.economy?.valid!==false)
      ]);
      body.append(recap);
      const events=d.advancementEvents??[];body.append(el('details',{},el('summary',{},w('Historique de progression','Advancement history')),el('p',{},d.advancementHistory?.length?w('Historique complet renseigné ; sa validité est contrôlée à la sauvegarde.','Complete history supplied; validation runs on save.'):w('Création directe au niveau choisi : les acquisitions antérieures ne sont pas connues. Aucun niveau passé n’a été inventé.','Created directly at the selected level: earlier acquisitions are unknown. No past levels were invented.')),events.map(e=>el('p',{},a.cls(e.classId)+' · '+e.from.classes.reduce((n,c)=>n+c.level,0)+' → '+e.to.classes.reduce((n,c)=>n+c.level,0)+' · '+new Date(e.recordedAt).toLocaleDateString(a.state.locale)))));
      if(d.finalized&&!externalEdits&&!d.pendingAdvancement&&d.classes.reduce((n,c)=>n+c.level,0)<20)body.append(el('details',{},el('summary',{},w('Gagner un niveau','Gain a level')),d.classes.map(c=>button(a.cls(c.id)+' → '+(c.level+1),async()=>{const next=beginAdvancement(d,c.id);Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,next);await a.autosave(d);await draw(true);})),a.config.enabledOptions.includes('multiclass')?a.context.index.list('class').filter(c=>!d.classes.some(x=>x.id===c.data.classId)).map(c=>button(w('Nouvelle classe : ','New class: ')+a.cls(c.data.classId),async()=>{const next=beginAdvancement(d,c.data.classId);Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,next);await a.autosave(d);await draw(true);})):null));
      for(const issue of compiled.issues){const item=el('div',{class:'single-issue'},el('p',{},issueMessage(issue,report,a)));
        const decision=decisions.find(x=>x.choice?.id===issue.choiceId);if(decision)item.append(button(w('Corriger','Review'),()=>go(decision.id)));
        if(issue.choiceId&&['obsolete-choice','unavailable-selection','obsolete-origin-choice'].includes(issue.code))item.append(button(w('Conserver ce choix à part','Keep this choice for review'),()=>update(x=>retainDecision(x,issue.code==='obsolete-origin-choice'?'origin':'class',issue.choiceId))));
        body.append(item);
      }
      if(d.retainedDecisions?.length)body.append(el('details',{},el('summary',{},w('Choix conservés','Retained choices')),d.retainedDecisions.map((r,i)=>el('div',{},el('p',{},r.values.map(id=>optionName(id,a)).join(', ')),button(text('restore'),()=>update(x=>restoreDecision(x,i)))))));
      body.append(check(w('J’ai vérifié les éléments saisis et les choix à confirmer avec le MJ.','I reviewed my entries and the choices requiring GM confirmation.'),d.reviewed,e=>update(x=>{x.reviewed=e.target.checked;})));
      if(externalEdits)body.append(el('p',{role:'alert'},w('Cette fiche contient des modifications manuelles ou son ancien plan ne correspond plus au catalogue. La fiche actuelle sera conservée ; enregistrez votre nouvelle construction comme copie.','This sheet has manual edits or its old plan differs from the current catalog. Keep the original and save this build as a copy.')),button(w('Enregistrer comme copie','Save as a copy'),async()=>{const copy=structuredClone(d);copy.id=crypto.randomUUID();copy.name+=' (copie)';copy.revision=1;copy.finalized=false;delete copy.buildBaseline;await a.drafts.save(copy);await a.nav('creator',copy.id);}));
      const save=button(w('Enregistrer le personnage','Save character'),async()=>{
        try{
          const result=compileDraft(a.context,a.config,{...d,confirmed:true});if(!result.valid){a.notice(text('missingChoices'));return;}
          const existing=await a.library.get(d.id),expectedCharacterRevision=existing?.definition.revision??null;
          result.character.revision=expectedCharacterRevision===null?1:expectedCharacterRevision+1;
          d.confirmed=true;d.status=result.status;
          d.sourceReferences=[...new Set([...result.character.features.filter(id=>a.context.index.get(id)),...result.character.spells.known,...[d.raceId,d.backgroundId].filter(Boolean)])];
          await a.autosave(d);const saved=await a.drafts.finalize(d,result.character,{expectedCharacterRevision,expectedDraftRevision:d.revision,spellbook:result.spellbook,expectedBaseDefinition});Object.assign(d,saved.draft);await a.nav('library');a.notice(text('characterSaved'));
        }catch(e){a.fail(e);}
      },'primary');save.disabled=!compiled.valid||!!externalEdits;body.append(save);
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
  await equipmentDefaults();await a.autosave(d);await draw();
}
