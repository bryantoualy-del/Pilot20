import { assertItem, copyItem, parseImport, safeImage } from "./model.js";
const prefix = "forge:item:";
/** Uses the existing transactional adapter, without migrating or touching characters. */
export function forgeRepository(storage) {
  return {
    async list() {
      return (await storage.list("meta", prefix))
        .map((r) => r.value)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async get(id) {
      return storage.get("meta", prefix + id);
    },
    async save(
      definition,
      { expectedRevision = null, illustration = null } = {},
    ) {
      assertItem(definition);
      if (illustration !== null && !safeImage(illustration))
        throw Error("Illustration non valide.");
      const key = prefix + definition.id,
        old = await storage.get("meta", key);
      if ((old?.revision ?? null) !== expectedRevision)
        throw Error("Conflit de sauvegarde. Rouvrez cet objet.");
      const value = {
        definition: structuredClone(definition),
        illustration,
        revision: (old?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      await storage.batch(
        [{ store: "meta", key, value: old }],
        [{ store: "meta", key, value }],
      );
      return value;
    },
    async import(text) {
      const rows = parseImport(text),
        writes = rows.map((row) => {
          const definition = copyItem(row.definition);
          return {
            store: "meta",
            key: prefix + definition.id,
            value: {
              definition,
              illustration: row.illustration,
              revision: 1,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      await storage.batch(
        writes.map((w) => ({ store: w.store, key: w.key, value: undefined })),
        writes,
      );
      return writes.map((w) => w.value);
    },
  };
}
