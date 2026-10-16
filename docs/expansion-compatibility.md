# Expansion compatibility (2014)

This is an architectural assessment, not a certification of complete Xanathar/Tasha support. The attached private PDFs were consulted locally for representative requirements (Tasha: origin/subclass changes, optional features, Artificer multiclassing and item capacity; Xanathar: subclass structures, tools and downtime). No protected prose, illustrations, screenshots or book corpus is imported into the public repository. This is a representative architectural review, not exhaustive implementation of either book. Public data comes from the English SRD 5.1 CC source.

| Category | Representation | Execution / remaining adaptation |
|---|---|---|
| Additional subclasses and spells | Namespaced JSON entries, class-level grants and source records | Explicit private-pack enablement; unsupported spell effects remain manual |
| Conditional features | Existing trigger, condition, decision, effect and resource contracts | Only code-owned primitives/handlers execute; custom semantics manual |
| Optional class features | `campaignOption`, `requires`, `replaces`, distinct IDs | Disabled by default; class-local choice/resource suppression is supported and conflicting replacements rejected; new effects still require review |
| Subclass change | Rebuild request with new subclass, detect obsolete choices | Existing session is revision-pinned; no silent mutation or automatic mid-session retraining |
| Origin customization | Existing scores, skills, proficiencies and ancestry fields | Origin bonus allocation/replacement is not a V0.2c constructor automation |
| Tools and downtime | Choice/proficiency metadata and reference text | Time, income, crafting and downtime outcomes manual |
| Summons/companions | Entity metadata in inert packs; multiple session participants | Ownership/AI, initiative synchronization and summon duration are manual |
| Transformation | Existing alternative-state contracts and manual ability profiles | Full Wild Shape replacement stats, merged resources and restoration manual |
| Artificer as optional class 13 | Generic class key, hit die, INT casting metadata, tools, item-capacity resources, item/entity metadata, subtype grants | No protected class/subclass/infusion corpus distributed. Active infused item binding, infusions learned/prepared, item attunement and specialization semantics need private data plus reviewed adapters |
| Artificer multiclass casting | Half-caster metadata can be stored | Optional `multiclassRounding: ceil` and `startsAtClassLevel` preserve the required contribution policy without a protected class definition; standard SRD half casters retain their defaults |
| Infused/secondary entities | References and capacity counters representable | No automatic inventory binding, pet actions or arbitrary pack code |
| Invocation/optional spell lists | Prerequisites, per-class access, selected spell metadata | At-will and ritual-only execution policies remain manual where no pinned adapter exists |

A synthetic private thirteenth-class test exercises class/resource/entity representation without copying an official class. It is evidence of extensibility, not proof that the Artificer is implemented. Private pack selection, collision, wrong-edition, references, cycles and code-owned handler checks are tested.

License boundary: owning a PDF does not provide redistribution rights. Keep source book text, illustrations and user imports outside this public repository. French `name.fr` entries use English fallbacks; a separately authorized translation can be layered later. Do not merge 2024 tables or SRD 5.2 data into these packs.

Private PDF review changes the assessment evidence, not the distribution boundary. Origin replacement, tool/skill interactions and downtime outcomes remain explicitly adjudicated; tool synergy never silently grants double proficiency. Protected expansion choices still require an authorized private pack. No such pack is published here.
