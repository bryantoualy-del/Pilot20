import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const port=4192,engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
 browser=await engine.launch(engine===webkit?{}:{args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://127.0.0.1:${port}/web/index.html`);await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();await p.locator('#character-name').waitFor();
 const id=await p.evaluate(async()=>{
  const{openIndexedDB}=await import('/src/persistence/adapters.js'),s=await openIndexedDB();const rows=await s.list('meta','creator:draft:');const d=rows[0].value;Object.assign(d,{name:'Compact',step:'scores',scoreMethod:'point-buy',scoresAreBase:true,raceId:'srd51:race:human',scores:{str:8,dex:8,con:8,int:8,wis:8,cha:8}});await s.batch([],[{store:'meta',key:'creator:draft:'+d.id,value:d}]);s.close();return d.id;
 });
 await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();await p.locator('article').filter({has:p.getByRole('heading',{name:'Compact',exact:true})}).getByRole('button',{name:/^Reprendre/}).click();
 await p.locator('.score-table').waitFor();assert.equal(await p.locator('.score-table tbody tr').count(),6);assert.equal(await p.locator('.point-budget strong').innerText(),'0 / 27');assert.equal(await p.getByRole('button',{name:'Diminuer Force',exact:true}).isDisabled(),true);
 await p.getByRole('button',{name:'Augmenter Force',exact:true}).click();await p.getByText('1 / 27',{exact:true}).waitFor();
 await p.locator('.single-plan summary').click();assert.ok(await p.locator('.single-plan nav button').count()<=11);assert.equal(await p.getByText('Un choix de votre origine',{exact:true}).count(),0);
 await mkdir('artifacts',{recursive:true});
 for(const width of [375,390,1180]){await p.setViewportSize({width,height:820});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`artifacts/compact-scores-${width}.png`,fullPage:true});}
 await p.evaluate(async()=>{const{showEntryDetails}=await import('/web/app/spell-detail.js');const{playerCatalogs}=await import('/src/catalog/player-catalogs.js');const{campaignCatalog,defaultCampaign}=await import('/src/campaign/sources.js');const{messages}=await import('/web/app/i18n.js');const c=campaignCatalog(playerCatalogs,[],defaultCampaign());showEntryDetails(c.index.get('srd51:fire-bolt'),{state:{locale:'fr'},context:c,name:e=>e.name.fr,t:k=>messages.fr[k]??k,modal:body=>{document.querySelector('main').append(body)}});});
 assert.equal(await p.locator('dt strong').count(),6);assert.ok(!(await p.locator('main').innerText()).includes('nullnull'));assert.deepEqual(errors,[]);console.log('Compact creator: score buttons, budget, grouped menu, no overflow, null-free facts');
}finally{if(browser)await browser.close();server.kill();}
