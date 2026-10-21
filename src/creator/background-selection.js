import {retainDecision} from './model.js';
/** Change the catalogue choice without leaving invisible mandatory decisions behind. */
export function selectBackground(context,d,value){
 const next=value||null,entry=next?context.index.get(next):null;
 if(next&&entry?.type!=='background')throw Error('Unknown background');
 if(d.backgroundId===next)return;
 const old=context.installed.get(d.backgroundId),shared=new Set(entry?.data.grantedFeatIds??[]);
 for(const key of Object.keys(d.originSelections??{}))if(d.backgroundId&&key.startsWith(d.backgroundId+':'))retainDecision(d,'origin',key);
 for(const feat of old?.data.grantedFeatIds??[]){
  // An independently selected ASI feat remains owned after changing background.
  if(shared.has(feat)||Object.values(d.selections??{}).some(values=>values.includes(feat)))continue;
  for(const key of Object.keys(d.selections??{}))if(key.startsWith(feat+':'))retainDecision(d,'class',key);
 }
 for(const key of Object.keys(d.startingEquipmentChoices??{}))if(/^starting:[^:]+:background-/.test(key))delete d.startingEquipmentChoices[key];
 d.backgroundId=next;delete d.background.specialty;
}
