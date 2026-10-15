# Generic rules contracts, v1

V0.2b.1 adds `src/rules/contracts.js` as a JSON-only boundary. Character Definition, Runtime, Combat Session, Catalog and Dashboard remain separate. Existing V0.2 envelopes retain version 2; the additive rules-catalog and decision/trigger/transformation contracts have their own version 1. There is no automatic migration of descriptive abilities into executable ones. Existing receipts remain unchanged.

`coverage({version:1, mode, primitives, requirements})` computes a status using the executor's primitive registry. A partial plan is rejected wholesale by automatic execution. Declaring a primitive available is not enough: content compilation and all referenced prerequisites still need validation. Runtime guards are authoritative; the report is descriptive.

## Decisions and triggers (contract only in this sub-lot)

A decision pins an event ID, actor, expected revision, option IDs/costs and a continuation phase. The explicit policy is `block-dependent-resolution`; no wall-clock auto-accept or fallback. Pending windows must be persisted before presenting options. A future response must reference the decision/event/option and current revision, pay costs only on acceptance, mark it resolved once, then resume that same event. Decline consumes no reaction/resource. Independent commands require an explicit allowlist; dependent attack/damage/turn resolution must block. Undo must restore event, decision, costs and all affected actors as one coherent boundary; immutable receipts prevent replaying a consumed continuation.

The contract validator does not execute decisions. Reaction triggers and post-hit choices remain blocked, including Shield, Counterspell, Sneak Attack and Divine Smite. A plain V0.1 reaction slot does not constitute a reaction window.

Triggers name generic events (`attack-hit`, `damage-taken`, `turn-start`, `turn-end`, `save-resolved`, `ally-attacks`, `zone-enter`, `spell-cast`), scope, optional active-effect dependency and limit (`turn`, `round`, rests). Event IDs and turn IDs must drive entitlement; once/turn is not once/round. No rule branches on class or character identity.

## Transformations (contract only)

A transformation references a versioned creature/profile, separate form HP, retained mental statistics/proficiencies/features, casting policy, retained concentration, return triggers and damage overflow to the original form. `execution` must equal `unsupported` until the full executor exists. Validate profile eligibility, body/equipment compatibility, form unconsciousness/death, reversion, overflow and exact restoration before enabling. No synthetic HP swap is offered as Wild Shape.

## Catalogue import

`importCatalogPack` validates a versioned `rules-catalog` with stable IDs, item versions, D&D 2014 ruleset, source/license, references, mechanical data and coverage rules. Supports class/subclass/progression/trait/feat/spell/equipment/condition/creature/transformation/ability items. Imported mechanics are inert JSON and never evaluated as JavaScript. Unsafe keys, functions, unknown primitive names and future rulesets are rejected. Public redistribution is opt-in: SRD CC BY 4.0 or declared CC BY 4.0 homebrew only. Other third-party licenses require an explicit future reviewed license policy, never implicit acceptance. Import validation does not certify the truth of a provenance claim or install rules into the executor.

## Authority

Local/Free modes execute locally. Encounter mode continues to require Encounter authority before changes, including manual outcomes, effects, turn transitions and decisions. Future transport forwards intents and consumes authoritative events with durable IDs; Pilot20 must not calculate and then reapply the same final damage. No WebSocket or competing combat authority is added.
