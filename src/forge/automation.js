/** Forge -> existing combat contract. No separate resolver or character persistence. */
import { createSession, diceSpec, validateDefinition } from '../model.js';
import { execute } from '../engine.js';
import { conditionMet } from './engine.js';
import { instanceOf, newAbility, effect } from './model.js';

export const capabilityKinds = {
  attack:'Attaquer', damage:'Infliger des dégâts', heal:'Soigner', protect:'Protéger',
  spell:'Lancer un sort', transform:'Changer de forme', condition:'Appliquer un état',
  summon:'Invoquer', automatic:'Effet automatique', other:'Autre pouvoir',
};
export const triggerLabels = {'on-attack':'Attaque déclarée','on-hit':'Attaque réussie','on-miss':'Attaque ratée','on-critical':'Critique','damage-taken':'Dégâts subis','source-turn-start':'Début du tour du porteur','source-turn-end':'Fin du tour du porteur','target-turn-start':'Début du tour de la cible','target-turn-end':'Fin du tour de la cible','zone-enter':'Entrée dans une zone','zone-leave':'Sortie de zone','mode-change':'Changement de forme','rest':'Repos'};
export function guidedAbility(kind) {
  const a=newAbility(); a.name.fr=capabilityKinds[kind] ?? 'Autre pouvoir';
  const p={damage:['damage',{dice:'1d6',damageType:'fire',role:'standalone'}],attack:['damage',{dice:'1d8',damageType:'slashing',role:'weapon-base'}],heal:['healing',{dice:'1d8'}],protect:['modifier',{stat:'ac',value:2,operation:'add',scope:'wearer'}],spell:['cast-spell',{spellId:'forge:unresolved',level:null,dc:null,attackBonus:null}],transform:['mode-switch',{modeId:'forge:unresolved',exclusiveGroup:'forme'}],condition:['condition',{condition:'blinded',operation:'apply'}],automatic:['damage',{dice:'1d6',damageType:'fire',role:'standalone'}]};
  const [type,params]=p[kind]??['custom',{key:'forge:'+kind,summary:capabilityKinds[kind],payload:{},fallback:'manual'}];
  const e=effect(type,params); e.target={kind:['heal','protect','transform'].includes(kind)?'self':'creature',count:1,filter:null};
  if(kind==='automatic'){a.activation='triggered';e.trigger='target-turn-start';}
  if(kind==='attack') e.trigger='on-hit';
  if(kind==='protect'){a.activation='reaction'; e.duration={unit:'turn',value:1,endsAt:'start-of-source-turn'};}
  a.effects=[e];return a;
}
const costMap={action:'action','bonus-action':'bonus',reaction:'reaction',passive:'none',triggered:'none'};
const duration=d=> {
  if(!d || !['turn','round','minute'].includes(d.unit)||!Number.isInteger(d.value)||d.value<1||!d.endsAt||d.endsAt==='manual') return null;
  return {unit:d.unit,value:d.value,anchor:d.endsAt.includes('source')?'source':'target',boundary:d.endsAt.startsWith('start')?'start':'end'};
};
function baseActor(id, level=10) {return {id,name:id,level,maxHp:200,ac:15,attacksPerAction:1,saves:{str:0,dex:0,con:0,int:0,wis:0,cha:0},resources:{},abilities:{},resistances:[],immunities:[],vulnerabilities:[]};}
/** Fail closed: diagnostic is based on compilable mechanics, never mechanicsStatus. */
export function compileCapability(item,a,{instance,context={}}={}) {
  const missing=[],limitations=[],automated=[];
  const ability={name:a.name.fr,cost:costMap[a.activation]??'none',target:'selected',maxTargets:1,effects:[],combat:{version:1,mode:'automatic',requirements:[],ongoing:[]}};
  if(!Object.hasOwn(costMap,a.activation)) missing.push('Activation à préciser.');
  if(!a.effects.length) missing.push('Aucun effet défini.');
  const hasManual=c=>c && (c.op==='manual'||c.condition&&hasManual(c.condition)||c.conditions?.some(hasManual));
  if(hasManual(a.prerequisites)||a.effects.some(e=>e.conditions.some(hasManual))) limitations.push('Condition à arbitrer manuellement.');
  if(item.attunement.required===null) missing.push('Harmonisation à confirmer pour cet objet.');
  const grouped={};
  for(const c of a.costs){
    if(!item.resources.some(r=>r.id===c.resourceId)) missing.push('Réserve absente.');
    if(c.timing!=='on-use') limitations.push('Coût différé : adaptation réactive non reliée.');
    grouped[c.resourceId]=(grouped[c.resourceId]??0)+c.amount;
  }
  if(Object.keys(grouped).length>1) limitations.push('Plusieurs réserves : transaction de combat non reliée.');
  if(Object.keys(grouped).length===1) ability.resource={id:Object.keys(grouped)[0],amount:Object.values(grouped)[0]};
  for(const r of item.resources.filter(r=>Object.hasOwn(grouped,r.id))) if(r.lastCharge) limitations.push('Conséquence de dernière charge à résoudre.');
  const saves=[a.save,...a.effects.map(e=>e.save)].filter(Boolean);
  if(new Set(saves.map(s=>JSON.stringify(s))).size>1) limitations.push('Sauvegardes distinctes dans une même capacité non reliées.');
  const save=saves[0];
  if(save){
    if(!['half-damage','no-effect'].includes(save.success))missing.push('Conséquence du JdS réussi à préciser.');
    if(save.dc.kind==='formula')limitations.push('Formule de DD non interprétée.');
    ability.save={ability:save.ability,dc:save.dc.kind==='fixed'?save.dc.value:context.spellSaveDC??15,onSuccess:save.success==='half-damage'?'half':'none'};
  }
  const targets=a.effects.map(e=>e.target?.kind??'creature');
  if(new Set(targets).size>1) limitations.push('Cibles différentes par effet non reliées.');
  ability.target=targets[0]==='self'?'self':'selected';
  ability.maxTargets=Math.max(1,...a.effects.map(e=>e.target?.count??1));
  if(ability.maxTargets>20) limitations.push('Plus de vingt cibles.');
  if(a.area) limitations.push('Sélection géométrique des cibles de zone à relier à Encounter.');
  for(const e of a.effects){
    const t=e.templateId.split(':').at(-1),p=e.params;
    if(t==='cast-spell' && (!p.spellId || p.spellId==='forge:unresolved'))missing.push('Sort à choisir.');
    if(t==='mode-switch' && !item.modes.some(m=>m.id===p.modeId))missing.push('Forme à choisir.');
    if(e.target?.filter) limitations.push('Filtre de cible à relier.');
    if(e.target && !['self','creature'].includes(e.target.kind)) limitations.push('Cible non prise en charge.');
    if(e.trigger && !Object.hasOwn(triggerLabels,e.trigger)) limitations.push('Déclencheur non reconnu : '+e.trigger);
    if(e.trigger && !(e.trigger==='on-hit'&&p.role==='weapon-base')) limitations.push('Abonnement au déclencheur '+(triggerLabels[e.trigger]??e.trigger)+' non relié.');
    if(['damage','healing'].includes(t)) {
      try{diceSpec(p.dice);}catch{missing.push('Dés invalides : '+p.dice);}
      if(t==='damage'&&!p.damageType) missing.push('Type de dégâts à préciser.');
      ability.effects.push({kind:t==='damage'?'damage':'heal',dice:p.dice,...(t==='damage'?{damageType:p.damageType??'untyped'}:{})});
      if(p.role==='weapon-base') {
        if(save)limitations.push('Attaque et sauvegarde successives non reliées.');
        else {ability.attack={bonus:context.attackBonus??0};ability.combat.actionKind='weaponAttack';ability.combat.weapon=true;}
      }
      if(e.duration||a.duration) limitations.push('Répétition des dégâts/soins à relier au calendrier.');
      automated.push(t==='damage'?'Dés, dégâts typés, résistances et vulnérabilités.':'Soins plafonnés aux PV maximum.');
    } else if(t==='modifier'&&p.operation==='add'&&['ac','attack','damage'].includes(p.stat)) {
      const d=duration(e.duration??a.duration);
      if(!d)missing.push('Durée et expiration explicites requises pour le bonus temporaire.');
      else ability.combat.ongoing.push({id:e.id,stack:{key:item.id+':'+e.id,policy:'replace',priority:0},duration:d,modifiers:[{stat:p.stat,operation:'add',value:p.value}],conditions:[],concentration:false});
      automated.push('Bonus temporaire et expiration dans le moteur de combat.');
    } else {
      limitations.push(({condition:'État et conséquences de jeu', 'cast-spell':'Résolution du sort référencé', 'mode-switch':'Transformation et recalcul du profil',defense:'Défense temporaire',custom:'Pouvoir personnalisé'})[t]??'Effet '+t+' : interprétation non reliée');
    }
  }
  if(instance){
    if(!instance.ownerId||!instance.equipped&&item.equipment.requiresEquipped!==false||item.attunement.required!==false&&!instance.attuned||instance.consumed||instance.active===false) missing.push('Objet inactif, non équipé ou non harmonisé.');
    if(instance.definitionId!==item.id||instance.definitionVersion!==item.version)missing.push('Version de l’objet incompatible.');
    for(const c of [item.attunement.prerequisites,a.prerequisites,...a.effects.flatMap(e=>e.conditions)])if(conditionMet(c,instance,context)!==true)missing.push('Prérequis non satisfait dans ce contexte.');
    if(a.effects.some(e=>e.modeId&&!instance.modeIds.includes(e.modeId)))missing.push('Forme requise inactive.');
  }
  // Validate the compiled contract even when the catalogue itself is valid.
  if(!missing.length){try{const d=baseActor('source');d.resources=Object.fromEntries(item.resources.map(r=>[r.id,{max:r.maximum,recovery:'none'}]));d.abilities={power:ability};validateDefinition(d);}catch(e){limitations.push('Contrat de combat : '+e.message);}}
  const status=missing.length?'incomplete':limitations.length?'partial':'automatic';
  return {status,label:{incomplete:'À compléter',partial:'Partiellement automatisé',automatic:'Automatique'}[status],missing:[...new Set(missing)],limitations:[...new Set(limitations)],automated:[...new Set([...automated,...(Object.hasOwn(costMap,a.activation)?['Économie d’action contrôlée par le moteur.']:[]),...(a.costs.length?['Coût de réserve atomique.']:[])])],ability};
}
/** A detached sandbox. Even partial previews never claim to resolve omitted effects. */
export function simulateCapability(item,a,options={}) {
  const instance=options.instance??{...instanceOf(item,'source'),equipped:true,attuned:true};
  const diagnostic=compileCapability(item,a,{instance,context:options});
  if(diagnostic.missing.length) return {diagnostic,timeline:diagnostic.missing.map(x=>'À compléter : '+x)};
  const source=baseActor('source',options.level??10),target=baseActor('target');
  source.resources=Object.fromEntries(item.resources.map(r=>[r.id,{max:r.maximum,recovery:'none'}]));
  source.abilities={power:diagnostic.ability};target.ac=options.ac??15;
  for(const kind of ['resistances','vulnerabilities','immunities'])target[kind]=options[kind]??[];
  target.saves=Object.fromEntries(Object.keys(target.saves).map(k=>[k,options.saveBonus??0]));
  let state;
  try{
    state=createSession([source,target]);
    state.actors.source.resources={...instance.resources};
    if(options.charges!==undefined)for(const k of Object.keys(state.actors.source.resources))state.actors.source.resources[k]=options.charges;
    if(options.reactionSpent)state.actors.source.economy.reaction=false;
    state.actors.target.hp.current=options.targetHP??100;
    const command={id:'forge-simulation',type:'useAbility',actorId:'source',abilityId:'power',targetIds:['target'],attackRolls:[options.attackRoll??15],saveRolls:{target:[options.saveRoll??1],source:[options.saveRoll??1]},effectRolls:{}};
    for(const [i,e] of diagnostic.ability.effects.entries()){
      const d=diceSpec(e.dice),critical=!!diagnostic.ability.attack&&command.attackRolls[0]===20&&e.kind==='damage';
      command.effectRolls[i]=options.effectRolls?.[i]??Array.from({length:d.count*(critical?2:1)},()=>1+Math.floor(Math.random()*d.sides));
    }
    const out=execute(state,command);
    const timeline=[`Activation : ${a.name.fr}`,`Action : ${diagnostic.ability.cost==='none'?'aucune':{action:'action',bonus:'action bonus',reaction:'réaction'}[diagnostic.ability.cost]}`];
    if(out.result.total!==null)timeline.push(`Attaque : ${out.result.total} contre CA ${target.ac} — ${out.result.hit?'réussie':'ratée'}`);
    for(const r of out.result.results){
      if(r.save)timeline.push(`Sauvegarde : ${r.save.total} / DD ${r.save.dc} — ${r.save.success?'réussite':'échec'}`);
      if(r.damage!==undefined)timeline.push(`Dégâts : ${r.damage} (${r.components.map(c=>c.type+' : '+c.raw+' → '+c.afterDefenses).join(', ')})`);
      if(r.hp)timeline.push(`PV après soin : ${r.hp.current}`);
    }
    for(const [k,v] of Object.entries(out.state.actors.source.resources))timeline.push(`Réserve ${item.resources.find(r=>r.id===k)?.unit??''} : ${state.actors.source.resources[k]} → ${v}`);
    for(const e of out.state.actors.target.advanced?.effects??out.state.actors.source.advanced?.effects??[])timeline.push(`Effet temporaire : ${e.rule.duration.value} ${e.rule.duration.unit}, expiration ${e.rule.duration.boundary==='start'?'début':'fin'} du tour ${e.rule.duration.anchor==='source'?'du porteur':'de la cible'}`);
    timeline.push(...diagnostic.limitations.map(x=>'Non exécuté : '+x));
    return {...out,command,before:state,diagnostic,timeline};
  }catch(e){return {diagnostic,timeline:['Exécution refusée : '+e.message,...diagnostic.limitations.map(x=>'Non exécuté : '+x)],error:e.message};}
}
