import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const port=Number(process.env.PILOT20_E2E_PORT??4180),url=`http://127.0.0.1:${port}/web/index.html`;
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;const results=[],errors=[];
try{
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j)});
 const engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch(engine===webkit?{}:{args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage();
 p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
 await mkdir('docs/screenshots/ten-stages',{recursive:true});await mkdir('artifacts',{recursive:true});
 async function change(fn){const old=await p.locator('.single-body').elementHandle();await fn();await p.waitForFunction(e=>!e.isConnected,old);await old.dispose();}
 const stage=name=>change(()=>p.locator('.journey-steps').getByRole('button',{name,exact:true}).click());
 const next=()=>change(()=>p.locator('.single-actions .primary').click());
 const drafts=()=>p.evaluate(async()=>{const {openIndexedDB}=await import('/src/persistence/adapters.js');const s=await openIndexedDB();try{return(await s.list('meta','creator:draft:')).map(r=>r.value);}finally{s.close();}});
 async function layout(label){for(const width of [375,390,1180]){await p.setViewportSize({width,height:820});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow '+width);assert.ok(await p.locator('.single-actions button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44)));await p.screenshot({path:`docs/screenshots/ten-stages/${label}-${width}.png`,fullPage:true});}await p.setViewportSize({width:390,height:844});}
 async function fillChoices(){let guard=0;while(await p.locator('.single-actions .primary').isDisabled()){
  assert.ok(guard++<40,'bounded selections: '+await p.locator('.single-body').innerText());
  const groups=p.locator('.single-choice');let group;
  for(let i=0;i<await groups.count();i++){const q=groups.nth(i),m=(await q.locator('.single-choice-count').innerText()).match(/· (\d+) \/ (\d+)/);if(m&&+m[1]<+m[2]){group=q;break;}}
  assert.ok(group,'missing choice control');await change(()=>group.locator('input:enabled:not(:checked)').first().click());
 }}
 await p.goto(url);await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();await p.locator('.race-picker').waitFor();
 assert.equal(await p.locator('.journey-steps button').count(),10);
 assert.equal(await p.locator('.single-body').getAttribute('data-stage'),'origin');
 await change(()=>p.getByRole('button',{name:'Humain',exact:true}).click());
 await change(()=>p.getByRole('button',{name:'Humain standard',exact:true}).click());await layout('race');await next();
 await change(()=>p.locator('.single-classes').getByRole('button',{name:'Guerrier',exact:true}).click());
 assert.equal(await p.locator('.level-stepper').count(),0);assert.equal(await p.getByLabel('Sous-classe',{exact:true}).count(),0);await next();
 assert.equal(await p.locator('.single-body').getByLabel('Historique',{exact:true}).inputValue(),'srd51:background:acolyte');await next();
 assert.equal(await p.locator('.single-body').getAttribute('data-stage'),'scores');
 await change(()=>p.locator('#score-method').selectOption('standard'));await layout('scores');await next();
 assert.equal(await p.locator('.progression-level').count(),1);assert.equal(await p.locator('[data-choice-id="fighter:subclass"]').count(),0);
 await fillChoices();await next();await fillChoices();await next();
 assert.equal(await p.locator('.single-body').getAttribute('data-stage'),'spells');assert.match(await p.locator('.single-body').innerText(),/Aucun sort/);await next();await layout('equipment');await next();
 await change(async()=>{await p.locator('#character-name').fill('Parcours Guerrier 1');await p.locator('#character-name').blur();});
 for(const [name,value] of [['Âge','32 ans'],['Peau','cuivrée'],['Yeux','rouges']])await change(async()=>{await p.getByLabel(name,{exact:true}).fill(value);await p.getByLabel(name,{exact:true}).blur();});
 const prompt=await p.getByLabel('Prompt du portrait',{exact:true}).inputValue();assert.match(prompt,/Guerrier/);assert.match(prompt,/32 ans/);assert.match(prompt,/Équipement visible/);
 await p.evaluate(()=>{window.__opened=null;window.open=(url)=>{window.__opened=url;return null;};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});});
 await p.getByRole('button',{name:'Générer avec ChatGPT',exact:true}).click();assert.equal(await p.evaluate(()=>window.__opened),'https://chatgpt.com/');assert.equal(await p.evaluate(()=>window.__copied),prompt);
 await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));await p.getByRole('button',{name:'Copier le prompt',exact:true}).click();await p.getByText(/La copie automatique est indisponible/).waitFor();await layout('identity');await next();
 const save=p.getByRole('button',{name:'Enregistrer le personnage',exact:true});assert.ok(await save.isEnabled(),await p.locator('.single-body').innerText());
 await p.getByRole('button',{name:'Enregistrer et quitter',exact:true}).click();await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();
 await p.locator('article').filter({has:p.getByRole('heading',{name:'Parcours Guerrier 1',exact:true})}).getByRole('button',{name:/^Reprendre/}).click();await save.click();await p.getByRole('heading',{name:'Parcours Guerrier 1',exact:true}).waitFor();
 const fighter=(await drafts()).find(d=>d.name==='Parcours Guerrier 1');assert.ok(fighter.finalized);assert.equal(fighter.physicalDetails.eyes,'rouges');
 results.push('Fighter1: all ten stages, rules choices, draft resume, physical fields, prompt copy/fallback, final save');
 // A historical expert draft must retain its actual level10 selections and migrate to the same route.
 await p.evaluate(async()=>{
  const {openIndexedDB}=await import('/src/persistence/adapters.js');const s=await openIndexedDB();
  const {characterLibrary}=await import('/src/persistence/library.js');const {creatorRepository}=await import('/src/creator/repository.js');
  const {playerCatalogs}=await import('/src/catalog/player-catalogs.js');const {campaignCatalog,defaultCampaign}=await import('/src/campaign/sources.js');const {newDraft,suggestChoices}=await import('/src/creator/model.js');
  const c=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],c),d=newDraft('default','journey-bard10');
  Object.assign(d,{mode:'expert',name:'Parcours Barde 10',step:'features',scoreMethod:'standard',scores:{str:8,dex:14,con:13,int:10,wis:12,cha:15},classes:[{id:'bard',level:10,subclassId:'srd51:college-of-lore'}],raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classChosen:true});
  await creatorRepository(s,characterLibrary(s)).save(suggestChoices(ctx,c,d));s.close();
 });
 await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();await p.locator('article').filter({has:p.getByRole('heading',{name:'Parcours Barde 10',exact:true})}).getByRole('button',{name:/^Reprendre/}).click();
 assert.equal((await drafts()).find(d=>d.id==='journey-bard10').mode,'single');
 await stage('Capacités & progression');assert.equal(await p.locator('.progression-level').count(),10);
 const subclass=p.locator('[data-choice-id="bard:subclass"]');assert.equal(await subclass.count(),1);assert.match(await subclass.locator('xpath=ancestor::details[1]/summary').innerText(),/Niveau 3/);
 for(const level of [4,8]){const q=p.locator(`[data-decision-id="choice:bard:asi-${level}"]`);assert.equal(await q.count(),1);assert.match(await q.locator('xpath=ancestor::details[1]/summary').innerText(),new RegExp('Niveau '+level));}
 await layout('progression');await stage('Sorts');assert.equal(await p.locator('[data-choice-id="bard:magical-secrets-10"]').count(),1);await fillChoices();await layout('spells');
 await stage('Niveau & caractéristiques');await change(()=>p.locator('[data-decision-id=hit-points] select').selectOption('rolled'));
 assert.equal(await p.locator('.single-hp input').count(),9);assert.ok(await p.locator('.single-actions .primary').isDisabled());
 for(let i=0;i<9;i++)await change(async()=>{await p.locator('.single-hp input').nth(i).fill('4');await p.locator('.single-hp input').nth(i).blur();});
 await stage('Résumé');assert.ok(await save.isEnabled(),await p.locator('.single-body').innerText());await save.click();await p.getByRole('heading',{name:'Parcours Barde 10',exact:true}).waitFor();
 assert.ok((await drafts()).find(d=>d.id==='journey-bard10').finalized);
 results.push('Bard10: legacy migration, subclass3, ASI4/8, ten collapsible levels, Secrets10, nine HP rolls, save');
 await p.waitForFunction(()=>document.querySelector('#offline-state')?.textContent.toLowerCase().includes('disponible hors ligne'),null,{timeout:30000});await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 if(engine===webkit)await new Promise(r=>{server.once('exit',r);server.kill();});else await context.setOffline(true);
 await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();await p.getByRole('heading',{name:'Parcours Barde 10',exact:true}).waitFor();results.push('Offline library reload');assert.deepEqual(errors,[]);
}finally{await mkdir('artifacts',{recursive:true});await writeFile('artifacts/e2e-work4-creator-results.json',JSON.stringify({results,errors,physicalSafari:false},null,2));await browser?.close();server.kill();}
console.log(results);
