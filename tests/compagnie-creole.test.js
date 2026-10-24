import test from 'node:test';
import assert from 'node:assert/strict';
import { playerCatalogs } from '../src/catalog/player-catalogs.js';
import { validateCatalogV3 } from '../src/catalog/catalog-v3.js';
import { compagnieCreole } from '../src/catalog/compagnie-creole.js';
import { raceLibrary } from '../src/catalog/race-discovery.js';
import { campaignCatalog, defaultCampaign } from '../src/campaign/sources.js';
import { newDraft, suggestChoices, compileDraft, templateScores } from '../src/creator/model.js';
import { MemoryStorage } from '../src/persistence/adapters.js';
import { characterLibrary } from '../src/persistence/library.js';
import { creatorRepository } from '../src/creator/repository.js';

const raceId = 'homebrew:race:dhampir-compagnie-creole';
const config = defaultCampaign();
const context = campaignCatalog(playerCatalogs, [], config);
function kentaro() {
  let draft = Object.assign(newDraft(), {
    name: 'Kentaro', raceId, scoresAreBase: true,
    scores: templateScores('warlock'), classChosen: true,
    backgroundId: 'srd51:background:acolyte',
    classes: [{ id: 'warlock', level: 10, subclassId: 'xge:warlock:hexblade' }],
  });
  draft = suggestChoices(context, config, draft);
  draft.confirmed = draft.reviewed = true;
  const result = compileDraft(context, config, draft);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  return { draft, result };
}

test('campaign Dhampir is discoverable independently of Ravenloft with homebrew provenance', () => {
  validateCatalogV3(compagnieCreole, { distribution: 'public' });
  const rows = raceLibrary(context, { query: 'dhampir' });
  assert.ok(rows.some(r => r.versions.some(v => v.entry.id === 'ravenloft:race:dhampir')));
  const homebrew = rows.find(r => r.versions.some(v => v.entry.id === raceId));
  assert.equal(homebrew.nom_fr, 'Dhampir');
  assert.ok(homebrew.sourceIds.includes('homebrew'));
  assert.match(context.index.get(raceId).source.document, /Création maison.*Kobold Press/);
  const restricted = { ...config, sourceRestrictions: true, enabledSourceIds: ['srd51'] };
  assert.equal(campaignCatalog(playerCatalogs, [], restricted).index.get(raceId), undefined);
  const enabled = campaignCatalog(playerCatalogs, [], { ...restricted, enabledSourceIds: ['srd51', 'homebrew'] });
  assert.ok(enabled.index.get(raceId));
  assert.equal(enabled.index.get('ravenloft:race:dhampir'), undefined);
  assert.equal(context.statuses.find(s => s.id === 'homebrew').installedEntries, 1);
});

test('Hexblade10 receives campaign bonuses, defenses and a short-rest bite reserve', () => {
  const { draft, result: r } = kentaro();
  assert.equal(r.origin.bonuses.cha, 2);
  assert.ok(r.character.scores.cha >= draft.scores.cha + 2);
  assert.equal(r.character.scores.dex, draft.scores.dex + 1);
  assert.equal(r.stats.movement.walk, 30);
  assert.equal(r.character.skills.persuasion, 1);
  assert.ok(r.character.proficiencies.includes('language:common'));
  assert.deepEqual(r.character.defenses.resistances, ['necrotic']);
  assert.deepEqual(r.character.defenses.vulnerabilities, ['radiant']);
  assert.equal(r.character.defenses.resistances.includes('poison'), false);
  const pool = r.character.resources.find(p => p.id === raceId + ':dark-thirst:uses');
  assert.equal(pool.max, 1);
  assert.equal(pool.recovery, 'short');
  assert.ok(r.character.features.includes(raceId + ':predatory-charm'));
  assert.equal(r.character.features.some(id => id.includes('spider-climb')), false);
});

test('campaign ancestry and radiant vulnerability survive character export/import', async () => {
  const { draft, result } = kentaro();
  const storage = new MemoryStorage();
  const repo = creatorRepository(storage, characterLibrary(storage));
  await repo.save(draft);
  await repo.finalize(draft, result.character, { expectedDraftRevision: 1, spellbook: result.spellbook });
  const other = new MemoryStorage();
  const imported = creatorRepository(other, characterLibrary(other));
  await imported.import(await repo.export(draft.id));
  assert.equal((await imported.get(draft.id)).raceId, raceId);
  const restored = await characterLibrary(other).get(draft.id);
  assert.deepEqual(restored, await characterLibrary(storage).get(draft.id));
});

test('CC dhampir shares the standard family and suggested portrait',async()=>{
 const families=raceLibrary(context),family=families.find(f=>f.raceFamilyId==='dhampir');
 assert.ok(family.versions.some(v=>v.entry.id===raceId));
 assert.ok(family.versions.length>=2);
 assert.ok(!families.some(f=>f.raceFamilyId==='dhampir-compagnie-creole'));
 const {refreshPortrait}=await import('../src/creator/appearance.js');
 const d=Object.assign(newDraft(),{raceId,gender:'femme'});
 refreshPortrait(context,d);assert.equal(d.portrait,'./assets/shared/races/dhampir-femme.webp');
 d.portrait='data:image/png;base64,custom';refreshPortrait(context,d);assert.equal(d.portrait,'data:image/png;base64,custom');
});
