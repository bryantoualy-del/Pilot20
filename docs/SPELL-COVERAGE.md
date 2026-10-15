# Spell families and coverage

Reference: [SRD 5.1 CC BY 4.0](https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf), Spellcasting and Spells. Examples identify mechanical families; they are not a distributed complete spell catalogue. All statuses refer to the **whole declared behavior**. No spell is automated merely because its damage component works.

| Family | SRD example | Required primitives | V0.2 baseline / gap | Automation priority |
|---|---|---|---|---|
| Attack / single target | Fire Bolt | Cast legality, spell attack, typed damage, level scaling | Attack/damage available; cast legality and scaling not inferred | P0 |
| Save / multiple targets | Fireball | Per-target save, shared damage roll, half rounding, defenses, slot/upcast | Save and slot selection missing | P0 |
| Area damage | Burning Hands | Above plus shape, range, geometry, friendly targets | Explicit target selection can be manual; no geometry | P0 manual selection; later geometry |
| Healing | Cure Wounds | Cast, typed target eligibility, healing, upcast | Heal and cap exist; no creature-type filter | P0 then target rules |
| Temporary HP | False Life | Cast, no addition of temp HP, upcast, duration | Max temp HP supported; duration and source removal missing | P0; do not label full spell until removal policy exists |
| Buff / debuff | Haste, Slow | Runtime modifiers, action constraints, save, duration, end consequence | Represented; no runtime modifiers yet | P0 Haste; Slow remains manual |
| Conditions | Hold Person | Type eligibility, save, paralysis consequences, repeated save, concentration | Incapacitation flag only; no full condition semantics | P0 conditions subset; P1 repeated saves |
| Concentration | Bless | One source instance, duration, dependent targets, roll dice | Concentration check exists; distributed dependent effects missing | P0 lifecycle; support die remains manual |
| Persistent / repeated | Witch Bolt | Source/target tether, next-turn cost, range, repeat damage | Unsupported tether and recurring event entitlement | Later |
| Zones / auras | Spirit Guardians | Membership, start/entry timing, saves, repeat limits, movement | No spatial model or event triggers | Manual; later |
| Summons / secondary entity | Spiritual Weapon, Conjure Animals | Entity identity, control, independent/owner initiative, action linkage | No secondary entity contract execution | Manual; later |
| Transformation | Polymorph | Profile override, own HP, retained fields, concentration, spillover/reversion | Structural transformation contract only | Unsupported automation |
| Movement / teleport | Misty Step | Destination validity, range, remaining movement, cast | No map/obstacle/visibility authority | Manual destination; movement budget P0 |
| Illusion / narrative | Major Image | Cast/resource/concentration plus adjudicated perception/interaction | Essential consequences require MJ decision | Manual |
| Reaction / interruption | Shield, Counterspell | Event window, ordered offers, decision, resume/recompute | Reaction slot exists; no window | Deferred P1 |
| Choice of effects | Enhance Ability | Choice before cast, selected modifier, alternatives not additive | Choice contract only | Manual |
| Higher slot | Fireball, Cure Wounds | Explicit slot level, data-driven dice increments | Ordinary/pact pool counts exist, no cast selection | P0 |
| Ritual / long casting | Detect Magic ritual | Availability exceptions, elapsed casting, interruption | No ritual/long-cast timeline | Manual / later |
| Consequences decided by MJ | Wish, Suggestion | Resource declaration, traceable decision and outcomes | Must not invent an automatic resolution | Manual |

## Status semantics

- `referenced`: identifier/provenance and description only; no execution.
- `manual`: an explicit manual procedure is required. Resource declaration and outcome corrections may be transactional; essential spell semantics are adjudicated externally.
- `partial`: some required primitives exist; the automatic executor rejects the **whole** ability. An explicit separately validated manual procedure may be offered.
- `automated`: all declared mechanical consequences and prerequisites are supported by the specified executor, within its documented scope and regression cases.
- `unsupported`: no safe executable plan or unresolved requirements. Never silently remove unknown conditions, effects or triggers.

The generated fixture report is not a percentage of the SRD. Its denominator is the abilities in `examples/characters.mjs`, not all spells/classes. Future catalogue coverage must compute over a pinned catalogue/version and name the tested families separately from referenced examples. Spatial eligibility, components, equipment/free-hand constraints and narrative adjudication remain explicit inputs or manual gates; missing essential rules prevent a claim of full spell automation.
