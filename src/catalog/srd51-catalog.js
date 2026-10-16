import classes from "./data/classes.json" with { type: "json" };
import spells from "./data/spells.json" with { type: "json" };
import origins from "./data/origins.json" with { type: "json" };
import { createCatalogIndex } from "./catalog-v3.js";
export const classCatalog = classes;
export const spellCatalog = spells;
export const originCatalog = origins;
/** Call once per campaign load, then reuse the immutable index. */
export const loadSRD = () =>
  createCatalogIndex([classes, spells, origins], { distribution: "public" });
