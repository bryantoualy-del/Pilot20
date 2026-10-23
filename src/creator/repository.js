import {validateInventory} from './equipment-economy.js';
import {finishAdvancement} from './advancement.js';
import {sameDefinition} from './revision.js';
import {validateSpellbook, pinSpellbook} from '../spellbook/model.js';
import {validateGrantReplacements} from '../catalog/spell-grants.js';
import { isBuiltInPortrait, GENDERS } from "./appearance.js";
import { RACE_FAMILIES } from "../catalog/race-discovery.js";
import { manualRaceVariants } from "./race-selection.js";
import { EQUIPMENT, WEAPONS } from "../catalog/equipment.js";
import {
  check,
  json,
  id,
  ABILITIES,
  SKILLS,
  preferences,
} from "../character/contracts.js";
import { StorageError } from "../persistence/adapters.js";
import { validateCharacter } from "../character/definition.js";
export function validateDraft(d) {
  json(d);validateInventory(d);if(d.unequippedItems!==undefined)check(Array.isArray(d.unequippedItems)&&d.unequippedItems.length<=500&&d.unequippedItems.every(id),'Stowed equipment');
  if(d.pactRitualCopies!==undefined){check(Array.isArray(d.pactRitualCopies)&&d.pactRitualCopies.length<=500,'Pact ritual ledger');const seen=new Set();for(const row of d.pactRitualCopies){check(id(row.spellId)&&Number.isInteger(row.characterLevel)&&row.characterLevel>=1&&row.characterLevel<=20&&typeof row.note==='string'&&row.note.trim()&&row.note.length<=500&&!seen.has(row.spellId),'Pact ritual entry');seen.add(row.spellId);}}
  if(d.featRitualCopies!==undefined){check(Array.isArray(d.featRitualCopies)&&d.featRitualCopies.length<=500,'Ritual copy ledger');const seen=new Set();for(const row of d.featRitualCopies){check(row.featId==='phb14:feat:ritual-caster'&&id(row.spellId)&&Number.isInteger(row.characterLevel)&&row.characterLevel>=1&&row.characterLevel<=20&&typeof row.note==='string'&&row.note.trim()&&row.note.length<=500&&!seen.has(row.spellId),'Ritual copy entry');seen.add(row.spellId);}}
  if(d.companionNotes!==undefined)check(typeof d.companionNotes==='string'&&d.companionNotes.length<=3000,'Companion notes');
  if(d.hpMode!==undefined)check(['average','rolled'].includes(d.hpMode),'HP method');
  if(d.hpRolls!==undefined){check(d.hpRolls&&typeof d.hpRolls==='object'&&!Array.isArray(d.hpRolls)&&Object.keys(d.hpRolls).length<=400,'HP roll map');for(const [key,value]of Object.entries(d.hpRolls))check(id(key)&&Number.isInteger(value)&&value>=1&&value<=12,'HP die result');}
  if(d.startingEquipmentEnabled!==undefined)check(typeof d.startingEquipmentEnabled==='boolean','Starting equipment flag');
  if(d.startingEquipmentChoices!==undefined){check(d.startingEquipmentChoices&&typeof d.startingEquipmentChoices==='object'&&!Array.isArray(d.startingEquipmentChoices)&&Object.keys(d.startingEquipmentChoices).length<=100,'Starting equipment decisions');for(const [key,v]of Object.entries(d.startingEquipmentChoices))check(id(key)&&Array.isArray(v)&&v.length<=1&&v.every(id),'Starting equipment choice');}
  if(d.spellGrantReplacements!==undefined)validateGrantReplacements(d.spellGrantReplacements);
  check(
    d?.kind === "pilot20-creator-draft" &&
      d.schemaVersion === 1 &&
      id(d.id) &&
      id(d.campaignId) &&
      Number.isSafeInteger(d.revision) &&
      d.revision > 0,
    "Draft header",
  );
  check(
    ["single", "quick", "guided", "expert"].includes(d.mode) &&
      typeof d.name === "string" &&
      d.name.length <= 200 &&
      Array.isArray(d.classes) &&
      d.classes.length > 0 &&
      d.classes.length <= 20 &&
      d.classes.every(
        (c) =>
          id(c.id) &&
          Number.isInteger(c.level) &&
          c.level >= 1 &&
          c.level <= 20 &&
          (c.subclassId === null || id(c.subclassId)),
      ) &&
      new Set(d.classes.map((c) => c.id)).size === d.classes.length &&
      d.classes.reduce((n, c) => n + c.level, 0) <= 20,
    "Draft classes",
  );
  check(
    d.scores &&
      ABILITIES.every(
        (k) =>
          Number.isInteger(d.scores[k]) &&
          d.scores[k] >= 1 &&
          d.scores[k] <= 30,
      ) &&
      d.selections &&
      Object.values(d.selections).every((v) => Array.isArray(v) && v.every(id)),
    "Draft decisions",
  );
  check(
    typeof d.portrait === "string" &&
      d.portrait.length <= 10000 &&
      (!d.portrait ||
        isBuiltInPortrait(d.portrait) ||
        /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
          d.portrait,
        )),
    "Draft portrait",
  );
  check(
    d.background &&
      typeof d.background.name === "string" &&
      Array.isArray(d.background.skills) &&
      d.background.skills.every((k) => Object.hasOwn(SKILLS, k)) &&
      new Set(d.background.skills).size === d.background.skills.length &&
      Array.isArray(d.background.proficiencies) &&
      d.background.proficiencies.every(id),
    "Draft background",
  );
  for (const k of ["origin", "languages", "traits", "description", "step"])
    check(typeof d[k] === "string" && d[k].length <= 5000, "Draft text");
  for (const k of ["reviewed", "confirmed", "finalized", "shield"])
    check(typeof d[k] === "boolean", "Draft flags");
  check(
    Object.hasOwn(EQUIPMENT, d.equipment) &&
      ["draft", "review", "ready"].includes(d.status),
    "Draft equipment/status",
  );
  if (d.weapons !== undefined)
    check(
      Array.isArray(d.weapons) &&
        new Set(d.weapons).size === d.weapons.length &&
        d.weapons.every((v) => Object.hasOwn(WEAPONS, v)),
      "Draft weapons",
    );
  if (d.retainedDecisions !== undefined)
    check(
      Array.isArray(d.retainedDecisions) &&
        d.retainedDecisions.every(
          (r) =>
            ["class", "origin", "subclass"].includes(r.kind) &&
            id(r.choiceId) &&
            Array.isArray(r.values) &&
            r.values.every(id),
        ),
      "Retained decisions",
    );
  if (d.progressionAllocations !== undefined) check(d.progressionAllocations && typeof d.progressionAllocations==='object' && !Array.isArray(d.progressionAllocations) && Object.values(d.progressionAllocations).every(slots=>slots && typeof slots==='object' && !Array.isArray(slots) && Object.entries(slots).every(([level,values])=>Number.isInteger(Number(level))&&Number(level)>=1&&Number(level)<=20&&Array.isArray(values)&&values.every(id))), 'Draft progression allocations');
  if (d.physicalDetails !== undefined) check(d.physicalDetails && typeof d.physicalDetails === 'object' && !Array.isArray(d.physicalDetails) && Object.entries(d.physicalDetails).every(([key,value])=>['age','height','weight','gender','skin','hair','eyes','facialHair','marks'].includes(key)&&typeof value==='string'&&value.length<=200), 'Draft physical details');
  if (d.gender !== undefined) check(GENDERS.includes(d.gender), "Draft gender");
  if (d.manualSpeed !== undefined)
    check(
      Number.isInteger(d.manualSpeed) &&
        d.manualSpeed >= 0 &&
        d.manualSpeed <= 200,
      "Draft manual speed",
    );
  if (d.manualRace != null) {
    check(
      !d.raceId && RACE_FAMILIES.some((f) => f.slug === d.manualRace.familyId),
      "Draft manual race",
    );
    check(
      d.manualRace.variantId === null ||
        manualRaceVariants(d).some(
          (v) => v.rulesVersionId === d.manualRace.variantId,
        ),
      "Draft manual variant",
    );
  }
  if (d.raceId !== undefined)
    check(d.raceId === null || id(d.raceId), "Draft race");
  if (d.backgroundId !== undefined)
    check(d.backgroundId === null || id(d.backgroundId), "Draft background ID");
  if (d.subraceId !== undefined)
    check(d.subraceId === null || id(d.subraceId), "Draft subrace");
  if (d.scoresAreBase !== undefined)
    check(typeof d.scoresAreBase === "boolean", "Draft score mode");
  if (d.scoreMethod !== undefined)
    check(
      ["manual", "standard", "point-buy", "rolled"].includes(d.scoreMethod),
      "Draft score method",
    );
  if (d.originSelections !== undefined)
    check(
      d.originSelections &&
        Object.values(d.originSelections).every(
          (v) => Array.isArray(v) && v.every(id),
        ),
      "Draft origin decisions",
    );
  return d;
}
/** Drafts and UI preferences live in the existing meta store; writes retain CAS revision guards. */
export function creatorRepository(storage, library) {
  const key = (id) => "creator:draft:" + id;
  return {
    async list() {
      return (await storage.list("meta", "creator:draft:")).map((r) =>
        validateDraft(r.value),
      );
    },
    async get(id) {
      const r = await storage.get("meta", key(id));
      return r ? validateDraft(r) : null;
    },
    async save(d, { expectedRevision = null } = {}) {
      validateDraft(d);
      const old = await storage.get("meta", key(d.id));
      if (
        old
          ? old.revision !== expectedRevision ||
            d.revision !== expectedRevision + 1
          : expectedRevision !== null || d.revision !== 1
      )
        throw new StorageError("conflict");
      await storage.batch(
        [{ store: "meta", key: key(d.id), value: old }],
        [{ store: "meta", key: key(d.id), value: d }],
      );
      return structuredClone(d);
    },
    async remove(id, revision) {
      const old = await storage.get("meta", key(id));
      check(old?.revision === revision, "Draft revision conflict");
      await storage.batch(
        [{ store: "meta", key: key(id), value: old }],
        [{ store: "meta", key: key(id), delete: true }],
      );
    },
    async finalize(
      d,
      character,
      { expectedCharacterRevision = null, expectedDraftRevision, spellbook, expectedBaseDefinition } = {},
    ) {
      validateDraft(d);
      const old = await storage.get("meta", key(d.id));
      check(old?.revision === expectedDraftRevision, "Draft revision conflict");
      const existing=await library.get(d.id);
      if(existing)check(sameDefinition(existing.definition,old.buildBaseline??expectedBaseDefinition),"La fiche contient des modifications manuelles ou une version différente du plan. Enregistrez une copie pour les conserver.");
      const next = {
        ...finishAdvancement(d),
        buildBaseline:structuredClone(character),
        revision: old.revision + 1,
        finalized: true,
      };
      const result = await library.save(character, {
        expectedRevision: expectedCharacterRevision,
        ...(spellbook ? {spellbook} : {}),
        linkedMeta: [{ key: key(d.id), value: next, expectedValue: old }],
      });
      return { record: result, draft: next };
    },
    async duplicate(id) {
      const d = await this.get(id);
      check(d, "Unknown draft");
      d.id = crypto.randomUUID();
      d.revision = 1;
      d.name += " (2)";
      d.finalized = false;
      await this.save(d);
      return d;
    },
    async export(id) {
      const draft = await this.get(id),
        record = await library.get(id);
      check(draft || record, "Unknown character");
      return JSON.stringify({
        kind: "pilot20-creator-export",
        schemaVersion: 1,
        draft,
        character: record ? JSON.parse(await library.exportJSON(id)) : null,
      });
    },
    async import(raw) {
      check(typeof raw === "string" && raw.length <= 4000000, "Import size");
      const e = JSON.parse(raw);
      json(e);
      check(
        e.kind === "pilot20-creator-export" && e.schemaVersion === 1,
        "Creator export required",
      );
      const d = e.draft ? validateDraft(e.draft) : null;
      if (e.character) {
        validateCharacter(e.character.definition);
        if (e.character.spellbook) validateSpellbook(e.character.spellbook, e.character.definition);
      }
      check(d || e.character, "Empty export");
      if (d && e.character)
        check(d.id === e.character.definition.id, "Export identity");
      const cid = d?.id ?? e.character.definition.id;
      check(
        !(await this.get(cid)) && !(await library.get(cid)),
        "Import ID already exists",
      );
      if (e.character) {
        check(
          e.character.kind === "pilot20-character-export" &&
            e.character.preferences?.characterId === cid &&
            typeof e.character.archived === "boolean",
          "Character envelope",
        );
        preferences(e.character.preferences);
        const definition = structuredClone(e.character.definition);
        definition.revision = 1;
        if (d) d.revision = 1;
        await library.save(definition, {
          prefs: e.character.preferences,
          ...(e.character.spellbook ? {spellbook: pinSpellbook(e.character.spellbook,definition)} : {}),
          initialArchived: e.character.archived,
          linkedMeta: d
            ? [{ key: key(d.id), value: d, expectedValue: undefined }]
            : [],
        });
      } else if (d) {
        d.revision = 1;
        await this.save(d);
      }
      return cid;
    },
  };
}
