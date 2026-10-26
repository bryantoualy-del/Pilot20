import test from 'node:test';import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,draftProgression} from '../src/creator/model.js';
import {invocationOptions,selectInvocationChoice,BLAST} from '../src/creator/invocation-selection.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
const invocation='srd51:warlock:agonizing-blast';
const make=()=>Object.assign(newDraft(),{classes:[{id:'warlock',level:10,subclassId:'xge:warlock:hexblade'}]});
test('invocation offers and acquires its cantrip without weakening strict progression',()=>{
 const d=make(),r=draftProgression(ctx,config,d),q=r.choices.find(q=>q.id==='warlock:invocations');
 assert.ok(!q.options.includes(invocation));assert.ok(invocationOptions(ctx,config,d).includes(invocation));
 assert.equal(selectInvocationChoice(d,q,[invocation],ctx.index,r),'added-blast');assert.deepEqual(d.selections['warlock:cantrips'],[BLAST]);
 assert.ok(draftProgression(ctx,config,d).choices.find(q=>q.id==='warlock:invocations').options.includes(invocation));
 assert.equal(selectInvocationChoice(d,{id:'warlock:cantrips'},[],ctx.index,r),'required-blast');
 selectInvocationChoice(d,q,[],ctx.index,r);assert.deepEqual(d.selections['warlock:cantrips'],[BLAST]);
});
test('full quota is atomic and needs an explicit replacement',()=>{
 const d=make(),r=draftProgression(ctx,config,d),q=r.choices.find(q=>q.id==='warlock:invocations'),c=r.choices.find(q=>q.id==='warlock:cantrips');
 d.selections[c.id]=c.options.filter(id=>id!==BLAST).slice(0,c.count);const before=structuredClone(d);
 assert.equal(selectInvocationChoice(d,q,[invocation],ctx.index,r),'replace-cantrip');assert.deepEqual(d,before);
 const old=d.selections[c.id][0];assert.equal(selectInvocationChoice(d,q,[invocation],ctx.index,r,old),'added-blast');assert.equal(d.selections[c.id].length,c.count);assert.ok(!d.selections[c.id].includes(old));
});
test('Grand voyageur offers campaign language and ocarina',()=>{
 const bg=ctx.index.get('scag:background:far-traveler');assert.ok(bg);
 assert.ok(bg.data.choices.some(q=>q.options.includes('ocarina')));
 assert.ok(bg.data.choices.some(q=>q.options.includes('oriental')));
});
