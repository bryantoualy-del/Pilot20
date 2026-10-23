import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
const port=Number(process.env.PILOT20_E2E_PORT??4180);
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
 const engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch(engine===webkit?{}:{executablePath:process.env.PILOT20_CHROMIUM,args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1180,height:820}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://127.0.0.1:${port}/web/index.html`);
 await p.getByRole('button',{name:'Créer un personnage',exact:true}).waitFor();
 await p.evaluate(async()=>{
  const {openIndexedDB}=await import('/src/persistence/adapters.js'),s=await openIndexedDB();
  const key='campaign:sources:default',c=await s.get('meta',key);delete c.sourceRestrictions;c.enabledSourceIds=['srd51'];
  await s.batch([],[{store:'meta',key,value:c}]);s.close();
 });
 await p.reload();
 await p.getByRole('button',{name:'Créer un personnage',exact:true}).click();
 const next=async action=>{const old=await p.locator('.single-body').elementHandle();await action();await p.waitForFunction(e=>!e.isConnected,old);await old.dispose();};
 await p.locator('.journey-steps').getByRole('button',{name:'Identité & portrait',exact:true}).click();await p.locator('#character-name').waitFor();
 assert.equal(await p.locator('.single-body').getByText('Modifier les sources',{exact:true}).count(),0);
 await next(async()=>{await p.locator('#character-name').fill('Dhampir sources');await p.locator('#character-name').blur();});
 await next(()=>p.locator('.journey-steps').getByRole('button',{name:'Race',exact:true}).click());
 await p.getByRole('searchbox',{name:'Rechercher une race',exact:true}).fill('dhampir');
 await next(()=>p.getByRole('button',{name:'Dhampir',exact:true}).click());
 assert.equal(await p.locator('#dialog[open]').count(),0);
 const read=()=>p.evaluate(async()=>{
  const {openIndexedDB}=await import('/src/persistence/adapters.js'),s=await openIndexedDB();
  try{return {config:await s.get('meta','campaign:sources:default'),draft:(await s.list('meta','creator:draft:'))[0].value};}finally{s.close();}
 });
 const saved=await read();assert.equal(saved.config.sourceRestrictions,false);assert.deepEqual(saved.config.enabledSourceIds,['srd51']);
 assert.equal(saved.draft.raceId,'ravenloft:race:dhampir');
 await p.locator('header').getByRole('button',{name:'Paramètres de campagne',exact:true}).click();
 const restrict=p.getByRole('checkbox',{name:'Activer les restrictions du MJ par ouvrage',exact:true});
 assert.equal(await restrict.isChecked(),false);
 assert.equal(await p.getByText('Aucun pack installé : contenu indisponible',{exact:true}).count(),0);
 const oldRestriction=await restrict.elementHandle();await restrict.check();
 await p.waitForFunction(e=>!e.isConnected,oldRestriction);await oldRestriction.dispose();
 assert.equal(await p.getByRole('checkbox',{name:'Van Richten',exact:true}).isChecked(),false);
 await restrict.uncheck();await p.waitForFunction(async()=>{
  const {openIndexedDB}=await import('/src/persistence/adapters.js'),s=await openIndexedDB();try{return (await s.get('meta','campaign:sources:default')).sourceRestrictions===false;}finally{s.close();}
 });
 await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();
 await p.getByRole('button',{name:/^Reprendre/}).click();await p.locator('.race-picker').waitFor();
 assert.equal(await p.locator('.single-races button[aria-pressed=true]').count(),1);
 assert.deepEqual((await read()).draft.raceId,saved.draft.raceId);
 assert.deepEqual(errors,[]);
 console.log('Unified sources: legacy migration, direct Dhampir selection, MJ restrictions on/off, retained draft and reload passed.');
}finally{if(browser)await browser.close();server.kill();}
