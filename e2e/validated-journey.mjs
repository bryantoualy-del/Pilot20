import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
const port=Number(process.env.PILOT20_E2E_PORT??4180);
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;
try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
  const engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
  browser=await engine.launch(engine===webkit?{}:{args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);
  await page.goto('http://127.0.0.1:'+port+'/web/index.html');
  await page.getByRole('button',{name:'Créer un personnage',exact:true}).click();
  await page.locator('#character-name').waitFor();
  assert.deepEqual(await page.locator('.journey-steps button').allTextContents(),
    ['01Origine','02Classe','03Caractéristiques','04Choix','05Magie & équipement','06Validation']);
  assert.equal(await page.locator('.journey-steps [aria-current=step]').count(),1);
  assert.equal(await page.locator('.single-progress').getAttribute('max'),'6');
  assert.equal(await page.locator('.single-plan[open]').count(),0);
  const navigate=async fn=>{const old=await page.locator('.single-body').elementHandle();await fn();
    await page.waitForFunction(e=>!e.isConnected,old);await old.dispose();};
  await navigate(async()=>{await page.locator('#character-name').fill('UX visuelle');await page.locator('#character-name').blur();});
  await navigate(()=>page.locator('.single-actions .primary').click());
  assert.equal(await page.locator('.race-picker').count(),1);
  await page.getByRole('searchbox',{name:'Rechercher une race'}).fill('humain');
  await navigate(()=>page.locator('.single-races button').filter({hasText:'Humain'}).first().click());
  assert.equal(await page.locator('.race-facts').count(),1);
  assert.ok((await page.locator('.race-facts').innerText()).length>20);
  await navigate(()=>page.locator('.journey-steps button[aria-label="Classe"]').click());
  await navigate(()=>page.locator('.single-classes button').filter({hasText:'Guerrier'}).first().click());
  assert.equal(await page.locator('.single-classes button').count(),13);
  await page.waitForFunction(()=>[...document.querySelectorAll('.single-classes img.class-icon')]
    .length===13&&[...document.querySelectorAll('.single-classes img.class-icon')]
    .every(img=>img.complete&&img.naturalWidth>0));
  const loaded=await page.locator('.single-classes img.class-icon').evaluateAll(nodes=>
    nodes.length===13&&nodes.every(img=>img.complete&&img.naturalWidth>0));
  assert.ok(loaded,'existing local class icons loaded');
  assert.ok(await page.locator('.level-stepper input').isVisible());
  for(const size of [{width:375,height:667},{width:390,height:844},{width:820,height:1180},{width:1180,height:820}]){
    await page.setViewportSize(size);
    const measurements=await page.evaluate(()=>({
      viewport:innerWidth,
      document:document.documentElement.scrollWidth,
      actions:[...document.querySelectorAll('.single-actions button')].map(e=>e.getBoundingClientRect().height),
      stages:[...document.querySelectorAll('.journey-steps button')].map(e=>e.getBoundingClientRect().width)
    }));
    assert.ok(measurements.document<=measurements.viewport,'horizontal overflow '+JSON.stringify(measurements));
    assert.ok(measurements.actions.every(x=>x>=44),'touch target too short');
    assert.ok(measurements.stages.every(x=>x>0),'missing progress stage');
  }
  await page.setViewportSize({width:390,height:844});
  await navigate(()=>page.locator('.journey-steps button[aria-label="Caractéristiques"]').click());
  assert.equal(await page.locator('.score-table .score-row').count(),6);
  assert.equal(await page.locator('.score-table .score-final').count(),6);
  assert.equal(await page.locator('.journey-steps [aria-current=step]').getAttribute('aria-label'),'Caractéristiques');
  assert.deepEqual(errors,[]);
  console.log('Six-stage 2014 UX: icons, race details, class/level, scores, touch targets and four viewports validated.');
} finally {if(browser)await browser.close();server.kill();}
