import test from 'node:test';import assert from 'node:assert/strict';
import {progressionChoices,allocatedValues,selectAllocation} from '../web/app/progression-choices.js';
import {portraitPrompt,physicalDescription} from '../src/creator/portrait-prompt.js';
const schedule=[0,0,2,2,2,2,2,2,2,3];
const index={class:()=>({id:'sorcerer',data:{choices:[{key:'metamagic',countByLevel:schedule}]},name:{fr:'Ensorceleur'}}),get:id=>({name:{fr:id},data:{}})};
test('cumulative choices appear at each actual quota increase while keeping one engine selection',()=>{
 const d={classes:[{id:'sorcerer',level:10}],selections:{'sorcerer:metamagic':['a','b','c']}};
 const base={id:'choice:sorcerer:metamagic',kind:'class-choice',choice:{id:'sorcerer:metamagic',classId:'sorcerer',kind:'feature',level:3,count:3,options:['a','b','c','d']}};
 const parts=progressionChoices(index,d,[base]);assert.deepEqual(parts.map(p=>[p.choice.level,p.choice.count]),[[3,2],[10,1]]);
 assert.deepEqual(allocatedValues(d,parts[1].choice,d.selections[base.choice.id]),['c']);
 selectAllocation(d,parts[0].choice,['a'],parts);assert.deepEqual(d.selections[base.choice.id],['a','c']);
 assert.deepEqual(allocatedValues(d,parts[1].choice,d.selections[base.choice.id]),['c'],'later choices do not move to earlier levels when one is removed');
 selectAllocation(d,parts[0].choice,['a','d'],parts);assert.deepEqual(d.selections[base.choice.id],['a','d','c']);
 d.selections[base.choice.id]=['b','a','c'];assert.deepEqual(allocatedValues(d,parts[0].choice,d.selections[base.choice.id]),['b','a'],'stale presentation metadata never overwrites imported canonical choices');
});
test('portrait prompt is French and includes physical details, subclass and equipment without an API',()=>{
 const d={name:'Test',raceId:'Kobold',classes:[{id:'sorcerer',level:10,subclassId:'Draconique'}],description:'Petite silhouette',physicalDetails:{age:'20 ans',eyes:'rouges'}};
 assert.match(physicalDescription(d),/Yeux : rouges/);const prompt=portraitPrompt(d,{index},['Bâton']);for(const word of ['semi-réaliste','Kobold','Draconique','20 ans','Bâton','Petite silhouette'])assert.ok(prompt.includes(word));
});
