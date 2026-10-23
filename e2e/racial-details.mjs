import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const port=4196;
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;
try {
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
 const engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch(engine===webkit?{}:{executablePath:process.env.PILOT20_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://127.0.0.1:${port}/web/index.html`);
 await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();await p.locator('.race-picker').waitFor();
 async function seed(raceId,step){
  await p.evaluate(async({raceId,step})=>{
   const {openIndexedDB}=await import('/src/persistence/adapters.js'),s=await openIndexedDB();
   const rows=await s.list('meta','creator:draft:'),d=rows[0].value;
   Object.assign(d,{name:'Races test',raceId,step,subraceId:null,originSelections:{},scoreMethod:'point-buy',scoresAreBase:true,scores:{str:8,dex:8,con:8,int:8,wis:8,cha:15}});
   await s.batch([],[{store:'meta',key:'creator:draft:'+d.id,value:d}]);s.close();
  },{raceId,step});
  await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();
  await p.locator('article').filter({has:p.getByRole('heading',{name:'Races test',exact:true})}).getByRole('button',{name:/^Reprendre/}).click();
 }
 async function changed(action){const old=await p.locator('.single-body').elementHandle();await action();await p.waitForFunction(e=>!e.isConnected,old);await old.dispose();}
 await mkdir('artifacts',{recursive:true});
 await seed('srd51:race:half-elf','race');
 await p.locator('.race-facts dt').first().waitFor();
 assert.equal(await p.locator('.race-facts dt').filter({hasText:'Ascendance féerique'}).count(),1);
 assert.match(await p.locator('.race-facts dd').first().innerText(),/obscurité/);
 await p.screenshot({path:'artifacts/racial-traits-phone.png',fullPage:true});
 await seed('srd51:race:half-elf','scores');
 await p.locator('.score-table').waitFor();
 const row=name=>p.locator('.score-row').filter({has:p.getByRole('rowheader',{name,exact:true})});
 assert.equal(await row('Charisme').locator('.racial-fixed').innerText(),'+2 fixe');
 assert.equal(await row('Charisme').locator('input').count(),0);
 assert.match(await row('Charisme').locator('.score-final').innerText(),/17 \(\+3\)/);
 await changed(()=>p.getByRole('checkbox',{name:'Force +1',exact:true}).check());
 assert.match(await row('Force').locator('.score-final').innerText(),/9 \(-1\)/);
 await changed(()=>p.getByRole('checkbox',{name:'Dextérité +1',exact:true}).check());
 assert.match(await row('Dextérité').locator('.score-final').innerText(),/9 \(-1\)/);
 for(const width of [375,390,1180]){
  await p.setViewportSize({width,height:844});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const label=await row('Intelligence').locator('th').evaluate(e=>({height:e.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(e).lineHeight)}));
  if(width<700)assert.ok(label.height<label.lineHeight*2,'ability labels fit one line on phone');
  await p.screenshot({path:`artifacts/racial-scores-${width}.png`,fullPage:true});
 }
 await p.setViewportSize({width:390,height:844});
 await seed('srd51:race:human','race');
 await p.locator('.race-facts').waitFor();
 await p.getByRole('button',{name:'Humain avec don',exact:true}).waitFor();
 assert.equal(await p.locator('.ancestry-choice').count(),2);
 await changed(()=>p.getByRole('button',{name:'Humain avec don',exact:true}).click());
 assert.match(await p.locator('.ancestry-choice.selected').innerText(),/Don au choix/);
 await p.screenshot({path:'artifacts/human-variants-phone.png',fullPage:true});
 await changed(()=>p.locator('.single-actions .primary').click());
 assert.equal(await p.locator('.ancestry-choices').count(),0);
 await seed('srd51:race:dwarf','subrace');
 await p.locator('.ancestry-choice').first().waitFor();
 assert.equal(await p.locator('.ancestry-choice').count(),2);
 assert.match(await p.locator('.ancestry-choices').innerText(),/points de vie/);
 assert.match(await p.locator('.ancestry-choices').innerText(),/intermédiaires/i);
 await p.screenshot({path:'artifacts/subraces-phone.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Racial details: phone/desktop layout, partial and fixed bonuses, human second step, subrace benefits passed');
} finally {if(browser)await browser.close();server.kill();}
