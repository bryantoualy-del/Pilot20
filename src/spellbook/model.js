import { check, keys, json, id, integer, source, ABILITIES } from '../character/contracts.js';

const sameSet = (a, b) => a.length === b.length && a.every(v => b.includes(v));
const key = (originId, spellId) => originId + '/' + spellId;
const spellKinds = new Set(['spell', 'spellbook', 'prepared', 'ritual-spell', 'spell-mastery', 'signature-spell']);
const acquisitions = new Set(['known', 'book', 'copy', 'prepared-list', 'granted', 'arcanum', 'ritual', 'legacy']);
const routes = new Set(['slot', 'pact', 'arcanum', 'ritual', 'origin', 'unknown']);
const preparationModes = new Set(['none', 'daily', 'always']);

/** Versioned character metadata. Never contains slots spent, concentration or combat state. */
export function validateSpellbook(book, character = null) {
  json(book);
  keys(book, ['kind', 'schemaVersion', 'characterId', 'characterRevision', 'grants', 'preparedGrantIds', 'unresolved']);
  check(book.kind === 'pilot20-spellbook' && book.schemaVersion === 1 && id(book.characterId) && integer(book.characterRevision, 1), 'Spellbook header');
  check(Array.isArray(book.grants) && book.grants.length <= 3000, 'Spell grants');
  const grantIds = new Set();
  for (const g of book.grants) {
    keys(g, ['id', 'spellId', 'originId', 'classId', 'source', 'spellLevel', 'castingAbility', 'acquisition', 'route', 'preparation', 'acquiredAt']);
    check(typeof g.id === 'string' && g.id === key(g.originId, g.spellId) && g.id.length <= 500 && !grantIds.has(g.id), 'Unique spell grant ID');
    grantIds.add(g.id);
    check(id(g.spellId) && id(g.originId) && (g.classId === null || id(g.classId)), 'Spell grant origin');
    if (g.source !== null) source(g.source);
    check(g.spellLevel === null || integer(g.spellLevel, 0, 9), 'Spell level');
    check(g.castingAbility === null || ABILITIES.includes(g.castingAbility), 'Spellcasting ability');
    check(acquisitions.has(g.acquisition) && routes.has(g.route) && preparationModes.has(g.preparation), 'Spell grant policy');
    keys(g.acquiredAt, ['characterLevel', 'classLevel', 'verified']);
    check(typeof g.acquiredAt.verified === 'boolean', 'Acquisition verification');
    for (const k of ['characterLevel', 'classLevel']) check(g.acquiredAt[k] === null || integer(g.acquiredAt[k], 1, 20), 'Acquisition level');
    check(!g.acquiredAt.verified || g.acquiredAt.characterLevel !== null, 'Verified acquisition needs a character level');
    if (character && g.classId !== null) check(character.classes.some(c => c.id === g.classId), 'Spell grant class absent');
  }
  check(Array.isArray(book.preparedGrantIds) && new Set(book.preparedGrantIds).size === book.preparedGrantIds.length && book.preparedGrantIds.every(v => grantIds.has(v)), 'Prepared spell grants');
  check(Array.isArray(book.unresolved) && book.unresolved.length <= 3000 && book.unresolved.every(v => typeof v === 'string' && v.length <= 500), 'Spellbook review notes');
  if (character) {
    check(book.characterId === character.id && book.characterRevision === character.revision, 'Spellbook revision mismatch');
    const projection = projectSpells(book);
    check(sameSet(projection.known, character.spells.known) && sameSet(projection.prepared, character.spells.prepared), 'Spellbook projection mismatch');
  }
  return book;
}

/** Only a projection: acquisition and preparation remain per origin inside the spellbook. */
export function projectSpells(book) {
  const selected = new Set(book.preparedGrantIds);
  return {
    known: [...new Set(book.grants.map(g => g.spellId))],
    prepared: [...new Set(book.grants.filter(g => g.preparation === 'always' || g.spellLevel === 0 || selected.has(g.id)).map(g => g.spellId))],
  };
}

/** Import old aggregate lists faithfully, without guessing a race, class or learning level. */
export function migrateLegacySpellbook(character) {
  const book = {
    kind: 'pilot20-spellbook', schemaVersion: 1, characterId: character.id,
    characterRevision: character.revision, grants: character.spells.known.map(spellId => ({
      id: key('legacy:unresolved', spellId), spellId, originId: 'legacy:unresolved', classId: null,
      source: null, spellLevel: null, castingAbility: null, acquisition: 'legacy', route: 'unknown',
      preparation: 'none', acquiredAt: { characterLevel: null, classLevel: null, verified: false },
    })),
    preparedGrantIds: character.spells.prepared.map(spellId => key('legacy:unresolved', spellId)),
    unresolved: character.spells.known.length ? ['legacy-origins-and-acquisition-levels'] : [],
  };
  return validateSpellbook(book, character);
}

/** Snapshot the existing compiler's resolved choices. No second rules engine or implied learning dates. */
export function spellbookFromBuild(index, character, report, request) {
  check(report.valid === true, 'Resolved build required');
  const book = { kind: 'pilot20-spellbook', schemaVersion: 1, characterId: character.id,
    characterRevision: character.revision, grants: [], preparedGrantIds: [], unresolved: [] };
  const add = (spellId, originId, classId, acquisition, preparation = 'none', origin = null) => {
    const entry = index.get(spellId);
    check(entry?.type === 'spell', 'Unknown acquired spell');
    const cls = character.classes.find(c => c.id === classId);
    const history = request.advancementHistory ?? [];
    // A complete validated history can identify the earliest snapshot of this exact selection.
    const event = report.history?.status === 'verified' && history.length
      ? history.findIndex(row => (row.selections[originId] ?? []).includes(spellId)) : -1;
    const acquiredAt = { characterLevel: event < 0 ? null : event + 1,
      classLevel: event < 0 ? null : history[event].classes.find(c => c.id === classId)?.level ?? null,
      verified: event >= 0 };
    const grant = { id: key(originId, spellId), spellId, originId, classId,
      source: origin?.source ?? entry.source, spellLevel: entry.data.level,
      castingAbility: origin?.ability ?? cls?.casting?.ability ?? null,
      acquisition, route: acquisition === 'arcanum' ? 'arcanum' : acquisition === 'ritual' ? 'ritual'
        : origin ? 'origin' : cls?.casting?.progression === 'pact' ? 'pact' : 'slot',
      preparation, acquiredAt };
    const existing = book.grants.find(g => g.id === grant.id);
    if (existing) return existing;
    book.grants.push(grant); return grant;
  };
  for (const q of report.choices.filter(q => spellKinds.has(q.kind) && !['prepared', 'spell-mastery', 'signature-spell'].includes(q.kind))) {
    for (const spellId of report.selections[q.id] ?? []) {
      const cls = character.classes.find(c => c.id === q.classId);
      const needsPreparation = ['cleric', 'druid', 'paladin', 'wizard'].includes(q.classId) || !!cls?.casting?.preparation;
      const acquisition = q.id.includes(':arcanum-') ? 'arcanum' : q.kind === 'spellbook' ? 'book' : q.kind === 'ritual-spell' ? 'ritual' : 'known';
      const copied=acquisition==='book'&&(request.spellbookTranscriptions??[]).some(t=>t.classId===q.classId&&t.spellId===spellId);
      add(spellId, q.id, q.classId, copied?'copy':acquisition, needsPreparation && acquisition === 'book' ? 'daily' : 'none');
    }
  }
  for (const g of report.grantedSpells) add(g.id, g.classId + ':automatic', g.classId, 'granted', 'always');
  for (const q of report.choices.filter(q => ['prepared', 'signature-spell'].includes(q.kind))) {
    for (const spellId of report.selections[q.id] ?? []) {
      let grant = book.grants.find(g => g.classId === q.classId && g.spellId === spellId);
      grant ??= add(spellId, q.classId + ':class-list', q.classId, 'prepared-list', 'daily');
      if (q.kind === 'signature-spell') grant.preparation = 'always';
      else if (grant.preparation !== 'always') book.preparedGrantIds.push(grant.id);
    }
  }
  for (const spell of report.origin?.spells ?? []) {
    // The legacy origin report does not distinguish every racial owner: keep that limitation explicit.
    const originId = character.ancestry.subraceId ?? character.ancestry.id;
    add(spell.id, originId, null, 'granted', 'always', spell);
  }
  if (book.grants.some(g => g.acquisition !== 'legacy' && g.acquiredAt.characterLevel === null)) book.unresolved.push('acquisition-history-not-recorded');
  book.preparedGrantIds = [...new Set(book.preparedGrantIds)];
  return validateSpellbook(book, character);
}

/** Rebase metadata only if its exact aggregate spell projection is still true. */
export function pinSpellbook(book, character, {allowIdentityChange = false} = {}) {
  validateSpellbook(book);
  check(allowIdentityChange || book.characterId === character.id, 'Spellbook identity mismatch');
  const next = structuredClone(book);
  next.characterId = character.id;
  next.characterRevision = character.revision;
  return validateSpellbook(next, character);
}
