/** Original contract-only private fixture. It is NOT any published D&D subclass. */
const source = {
  kind: "private",
  document: "Original Pilot20 browser test",
  license: "test-only",
  url: "",
};
const automation = {
  status: "manual",
  handler: null,
  limits: ["Original fixture; not official published rules."],
};
export const originalPack = {
  kind: "pilot20-private-rule-pack",
  schemaVersion: 1,
  sourceId: "xge",
  catalog: {
    kind: "catalog",
    schemaVersion: 3,
    ruleset: "dnd5e-2014",
    id: "original:browser-test",
    items: [
      {
        id: "original:college",
        type: "subclass",
        name: { fr: "Collège original de test", en: "Original test college" },
        source,
        data: {
          ruleset: "dnd5e-2014",
          automation,
          classId: "bard",
          grants: [{ level: 3, featureIds: ["original:echo"] }],
          choices: [
            {
              key: "original-instrument",
              level: 3,
              kind: "proficiency",
              count: 1,
              options: ["original:drum", "original:bell"],
            },
          ],
        },
      },
      {
        id: "original:echo",
        type: "feature",
        name: { fr: "Écho original", en: "Original echo" },
        source,
        data: {
          ruleset: "dnd5e-2014",
          automation,
          classId: "bard",
          minimumClassLevel: 3,
          resources: [
            {
              id: "original-echo",
              recovery: "long",
              maxByLevel: Array(20).fill(2),
            },
          ],
          manualMechanics: {
            economy: "bonus",
            target: "self",
            maxTargets: 1,
            resourceId: "original-echo",
            amount: 1,
            requirements: ["Original test resolution"],
          },
        },
      },
    ],
  },
};
