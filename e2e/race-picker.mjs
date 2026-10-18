import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const port=Number(process.env.PILOT20_E2E_PORT??4180);
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;
try {
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',n=>reject(Error('server '+n)));});
  const engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
  browser=await engine.launch(engine===webkit?{}:{args:['--no-sandbox']});
  const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/web/index.html`);
  await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();
  async function changed(action){const old=await p.locator('.single-body').elementHandle();await action();await p.waitForFunction(e=>!e.isConnected,old);await old.dispose();}
  await p.locator('#character-name').waitFor();
  await changed(async()=>{await p.locator('#character-name').fill('Lignée test');await p.locator('#character-name').blur();});
  await changed(()=>p.locator('.single-actions .primary').click());
  assert.ok(await p.locator('.single-races button').count()>=44);
  assert.equal(await p.getByRole('progressbar').getAttribute('value'),'2');
  // Every installed family uses the transparent icon set, including label aliases.
  const icons=await p.locator('.single-races').evaluate(async grid=>{
    return Promise.all([...grid.querySelectorAll('button')].map(async b=>{
      const img=b.querySelector('img');if(!img)return {name:b.textContent,ok:false};
      img.loading='eager';try{await img.decode();}catch{}
      return {name:b.textContent,ok:img.naturalWidth>0&&img.getAttribute('src').includes('/work4/races/')};
    }));
  });
  assert.deepEqual(icons.filter(i=>!i.ok),[],'all racial cards must load an icon, not a portrait');
  const paper=await p.locator('.single-actions').evaluate(e=>({bar:getComputedStyle(e).backgroundColor,page:getComputedStyle(document.body).backgroundColor,gap:e.getBoundingClientRect().top-e.previousElementSibling.getBoundingClientRect().bottom}));
  assert.equal(paper.bar,paper.page);assert.ok(paper.gap<=8,'no empty band before navigation');
  await mkdir('docs/screenshots/appearance',{recursive:true});
  await p.screenshot({path:'docs/screenshots/appearance/races-phone.png',fullPage:true});
  await p.setViewportSize({width:1180,height:820});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:'docs/screenshots/appearance/races-desktop.png',fullPage:true});
  await p.setViewportSize({width:390,height:844});
  assert.equal(await p.getByText('Autres races et origine personnalisée',{exact:true}).count(),0);
  const search=p.getByRole('searchbox',{name:'Rechercher une race',exact:true});
  await search.fill('aasimar');assert.equal(await p.locator('.single-races button').count(),1);
  assert.equal(await p.locator('.single-races button').isEnabled(),true);
  await changed(()=>p.locator('.single-races button').click());
  assert.equal(await p.locator('#dialog[open]').count(),0,'installed races select directly without source authorization');
  assert.equal(await p.locator('.single-races button[aria-pressed=true]').count(),1);
  await search.fill('dwarf');assert.equal(await p.getByRole('button',{name:'Nain',exact:true}).count(),1);
  await search.fill('kobold');assert.ok(await p.getByRole('button',{name:'Kobold',exact:true}).isEnabled());
  await search.fill('');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.getByRole('button',{name:'Lignée sur mesure',exact:true}).click();
  const dialog=p.locator('#dialog');
  await dialog.getByRole('heading',{name:'Lignée sur mesure — Tasha',exact:true}).waitFor();
  assert.equal(await dialog.getByLabel('Parcours',{exact:true}).count(),0);
  const option=dialog.getByLabel('Autoriser l’option Lignée sur mesure dans cette campagne',{exact:true});
  const old=await option.elementHandle();await option.check();await p.waitForFunction(e=>!e.isConnected,old);await old.dispose();
  await dialog.getByLabel('Caractéristique +2',{exact:true}).selectOption('str');
  await dialog.getByLabel('Don installé',{exact:true}).selectOption('srd51:grappler');
  await dialog.getByLabel('Le MJ autorise cette lignée et cette langue',{exact:true}).check();
  await dialog.getByRole('button',{name:'Enregistrer et utiliser',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  const saved=await p.evaluate(async()=>{
    const {openIndexedDB}=await import('/src/persistence/adapters.js');
    const {campaignRepository}=await import('/src/campaign/repository.js');
    const {playerCatalogs}=await import('/src/catalog/player-catalogs.js');
    const {draftProgression}=await import('/src/creator/model.js');
    const s=await openIndexedDB();try{
      const d=(await s.list('meta','creator:draft:'))[0].value,c=campaignRepository(s,playerCatalogs),config=await c.get(),ctx=await c.context(config);
      return {draft:d,entry:ctx.index.get(d.raceId),report:draftProgression(ctx,config,d)};
    }finally{s.close();}
  });
  assert.equal(saved.draft.manualRace,null);assert.equal(saved.entry.data.customLineage.ability,'str');
  assert.equal(saved.report.scores.str,saved.draft.scores.str+2);
  assert.equal(saved.report.issues.some(i=>i.code==='invalid-custom-lineage'),false);
  await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();
  await p.getByRole('button',{name:/^Reprendre/}).click();await p.locator('.race-picker').waitFor();
  assert.equal(await p.locator('.single-races button[aria-pressed=true]').count(),1);
  assert.deepEqual(errors,[]);
  console.log('Race picker: all families visible; bilingual search; source and rules states; no manual-trait path; strict Tasha lineage saves, applies +2 and survives reload.');
} finally {if(browser)await browser.close();server.kill();}
