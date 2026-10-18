import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
const port=Number(process.env.PILOT20_E2E_PORT??4180),server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;
try {
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
 const engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch(engine===webkit?{}:{args:['--no-sandbox']});
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
 await p.goto(`http://127.0.0.1:${port}/web/index.html`);
 await p.getByRole('button',{name:'Créer un personnage',exact:true}).waitFor();
 await p.evaluate(async()=>{
  const {openIndexedDB}=await import('/src/persistence/adapters.js'),{defaultCampaign}=await import('/src/campaign/sources.js');
  const s=await openIndexedDB(),legacy={...defaultCampaign(),enabledSourceIds:['srd51']};delete legacy.sourceRestrictionsEnabled;
  await s.batch([],[{store:'meta',key:'campaign:sources:default',value:legacy}]);s.close();
 });
 await p.reload();
 await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();
 await p.locator('#character-name').waitFor();
 assert.equal(await p.getByRole('button',{name:'Modifier les sources',exact:true}).count(),0);
 async function changed(action){const old=await p.locator('.single-body').elementHandle();await action();await p.waitForFunction(e=>!e.isConnected,old);await old.dispose();}
 await changed(async()=>{await p.locator('#character-name').fill('Source migration');await p.locator('#character-name').blur();});
 await changed(()=>p.locator('.single-actions .primary').click());
 const search=p.getByRole('searchbox',{name:'Rechercher une race',exact:true});
 for(const name of ['Dhampir','Génasi','Kobold']){
  await search.fill(name);const option=p.locator('.single-races button').first();assert.ok(await option.isEnabled());
  await changed(()=>option.click());assert.equal(await p.locator('#dialog[open]').count(),0);
 }
 await p.getByRole('button',{name:'Enregistrer et quitter',exact:true}).click();
 await p.locator('header').getByRole('button',{name:'Paramètres de campagne',exact:true}).click();
 const restriction=()=>p.getByLabel('Restreindre les ouvrages (MJ)',{exact:true});
 assert.equal(await restriction().isChecked(),false);assert.equal(await p.locator('.source-card').count(),0);
 await restriction().check();await p.locator('.source-card').first().waitFor();
 assert.equal(await p.getByText('Aucun pack installé : contenu indisponible',{exact:true}).count(),0);
 assert.equal(await p.getByText('Choix maison',{exact:true}).count(),0,'empty sources hidden');
 assert.equal(await p.getByLabel('Chaudron des merveilles de Tasha',{exact:true}).isChecked(),false,'legacy allowlist preserved');
 async function available(){return p.evaluate(async()=>{
  const {openIndexedDB}=await import('/src/persistence/adapters.js'),{campaignRepository}=await import('/src/campaign/repository.js'),{playerCatalogs}=await import('/src/catalog/player-catalogs.js');
  const s=await openIndexedDB(),repo=campaignRepository(s,playerCatalogs),c=await repo.get(),ctx=await repo.context(c);s.close();
  return {artificer:!!ctx.index.class('artificer'),dhampir:!!ctx.index.get('ravenloft:race:dhampir'),revision:c.revision};
 });}
 assert.equal((await available()).artificer,false);
 await restriction().uncheck();await p.waitForFunction(()=>document.querySelectorAll('.source-card').length===0);
 assert.equal((await available()).artificer,true);assert.equal((await available()).dhampir,true);
 await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();
 await p.getByRole('heading',{name:'Source migration',exact:true}).waitFor();
 await p.getByRole('button',{name:/^Reprendre/}).click();
 assert.equal(await p.locator('.single-races button[aria-pressed=true]').innerText(),'Kobold');
 assert.deepEqual(errors,[]);
 console.log('Legacy migration, direct race selection, retained draft, MJ on/off, empty sources and no source step: passed.');
} finally {if(browser)await browser.close();server.kill();}
