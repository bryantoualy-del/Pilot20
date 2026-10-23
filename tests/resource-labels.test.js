import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceLabel} from '../web/app/resource-labels.js';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
const entries = new Map(playerCatalogs.flatMap(p=>p.items).map(e=>[e.id,e]));
const api = locale => ({state:{locale},context:{installed:entries},t:()=>locale==='fr'?'Emplacement':'Slot',name:e=>e.name[locale]});
test('saved paladin and feat resources display localized labels and actual spell names',()=>{
 const a=api('fr'),en=api('en');
 assert.equal(resourceLabel('paladin:divine-sense',a),'Sens divin');
 assert.equal(resourceLabel('paladin:channel',a),'Conduit divin');
 assert.equal(resourceLabel('paladin:channel',en),'Channel Divinity');
 assert.equal(resourceLabel('slot3',a),'Emplacement 3');
 const id='paladin:asi:4:feat:fixed-spell';
 const definition={abilities:[{resource:{id},combat:{spell:{id:'srd51:misty-step'}}}]};
 const before=structuredClone(definition);
 assert.equal(resourceLabel(id,a,definition),entries.get('srd51:misty-step').name.fr);
 assert.equal(resourceLabel(id,en,definition),entries.get('srd51:misty-step').name.en);
 assert.deepEqual(definition,before);
 assert.equal(resourceLabel('monk:ki',a,{abilities:[{resource:{id:'monk:ki'},combat:{spell:{id:'srd51:misty-step'}}}]}),'Points de ki');
 assert.equal(resourceLabel('feat:chosen-spell',a),'Sort choisi par un don');
});
test('owned catalogue features provide resource names without exposing technical IDs',()=>{
 const id='fighter:indomitable',entry=entries.get('srd51:fighter:indomitable');
 assert.equal(resourceLabel(id,api('fr'),{features:[entry.id]}),entry.name.fr);
 assert.equal(resourceLabel('private:custom-pool',api('fr')),'Utilisations de capacité');
});
