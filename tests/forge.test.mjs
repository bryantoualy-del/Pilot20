import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  newItem,
  effect,
  assertItem,
  newAbility,
  newResource,
  copyItem,
  instanceOf,
  exportItems,
  categories,
  parseImport,
} from "../src/forge/model.js";
import { forgeRepository } from "../src/forge/repository.js";
import { MemoryStorage, openIndexedDB } from "../src/persistence/adapters.js";
import { indexedDB } from "fake-indexeddb";
import {
  itemSource,
  resolvePassive,
  validateLoadout,
  spendResource,
  recoverResource,
  conditionMet,
  shieldAC,
} from "../src/forge/engine.js";
const cc = JSON.parse(
  fs.readFileSync(
    new URL(
      "../src/forge/catalog/compagnie-creole.items.json",
      import.meta.url,
    ),
  ),
);
const get = (name) => structuredClone(cc.find((i) => i.name.fr === name));
function active(d) {
  return { ...instanceOf(d, "character"), equipped: true, attuned: true };
}
test("catalogue original and all new categories validate against the unchanged schema", () => {
  const official = JSON.parse(
    fs.readFileSync(
      new URL("../src/forge/catalog/official.items.json", import.meta.url),
    ),
  );
  for (const d of [...official, ...cc, ...Object.keys(categories).map(newItem)])
    assertItem(d);
});
test("edit, reload, copy, export/import preserve definitions and do not touch characters", async () => {
  const storage = new MemoryStorage(),
    r = forgeRepository(storage),
    item = newItem("shield");
  item.effects.push(
    effect("modifier", {
      stat: "ac",
      value: 3,
      operation: "add",
      scope: "wearer",
    }),
  );
  const first = await r.save(item);
  item.name.fr = "Test";
  await r.save(item, { expectedRevision: first.revision });
  const loaded = await forgeRepository(storage).get(item.id);
  assert.equal(loaded.definition.name.fr, "Test");
  assert.deepEqual(parseImport(exportItems([loaded]))[0].definition, item);
  const imported = await r.import(exportItems([loaded]));
  assert.notEqual(imported[0].definition.id, item.id);
  assert.equal((await r.list()).length, 2);
  assert.equal((await storage.list("characters")).length, 0);
  await assert.rejects(
    r.save(item, { expectedRevision: first.revision }),
    /Conflit/,
  );
  await assert.rejects(r.import('{"id":"bad"}'), /conforme/);
  assert.equal((await r.list()).length, 2);
});
test("IndexedDB persists across close/reopen and failed write is not published", async () => {
  const name = "forge-test-" + crypto.randomUUID();
  let db = await openIndexedDB(name, { indexedDB });
  const item = newItem();
  await forgeRepository(db).save(item);
  db.close();
  db = await openIndexedDB(name, { indexedDB });
  assert.equal((await forgeRepository(db).list()).length, 1);
  db.close();
  const m = new MemoryStorage();
  m.failNext("quota");
  await assert.rejects(forgeRepository(m).save(item));
  assert.equal((await forgeRepository(m).list()).length, 0);
});
test("Brack: +2, 2d8 fire, resistance, exact breath and unresolved aura", () => {
  const d = get("PyroMerlin"),
    i = active(d),
    s = itemSource(d, i);
  const resolved = resolvePassive([s, s]);
  assert.equal(resolved.bonuses["attack:this-weapon:" + i.instanceId], 2);
  assert.deepEqual(resolved.resistances, ["fire"]);
  assert.ok(
    d.effects.some(
      (e) => e.params.dice === "2d8" && e.params.damageType === "fire",
    ),
  );
  const b = d.abilities.find((a) => a.id === "souffle");
  assert.equal(b.activation, "action");
  assert.equal(b.area.size, 9);
  assert.equal(b.save.dc.value, 16);
  assert.equal(b.save.success, "half-damage");
  assert.equal(b.effects[0].params.dice, "6d6");
  assert.equal(
    d.abilities.find((a) => a.id === "aura").effects[0].params.damageType,
    null,
  );
  const spent = spendResource(d, i, "souffle");
  assert.equal(spent.resources.souffle, 0);
  assert.equal(i.resources.souffle, 1);
  assert.throws(() => spendResource(d, spent, "souffle"), /insuffisantes/);
  assert.throws(
    () => recoverResource(d, spent, "souffle", "dawn", 1),
    /confirmer/,
  );
});
test("Kentaro: weapon-scoped +1, no inferred fire or Charisma/class bonus", () => {
  const d = get("Kane"),
    s = itemSource(d, active(d), { event: "on-hit" });
  assert.equal(
    resolvePassive([s]).bonuses["attack:this-weapon:" + s.sourceId],
    1,
  );
  assert.ok(s.pending.some((p) => p.reason === "Type de dégâts inconnu"));
  assert.equal(
    d.effects.find((e) => e.params.role === "additional").params.damageType,
    null,
  );
  assert.equal(resolvePassive([s]).bonuses["attack:wearer"], undefined);
});
test("Nans: unresolved mode coexistence never applies all forms", () => {
  const d = get("Volto-Fendoir"),
    i = active(d);
  i.modeIds = ["sword", "axe", "shield"];
  const s = itemSource(d, i);
  assert.equal(s.contributions.length, 0);
  assert.ok(s.pending.length);
  assert.equal(
    d.modes.find((m) => m.id === "shield").effects[0].params.value,
    2,
  );
  d.modes.forEach((m) => (m.exclusiveGroup = "forme"));
  assert.equal(itemSource(d, i).contributions.length, 0);
  i.modeIds = ["axe"];
  assert.equal(itemSource(d, i).contributions[0].effect.params.dice, "1d12");
});
test("Rufus: 5 charges, 1d4+1 at dawn, DD15 and manual activation retained", () => {
  const d = get("Hexen Blade"),
    i = active(d);
  assert.equal(i.resources.charges, 5);
  assert.equal(d.resources[0].recovery.formula, "1d4+1");
  assert.deepEqual(
    d.abilities.map((b) => b.costs[0].amount),
    [1, 2, 3],
  );
  assert.ok(d.abilities.every((b) => b.effects[0].params.dc.value === 15));
  assert.ok(itemSource(d, i).actions.every((a) => a.manual && !a.available));
  assert.throws(() => spendResource(d, i, "hypnotic-pattern"), /confirmer/);
  i.resources.charges = 1;
  assert.equal(
    recoverResource(d, i, "charges", "dawn", 5).resources.charges,
    5,
  );
});
test("Samoth: 10 charges, two uncertain spell labels, recovery time not invented", () => {
  const d = get("Bâton Givre confluence"),
    i = active(d);
  assert.equal(i.resources.charges, 10);
  assert.deepEqual(
    d.abilities.map((b) => b.costs[0].amount),
    [1, 3],
  );
  assert.equal(d.resources[0].recovery.formula, "1d6+4");
  assert.throws(() => recoverResource(d, i, "charges", "dawn", 6), /confirmer/);
  assert.equal(d.effects.length, 0);
  assert.ok(itemSource(d, i).actions.every((a) => a.manual));
});
test("Zéphyr: shield base 2 plus magic 3 only once, only while equipped", () => {
  const d = get("Bouclier magique +3"),
    i = active(d),
    s = itemSource(d, i),
    passive = resolvePassive([s, s]);
  assert.equal(2 + passive.bonuses["ac:wearer"], 5);
  assert.equal(shieldAC(d, i, 18).ac, 23);
  i.equipped = false;
  assert.equal(itemSource(d, i).contributions.length, 0);
  i.equipped = true;
  i.consumed = true;
  assert.equal(itemSource(d, i).contributions.length, 0);
});
test("ability floor, manual conditions, restrictions and equipment limits", () => {
  const d = newItem("belt");
  d.effects.push(
    effect("ability-score", { ability: "str", operation: "floor", value: 21 }),
  );
  const i = active(d);
  assert.equal(
    resolvePassive([itemSource(d, i)], { scores: { str: 23 } }).scores.str,
    23,
  );
  assert.equal(
    resolvePassive([itemSource(d, i)], { scores: { str: 12 } }).scores.str,
    21,
  );
  d.effects[0].conditions = [{ op: "manual", text: "En rage" }];
  assert.equal(itemSource(d, i).contributions.length, 0);
  assert.equal(
    conditionMet({ op: "class-level", classId: "warlock", minimum: 3 }, i, {
      classes: { warlock: 10 },
    }),
    true,
  );
  const weapon = newItem();
  weapon.equipment.hands = 2;
  const shield = newItem("shield");
  assert.ok(
    validateLoadout([
      { definition: weapon, instance: active(weapon) },
      { definition: shield, instance: active(shield) },
    ]).includes("Plus de deux mains nécessaires"),
  );
  const four = Array.from({ length: 4 }, () => ({
    definition: d,
    instance: active(d),
  }));
  assert.ok(validateLoadout(four).includes("Limite d’harmonisation dépassée"));
  assert.ok(
    !validateLoadout(four, { attunementLimit: 4 }).includes(
      "Limite d’harmonisation dépassée",
    ),
  );
});
test("no execution of free text and invalid imports are atomic", async () => {
  const d = newItem();
  d.effects.push(
    effect("custom", {
      key: "forge:custom",
      summary: "Ajouter +100 CA",
      payload: {},
      fallback: "manual",
    }),
  );
  assertItem(d);
  assert.deepEqual(resolvePassive([itemSource(d, active(d))]).bonuses, {});
  const repo = forgeRepository(new MemoryStorage());
  await assert.rejects(repo.import(JSON.stringify([d, { id: "bad" }])));
  assert.equal((await repo.list()).length, 0);
});
test("complete creation in every category: powers, charges, modes survive persistence", async () => {
  const repo = forgeRepository(new MemoryStorage());
  for (const category of Object.keys(categories)) {
    const d = newItem(category);
    d.name.fr = categories[category] + " de test";
    d.description.fr = "Description originale.";
    d.rarity = "rare";
    const r = newResource(),
      a = newAbility();
    a.effects = [effect("healing", { dice: "1d8" })];
    a.costs = [{ resourceId: r.id, amount: 1, timing: "on-use" }];
    d.resources = [r];
    d.abilities = [a];
    d.modes = [
      {
        id: "one",
        name: { fr: "Forme unique", en: null },
        exclusiveGroup: "forme",
        baseItemId: null,
        properties: [],
        effects: [],
      },
    ];
    await repo.save(d);
    const saved = await repo.get(d.id);
    assert.deepEqual(parseImport(exportItems([saved]))[0].definition, d);
  }
  assert.equal((await repo.list()).length, Object.keys(categories).length);
});
test("two different weapons keep separate attack modifiers; identical shields do not stack", () => {
  const sword = newItem();
  sword.effects.push(
    effect("modifier", {
      stat: "attack",
      value: 1,
      operation: "add",
      scope: "this-weapon",
    }),
  );
  const other = copyItem(sword),
    a = active(sword),
    b = active(other),
    r = resolvePassive([itemSource(sword, a), itemSource(other, b)]);
  assert.equal(r.bonuses["attack:this-weapon:" + a.instanceId], 1);
  assert.equal(r.bonuses["attack:this-weapon:" + b.instanceId], 1);
  const shield = get("Bouclier magique +3"),
    copy = copyItem(shield);
  assert.equal(
    resolvePassive([
      itemSource(shield, active(shield)),
      itemSource(copy, active(copy)),
    ]).bonuses["ac:wearer"],
    3,
  );
});
test("resource costs honor trigger phase and double shields are rejected", () => {
  const d = newItem(),
    r = newResource(),
    a = newAbility();
  a.costs = [{ resourceId: r.id, amount: 2, timing: "on-hit" }];
  d.resources = [r];
  d.abilities = [a];
  const i = active(d);
  assert.equal(spendResource(d, i, a.id).resources[r.id], 5);
  assert.equal(
    spendResource(d, i, a.id, { timing: "on-hit" }).resources[r.id],
    3,
  );
  const shield = newItem("shield");
  assert.ok(
    validateLoadout([
      { definition: shield, instance: active(shield) },
      { definition: shield, instance: active(shield) },
    ]).some((x) => x.includes("Un seul bouclier")),
  );
});
