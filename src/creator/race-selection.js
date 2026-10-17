import {
  raceLibrary,
  RACE_FAMILIES,
  RULE_SOURCE_VERSIONS,
} from "../catalog/race-discovery.js";
import variants from "../catalog/data/race-variants.json" with { type: "json" };
import { refreshPortrait } from "./appearance.js";
export function raceOptions(context, locale = "fr") {
  return raceLibrary(context).flatMap((f) => {
    const active = f.versions.filter((v) => v.available);
    return [
      ...active.map((v) => [v.entry.id, v.entry.name[locale]]),
      ...(RACE_FAMILIES.some((v) => v.slug === f.raceFamilyId)
        ? [
            [
              "manual-race:" + f.raceFamilyId,
              locale === "fr"
                ? f.nom_fr + " · traits manuels"
                : f.name_en + " · manual traits",
            ],
          ]
        : []),
    ];
  });
}
export const raceSelection = (d) =>
  d.raceId ?? (d.manualRace ? "manual-race:" + d.manualRace.familyId : "");
/** Metadata selection is playable as a declared origin, with no invented grants. */
export function selectRace(context, d, value, locale = "fr") {
  const family = RACE_FAMILIES.find((f) => value === "manual-race:" + f.slug);
  const entry = context.index.get(value);
  if (value && !family && entry?.type !== "race") throw Error("Unknown race");
  d.raceId = family ? null : value || null;
  d.manualRace = family ? { familyId: family.slug, variantId: null } : null;
  d.subraceId = null;
  delete d.manualSpeed;
  for (const [choiceId, values] of Object.entries(d.originSelections ?? {})) {
    if (choiceId.startsWith(d.backgroundId + ":")) continue;
    if (values.length)
      (d.retainedDecisions ??= []).push({
        kind: "origin",
        choiceId,
        values: [...values],
      });
    delete d.originSelections[choiceId];
  }
  d.originAdjustments = {};
  d.customOriginRequiresReview = !d.raceId;
  d.origin = family
    ? locale === "fr"
      ? family.nom_fr
      : family.name_en
    : (entry?.name[locale] ?? "");
  refreshPortrait(context, d);
}
export function manualRaceVariants(d) {
  const family = RACE_FAMILIES.find((f) => f.slug === d.manualRace?.familyId);
  if (!family) return [];
  return [
    ...family.sourceIds.map((sourceId) => ({
      raceFamilyId: family.slug,
      variantId: null,
      sourceId,
      sourceVersion: RULE_SOURCE_VERSIONS[sourceId] ?? "2014-compatible",
      rulesVersionId:
        family.slug +
        "/" +
        sourceId +
        "-" +
        (RULE_SOURCE_VERSIONS[sourceId] ?? "2014-compatible"),
      name: { fr: family.nom_fr, en: family.name_en },
    })),
    ...variants.filter((v) => v.raceFamilyId === family.slug),
  ];
}
export function selectRaceVariant(d, variantId, locale = "fr") {
  const v = manualRaceVariants(d).find((v) => v.rulesVersionId === variantId);
  if (variantId && !v) throw Error("Unknown race variant");
  d.manualRace.variantId = variantId || null;
  const f = RACE_FAMILIES.find((f) => f.slug === d.manualRace.familyId);
  d.origin = v
    ? v.name[locale] + " · " + v.sourceId + " " + v.sourceVersion
    : locale === "fr"
      ? f.nom_fr
      : f.name_en;
}
