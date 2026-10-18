import { raceLibrary } from '../../src/catalog/race-discovery.js';
import { selectRace } from '../../src/creator/race-selection.js';
import { openRaceEditor } from './race-editor.js';
import { raceIcon } from './race-icons.js';
import { el, button, field, select } from './dom.js';

export function renderRacePicker(d, a, update, filters) {
  const w = (fr, en) => a.state.locale === 'fr' ? fr : en;
  const state = filters.get('race-picker') ?? { query: '' };
  filters.set('race-picker', state);
  const wrapper = el('section', { class: 'race-picker' });
  const grid = el('div', { class: 'single-races', 'aria-label': w('Races', 'Races') });
  const count = el('p', { role: 'status' });
  const search = el('input', {
    type: 'search', value: state.query,
    'aria-label': w('Rechercher une race', 'Search races'),
    placeholder: w('Rechercher une race…', 'Search races…'),
    oninput: e => { state.query = e.target.value; fill(); },
  });
  wrapper.append(field(w('Rechercher une race', 'Search races'), search), count, grid);
  function fill() {
    grid.replaceChildren();
    const families = raceLibrary(a.context, { query: state.query }).sort((x, y) =>
      Number(y.versions.some(v => v.available)) - Number(x.versions.some(v => v.available)) ||
      (a.state.locale === 'fr' ? x.nom_fr : x.name_en).localeCompare(a.state.locale === 'fr' ? y.nom_fr : y.name_en, a.state.locale));
    let shown = 0;
    for (const f of families) {
      const versions = f.versions.filter(v => v.available);
      const selected = versions.some(v => v.entry.id === d.raceId);
      const label = a.state.locale === 'fr' ? f.nom_fr : f.name_en;
      const b = button([raceIcon(f.nom_fr, f.slug), el('span', {}, label,
        !versions.length ? el('small', {}, f.availability === 'source-disabled'
          ? w('Source désactivée', 'Source disabled') : w('Règles à intégrer', 'Rules pending')) : null)],
        () => update(x => selectRace(a.context, x, versions.find(v => v.entry.id === d.raceId)?.entry.id ?? versions[0].entry.id, a.state.locale)),
        selected ? 'selected' : '');
      b.disabled = !versions.length;
      b.setAttribute('aria-pressed', String(selected));
      grid.append(b); shown++;
    }
    if ('lignee sur mesure custom lineage tasha'.includes(state.query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())) {
      const b = button([raceIcon('Lignée sur mesure'), el('span', {}, w('Lignée sur mesure', 'Custom lineage'))],
        () => openRaceEditor(a, d, update, null, { lineageOnly: true }));
      b.disabled = !a.config.enabledSourceIds.includes('tce');
      if (b.disabled) b.title = w('Activez Tasha dans Sources de campagne.', 'Enable Tasha in Campaign sources.');
      grid.append(b); shown++;
    }
    count.textContent = shown + w(' races affichées', ' races shown');
  }
  fill();
  const family = raceLibrary(a.context).find(f => f.versions.some(v => v.entry.id === d.raceId));
  const versions = family?.versions.filter(v => v.available) ?? [];
  if (versions.length > 1) wrapper.append(field(w('Version de la race', 'Race version'),
    select(versions.map(v => [v.entry.id, a.name(v.entry) + ' · ' + v.entry.source.document]), d.raceId,
      e => update(x => selectRace(a.context, x, e.target.value, a.state.locale)))));
  if (d.manualRace || (!d.raceId && d.origin)) wrapper.append(el('p', { role: 'status' },
    w('Votre ancienne origine est conservée. Choisissez une race ou configurez une Lignée sur mesure pour la remplacer.',
      'Your previous origin is retained. Choose a race or configure Custom lineage to replace it.')));
  wrapper.append(button(w('Sources de campagne', 'Campaign sources'), () => a.nav('sources')));
  return wrapper;
}
