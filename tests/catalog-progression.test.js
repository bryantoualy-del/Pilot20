import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSRD,classCatalog,spellCatalog} from '../src/catalog/srd51-catalog.js';
import {createCatalogIndex,validateCatalogV3} from '../src/catalog/catalog-v3.js';
import {validateCatalog} from '../src/catalog/validate.js';
import {catalog as legacy} from '../src/catalog/srd51.js';
import {resolveProgression,listSubclasses,listSpells,getProgression} from '../src/catalog/progression.js';
import {buildCharacter,replaceSelection} from '../src/catalog/character-builder.js';
import {catalogRequest,catalogCharacter} from './helpers/catalog.js';
import {derive,spellSlots} from '../src/character/derive.js';
import {validateBuild} from '../src/character/definition.js';
import {characterLibrary} from '../src/persistence/library.js';
import {MemoryStorage,openIndexedDB} from '../src/persistence/adapters.js';
import {indexedDB} from 'fake-indexeddb';
const index=loadSRD();
for(const entry of index.list('class'))for(const level of [1,3,5,10,20])test(`${entry.data.classId} production build level ${level}`,()=>{
 const cls=entry.data.classId,d=catalogCharacter(index,cls,{level}),out=derive(d);
 assert.equal(out.level,level);assert.equal(validateBuild(d).valid,true);assert.equal(d.progression.length,level);
 const expected=getProgression(index,cls).filter(r=>r.level<=level).flatMap(r=>r.featureIds);
 assert.ok(expected.every(f=>d.features.includes(f)));assert.equal(d.classes[0].subclassId,level>=entry.data.subclassLevel?entry.data.subclassIds[0]:null);
 assert.deepEqual(d,JSON.parse(JSON.stringify(d)));
 if(cls==='fighter')assert.equal(out.attacksPerAction,level>=20?4:level>=11?3:level>=5?2:1);
 if(cls==='monk'&&level>=2)assert.equal(out.resources['monk:ki'].max,level);
 if(cls==='paladin')assert.equal(out.resources['paladin:lay-on-hands'].max,level*5);
 if(cls==='warlock')assert.deepEqual(out.slotMetadata.pactLevels,{warlock:Math.min(5,Math.ceil(level/2))});
});
test('source census: 12 class tables, 12 SRD subclasses and 319 spell descriptions',()=>{
 assert.equal(index.list('class').length,12);assert.equal(index.list('subclass').length,12);assert.equal(index.list('spell').length,319);
 for(const cls of index.list('class'))assert.equal(cls.data.grants.length,20);
 for(const spell of index.list('spell')){assert.ok(spell.data.classIds.length);assert.ok(spell.data.description.length>40);assert.ok(['manual','partial'].includes(spell.data.automation.status));}
 assert.equal(index.get('srd51:hunters-mark')?.id,undefined);assert.ok(index.get('srd51:hunter-s-mark').data.classIds.includes('ranger'));
 assert.equal(listSubclasses(index,'bard')[0].id,'srd51:college-of-lore');assert.ok(listSpells(index,'wizard',{maximumLevel:3}).every(s=>s.data.level<=3));
 assert.equal(index.get('srd51:zone-of-truth').data.description.includes('\nTraps\n'),false);
 assert.equal(validateCatalog(legacy),legacy);
});
test('incomplete builds never select defaults or return a playable character',()=>{
 const req={id:'empty',name:'Empty',classes:[{id:'fighter',level:5,subclassId:null}],scores:{str:13,dex:13,con:13,int:13,wis:13,cha:13}};
 const r=buildCharacter(index,req);assert.equal(r.character,null);assert.ok(r.issues.some(i=>i.choiceId==='fighter:subclass'));assert.ok(r.issues.some(i=>i.choiceId==='fighter:asi-4'));
 assert.deepEqual(req.classes[0].subclassId,null);
});
test('ASI bounds, prerequisites, class-level multiclass grants and independent pact slots',()=>{
 let req=catalogRequest(index,'fighter',{level:5});req.scores.str=20;req.selections['fighter:asi-4']=['asi:str:str'];assert.ok(resolveProgression(index,req).issues.some(i=>i.code==='asi-cap'));
 const classes=[{id:'paladin',level:5,subclassId:'srd51:oath-of-devotion'},{id:'warlock',level:3,subclassId:'srd51:the-fiend'}];
 req=catalogRequest(index,'paladin',{classes});let r=buildCharacter(index,req);assert.equal(r.valid,true,JSON.stringify(r.issues));let out=derive(r.character);
 assert.equal(out.resources.slot1.max,4);assert.equal(out.resources.slot2.max,2);assert.equal(out.resources['pact:warlock'].slotLevel,2);assert.equal(out.resources['pact:warlock'].max,2);assert.equal(out.attacksPerAction,2);
 assert.equal(r.character.proficiencies.includes('all-armor'),true);assert.equal(r.character.features.includes('srd51:paladin:aura-of-protection'),false);
 req.scores.cha=8;assert.ok(resolveProgression(index,req).issues.some(i=>i.code==='multiclass-prerequisite'));
 const shared=spellSlots([{id:'wizard',level:3,casting:{ability:'int',progression:'full'}},{id:'cleric',level:2,casting:{ability:'wis',progression:'full'}}]);assert.equal(shared.resources.slot3.max,2);
});
test('choice replacement is revalidated, stale choices and invocation prerequisites are explicit',()=>{
 let req=catalogRequest(index,'sorcerer',{level:5});const old=req.selections['sorcerer:known-spells'][0],report=resolveProgression(index,req),options=report.choices.find(c=>c.id==='sorcerer:known-spells').options;
 const add=options.find(id=>!req.selections['sorcerer:known-spells'].includes(id));const next=replaceSelection(index,req,{choiceId:'sorcerer:known-spells',removeId:old,addId:add});assert.ok(next.selections['sorcerer:known-spells'].includes(add));assert.ok(req.selections['sorcerer:known-spells'].includes(old));
 assert.throws(()=>replaceSelection(index,req,{choiceId:'sorcerer:known-spells',removeId:old,addId:'srd51:wish'}));
 req.selections['sorcerer:obsolete']=['bad'];assert.ok(resolveProgression(index,req).issues.some(i=>i.code==='obsolete-choice'));
 req=catalogRequest(index,'warlock',{level:5});req.selections['warlock:invocations'][0]='srd51:warlock:lifedrinker';assert.equal(resolveProgression(index,req).valid,false);
});
test('pack boundaries reject duplicate IDs, missing references, cycles, wrong editions and executable impostors',()=>{
 assert.throws(()=>createCatalogIndex([classCatalog,classCatalog]));
 const copy=()=>structuredClone(classCatalog);let c=copy();c.items.push(c.items[0]);assert.throws(()=>validateCatalogV3(c));
 c=copy();c.items[0].data.requires=['missing'];assert.throws(()=>createCatalogIndex([c]));
 c=copy();c.items[0].data.requires=[c.items[1].id];c.items[1].data.requires=[c.items[0].id];assert.throws(()=>createCatalogIndex([c,spellCatalog]),/cycle/);
 c=copy();c.ruleset='dnd5e-2024';assert.throws(()=>validateCatalogV3(c));
 c=copy();c.items[0].data.automation={status:'automated',handler:'eval',limits:[]};assert.throws(()=>validateCatalogV3(c));
 c=copy();c.items.find(i=>i.type==='class').data.resources=[{id:'bad',recovery:'long',maxByLevel:[1]}];assert.throws(()=>validateCatalogV3(c));
 c=copy();c.items[0].source.kind='private';assert.throws(()=>validateCatalogV3(c,{distribution:'public'}));assert.equal(createCatalogIndex([c]).size,0);
 c=copy();c.items[0].data.campaignOption='optional-rule';assert.throws(()=>createCatalogIndex([c]));
 const original=index.get('srd51:fighter');original.data.hitDie=6;assert.equal(index.class('fighter').data.hitDie,10);
});
for(const adapter of ['memory','indexeddb'])test(`production bard level 10 persists through ${adapter}, JSON export/import and preferences`,async()=>{
 const store=adapter==='memory'?new MemoryStorage():await openIndexedDB('catalog-test',{indexedDB});
 const library=characterLibrary(store),d=catalogCharacter(index,'bard',{level:10});await library.save(d);
 const reloaded=(await characterLibrary(store).get(d.id)).definition;assert.deepEqual(reloaded,d);assert.deepEqual(derive(reloaded),derive(d));
 const raw=await library.exportJSON(d.id),fresh=characterLibrary(new MemoryStorage());await fresh.importJSON(raw);assert.deepEqual((await fresh.get(d.id)).definition,d);
 if(store.close)store.close();
});
test('subclass spell grants are prepared without using preparation allowance; expanded spells remain choices',()=>{
 const d=catalogCharacter(index,'cleric',{level:5});assert.ok(d.spells.prepared.includes('srd51:revivify'));assert.ok(d.spells.prepared.includes('srd51:spiritual-weapon'));
 const req=catalogRequest(index,'warlock',{level:5}),r=resolveProgression(index,req);assert.ok(r.choices.find(c=>c.id==='warlock:known-spells').options.includes('srd51:fireball'));
 const noSubclass={...req,classes:[{id:'warlock',level:5,subclassId:null}]};assert.equal(resolveProgression(index,noSubclass).choices.find(c=>c.id==='warlock:known-spells').options.includes('srd51:fireball'),false);
});
test('complete automated reference demonstration creates, persists, reloads a reaction and recovers resources',async()=>{
 const {catalogDemo}=await import('../examples/catalog-demo.mjs');assert.deepEqual(await catalogDemo(),{catalogEntries:index.size,bardLevel:10,subclass:'College of Lore',reactiveDecisionReloaded:true,manualDeclarationReloaded:true,manualResolved:true,damage:16,healing:9,inspirationRecovered:true,finalFighterHp:97});
});
test('synthetic thirteenth class and campaign-opted private replacement remain inert',()=>{
 const base=structuredClone(index.class('fighter'));base.id='private:inventor';base.name={en:'Synthetic Inventor',fr:'Synthetic Inventor'};base.source={kind:'private',document:'Synthetic extension test, no book content',license:'private-test',url:''};
 base.data.classId='inventor';base.data.grants=Array.from({length:20},(_,i)=>({level:i+1,featureIds:[]}));base.data.subclassIds=[];base.data.resources=[{id:'item-capacity',maxByLevel:Array(20).fill(2),recovery:'long'}];base.data.choices=[];base.data.referenceText='Synthetic class for extension capacity tests.';
 base.data.casting={ability:'int',progression:'half'};base.data.entityMetadata={secondaryEntities:true,tools:true,itemBindings:true};
 const pack={kind:'catalog',schemaVersion:3,ruleset:'dnd5e-2014',id:'private:synthetic',items:[base]};
 assert.equal(createCatalogIndex([classCatalog,spellCatalog,pack]).list('class').length,12);
 const custom=createCatalogIndex([classCatalog,spellCatalog,pack],{enabledPackIds:[pack.id]});assert.equal(custom.list('class').length,13);assert.equal(custom.class('inventor').data.resources[0].maxByLevel.length,20);
 assert.throws(()=>createCatalogIndex([classCatalog,spellCatalog,pack],{distribution:'public',enabledPackIds:[pack.id]}));
 const replacement=structuredClone(index.get('srd51:fighter:second-wind'));replacement.id='private:replacement';replacement.source=base.source;replacement.data.automation={status:'manual',handler:null,limits:['Synthetic replacement']};replacement.data.replaces=['srd51:fighter:second-wind'];replacement.data.campaignOption='replacement-enabled';
 const extra={...pack,id:'private:replacement-pack',items:[replacement]};
 assert.equal(createCatalogIndex([classCatalog,spellCatalog,extra],{enabledPackIds:[extra.id]}).get(replacement.id),undefined);
 assert.ok(createCatalogIndex([classCatalog,spellCatalog,extra],{enabledPackIds:[extra.id],enabledOptions:['replacement-enabled']}).get(replacement.id));
});
test('optional SRD feat requires campaign opt-in and scores; subclass choices cannot disagree',()=>{
 const req=catalogRequest(index,'fighter',{level:5});req.selections['fighter:asi-4']=['srd51:grappler'];assert.equal(resolveProgression(index,req).valid,false);
 req.campaignOptions=['feats'];assert.equal(buildCharacter(index,req).valid,true);req.scores.str=8;assert.equal(resolveProgression(index,req).valid,false);
 const bard=catalogRequest(index,'bard');bard.selections['bard:subclass']=['srd51:champion'];assert.equal(resolveProgression(index,bard).valid,false);
});
test('standalone catalogue schema accepts both public modules and rejects missing coverage',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:Ajv}=await import('ajv/dist/2020.js');
 const schema=JSON.parse(await readFile(new URL('../schemas/catalog-v3.schema.json',import.meta.url))),validate=new Ajv().compile(schema);
 assert.equal(validate(classCatalog),true,JSON.stringify(validate.errors));assert.equal(validate(spellCatalog),true,JSON.stringify(validate.errors));
 const bad=structuredClone(spellCatalog);delete bad.items[0].data.automation;assert.equal(validate(bad),false);
});
