const coreTraits = {
  darkvision: ['Vision dans le noir', 'Darkvision', 'Vous voyez dans la pénombre à 18 m comme en pleine lumière, et dans l’obscurité comme dans la pénombre, en nuances de gris.', 'Within 60 feet, dim light looks bright and darkness looks dim, in shades of gray.'],
  'fey-ancestry': ['Ascendance féerique', 'Fey Ancestry', 'Avantage aux sauvegardes contre le charme. La magie ne peut pas vous endormir.', 'Advantage on saves against being charmed. Magic cannot put you to sleep.'],
  'dwarven-resilience': ['Résistance naine', 'Dwarven Resilience', 'Avantage aux sauvegardes contre le poison et résistance aux dégâts de poison.', 'Advantage on saves against poison and resistance to poison damage.'],
  stonecunning: ['Connaissance de la pierre', 'Stonecunning', 'Pour un test d’Histoire sur l’origine d’un ouvrage en pierre, vous êtes considéré comme maîtrisant Histoire et ajoutez le double du bonus de maîtrise.', 'For History checks about the origin of stonework, you count as proficient and add twice your proficiency bonus.'],
  trance: ['Transe', 'Trance', 'Quatre heures de méditation remplacent les huit heures de sommeil habituelles.', 'Four hours of meditation replace the usual eight hours of sleep.'],
  lucky: ['Chanceux', 'Lucky', 'Sur un 1 naturel à une attaque, un test de caractéristique ou une sauvegarde, relancez le dé et utilisez le nouveau résultat.', 'Reroll a natural 1 on an attack, ability check or saving throw, and use the new roll.'],
  brave: ['Vaillant', 'Brave', 'Avantage aux sauvegardes contre la peur.', 'Advantage on saving throws against being frightened.'],
  nimbleness: ['Agilité halfeline', 'Halfling Nimbleness', 'Vous pouvez traverser l’espace d’une créature d’une catégorie de taille supérieure à la vôtre.', 'You can move through the space of a creature larger than you.'],
  'gnome-cunning': ['Ruse gnome', 'Gnome Cunning', 'Avantage aux sauvegardes d’Intelligence, de Sagesse et de Charisme contre la magie.', 'Advantage on Intelligence, Wisdom and Charisma saves against magic.'],
  'dwarven-toughness': ['Robustesse naine', 'Dwarven Toughness', 'Votre maximum de points de vie augmente de 1 par niveau de personnage.', 'Your hit point maximum increases by 1 per character level.'],
  'naturally-stealthy': ['Discrétion naturelle', 'Naturally Stealthy', 'Vous pouvez tenter de vous cacher derrière une créature d’au moins une catégorie de taille supérieure à la vôtre.', 'You can try to hide behind a creature at least one size larger than you.'],
  'relentless-endurance': ['Acharnement', 'Relentless Endurance', 'Si vous tombez à 0 PV sans mourir sur le coup, vous pouvez rester à 1 PV. Une utilisation par repos long.', 'When reduced to 0 HP without being killed outright, stay at 1 HP instead. Once per long rest.'],
  'savage-attacks': ['Attaques sauvages', 'Savage Attacks', 'Sur un coup critique avec une arme de corps à corps, ajoutez un dé de dégâts de cette arme.', 'On a critical hit with a melee weapon, add one of that weapon’s damage dice.'],
  'artificer-lore': ['Connaissances artificières', 'Artificer’s Lore', 'Pour les tests d’Histoire liés aux objets magiques, alchimiques ou technologiques, ajoutez deux fois votre bonus de maîtrise au lieu de tout bonus de maîtrise habituel.', 'For History checks about magical, alchemical or technological items, add twice your proficiency bonus instead of any usual proficiency bonus.'],
  tinker: ['Bricoleur', 'Tinker', 'Vous maîtrisez les outils de bricoleur. Une heure de travail et 10 po de matériaux permettent de fabriquer un petit dispositif mécanique ; trois dispositifs actifs au maximum, chacun durant 24 heures sauf entretien.', 'You gain tinker’s tools proficiency. One hour and 10 gp of materials create a tiny clockwork device. Up to three may be active; each lasts 24 hours unless maintained.'],
};

export function traitPresentation(trait, locale = 'fr') {
  const en = locale === 'en', known = coreTraits[trait.id];
  // Do not replace homebrew/extension descriptions just because their IDs are familiar.
  if (known && !trait.description) return { title: known[en ? 1 : 0], description: known[en ? 3 : 2] };
  const name = trait.name?.[locale] ?? trait.name?.fr ?? trait.id;
  const parts = name.split(/\s*:\s*/);
  const description = en ? trait.descriptionEn : trait.description;
  return { title: parts[0], description: description || parts.slice(1).join(' : ') };
}

export function abilityBonusSummary(data, label, locale = 'fr') {
  const fixed = Object.entries(data.bonuses ?? {}).map(([k, n]) => `${label(k)} +${n}`);
  if (data.flexibleAbilityBoosts) fixed.push(locale === 'fr' ? '+2 et +1, ou trois +1, au choix' : '+2 and +1, or three +1s, of your choice');
  for (const q of data.choices ?? []) if (q.kind === 'score') fixed.push(
    locale === 'fr' ? `${q.count} caractéristique${q.count > 1 ? 's' : ''} au choix +${q.amount ?? 1}` : `${q.count} chosen abilities +${q.amount ?? 1}`);
  return fixed.join(' · ');
}

/** Effects specific to an ancestry or subrace, including structured grants. */
export function originBenefits(data, name, locale = 'fr') {
  const en = locale === 'en', rows = (data.traits ?? []).map(t => traitPresentation(t, locale));
  const add = (title, values) => { if (values.length) rows.push({ title, description: values.join(' · ') }); };
  add(en ? 'Proficiencies' : 'Maîtrises', [...data.skills ?? [], ...data.proficiencies ?? []].map(name));
  add(en ? 'Spells' : 'Sorts', (data.spells ?? []).map(s => name(s.id) + (s.level > 1 ? ` (${en ? 'level' : 'niveau'} ${s.level})` : '')));
  const choiceKinds = { skill: en ? 'Skills of your choice' : 'Compétences au choix', language: en ? 'Languages of your choice' : 'Langues au choix', proficiency: en ? 'Proficiencies of your choice' : 'Maîtrises au choix', 'racial-spell': en ? 'Cantrip of your choice' : 'Sort mineur au choix', feat: en ? 'Feat of your choice' : 'Don au choix' };
  for (const q of data.choices ?? []) if (choiceKinds[q.kind] && !q.requiresChoice) rows.push({ title: choiceKinds[q.kind], description: `${q.count}` + (q.classId ? ` · ${name(q.classId)}` : '') });
  return rows;
}

export function racialBonusCell(origin, selections, ability) {
  const choices = (origin?.choices ?? []).filter(q => q.kind === 'score');
  const allocated = choices.reduce((n, q) => n + ((selections?.[q.id] ?? []).includes(ability) && q.options.includes(ability) ? q.amount ?? 1 : 0), 0);
  return {
    total: origin?.bonuses?.[ability] ?? 0,
    fixed: Math.max(0, (origin?.bonuses?.[ability] ?? 0) - allocated),
    choices: choices.filter(q => q.options.includes(ability)),
  };
}
