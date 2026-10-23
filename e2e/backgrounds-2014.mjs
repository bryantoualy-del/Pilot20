import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const port=4198,engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
try{
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j)});
 browser=await engine.launch(engine===webkit?{}:{executablePath:process.env.E2E_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [390,1180]){
  const p=await browser.newPage({viewport:{width,height:820}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(30000);
  await p.goto(`http://127.0.0.1:${port}/web/index.html`);await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();await p.locator('.race-picker').waitFor();
  await p.evaluate(async()=>{const{openIndexedDB}=await import('/src/persistence/adapters.js');const storage=await openIndexedDB(),rows=await storage.list('meta','creator:draft:'),d=rows[0].value;if(d.backgroundId!=='srd51:background:acolyte')throw new Error('New drafts must start with Acolyte');Object.assign(d,{name:'Background browser',mode:'single',step:'background',classChosen:true,raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:'fighter',level:1,subclassId:null}]});await storage.batch([],[{store:'meta',key:'creator:draft:'+d.id,value:d}]);storage.close();});
  await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();await p.locator('article').filter({has:p.getByRole('heading',{name:'Background browser',exact:true})}).getByRole('button',{name:/^Reprendre/}).click();
  const picker=p.getByLabel('Historique',{exact:true});await picker.waitFor();assert.equal(await picker.locator('option').count(),31);
  assert.equal(await picker.inputValue(),'srd51:background:acolyte');
  assert.equal(await p.getByRole('searchbox',{name:'Rechercher un historique'}).count(),0);
  assert.equal(await p.getByLabel('Source',{exact:true}).count(),0);
  for(const [id,name]of [['cos:background:haunted-one','Hanté'],['scag:background:far-traveler','Grand voyageur'],['phb14:background:soldier','Soldat'],['phb14:background:charlatan','Charlatan']]){
   await picker.selectOption(id);await p.getByRole('heading',{name,exact:true}).waitFor();
  }
  await picker.selectOption('eberron:background:house-agent');await p.getByRole('heading',{name:'Agent de maison',exact:true}).waitFor();
  assert.equal(await p.locator('.background-preview > small').count(),0);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);

  await mkdir('docs/screenshots/backgrounds',{recursive:true});await p.screenshot({path:`docs/screenshots/backgrounds/${engine.name()}-${width}.png`,fullPage:true});
  await picker.selectOption('');await p.getByRole('heading',{name:'Créez votre historique'}).waitFor();await p.getByLabel('Nom de l’historique',{exact:true}).fill('Ancien éclaireur');const oldInput=await p.getByLabel('Nom de l’historique',{exact:true}).elementHandle();await p.getByLabel('Nom de l’historique',{exact:true}).press('Tab');await p.waitForFunction(input=>!input.isConnected,oldInput);await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();await p.locator('article').filter({has:p.getByRole('heading',{name:'Background browser',exact:true})}).getByRole('button',{name:/^Reprendre/}).click();await p.getByRole('heading',{name:'Créez votre historique'}).waitFor();assert.equal(await p.getByLabel('Nom de l’historique',{exact:true}).inputValue(),'Ancien éclaireur');
  console.log(`${engine.name()} ${width}: simple catalog, Acolyte default, no source UI, preview and custom persistence passed`);await p.close();
 }
}finally{await browser?.close();server.kill();}
