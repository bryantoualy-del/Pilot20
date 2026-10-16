/** Explicit authored level-up choices, not a player-default selection engine. SRD 2014 only. */
import assert from 'node:assert/strict';
import {loadSRD} from '../src/catalog/srd51-catalog.js';
import {buildCharacter} from '../src/catalog/character-builder.js';
import {readChoiceHistories,exportBuildPlan,importBuildPlan} from '../src/catalog/advancement.js';
import {characterLibrary} from '../src/persistence/library.js';
import {MemoryStorage} from '../src/persistence/adapters.js';
const spell=(...names)=>names.map(n=>'srd51:'+n);
const firstBook=spell('magic-missile','shield','detect-magic','sleep','burning-hands','identify');
const firstPrepared=spell('magic-missile','shield','detect-magic','sleep');
const base={'wizard:skills':['arcana','history'],'wizard:cantrips':spell('fire-bolt','mage-hand','light')};
const school='srd51:school-of-evocation';
export const wizardHistory=[
 {classId:'wizard',classes:[{id:'wizard',level:1,subclassId:null}],selections:{...base,'wizard:spellbook':firstBook,'wizard:prepared':firstPrepared}},
 {classId:'wizard',classes:[{id:'wizard',level:2,subclassId:school}],selections:{...base,'wizard:spellbook':[...firstBook,...spell('alarm','feather-fall')],'wizard:prepared':[...firstPrepared,...spell('burning-hands')]}},
 {classId:'wizard',classes:[{id:'wizard',level:3,subclassId:school}],selections:{...base,'wizard:spellbook':[...firstBook,...spell('alarm','feather-fall','misty-step','scorching-ray')],'wizard:prepared':[...firstPrepared,...spell('burning-hands','misty-step')]}}
];
export async function progressionDemo(){
 const index=loadSRD(),request={id:'reference-wizard-history',name:'Reference Wizard',classes:wizardHistory.at(-1).classes,scores:{str:10,dex:14,con:14,int:16,wis:12,cha:10},selections:wizardHistory.at(-1).selections};
 const built=buildCharacter(index,{...request,advancementHistory:wizardHistory});assert.equal(built.valid,true,JSON.stringify(built.issues));assert.equal(built.history.status,'verified');
 const library=characterLibrary(new MemoryStorage());await library.save(built.character);const loaded=(await library.get(request.id)).definition;
 const notes=readChoiceHistories(loaded),book=notes.find(n=>n.choiceId==='wizard:spellbook');assert.deepEqual(book.events.map(e=>e.add.length),[6,2,2]);
 const plan=importBuildPlan(index,exportBuildPlan(request,wizardHistory));assert.deepEqual(plan.history,wizardHistory);
 return {class:'wizard',level:3,history:'verified',bookAcquisitions:[6,2,2],characterReloaded:true,buildPlanRoundTrip:true,characterSchemaVersion:loaded.schemaVersion};
}
if(process.argv[1]===new URL(import.meta.url).pathname)console.log(JSON.stringify(await progressionDemo(),null,2));
