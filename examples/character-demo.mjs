import {characterFixture} from './characters.mjs';
import {derive} from '../src/character/derive.js';
import {createCombat} from '../src/character/session.js';
import {MemoryStorage} from '../src/persistence/adapters.js';
import {characterLibrary} from '../src/persistence/library.js';
import {combatRepository} from '../src/persistence/combat-repository.js';
const storage=new MemoryStorage(),library=characterLibrary(storage);
const fighter=characterFixture('fighter',{name:'Aster'}),sorcerer=characterFixture('sorcerer',{name:'Ember'});
for(const character of [fighter,sorcerer]) {
 await library.save(character);
 const s=derive(character);
 console.log(JSON.stringify({name:character.identity.name,level:s.level,hp:s.maxHp,ac:s.ac,saves:s.saves,casting:s.casting,resources:s.resources,coverage:s.coverage},null,2));
}
const session=createCombat('demo-character-v2',[{instanceId:'aster:1',character:fighter},{instanceId:'ember:1',character:sorcerer}]);
const repo=combatRepository(storage);await repo.create(session);
await repo.commit(session.id,{id:'aster-attack',type:'useAbility',actorId:'aster:1',abilityId:'blade',targetIds:['ember:1'],attackRolls:[15],effectRolls:{0:[5]}});
await repo.commit(session.id,{id:'ember-turn',type:'startTurn',actorId:'ember:1'});
await repo.commit(session.id,{id:'ember-spell',type:'useAbility',actorId:'ember:1',abilityId:'spell-attack',targetIds:['aster:1'],attackRolls:[15],effectRolls:{0:[5,6]}});
const reload=await combatRepository(storage).load(session.id);
console.log('Reloaded combat HP:',Object.fromEntries(Object.entries(reload.engine.actors).map(([k,a])=>[k,a.hp])));
console.log('Permanent fighter unchanged:',(await library.get(fighter.id)).definition.revision===1);
console.log('Replay:',(await repo.commit(session.id,{id:'aster-attack',type:'useAbility',actorId:'aster:1',abilityId:'blade',targetIds:['ember:1'],attackRolls:[15],effectRolls:{0:[5]}})).replayed);
