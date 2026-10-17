import genders from "../catalog/data/race-portraits.json" with { type: "json" };
import { raceLibrary } from "../catalog/race-discovery.js";
export const GENDERS = ["", "femme", "homme"];
export function raceFamily(context, d) {
  return (
    d.manualRace?.familyId ??
    raceLibrary(context).find((f) =>
      f.versions.some((v) => v.entry.id === d.raceId),
    )?.raceFamilyId ??
    null
  );
}
export function portraitAsset(familyId, gender = "") {
  if (!Object.hasOwn(genders, familyId) || !GENDERS.includes(gender)) return "";
  const suffix = gender && gender !== genders[familyId] ? "-" + gender : "";
  return `./assets/shared/races/${familyId}${suffix}.webp`;
}
const portraits = new Set(
  Object.keys(genders).flatMap((f) => GENDERS.map((g) => portraitAsset(f, g))),
);
export const isBuiltInPortrait = (value) => portraits.has(value);
/** Imported portraits are never replaced by a race or gender change. */
export function refreshPortrait(context, d, { force = false } = {}) {
  if (!force && d.portrait && !isBuiltInPortrait(d.portrait)) return;
  d.portrait = portraitAsset(raceFamily(context, d), d.gender ?? "");
}
