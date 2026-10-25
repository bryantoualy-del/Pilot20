import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';

const index=campaignCatalog(playerCatalogs,[],defaultCampaign()).index;
test('every catalog lookup preserves values and returns independently mutable nested data',()=>{
  const entries=index.list();
  for(const entry of entries){
    const expected=structuredClone(entry);
    assert.deepEqual(index.get(entry.id),expected);
    entry.name.fr='changed';
    entry.data.changed={nested:['changed']};
    const copy=index.get(entry.id);
    assert.deepEqual(copy,expected);
    copy.name.en='changed again';
    assert.deepEqual(index.get(entry.id),expected);
    if(entry.type==='class'){
      const cls=index.class(entry.data.classId);
      assert.deepEqual(cls,expected);
      cls.data.grants[0].featureIds.push('invalid');
      assert.deepEqual(index.class(entry.data.classId),expected);
    }
  }
  assert.equal(index.get('missing'),undefined);
  assert.equal(index.class('missing'),undefined);
  assert.deepEqual(index.list('missing'),[]);
});
