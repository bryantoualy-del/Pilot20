import {physicalDescription} from "./portrait-prompt.js";
import {economy,compileInventory} from './equipment-economy.js';
import {validateLevelGain} from './advancement.js';
import {hitPointPlan} from './hit-points.js';
import {startingEquipment,compileStartingEquipment,startingProficiencies} from './starting-equipment.js';
import {spellbookFromBuild} from '../spellbook/model.js';
import {
  EQUIPMENT,
  ARMORS,
  WEAPONS,
  weaponProfile,
  SRD_SOURCE,
} from "../catalog/equipment.js";
export { EQUIPMENT } from "../catalog/equipment.js";
import { check, ABILITIES, SKILLS } from "../character/contracts.js";
import { resolveProgression } from "../catalog/progression.js";
import {
  buildCampaignCharacter,
  validateSavedPlan,
} from "../campaign/sources.js";
import {
  derive,
  hitPointTotal,
} from "../character/derive.js";
import { validateCharacter, validateBuild } from "../character/definition.js";
export const newDraft = (campaignId = "default", id = crypto.randomUUID()) => ({
  kind: "pilot20-creator-draft",
  schemaVersion: 1,
  id,
  campaignId,
  revision: 1,
  mode: "single",
  classChosen: false,
  startingEquipmentVersion:2,
  equipmentMethod:'kit',
  inventoryLedger:[],
  name: "",
  portrait: "",
  gender: "",
  manualRace: null,
  classes: [{ id: "fighter", level: 1, subclassId: null }],
  scores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  selections: {},
  background: { name: "", skills: [], proficiencies: [] },
  origin: "",
  languages: "",
  traits: "",
  description: "",
  equipment: "none",
  shield: false,
  reviewed: false,
  confirmed: false,
  step: "race",
  scoresAreBase: true,
  scoreMethod: "manual",
  originSelections: {},
  finalized: false,
  status: "draft",
  advancementHistory: [],
});
const customSource = {
  kind: "homebrew",
  document: "Player declared origin and equipment; GM reviewed",
  license: "user-data",
  url: "",
};
export function buildRequest(d) {
  return {
    raceId: d.raceId ?? null,
    subraceId: d.subraceId ?? null,
    backgroundId: d.backgroundId ?? null,
    originSelections: structuredClone(d.originSelections ?? {}),
    originAdjustments: structuredClone(d.originAdjustments ?? {}),
    scoresAreBase: d.scoresAreBase ?? false,
    scoreMethod: d.scoreMethod ?? "manual",
    scoreRolls: d.scoreRolls ?? null,
    id: d.id,
    name: d.name,
    sourceReferences: structuredClone(d.sourceReferences ?? []),
    classes: structuredClone(d.classes),
    scores: structuredClone(d.scores),
    selections: structuredClone(d.selections),
    background: structuredClone(d.background),
    advancementHistory: [...structuredClone(d.advancementHistory??[]),...(d.pendingAdvancement&&d.advancementHistory?.length?[{classId:d.pendingAdvancement.classId,classes:structuredClone(d.classes),selections:structuredClone(d.selections)}]:[])],
    spellbookTranscriptions: structuredClone(d.spellbookTranscriptions ?? []),
    pactRitualCopies:structuredClone(d.pactRitualCopies??[]),
    featRitualCopies:structuredClone(d.featRitualCopies??[]),
    spellGrantReplacements:structuredClone(d.spellGrantReplacements??[]),
    hpMode:d.hpMode??'average',
    hpProgression:null,
  };
}
export function draftProgression(context, config, d) {
  const unavailable = validateSavedPlan(context, d);
  if (unavailable.issues.some((i) => i.code === "unavailable-class"))
    return { ...unavailable, choices: [], features: [], resources: [] };
  try {
    const report = resolveProgression(context.index, {
      ...buildRequest(d),
      classes: d.classes.map((c) => ({
        ...c,
        subclassId:
          context.index.get(c.subclassId) &&
          c.level >= (context.index.class(c.id)?.data.subclassLevel ?? 99)
            ? c.subclassId
            : null,
      })),
      campaignOptions: config.enabledOptions,
    });
    const gear=startingEquipment(d,startingProficiencies(context.index,d,report)),hp=hitPointPlan(context.index,d);
    return {
      ...report,
      startingEquipment:gear,
      economy:economy(d),
      hitPoints:hp,
      hpPreview:hp.valid?
        hitPointTotal(
          hp.progression,
          report.scores,
        ) + (report.featureHpBonus??0) +
        (report.origin?.hpPerLevel ?? 0) *
          d.classes.reduce((n, c) => n + c.level, 0):null,
      valid:
        report.valid && gear.valid && hp.valid && economy(d).valid &&
        unavailable.valid &&
        !d.classes.some(
          (c) =>
            c.subclassId &&
            c.level < (context.index.class(c.id)?.data.subclassLevel ?? 99),
        ),
      issues: [
        ...((d.selections['ranger:beast-companion']??[]).includes('phb14:ranger:companion:other')&&!d.companionNotes?.trim()?[{code:'creator-companion',choiceId:'ranger:beast-companion'}]:[]),
        ...unavailable.issues,
        ...report.issues,
        ...gear.issues,
        ...economy(d).issues,
        ...hp.issues,
        ...d.classes
          .filter(
            (c) =>
              c.subclassId &&
              c.level < (context.index.class(c.id)?.data.subclassLevel ?? 99),
          )
          .map((c) => ({ code: "inactive-subclass", id: c.subclassId })),
      ],
    };
  } catch {
    return {
      valid: false,
      issues: [{ code: "invalid-build" }],
      choices: [],
      features: [],
      resources: [],
    };
  }
}
/** UI orchestration only: all progression and statistics are produced by existing authorities. */
export function compileDraft(context, config, d) {
  const issues = [];
  if((d.selections['ranger:beast-companion']??[]).includes('phb14:ranger:companion:other')&&!d.companionNotes?.trim())return{valid:false,character:null,issues:[{code:'creator-companion',choiceId:'ranger:beast-companion'}],status:'draft'};
  if(d.pendingAdvancement){const transition=validateLevelGain(context.index,{...buildRequest(d),campaignOptions:config.enabledOptions},d.pendingAdvancement);if(transition.length)return{valid:false,character:null,issues:transition,status:'draft'};}
  const hp=hitPointPlan(context.index,d);
  if(!hp.valid)return {valid:false,character:null,issues:hp.issues,status:'draft'};
  if (!d.name.trim()) issues.push({ code: "creator-name" });
  if (
    (!d.raceId && !d.origin.trim()) ||
    (!d.backgroundId && !d.background.name.trim())
  )
    issues.push({ code: "creator-origin" });
  if (!d.backgroundId && d.background.skills.length !== 2)
    issues.push({ code: "creator-background-skills" });
  if (!d.confirmed) issues.push({ code: "creator-confirmation" });
  let r;
  try {
    r = buildCampaignCharacter(context,{...buildRequest(d),hpProgression:d.hpMode==='rolled'?hp.progression:null},config);
  } catch {
    r = {
      valid: false,
      character: null,
      issues: [{ code: "invalid-build" }],
      manualRequirements: [],
    };
  }
  issues.push(...r.issues);
  if (!r.character || issues.length)
    return { ...r, valid: false, character: null, issues, status: "draft" };
  const c = r.character;
  const gear=startingEquipment(d,c.proficiencies);
  if(!gear.valid)return {...r,character:null,valid:false,issues:gear.issues,status:'draft'};
  if(d.startingEquipmentEnabled===true)for(const item of r.origin?.equipment??[]){const row=c.equipment.find(e=>e.id==='background:'+item.id);if(row&&item.name){row.name=structuredClone(item.name);row.quantity=1;}}
  const money=economy(d);if(!money.valid)return{...r,character:null,valid:false,issues:money.issues,status:'draft'};
  if(money.wealth||gear.backgroundItems)c.equipment=c.equipment.filter(e=>!e.id.startsWith('background:'));
  if(!money.wealth&&gear.backgroundItems)for(const item of gear.backgroundItems){const weapon=weaponProfile(item.id,c.scores,c.proficiencies);c.equipment.push({id:'background:'+item.id,name:item.name,quantity:item.quantity,kind:weapon?'weapon':'item',weapon,armor:null,equipped:!!weapon,source:context.index.get(d.backgroundId)?.source??SRD_SOURCE});}
  c.equipment.push(...compileStartingEquipment(d,c),...compileInventory(d,c));
  if ((d.customOriginRequiresReview || d.background.customized) && !d.reviewed)
    issues.push({ code: "creator-custom-review" });
  if (issues.length)
    return { ...r, valid: false, character: null, issues, status: "draft" };
  c.identity = {
    name: d.name,
    portrait: d.portrait,
    gender: d.gender ?? "",
    description: [
      d.description,
      physicalDescription(d),
      context.index.get(d.raceId)?.data.homebrewDefinition?.description,
      context.index.get(d.raceId)?.data.homebrewDefinition?.appearance,
      d.origin,
      d.manualRace
        ? "Traits et bonus de race à renseigner et vérifier manuellement."
        : "",
      d.languages,
      d.traits,
      d.equipmentNotes,
      d.companionNotes,
      d.background.feature,
    ]
      .filter(Boolean)
      .join("\n"),
  };
  if (!d.raceId)
    c.ancestry = {
      id: d.manualRace
        ? "user:race:" + d.manualRace.familyId
        : "user:custom-origin",
      subraceId: null,
      source: customSource,
    };
  if (d.manualRace && d.manualSpeed !== undefined)
    c.movement.walk = d.manualSpeed;
  if (d.equipment !== "none") {
    check(Object.hasOwn(EQUIPMENT, d.equipment), "Equipment profile");
    c.equipment.push({
      id: "user:armor",
      kind: "armor",
      equipped: true,
      armor: structuredClone(EQUIPMENT[d.equipment]),
      weapon: null,
      source: customSource,
    });
  }
  if (d.shield)
    c.equipment.push({
      id: "user:shield",
      kind: "shield",
      equipped: true,
      armor: { base: 2, dexCap: 0, bonus: 0, minStrength: 0, heavy: false },
      weapon: null,
      source: customSource,
    });
  for (const id of d.weapons ?? []) {
    check(WEAPONS[id], "Unknown weapon");
    c.equipment.push({
      id: "srd51:weapon:" + id,
      kind: "weapon",
      equipped: true,
      armor: null,
      weapon: weaponProfile(id, c.scores, c.proficiencies),
      source: SRD_SOURCE,
    });
  }
  if(c.features.includes('phb14:feat:medium-armor-master'))for(const e of c.equipment.filter(e=>e.kind==='armor')){const type=ARMORS[e.id.split(':').at(-1)]?.category;if(type==='medium')e.armor.dexCap=3;}
  if(c.features.includes('srd51:monk:martial-arts')&&!c.equipment.some(e=>e.equipped&&['armor','shield'].includes(e.kind))){
    const die=r.scaling.monk.martialArtsDie,kensei=new Set(Object.entries(d.selections).filter(([key])=>(key.startsWith('monk:kensei-')&&key!=='monk:kensei-art'||key==='monk:dedicated-weapon')).flatMap(([,v])=>v));
    for(const e of c.equipment.filter(e=>e.weapon)){const id=e.id.split(':').at(-1),w=WEAPONS[id];if(!w)continue;const monkWeapon=w.category==='simple'&&!w.ranged&&!['greatclub'].includes(id)||id==='shortsword'||kensei.has(w.proficiency);if(!monkWeapon)continue;if(c.scores.dex>c.scores.str)e.weapon.ability='dex';const m=/^1d(\d+)$/.exec(e.weapon.dice);if(m&&Number(m[1])<die)e.weapon.dice='1d'+die;}
  }
  for(const item of c.equipment)if((d.unequippedItems??[]).includes(item.id))item.equipped=false;
  if(r.origin?.race?.data.armorProhibited&&c.equipment.some(e=>e.equipped&&e.kind==='armor'))return{...r,valid:false,character:null,equipmentPreview:c.equipment,issues:[{code:'racial-armor-prohibited'}],status:'draft'};
  if(['armor','shield'].some(kind=>c.equipment.filter(e=>e.equipped&&e.kind===kind).length>1))return{...r,valid:false,character:null,equipmentPreview:c.equipment,issues:[{code:'equipment-conflict'}],status:'draft'};
  validateCharacter(c);
  check(validateBuild(c).valid, "Creator modifiers invalid");
  const stats = derive(c);
  return {
    ...r,
    character: c,
    stats,
    spellbook: spellbookFromBuild(context.index, c, r, d),
    valid: true,
    issues: [],
    status: d.reviewed ? "ready" : "review",
    manualRequirements: [
      ...(r.manualRequirements ?? []),
      {
        reason:
          "Origin traits, final ability scores, background, equipment proficiency and historical acquisition require explicit GM review.",
      },
    ],
  };
}
const priorities = {
  fighter: ["str", "con", "dex", "wis", "int", "cha"],
  barbarian: ["str", "con", "dex", "wis", "cha", "int"],
  rogue: ["dex", "con", "cha", "wis", "int", "str"],
  bard: ["cha", "dex", "con", "wis", "int", "str"],
  wizard: ["int", "con", "dex", "wis", "cha", "str"],
  cleric: ["wis", "con", "str", "dex", "cha", "int"],
  druid: ["wis", "con", "dex", "int", "cha", "str"],
  sorcerer: ["cha", "con", "dex", "wis", "int", "str"],
  warlock: ["cha", "con", "dex", "wis", "int", "str"],
  paladin: ["str", "cha", "con", "wis", "dex", "int"],
  ranger: ["dex", "wis", "con", "str", "int", "cha"],
  monk: ["dex", "wis", "con", "str", "int", "cha"],
};
export function templateScores(classId) {
  return Object.fromEntries(
    (priorities[classId] ?? (classId==='artificer'?['int','con','dex','wis','str','cha']:ABILITIES)).map((k, i) => [
      k,
      [15, 14, 13, 12, 10, 8][i],
    ]),
  );
}
/** Explicit user-invoked suggestions, never auto-finalize or replace nonempty decisions. */
export const CREATION_MODELS = ["balanced", "support", "offensive"];
const modelPreferences = {
  balanced: [
    "athletics",
    "perception",
    "insight",
    "arcana",
    "stealth",
    "persuasion",
    "srd51:fighter:defense",
    "srd51:healing-word",
    "srd51:fire-bolt",
    "srd51:mage-hand",
    "srd51:minor-illusion",
    "srd51:light",
    "srd51:magic-missile",
    "srd51:shield",
    "srd51:detect-magic",
    "srd51:heroism",
    "srd51:faerie-fire",
    "srd51:invisibility",
    "srd51:shatter",
    "srd51:dispel-magic",
    "srd51:hypnotic-pattern",
    "srd51:fireball",
    "srd51:haste",
    "srd51:counterspell",
    "srd51:revivify",
  ],
  support: [
    "persuasion",
    "insight",
    "perception",
    "srd51:healing-word",
    "srd51:cure-wounds",
    "srd51:heroism",
    "srd51:bless",
    "srd51:faerie-fire",
    "srd51:light",
    "srd51:mage-hand",
    "srd51:invisibility",
    "srd51:dispel-magic",
    "srd51:hypnotic-pattern",
    "srd51:haste",
    "srd51:counterspell",
    "srd51:revivify",
  ],
  offensive: [
    "athletics",
    "stealth",
    "perception",
    "srd51:fire-bolt",
    "srd51:ray-of-frost",
    "srd51:magic-missile",
    "srd51:burning-hands",
    "srd51:thunderwave",
    "srd51:shatter",
    "srd51:fireball",
    "srd51:lightning-bolt",
    "srd51:haste",
  ],
};
export function suggestChoices(
  context,
  config,
  input,
  { preserveIdentity = false } = {},
) {
  const d = structuredClone(input);
  for (let pass = 0; pass < 5; pass++) {
    // Resolve dependent ancestry decisions before proposing ASIs. Native flexible
    // bonuses can appear only after their distribution has been selected.
    for(let n=0;n<100;n++){
      const q=(draftProgression(context,config,d).origin?.choices??[]).find(q=>!d.originSelections?.[q.id]?.length&&q.options.length>=q.count);
      if(!q)break;
      d.originSelections??={};d.originSelections[q.id]=q.options.slice(0,q.count);
    }
    const r = draftProgression(context, config, d);
    for(const q of r.startingEquipment?.choices??[])if(!d.startingEquipmentChoices?.[q.id]?.length){d.startingEquipmentChoices??={};d.startingEquipmentChoices[q.id]=[q.options[0].id];}
    const usedSkills = new Set(r.origin?.background.skills ?? d.background.skills),
      usedExpertise = new Set(),
      features = new Set(),
      spells = new Map(),
      groups = new Map();
    for (const q of r.origin?.choices ?? []) {
      d.originSelections ??= {};
      if (!d.originSelections[q.id]?.length) {
        const current =
          draftProgression(context, config, d).origin?.choices.find(
            (v) => v.id === q.id,
          ) ?? q;
        d.originSelections[q.id] = current.options.slice(0, current.count);
      }
    }
    for (const planned of r.choices) {
      const q=['proficiency','expertise'].includes(planned.kind)&&!d.selections[planned.id]?.length?(draftProgression(context,config,d).choices.find(q=>q.id===planned.id)??planned):planned;
      if (
        q.kind === "subclass" ||
        (preserveIdentity &&
          [
            "spell",
            "spellbook",
            "prepared",
            "asi",
            "feature",
            "metamagic",
            "invocation",
          ].includes(q.kind))
      )
        continue;
      const current = d.selections[q.id] ?? [],
        spellSet = spells.get(q.classId) ?? new Set(),
        group = groups.get(q.distinctGroup) ?? new Set();
      if (!current.length) {
        let options = q.options.filter(
          (v) =>
            (!["skill","training"].includes(q.kind) || !usedSkills.has(v)) &&
            (q.kind !== "expertise" || !usedExpertise.has(v)) &&
            (q.kind !== "feature" || !features.has(v)&&![...features].some(id=>{const key=context.index.get(v)?.data.uniqueRuleKey;return key&&context.index.get(id)?.data.uniqueRuleKey===key;})) &&
            (q.kind !== "spell" || !spellSet.has(v)) &&
            (!q.distinctGroup || !group.has(v)),
        );
        if (q.kind === "asi") {
          const preview=draftProgression(context,config,d),scores={...(preview.scoresBeforeFeatureIncreases??preview.scores)};
          const priority = priorities[q.classId] ?? (q.classId==='artificer'?['int','con','dex','wis','str','cha']:ABILITIES);
          options = options
            .filter((v) => {
              if (!v.startsWith("asi:")) return false;
              const [, a, b] = v.split(":");
              return (
                scores[a] + (a === b ? 2 : 1) <= 20 &&
                scores[b] + (a === b ? 2 : 1) <= 20
              );
            })
            .sort(
              (a, b) =>
                priority.indexOf(a.split(":")[1]) -
                priority.indexOf(b.split(":")[1]),
            );
        }
        if (q.kind === "spell")
          options.sort(
            (a, b) =>
              (context.index.get(a)?.data.level ?? 0) -
              (context.index.get(b)?.data.level ?? 0),
          );
        if (q.kind !== "asi") {
          const preferred = [
            ...(modelPreferences[d.model ?? "balanced"] ?? []),
            ...modelPreferences.balanced,
          ];
          options.sort((a, b) => {
            const x = preferred.indexOf(a),
              y = preferred.indexOf(b);
            return (x < 0 ? 10000 : x) - (y < 0 ? 10000 : y);
          });
        }
        d.selections[q.id] = options.slice(0, q.count);
      }
      const values = d.selections[q.id] ?? [];
      if (["skill","training"].includes(q.kind)) values.filter(v=>Object.hasOwn(SKILLS,v)).forEach((v) => usedSkills.add(v));
      if (q.kind === "expertise") values.forEach((v) => usedExpertise.add(v));
      if (q.kind === "feature") values.forEach((v) => features.add(v));
      if (q.kind === "spell") {
        values.forEach((v) => spellSet.add(v));
        spells.set(q.classId, spellSet);
      }
      if (q.distinctGroup) {
        values.forEach((v) => {
          if (v !== "language:none") group.add(v);
        });
        groups.set(q.distinctGroup, group);
      }
    }
  }
  d.confirmed = false;
  d.reviewed = false;
  return d;
}

/** Explicit review action: park an invalid decision in the draft, never destroy its values. */
export function retainDecision(d, kind, choiceId) {
  const values =
    kind === "subclass"
      ? [d.classes.find((c) => c.id === choiceId)?.subclassId].filter(Boolean)
      : [
          ...((kind === "origin" ? d.originSelections : d.selections)?.[
            choiceId
          ] ?? []),
        ];
  if (!values.length) return;
  d.retainedDecisions ??= [];
  d.retainedDecisions.push({ kind, choiceId, values });
  if (kind === "subclass")
    d.classes.find((c) => c.id === choiceId).subclassId = null;
  else delete (kind === "origin" ? d.originSelections : d.selections)[choiceId];
}
export function restoreDecision(d, position) {
  const old = d.retainedDecisions?.[position];
  check(
    old && ["class", "origin", "subclass"].includes(old.kind),
    "Retained decision",
  );
  if (old.kind === "subclass")
    check(
      d.classes.some((c) => c.id === old.choiceId),
      "Restore the class before its subclass",
    );
  d.retainedDecisions.splice(position, 1);
  retainDecision(d, old.kind, old.choiceId);
  if (old.kind === "subclass")
    d.classes.find((c) => c.id === old.choiceId).subclassId = old.values[0];
  else {
    const key = old.kind === "origin" ? "originSelections" : "selections";
    d[key] ??= {};
    d[key][old.choiceId] = [...old.values];
  }
  d.confirmed = d.reviewed = d.finalized = false;
}
/** A class change parks its previous choices for explicit restoration. */
export function changePrimaryClass(d,nextClassId){
 const previous=d.classes[0],firstChoice=d.classChosen===false,untouchedStandard=d.scoreMethod==='standard'&&Object.entries(templateScores(previous.id)).every(([key,value])=>d.scores[key]===value);
 if(firstChoice&&untouchedStandard)d.scores=templateScores(nextClassId);
 if(previous.id===nextClassId){d.classChosen=true;return;}
 if(previous.subclassId)retainDecision(d,'subclass',previous.id);
 for(const key of Object.keys(d.selections))if(key.startsWith(previous.id+':'))retainDecision(d,'class',key);
 d.classes[0]={id:nextClassId,level:previous.level,subclassId:null};d.classChosen=true;
 d.confirmed=d.reviewed=d.finalized=false;
}
