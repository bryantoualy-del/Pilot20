import {invocationEligible} from './warlock-invocations.js';
import { resolveOrigins } from "./origins.js";
import {validateGrantReplacements,resolveSpellGrants} from './spell-grants.js';
import {canonicalProficiency} from './proficiencies.js';
import {
  check,
  integer,
  id,
  json,
  ABILITIES,
  SKILLS,
} from "../character/contracts.js";
import { spellSlots, modifier } from "../character/derive.js";
export const listClasses = (index) => index.list("class");
export const listSubclasses = (index, classId) =>
  index.list("subclass").filter((i) => i.data.classId === classId);
export const getProgression = (index, classId) => {
  const c = index.class(classId);
  check(c, "Unknown class");
  return c.data.grants;
};
export const listSpells = (
  index,
  classId,
  { maximumLevel = 9, minimumLevel = 0 } = {},
) =>
  index
    .list("spell")
    .filter(
      (i) =>
        i.data.classIds.includes(classId) &&
        i.data.level <= maximumLevel &&
        i.data.level >= minimumLevel,
    );
export const meetsPrerequisites = (scores, anyOf) =>
  anyOf.some((all) => all.every((p) => scores[p.score] >= p.minimum));
/** A subclass may supply casting; the fighter/rogue class itself remains nonmagical. */
export function effectiveClassData(index,c){
 const base=index.class(c.id)?.data,sub=c.subclassId?index.get(c.subclassId):null;
 if(!base)return base;
 const out={...base};if(sub?.data.classId===c.id&&c.level>=base.subclassLevel)for(const key of ['casting','cantripsKnown','spellsKnown','spellListClassId','unrestrictedSpellsKnown','restrictedSpellSchools','acquisitionPolicy'])if(sub.data[key]!==undefined)out[key]=sub.data[key];
 for(const f of index.list('feature'))if(f.data.optionalClassFeature&&f.data.classId===c.id&&c.level>=f.data.minimumClassLevel&&f.data.acquisitionPolicyOverride)out.acquisitionPolicy={...out.acquisitionPolicy,...f.data.acquisitionPolicyOverride};
 return out;
}
/** Resolves a current build, never silently chooses. All acquisition levels are class levels. */
export function resolveProgression(index, request) {
  let {
    classes,
    scores,
    selections = {},
    campaignOptions = [],
    background = { skills: [], proficiencies: [] },
    spellbookTranscriptions = [],
    spellGrantReplacements = [],
  } = request;
  validateGrantReplacements(spellGrantReplacements);
  const origin = resolveOrigins(index, {
    ...request,
    campaignOptions,
    background,
  });
  scores = origin.scores;
  background = origin.background;
  json({
    classes,
    scores,
    selections,
    campaignOptions,
    background,
    spellbookTranscriptions,
  });
  check(
    Array.isArray(background.skills) &&
      background.skills.every((k) => Object.hasOwn(SKILLS, k)) &&
      new Set(background.skills).size === background.skills.length &&
      Array.isArray(background.proficiencies) &&
      background.proficiencies.every(id),
    "Explicit background proficiencies",
  );
  check(
    Array.isArray(classes) &&
      classes.length > 0 &&
      new Set(classes.map((c) => c.id)).size === classes.length,
    "Distinct classes",
  );
  check(
    ABILITIES.every((a) => integer(scores[a], 1, 30)),
    "Scores",
  );
  check(
    classes.every((c) => id(c.id) && integer(c.level, 1, 20)) &&
      classes.reduce((n, c) => n + c.level, 0) <= 20,
    "Class levels",
  );
  const adjustedScores = { ...scores };
  for (const c of classes)
    for (const spec of index.class(c.id)?.data.choices ?? [])
      if (spec.kind === "asi" && spec.level <= c.level)
        for (const v of selections[c.id + ":" + spec.key] ?? [])
          if (spec.options.includes(v) && v.startsWith("asi:")) {
            const [, a, b] = v.split(":");
            adjustedScores[a]++;
            adjustedScores[b]++;
          }
  const scoresBeforeFeatureIncreases={...adjustedScores},scoreFeatures=new Set(origin.featIds??[]);
  for(const c of classes){for(const row of [...(index.class(c.id)?.data.grants??[]),...(index.get(c.subclassId)?.data.grants??[])])if(row.level<=c.level)for(const id of row.featureIds)scoreFeatures.add(id);}
  for(const id of Object.values(selections).flat())if(index.get(id)?.type==='feature')scoreFeatures.add(id);
  for(const id of scoreFeatures){const f=index.get(id),owner=classes.find(c=>c.id===f?.data.classId),effect=f?.data.buildEffects;if(!owner||owner.level<(f.data.minimumClassLevel??1)||owner.level<(effect?.minimumClassLevel??1))continue;for(const [a,row]of Object.entries(effect?.scoreIncreases??{}))adjustedScores[a]=Math.max(adjustedScores[a],Math.min(row.maximum,adjustedScores[a]+row.amount));}
  const features = new Set(origin.featIds ?? []),
    resources = [],
    choices = [],
    issues = [...origin.issues],
    castingClasses = [],
    scaling = {},
    grantedSpells = [],
    suppressedChoices = new Set(),
    suppressedResources = new Set();
  const optional = index
    .list("feature")
    .filter(
      (f) =>
        f.data.optionalClassFeature &&
        classes.some(
          (c) => c.id === f.data.classId && c.level >= f.data.minimumClassLevel,
        ),
    );
  const replacementOwners = new Map();
  for(const swap of spellGrantReplacements)if(!classes.some(c=>c.subclassId===swap.originId))issues.push({code:'invalid-granted-spell-replacement',id:swap.spellId});
  for (const f of optional) {
    for (const key of f.data.suppressesChoices ?? [])
      suppressedChoices.add(f.data.classId + ":" + key);
    for (const key of f.data.suppressesResources ?? [])
      suppressedResources.add(f.data.classId + ":" + key);
    for (const old of f.data.replaces ?? []) {
      if (replacementOwners.has(old))
        issues.push({ code: "ambiguous-replacement", featureId: old });
      replacementOwners.set(old, f.id);
    }
  }
  const selected = new Set(Object.values(selections).flat());
  const addChoice = (cls, key, level, count, options, kind, metadata = {}) =>
    choices.push({
      id: cls + ":" + key,
      classId: cls,
      level,
      count,
      options,
      kind,
      ...metadata,
    });
  const proficientSkills = new Set(background.skills);
  for (const c of classes) {
    const d = index.class(c.id)?.data;
    for (const key of [
      "skills",
      ...(d?.choices ?? []).filter((q) => q.kind === "skill").map((q) => q.key),
    ])
      for (const v of selections[c.id + ":" + key] ?? [])
        if (Object.hasOwn(SKILLS, v)) proficientSkills.add(v);
  }
  for (const [position, c] of classes.entries()) {
    const entry = index.class(c.id);
    check(entry, "Unknown class: " + c.id);
    const d = effectiveClassData(index,c),
      L = c.level;
    if (
      classes.length > 1 &&
      !meetsPrerequisites(adjustedScores, d.multiclassPrerequisites)
    )
      issues.push({ code: "multiclass-prerequisite", classId: c.id });
    if (
      selections[c.id + ":subclass"] &&
      selections[c.id + ":subclass"][0] !== c.subclassId
    )
      issues.push({ code: "subclass-definition-mismatch", classId: c.id });
    const sub = c.subclassId ? index.get(c.subclassId) : null;
    if (c.subclassId)
      check(
        sub?.type === "subclass" &&
          sub.data.classId === c.id &&
          L >= d.subclassLevel,
        "Invalid subclass",
      );
    if (L >= d.subclassLevel)
      addChoice(
        c.id,
        "subclass",
        d.subclassLevel,
        1,
        listSubclasses(index, c.id).map((x) => x.id),
        "subclass",
      );
    for (const row of [...d.grants, ...(sub?.data.grants ?? [])])
      if (row.level <= L) row.featureIds.forEach((id) => features.add(id));
    for (const f of optional.filter((f) => f.data.classId === c.id))
      features.add(f.id);
    if (d.casting)
      castingClasses.push({ id: c.id, level: L, casting: d.casting });
    const pool = spellSlots([{ id: c.id, level: L, casting: d.casting }]);
    const maxSpell = Math.max(
      0,
      ...Object.values(pool.resources).map((x) => x.slotLevel),
    );
    scaling[c.id] = Object.fromEntries(
      Object.entries(d.scaling ?? {}).map(([k, v]) => [k, v[L - 1]]),
    );
    const extraSpells = [
      ...(sub?.data.extraSpells ?? []).map(r=>({...r,ownerId:sub.id})),
      ...[...selected].flatMap((id) => {
        const d = index.get(id)?.data;
        return d?.classId === c.id ? (d.extraSpells ?? []).map(r=>({...r,ownerId:id})) : [];
      }),
    ].filter((r) => r.classLevel <= L);
    const grants=resolveSpellGrants(index,c,extraSpells,spellGrantReplacements);grantedSpells.push(...grants.rows);issues.push(...grants.issues);
    const allowedSpells = (minimumLevel = 1) => [
      ...new Set([
        ...listSpells(index, d.spellListClassId??c.id, {
          minimumLevel,
          maximumLevel: maxSpell,
        }).map((s) => s.id).filter(id=>!grantedSpells.some(g=>g.classId===c.id&&g.mode==='known'&&g.id===id)),
        ...extraSpells
          .filter(r=>r.mode!=='known')
          .flatMap((r) => r.spellIds)
          .filter((id) => index.get(id).data.level >= minimumLevel),
      ]),
    ];
    for (const r of [...(d.resources ?? []).map(r=>({...r,ownerId:entry.id})), ...(sub?.data.resources ?? []).map(r=>({...r,ownerId:sub.id}))]) {
      if (suppressedResources.has(c.id + ":" + r.id)) continue;
      let n = r.maxByLevel[L - 1];
      if (n && typeof n === "object")
        n =
          Math.max(n.minimum, n.proficiency?2+Math.floor((classes.reduce((s,c)=>s+c.level,0)-1)/4):modifier(adjustedScores[n.ability])) * (n.multiplier??1) +
          (n.add ?? 0);
      if (n === 0) continue;
      resources.push({
        id: c.id + ":" + r.id,
        max: n,
        recovery: L >= (r.shortRestFromLevel ?? 21) ? "short" : r.recovery,
        unlimited: n === null,
        classId: c.id,
        ownerId:r.ownerId,
        ...(r.recharge ? { recharge: r.recharge } : {}),
      });
    }
    const skillCount =
      position === 0
        ? d.skillChoice.count
        : ["bard", "ranger", "rogue"].includes(c.id)
          ? 1
          : 0;
    if (skillCount)
      addChoice(c.id, "skills", 1, skillCount, d.skillChoice.options, "skill");
    for (const spec of [
      ...(d.choices ?? []),
      ...(sub?.data.choices ?? []),
      ...optional
        .filter((f) => f.data.classId === c.id)
        .flatMap((f) => f.data.choices ?? []),
    ]) {
      if (suppressedChoices.has(c.id + ":" + spec.key)) continue;
      if (
        spec.requiresChoice &&
        !(selections[c.id + ":" + spec.requiresChoice.key] ?? []).includes(
          spec.requiresChoice.optionId,
        )
      )
        continue;
      if (
        spec.level > L ||
        (spec.subclassId && spec.subclassId !== c.subclassId) ||
        (spec.requiresSelected && !selected.has(spec.requiresSelected))
      )
        continue;
      if (position > 0 && ["instruments", "tool"].includes(spec.key)) {
        if (c.id === "bard")
          addChoice(c.id, spec.key, 1, 1, spec.options, spec.kind);
        continue;
      }
      let options = spec.spellList?listSpells(index,spec.spellList.classId,{minimumLevel:spec.spellList.minimumLevel,maximumLevel:spec.spellList.maximumLevel}).map(s=>s.id):spec.options;
      if(spec.kind==='feature')options=options.filter(id=>{const key=index.get(id)?.data.uniqueRuleKey;return !key||!Object.entries(selections).filter(([choice])=>choice!==c.id+':'+spec.key).flatMap(([,values])=>values).some(other=>index.get(other)?.data.uniqueRuleKey===key);});
      if(spec.kind==='proficiency'&&!spec.toolReplacementFor)options=options.filter(id=>!background.proficiencies.some(p=>canonicalProficiency(p)===canonicalProficiency(id)));
      if(spec.filterAvailableFeatures) options=options.filter(id=>{const f=index.get(id);return f?.type==='feature'&&f.data.classId===c.id&&f.data.minimumClassLevel<=L&&(f.data.selectionRequires??[]).every(id=>selected.has(id)||features.has(id));});
      if(spec.toolReplacementFor){
        const owned=new Set([...background.proficiencies,...classes.flatMap((cl,n)=>index.class(cl.id).data[n===0?'initialProficiencies':'multiclassProficiencies']),...Object.entries(selections).filter(([id])=>id!==c.id+':'+spec.key&&!id.endsWith(':skills')).flatMap(([,v])=>v)].map(canonicalProficiency));
        options=owned.has(canonicalProficiency(spec.toolReplacementFor))?options.filter(id=>!owned.has(canonicalProficiency(id))):[spec.toolReplacementFor];
      }
      if (spec.kind === "asi" && campaignOptions.includes("feats"))
        options = options.concat(
          index
            .list("feat")
            .filter((f) =>
              (f.data.requiresScores ?? []).every(
                (p) => adjustedScores[p.score] >= p.minimum,
              ),
            )
            .map((f) => f.id),
        );
      if (spec.requiresKnown)
        options = options.filter((id) =>
          (selections[c.id + ":spellbook"] ?? []).includes(id),
        );
      if (spec.kind === "expertise")
        options = [
          ...new Set(
            (spec.expertiseFromChoice?(selections[c.id+':'+spec.expertiseFromChoice]??[]):[...proficientSkills]).concat(
              c.id === "rogue" ? ["thieves-tools"] : [],
            ),
          ),
        ];
      addChoice(
        c.id,
        spec.key,
        spec.level,
        spec.countByLevel?.[L - 1] ?? spec.count,
        options,
        spec.kind,
        {
          ownerId:
            spec.subclassId ??
            (sub?.data.choices?.includes(spec)
              ? sub.id
              : (optional.find((f) => f.data.choices?.includes(spec))?.id ??
                entry.id)),
          ...(spec.distinctGroup ? { distinctGroup: spec.distinctGroup } : {}),
          ...(spec.adjudication ? { adjudication: spec.adjudication } : {}),
        },
      );
    }
    if (d.invocationsKnown?.[L - 1])
      addChoice(
        c.id,
        "invocations",
        2,
        d.invocationsKnown[L - 1],
        index
          .list("feature")
          .filter(
            (f) =>
              invocationEligible(f,{classId:c.id,level:L,selections:selected,features}),
          )
          .map((f) => f.id),
        "feature",
      );
    if (d.cantripsKnown?.[L - 1])
      addChoice(
        c.id,
        "cantrips",
        1,
        d.cantripsKnown[L - 1],
        listSpells(index, d.spellListClassId??c.id, { maximumLevel: 0 }).filter(s=>!grantedSpells.some(g=>g.classId===c.id&&g.id===s.id)).map((s) => s.id),
        "spell",
      );
    if (d.spellsKnown?.[L - 1]) {
      let count = d.spellsKnown[L - 1];
      if (c.id === "bard")
        count -= (L >= 10 ? 2 : 0) + (L >= 14 ? 2 : 0) + (L >= 18 ? 2 : 0);
      addChoice(
        c.id,
        "known-spells",
        d.casting.progression === "half" ? 2 : 1,
        count-(d.unrestrictedSpellsKnown?.[L-1]??0),
        d.restrictedSpellSchools?allowedSpells().filter(id=>d.restrictedSpellSchools.includes(index.get(id).data.school)):allowedSpells(),
        "spell",
      );
      if(d.unrestrictedSpellsKnown?.[L-1])addChoice(c.id,'known-free-spells',3,d.unrestrictedSpellsKnown[L-1],allowedSpells(),'spell');
    }
    if (c.id === "wizard") {
      const extras = spellbookTranscriptions.filter(
        (t) =>
          t.classId === c.id &&
          t.characterLevel <= classes.reduce((n, c) => n + c.level, 0),
      );
      addChoice(
        c.id,
        "spellbook",
        1,
        6 + 2 * (L - 1) + extras.length,
        allowedSpells(),
        "spellbook",
      );
    }
    if (
      (["cleric", "druid", "paladin", "wizard"].includes(c.id) ||
        d.casting?.preparation) &&
      maxSpell
    ) {
      const count = Math.max(
        1,
        modifier(adjustedScores[d.casting.ability]) +
          (d.casting.preparation === "ability-plus-half-level" ||
          (!d.casting.preparation && d.casting.progression === "half")
            ? Math.floor(L / 2)
            : L),
      );
      const options =
        c.id === "wizard"
          ? (selections[c.id + ":spellbook"] ?? []).filter(
              (id) =>
                !(selections[c.id + ":signature-spells"] ?? []).includes(id),
            )
          : allowedSpells().filter(
              (id) =>
                !grantedSpells.some((s) => s.classId === c.id && s.id === id),
            );
      addChoice(c.id, "prepared", 1, count, options, "prepared",{minimumCount:0});
    }
    if (c.id === "bard")
      for (const lv of [
        10,
        14,
        18,
        ...(sub?.id === "srd51:college-of-lore" ? [6] : []),
      ])
        if (L >= lv){
          const acquisitionMaximum=Math.max(0,...Object.values(spellSlots([{id:c.id,level:lv,casting:d.casting}]).resources).map(r=>r.slotLevel)),replacementList=new Set(allowedSpells(0));
          addChoice(c.id,"magical-secrets-"+lv,lv,2,index.list("spell").filter(s=>s.data.level<=acquisitionMaximum||s.data.level<=maxSpell&&replacementList.has(s.id)).map(s=>s.id),"spell",{acquisitionMaximumSpellLevel:acquisitionMaximum});
        }
    if (c.id === "warlock")
      for (const [lv, spellLevel] of [
        [11, 6],
        [13, 7],
        [15, 8],
        [17, 9],
      ])
        if (L >= lv)
          addChoice(
            c.id,
            "arcanum-" + spellLevel,
            lv,
            1,
            listSpells(index, c.id, {
              minimumLevel: spellLevel,
              maximumLevel: spellLevel,
            }).map((s) => s.id),
            "spell",
          );
  }
  // Subclass is explicit in classes. Preserve one consistent source for selection records.
  const effectiveSelections = { ...selections };
  for (const c of classes)
    if (c.subclassId) effectiveSelections[c.id + ":subclass"] = [c.subclassId];
  const expertise = new Set(),
    skillSelections = new Set(background.skills),
    featureSelections = new Set(),
    distinctGroups = new Map();
  for (const choice of choices) {
    if(choice.kind==='prepared'&&effectiveSelections[choice.id]===undefined)effectiveSelections[choice.id]=[];
    const values = effectiveSelections[choice.id];
    if (!values) {
      issues.push({ code: "required-choice", choiceId: choice.id });
      continue;
    }
    if (
      !Array.isArray(values) ||
      (values.length < (choice.minimumCount??choice.count) || values.length > choice.count) ||
      new Set(values).size !== values.length ||
      values.some((k) => !choice.options.includes(k))
    ) {
      issues.push({ code: "invalid-choice", choiceId: choice.id });
      continue;
    }
    if (choice.distinctGroup)
      for (const v of values) {
        const seen = distinctGroups.get(choice.distinctGroup) ?? new Set();
        if (v !== "language:none" && seen.has(v))
          issues.push({ code: "duplicate-choice-group", choiceId: choice.id });
        seen.add(v);
        distinctGroups.set(choice.distinctGroup, seen);
      }
    if (choice.kind === "skill")
      for (const v of values) {
        if (skillSelections.has(v))
          issues.push({ code: "duplicate-skill", choiceId: choice.id });
        skillSelections.add(v);
      }
    if (choice.kind === "feature")
      for (const v of values) {
        if (featureSelections.has(v) && !v.endsWith(":two-humanoid-races"))
          issues.push({
            code: "duplicate-feature-option",
            choiceId: choice.id,
          });
        featureSelections.add(v);
      }
    if (choice.kind === "expertise")
      for (const v of values) {
        if (expertise.has(v))
          issues.push({ code: "duplicate-expertise", choiceId: choice.id });
        expertise.add(v);
      }
    if (choice.kind === "feature") values.forEach((v) => features.add(v));
  }
  // Validate that above-acquisition Bard-list replacements could fit into actual
  // level gains. This does not create or certify any missing history.
  const secretReplacements=[];
  for(const q of choices.filter(q=>q.id.includes(':magical-secrets-')))for(const id of effectiveSelections[q.id]??[]){const spell=index.get(id);if(spell?.data.level>q.acquisitionMaximumSpellLevel){const cls=classes.find(c=>c.id===q.classId),casting=effectiveClassData(index,cls).casting;let earliest=cls.level+1;for(let lv=q.level+1;lv<=cls.level;lv++)if(Object.values(spellSlots([{id:cls.id,level:lv,casting}]).resources).some(r=>r.slotLevel>=spell.data.level)){earliest=lv;break;}secretReplacements.push({classId:cls.id,choiceId:q.id,earliest});}}
  for(const cls of classes){let available=cls.level;for(const row of secretReplacements.filter(r=>r.classId===cls.id).sort((a,b)=>b.earliest-a.earliest)){if(row.earliest>available)issues.push({code:'secret-replacement-budget',choiceId:row.choiceId});available--;}}
  const spellsByClass = new Map();
  for (const q of choices.filter((q) => q.kind === "spell"))
    for (const v of effectiveSelections[q.id] ?? []) {
      const seen = spellsByClass.get(q.classId) ?? new Set();
      if (seen.has(v))
        issues.push({ code: "duplicate-spell-choice", choiceId: q.id });
      seen.add(v);
      spellsByClass.set(q.classId, seen);
    }
  for (const key of Object.keys(effectiveSelections))
    if (!choices.some((c) => c.id === key))
      issues.push({ code: "obsolete-choice", choiceId: key });
  for (const choice of choices.filter((c) => c.kind === "asi"))
    for (const v of effectiveSelections[choice.id] ?? []) {
      if (!choice.options.includes(v)) continue;
      if (index.get(v)?.type === "feat") {
        features.add(v);
        continue;
      }
      const [, a, b] = v.split(":");
      if (scoresBeforeFeatureIncreases[a] > 20 || scoresBeforeFeatureIncreases[b] > 20)
        issues.push({ code: "asi-cap", choiceId: choice.id });
    }
  for (const t of spellbookTranscriptions) {
    check(
      t &&
        id(t.classId) &&
        id(t.spellId) &&
        integer(t.characterLevel, 1, 20) &&
        typeof t.reason === "string" &&
        t.reason.trim(),
      "Approved spellbook transcription",
    );
    const c = classes.find((c) => c.id === t.classId);
    if (
      !c ||
      t.characterLevel > classes.reduce((n, c) => n + c.level, 0) ||
      !(selections[t.classId + ":spellbook"] ?? []).includes(t.spellId)
    )
      issues.push({ code: "invalid-transcription", spellId: t.spellId });
  }
  check(
    new Set(spellbookTranscriptions.map((t) => t.classId + ":" + t.spellId))
      .size === spellbookTranscriptions.length,
    "Duplicate transcription",
  );
  // Optional feats are never silently enabled. Future packs may add feat choices.
  // Only enabled, source-authorized feats are offered; protected feats require a private pack.
  for (const f of optional)
    if ((f.data.requires ?? []).some((id) => !features.has(id)))
      issues.push({ code: "optional-feature-prerequisite", featureId: f.id });
  for (const fid of features)
    for (const other of index.get(fid)?.data.incompatible ?? [])
      if (features.has(other))
        issues.push({
          code: "optional-feature-incompatible",
          featureId: fid,
          otherFeatureId: other,
        });
  for (const fid of [...features])
    for (const replaced of index.get(fid)?.data.replaces ?? [])
      features.delete(replaced);
  for (const fid of features)
    for (const r of index.get(fid)?.data.resources ?? []) {
      const entry = index.get(fid),
        c = classes.find((c) => c.id === entry.data.classId);
      if (suppressedResources.has(c.id + ":" + r.id)) continue;
      let n = r.maxByLevel[c.level - 1];
      if (n && typeof n === "object")
        n =
          Math.max(n.minimum,n.proficiency?2+Math.floor((classes.reduce((s,c)=>s+c.level,0)-1)/4):modifier(adjustedScores[n.ability]))*(n.multiplier??1)+(n.add??0);
      if (n !== 0)
        resources.push({
          id: c.id + ":" + r.id,
          max: n,
          recovery: r.recovery,
          unlimited: n === null,
          classId: c.id,
          ownerId:fid,
          ...(r.recharge ? { recharge: r.recharge } : {}),
        });
    }
  check(
    new Set(resources.map((r) => r.id)).size === resources.length,
    "Duplicate resolved resource",
  );
  let unarmoredDefense=false;for(const c of classes){const id=index.class(c.id)?.data.armorRuleFeatureId;if(id&&features.has(id)){if(unarmoredDefense)features.delete(id);else unarmoredDefense=true;}}
  const uniqueRules=new Map();for(const id of features){const key=index.get(id)?.data.uniqueRuleKey;if(key){if(uniqueRules.has(key))issues.push({code:'duplicate-feature-rule',featureId:id,otherFeatureId:uniqueRules.get(key),choiceId:choices.find(q=>(effectiveSelections[q.id]??[]).includes(id))?.id});else uniqueRules.set(key,id);}}
  for(const fid of features){const feature=index.get(fid),owner=classes.find(c=>c.id===feature?.data.classId);for(const row of feature?.data.innateSpells??[])if(owner&&owner.level>=row.classLevel)for(const id of row.spellIds)origin.spells.push({id,level:row.classLevel,ability:row.ability,ownerId:fid,featureOwnerId:fid,...(row.resourceId?{resourceId:owner.id+':'+row.resourceId}:{}),...(row.economy?{economy:row.economy}:{}),...(row.target?{target:row.target}:{}),...(row.maxTargets?{maxTargets:row.maxTargets}:{}),requirements:row.requirements,source:feature.source});}
  return {
    origin,
    features: [...features],
    resources,
    choices,
    grantedSpells,
    manualRequirements: classes
      .flatMap((c) =>
        (index.class(c.id).data.manualRequirements ?? []).map((reason) => ({
          classId: c.id,
          reason,
        })),
      )
      .concat(
        choices
          .filter((q) => q.adjudication)
          .map((q) => ({
            classId: q.classId,
            choiceId: q.id,
            reason: q.adjudication,
          })),
        resources
          .filter((r) => r.recharge)
          .map((r) => ({
            classId: r.classId,
            resourceId: r.id,
            reason:
              "Recovery requires GM calendar adjudication: " +
              JSON.stringify(r.recharge),
          })),
      ),
    selections: effectiveSelections,
    issues,
    valid: issues.length === 0,
    scores: adjustedScores,
    scoresBeforeFeatureIncreases,
    featureHpBonus:[...features].reduce((n,id)=>{const f=index.get(id),c=classes.find(c=>c.id===f?.data.classId);return n+(f?.data.buildEffects?.hpPerClassLevel??0)*(c?.level??0);},0),
    scaling,
    slots: spellSlots(castingClasses),
    limits: [
      "Historical acquisition/replacement eligibility must be reviewed for high-level imports.",
      "Subclass effects beyond explicit spell grants remain manual.",
      "Resource maxima depending on ASIs are recalculated by the character compiler.",
    ],
  };
}
