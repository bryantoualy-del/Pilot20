/** Display only: never changes acquisition or preparation policy. */
export function spellStatus(grants, preparedIds, {eligible=false, staged=null, spellId=null}={}) {
 const selected=new Set(preparedIds);
 if(grants.some(g=>g.preparation==='always'))return grants.every(g=>g.classId===null)?'granted':'always';
 if(staged&&eligible)return staged.includes(spellId)?'prepared':'unprepared';
 if(grants.some(g=>g.preparation==='daily'&&selected.has(g.id)))return 'prepared';
 if(grants.some(g=>g.preparation==='none'&&g.acquisition!=='legacy'))return grants.every(g=>g.route==='ritual')?'ritual':'known';
 if(grants.some(g=>selected.has(g.id)))return 'prepared';
 if(grants.some(g=>g.preparation==='daily')||eligible)return 'unprepared';
 return grants.length?'known':'catalogue';
}
export const spellStatusLabels={
 prepared:['Préparé','Prepared'],unprepared:['Non préparé','Not prepared'],always:['Toujours préparé','Always prepared'],
 granted:['Octroyé par une capacité','Granted by a feature'],known:['Connu','Known'],ritual:['Rituel uniquement','Ritual only'],catalogue:['Non acquis','Not acquired'],
};
