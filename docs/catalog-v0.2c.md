# Catalogue V0.2c and consumer contracts

Ruleset: `dnd5e-2014`. The official catalogue is English SRD 5.1, CC BY 4.0. `name.fr` deliberately falls back to the English label, not to a copied published French translation. No Tasha or Xanathar book text is included.

## Modules

- `data/classes.json`: 12 classes, twenty acquisition rows each, 12 subclasses, feature and option entries, resource/scaling tables and English reference text.
- `data/spells.json`: 319 English spell descriptions and mechanical metadata; 16 partial adapters, remaining spells manual.
- `data/srd51-manifest.json`: independently extracted class spell lists, expected spell IDs, PDF SHA-256 and normalization notes.
- `catalog-v3.js`: inert validation and indexed multi-pack loading. `srd51-catalog.js` loads the two public modules. Applications can import class data separately before needing spell data.
- `advancement.js`: level-up snapshots, acquisition/replacement validation, persistent choice-history deltas and versioned build-plan import/export.
- `progression.js`: class-level grants, choices, ASIs, prerequisites, resources, standard/pact slots, subclass prepared/expanded spells.
- `character-builder.js`: generates character **v2**, invokes the existing rules compiler and reuses existing persistence/session contracts. No engine rewrite.
- `adapters.js`: code-owned bridge to existing combat/reaction/conditional primitives. Arbitrary pack handler names are rejected.

## V0.3 consumer API

`listClasses(index)`, `listSubclasses(index, classId)`, `getProgression(index, classId)`, `listSpells(index, classId, {minimumLevel, maximumLevel})`, `meetsPrerequisites(scores, anyOf)`.

`resolveProgression(index, {classes, scores, selections, campaignOptions})` returns `features`, `resources`, `scaling`, `slots`, `grantedSpells`, `choices`, `issues`, `manualRequirements`, `limits` and `valid`. `classes` is ordered by first acquisition and contains `{id, level, subclassId}`. Level fields on catalogue choices are **class levels**. Subclass identity is canonical in `classes[].subclassId`; conflicting selection records are rejected. `selections` maps each choice ID to a unique array of option IDs. No automatic player choices are made.

ASIs apply to the supplied base scores. Do not submit already-ASI-adjusted scores and apply the same ASIs again. Feat choices require `campaignOptions: ['feats']`; the public SRD contains Grappler only. Invocation prerequisite levels are warlock levels, not total level. Expanded patron spells are offered, not automatically learned. Always-prepared domain/oath/circle spells do not consume the preparation allowance.

`buildCharacter(index, request)` adds `id`, `name`, optional `ancestry`, explicit `background` skills/proficiencies, `hpMode`, optional `hpProgression`, `spellbookTranscriptions` and `advancementHistory`. It returns `character: null` when catalogue choices are incomplete or invalid. Default average HP is a documented constructor policy, not a roll. When `advancementHistory` is supplied, HP order and choice acquisition levels follow its chronology. An explicit HP progression must agree with that order. Without an ancestry, a visible `pilot20:ancestry-unselected` marker is produced; no racial bonuses, ancestry or background are chosen. `valid` means the implemented catalogue/build contracts pass; `manualRequirements` still require user/GM review. This is not a claim of complete rulebook legality.

Wizard spellbooks and known-spell inventories exceeding twenty options are paged into existing v2 choice records. Derived stats, spell slots, resources, combat instances and save/export remain on existing v2 contracts.

`replaceSelection(index, request, {choiceId, removeId, addId})` is atomic and revalidates the current build. It does **not** authorize unlimited historical replacement: supply `advancementHistory` to audit each level. Omitting history is reported as `not-recorded`, never as verified. `examples/catalog-demo.mjs` is an explicit authored build, not a default-selection engine. Test selection helpers are isolated in tests/helpers.

## V0.4 consumer API

`commandMetadata(character, index)` exposes category, economy, resource cost, target count, confirmation and declared coverage. Runtime usages/availability come from the pinned session actor, not the static catalogue. A missing adapter yields an explicit manual profile, never automatic success. Resource accounting alone does not turn an entry into `automated`.

For simple numeric spells, the caller must supply `facts[actorId].spellEligibilityValidated`. Ray of Frost, Shocking Grasp and Sacred Flame additionally require `spellRiderResolved`; False Life requires `baseLevelOnlyValidated` because non-base-slot scaling remains manual. Components, cover, target eligibility, range, geometry and environmental consequences remain adjudicated. Other manual spells use `declareManual` then `resolveManual`, preserving pending state, costs, undo and idempotence. Long casting times and manual-duration clocks require GM tracking. Ritual-only acquisitions expose a separate manual ritual command and no ordinary slot-cast button; completion requires `castingTimeAdjudicated` and `ritualEligibilityValidated`. Long slot-cast spells also require `castingTimeAdjudicated`.

`confirmedActionEvent(before, command, outcome)` projects committed transaction IDs, category, spell/ability, damage/healing types, targets and result. Pending reactive/manual decisions are not marked confirmed. Replays are rejected. No media, graphics library, protocol changes or FX execution are included. The presentation layer must still apply its visibility policy before exposing GM results.

## Extensions and collisions

`createCatalogIndex(packs, {distribution, enabledPackIds, enabledOptions})` validates every pack, then enables non-SRD packs only by explicit pack ID. Campaign options default off. Public distribution rejects private entries even if disabled. Identical IDs are rejected; there is no silent last-wins priority. Use distinct IDs plus explicit `replaces` and campaign opt-in. A feature marked `optionalClassFeature: true` is acquired at its class level only when its pack/campaign option is enabled. `suppressesChoices` and `suppressesResources` remove obsolete class-local selections and counters. Conflicting replacements are errors. Existing adapters check acquired features; replacements never mutate a pinned combat session. New mechanical semantics remain manual unless backed by a reviewed adapter. `requires`/`replaces` references are checked and cycles rejected. Readers receive copies of static entries, protecting index state.

Packs contain JSON only. No functions, prototypes, executable source, browser dependencies or dynamic code loading. Unknown handlers fail closed. Declared private metadata is not a rights checker and never makes a public GitHub branch private.

## Versions and migration

Catalogue v3 is additive. Legacy catalogue v2 still passes its old validator unchanged, preserving its IDs. The v3 index intentionally does not merge legacy minimal entries implicitly (Fire Bolt has the same stable ID). Character, preferences, sessions, IndexedDB and exports remain schema version 2; no persisted-character migration is required. Unknown catalogue versions fail explicitly. Existing character migrations remain unchanged and non-destructive. A versioned standalone JSON Schema accompanies v3; runtime linked-reference validation remains mandatory.

## Validation

Run `npm test`, `npm run demo:catalog`, `npm run coverage:check`, `npm run coverage:catalog:check`, `npm run benchmark:catalog`. CI uses Node 22 and 24. Coverage separates structural presence, progression representation, executed families and manual requirements. Tests retain the old synthetic report and add production catalogue builds; they do not promote fixtures to official content.


## Follow-up contracts

`validateAdvancementHistory(index, request, history)` validates at most twenty snapshots `{classId, classes, selections, adjudication?}`. Each row names the class advanced and its complete current class/selection snapshot. The sequence must reach the final build. Learned wizard spells remain in the book; each wizard level adds its declared allowance, plus explicit approved transcriptions `{classId, spellId, characterLevel, reason}`. Known-spell and invocation replacement budgets are per gained class level; cantrips, ASIs, metamagic and other permanent choices cannot silently change. Bard replacement of an earlier Magical Secret must use the bard list. Prepared spells may change independently of permanent learning. Private subclass changes require campaign option `subclass-retraining` and an adjudication note; this is permission/provenance, not automatic implementation of any book's training/cost rules.

History deltas are stored as versioned JSON in existing `choices[].note`; paged choices reference their first page's record. `readChoiceHistories(character)` reads these without changing the character v2 envelope. `exportBuildPlan(request, history)` / `importBuildPlan(index, raw)` preserve and validate the complete plan, including old/replaced choices. Oversized notes/plans fail explicitly rather than truncating. A future editor should retain the complete build plan as well as the compiled character when retraining.

Combat profile `spell.slotPolicy` is optional (`standard` by default, or `free`). Free casting retains the real spell level, cannot accept/upcast with a slot, and can consume a distinct feature charge. Mastery gets an extra free command only while that spell is prepared; Signature Spells are always prepared and have individual short-rest charges. Arcanums use their real level and separate long-rest charge. Manual spells still require GM resolution; their automatic Counterspell window is not claimed. Standard bonus-action spell restrictions apply to slot-free leveled spells.

`manualMechanics` declares action economy, target count, resource cost and explicit eligibility confirmation for manual class features. It automates bookkeeping, not the effect. Calendar-dependent resources have `recovery: none` and descriptive `recharge` metadata; the GM resets them with an explained correction when eligible. This prevents ordinary rest from shortening a seven-day cooldown.

Optional casting metadata `multiclassRounding` (`floor` default / `ceil`) and `startsAtClassLevel` support future private class policies. Defaults preserve SRD behavior. This does not publish an Artificer definition.

Schema compatibility: character/session/export v2 envelopes remain unchanged; choice-history and build-plan records have their own version 1. Combat-profile-v1 and casting schemas receive additive optional fields. Existing saves follow old defaults and are not rewritten. Older software may explicitly reject the new fields; no destructive downgrade is performed. Pre-follow-up draft builds using the former level-zero Arcanum workaround should be rebuilt from their selections; pinned sessions are not silently migrated.
