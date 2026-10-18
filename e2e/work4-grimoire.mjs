import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const port=Number(process.env.PILOT20_E2E_PORT??4180),url=`http://127.0.0.1:${port}/web/index.html`;
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;const results=[],errors=[],metrics=[];
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server '+code)));});
 browser=await chromium.launch({...(process.env.PILOT20_CHROMIUM?{executablePath:process.env.PILOT20_CHROMIUM}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1180,height:820}}),p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
 await mkdir('docs/screenshots/work4',{recursive:true});await mkdir('artifacts',{recursive:true});await p.goto(url);await p.locator('header').waitFor();
 const fixtures=await p.evaluate(async()=>{
  const {openIndexedDB}=await import('/src/persistence/adapters.js'),storage=await openIndexedDB();
  const {characterLibrary}=await import('/src/persistence/library.js'),{creatorRepository}=await import('/src/creator/repository.js');
  const {campaignRepository}=await import('/src/campaign/repository.js'),{classCatalog,spellCatalog,originCatalog}=await import('/src/catalog/srd51-catalog.js');
  const {newDraft,suggestChoices,compileDraft,draftProgression}=await import('/src/creator/model.js');const {spellReference}=await import('/src/catalog/spell-reference.js');
  const library=characterLibrary(storage),drafts=creatorRepository(storage,library),campaigns=campaignRepository(storage,[classCatalog,spellCatalog,originCatalog]);
  const config=await campaigns.initialize(),ctx=await campaigns.context(config),out={};
  for(const [cls,level]of [['wizard',10],['cleric',5],['bard',10],['warlock',11]]){
   let d=newDraft('default','grimoire-'+cls);Object.assign(d,{name:'Grimoire '+cls,mode:'single',classChosen:true,raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:cls,level,subclassId:ctx.index.class(cls).data.subclassIds[0]}]});
   d=suggestChoices(ctx,config,d);for(const q of draftProgression(ctx,config,d).choices.filter(q=>q.kind==='prepared'))d.selections[q.id]=q.options.slice(0,q.count);
   d.confirmed=d.reviewed=true;await drafts.save(d);const result=compileDraft(ctx,config,d);if(!result.valid)throw Error(JSON.stringify(result.issues));await drafts.finalize(d,result.character,{expectedDraftRevision:1,spellbook:result.spellbook});
   const book=result.choices.find(q=>q.kind==='spellbook'),prep=result.choices.find(q=>q.kind==='prepared');
   const copyId=book?.options.find(id=>!d.selections[book.id].includes(id)&&ctx.index.get(id).data.level>0),removeId=prep?d.selections[prep.id][0]:null;
   const display=id=>id?(spellReference(id)?.name.fr??ctx.index.get(id).name.fr):null;
   out[cls]={copyId,copyName:display(copyId),removeId,removeName:display(removeId),autoId:result.grantedSpells[0]?.id,autoName:display(result.grantedSpells[0]?.id)};
  }
  storage.close();return out;
 });
 async function open(cls){await p.locator('header').getByRole('button',{name:'Bibliothèque',exact:true}).click();const card=p.locator('article').filter({has:p.getByRole('heading',{name:'Grimoire '+cls,exact:true})});await card.getByRole('button',{name:'Grimoire',exact:true}).click();await p.locator('.grimoire[data-character-id="grimoire-'+cls+'"]').waitFor();}
 async function search(name){await p.getByRole('searchbox',{name:'Rechercher un sort',exact:true}).fill(name);}
 async function read(cls){return p.evaluate(async id=>{const {openIndexedDB}=await import('/src/persistence/adapters.js');const s=await openIndexedDB();try{return await s.get('characters',id);}finally{s.close();}},'grimoire-'+cls);}
 await open('bard');assert.equal(await p.getByRole('button',{name:'Modifier la préparation',exact:true}).count(),0);results.push('Bard10 has no daily preparation command');
 await open('warlock');assert.equal(await p.getByRole('button',{name:'Modifier la préparation',exact:true}).count(),0);assert.ok((await read('warlock')).spellbook.grants.some(g=>g.acquisition==='arcanum'&&g.route==='arcanum'));results.push('Warlock11 keeps arcanum distinct and has no generic preparation command');
 await open('wizard');const before=await read('wizard');await p.getByRole('tab',{name:'Catalogue',exact:true}).click();await search(fixtures.wizard.copyName);
 const candidate=p.locator('.grimoire-spell').filter({has:p.locator(`[data-spell-id="${fixtures.wizard.copyId}"]`)});
 const row=p.locator(`.grimoire-spell[data-spell-id="${fixtures.wizard.copyId}"]`);await row.waitFor();await row.getByRole('button',{name:'Inscrire',exact:true}).click();
 await p.locator('#dialog input[type=checkbox]').check();await p.locator('#dialog').getByRole('button',{name:'Confirmer la copie',exact:true}).click();
 await p.waitForFunction(async id=>{const {openIndexedDB}=await import('/src/persistence/adapters.js');const s=await openIndexedDB();try{return(await s.get('characters',id)).definition.revision===2;}finally{s.close();}},'grimoire-wizard');
 await p.locator('.grimoire[data-character-id="grimoire-wizard"][data-character-revision="2"]').waitFor();
 let after=await read('wizard');assert.ok(after.definition.spells.known.includes(fixtures.wizard.copyId),JSON.stringify({expected:fixtures.wizard.copyId,known:after.definition.spells.known,heading:await p.locator('.grimoire .eyebrow').textContent()}));assert.deepEqual(after.definition.spells.prepared,before.definition.spells.prepared);
 results.push('Wizard10 copy persists without changing preparation or removing previous book entries');
 await p.getByRole('button',{name:'Modifier la préparation',exact:true}).click();await search(fixtures.wizard.removeName);
 const removed=p.locator(`.grimoire-spell[data-spell-id="${fixtures.wizard.removeId}"]`);await removed.getByRole('checkbox',{name:'Préparer',exact:true}).uncheck();
 await search(fixtures.wizard.copyName);await p.locator(`.grimoire-spell[data-spell-id="${fixtures.wizard.copyId}"]`).getByRole('checkbox',{name:'Préparer',exact:true}).check();
 await p.getByRole('button',{name:'Enregistrer la préparation',exact:true}).click();
 await p.waitForFunction(async id=>{const {openIndexedDB}=await import('/src/persistence/adapters.js');const s=await openIndexedDB();try{return(await s.get('characters',id)).definition.revision===3;}finally{s.close();}},'grimoire-wizard');
 await p.locator('.grimoire[data-character-id="grimoire-wizard"][data-character-revision="3"]').waitFor();
 after=await read('wizard');assert.ok(after.definition.spells.prepared.includes(fixtures.wizard.copyId));assert.ok(!after.definition.spells.prepared.includes(fixtures.wizard.removeId));assert.ok(after.definition.spells.known.includes(fixtures.wizard.removeId));
 results.push('Daily preparation changes atomically while the wizard book retains the unprepared spell');
 for(const size of [{width:390,height:844},{width:1180,height:820}]){await p.setViewportSize(size);await search('');await p.screenshot({path:`docs/screenshots/work4/grimoire-${size.width}x${size.height}.png`,fullPage:true});const m=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(m.scrollWidth<=m.width);metrics.push(m);}
 await open('cleric');await p.getByRole('button',{name:'Modifier la préparation',exact:true}).click();await search(fixtures.cleric.autoName);
 const auto=p.locator(`.grimoire-spell[data-spell-id="${fixtures.cleric.autoId}"]`);await auto.waitFor();assert.equal(await auto.getByRole('checkbox',{name:'Préparer',exact:true}).count(),0);assert.ok((await auto.textContent()).includes('Toujours préparé'));
 const counter=await p.locator('.grimoire-status').textContent();await search('unmatchable search');assert.equal(await p.locator('.grimoire-status').textContent(),counter);results.push('Cleric domain spells stay always prepared outside the editable quota; search does not change counters');
 await p.locator('header').getByRole('button',{name:'Bibliothèque',exact:true}).click();await p.reload();await open('wizard');const reopened=await read('wizard');assert.deepEqual(reopened.spellbook,after.spellbook);results.push('Library reopening retains the exact spellbook and preparation metadata');
 assert.deepEqual(errors,[]);await context.close();
}finally{await writeFile('artifacts/e2e-work4-grimoire-results.json',JSON.stringify({results,metrics,errors,physicalSafari:false},null,2));if(browser)await browser.close();server.kill();}
console.log(results);
