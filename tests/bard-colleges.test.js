import test from 'node:test';import assert from 'node:assert/strict';
import{playerCatalogs}from '../src/catalog/player-catalogs.js';import{campaignCatalog,defaultCampaign}from '../src/campaign/sources.js';import{newDraft,suggestChoices,compileDraft}from '../src/creator/model.js';import{catalogRequest}from './helpers/catalog.js';import{validateAdvancementHistory}from '../src/catalog/advancement.js';import{resolveProgression}from '../src/catalog/progression.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config);
function build(sub,level){let d=Object.assign(newDraft(),{name:'Collège — recette synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',classes:[{id:'bard',level,subclassId:sub}],classChosen:true});d=suggestChoices(ctx,config,d);d.reviewed=d.confirmed=true;const r=compileDraft(ctx,config,d);assert.equal(r.valid,true,JSON.stringify(r.issues));return{d,r};}
test('all seven PHB/XGE/TCE bard colleges acquire their real level grants and retain known-spell rules',()=>{
 assert.equal(ctx.index.class('bard').data.subclassIds.length,7);
 for(const sub of ctx.index.class('bard').data.subclassIds)for(const level of [3,6,10,14,20]){const{r}=build(sub,level);assert.equal(r.choices.some(q=>q.kind==='prepared'),false);for(const row of ctx.index.get(sub).data.grants)for(const id of row.featureIds)assert.equal(r.character.features.includes(id),row.level<=level);if(level===10){assert.equal(r.choices.filter(q=>q.id.includes(':magical-secrets-')).length,sub==='srd51:college-of-lore'?2:1);assert.equal(new Set(r.spellbook.grants.filter(g=>g.classId==='bard').map(g=>g.spellId)).size,sub==='srd51:college-of-lore'?20:18);}}
});
test('Valor and Swords give actual armor training and two attacks at6, while their style choices differ',()=>{
 for(const sub of ['phb14:bard:valor','xge:bard:swords'])for(const level of [3,6,14]){const{r}=build(sub,level);assert.ok(r.character.proficiencies.includes('medium-armor'));assert.equal(r.stats.attacksPerAction,level>=6?2:1);if(sub.endsWith(':valor')){assert.ok(r.character.proficiencies.includes('shields'));assert.ok(r.character.proficiencies.includes('martial-weapons'));}else{assert.ok(r.character.proficiencies.includes('scimitars'));const q=r.choices.find(q=>q.id==='bard:swords-fighting-style');assert.deepEqual(q.options,['srd51:fighter:dueling','srd51:fighter:two-weapon-fighting']);}}
});
test('Whispers shares Bardic Inspiration and uses separate short/long rest resources; Creation records its object rules',()=>{
 const{r}=build('xge:bard:whispers',14);assert.equal(r.character.abilities.find(a=>a.id==='xge:bard:whispers:psychic-blades').resource.id,'bard:inspiration');assert.equal(r.stats.resources['bard:words-of-terror'].recovery,'short');assert.equal(r.stats.resources['bard:mantle-of-whispers'].recovery,'short');assert.equal(r.stats.resources['bard:shadow-lore'].recovery,'long');
 const creation=build('tce:bard:creation',14).r;assert.equal(creation.stats.resources['bard:performance-of-creation'].max,1);assert.equal(creation.stats.resources['bard:animating-performance'].max,1);const data=ctx.index.get('tce:bard:creation:animating-performance').data;assert.equal(data.alternateCost.slotMinimum,3);assert.equal(data.companionProfile.hitPoints.perClassLevel,5);assert.equal(data.companionProfile.defaultAction,'dodge');assert.equal(ctx.index.get('tce:bard:creation:performance-of-creation').data.creationRules.at(-1).maximumGoldMultiplier,null);
});
function snapshots(index,count){const history=[];let last;
 for(let level=1;level<=count;level++){const classes=[{id:'bard',level,subclassId:level<3?null:'xge:bard:glamour'}],request=catalogRequest(index,'bard',{level,classes});for(const [key,values]of Object.entries(history.at(-1)?.selections??{}))if(request.selections[key])request.selections[key]=[...values,...request.selections[key].filter(v=>!values.includes(v))].slice(0,request.selections[key].length);history.push({classId:'bard',classes,selections:request.selections});last=request;}
 return{history,request:last};
}
function replaceCantrip(index,h,at,count=1){const row=h[at],before=row.selections['bard:cantrips'],q=resolveProgression(index,{classes:row.classes,scores:{str:13,dex:13,con:12,int:13,wis:13,cha:13},selections:row.selections}).choices.find(q=>q.id==='bard:cantrips'),fresh=q.options.filter(id=>!before.includes(id));row.selections['bard:cantrips']=[...fresh.slice(0,count),...before.slice(count)];}
function replaceExpertise(index,h,at){const row=h[at],q=resolveProgression(index,{classes:row.classes,scores:{str:13,dex:13,con:12,int:13,wis:13,cha:13},selections:row.selections}).choices.find(q=>q.id==='bard:expertise-3'),before=row.selections[q.id];row.selections[q.id]=[q.options.find(id=>!before.includes(id)),before[1]];}
test('Bardic Versatility permits one cantrip OR expertise replacement only on that bard ASI level',()=>{
 const c={...config,enabledOptions:['tce:bard:bardic-versatility']},x=campaignCatalog(playerCatalogs,[],c);
 const run=(mutate,count=4,index=x.index)=>{const{history,request}=snapshots(index,count);mutate(history,index);return validateAdvancementHistory(index,{...request,selections:history.at(-1).selections},history);};
 assert.equal(run(()=>{}).valid,true);
 for(const kind of ['cantrip','expertise']){const r=run((h,index)=>kind==='cantrip'?replaceCantrip(index,h,3):replaceExpertise(index,h,3));assert.equal(r.valid,true,JSON.stringify(r.issues));}
 assert.equal(run((h,index)=>{replaceCantrip(index,h,3);replaceExpertise(index,h,3);}).valid,false);
 assert.equal(run((h,index)=>replaceCantrip(index,h,3,2)).valid,false);
 assert.equal(run((h,index)=>replaceCantrip(index,h,4),5).valid,false);
 assert.equal(run((h,index)=>replaceCantrip(index,h,3),4,ctx.index).valid,false);
});
test('earlier Magical Secrets keep their acquisition cap except legal Bard-list replacements, with one replacement per level',()=>{
 const level10=build('srd51:college-of-lore',10),q=level10.r.choices.find(q=>q.id==='bard:magical-secrets-6');assert.ok(!q.options.includes('phb14:spell:banishing-smite'));assert.ok(q.options.includes('srd51:mass-cure-wounds'));
 const high=build('xge:bard:swords',20);assert.ok(!high.r.choices.find(q=>q.id==='bard:magical-secrets-10').options.includes('srd51:wish'));
 const lower=build('srd51:college-of-lore',7),secret=lower.r.choices.find(q=>q.id==='bard:magical-secrets-6'),already=new Set(Object.entries(lower.d.selections).filter(([id])=>id!==secret.id).flatMap(([,v])=>v)),higher=secret.options.filter(id=>ctx.index.get(id).data.level===4&&!already.has(id));assert.ok(higher.length>=2);lower.d.selections[secret.id]=higher.slice(0,2);const invalid=compileDraft(ctx,config,lower.d);assert.equal(invalid.valid,false);assert.ok(invalid.issues.some(i=>i.code==='secret-replacement-budget'));
});
test('Glamour and Eloquence bind action economy and resources; conditional Command stays outside known quota',()=>{
 const{r}=build('xge:bard:glamour',10),abilities=r.character.abilities;assert.equal(abilities.find(a=>a.id==='xge:bard:glamour:mantle-of-inspiration').resource.id,'bard:inspiration');assert.ok(abilities.find(a=>a.id==='xge:bard:glamour:mantle-of-majesty').concentration);
 const command=abilities.find(a=>a.id==='xge:bard:glamour:mantle-of-majesty:spell:srd51:command');assert.ok(command);assert.equal(command.cost,'bonus');assert.equal(command.target,'selected');assert.equal(command.resource,null);assert.ok(command.combat.externalRequirements.includes('featureEligibilityValidated'));
 const grant=r.spellbook.grants.find(g=>g.spellId==='srd51:command');assert.equal(grant.castingAbility,'cha');assert.equal(grant.classId,null);assert.equal(grant.originId,'xge:bard:glamour:mantle-of-majesty');
 const eloquence=build('tce:bard:eloquence',14).r;assert.equal(eloquence.character.abilities.find(a=>a.id==='tce:bard:eloquence:unsettling-words').resource.id,'bard:inspiration');assert.equal(eloquence.character.abilities.find(a=>a.id==='tce:bard:eloquence:infectious-inspiration').cost,'reaction');
 const lore=build('srd51:college-of-lore',14).r;assert.equal(lore.character.abilities.find(a=>a.id==='srd51:college-of-lore:cutting-words').resource.id,'bard:inspiration');assert.equal(lore.character.abilities.find(a=>a.id==='srd51:college-of-lore:peerless-skill').resource.id,'bard:inspiration');
});
