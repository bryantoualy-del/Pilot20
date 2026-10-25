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
  // Regression: the original RPG Connect sorcerer artwork had an off-center alpha box.
  // The normalized Pilot20 image must render inside the same 40 x 40 box as every class.
  const sorcerer=page.locator('.single-classes img[src$="sorcerer.webp"]');
  assert.equal(await sorcerer.count(),1,'one Ensorceleur icon');
  const iconGeometry=await sorcerer.evaluate(img=>{
    const outer=img.getBoundingClientRect(),canvas=document.createElement('canvas');
    canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,64,64);
    const {data}=ctx.getImageData(0,0,64,64);
    let left=64,top=64,right=-1,bottom=-1;
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      if(data[(y*64+x)*4+3]<18)continue;
      left=Math.min(left,x);top=Math.min(top,y);
      right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    return {width:outer.width,height:outer.height,parent:img.parentElement.tagName,
      left,top,right,bottom,centerX:(left+right)/2,centerY:(top+bottom)/2};
  });
  assert.equal(iconGeometry.parent,'BUTTON','no per-icon image clipping frame');
  // Image still reserves 40 CSS pixels; the rendered mark grows 30% around its center.
  assert.equal(Math.round(iconGeometry.width),52);assert.equal(Math.round(iconGeometry.height),52);
  assert.equal(await sorcerer.evaluate(img=>getComputedStyle(img).width),'40px');
  assert.ok(Math.abs(iconGeometry.centerX-31.5)<=2&&Math.abs(iconGeometry.centerY-31.5)<=2,
    'Ensorceleur artwork must be visually centered: '+JSON.stringify(iconGeometry));
  assert.ok(iconGeometry.left>=3&&iconGeometry.right<=60&&iconGeometry.top>=5&&iconGeometry.bottom<=58,
    'transparent margins must exist on every side: '+JSON.stringify(iconGeometry));

  // Diagnostic: compare the *painted* footprint, not 40x40 transparent files.
  const iconMetrics=await page.evaluate(()=>{
    return [...document.querySelectorAll('.single-classes button')].map(button=>{
      const img=button.querySelector('img'),name=button.innerText.trim();
      if(!img||!img.complete||!img.naturalWidth)return{name,error:'not loaded'};
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,64,64);
      const d=ctx.getImageData(0,0,64,64).data;
      let x0=64,x1=-1,y0=64,y1=-1;
      for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(d[(y*64+x)*4+3]>=32){
        x0=Math.min(x0,x);x1=Math.max(x1,x);
        y0=Math.min(y0,y);y1=Math.max(y1,y);
      }
      const box=img.getBoundingClientRect(),card=button.getBoundingClientRect(),
        frame=button.querySelector('.class-icon-frame')?.getBoundingClientRect();
      let left=box.left+x0*box.width/64,top=box.top+y0*box.height/64,
        right=box.left+(x1+1)*box.width/64,bottom=box.top+(y1+1)*box.height/64;
      if(frame){left=Math.max(left,frame.left);right=Math.min(right,frame.right);
        top=Math.max(top,frame.top);bottom=Math.min(bottom,frame.bottom);}
      return{name,paintW:Math.round((right-left)*10)/10,paintH:Math.round((bottom-top)*10)/10,
        paintCenterOffset:Math.round(((left+right)/2-(card.left+card.right)/2)*10)/10,
        imgW:Math.round(box.width*10)/10,bounds:[x0,y0,x1,y1]};
    });
  });
  const referenceNames=new Set(['Barde','Clerc','Druide','Guerrier','Paladin']);
  const reference=iconMetrics.filter(x=>referenceNames.has(x.name)).map(x=>x.paintH).sort((a,b)=>a-b);
  const median=reference[Math.floor(reference.length/2)];
  const ensorceleur=iconMetrics.find(x=>x.name==='Ensorceleur');
  assert.ok(ensorceleur&&median>0,'measurable icons for optical comparison');
  assert.ok(ensorceleur.paintH>=median*.78&&ensorceleur.paintH<=median*1.22,
    'Ensorceleur should approach reference icon size: '+JSON.stringify({ensorceleur,median}));
  assert.ok(Math.abs(ensorceleur.paintCenterOffset)<=2.5,
    'Ensorceleur drawn center must remain aligned with its card: '+JSON.stringify(ensorceleur));
  console.log('CLASS_ICON_OPTICAL_SIZES '+JSON.stringify({median,icons:iconMetrics}));
  assert.ok(await page.locator('.level-stepper input').isVisible());
  for(const size of [{width:375,height:667},{width:390,height:844},{width:820,height:1180},{width:1180,height:820}]){
    await page.setViewportSize(size);
    await page.waitForFunction(phone=>!!document.querySelector((phone?'.class-level-mobile':'.class-level-desktop')+' .primary-class-level'),size.width<=700);
    assert.equal(await page.locator('.primary-class-level').count(),1);
    if(size.width<=700){
      const level=await page.locator('.primary-class-level').boundingBox(),gallery=await page.locator('.single-classes').boundingBox();
      assert.ok(level.y+level.height<=gallery.y,'level control above class gallery');
    }
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
  // A saved subclass remains reachable after Class; both capability panels share their rendering.
  await navigate(()=>page.locator('.journey-steps button[aria-label="Classe"]').click());
  await navigate(()=>page.locator('.single-classes button').filter({hasText:'Occultiste'}).first().click());
  await page.locator('.class-capabilities > summary').click();
  const classStyle=await page.locator('.capability-level-title').first().evaluate(e=>({font:getComputedStyle(e).font,fontColor:getComputedStyle(e).color}));
  await navigate(()=>page.locator('.single-actions .primary').click());
  const subclass=page.locator('[data-choice-id="warlock:subclass"]');
  assert.ok(await subclass.isVisible());
  await navigate(()=>subclass.locator('input[type=radio]').first().check());
  assert.match(await page.locator('.class-capabilities > summary').innerText(),/Capacités de sous-classe par niveau/);
  for(const size of [{width:390,height:844},{width:1180,height:820}]){
    await page.setViewportSize(size);
    await page.locator('.class-capabilities').evaluate(e=>e.open=true);
    assert.ok(await page.locator('.capability-entry').first().isVisible());
    assert.deepEqual(await page.locator('.capability-level-title').first().evaluate(e=>({font:getComputedStyle(e).font,fontColor:getComputedStyle(e).color})),classStyle);
    const levels=await page.locator('.capability-level').evaluateAll(nodes=>nodes.map(e=>({future:e.classList.contains('is-future'),open:e.open,lock:!!e.querySelector('.capability-lock')})));
    assert.ok(levels.some(e=>!e.future)&&levels.some(e=>e.future));
    assert.ok(levels.every(e=>e.future?!e.open&&e.lock:e.open&&!e.lock));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await navigate(()=>page.locator('.journey-steps button[aria-label="Classe"]').click());
  await navigate(()=>page.locator('.single-actions .primary').click());
  assert.ok(await subclass.isVisible(),'saved subclass must not be skipped');
  assert.equal(await subclass.locator('input:checked').count(),1);
  assert.deepEqual(errors,[]);
  console.log('Six-stage 2014 UX: icons, race details, class/level, scores, touch targets and four viewports validated.');
} finally {if(browser)await browser.close();server.kill();}
