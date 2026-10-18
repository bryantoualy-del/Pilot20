# Work4 P5 — character Grimoire and transactional spell management

The library opens a character's Grimoire directly. My spells/Catalogue share FR/EN/alias search, level/school/source/concentration/ritual filters, favorites and per-character view preferences. Filters do not affect acquisition/preparation counters. Spell details use the shared discreet explanation/reference view from P4.

Daily preparation controls are exposed only when the progression report supplies a `prepared` choice for the selected class. A pending set stays local until the complete validated preparation is saved; cancel or failure leaves the old character intact. Always-prepared domain spells are outside the editable quota. Bards and warlocks have no generic preparation command. Their known spells and special acquisition choices remain in the creator/progression flow.

Wizard copying is separate from daily preparation. The player confirms spell access, copying time and cost; the copy is recorded in draft transcriptions, increases the allowed book count and survives export/reopening. It does not automatically prepare the copied spell. There is no automatic deduction of unmodeled gold or time. Existing combat resource/concentration state is not edited.

Every mutation reloads the character, draft and campaign, recompiles with the existing authorities, and uses the same atomic save as the creator. Stale revisions, disabled sources and a definition that has been manually changed outside its build plan reject without overwriting data. Legacy spell origins remain unresolved unless a valid saved plan establishes them.

## Verification

New unit tests cover staged sets, no preparation for a bard, copying without preparation, failed writes, stale edits, disabled sources and preservation of external manual notes. `e2e/work4-grimoire.mjs` seeds explicitly synthetic SRD Wizard10/Cleric5/Bard10/Warlock11 fixtures, then uses the real Grimoire UI for copying, preparation, library reopening, fixed domain grants and responsive screenshots. It is not a validation of the Compagnie Creole's real sheets or physical Safari.

## Limits remaining for the full Work4 delivery

The source/content lot P3 has not been completed. UI policy for the currently installed classes works from the existing engine; this does not install Artificer, magical fighter/rogue subclasses or the entire Xanathar/Tasha catalogue. The116 non-SRD references in P4 remain separate from installed spell definitions. Full French spell descriptions, source-specific conditional accesses and chronology of high-level creation still need review. Historical acquisition dates are not invented. Complete starting equipment/HP choices and final device testing remain open.

No new public version is deployed, and no major PR is merged by this lot.
