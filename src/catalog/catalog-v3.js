import { HANDLERS } from "./handlers.js";
/** Inert, versioned, modular catalogue. Legacy v2 remains in validate.js. */
import {
  check,
  keys,
  id,
  json,
  source,
  integer,
  ABILITIES,
  SKILLS,
} from "../character/contracts.js";
const TYPES = [
  "class",
  "subclass",
  "feature",
  "spell",
  "resource",
  "choice",
  "prerequisite",
  "progression",
  "effect",
  "source",
  "feat",
  "race",
  "background",
];
const STATUSES = ["automated", "partial", "manual", "unsupported"];
const list = (v, label) =>
  check(Array.isArray(v) && v.every(id) && new Set(v).size === v.length, label);
export function validateCatalogV3(c, { distribution = "private" } = {}) {
  json(c);
  keys(c, ["kind", "schemaVersion", "ruleset", "id", "items"]);
  check(
    c.kind === "catalog" &&
      c.schemaVersion === 3 &&
      c.ruleset === "dnd5e-2014" &&
      id(c.id) &&
      Array.isArray(c.items) &&
      c.items.length <= 10000,
    "Catalog v3 header",
  );
  list(
    c.items.map((i) => i.id),
    "Duplicate catalogue ID",
  );
  for (const i of c.items) {
    keys(i, ["id", "type", "name", "source", "data"]);
    source(i.source);
    keys(i.name, ["en", "fr"]);
    check(
      id(i.id) &&
        TYPES.includes(i.type) &&
        Object.values(i.name).every(
          (n) => typeof n === "string" && n.trim() && n.length <= 200,
        ),
      "Entry identity",
    );
    check(
      distribution !== "public" || i.source.kind !== "private",
      "Private content cannot be distributed",
    );
    check(i.data && i.data.ruleset === c.ruleset, "Entry ruleset");
    if(i.source.kind==='reference') check(['xge','tce','phb14','ravenloft','volo','motm','eberron','scag','strixhaven','fizban','bgg','cos','toa','planescape'].includes(i.data.rulesSourceId),'Referenced 2014 source');
    const a = i.data.automation;
    keys(a, ["status", "handler", "limits"]);
    check(
      STATUSES.includes(a.status) &&
        (a.handler === null || id(a.handler)) &&
        Array.isArray(a.limits) &&
        a.limits.every((x) => typeof x === "string" && x.trim()),
      "Automation metadata",
    );
    check(
      a.handler === null || HANDLERS[a.handler]?.includes(i.id),
      "Unknown or mismatched executable handler",
    );
    check(
      a.status !== "automated" || (a.handler !== null && a.limits.length === 0),
      "Automated entry needs executable handler",
    );
    check(
      a.status !== "unsupported" || a.limits.length > 0,
      "Unsupported reason",
    );
    const d = i.data;
    if(i.type==='subclass'&&d.casting){
      keys(d.casting,['ability','progression','startsAtClassLevel'],['ability','progression']);
      check(ABILITIES.includes(d.casting.ability)&&d.casting.progression==='third'&&d.casting.startsAtClassLevel===3,'Subclass casting');
      check(id(d.spellListClassId),'Subclass spell list');
      for(const key of ['cantripsKnown','spellsKnown','unrestrictedSpellsKnown'])check(d[key]?.length===20&&d[key].every(n=>integer(n,0,100)),'Subclass known progression');
      check(Array.isArray(d.restrictedSpellSchools)&&d.restrictedSpellSchools.length===2,'Subclass spell schools');
    }
    if(d.draconicCapabilities){
      check(i.type==='feat'&&d.rulesSourceId==='fizban'&&Array.isArray(d.draconicCapabilities),'Draconic feat capabilities');
      for(const c of d.draconicCapabilities){
        keys(c,['key','summary','name','economy','maximum','recovery','trigger','mechanics','automation']);
        check(id(c.key)&&typeof c.summary==='string'&&['bonus','reaction'].includes(c.economy)&&(c.maximum===1||c.maximum==='proficiency')&&c.recovery==='long'&&id(c.trigger),'Draconic capability contract');
        check(c.automation.status==='partial'&&c.automation.handler===null&&c.automation.limits.length>0,'Draconic partial support only');
      }
    }
    if(d.castingAbilityOptions)check(i.type==='feat'&&d.castingAbilityOptions.length===3&&d.castingAbilityOptions.every(a=>['int','wis','cha'].includes(a))&&!d.abilityOptions,'Casting choice is not an ability score increase');
    if(d.buildEffects){
      keys(d.buildEffects,['proficiencies','attacksPerAction','resistances','minimumClassLevel','movement','scoreIncreases','hpPerClassLevel','naturalArmor','halfProficiency','defenseStyle','rangedWeaponAttackBonus','skills','immunities','heavyArmorBonus','initiativeAbility','saves','skillAbilityBonuses','expertiseSkills','speedBonus','existingMovementBonus','checkAbilityBonuses','unarmoredSpeedByClassLevel','initiativeBonus','hpPerCharacterLevel','passiveSkillBonuses','mediumArmorDexCap','movementMatchWalk'],[]);
      check(['feature','feat'].includes(i.type),'Build effects belong to features or feats');
      const e=d.buildEffects;
      if(e.movementMatchWalk)check(Array.isArray(e.movementMatchWalk)&&e.movementMatchWalk.every(k=>['climb','swim'].includes(k)),'Movement matches walk');
      for(const key of ['initiativeBonus','hpPerCharacterLevel','mediumArmorDexCap'])if(e[key]!==undefined)check(integer(e[key],0,20),'Feat statistic');
      if(e.passiveSkillBonuses)for(const[k,v]of Object.entries(e.passiveSkillBonuses))check(Object.hasOwn(SKILLS,k)&&integer(v,0,20),'Passive skill bonus');
      if(e.unarmoredSpeedByClassLevel)check(e.unarmoredSpeedByClassLevel.length===20&&e.unarmoredSpeedByClassLevel.every(n=>integer(n,0,100)),'Unarmored movement');
      if(e.checkAbilityBonuses)for(const [ability,row]of Object.entries(e.checkAbilityBonuses))check(ABILITIES.includes(ability)&&ABILITIES.includes(row.ability)&&integer(row.minimum,0,5),'Feature check ability bonus');
      if(e.expertiseSkills)check(Array.isArray(e.expertiseSkills)&&e.expertiseSkills.every(k=>Object.hasOwn(SKILLS,k)),'Feature expertise');
      for(const key of ['speedBonus','existingMovementBonus'])if(e[key]!==undefined)check(integer(e[key],0,60),'Feature speed bonus');
      if(e.saves)check(Array.isArray(e.saves)&&e.saves.every(a=>ABILITIES.includes(a)),'Feature saves');
      if(e.skillAbilityBonuses)for(const [skill,ability]of Object.entries(e.skillAbilityBonuses))check(Object.hasOwn(SKILLS,skill)&&ABILITIES.includes(ability),'Feature skill bonus');
      if(e.initiativeAbility)check(ABILITIES.includes(e.initiativeAbility),'Initiative ability');
      if(e.skills)check(Array.isArray(e.skills)&&e.skills.every(s=>Object.hasOwn(SKILLS,s)),'Feature skills');
      if(e.immunities)list(e.immunities,'Feature immunities');
      if(e.heavyArmorBonus!==undefined)check(integer(e.heavyArmorBonus,1,5),'Heavy armor bonus');
      if(e.scoreIncreases){keys(e.scoreIncreases,ABILITIES,[]);for(const row of Object.values(e.scoreIncreases)){keys(row,['amount','maximum']);check(integer(row.amount,1,10)&&integer(row.maximum,20,30),'Feature score increase');}}
      if(e.hpPerClassLevel!==undefined)check(integer(e.hpPerClassLevel,1,5),'Feature HP');
      if(e.naturalArmor){keys(e.naturalArmor,['base','abilities','shieldAllowed']);check(integer(e.naturalArmor.base,10,20)&&Array.isArray(e.naturalArmor.abilities)&&e.naturalArmor.abilities.every(a=>ABILITIES.includes(a))&&typeof e.naturalArmor.shieldAllowed==='boolean','Feature armor');}
      if(e.halfProficiency!==undefined)check(['all','physical'].includes(e.halfProficiency),'Feature check proficiency');
      if(e.defenseStyle!==undefined)check(e.defenseStyle===true,'Defense style');
      if(e.rangedWeaponAttackBonus!==undefined)check(integer(e.rangedWeaponAttackBonus,1,10),'Ranged weapon bonus');
      if(d.buildEffects.minimumClassLevel!==undefined)check(integer(d.buildEffects.minimumClassLevel,1,20),'Build effect level');
      if(d.buildEffects.movement){keys(d.buildEffects.movement,['climb','swim','fly'],[]);for(const v of Object.values(d.buildEffects.movement))check(integer(v,0,200),'Build effect movement');}
      if(d.buildEffects.proficiencies)list(d.buildEffects.proficiencies,'Feature proficiencies');
      if(d.buildEffects.attacksPerAction!==undefined)check(integer(d.buildEffects.attacksPerAction,1,4),'Feature attacks');
      if(d.buildEffects.resistances)check(d.buildEffects.resistances.every(t=>['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder','bludgeoning','piercing','slashing'].includes(t)),'Feature resistances');
    }
    if(d.innateSpells){check(i.type==='feature'&&Array.isArray(d.innateSpells),'Feature spellcasting');for(const row of d.innateSpells){keys(row,['classLevel','spellIds','ability','resourceId','requirements','economy','target','maxTargets','requiresActiveFeature','resourceAmount','ritualOnly','additionalResourceId'],['classLevel','spellIds','ability','resourceId','requirements']);check(integer(row.classLevel,1,20)&&ABILITIES.includes(row.ability)&&(row.resourceId===null||id(row.resourceId))&&typeof row.requirements==='string'&&row.requirements.length<=2000,'Feature spellcasting policy');if(row.additionalResourceId!==undefined)check(id(row.additionalResourceId),'Additional spell cost');if(row.resourceAmount!==undefined)check(integer(row.resourceAmount,1,20),'Feature spell resource amount');if(row.ritualOnly!==undefined)check(row.ritualOnly===true,'Feature ritual route');if(row.economy!==undefined)check(['none','action','bonus','reaction'].includes(row.economy),'Feature spell economy');if(row.target!==undefined)check(['self','selected'].includes(row.target),'Feature spell target');if(row.maxTargets!==undefined)check(integer(row.maxTargets,1,20),'Feature spell target count');if(row.requiresActiveFeature!==undefined)check(id(row.requiresActiveFeature),'Feature spell activation condition');list(row.spellIds,'Feature spells');}}
    if(d.acquisitionPolicyOverride){check(i.type==='feature'&&d.optionalClassFeature===true,'Optional acquisition policy');keys(d.acquisitionPolicyOverride,['cantripReplacementAtASI','expertiseReplacementAtASI','sharedASIReplacementLimit','metamagicReplacementAtASI','fightingStyleReplacementAtASI','maneuverReplacementAtASI','pactReplacementAtASI','arcanumReplacementAtASI','cantripReplacementAtLongRest'],[]);for(const v of Object.values(d.acquisitionPolicyOverride))check(integer(v,0,1),'ASI replacement budget');}
    if(d.uniqueRuleKey!==undefined)check(id(d.uniqueRuleKey),'Unique rule key');
    if(d.spellGrantReplacement){keys(d.spellGrantReplacement,['schools','classIds']);list(d.spellGrantReplacement.schools,'Spell replacement schools');list(d.spellGrantReplacement.classIds,'Spell replacement lists');}
    for (const field of ["aliases", "reviewNotes"])
      if (d[field] !== undefined)
        check(
          Array.isArray(d[field]) &&
            d[field].length <= 100 &&
            d[field].every((v) => typeof v === "string" && v.length <= 2000),
          "Safe display metadata",
        );
    if(d.grantedFeatIds){check(i.type==='background','Background feat grants');list(d.grantedFeatIds,'Granted feat IDs');}
    if(d.conditionalProficiencies){check(i.type==='background'&&Array.isArray(d.conditionalProficiencies),'Conditional background training');for(const row of d.conditionalProficiencies){check(id(row.key)&&id(row.optionId),'Conditional training choice');list(row.values,'Conditional training values');}}
    if(d.selectionRequiresAny!==undefined)list(d.selectionRequiresAny,'Alternative prerequisites');
    if (d.incompatible !== undefined)
      list(d.incompatible, "Incompatible entries");
    if (["race", "background"].includes(i.type)) {
      for (const owner of [d, ...(d.subraces ?? [])]) {
        if(owner.source){source(owner.source);check(distribution!=='public'||owner.source.kind!=='private','Private subrace cannot be distributed');if(owner.source.kind==='reference')check(['xge','tce','phb14','ravenloft','volo','motm','eberron','scag','strixhaven','fizban','bgg','cos','toa','planescape'].includes(owner.rulesSourceId),'Referenced subrace source');}
        if(owner.flexibleAbilityBoosts!==undefined)check(owner.flexibleAbilityBoosts===true,'Flexible racial bonuses');
        if(owner.sizes)check(Array.isArray(owner.sizes)&&owner.sizes.length>0&&owner.sizes.every(s=>['small','medium'].includes(s)),'Racial size choices');
        if(owner.movementModes){keys(owner.movementModes,['climb','swim','fly','climbMatchesWalk','flyMatchesWalk','flightArmorRestricted'],[]);for(const key of ['climb','swim','fly'])if(owner.movementModes[key]!==undefined)check(integer(owner.movementModes[key],0,200),'Racial movement');if(owner.movementModes.climbMatchesWalk!==undefined)check(typeof owner.movementModes.climbMatchesWalk==='boolean','Racial climbing policy');}
        if(owner.naturalArmor){keys(owner.naturalArmor,['base','abilities','shieldAllowed']);check(integer(owner.naturalArmor.base,10,20)&&Array.isArray(owner.naturalArmor.abilities)&&owner.naturalArmor.abilities.every(a=>ABILITIES.includes(a))&&typeof owner.naturalArmor.shieldAllowed==='boolean','Racial armor');}
        if(owner.armorBonus!==undefined)check(integer(owner.armorBonus,0,2),'Racial armor bonus');
        for(const t of owner.traits??[]){
          if(t.activation){keys(t.activation,['cost','target','maxTargets']);check(['none','action','bonus','reaction'].includes(t.activation.cost)&&['self','selected','none'].includes(t.activation.target)&&integer(t.activation.maxTargets,1,20),'Racial activation');}
          if(t.resource){keys(t.resource,['max','proficiency','recovery'],['recovery']);check(['short','long','none'].includes(t.resource.recovery)&&((t.resource.proficiency===true&&t.resource.max===undefined)||(t.resource.proficiency===undefined&&integer(t.resource.max,1,100))),'Racial resource');}
          if(t.minimumCharacterLevel!==undefined)check(integer(t.minimumCharacterLevel,1,20),'Racial acquisition level');
        }
        if (owner !== d)
          check(
            id(owner.id) && owner.name?.fr && owner.name?.en,
            "Subrace identity",
          );
        for (const field of ["skills", "languages", "proficiencies"])
          if (owner[field]) list(owner[field], "Origin grants");
        check(
          (owner.skills ?? []).every((k) => Object.hasOwn(SKILLS, k)),
          "Origin skills",
        );
        for (const [k, n] of Object.entries(owner.bonuses ?? {}))
          check(ABILITIES.includes(k) && integer(n, 1, 2), "Origin bonuses");
        if (owner.hpPerLevel !== undefined)
          check(integer(owner.hpPerLevel, 0, 2), "Origin HP");
        if (owner.choices)
          for (const q of owner.choices) {
            check(
              id(q.key) &&
                integer(q.count, 1, 18) &&
                [
                  "skill",
                  "proficiency",
                  "language",
                  "score",
                  "racial-spell",
                  "draconic",
                  "ancestry-option",
                  "feat",
                ].includes(q.kind),
              "Origin choice",
            );
            list(q.options, "Origin choice options");
          }
      }
      if (i.type === "race")
        check(
          ["small", "medium"].includes(d.size) &&
            integer(d.speed, 0, 200) &&
            Array.isArray(d.subraces),
          "Race size/speed",
        );
    }
    if (i.type === "class") {
      check(
        id(d.classId) && [6, 8, 10, 12].includes(d.hitDie),
        "Class identity",
      );
      list(d.saves, "Class saves");
      check(
        d.saves.length === 2 && d.saves.every((s) => ABILITIES.includes(s)),
        "Class saves",
      );
      check(integer(d.skillChoice?.count, 1, 18), "Skill choice count");
      list(d.skillChoice.options, "Skill options");
      check(
        d.skillChoice.options.every((k) => Object.hasOwn(SKILLS, k)) &&
          d.skillChoice.count <= d.skillChoice.options.length,
        "Skill options",
      );
      if (d.casting !== null) {
        keys(
          d.casting,
          [
            "ability",
            "progression",
            "multiclassRounding",
            "startsAtClassLevel",
            "preparation",
          ],
          ["ability", "progression"],
        );
        if (d.casting.preparation !== undefined)
          check(
            ["ability-plus-level", "ability-plus-half-level"].includes(
              d.casting.preparation,
            ),
            "Preparation policy",
          );
        if (d.casting.multiclassRounding !== undefined)
          check(
            ["floor", "ceil"].includes(d.casting.multiclassRounding),
            "Casting contribution rounding",
          );
        if (d.casting.startsAtClassLevel !== undefined)
          check(
            integer(d.casting.startsAtClassLevel, 1, 3),
            "Casting start level",
          );
        check(
          ABILITIES.includes(d.casting.ability) &&
            ["full", "half", "third", "pact"].includes(d.casting.progression),
          "Class casting",
        );
      }
      check(integer(d.subclassLevel, 1, 20), "Subclass level");
      list(d.subclassIds, "Subclass IDs");
      for (const field of ["initialProficiencies", "multiclassProficiencies"])
        list(d[field], "Class proficiencies");
      for (const field of ["cantripsKnown", "spellsKnown"])
        check(
          d[field]?.length === 20 && d[field].every((n) => integer(n, 0, 100)),
          "Known progression",
        );
      check(
        Array.isArray(d.multiclassPrerequisites) &&
          d.multiclassPrerequisites.length > 0 &&
          d.multiclassPrerequisites.every(
            (all) =>
              Array.isArray(all) &&
              all.length > 0 &&
              all.every(
                (p) => ABILITIES.includes(p.score) && integer(p.minimum, 1, 30),
              ),
          ),
        "Multiclass requirements",
      );
      check(
        Array.isArray(d.resources) && Array.isArray(d.choices),
        "Class resources/choices",
      );
      list(
        d.resources.map((r) => r.id),
        "Duplicate resource",
      );
      list(
        d.choices.map((r) => r.key),
        "Duplicate choice",
      );
      for (const r of d.resources) {
        check(
          ["short", "long", "none"].includes(r.recovery) &&
            r.maxByLevel?.length === 20,
          "Resource progression",
        );
        for (const v of r.maxByLevel)
          check(
            v === null ||
              integer(v, 0, 1000) ||
              (v &&
                (ABILITIES.includes(v.ability) || v.proficiency===true) &&
                integer(v.minimum, -5, 30) &&
                (v.multiplier===undefined || integer(v.multiplier,1,10)) &&
                (v.add === undefined || integer(v.add, 0, 60))),
            "Resource maximum",
          );
      }
      for (const q of d.choices) {
        check(
          integer(q.level, 1, 20) &&
            integer(q.count, 1, 100) &&
            [
              "feature",
              "asi",
              "skill",
              "proficiency",
              "expertise",
              "spell",
              "spell-mastery",
              "signature-spell",
              "ritual-spell",
              "training",
              "save-proficiency",
            ].includes(q.kind),
          "Choice contract",
        );
        list(q.options, "Choice options");
        if (q.requiresChoice) {
          keys(q.requiresChoice, ["key", "optionId"]);
          check(
            id(q.requiresChoice.key) && id(q.requiresChoice.optionId),
            "Conditional choice",
          );
        }
        if (q.distinctGroup !== undefined)
          check(id(q.distinctGroup), "Choice distinct group");
        if (q.adjudication !== undefined)
          check(
            typeof q.adjudication === "string" && q.adjudication.trim(),
            "Choice adjudication",
          );
        if (q.countByLevel)
          check(
            q.countByLevel.length === 20 &&
              q.countByLevel.every((n) => integer(n, 0, 100)),
            "Choice progression",
          );
      }
      for (const table of Object.values(d.scaling ?? {}))
        check(
          Array.isArray(table) &&
            table.length === 20 &&
            table.every(
              (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
            ),
          "Scaling table",
        );
      check(
        d.grants?.length === 20 && d.grants.every((r, i) => r.level === i + 1),
        "Complete progression",
      );
    }
    if (["class", "subclass"].includes(i.type)) {
      check(id(d.classId) && Array.isArray(d.grants), "Grant owner");
      for (const r of d.grants) {
        keys(r, ["level", "featureIds"]);
        check(integer(r.level, 1, 20), "Grant level");
        list(r.featureIds, "Grant features");
      }
      check(
        new Set(d.grants.map((r) => r.level)).size === d.grants.length,
        "Duplicate progression level",
      );
    }
    if (
      !["class", "race", "background"].includes(i.type) &&
      d.choices !== undefined
    ) {
      check(Array.isArray(d.choices), "Extension choices");
      list(
        d.choices.map((q) => q.key),
        "Duplicate extension choice",
      );
      for (const q of d.choices) {
        check(
          integer(q.level, 1, 20) &&
            integer(q.count, 1, 100) &&
            [
              "feature",
              "asi",
              "skill",
              "proficiency",
              "expertise",
              "spell",
              "spell-mastery",
              "signature-spell",
              "ritual-spell",
              "training",
              "save-proficiency",
            ].includes(q.kind),
          "Extension choice contract",
        );
        list(q.options, "Extension choice options");
      }
    }
    if (i.type === "feature")
      check(
        id(d.classId) && integer(d.minimumClassLevel, 1, 20),
        "Feature availability",
      );
    if (i.type === "spell") {
      check(
        integer(d.level, 0, 9) &&
          [
            "abjuration",
            "conjuration",
            "divination",
            "enchantment",
            "evocation",
            "illusion",
            "necromancy",
            "transmutation",
          ].includes(d.school),
        "Spell level/school",
      );
      list(d.classIds, "Spell classes");
      check(d.classIds.length > 0, "Spell class access");
      for (const f of [
        "castingTime",
        "range",
        "components",
        "duration",
        "description",
      ])
        check(typeof d[f] === "string" && d[f].trim(), "Spell " + f);
      check(
        typeof d.concentration === "boolean" && typeof d.ritual === "boolean",
        "Spell flags",
      );
    }
    if (d.originCustomization) {
      check(
        i.type === "feature" &&
          d.optionalClassFeature === true &&
          id(d.campaignOption),
        "Origin customization must be an optional feature",
      );
      keys(
        d.originCustomization,
        ["abilities", "languages", "proficiencies"],
        [],
      );
      for (const k of ["abilities", "languages"])
        if (d.originCustomization[k] !== undefined)
          check(d.originCustomization[k] === true, "Origin option flag");
      if (d.originCustomization.proficiencies)
        for (const [k, v] of Object.entries(
          d.originCustomization.proficiencies,
        )) {
          check(id(k), "Origin proficiency replacement");
          list(v, "Replacement options");
        }
    }
    if (d.manualMechanics) {
      const m = d.manualMechanics;
      keys(
        m,
        [
          "economy",
          "target",
          "maxTargets",
          "resourceId",
          "amount",
          "requirements",
          "concentration",
        ],
        [
          "economy",
          "target",
          "maxTargets",
          "resourceId",
          "amount",
          "requirements",
        ],
      );
      check(
        ["action", "bonus", "reaction", "none"].includes(m.economy) &&
          ["self", "selected"].includes(m.target) &&
          integer(m.maxTargets, 1, 20) &&
          (m.resourceId===null?m.amount===0:id(m.resourceId)&&integer(m.amount,1,100)),
        "Manual mechanics",
      );
      check(
        Array.isArray(m.requirements) &&
          m.requirements.every((v) => typeof v === "string" && v.trim()),
        "Manual requirements",
      );
      if (m.concentration !== undefined)
        check(typeof m.concentration === "boolean", "Manual concentration");
    }
    if (d.resources)
      for (const r of d.resources) {
        check(
          id(r.id) &&
            ["short", "long", "none"].includes(r.recovery) &&
            r.maxByLevel?.length === 20,
          "Resource owner contract",
        );
        for (const v of r.maxByLevel)
          check(
            v === null ||
              integer(v, 0, 1000) ||
              (v &&
                (ABILITIES.includes(v.ability) || v.proficiency===true) &&
                integer(v.minimum, -5, 30) &&
                (v.multiplier===undefined || integer(v.multiplier,1,10)) &&
                (v.add === undefined || integer(v.add, 0, 60))),
            "Resource maximum",
          );
        if (r.recharge) {
          keys(
            r.recharge,
            ["kind", "failure", "successDays", "intervalDays"],
            ["kind"],
          );
          check(
            r.recovery === "none" && r.recharge.kind === "adjudicated-calendar",
            "Calendar recovery must stay explicit",
          );
          if (r.recharge.failure !== undefined)
            check(
              r.recharge.failure === "long-rest",
              "Calendar failure policy",
            );
          for (const field of ["successDays", "intervalDays"])
            if (r.recharge[field] !== undefined)
              check(integer(r.recharge[field], 1, 365), "Calendar interval");
        }
      }
    if (d.optionalClassFeature !== undefined)
      check(
        i.type === "feature" &&
          d.optionalClassFeature === true &&
          id(d.campaignOption),
        "Optional feature requires explicit campaign option",
      );
    for (const k of ["suppressesChoices", "suppressesResources"])
      if (d[k] !== undefined) list(d[k], "Suppression references");
    if (d.requires !== undefined) list(d.requires, "Entry dependencies");
    if (d.replaces !== undefined) list(d.replaces, "Replaced entries");
    if (d.campaignOption !== undefined)
      check(id(d.campaignOption), "Campaign option");
  }
  return c;
}
// Only used on catalog entries after validateCatalogV3 has accepted plain JSON.
// Keep defensive copies without the general structured-clone serialization cost.
export function cloneCatalogValue(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneCatalogValue);
  const copy = {};
  for (const key of Object.keys(value)) copy[key] = cloneCatalogValue(value[key]);
  return copy;
}
/** Sources/options default off for private packs; no implicit override or executable pack code. */
export function createCatalogIndex(
  packs,
  { distribution = "private", enabledPackIds = [], enabledOptions = [] } = {},
) {
  check(Array.isArray(packs) && packs.length <= 100, "Pack limit");
  list(enabledPackIds, "Enabled packs");
  list(enabledOptions, "Enabled options");
  const entries = new Map(),
    packIds = new Set();
  for (const p of packs) {
    validateCatalogV3(p, { distribution });
    check(!packIds.has(p.id), "Duplicate pack ID");
    packIds.add(p.id);
    if (
      p.items.some((i) => !["srd","reference"].includes(i.source.kind)) &&
      !enabledPackIds.includes(p.id)
    )
      continue;
    for (const i of p.items) {
      if (
        i.data.campaignOption &&
        !enabledOptions.includes(i.data.campaignOption)
      )
        continue;
      check(!entries.has(i.id), "Catalogue collision: " + i.id);
      entries.set(i.id, structuredClone(i));
    }
  }
  const classes = new Map(
    [...entries.values()]
      .filter((i) => i.type === "class")
      .map((i) => [i.data.classId, i]),
  );
  check(
    classes.size ===
      [...entries.values()].filter((i) => i.type === "class").length,
    "Duplicate class key",
  );
  for (const i of entries.values()) {
    const d = i.data;
    for (const field of ["aliases", "reviewNotes"])
      if (d[field] !== undefined)
        check(
          Array.isArray(d[field]) &&
            d[field].length <= 100 &&
            d[field].every((v) => typeof v === "string" && v.length <= 2000),
          "Safe display metadata",
        );
    if(d.grantedFeatIds){check(i.type==='background','Background feat grants');list(d.grantedFeatIds,'Granted feat IDs');}
    if(d.conditionalProficiencies){check(i.type==='background'&&Array.isArray(d.conditionalProficiencies),'Conditional background training');for(const row of d.conditionalProficiencies){check(id(row.key)&&id(row.optionId),'Conditional training choice');list(row.values,'Conditional training values');}}
    if(d.selectionRequiresAny!==undefined)list(d.selectionRequiresAny,'Alternative prerequisites');
    if (d.incompatible !== undefined)
      list(d.incompatible, "Incompatible entries");
    if (["feature", "subclass"].includes(i.type))
      check(classes.has(d.classId), "Missing class: " + d.classId);
    for (const cls of d.classIds ?? [])
      check(classes.has(cls), "Missing spell class: " + cls);
    for (const sid of d.subclassIds ?? [])
      check(
        entries.get(sid)?.type === "subclass" &&
          entries.get(sid).data.classId === d.classId,
        "Subclass reference",
      );
    for (const row of d.grants ?? [])
      for (const fid of row.featureIds)
        check(
          entries.get(fid)?.type === "feature" &&
            entries.get(fid).data.classId === d.classId,
          "Feature reference: " + fid,
        );
    for (const q of d.choices ?? []) {
      if (q.subclassId)
        check(
          entries.get(q.subclassId)?.type === "subclass",
          "Choice subclass reference",
        );
      if (q.requiresSelected)
        check(entries.has(q.requiresSelected), "Choice prerequisite reference");
      if (q.kind === "feature")
        for (const ref of q.options)
          check(
            entries.get(ref)?.type === "feature",
            "Choice feature reference",
          );
      if (
        ["spell", "spell-mastery", "signature-spell", "ritual-spell"].includes(
          q.kind,
        )
      )
        for (const ref of q.options)
          check(entries.get(ref)?.type === "spell", "Choice spell reference");
    }
    for(const row of d.innateSpells??[])for(const ref of row.spellIds)check(entries.get(ref)?.type==='spell','Feature spell reference');
    for (const row of d.extraSpells ?? []) {
      check(
        integer(row.classLevel, 1, 20) &&
          ["prepared", "known", "expanded", "book"].includes(row.mode),
        "Extra spell grant",
      );
      list(row.spellIds, "Extra spells");
      for (const ref of row.spellIds)
        check(entries.get(ref)?.type === "spell", "Extra spell reference");
    }
    for (const ref of [
      ...(d.requires ?? []),
      ...(d.replaces ?? []),
      ...(d.incompatible ?? []),
    ])
      check(entries.has(ref), "Missing reference: " + ref);
  }
  const visiting = new Set(),
    visited = new Set();
  function visit(key, depth = 0) {
    check(depth < 100, "Catalogue dependency depth");
    check(!visiting.has(key), "Catalogue dependency cycle");
    if (visited.has(key)) return;
    visiting.add(key);
    for (const ref of [
      ...(entries.get(key).data.requires ?? []),
      ...(entries.get(key).data.replaces ?? []),
    ])
      visit(ref, depth + 1);
    visiting.delete(key);
    visited.add(key);
  }
  for (const key of entries.keys()) visit(key);
  // Do not expose mutable cached definitions or mutable Map internals.
  return Object.freeze({
    get: (key) => cloneCatalogValue(entries.get(key)),
    list: (type) =>
      [...entries.values()]
        .filter((i) => !type || i.type === type)
        .map((i) => cloneCatalogValue(i)),
    class: (cls) => cloneCatalogValue(classes.get(cls)),
    size: entries.size,
  });
}
