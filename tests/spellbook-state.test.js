import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSRD} from '../src/catalog/srd51-catalog.js';
import {buildCharacter} from '../src/catalog/character-builder.js';
import {catalogRequest} from './helpers/catalog.js';
import {MemoryStorage} from '../src/persistence/adapters.js';
import {characterLibrary} from '../src/persistence/library.js';
import {creatorRepository} from '../src/creator/repository.js';
import {spellbookFromBuild, migrateLegacySpellbook, validateSpellbook, projectSpells} from '../src/spellbook/model.js';
import {canonicalSpellId} from '../src/spellbook/ids.js';
import aliases from '../src/spellbook/srd-id-aliases.json' with {type:'json'};
const index=loadSRD();
function fixture(cls='wizard',level=10,options={}) {
  const request=catalogRequest(index,cls,{level,...options}), report=buildCharacter(index,request);
  assert.equal(report.valid,true,JSON.stringify(report.issues));
  const character=report.character,spellbook=spellbookFromBuild(index,character,report,request);
  return {request,report,character,spellbook};
}
test('spellbook preserves wizard book and preparation separately, without invented acquisition levels',()=>{
  const {character,spellbook}=fixture();
  assert.equal(spellbook.grants.filter(g=>g.acquisition==='book').length,24);
  assert.ok(spellbook.grants.some(g=>g.acquisition==='book'&&!spellbook.preparedGrantIds.includes(g.id)));
  assert.deepEqual(new Set(projectSpells(spellbook).known),new Set(character.spells.known));
  assert.ok(spellbook.grants.every(g=>g.acquiredAt.verified===false&&g.acquiredAt.characterLevel===null));
});
test('cleric automatic domain spells are separate grants, always prepared and outside daily selection',()=>{
  const {report,spellbook}=fixture('cleric',5);
  assert.ok(report.grantedSpells.length>0);
  for(const s of report.grantedSpells){
    const g=spellbook.grants.find(g=>g.spellId===s.id&&g.preparation==='always');
    assert.ok(g);assert.equal(spellbook.preparedGrantIds.includes(g.id),false);
  }
});
test('bard secrets and warlock arcanum keep their origins and distinct casting routes',()=>{
  const bard=fixture('bard',10).spellbook;
  assert.equal(bard.grants.filter(g=>g.originId==='bard:magical-secrets-10').length,2);
  assert.ok(bard.grants.every(g=>g.preparation==='none'));
  const warlock=fixture('warlock',11).spellbook;
  assert.equal(warlock.grants.filter(g=>g.acquisition==='arcanum'&&g.route==='arcanum').length,1);
  assert.ok(warlock.grants.some(g=>g.route==='pact'));
});
test('the same spell acquired by two classes remains two grants with different casting abilities',()=>{
  const {character,spellbook}=fixture('bard',1,{classes:[{id:'bard',level:1,subclassId:null},{id:'sorcerer',level:1,subclassId:'srd51:draconic-bloodline'}],spellIds:['srd51:mage-hand']});
  const grants=spellbook.grants.filter(g=>g.spellId==='srd51:mage-hand');
  assert.equal(grants.length,2);assert.notEqual(grants[0].id,grants[1].id);
  assert.deepEqual(new Set(grants.map(g=>g.classId)),new Set(['bard','sorcerer']));
  assert.equal(character.spells.known.filter(id=>id==='srd51:mage-hand').length,1);
});
test('legacy imports preserve unknown origins and existing prepared flags exactly',()=>{
  const {character}=fixture();const book=migrateLegacySpellbook(character);
  assert.ok(book.grants.every(g=>g.classId===null&&g.source===null&&g.castingAbility===null&&g.spellLevel===null));
  assert.deepEqual(projectSpells(book),character.spells);
  const before=structuredClone(character);book.grants[0].spellLevel=9;
  assert.deepEqual(character,before);
});
test('new grant metadata rejects unknown fields, mismatched revisions, and inconsistent projections',()=>{
  const {character,spellbook}=fixture();
  for(const mutate of [b=>b.characterRevision++,b=>b.grants.pop(),b=>b.grants[0].combat={spent:1},b=>b.preparedGrantIds.push('missing'),b=>b.grants[0].classId='artificer',b=>b.grants[0].acquiredAt.verified=true]){
    const b=structuredClone(spellbook);mutate(b);assert.throws(()=>validateSpellbook(b,character));
  }
});
test('definition and grimoire save atomically; failed writes leave the previous revision intact',async()=>{
  const {character,spellbook}=fixture(),storage=new MemoryStorage(),library=characterLibrary(storage);
  await library.save(character,{spellbook});const before=await library.get(character.id);
  const next=structuredClone(character);next.revision=2;next.identity.name='After';storage.failNext('quota');
  await assert.rejects(library.save(next,{expectedRevision:1,spellbook}));
  assert.deepEqual(await library.get(character.id),before);
  await library.save(next,{expectedRevision:1,spellbook});
  const saved=await library.get(character.id);assert.equal(saved.spellbook.characterRevision,2);
  await assert.rejects(library.save(next,{expectedRevision:1,spellbook}));
});
test('duplicate and both export formats preserve grants, identity and revision pins',async()=>{
  const {character,spellbook}=fixture(),storage=new MemoryStorage(),library=characterLibrary(storage);
  await library.save(character,{spellbook});
  const duplicate=await library.duplicate(character.id);assert.notEqual(duplicate.definition.id,character.id);
  assert.equal(duplicate.spellbook.characterId,duplicate.definition.id);assert.equal(duplicate.spellbook.characterRevision,1);
  assert.deepEqual(duplicate.spellbook.grants,spellbook.grants);
  for(const creator of [false,true]){
    const other=new MemoryStorage(),otherLibrary=characterLibrary(other);
    const raw=creator?await creatorRepository(storage,library).export(character.id):await library.exportJSON(character.id);
    if(creator)await creatorRepository(other,otherLibrary).import(raw);else await otherLibrary.importJSON(raw);
    assert.deepEqual((await otherLibrary.get(character.id)).spellbook,spellbook);
  }
});
test('tampered grimoire imports fail before creating any character',async()=>{
  const {character,spellbook}=fixture(),storage=new MemoryStorage(),library=characterLibrary(storage);
  await library.save(character,{spellbook});const e=JSON.parse(await library.exportJSON(character.id));e.spellbook.characterId='someone-else';
  const other=characterLibrary(new MemoryStorage());await assert.rejects(other.importJSON(JSON.stringify(e)));assert.equal((await other.list()).length,0);
});
test('319 audit aliases resolve uniquely to the installed spell IDs and never enable missing content',()=>{
  assert.equal(Object.keys(aliases).length,319);assert.equal(new Set(Object.values(aliases)).size,319);
  for(const [alias,id] of Object.entries(aliases)){assert.equal(canonicalSpellId(index,alias),id);assert.equal(canonicalSpellId(index,id),id);}
  assert.equal(canonicalSpellId({get:()=>null},Object.keys(aliases)[0]),null);
  assert.equal(canonicalSpellId(index,'__proto__'),null);
});
