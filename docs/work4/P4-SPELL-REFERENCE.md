# Work4 P4 — verified spell reference and French display

Adds the435 factual spell reference entries from Work2 (319 SRD,95 Xanathar,21 Tasha) with stable IDs, verified names, aliases, casting properties, bibliography and separate base/optional-Tasha class lists. Existing319 SRD IDs remain authoritative. The116 other records are reference metadata at this stage, not a false claim that their complete mechanics or class grants are installed.

French display and accent-insensitive FR/EN/alias search use the reference, without overwriting existing canonical English labels or executable definitions. For non-SRD French labels, verified book headings take precedence; AideDD spell names remain searchable aliases. The SRD reference PDF is English, so its French names retain their separately verified AideDD provenance rather than pretending an English heading verifies a French translation.

The creator detail has original French explanations for16 common SRD spells, English SRD descriptions available on request, and discreet bibliographic references. None of the original protected descriptions from Xanathar/Tasha/AideDD are copied. This is not a claim of435 full French descriptions or validated mechanical effects. Content review and2014 errata remain explicit work before the full delivery.

Validation:435 unique identities;319 installed-ID matches; unchanged SRD spell levels; French names and properties; searchable eponymous/generic aliases; returned metadata cannot mutate the index. New unit tests plus existing builder/creator tests pass locally. Runtime acquisition eligibility still comes from the progression engine, never from reference-list presence alone.
