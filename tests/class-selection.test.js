import test from 'node:test';import assert from 'node:assert/strict';
import{newDraft,changePrimaryClass,templateScores}from '../src/creator/model.js';
import{CLASS_ICONS}from '../web/app/class-icons.js';import{classInfo}from '../web/app/class-info.js';
test('the first class choice recommends its own standard array, while later changes preserve assignments',()=>{
 const d=newDraft();d.scoreMethod='standard';changePrimaryClass(d,'wizard');assert.deepEqual(d.scores,templateScores('wizard'));assert.equal(d.scores.int,15);changePrimaryClass(d,'bard');assert.deepEqual(d.scores,templateScores('wizard'));
});
test('an already customized or rolled score arrangement is preserved even on a first class selection',()=>{
 for(const method of ['manual','point-buy','rolled']){const d=newDraft();d.scoreMethod=method;const scores=structuredClone(d.scores);changePrimaryClass(d,'wizard');assert.deepEqual(d.scores,scores);}
 const d=newDraft();d.scoreMethod='standard';[d.scores.str,d.scores.int]=[d.scores.int,d.scores.str];const scores=structuredClone(d.scores);changePrimaryClass(d,'bard');assert.deepEqual(d.scores,scores);
});
test('all13 available classes have a local symbol and short French/English guidance',()=>{
 assert.equal(Object.keys(CLASS_ICONS).length,13);for(const id of Object.keys(CLASS_ICONS))for(const locale of ['fr','en'])assert.ok(classInfo(id,locale)?.description);
});
