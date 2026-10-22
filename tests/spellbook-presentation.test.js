import test from 'node:test';
import assert from 'node:assert/strict';
import {spellStatus} from '../src/spellbook/presentation.js';
const daily={id:'wizard/a',preparation:'daily',classId:'wizard',acquisition:'book',route:'slot'};
test('prepared status distinguishes daily, known, always, origin and ritual spells',()=>{
 assert.equal(spellStatus([daily],[]),'unprepared');
 assert.equal(spellStatus([daily],[daily.id]),'prepared');
 assert.equal(spellStatus([{...daily,preparation:'always'}],[]),'always');
 assert.equal(spellStatus([{...daily,preparation:'always',classId:null}],[]),'granted');
 assert.equal(spellStatus([{...daily,preparation:'none',acquisition:'known'}],[daily.id]),'known');
 assert.equal(spellStatus([{...daily,preparation:'none',route:'ritual',acquisition:'ritual'}],[]),'ritual');
 assert.equal(spellStatus([],[],{eligible:true}),'unprepared');
 assert.equal(spellStatus([],[]),'catalogue');
});
test('staging changes the display without mutating saved grants and respects fixed preparation',()=>{
 const before=JSON.stringify(daily);
 assert.equal(spellStatus([daily],[daily.id],{eligible:true,staged:[],spellId:'a'}),'unprepared');
 assert.equal(spellStatus([daily],[],{eligible:true,staged:['a'],spellId:'a'}),'prepared');
 assert.equal(spellStatus([{...daily,preparation:'always'}],[],{eligible:true,staged:[],spellId:'a'}),'always');
 assert.equal(JSON.stringify(daily),before);
});
