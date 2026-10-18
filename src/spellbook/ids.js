import aliases from './srd-id-aliases.json' with { type: 'json' };
/** Keep installed IDs authoritative; an audit alias never enables unavailable content. */
export function canonicalSpellId(index, reference) {
  if (index.get(reference)?.type === 'spell') return reference;
  const resolved = Object.hasOwn(aliases, reference) ? aliases[reference] : null;
  return resolved && index.get(resolved)?.type === 'spell' ? resolved : null;
}
