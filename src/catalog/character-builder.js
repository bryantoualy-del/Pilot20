import { averageHpProgression } from "../character/derive.js";
import {
  validateAdvancementHistory,
  choiceHistoryNote,
} from "./advancement.js";
import { check, SKILLS } from "../character/contracts.js";
import { validateCharacter, validateBuild } from "../character/definition.js";
import { resolveProgression,effectiveClassData } from "./progression.js";
import { ability, compileSpell, attachClassAdapters } from "./adapters.js";
/** Production constructor. No fixture imports, random rolls, implied subclass or automatic player choices. */
export function buildCharacter(
  index,
  {
    id,
    name,
    classes,
    scores,
    selections = {},
    hpMode = "average",
    hpProgression = null,
    campaignOptions = [],
    ancestry = null,
    background = { skills: [], proficiencies: [] },
    spellbookTranscriptions = [],
    advancementHistory = [],
    ...originRequest
  },
) {
  const report = resolveProgression(index, {
    classes,
    scores,
    selections,
    campaignOptions,
    background,
    spellbookTranscriptions,
    ...originRequest,
  });
  if (!report.valid) return { character: null, ...report };
  const history = validateAdvancementHistory(
    index,
    {
      classes,
      scores,
      selections,
      campaignOptions,
      background,
      spellbookTranscriptions,
      ...originRequest,
    },
    advancementHistory,
  );
  if (!history.valid)
    return {
      ...report,
      character: null,
      valid: false,
      issues: history.issues,
      history,
    };
  background = report.origin.background;
  check(
    hpMode === "average" || hpProgression !== null,
    "Explicit HP progression required",
  );
  const definitions = classes.map((c) => {
    const entry = index.class(c.id);
    return {
      id: c.id,
      level: c.level,
      subclassId: c.subclassId ?? null,
      hitDie: entry.data.hitDie,
      casting: effectiveClassData(index,c).casting,
      source: entry.source,
    };
  });
  const first = index.class(classes[0].id);
  const d = {
    kind: "character",
    schemaVersion: 2,
    ruleset: "dnd5e-2014",
    id,
    revision: 1,
    identity: { name, portrait: "", description: "" },
    ancestry: ancestry ?? {
      id: "pilot20:ancestry-unselected",
      subraceId: null,
      source: {
        kind: "homebrew",
        document: "Pilot20 unselected ancestry marker",
        license: "project-data",
        url: "",
      },
    },
    classes: definitions,
    background: background.name ?? "",
    alignment: null,
    scores: report.scores,
    skills: Object.fromEntries(background.skills.map((k) => [k, 1])),
    saveProficiencies: first.data.saves,
    proficiencies: [],
    features: report.features,
    equipment: [],
    spells: { known: [], prepared: [] },
    progression: [],
    choices: [],
    choiceRules: [],
    resources: [],
    abilities: [],
    modifiers: [],
    defenses: { resistances: [], immunities: [], vulnerabilities: [] },
    movement: { walk: 30, ignoreHeavyPenalty: false },
    armorRules: [],
    buildRules: [],
  };
  const featureMovement={};
  // Ancestry/background remain editable; no racial bonuses are silently added to supplied scores.
  for(const featureId of d.features){
    const feature=index.get(featureId),effect=feature?.data.buildEffects;if(!effect)continue;
    if((definitions.find(c=>c.id===feature.data.classId)?.level??0)<(effect.minimumClassLevel??1))continue;
    Object.assign(featureMovement,effect.movement??{});
    const owner=definitions.find(c=>c.id===feature.data.classId),pb=2+Math.floor((definitions.reduce((n,c)=>n+c.level,0)-1)/4);
    const modify=(suffix,stat,value,operation='add',condition=null)=>d.modifiers.push({id:featureId+':'+suffix,stat,value,operation,reason:feature.name.en,source:feature.source,...(condition?{condition}:{})});
    if(effect.hpPerClassLevel)modify('hp','maxHp',effect.hpPerClassLevel*owner.level);
    if(effect.naturalArmor)d.armorRules.push({id:featureId+':armor',...structuredClone(effect.naturalArmor),source:feature.source});
    if(effect.halfProficiency)modify('checks',effect.halfProficiency==='all'?'untrainedCheckBonus':'untrainedPhysicalCheckBonus',effect.halfProficiency==='all'?Math.floor(pb/2):Math.ceil(pb/2),'max');
    if(effect.defenseStyle)modify('armor','ac',1,'add','wearing-armor');
    if(effect.rangedWeaponAttackBonus)modify('archery','rangedWeaponAttackBonus',effect.rangedWeaponAttackBonus,'max');
    d.proficiencies.push(...(effect.proficiencies??[]));
    d.defenses.resistances.push(...(effect.resistances??[]));
    if(effect.attacksPerAction)d.modifiers.push({id:featureId+':attacks',stat:'attacksPerAction',operation:'max',value:effect.attacksPerAction,reason:feature.name.en,source:feature.source});
  }
  for (const [n, c] of definitions.entries()) {
    const e = index.class(c.id),
      data = e.data;
    d.proficiencies.push(
      ...(n === 0 ? data.initialProficiencies : data.multiclassProficiencies),
    );
    d.buildRules.push({
      id: c.id + ":multiclass",
      when: "multiclass",
      anyOf: data.multiclassPrerequisites,
    });

    const attacks = report.scaling[c.id]?.attacksPerAction;
    if (
      attacks &&
      (!data.attackFeatureId || d.features.includes(data.attackFeatureId))
    )
      d.modifiers.push({
        id: c.id + ":extra-attack",
        stat: "attacksPerAction",
        operation: "max",
        value: attacks,
        reason: "Class attack progression; does not stack between classes.",
        source: e.source,
      });
    if (c.id === "barbarian" && d.features.includes(data.armorRuleFeatureId)&&!d.armorRules.some(a=>['barbarian:unarmored','monk:unarmored'].includes(a.id)))
      d.armorRules.push({
        id: "barbarian:unarmored",
        base: 10,
        abilities: ["dex", "con"],
        shieldAllowed: true,
        source: e.source,
      });
    if (c.id === "monk" && d.features.includes(data.armorRuleFeatureId)&&!d.armorRules.some(a=>['barbarian:unarmored','monk:unarmored'].includes(a.id)))
      d.armorRules.push({
        id: "monk:unarmored",
        base: 10,
        abilities: ["dex", "wis"],
        shieldAllowed: false,
        source: e.source,
      });
  }
  d.progression = averageHpProgression(definitions);
  if (advancementHistory.length)
    d.progression = advancementHistory.map((row, i) => ({
      classId: row.classId,
      hp:
        i === 0
          ? definitions.find((c) => c.id === row.classId).hitDie
          : definitions.find((c) => c.id === row.classId).hitDie / 2 + 1,
    }));
  if (hpProgression !== null) {
    check(hpProgression.length===definitions.reduce((n,c)=>n+c.level,0)&&hpProgression.every((p,i)=>{const cls=definitions.find(c=>c.id===p.classId);return cls&&Number.isInteger(p.hp)&&p.hp>=1&&p.hp<=cls.hitDie&&(i!==0||(p.classId===definitions[0].id&&p.hp===cls.hitDie));}),'HP die results must match class dice and the initial maximum');
    if (advancementHistory.length)
      check(
        hpProgression.length === advancementHistory.length &&
          hpProgression.every(
            (p, i) => p.classId === advancementHistory[i].classId,
          ),
        "HP progression conflicts with advancement chronology",
      );
    d.progression = structuredClone(hpProgression);
  }
  const spellClasses = new Map();
  for (const choice of report.choices) {
    const values = report.selections[choice.id],
      c = definitions.find((c) => c.id === choice.classId);
    // Character v2 has a maximum of 20 options per choice. Large spellbook choices are paged.
    for (let offset = 0; offset < choice.count; offset += 20) {
      const chunkId =
        choice.count > 20 ? choice.id + ":page-" + offset / 20 : choice.id;
      const count = Math.min(20, choice.count - offset),
        historyIndex = advancementHistory.findIndex(
          (row) =>
            row.classId === c.id &&
            row.classes.find((k) => k.id === c.id)?.level === choice.level,
        ),
        level =
          historyIndex >= 0
            ? historyIndex + 1
            : definitions
                .slice(0, definitions.indexOf(c))
                .reduce((n, c) => n + c.level, 0) + choice.level;
      d.choiceRules.push({
        id: chunkId,
        level,
        count,
        ...(choice.kind==='prepared'&&values.length<choice.count?{minimumCount:0}:{}),
        options: choice.options,
        requires: [],
        incompatible: [],
      });
      d.choices.push({
        id: chunkId,
        level,
        optionIds: values.slice(offset, offset + count),
        note: advancementHistory.length
          ? choiceHistoryNote(advancementHistory, choice.id, choice.classId, {
              referenceOnly: offset > 0,
            })
          : "Catalog class level " + choice.level,
      });
    }
    if (choice.kind === "skill")
      values.forEach((k) => {
        d.skills[k] = Math.max(1, d.skills[k] ?? 0);
      });
    if (choice.kind === "expertise")
      values.forEach((k) => {
        if (Object.hasOwn(SKILLS, k)) d.skills[k] = 2;
        else d.proficiencies.push("expertise:" + k);
      });
    if (choice.kind === "proficiency") d.proficiencies.push(...values);
    if (
      [
        "spell",
        "spellbook",
        "prepared",
        "spell-mastery",
        "signature-spell",
        "ritual-spell",
      ].includes(choice.kind)
    )
      for (const spellId of values) {
        const e = index.get(spellId);
        check(e?.type === "spell", "Unknown selected spell");
        if (!spellClasses.has(c.id)) spellClasses.set(c.id, new Map());
        const spells = spellClasses.get(c.id),
          record = spells.get(spellId) ?? {
            entry: e,
            normal: false,
            prepared: false,
            ritualOnly: false,
            arcanumLevel: null,
            mastery: false,
            signature: false,
          };
        const arcanum = choice.id.includes(":arcanum-");
        if (arcanum) {
          record.arcanumLevel = e.data.level;
          d.features.push(spellId);
        } else if (choice.kind === "ritual-spell") record.ritualOnly = true;
        else record.normal = true;
        if (choice.kind === "prepared" || choice.kind === "signature-spell")
          record.prepared = true;
        if (choice.kind === "spell-mastery") record.mastery = true;
        if (choice.kind === "signature-spell") record.signature = true;
        spells.set(spellId, record);
        d.spells.known.push(spellId);
        if (
          choice.kind === "prepared" ||
          choice.kind === "signature-spell" ||
          e.data.level === 0
        )
          d.spells.prepared.push(spellId);
      }
  }
  for (const g of report.grantedSpells) {
    const entry = index.get(g.id);
    check(entry?.type === "spell", "Granted spell reference");
    if (!spellClasses.has(g.classId)) spellClasses.set(g.classId, new Map());
    const existing = spellClasses.get(g.classId).get(g.id) ?? {
      entry,
      arcanumLevel: null,
    };
    spellClasses
      .get(g.classId)
      .set(g.id, { ...existing, normal: true, prepared: g.mode==='prepared' });
    d.spells.known.push(g.id);
    if(g.mode==='prepared'||entry.data.level===0)d.spells.prepared.push(g.id);
  }
  d.features = [...new Set(d.features)];
  d.proficiencies = [
    ...new Set([...d.proficiencies, ...background.proficiencies]),
  ];
  d.spells.known = [...new Set(d.spells.known)];
  d.spells.prepared = [...new Set(d.spells.prepared)];
  for (const r of report.resources)
    if (!r.unlimited)
      d.resources.push({
        id: r.id,
        max: r.max,
        recovery: r.recovery,
        source: index.get(r.ownerId)?.source??index.class(r.classId).source,
      });
  for (const [cls, spells] of spellClasses)
    for (const record of spells.values()) {
      const {
        entry,
        arcanumLevel,
        ritualOnly,
        normal,
        prepared,
        mastery,
        signature,
      } = record;
      const requiresPreparation =
          ["cleric", "druid", "paladin", "wizard"].includes(cls) ||
          definitions.find((c) => c.id === cls).casting?.preparation,
        available = !requiresPreparation || prepared || entry.data.level === 0;
      if (arcanumLevel !== null && arcanumLevel !== undefined)
        d.abilities.push(compileSpell(entry, cls, d, { arcanumLevel }));
      else if (normal && available)
        d.abilities.push(compileSpell(entry, cls, d));
      if ((mastery || signature) && available) {
        const free = compileSpell(entry, cls, d);
        free.id += ":" + (signature ? "signature" : "mastery");
        free.combat.spell.slotPolicy = "free";
        if (signature) {
          const id = "wizard:signature:" + entry.id;
          d.resources.push({
            id,
            max: 1,
            recovery: "short",
            source: entry.source,
          });
          free.resource = { id, amount: 1 };
        }
        d.abilities.push(free);
      }
      if (ritualOnly) {
        const ritual = compileSpell(entry, cls, d);
        ritual.id += ":ritual";
        ritual.cost = "none";
        ritual.attack = null;
        ritual.save = null;
        ritual.effects = [];
        ritual.combat = {
          version: 1,
          mode: "manual",
          requirements: [
            "GM confirms ritual access, components and completion of the extended casting time.",
          ],
          spell: {
            id: entry.id,
            classId: cls,
            level: entry.data.level,
            access: "granted",
            slotPolicy: "free",
          },
          externalRequirements: [
            "castingTimeAdjudicated",
            "ritualEligibilityValidated",
          ],
        };
        d.features.push(entry.id);
        d.abilities.push(ritual);
      }
    }
  d.features = [...new Set(d.features)];
  validateCharacter(d);
  check(validateBuild(d).valid, "Generated build invalid");
  attachClassAdapters(d, index);
  // Every unlocked feature is inspectable/manual even if it has no executable adapter.
  const executable = new Set(d.abilities.map((a) => a.id));
  for (const id of d.features)
    if (!executable.has(id)) {
      const e = index.get(id);
      if (!e || !["feature", "feat"].includes(e.type)) continue;
      const m = e.data.manualMechanics,
        resourceId = m?.resourceId ? e.data.classId + ":" + m.resourceId : null;
      const resource =
        resourceId && d.resources.some((r) => r.id === resourceId)
          ? { id: resourceId, amount: m.amount }
          : null;
      if (resourceId && !resource)
        check(
          report.resources.some((r) => r.id === resourceId && r.unlimited),
          "Unresolved manual feature resource",
        );
      d.abilities.push(
        ability(e, {
          cost: m?.economy ?? "none",
          target: m?.target ?? "self",
          maxTargets: m?.maxTargets ?? 1,
          resource,
          ...(m?.concentration
            ? { concentration: { effectId: e.id, start: "activation" } }
            : {}),
          combat: {
            version: 1,
            mode: "manual",
            requirements: m?.requirements ?? [
              "GM adjudicates feature, action economy, restrictions and outcomes.",
            ],
            ...(m
              ? { externalRequirements: ["featureEligibilityValidated"] }
              : {}),
          },
        }),
      );
    }
  const o = report.origin;
  if (o.race) {
    d.ancestry = {
      id: o.race.id,
      subraceId: o.subrace?.id ?? null,
      source: o.subrace?.source??o.race.source,
      ...(o.race.source.kind==='reference'?{size:o.size,creatureType:o.creatureType}:{}),
    };
    d.movement = { walk: o.speed, ignoreHeavyPenalty: o.ignoreHeavyPenalty,...o.movementModes,...featureMovement };
    d.defenses.resistances = [
      ...new Set([...d.defenses.resistances, ...o.resistances]),
    ];
    const dragon = o.ledger.find((r) => r.kind === "draconic")?.value;
    if (dragon) {
      const damage = {
        black: "acid",
        blue: "lightning",
        brass: "fire",
        bronze: "lightning",
        copper: "acid",
        gold: "fire",
        green: "poison",
        red: "fire",
        silver: "cold",
        white: "cold",
      }[dragon];
      d.defenses.resistances = [
        ...new Set([...d.defenses.resistances, damage]),
      ];
    }
    if (o.hpPerLevel)
      d.modifiers.push({
        id: "origin:hp",
        stat: "maxHp",
        operation: "add",
        value: o.hpPerLevel * definitions.reduce((n, c) => n + c.level, 0),
        reason: "Racial hit points per character level",
        source: o.race.source,
      });
  }
  for (const trait of o.traits) {
    const tid = trait.ownerId + ":" + trait.id;
    const resourceId=trait.resource?tid+':uses':null;
    if(resourceId)d.resources.push({id:resourceId,max:trait.resource.proficiency?2+Math.floor((definitions.reduce((n,c)=>n+c.level,0)-1)/4):trait.resource.max,recovery:trait.resource.recovery,source:trait.source});
    d.features.push(tid);
    d.abilities.push(
      ability(
        { id: tid, name: trait.name, source: trait.source, type: "race" },
        {
          kind: "racial",
          ...(trait.activation??{}),
          ...(resourceId?{resource:{id:resourceId,amount:1}}:{}),
          combat: {
            version: 1,
            mode: "manual",
            requirements: [
              "Apply the described racial or background trait with GM adjudication.",
              ...(trait.description ? [trait.description] : []),
              ...(trait.charges
                ? [
                    "Manual charges: " +
                      trait.charges +
                      "; recovery: " +
                      (trait.rest ?? "GM adjudication"),
                  ]
                : []),
              ...(trait.prerequisites
                ? ["GM prerequisite: " + trait.prerequisites]
                : []),
            ],
          },
        },
      ),
    );
  }
  for (const spell of o.spells) {
    const e = index.get(spell.id);
    if (!e) continue;
    const sid = spell.featureOwnerId?spell.featureOwnerId+':spell:'+e.id:"origin:spell:" + e.id;
    d.spells.known.push(e.id);
    d.spells.prepared.push(e.id);
    d.features.push(sid);
    d.abilities.push(
      ability(
        { ...e, id: sid },
        {
          kind: spell.featureOwnerId?'class':"racial",
          ...(spell.target?{target:spell.target}:{}),...(spell.maxTargets?{maxTargets:spell.maxTargets}:{}),
          ...(e.data.concentration?{concentration:{effectId:e.id,start:'activation'}}:{}),
          ...(spell.resourceId?{resource:{id:spell.resourceId,amount:1}}:{}),
          cost: spell.featureOwnerId?spell.economy??'none':spell.level === 1 ? "action" : "none",
          combat: {
            version: 1,
            mode: "manual",
            ...(spell.featureOwnerId?{externalRequirements:['featureEligibilityValidated']}:{}),
            requirements: [
              (spell.featureOwnerId?'Feature spellcasting uses ':"Racial spellcasting uses ") +
                spell.ability +
                "; verify acquisition, uses, components and casting level.",
              ...(spell.requirements?[spell.requirements]:[]),
            ],
          },
        },
      ),
    );
  }
  for (const item of o.equipment)
    d.equipment.push({
      id: "background:" + item.id,
      kind: "item",
      equipped: false,
      armor: null,
      weapon: null,
      source: index.get(originRequest.backgroundId).source,
    });
  Object.assign(d.movement,featureMovement);
  d.features = [...new Set(d.features)];
  d.spells.known = [...new Set(d.spells.known)];
  d.spells.prepared = [...new Set(d.spells.prepared)];
  validateCharacter(d);
  check(validateBuild(d).valid, "Generated integrated build invalid");
  return { ...report, character: d, valid: true, history };
}
/** Current spell replacement is explicit, atomic and revalidated. Historical per-level replacement stays partial. */
export function replaceSelection(
  index,
  request,
  { choiceId, removeId, addId },
) {
  const selections = structuredClone(request.selections ?? {}),
    values = selections[choiceId];
  check(
    values?.includes(removeId) && !values.includes(addId),
    "Replacement selection",
  );
  selections[choiceId] = values.map((v) => (v === removeId ? addId : v));
  const next = { ...request, selections },
    report = resolveProgression(index, next);
  check(report.valid, "Invalid replacement: " + JSON.stringify(report.issues));
  return next;
}
export function commandMetadata(character, index) {
  return character.abilities.map((a) => ({
    id: a.id,
    category: a.kind,
    economy: a.cost,
    resource: a.resource,
    target: a.target,
    maxTargets: a.maxTargets,
    confirmation:
      a.combat?.mode === "manual" || !!a.combat?.externalRequirements?.length,
    automation: index.get(a.combat?.spell?.id ?? a.id)?.data.automation ?? {
      status: "manual",
      handler: null,
      limits: ["Uncatalogued ability"],
    },
    favoritesKey: a.id,
    externalRequirements: a.combat?.externalRequirements ?? [],
  }));
}
