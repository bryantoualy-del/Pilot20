import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft} from '../src/creator/model.js';
test('published catalogue and character schemas accept installed source definitions and lineage characters',async()=>{
 const ajv=new Ajv2020({strict:false});
 ajv.addSchema(JSON.parse(await readFile(new URL('../schemas/combat-rules-v1.schema.json',import.meta.url))));
 ajv.addSchema(JSON.parse(await readFile(new URL('../docs/session-v1.schema.json',import.meta.url))));
 const catalogue=ajv.compile(JSON.parse(await readFile(new URL('../schemas/catalog-v3.schema.json',import.meta.url))));
 for(const c of playerCatalogs)assert.equal(catalogue(c),true,c.id+': '+JSON.stringify(catalogue.errors));
 const character=ajv.compile(JSON.parse(await readFile(new URL('../schemas/contracts-v2.schema.json',import.meta.url))));
 const config={...defaultCampaign(),sourceRestrictions:true,enabledSourceIds:['srd51','xge','tce','phb14','ravenloft','volo','motm','homebrew']},ctx=campaignCatalog(playerCatalogs,[],config);
 for(const raceId of ['ravenloft:race:dhampir','homebrew:race:dhampir-compagnie-creole','volo:race:kobold','motm:race:kobold']){
  let d=Object.assign(newDraft(),{name:'Recette schéma',startingEquipmentEnabled:true,raceId,backgroundId:'phb14:background:guild-merchant',classes:[{id:'fighter',level:1,subclassId:null}],classChosen:true});d=suggestChoices(ctx,config,d);d.reviewed=d.confirmed=true;const r=compileDraft(ctx,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));assert.equal(character(r.character),true,JSON.stringify(character.errors));
 }
});
