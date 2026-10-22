import { abilityBonusSummary, originBenefits } from '../../src/creator/race-presentation.js';
import { el, button } from './dom.js';
import { optionName } from './editor.js';

export function raceTraitList(data, a) {
  const rows = originBenefits(data, id => optionName(id, a), a.state.locale);
  const list = values => el('dl', { class: 'race-traits' }, values.map(row =>
    el('div', {}, el('dt', {}, row.title), row.description ? el('dd', {}, row.description) : null)));
  if (rows.length <= 5) return list(rows);
  return el('div', {}, list(rows.slice(0, 5)), el('details', {},
    el('summary', {}, a.state.locale === 'fr' ? `${rows.length - 5} autres traits et maîtrises` : `${rows.length - 5} more traits and proficiencies`),
    list(rows.slice(5))));
}

export function ancestryChoiceCards(entries, selectedId, choose, a, { human = false } = {}) {
  const fr = a.state.locale === 'fr';
  return el('div', { class: 'ancestry-choices' }, entries.map(entry => {
    const data = entry.data ?? entry, selected = entry.id === selectedId;
    const title = human ? entry.id === 'srd51:race:human' ? (fr ? 'Humain standard' : 'Standard Human') : (fr ? 'Humain avec don' : 'Human with feat') : entry.name[a.state.locale];
    const summary = abilityBonusSummary(data, a.label, a.state.locale);
    return el('section', { class: 'ancestry-choice' + (selected ? ' selected' : '') },
      button(title, () => choose(entry.id), selected ? 'selected' : ''),
      summary ? el('p', { class: 'ancestry-bonuses' }, summary) : null,
      data.speed ? el('p', {}, (fr ? 'Déplacement : ' : 'Speed: ') + (data.speed * .3).toLocaleString(a.state.locale) + ' m') : null,
      raceTraitList(data, a));
  }));
}
