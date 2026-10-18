import {validateProfile,profileExecutable} from '../rules/combat.js';
import {check,keys,integer,id,source,ABILITIES,SKILLS,text} from './contracts.js';
import {diceSpec,validateDefinition} from '../model.js';
export function expression(e, stats, depth=0) {
  check(depth<12,'Expression depth');
  if(typeof e==='number') {check(integer(e,-100000,100000),'Expression constant');return e;}
  if(e && Object.hasOwn(e,'ref')) {keys(e,['ref']);check(Object.hasOwn(stats,e.ref),'Unknown statistic reference');return stats[e.ref];}
  keys(e,['op','args']);
  check(['add','multiply','max','min','floor','ceil'].includes(e.op) && Array.isArray(e.args) && e.args.length>0 && e.args.length<=20,'Expression primitive');
  const a=e.args.map(v=>expression(v,stats,depth+1));
  if(['floor','ceil'].includes(e.op)) {check(a.length===1,'Unary expression');return Math[e.op](a[0]);}
  const n=e.op==='add'?a.reduce((x,y)=>x+y,0):e.op==='multiply'?a.reduce((x,y)=>x*y,1):Math[e.op](...a);
  check(Number.isFinite(n) && Math.abs(n)<=1000000,'Expression bounds');return n;
}
export function resourceDefinitions(d,stats) {
  return Object.fromEntries(d.resources.map(r=>{
    keys(r,['id','max','recovery','source']);source(r.source);
    const max=expression(r.max,stats);check(id(r.id) && integer(max) && ['short','long','none'].includes(r.recovery),'Resource rule');
    return [r.id,{max,recovery:r.recovery}];
  }));
}
/** Fail closed: descriptive mechanics never become executable through silent field removal. */
export function abilityCoverage(a) {
  keys(a,['id','name','kind','cost','target','maxTargets','attackAction','attack','resource','effects','concentration','conditions','save','duration','triggers','source','combat'],['id','name','kind','cost','target','maxTargets','attackAction','attack','resource','effects','concentration','conditions','save','duration','triggers','source']);
  source(a.source);
  check(id(a.id) && text(a.name) && a.name.length>0 && ['weapon','spell','class','racial','feat','item','custom','passive'].includes(a.kind),'Ability identity');
  check(['action','bonus','reaction','none'].includes(a.cost) && ['self','selected'].includes(a.target) && integer(a.maxTargets,1,20) && typeof a.attackAction==='boolean','Ability activation');
  check(Array.isArray(a.effects) && Array.isArray(a.conditions) && Array.isArray(a.triggers) && a.conditions.every(text) && a.triggers.every(text),'Ability conditions');
  if(a.duration!==null) {keys(a.duration,['unit','value']);check(['round','minute','hour','until-rest'].includes(a.duration.unit) && integer(a.duration.value,1),'Duration');}
  if(a.save!==null) {keys(a.save,['ability','dc','onSuccess']);check(ABILITIES.includes(a.save.ability) && ['none','half'].includes(a.save.onSuccess),'Save');}
  if(a.attack!==null) {keys(a.attack,['bonus']);}
  if(a.resource!==null) {keys(a.resource,['id','amount']);check(id(a.resource.id) && integer(a.resource.amount,1),'Ability cost');}
  if(a.concentration!==null) {keys(a.concentration,['effectId','start']);check(id(a.concentration.effectId) && ['activation','hit'].includes(a.concentration.start),'Concentration');}
  if(a.combat!==undefined) validateProfile(a.combat);
  const p=a.combat,reasons=[];
  if(a.kind==='spell' && !p?.spell) reasons.push('spell-cast-profile');
  if(p && !profileExecutable(p)) reasons.push(...p.requirements,...(p.deferred??[]));
  if(p && p.mode!=='automatic') reasons.push('mode:'+p.mode);
  if(a.kind==='passive') reasons.push('passive');
  for(const k of ['conditions','triggers']) if(a[k].length) reasons.push(k);
  if(a.save!==null && !p) reasons.push('saving-throw');
  if(a.duration!==null) reasons.push('timed-effects');
  for(const e of a.effects) {
    check(e && ['damage','heal','tempHp','condition','modifier','grantAction','move','summon'].includes(e.kind),'Unknown effect primitive');
    if(['damage','heal','tempHp'].includes(e.kind)) {
      keys(e,['kind','amount','dice','damageType','when'],['kind']);
      if(e.when!==undefined) check(['always','success','failure'].includes(e.when) && a.save!==null,'Conditional save effect');
      check((e.amount===undefined)!==(e.dice===undefined),'Effect value');
      if(e.dice!==undefined) {if(typeof e.dice==='string') diceSpec(e.dice);else {keys(e.dice,['count','sides','bonus']);check(integer(e.dice.count,1,50) && integer(e.dice.sides,2,100),'Dice template');}}
      if(e.kind==='damage') check(id(e.damageType),'Damage type');
      else check(e.damageType===undefined,'Unexpected damage type');
    } else {
      keys(e,['kind','parameters']);check(e.parameters && typeof e.parameters==='object' && !Array.isArray(e.parameters),'Effect parameters');reasons.push('effect:'+e.kind);
    }
  }
  const hasSupportedEffects=a.effects.some(e=>['damage','heal','tempHp'].includes(e.kind)) || !!p?.ongoing?.length || !!p?.grant;
  return {status:reasons.length?'represented':'executable',coverageStatus:p?.mode==='manual'?'manual':p?.mode==='referenced'?'referenced':reasons.length?(hasSupportedEffects && !p?.requirements.length?'partial':'unsupported'):'automated',reasons:[...new Set(reasons)]};
}
export function compileAbilities(d,stats,resources) {
  const abilities={},coverage={};
  for(const a of d.abilities) {
    const c=abilityCoverage(a);coverage[a.id]=c;
    if(a.resource!==null) check(Object.hasOwn(resources,a.resource.id),'Unknown resource');
    // Resolve/validate all numeric expressions even on represented-only abilities.
    const attack=a.attack===null?null:{bonus:expression(a.attack.bonus,stats)};
    if(attack) check(integer(attack.bonus,-20,100),'Attack bonus');
    if(a.save!==null) check(integer(expression(a.save.dc,stats),1,100),'Save DC');
    const effects=a.effects.map(e=>{
      const out=structuredClone(e);
      if(e.amount!==undefined) out.amount=expression(e.amount,stats);
      if(e.dice && typeof e.dice==='object') {const n=expression(e.dice.bonus,stats);check(integer(n,-9999,9999),'Dice bonus');out.dice=e.dice.count+'d'+e.dice.sides+(n<0?'':'+')+n;}
      return out;
    });
    if(c.status!=='executable' && a.combat?.mode!=='manual') continue;
    const manual=a.combat?.mode==='manual';
    const out={name:a.name,cost:a.cost,target:a.target,maxTargets:a.maxTargets,effects:manual?[]:effects};
    if(manual) out.manualPlan=structuredClone({effects:a.effects,conditions:a.conditions,triggers:a.triggers,save:a.save,duration:a.duration});
    if(a.combat) {
      out.combat=structuredClone(a.combat);
      if(out.combat.spell) {
        const r=out.combat.spell;
        check(d.classes.some(c=>c.id===r.classId && c.casting),'Spellcasting source');
        const castingClass=d.classes.find(c=>c.id===r.classId),progression=castingClass.casting.progression,level=castingClass.level;
        const cap=progression==='pact'?Math.min(5,Math.ceil(level/2)):progression==='full'?Math.ceil(level/2):progression==='half'?(level<(castingClass.casting.startsAtClassLevel??2)?0:Math.ceil(level/4)):(level<(castingClass.casting.startsAtClassLevel??3)?0:Math.ceil(level/6));
        r.available=(r.access==='granted' || r.level<=cap) && (r.access==='granted'?d.features:r.access==='prepared'?d.spells.prepared:d.spells.known).includes(r.id);
        if(!r.available) {coverage[a.id]={status:'represented',coverageStatus:'unsupported',reasons:['spell-unavailable']};continue;}
      }
    }
    if(a.save!==null && !manual) out.save={...a.save,dc:expression(a.save.dc,stats)};
    if(a.attackAction) out.attackAction=true;
    if(attack) out.attack=attack;
    if(a.resource!==null) out.resource=structuredClone(a.resource);
    if(a.concentration!==null) out.concentration=structuredClone(a.concentration);
    abilities[a.id]=out;
  }
  // Reuse V0.1 strict numeric contracts; no parallel executor.
  validateDefinition({id:d.id,name:d.identity.name,level:stats.level,maxHp:stats.maxHp,ac:stats.ac,attacksPerAction:stats.attacksPerAction,saves:{con:stats['save.con']},resources,abilities,...d.defenses});
  return {abilities,coverage};
}

export function validateRuleData(d) {
  const refs=['level','proficiency','attacksPerAction','maxHp','ac','speed','initiative','untrainedCheckBonus','untrainedPhysicalCheckBonus','rangedWeaponAttackBonus',
    ...ABILITIES.flatMap(k=>['mod.'+k,'save.'+k,'checkBonus.'+k]),
    ...Object.keys(SKILLS).map(k=>'skill.'+k),
    ...d.classes.flatMap(c=>['class.'+c.id,'spellAttack.'+c.id,'spellDC.'+c.id]),
    ...d.equipment.filter(e=>e.weapon!==null).flatMap(e=>['weaponAttack.'+e.id,'weaponDamage.'+e.id])];
  const stats=Object.fromEntries(refs.map(k=>[k,1]));
  for(const r of d.resources) {
    keys(r,['id','max','recovery','source']);source(r.source);
    check(id(r.id) && ['short','long','none'].includes(r.recovery),'Resource shape');expression(r.max,stats);
  }
  for(const a of d.abilities) {
    abilityCoverage(a);
    if(a.resource!==null) check(d.resources.some(r=>r.id===a.resource.id) || /^slot[1-9]$/.test(a.resource.id) || d.classes.some(c=>c.casting?.progression==='pact' && a.resource.id==='pact:'+c.id),'Unknown ability resource');
    if(a.attack!==null) expression(a.attack.bonus,stats);
    if(a.save!==null) expression(a.save.dc,stats);
    for(const e of a.effects) {
      if(e.amount!==undefined) expression(e.amount,stats);
      if(e.dice && typeof e.dice==='object') expression(e.dice.bonus,stats);
    }
  }
  for(const m of d.modifiers) {
    keys(m,['id','stat','operation','value','reason','source','condition'],['id','stat','operation','value','reason','source']);if(m.condition!==undefined)check(['wearing-armor','wearing-heavy-armor'].includes(m.condition),'Modifier condition');source(m.source);
    check(id(m.id) && refs.includes(m.stat) && !m.stat.startsWith('class.') && !m.stat.startsWith('mod.') && ['add','set','max'].includes(m.operation) && typeof m.reason==='string' && m.reason.trim(),'Modifier shape');
    expression(m.value,stats);
  }
  return d;
}
