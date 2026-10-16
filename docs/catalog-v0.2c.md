# Catalogue V0.2c and consumer contracts

Ruleset: `dnd5e-2014`. The official catalogue is English SRD 5.1, CC BY 4.0. `name.fr` deliberately falls back to the English label, not to a copied published French translation. No Tasha or Xanathar book text is included.

## Modules

- `data/classes.json`: 12 classes, twenty acquisition rows each, 12 subclasses, feature and option entries, resource/scaling tables and English reference text.
- `data/spells.json`: 319 English spell descriptions and mechanical metadata; 16 partial adapters, remaining spells manual.
- `data/srd51-manifest.json`: independently extracted class spell lists, expected spell IDs, PDF SHA-256 and normalization notes.
- `catalog-v3.js`: inert validation and indexed multi-pack loading. `srd51-catalog.js` loads the two public modules. Applications can import class data separately before needing spell data.
- `progression.js`: class-level grants, choices, ASIs, prerequisites, resources, standard/pact slots, subclass prepared/expanded spells.
- `character-builder.js`: generates character **v2**, invokes the existing rules compiler and reuses existing persistence/session contracts. No engine rewrite.
- `adapters.js`: code-owned bridge to existing combat/reaction/conditional primitives. Arbitrary pack handler names are rejected.

## V0.3 consumer API

`listClasses(index)`, `listSubclasses(index, classId)`, `getProgression(index, classId)`, `listSpells(index, classId, {minimumLevel, maximumLevel})`, `meetsPrerequisites(scores, anyOf)`.

`resolveProgression(index, {classes, scores, selections, campaignOptions})` returns `features`, `resources`, `scaling`, `slots`, `grantedSpells`, `choices`, `issues`, `manualRequirements`, `limits` and `valid`. `classes` is ordered by first acquisition and contains `{id, level, subclassId}`. Level fields on catalogue choices are **class levels**. Subclass identity is canonical in `classes[].subclassId`; conflicting selection records are rejected. `selections` maps each choice ID to a unique array of option IDs. No automatic player choices are made.

ASIs apply to the supplied base scores. Do not submit already-ASI-adjusted scores and apply the same ASIs again. Feat choices require `campaignOptions: ['feats']`; the public SRD contains Grappler only. Invocation prerequisite levels are warlock levels, not total level. Expanded patron spells are offered, not automatically learned. Always-prepared domain/oath/circle spells do not consume the preparation allowance.

`buildCharacter(index, request)` adds `id`, `name`, optional `ancestry`, `hpMode` and optional `hpProgression`. It returns `character: null` when catalogue choices are incomplete or invalid. Default average HP is a documented constructor policy, not a roll. Explicit chronological `hpProgression` is needed for interleaved multiclass histories. Without an ancestry, a visible `pilot20:ancestry-unselected` marker is produced; no racial bonuses, ancestry or background are chosen. `valid` means the implemented catalogue/build contracts pass; `manualRequirements` still require user/GM review. This is not a claim of complete rulebook legality.

Wizard spellbooks and known-spell inventories exceeding twenty options are paged into existing v2 choice records. Derived stats, spell slots, resources, combat instances and save/export remain on existing v2 contracts.

`replaceSelection(index, request, {choiceId, removeId, addId})` is atomic and revalidates the current build. It does **not** authorize unlimited historical spell replacement: level-up chronology must be reviewed manually. `examples/catalog-demo.mjs` is an explicit authored build, not a default-selection engine. Test selection helpers are isolated in tests/helpers.

## V0.4 consumer API

`commandMetadata(character, index)` exposes category, economy, resource cost, target count, confirmation and declared coverage. Runtime usages/availability come from the pinned session actor, not the static catalogue. A missing adapter yields an explicit manual profile, never automatic success. Resource accounting alone does not turn an entry into `automated`.

For simple numeric spells, the caller must supply `facts[actorId].spellEligibilityValidated`. Ray of Frost, Shocking Grasp and Sacred Flame additionally require `spellRiderResolved`; False Life requires `baseLevelOnlyValidated` because non-base-slot scaling remains manual. Components, cover, target eligibility, range, geometry and environmental consequences remain adjudicated. Other manual spells use `declareManual` then `resolveManual`, preserving pending state, costs, undo and idempotence. Long casting times and manual-duration clocks require GM tracking. Ritual-only acquisitions do not expose an ordinary slot-cast button.

`confirmedActionEvent(before, command, outcome)` projects committed transaction IDs, category, spell/ability, damage/healing types, targets and result. Pending reactive/manual decisions are not marked confirmed. Replays are rejected. No media, graphics library, protocol changes or FX execution are included. The presentation layer must still apply its visibility policy before exposing GM results.

## Extensions and collisions

`createCatalogIndex(packs, {distribution, enabledPackIds, enabledOptions})` validates every pack, then enables non-SRD packs only by explicit pack ID. Campaign options default off. Public distribution rejects private entries even if disabled. Identical IDs are rejected; there is no silent last-wins priority. Use distinct IDs plus explicit `replaces` and campaign opt-in; acquired replacements remove the referenced feature from the resolved feature list. A replacement's other consequences (resources, retraining, current session state) require a reviewed adapter or manual correction. `requires`/`replaces` references are checked and cycles rejected. Readers receive copies of static entries, protecting index state.

Packs contain JSON only. No functions, prototypes, executable source, browser dependencies or dynamic code loading. Unknown handlers fail closed. Declared private metadata is not a rights checker and never makes a public GitHub branch private.

## Versions and migration

Catalogue v3 is additive. Legacy catalogue v2 still passes its old validator unchanged, preserving its IDs. The v3 index intentionally does not merge legacy minimal entries implicitly (Fire Bolt has the same stable ID). Character, preferences, sessions, IndexedDB and exports remain schema version 2; no persisted-character migration is required. Unknown catalogue versions fail explicitly. Existing character migrations remain unchanged and non-destructive. A versioned standalone JSON Schema accompanies v3; runtime linked-reference validation remains mandatory.

## Validation

Run `npm test`, `npm run demo:catalog`, `npm run coverage:check`, `npm run coverage:catalog:check`, `npm run benchmark:catalog`. CI uses Node 22 and 24. Coverage separates structural presence, progression representation, executed families and manual requirements. Tests retain the old synthetic report and add production catalogue builds; they do not promote fixtures to official content.
