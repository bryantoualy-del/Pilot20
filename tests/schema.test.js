import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import {characterFixture,referenceClasses} from '../examples/characters.mjs';
import {createCombat,runtimeOf} from '../src/character/session.js';
import {defaultPreferences} from '../src/character/contracts.js';
import {catalog} from '../src/catalog/srd51.js';
test('versioned structural schemas accept data from every public producer',async()=>{
 const schema=JSON.parse(await readFile(new URL('../schemas/contracts-v2.schema.json',import.meta.url)));
 const legacy=JSON.parse(await readFile(new URL('../docs/session-v1.schema.json',import.meta.url)));
 const ajv=new Ajv2020({strict:false});ajv.addSchema(legacy);
 const legacyValidate=ajv.getSchema(legacy.$id),validate=ajv.compile(schema);
 for(const c of referenceClasses) {
   const d=characterFixture(c),s=createCombat('schema-'+c,[{instanceId:'actor',character:d}]);
   for(const document of [d,s,runtimeOf(s,'actor'),defaultPreferences(d.id),catalog])
     assert.equal(validate(document),true,JSON.stringify(validate.errors));
   assert.equal(legacyValidate(s.engine),true,JSON.stringify(legacyValidate.errors));
 }
 const invalid=characterFixture('fighter');invalid.scores.str='18';assert.equal(validate(invalid),false);
});
