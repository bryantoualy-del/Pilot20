import {el} from './dom.js';

export function capabilityList(grants,levelNow,title,a,details){
    const w=(fr,en)=>a.state.locale==='fr'?fr:en,text=key=>a.t(key);
    const panel=el('details',{class:'class-capabilities'},el('summary',{},title));
    const levels=[...new Set(grants.map(row=>row.level).filter(level=>level>=1&&level<=20))].sort((a,b)=>a-b);
    for(const level of levels){
      const ids=[...new Set(grants.filter(row=>row.level===level).flatMap(row=>row.featureIds??[]))];
      const entries=ids.map(id=>a.context.index.get(id)).filter(Boolean);
      if(!entries.length)continue;
      const future=levelNow!=null&&level>levelNow,current=level===levelNow;
      const name=el('span',{class:'capability-level-title'},text('level')+' '+level);
      const meta=el('span',{class:'capability-level-meta'},
        ...(current?[el('span',{class:'capability-current'},w('Actuel','Current'))]:[]),
        ...(future?[el('span',{class:'capability-lock','aria-label':w('Non débloqué','Not unlocked')},'🔒')]:[]),
        el('span',{class:'capability-level-count'},entries.length+' '+(entries.length===1?w('capacité','feature'):w('capacités','features'))));
      panel.append(el('details',{class:'capability-level'+(future?' is-future':'')+(current?' is-current':''),open:!future},
        el('summary',{},name,meta),
        el('div',{class:'capability-entries'},entries.map(entry=>el('button',{
          type:'button',class:'capability-entry','aria-haspopup':'dialog',
          'aria-label':w('Informations sur ','Information about ')+a.name(entry),onclick:()=>details(entry)},
          el('span',{},a.name(entry)),el('span',{class:'capability-info','aria-hidden':'true'},'i'))))));
    }
    return panel;
  }
