import {CORE_BUILD_EFFECTS,CORE_FRENCH} from './core-build-effects.js';
import references from './data/spell-reference-2014.json' with {type:'json'};
import notes from './data/extended-spell-notes-fr.json' with {type:'json'};
import artificer from './data/artificer.json' with {type:'json'};
import subclasses from './data/subclasses-extended.json' with {type:'json'};
import extraOrigins from './data/origins-extended.json' with {type:'json'};
import subraceAdditions from './data/subrace-additions.json' with {type:'json'};
import phbFacts from './data/phb-spell-facts.json' with {type:'json'};
import phbNotes from './data/phb-spell-notes-fr.json' with {type:'json'};
import {classCatalog,spellCatalog,originCatalog} from './srd51-catalog.js';
import {spellReferences} from './spell-reference.js';

const schools={abjuration:'abjuration',invocation:'conjuration',divination:'divination',enchantement:'enchantment',évocation:'evocation',illusion:'illusion',nécromancie:'necromancy',transmutation:'transmutation'};
export const referencedSource=(sourceId,url)=>({kind:'reference',document:sourceId==='xge'?'Guide complet de Xanathar (2014 rules)':sourceId==='tce'?'Chaudron des merveilles de Tasha (2014 rules)':'Manuel des joueurs 2014',license:'Pilot20-original-summary',url});
export const extendedSpells={kind:'catalog',schemaVersion:3,ruleset:'dnd5e-2014',id:'pilot20:extended-spells-2014',items:references.filter(r=>!r.sourceIds.includes('srd51')).map(r=>{
 if(!notes[r.name.en])throw Error('Missing original summary: '+r.name.en);
 return {id:r.id,type:'spell',name:r.name,source:referencedSource(r.sourceIds[0],r.detailUrl),data:{ruleset:'dnd5e-2014',rulesSourceId:r.sourceIds[0],level:r.level,school:schools[r.schoolFr.toLowerCase()],classIds:r.classIds,castingTime:r.casting.time,range:r.casting.range,components:r.casting.components+(r.casting.material?' ('+r.casting.material+')':''),duration:r.casting.duration,concentration:r.casting.concentration,ritual:r.casting.ritual,description:notes[r.name.en],language:'fr',reference:r.references.map(p=>p.sourceId+' p. '+p.pages.join(', ')).join(' / '),automation:{status:'manual',handler:null,limits:['Combat resolution and special conditions remain player/GM adjudication.']},targeting:{mode:'manual',limits:'Player/GM validates geometry and eligibility.'},resolution:{kind:'manual',requiresAdjudication:true}}};
})};
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
export const phbSpells={kind:'catalog',schemaVersion:3,ruleset:'dnd5e-2014',id:'pilot20:phb-spells-2014',items:phbFacts.map(r=>({id:'phb14:spell:'+slug(r.name_en),type:'spell',name:{fr:r.name_fr,en:r.name_en},source:referencedSource('phb14',r.url),data:{ruleset:'dnd5e-2014',rulesSourceId:'phb14',level:r.level,school:schools[r.school]??r.school,classIds:[...r.classIds,...(['Thorn Whip','Elemental Weapon'].includes(r.name_en)?['artificer']:[])],castingTime:r.castingTime,range:r.range,components:r.components,duration:r.duration,concentration:/concentration/i.test(r.duration),ritual:r.ritual,description:phbNotes[r.name_en],language:'fr',reference:'AideDD 2014 / '+r.name_en,automation:{status:'manual',handler:null,limits:['Combat resolution remains player/GM adjudication.']},targeting:{mode:'manual',limits:'Player/GM validates geometry and eligibility.'},resolution:{kind:'manual',requiresAdjudication:true}}}))};
// Add the Artificer's verified base list without changing SRD-only consumers or IDs.
const playerSpells=structuredClone(spellCatalog);
const playerClasses=structuredClone(classCatalog);
const playerOrigins=structuredClone(originCatalog);
for(const [id,effect]of Object.entries(CORE_BUILD_EFFECTS))playerClasses.items.find(i=>i.id===id).data.buildEffects=effect;
for(const [id,[fr,description]]of Object.entries(CORE_FRENCH)){const f=playerClasses.items.find(i=>i.id===id);f.name.fr=fr;f.data.descriptionEn=f.data.description;f.data.description=description;f.data.language='fr';}
for(const feature of playerClasses.items.filter(i=>i.type==='feature'&&/srd51:(fighter|paladin|ranger):(archery|defense|dueling|great-weapon-fighting|protection|two-weapon-fighting)$/.test(i.id)))feature.data.uniqueRuleKey='fighting-style:'+feature.id.split(':').at(-1);
playerClasses.items.find(i=>i.id==='srd51:life-domain:bonus-proficiency').data.buildEffects={proficiencies:['heavy-armor']};
for(const row of subraceAdditions)playerOrigins.items.find(i=>i.id===row.raceId).data.subraces.push(row.subrace);
for(const sub of subclasses.items.filter(i=>i.type==='subclass'))playerClasses.items.find(i=>i.type==='class'&&i.data.classId===sub.data.classId).data.subclassIds.push(sub.id);
for(const item of playerSpells.items){const ref=references.find(r=>r.id===item.id);if(ref?.classIds.includes('artificer'))item.data.classIds=[...new Set([...item.data.classIds,'artificer'])];}
const allReferences=spellReferences();
for(const item of [...playerSpells.items,...extendedSpells.items,...phbSpells.items])item.data.optionalTashaClassIds=allReferences.find(r=>r.id===item.id)?.optionalTashaClassIds??[];
const expandedLists={kind:'catalog',schemaVersion:3,ruleset:'dnd5e-2014',id:'pilot20:tce-additional-spell-lists',items:[...new Set(allReferences.flatMap(r=>r.optionalTashaClassIds??[]))].map(classId=>({id:'tce:'+classId+':additional-spells',type:'feature',name:{fr:'Sorts supplémentaires — '+classCatalog.items.find(c=>c.type==='class'&&c.data.classId===classId).name.fr,en:'Additional '+classId+' spells'},source:referencedSource('tce','https://dnd.wizards.com/products/tashas-cauldron-everything'),data:{ruleset:'dnd5e-2014',rulesSourceId:'tce',classId,minimumClassLevel:['paladin','ranger'].includes(classId)?2:1,optionalClassFeature:true,campaignOption:'tce:additional-spells:'+classId,description:'Ajoute à la liste de classe les sorts supplémentaires de Tasha. Ne les apprend ni ne les prépare automatiquement.',language:'fr',automation:{status:'manual',handler:null,limits:['Individual spell effects remain player/GM adjudication.']}}}))};
export const playerCatalogs=[playerClasses,playerSpells,playerOrigins,extendedSpells,phbSpells,artificer,expandedLists,subclasses,extraOrigins];
