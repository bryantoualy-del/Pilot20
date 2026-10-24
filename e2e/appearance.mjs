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
  const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
  p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await mkdir('docs/screenshots/appearance',{recursive:true});
  await p.goto(`http://127.0.0.1:${port}/web/index.html`);
  await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();
  await p.locator('#character-name').waitFor();
  assert.equal(await p.locator('.appearance-controls').count(),0,'appearance is no longer at the start');
  await p.locator('.journey-steps').getByRole('button',{name:'Validation',exact:true}).click();
  await p.locator('.summary-layout').waitFor();
  const summary=p.locator('.summary-appearance>summary');
  assert.match(await summary.innerText(),/Portrait & apparence/);
  await summary.click();
  async function style(){return summary.evaluate(e=>({
    open:e.parentElement.open,arrow:getComputedStyle(e,'::before').transform,
    arrowWidth:getComputedStyle(e,'::before').width,hint:getComputedStyle(e,'::after').content,
    colorScheme:getComputedStyle(document.documentElement).colorScheme,
    background:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  }));}
  const closed=await style();assert.equal(closed.open,false);assert.notEqual(closed.arrowWidth,'0px');
  assert.match(closed.hint,/Afficher/);assert.equal(closed.colorScheme,'dark');assert.equal(closed.background,'#191b1f');
  const progress=p.getByRole('progressbar',{name:'Progression de la création'});
  assert.equal(await progress.getAttribute('value'),'6');
  assert.ok(Number(await progress.getAttribute('max'))>1);
  assert.match(await progress.getAttribute('aria-valuetext'),/Votre personnage est-il prêt/);
  await p.screenshot({path:'docs/screenshots/appearance/phone-closed.png',fullPage:true});
  await summary.click();await p.waitForTimeout(200);
  const opened=await style();assert.equal(opened.open,true);assert.notEqual(opened.arrow,closed.arrow);assert.match(opened.hint,/Masquer/);
  assert.ok(await p.getByText('Apparence uniquement, sans effet sur les caractéristiques.',{exact:true}).isVisible());
  for(const size of [{width:375,height:667},{width:390,height:844},{width:1180,height:820}]){
    await p.setViewportSize(size);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
    const portrait=await p.locator('.summary-appearance').boundingBox(),review=await p.locator('.summary-review').boundingBox();
    if(size.width>=900){assert.ok(portrait.x+portrait.width<=review.x,'portrait left of recap');assert.ok(Math.abs(portrait.y-review.y)<2);}
    else assert.ok(portrait.y+portrait.height<=review.y,'portrait before recap on phone');
    await p.screenshot({path:`docs/screenshots/appearance/open-${size.width}.png`,fullPage:true});
  }
  assert.ok(await p.getByRole('button',{name:'Enregistrer le personnage',exact:true}).isDisabled(),'incomplete draft cannot be saved');
  assert.ok(await p.locator('.recap-section[open]').count()>0,'incomplete sections open automatically');
  await p.locator('.summary-preview>summary').click();
  assert.ok(await p.getByText('Complétez les choix ci-dessous pour calculer la fiche.',{exact:true}).isVisible());
  const portrait=await p.screenshot({clip:{x:0,y:0,width:64,height:64}});
  await p.getByText('Personnaliser le portrait',{exact:true}).click();
  await p.getByLabel('Importer un portrait',{exact:true}).setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:portrait});
  await p.waitForFunction(()=>document.querySelector('.summary-appearance img')?.src.startsWith('data:image/jpeg'));
  const old=await p.locator('.single-body').elementHandle();
  await p.getByLabel('Description physique',{exact:true}).fill('Une cicatrice au menton.');await p.getByLabel('Description physique',{exact:true}).blur();
  await p.waitForFunction(e=>!e.isConnected,old);await old.dispose();
  assert.equal(await p.getByLabel('Description physique',{exact:true}).inputValue(),'Une cicatrice au menton.');
  assert.ok(await p.locator('.summary-appearance').evaluate(e=>e.open),'editing retains disclosure state');
  await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();
  await p.getByRole('button',{name:/^Reprendre/}).click();await p.locator('.summary-layout').waitFor();
  assert.equal(await p.getByLabel('Description physique',{exact:true}).inputValue(),'Une cicatrice au menton.');
  assert.match(await p.locator('.summary-appearance img').getAttribute('src'),/^data:image\/jpeg/);
  await summary.focus();await p.keyboard.press('Enter');assert.equal((await style()).open,false);
  await p.locator('header').getByLabel('Langue / Language').selectOption('en');
  const english=p.getByText('Portrait & appearance',{exact:true});
  await english.waitFor();assert.match(await english.evaluate(e=>getComputedStyle(e,'::after').content),/Show/);
  assert.deepEqual(errors,[]);
  console.log('Appearance: warm dark palette, explicit FR/EN disclosure hints, rotating chevron, portrait section opens by touch/keyboard, responsive375/390/1180 screenshots.');
}finally{if(browser)await browser.close();server.kill();}
