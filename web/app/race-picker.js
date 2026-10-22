import { raceLibrary } from '../../src/catalog/race-discovery.js';
import { selectRace } from '../../src/creator/race-selection.js';
import { openRaceEditor } from './race-editor.js';
import { raceIcon } from './race-icons.js';
import { el, button, field, select } from './dom.js';

export function renderRacePicker(d, a, update, filters) {
  const w = (fr, en) => a.state.locale === 'fr' ? fr : en;
  const state = filters.get('race-picker') ?? { query: '', availableOnly: false };
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
  const tabs=el('div',{class:'race-filter-row',role:'group','aria-label':w('Filtrer les races','Filter races')});
  const all=button(w('Toutes les races','All races'),()=>{state.availableOnly=false;fill();},'subtle');
  const available=button(w('Disponibles','Available'),()=>{state.availableOnly=true;fill();},'subtle');
  tabs.append(all,available);
  wrapper.append(field(w('Rechercher une race', 'Search races'), search),tabs, count, grid);
  function fill() {
    grid.replaceChildren();all.classList.toggle('selected',!state.availableOnly);available.classList.toggle('selected',state.availableOnly);
    const families = raceLibrary(a.context, { query: state.query }).filter(f=>f.versions.length&&(!state.availableOnly||f.versions.some(v=>v.available))).sort((x, y) =>
      Number(y.versions.some(v => v.available)) - Number(x.versions.some(v => v.available)) ||
      (a.state.locale === 'fr' ? x.nom_fr : x.name_en).localeCompare(a.state.locale === 'fr' ? y.nom_fr : y.name_en, a.state.locale));
    let shown = 0;
    for (const f of families) {
      const versions = f.versions.filter(v => v.available);
      const selected = versions.some(v => v.entry.id === d.raceId);
      const label = a.state.locale === 'fr' ? f.nom_fr : f.name_en;
      const b = button([raceIcon(f.nom_fr, f.slug), el('span', {}, label,
        !versions.length ? el('small', {}, w('Source désactivée', 'Source disabled')) : null)],
        async () => {
          if(versions.length){await update(x => selectRace(a.context,x,versions.find(v=>v.entry.id===d.raceId)?.entry.id??versions[0].entry.id,a.state.locale));return;}
        },
        selected ? 'selected' : '');
      b.disabled = !versions.length;
      b.setAttribute('aria-pressed', String(selected));
      grid.append(b); shown++;
    }
    if ('lignee sur mesure custom lineage tasha'.includes(state.query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())) {
      const b = button([raceIcon('Lignée sur mesure'), el('span', {}, w('Lignée sur mesure', 'Custom lineage'))],
        () => openRaceEditor(a, d, update, null, { lineageOnly: true }));
      b.disabled = !a.context.statuses.some(s => s.id === 'tce' && s.selected);
      if (b.disabled) b.title = w('Tasha est restreint dans les paramètres de campagne.', 'Tasha is restricted in Campaign settings.');
      grid.append(b); shown++;
    }
    count.textContent = shown + w(' races affichées', ' races shown');
  }
  fill();
  const family = raceLibrary(a.context).find(f => f.versions.some(v => v.entry.id === d.raceId));
  const versions = family?.versions.filter(v => v.available) ?? [];
  if (versions.length > 1 && family?.raceFamilyId !== 'humain') wrapper.append(field(w('Version de la race', 'Race version'),
    select(versions.map(v => [v.entry.id, a.name(v.entry) + ' · ' + v.entry.source.document]), d.raceId,
      e => update(x => selectRace(a.context, x, e.target.value, a.state.locale)))));
  if (d.manualRace || (!d.raceId && d.origin)) wrapper.append(el('p', { role: 'status' },
    w('Votre ancienne origine est conservée. Choisissez une race ou configurez une Lignée sur mesure pour la remplacer.',
      'Your previous origin is retained. Choose a race or configure Custom lineage to replace it.')));
  return wrapper;
}
