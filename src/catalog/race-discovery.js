import mechanicalVariants from "./data/race-variants.json" with { type: "json" };
import inventory from "./data/race-discovery.json" with { type: "json" };
const fold = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const RULE_SOURCE_VERSIONS = {
  phb14: "2014",
  volo: "2016",
  motm: "2022",
  eepc: "2015",
  scag: "2015",
  mtf: "2018",
  fizban: "2021",
  eberron: "2019",
  ravnica: "2018",
  theros: "2020",
  ravenloft: "2021",
  witchlight: "2021",
  strixhaven: "2021",
  spelljammer: "2022",
  dragonlance: "2022",
  wildemount: "2020",
  special: "2014-compatible",
};
const sourceKeys = {
  "PHB 2014": "phb14",
  Volo: "volo",
  MotM: "motm",
  EEPC: "eepc",
  SCAG: "scag",
  MToF: "mtf",
  Fizban: "fizban",
  Eberron: "eberron",
  Ravnica: "ravnica",
  Theros: "theros",
  "Van Richten": "ravenloft",
  Witchlight: "witchlight",
  Strixhaven: "strixhaven",
  Spelljammer: "spelljammer",
  Dragonlance: "dragonlance",
  Wildemount: "wildemount",
};
export const RACE_FAMILIES = inventory.families.map((f) => ({
  ...f,
  raceFamilyId: f.slug,
  visualAssetId: "race:" + f.slug,
  aliases: [f.nom_fr, f.name_en, f.slug],
  sourceIds: f.source.split(",").map((s) => sourceKeys[s.trim()] ?? "special"),
  sourceDocument: f.source,
  sourceVersion: "2014-compatible",
  license: "metadata-only",
  packId: null,
  variantId: null,
  automationCoverage: "unsupported",
}));
export const RACE_VARIANTS = inventory.variant_illustrations ?? [];
/** Discovery is metadata only. Selection always comes from the active catalogue. */
export function raceLibrary(
  context,
  { query = "", source = "", family = "", availability = "" } = {},
) {
  const known = RACE_FAMILIES.map((f) => {
    const matches = context.installed
      .list("race")
      .filter(
        (e) =>
          e.data.raceFamilyId === f.slug ||
          f.aliases.some((a) =>
            [e.name.fr, e.name.en, e.id.split(":").at(-1)].some(
              (n) => fold(n) === fold(a),
            ),
          ),
      );
    const versions = matches.map((e) => ({
      entry: e,
      available: !!context.index.get(e.id),
      rulesVersionId: e.data.rulesVersionId ?? e.id,
      packId: e.data.packId ?? null,
    }));
    return {
      ...f,
      mechanicalVariants: mechanicalVariants.filter(
        (v) => v.raceFamilyId === f.raceFamilyId,
      ),
      knownVersions: f.sourceIds.map((sourceId) => ({
        sourceId,
        rulesVersionId:
          f.slug + "/" + sourceId + "-" + RULE_SOURCE_VERSIONS[sourceId],
        sourceVersion: RULE_SOURCE_VERSIONS[sourceId],
        availability: "pack-missing",
        license: "metadata-only",
        visualAssetId: f.visualAssetId,
      })),
      versions,
      availability: versions.some((v) => v.available)
        ? "available"
        : versions.length
          ? "source-disabled"
          : "pack-missing",
    };
  });
  for (const e of context.installed.list("race"))
    if (!known.some((f) => f.versions.some((v) => v.entry.id === e.id)))
      known.push({
        slug: e.id,
        raceFamilyId: e.data.raceFamilyId ?? e.id,
        visualAssetId: e.data.visualAssetId ?? "custom",
        nom_fr: e.name.fr,
        name_en: e.name.en,
        aliases: e.data.aliases ?? [],
        source: e.source.document,
        sourceIds: [],
        versions: [
          {
            entry: e,
            available: !!context.index.get(e.id),
            rulesVersionId: e.data.rulesVersionId ?? e.id,
          },
        ],
        availability: context.index.get(e.id)
          ? e.source.kind === "homebrew"
            ? "homebrew"
            : "available"
          : "source-disabled",
      });
  return known.filter(
    (f) =>
      (!query ||
        fold([f.nom_fr, f.name_en, ...f.aliases].join(" ")).includes(
          fold(query),
        )) &&
      (!source || f.sourceIds.includes(source)) &&
      (!family || f.raceFamilyId === family) &&
      (!availability || f.availability === availability),
  );
}
export function raceMetadata(f, sourceId, version) {
  return {
    raceFamilyId: f.slug,
    variantId: null,
    rulesVersionId: version,
    sourceDocument: f.source,
    sourceVersion: version,
    license: "private-reference",
    packId: null,
    availability: "pack-missing",
    automationCoverage: "unsupported",
    visualAssetId: f.visualAssetId,
    aliases: f.aliases,
  };
}
