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
  await p.goto(`http://127.0.0.1:${port}/web/index.html`);await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();await p.locator('#character-name').waitFor();
  await p.evaluate(async()=>{const{openIndexedDB}=await import('/src/persistence/adapters.js');const storage=await openIndexedDB(),rows=await storage.list('meta','creator:draft:'),d=rows[0].value;Object.assign(d,{name:'Background browser',mode:'single',step:'background',classChosen:true,raceId:'srd51:race:human',backgroundId:null,classes:[{id:'fighter',level:1,subclassId:null}]});await storage.batch([],[{store:'meta',key:'creator:draft:'+d.id,value:d}]);storage.close();});
  await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();await p.locator('article').filter({has:p.getByRole('heading',{name:'Background browser',exact:true})}).getByRole('button',{name:/^Reprendre/}).click();
  const search=p.getByRole('searchbox',{name:'Rechercher un historique'});await search.waitFor();
  const picker=p.locator('select').filter({has:p.locator('option[value="srd51:background:acolyte"]')});await picker.waitFor();assert.equal(await picker.locator('option').count(),31);
  for(const [query,id,name]of [['hante','cos:background:haunted-one','Hanté'],['grand voyageur','scag:background:far-traveler','Grand voyageur'],['infanterie','phb14:background:soldier','Soldat'],['arnaqueur','phb14:background:criminal','Criminel']]){
   await search.fill(query);const selected=p.locator('select').filter({has:p.locator(`option[value="${id}"]`)});await selected.selectOption(id);await p.getByRole('heading',{name,exact:true}).waitFor();
   if(query==='infanterie')await p.getByLabel('Spécialité (facultatif)').selectOption('Infanterie');
  }
  await search.fill('');const source=p.locator('select').filter({has:p.locator('option[value="eberron"]')});await source.selectOption('eberron');const housePicker=p.locator('select').filter({has:p.locator('option[value="eberron:background:house-agent"]')});await housePicker.selectOption('eberron:background:house-agent');await p.getByRole('heading',{name:'Agent de maison',exact:true}).waitFor();
  assert.match(await p.locator('.background-preview').innerText(),/Eberron/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await mkdir('docs/screenshots/backgrounds',{recursive:true});await p.screenshot({path:`docs/screenshots/backgrounds/${engine.name()}-${width}.png`,fullPage:true});
  await housePicker.selectOption('');await p.getByText('Langues, outils et capacité de cet historique restent à vérifier avec votre MJ.',{exact:true}).waitFor();
  console.log(`${engine.name()} ${width}: catalog, accent-insensitive search, CC aliases, source filter, preview and custom background passed`);await p.close();
 }
}finally{await browser?.close();server.kill();}
