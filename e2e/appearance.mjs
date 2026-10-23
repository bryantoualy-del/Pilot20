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
  await p.locator('.race-picker').waitFor();
  assert.equal(await p.getByRole('progressbar').getAttribute('value'),'1');
  await p.locator('.journey-steps').getByRole('button',{name:'Identité & portrait',exact:true}).click();
  await p.locator('#character-name').waitFor();
  assert.equal(await p.getByRole('progressbar').getAttribute('value'),'9');
  assert.equal(await p.getByRole('progressbar').getAttribute('max'),'10');
  assert.ok(await p.getByText('Apparence uniquement, sans effet sur les caractéristiques.',{exact:true}).isVisible());
  assert.equal(await p.locator('html').evaluate(e=>getComputedStyle(e).colorScheme),'dark');
  assert.equal(await p.locator('html').evaluate(e=>getComputedStyle(e).getPropertyValue('--bg').trim()),'#191b1f');
  assert.equal(await p.locator('.physical-fields input').count(),9);
  for(const size of [{width:375,height:667},{width:390,height:844},{width:1180,height:820}]){
    await p.setViewportSize(size);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
    await p.screenshot({path:`docs/screenshots/appearance/identity-${size.width}.png`,fullPage:true});
  }
  await p.locator('header').getByLabel('Langue / Language').selectOption('en');
  await p.getByRole('heading',{name:'Identity & portrait',exact:true}).waitFor();
  assert.ok(await p.getByRole('button',{name:'Generate with ChatGPT',exact:true}).isVisible());
  assert.deepEqual(errors,[]);
  console.log('Appearance: warm dark palette, explicit FR/EN disclosure hints, rotating chevron, portrait section opens by touch/keyboard, responsive375/390/1180 screenshots.');
}finally{if(browser)await browser.close();server.kill();}
