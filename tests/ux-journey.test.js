import test from 'node:test';
import assert from 'node:assert/strict';
import {JOURNEY_STAGES,journeyStage,orderJourney,resolvedInlineDecision} from '../web/app/creator-journey.js';

test('the approved journey exposes exactly six stages in the approved order',()=>{
  assert.deepEqual(JOURNEY_STAGES.map(s=>s.id),['origin','class','scores','choices','magic','validation']);
});
test('2014 conditional decisions are retained while visually regrouped',()=>{
  const decisions=[
    {id:'identity',kind:'identity'},
    {id:'race',kind:'race'},
    {id:'class',kind:'class'},
    {id:'background',kind:'background'},
    {id:'scores',kind:'scores'},
    {id:'hp',kind:'hit-points'},
    {id:'training',kind:'training'},
    {id:'spell',kind:'class-choice',choice:{kind:'spell'}},
    {id:'subclass',kind:'class-choice',choice:{kind:'subclass'}},
    {id:'asi',kind:'class-choice',choice:{kind:'asi'}},
    {id:'equipment',kind:'equipment'},
    {id:'summary',kind:'summary'}
  ];
  const ordered=orderJourney(decisions);
  assert.deepEqual(ordered.map(x=>x.id),['identity','race','class','subclass','scores','hp','background','training','asi','spell','equipment','summary']);
  assert.equal(ordered.length,decisions.length);
});
test('a subclass remains visible whether its choice is missing or already saved',()=>{
  const q={kind:'class-choice',choice:{kind:'subclass'}},report={},draft={};
  assert.equal(journeyStage(q),'class');
  assert.equal(resolvedInlineDecision(q,report,draft,()=>false),false);
  assert.equal(resolvedInlineDecision(q,report,draft,()=>true),false);
  assert.equal(resolvedInlineDecision({kind:'class'},report,draft,()=>true),false);
});

test('a feat child completed in its card is skipped, but an incomplete child is retained',()=>{
 const decision={kind:'class-choice',choice:{ownerId:'fizban:feat:gift-of-the-gem-dragon',kind:'feat-ability'}};
 const draft={selections:{'fighter:asi-4':['fizban:feat:gift-of-the-gem-dragon']}};
 assert.equal(resolvedInlineDecision(decision,{},draft,()=>true),true);
 assert.equal(resolvedInlineDecision(decision,{},draft,()=>false),false);
 assert.equal(resolvedInlineDecision(decision,{}, {selections:{}},()=>true),false);
});
