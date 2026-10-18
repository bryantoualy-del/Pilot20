/** Compact data authoring only; all acquisitions use resolveProgression/buildCharacter. */
export const originalSource=(id,section)=>({kind:'reference',document:({phb14:'Manuel des joueurs 2014',xge:'Guide complet de Xanathar',tce:'Chaudron des merveilles de Tasha'})[id]+' / '+section,license:'Pilot20-original-summary',url:'https://www.dndbeyond.com/sources/dnd/'+({phb14:'phb-2014',xge:'xgte',tce:'tcoe'})[id]});
export const resource=(id,from,max=1,recovery='long')=>({id,maxByLevel:Array.from({length:20},(_,i)=>i+1>=from?max:0),recovery});
export const manual=(economy='none',resourceId=null,requirements=[],target='self')=>({economy,target,maxTargets:1,resourceId,amount:resourceId?1:0,requirements:requirements.length?requirements:['Appliquer les conditions de la capacité ; résolution avec le MJ.']});
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
export function subclassCatalog(id,definitions){
 const items=[];
 for(const row of definitions){const sid=row.source+':'+row.classId+':'+row.key,source=originalSource(row.source,row.fr),grants=new Map();
  for(const [level,en,fr,description,extra={}]of row.features){const fid=sid+':'+slug(en);items.push({id:fid,type:'feature',name:{en,fr},source,data:{ruleset:'dnd5e-2014',rulesSourceId:row.source,classId:row.classId,minimumClassLevel:level,description,language:'fr',automation:{status:'manual',handler:null,limits:['Combat resolution and conditional outcomes require player/GM adjudication.']},...extra}});grants.set(level,[...(grants.get(level)??[]),fid]);}
  items.push({id:sid,type:'subclass',name:{en:row.en,fr:row.fr},source,data:{ruleset:'dnd5e-2014',rulesSourceId:row.source,classId:row.classId,grants:[...grants].map(([level,featureIds])=>({level,featureIds})),choices:row.choices??[],resources:row.resources??[],extraSpells:row.extraSpells??[],description:row.description??row.fr+' — aptitudes acquises selon le niveau de classe.',language:'fr',automation:{status:'manual',handler:null,limits:['Feature construction is integrated; combat resolution remains manual.']},...(row.data??{})}});
 }
 return{kind:'catalog',schemaVersion:3,ruleset:'dnd5e-2014',id,items};
}
