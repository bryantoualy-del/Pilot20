import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const port=Number(process.env.PILOT20_E2E_PORT??4180),url=`http://127.0.0.1:${port}/web/index.html`;
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;
const results=[],metrics=[],errors=[];
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server '+code)));});
 const engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch(engine===webkit?{}:{...(process.env.PILOT20_CHROMIUM?{executablePath:process.env.PILOT20_CHROMIUM}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage();
 p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
 await mkdir('docs/screenshots/work4',{recursive:true});await mkdir('artifacts',{recursive:true});
 async function changed(action){const old=await p.locator('.single-body').elementHandle();await action();await p.waitForFunction(e=>!e.isConnected,old);await old.dispose();}
 async function next(){await changed(()=>p.locator('.single-actions .primary').click());}
 async function step(id){await p.locator('.single-plan summary').click();await changed(()=>p.locator('.single-plan nav button').filter({hasText:id}).first().click());}
 async function drafts(){return p.evaluate(async()=>{const {openIndexedDB}=await import('/src/persistence/adapters.js');const s=await openIndexedDB();try{return(await s.list('meta','creator:draft:')).map(r=>r.value);}finally{s.close();}});}
 await p.goto(url);await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();await p.locator('#character-name').waitFor();
 assert.equal(await p.getByRole('button',{name:'Rapide',exact:true}).count(),0);
 assert.equal(await p.getByRole('button',{name:'Guidé',exact:true}).count(),0);
 assert.equal(await p.getByRole('button',{name:'Expert',exact:true}).count(),0);
 await changed(async()=>{await p.locator('#character-name').fill('Work4 Guerrier');await p.locator('#character-name').blur();});await next();
 await changed(()=>p.getByRole('button',{name:'Humain',exact:true}).click());
 for(const size of [{width:375,height:667},{width:390,height:844},{width:1180,height:820},{width:820,height:1180}]){
  await p.setViewportSize(size);await p.screenshot({path:`docs/screenshots/work4/race-${size.width}x${size.height}.png`,fullPage:true});
  const m=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttonSizes:[...document.querySelectorAll('.single-actions button')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))}));
  assert.ok(m.scrollWidth<=m.width,JSON.stringify(m));assert.ok(m.buttonSizes.every(b=>b.width>=44&&b.height>=44));metrics.push(m);
 }
 await p.setViewportSize({width:390,height:844});await next();
 await changed(()=>p.locator('.single-body select').first().selectOption('fighter'));await next();
 await changed(()=>p.locator('.single-body select').first().selectOption('phb14:background:guild-merchant'));await next();
 assert.equal(await p.locator('.single-body').getAttribute('data-kind'),'scores');
 const before=(await drafts())[0];await changed(()=>p.locator('.single-actions button').first().click());
 await next();assert.deepEqual((await drafts())[0].scores,before.scores);await next();
 let visited=0;
 while(await p.locator('.single-body').getAttribute('data-kind')!=='summary'){
  assert.ok(visited++<35,'bounded fighter creation');
  const kind=await p.locator('.single-body').getAttribute('data-kind');
  assert.ok(!['choice:fighter:cantrips','choice:fighter:prepared'].includes(await p.locator('.single-body').getAttribute('data-decision-id')));
  if(['origin-choice','class-choice'].includes(kind)){
   let guard=0;
   while(await p.locator('.single-actions .primary').isDisabled()){
    assert.ok(guard++<20,'bounded option quota');
    const options=p.locator('.single-options input:enabled:not(:checked)');assert.ok(await options.count(),'an eligible option remains');
    await changed(()=>options.first().check());
   }
  }
  await next();
 }
 await p.getByRole('button',{name:'Enregistrer le personnage',exact:true}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Enregistrer le personnage',exact:true}).isEnabled(),true);
 await p.getByRole('button',{name:'Enregistrer le personnage',exact:true}).click();
 await p.locator('header').getByRole('button',{name:'Bibliothèque',exact:true}).waitFor();await p.getByRole('heading',{name:'Work4 Guerrier',exact:true}).waitFor();
 results.push('Fighter1 created through one route, race and skill decisions resolved, backtracking preserves scores, saved to library');
 const record=await p.evaluate(async()=>{const {openIndexedDB}=await import('/src/persistence/adapters.js');const s=await openIndexedDB();try{return(await s.list('characters'))[0].value;}finally{s.close();}});
 assert.equal(record.definition.identity.name,'Work4 Guerrier');assert.equal(record.definition.background,'Guild Merchant');assert.equal(record.spellbook.characterRevision,record.definition.revision);
 const savedDraft=(await drafts())[0];assert.equal(savedDraft.mode,'single');assert.equal(savedDraft.finalized,true);
 await p.reload();await p.locator('header').getByRole('button',{name:'Bibliothèque',exact:true}).click();await p.getByRole('heading',{name:'Work4 Guerrier',exact:true}).waitFor();
 await p.getByRole('button',{name:'Modifier',exact:true}).click();await p.locator('.single-body[data-kind=summary]').waitFor();
 results.push('Closing/reopening restores the saved character and its exact decision surface');
 // Seed a legacy high-level draft using the existing SRD compiler, then edit it through the real UI.
 await p.evaluate(async()=>{
  const {openIndexedDB}=await import('/src/persistence/adapters.js');const s=await openIndexedDB();
  const {characterLibrary}=await import('/src/persistence/library.js');const {creatorRepository}=await import('/src/creator/repository.js');
  const {classCatalog,spellCatalog,originCatalog}=await import('/src/catalog/srd51-catalog.js');const {campaignCatalog,defaultCampaign}=await import('/src/campaign/sources.js');
  const {newDraft,suggestChoices}=await import('/src/creator/model.js');
  const c=defaultCampaign(),ctx=campaignCatalog([classCatalog,spellCatalog,originCatalog],[],c),d=newDraft('default','work4-legacy-bard');
  Object.assign(d,{mode:'expert',name:'Work4 Barde10',step:'features',classes:[{id:'bard',level:10,subclassId:'srd51:college-of-lore'}],raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classChosen:true});
  await creatorRepository(s,characterLibrary(s)).save(suggestChoices(ctx,c,d));s.close();
 });
 await p.locator('header').getByRole('button',{name:'Bibliothèque',exact:true}).click();
 const bardCard=p.locator('article').filter({has:p.getByRole('heading',{name:'Work4 Barde10',exact:true})});await bardCard.getByRole('button',{name:/^Reprendre/}).click();
 await p.locator('.single-body').waitFor();assert.equal((await drafts()).find(d=>d.id==='work4-legacy-bard').mode,'single');
 await p.locator('.single-plan summary').click();const secrets=p.locator('.single-plan nav button').filter({hasText:/Secrets magiques.*10/});assert.equal(await secrets.count(),1);await changed(()=>secrets.click());
 assert.equal(await p.locator('.single-body').getAttribute('data-decision-id'),'choice:bard:magical-secrets-10');
 assert.ok(await p.locator('.single-options input').count());results.push('Legacy expert Bard10 migrates without data loss and exposes real Magical Secrets10 decisions');
 // The packaging cache must complete before the offline proof.
 await p.waitForFunction(()=>document.querySelector('#offline-state')?.textContent.toLowerCase().includes('disponible hors ligne'),null,{timeout:30000});
 await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 // Playwright #42775: WebKit's offline emulation rejects even SW literal responses.
 // Stop the actual origin server instead, so this still proves a real network outage.
 if(engine===webkit)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});else await context.setOffline(true);
 await p.reload();await p.locator('header').getByRole('button',{name:'Bibliothèque',exact:true}).click();await p.getByRole('heading',{name:'Work4 Guerrier',exact:true}).waitFor();if(engine!==webkit)await context.setOffline(false);
 results.push('Offline reload opens the local library after the precache reports ready');
 assert.deepEqual(errors,[]);await context.close();
}finally{
 await writeFile('artifacts/e2e-work4-creator-results.json',JSON.stringify({results,metrics,errors,physicalSafari:false},null,2));
 if(browser)await browser.close();server.kill();
}
console.log(results);
