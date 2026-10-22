import test from 'node:test';
import assert from 'node:assert/strict';
import { playerCatalogs } from '../src/catalog/player-catalogs.js';
import { campaignCatalog, defaultCampaign } from '../src/campaign/sources.js';
import { resolveOrigins } from '../src/catalog/origins.js';
import { ABILITIES } from '../src/character/contracts.js';
import { newDraft, suggestChoices, compileDraft } from '../src/creator/model.js';
import { singlePath, decisionReady } from '../src/creator/single-path.js';
import { humanVariants, selectRace } from '../src/creator/race-selection.js';
import { racialBonusCell, traitPresentation, originBenefits } from '../src/creator/race-presentation.js';
import { journeyStage } from '../web/app/creator-journey.js';

const config = defaultCampaign(), ctx = campaignCatalog(playerCatalogs, [], config);
const scores = Object.fromEntries(ABILITIES.map(k => [k, 10]));
const full = v => ({ ...Object.fromEntries(ABILITIES.map(k => [k, 0])), ...v });
const resolve = request => resolveOrigins(ctx.index, { scores, scoresAreBase: true, classes: [{ id: 'fighter', level: 1 }], ...request });
function allocate(raceId, subraceId, pattern = 'two-one') {
  const request = { raceId, subraceId, originSelections: {} };
  for (let i = 0; i < 10; i++) {
    const r = resolve(request), q = r.choices.find(q =>
      (q.kind === 'score' || q.key === 'ability-pattern') && !request.originSelections[q.id]);
    if (!q) return { request, r };
    request.originSelections[q.id] = q.key === 'ability-pattern' ? [pattern] : q.options.slice(0, q.count);
  }
  throw Error('Ability choices did not settle: ' + raceId);
}

// Expected 2014 values, independent of the catalogue fields used by the resolver.
const fixed = {
  'srd51:race:dwarf': { con: 2 }, 'srd51:race:elf': { dex: 2 },
  'srd51:race:halfling': { dex: 2 }, 'srd51:race:human': Object.fromEntries(ABILITIES.map(k => [k, 1])),
  'srd51:race:dragonborn': { str: 2, cha: 1 }, 'srd51:race:gnome': { int: 2 },
  'srd51:race:half-elf': { cha: 2, str: 1, dex: 1 }, 'srd51:race:half-orc': { str: 2, con: 1 },
  'srd51:race:tiefling': { int: 1, cha: 2 }, 'volo:race:kobold': { dex: 2 },
  'eberron:race:forgelier': { con: 2, str: 1 }, 'scag:race:halfelin-sagespectre': { dex: 2, wis: 1 },
  'phb14:race:variant-human': { str: 1, dex: 1 }, 'homebrew:race:dhampir-compagnie-creole': { cha: 2, dex: 1 },
};
const subBonuses = {
  'srd51:race:hill-dwarf': { wis: 1 }, 'phb14:race:mountain-dwarf': { str: 2 },
  'srd51:race:high-elf': { int: 1 }, 'phb14:race:wood-elf': { wis: 1 }, 'phb14:race:drow': { cha: 1 },
  'srd51:race:lightfoot': { cha: 1 }, 'phb14:race:stout-halfling': { con: 1 },
  'srd51:race:rock-gnome': { con: 1 }, 'phb14:race:forest-gnome': { dex: 1 },
};

test('all installed ancestries and subraces apply exactly their expected bonuses, with both flexible patterns', () => {
  const races = ctx.index.list('race');
  assert.ok(races.length >= 50);
  for (const race of races) {
    for (const sub of race.data.subraces.length ? race.data.subraces : [null]) {
      for (const pattern of race.data.flexibleAbilityBoosts ? ['two-one', 'three-ones'] : ['fixed']) {
        const { request, r } = allocate(race.id, sub?.id, pattern);
        const expected = full(race.data.flexibleAbilityBoosts ? pattern === 'two-one' ? { str: 2, dex: 1 } : { str: 1, dex: 1, con: 1 } : fixed[race.id]);
        assert.ok(race.data.flexibleAbilityBoosts || fixed[race.id], 'Unreviewed race: ' + race.id);
        if (sub) { assert.ok(subBonuses[sub.id], 'Unreviewed subrace: ' + sub.id); for (const [k, n] of Object.entries(subBonuses[sub.id])) expected[k] += n; }
        assert.deepEqual(r.bonuses, expected, race.id + ' / ' + sub?.id + ' / ' + pattern);
        assert.deepEqual(r.scores, Object.fromEntries(ABILITIES.map(k => [k, 10 + expected[k]])));
        assert.deepEqual(resolve(request).scores, r.scores, 'recompute must not stack');
        assert.deepEqual(resolve({ ...request, scoresAreBase: false }).scores, scores, 'legacy final scores must not get a second bonus');
      }
    }
  }
});

test('half-elf fixed Charisma and both +1 choices preview immediately, with no Charisma checkbox', () => {
  const raceId = 'srd51:race:half-elf', id = raceId + ':abilities';
  let selections = { [id]: ['str'] }, r = resolve({ raceId, originSelections: selections });
  assert.equal(r.scores.str, 11);
  assert.equal(r.scores.cha, 12);
  assert.ok(r.issues.some(i => i.choiceId === id));
  assert.deepEqual(racialBonusCell(r, selections, 'cha'), { total: 2, fixed: 2, choices: [] });
  assert.equal(racialBonusCell(r, selections, 'str').fixed, 0);
  selections = { [id]: ['str', 'dex'] }; r = resolve({ raceId, originSelections: selections });
  assert.deepEqual(r.bonuses, full({ str: 1, dex: 1, cha: 2 }));
  assert.equal(r.issues.some(i => i.choiceId === id), false);
  for (const invalid of [['str', 'str'], ['str', 'cha'], ['str', 'dex', 'con']]) {
    const bad = resolve({ raceId, originSelections: { [id]: invalid } });
    assert.ok(bad.issues.some(i => i.choiceId === id));
    assert.equal(bad.bonuses.cha, 2);
  }
});

test('flexible bonuses reject overlapping abilities and score caps; incomplete allocation blocks Continue', () => {
  const raceId = 'motm:race:kobold';
  const selections = { [raceId + ':ability-pattern']: ['two-one'], [raceId + ':ability-bonus-2']: ['cha'], [raceId + ':ability-bonus-1']: ['cha'] };
  const r = resolve({ raceId, originSelections: selections });
  assert.equal(r.bonuses.cha, 2);
  assert.ok(r.issues.some(i => i.choiceId === raceId + ':ability-bonus-1'));
  assert.ok(resolve({ raceId: 'srd51:race:half-elf', scores: { ...scores, cha: 19 } }).issues.some(i => i.code === 'origin-score-cap'));
  const d = Object.assign(newDraft(), { raceId: 'srd51:race:half-elf', scores, scoreMethod: 'manual', scoresAreBase: true, originSelections: { 'srd51:race:half-elf:abilities': ['str'] } });
  assert.equal(decisionReady({ kind: 'scores' }, singlePath(ctx, config, d).report, d), false);
});

test('Human is followed by a variant decision; switching preserves identity without stacking standard bonuses', () => {
  const d = Object.assign(newDraft(), { name: 'Human', raceId: 'srd51:race:human', scores, scoresAreBase: true, scoreMethod: 'manual', classChosen: true, backgroundId: 'srd51:background:acolyte' });
  const path = singlePath(ctx, config, d), ids = path.decisions.map(x => x.id);
  assert.equal(ids[ids.indexOf('race') + 1], 'human-variant');
  assert.equal(journeyStage(path.decisions.find(x => x.id === 'human-variant')), 'origin');
  selectRace(ctx, d, 'phb14:race:variant-human');
  d.originSelections['phb14:race:variant-human:feat'] = ['phb14:feat:alert'];
  const selected = suggestChoices(ctx, config, d); selected.confirmed = selected.reviewed = true;
  const result = compileDraft(ctx, config, selected);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.equal(result.character.ancestry.id, 'phb14:race:variant-human');
  assert.equal(Object.values(result.origin.bonuses).reduce((n, x) => n + x, 0), 2);
  assert.ok(result.character.features.includes('phb14:feat:alert'));
  selectRace(ctx, selected, 'srd51:race:human');
  assert.equal(selected.name, 'Human');
  assert.deepEqual(singlePath(ctx, config, selected).report.origin.bonuses, full(Object.fromEntries(ABILITIES.map(k => [k, 1]))));
  assert.ok(selected.retainedDecisions.some(c => c.values.includes('phb14:feat:alert')));
  const restricted = { ...config, sourceRestrictions: true, enabledSourceIds: ['srd51'] }, onlySRD = campaignCatalog(playerCatalogs, [], restricted);
  assert.equal(humanVariants(onlySRD, 'srd51:race:human').length, 1);
  assert.equal(singlePath(onlySRD, restricted, selected).decisions.some(x => x.kind === 'human-variant'), false);
});

test('racial descriptions separate short titles from effects and expose subrace differences', () => {
  const half = ctx.index.get('srd51:race:half-elf');
  const fey = traitPresentation(half.data.traits.find(t => t.id === 'fey-ancestry'));
  assert.equal(fey.title, 'Ascendance féerique');
  assert.match(fey.description, /charme.*endormir/);
  const dwarf = ctx.index.get('srd51:race:dwarf');
  const hill = originBenefits(dwarf.data.subraces[0], id => id), mountain = originBenefits(dwarf.data.subraces[1], id => id);
  assert.ok(hill.some(r => /points de vie/.test(r.description)));
  assert.ok(mountain.some(r => /medium-armor/.test(r.description)));
});
