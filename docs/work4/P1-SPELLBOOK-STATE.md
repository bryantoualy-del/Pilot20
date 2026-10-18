# Work4 P1 — spell acquisition state and compatibility

This first implementation records per-origin spell grants alongside the existing v2 character definition. Known, book, prepared-list, automatic, pact, arcanum and ritual origins stay distinct; the existing aggregate `spells.known/prepared` remains the compatibility projection for the Companion.

The creator compiler produces the metadata from its resolved report. Both current editor save paths pass it to the existing repository. Definition, spellbook and linked draft are committed in the same storage transaction. Metadata is pinned to the character ID/revision; imports with mismatched identity or projection reject before writing. Exports, duplicates and archive operations retain the metadata. Old records remain readable without a new field; `migrateLegacySpellbook` preserves their aggregates and explicitly leaves unknown acquisition origins/levels unresolved.

The 319 SRD audit UUID aliases map one-to-one to existing installed IDs. Alias lookup never enables a spell missing from the campaign's index. No existing spell ID is replaced.

## Validation

`node --test tests/spellbook-state.test.js tests/creator.test.js` passes 23 tests locally with Node24, including failed atomic saves, stale revisions, both export formats, duplicates, malformed metadata, wizard book/preparation, bard Secrets and warlock arcanum. Broader checks are recorded in the PR. IndexedDB and complete browser regressions run in GitHub CI with the repository's complete assets/dependencies; they are not claimed from the partial local mirror.

## Limits and next lots

This is the persistent data foundation, not the full Work4 player experience. New Grimoire commands, the unique creator, source expansion and the complete FR catalogue follow in separate PRs. No new combat engine or live RPG Connect transport is introduced.

The legacy compiler's origin-spell report does not identify every owner separately. These grants retain the ancestry reference and supplied casting ability; complete race/feat ownership needs the content lot. Learning dates are only marked verified when a complete advancement history has passed the existing validator. A high-level snapshot alone does not supply those dates.

## Approved product choices

SRD/Xanathar/Tasha remain the base, with PHB2014 outside SRD and targeted race versions authorized for the reference characters. Use official2014 errata and verified French book names with searchable AideDD aliases. Explanations belong naturally in the detail view, with discreet references. AideDD's public Absorb Elements page was checked for descriptions and scaling; UA pages are not treated as final published rules. No protected book text or illustration is added by this PR. Major merges and publication still require the user's approval.
