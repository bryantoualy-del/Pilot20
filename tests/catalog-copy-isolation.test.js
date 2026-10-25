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

// The validator allows sparse arrays and extra safe enumerable array properties.
test('validated JSON copies preserve sparse arrays, extra properties and negative zero',async()=>{
  const {cloneCatalogValue}=await import('../src/catalog/catalog-v3.js');
  const {json}=await import('../src/character/contracts.js');
  const value={array:[null, , -0, {flag:false,text:"é"}]};
  value.array.extra={nested:[1]};
  json(value);
  const copy=cloneCatalogValue(value);
  assert.deepEqual(copy,structuredClone(value));
  copy.array.extra.nested.push(2);
  assert.deepEqual(value.array.extra.nested,[1]);
});
