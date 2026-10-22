import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const port=4197,engine=process.env.PILOT20_E2E_BROWSER==='webkit'?webkit:chromium;
const server=spawn(process.execPath,['scripts/serve-web.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
 browser=await engine.launch(engine===webkit?{}:{executablePath:process.env.PILOT20_CHROMIUM,args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
 await p.goto(`http://127.0.0.1:${port}/web/index.html`);await p.locator('header').waitFor();
 const before=await p.evaluate(async()=>{
  const{openIndexedDB}=await import('/src/persistence/adapters.js'),s=await openIndexedDB();
  const{playerCatalogs}=await import('/src/catalog/player-catalogs.js'),{campaignRepository}=await import('/src/campaign/repository.js'),{characterLibrary}=await import('/src/persistence/library.js'),{creatorRepository}=await import('/src/creator/repository.js'),{newDraft,suggestChoices,compileDraft}=await import('/src/creator/model.js');
  const lib=characterLibrary(s),repo=creatorRepository(s,lib),campaigns=campaignRepository(s,playerCatalogs),config=await campaigns.initialize(),ctx=await campaigns.context(config);
  let d=Object.assign(newDraft('default','compact-wizard'),{name:'Compact wizard',classChosen:true,raceId:'srd51:race:half-elf',backgroundId:'srd51:background:acolyte',classes:[{id:'wizard',level:3,subclassId:ctx.index.class('wizard').data.subclassIds[0]}],startingEquipmentEnabled:true});
  d=suggestChoices(ctx,config,d);d.confirmed=d.reviewed=true;await repo.save(d);const result=compileDraft(ctx,config,d);if(!result.valid)throw Error(JSON.stringify(result.issues));await repo.finalize(d,result.character,{expectedDraftRevision:1,spellbook:result.spellbook});s.close();return result.character;
 });
 await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();
 await p.locator('article').filter({has:p.getByRole('heading',{name:'Compact wizard',exact:true})}).getByRole('button',{name:'Ouvrir',exact:true}).click();
 await p.locator('.character-sheet').waitFor();assert.equal(await p.locator('.sheet-ability').count(),6);assert.equal(await p.locator('.sheet-save').count(),6);
 await mkdir('artifacts',{recursive:true});
 for(const width of [320,390,820,1180]){
  await p.setViewportSize({width,height:844});
  for(const name of ['Fiche','Compétences','Capacités','Inventaire','Sorts']){
   await p.locator('.sheet-tabs').getByRole('button',{name,exact:true}).click();
   if(name==='Sorts')await p.locator('.grimoire').waitFor();
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow at '+width);
  }
  await p.locator('.sheet-tabs').getByRole('button',{name:'Fiche',exact:true}).click();await p.screenshot({path:`artifacts/sheet-${width}.png`,fullPage:true});
 }
 await p.locator('.sheet-tabs').getByRole('button',{name:'Compétences',exact:true}).click();assert.equal(await p.locator('.sheet-skill').count(),18);
 await p.getByRole('button',{name:'Maîtrisées seules',exact:true}).click();assert.equal(await p.locator('.sheet-skill').count(),Object.values(before.skills).filter(n=>n>0).length);
 await p.locator('.sheet-tabs').getByRole('button',{name:'Sorts',exact:true}).click();
 await p.getByRole('button',{name:'Niveau 1',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('.grimoire-level-heading').length===1);
 assert.equal(await p.locator('.grimoire-level-heading').count(),1);assert.equal(await p.locator('.grimoire-level-heading').textContent(),'Niveau 1');
 assert.ok(await p.locator('.spell-preparation').count()>0);assert.equal(await p.locator('.grimoire-list summary').count(),0);
 const first=p.locator('.grimoire-spell').first();await first.locator('.spell-title').click();await p.locator('#dialog[open]').waitFor();assert.ok(await p.locator('#dialog .grimoire-origins').count());await p.evaluate(()=>document.querySelector('#dialog').close());
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:'artifacts/sheet-grimoire-390.png',fullPage:true});
 const after=await p.evaluate(async()=>{const{openIndexedDB}=await import('/src/persistence/adapters.js'),s=await openIndexedDB(),record=await s.get('characters','compact-wizard');s.close();return record.definition;});assert.deepEqual(after,before);
 await p.reload();await p.locator('header').getByRole('button',{name:'Mes persos',exact:true}).click();await p.locator('article').filter({has:p.getByRole('heading',{name:'Compact wizard',exact:true})}).getByRole('button',{name:'Ouvrir',exact:true}).click();await p.locator('.sheet-tabs button[aria-pressed=true]').waitFor();assert.equal(await p.locator('.sheet-tabs button[aria-pressed=true]').innerText(),'Sorts');await p.locator('.grimoire').waitFor();
 assert.equal(await p.getByRole('button',{name:'Niveau 1',exact:true}).getAttribute('aria-pressed'),'true');
 await p.locator('.sheet-tabs').getByRole('button',{name:'Capacités',exact:true}).click();await p.locator('.sheet-simulation summary').click();await p.getByRole('button',{name:'Nouvelle séance de démonstration',exact:true}).click();await p.getByText('PV et ressources : simulation locale active.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('Compact sheet passed: real derived stats, five tabs, proficiency filtering, embedded spellbook, levels, details, persisted view, unchanged character, four widths.');
}finally{if(browser)await browser.close();server.kill();}
