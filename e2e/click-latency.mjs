import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const port=4199,engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
 browser=await engine.launch(engine===webkit?{}:{executablePath:process.env.PILOT20_CHROMIUM,args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
 await p.goto(`http://127.0.0.1:${port}/web/index.html`);await p.locator('header').waitFor();
 const before=await p.evaluate(async()=>{
  const{openIndexedDB}=await import('/src/persistence/adapters.js'),s=await openIndexedDB();
  const{playerCatalogs}=await import('/src/catalog/player-catalogs.js'),{campaignRepository}=await import('/src/campaign/repository.js'),{characterLibrary}=await import('/src/persistence/library.js'),{creatorRepository}=await import('/src/creator/repository.js'),{newDraft,suggestChoices,compileDraft}=await import('/src/creator/model.js');
  const lib=characterLibrary(s),repo=creatorRepository(s,lib),campaigns=campaignRepository(s,playerCatalogs),config=await campaigns.initialize(),ctx=await campaigns.context(config);
  let d=Object.assign(newDraft('default','compact-wizard'),{name:'Compact wizard',classChosen:true,raceId:'srd51:race:half-elf',backgroundId:'srd51:background:acolyte',classes:[{id:'wizard',level:3,subclassId:ctx.index.class('wizard').data.subclassIds[0]}],startingEquipmentEnabled:true});
  d=suggestChoices(ctx,config,d);d.confirmed=d.reviewed=true;await repo.save(d);const result=compileDraft(ctx,config,d);if(!result.valid)throw Error(JSON.stringify(result.issues));await repo.finalize(d,result.character,{expectedDraftRevision:1,spellbook:result.spellbook});s.close();return result.character;
 });
 await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();
 await p.locator('article').filter({has:p.getByRole('heading',{name:'Compact wizard',exact:true})}).getByRole('button',{name:'Ouvrir',exact:true}).click();
 await p.locator('.character-sheet').waitFor();
 const timings={};
 async function measure(label,locator,ready){
  const start=await locator.evaluate(e=>{const t=performance.now();e.click();return t;});
  await ready();
  const end=await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now())))));
  (timings[label]??=[]).push(Math.round(end-start));console.log(label,Math.round(end-start));
 }
 for(let i=0;i<3;i++){
  await measure('sheet-skills',p.locator('.sheet-tabs').getByRole('button',{name:'Compétences',exact:true}),()=>p.locator('#sheet-pane-skills').waitFor());
  await measure('sheet-overview',p.locator('.sheet-tabs').getByRole('button',{name:'Fiche',exact:true}),()=>p.locator('#sheet-pane-overview').waitFor());
  await measure('open-library',p.locator('header').getByRole('button',{name:'Mes persos',exact:true}),()=>p.locator('article').getByRole('heading',{name:'Compact wizard',exact:true}).waitFor());
  await measure('open-sheet',p.locator('article').filter({has:p.getByRole('heading',{name:'Compact wizard',exact:true})}).getByRole('button',{name:'Ouvrir',exact:true}),()=>p.locator('.character-sheet').waitFor());
 }
 await measure('spellbook-first',p.locator('.sheet-tabs').getByRole('button',{name:'Sorts',exact:true}),()=>p.locator('.grimoire-spell').first().waitFor());
 for(let i=0;i<3;i++){
  await measure('spell-level-1',p.getByRole('button',{name:'Niveau 1',exact:true}),()=>p.waitForFunction(()=>document.querySelector('.grimoire-levels button[aria-pressed=true]')?.textContent==='1'));
  await measure('spell-level-all',p.getByRole('button',{name:'Tous les niveaux',exact:true}),()=>p.waitForFunction(()=>document.querySelector('.grimoire-levels button[aria-pressed=true]')?.textContent==='Tous'));
 }
 await measure('open-creator',p.getByRole('button',{name:'Modifier',exact:true}),()=>p.locator('.single-body').waitFor());
 for(let i=0;i<3;i++){
  await measure('creator-abilities',p.locator('.journey-steps').getByRole('button',{name:'Caractéristiques',exact:true}),()=>p.locator('.score-table').waitFor());
  await measure('creator-identity',p.locator('.journey-steps').getByRole('button',{name:'Origine',exact:true}),()=>p.locator('#character-name').waitFor());
 }
 assert.deepEqual(errors,[]);await mkdir('artifacts',{recursive:true});await writeFile('artifacts/click-latency-'+(process.argv[2]??'current')+'.json',JSON.stringify(timings,null,2));console.log(timings);
}finally{if(browser)await browser.close();server.kill();}
