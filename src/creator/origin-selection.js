/** Remove only dependent answers made inactive by an explicit parent change. */
export function selectOriginChoice(draft, choice, values, owner) {
  draft.originSelections ??= {};
  draft.originSelections[choice.id] = values;
  for (const spec of owner?.data.choices ?? []) {
    const condition = spec.requiresChoice;
    if (condition?.key === choice.key && !values.includes(condition.optionId)) {
      delete draft.originSelections[choice.ownerId + ':' + spec.key];
    }
  }
}
