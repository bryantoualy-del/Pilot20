import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,suggestChoices,compileDraft,draftProgression} from '../src/creator/model.js';
const config={...defaultCampaign(),enabledOptions:['feats']},ctx=campaignCatalog(playerCatalogs,[],config);
function fighter(level=8){return Object.assign(newDraft(),{name:'Géant synthétique',raceId:'srd51:race:human',backgroundId:'srd51:background:acolyte',scores:{str:16,dex:16,con:16,int:16,wis:16,cha:16},classes:[{id:'fighter',level,subclassId:'phb14:fighter:eldritch-knight'}],classChosen:true});}
test('83 AideDD feats including 8 Bigby giants; source can be restricted by DM',()=>{
 assert.equal(ctx.index.list('feat').filter(f=>f.data.rulesSourceId!=='planescape').length,83);
 const giants=ctx.index.list('feat').filter(f=>f.data.rulesSourceId==='bgg');
 assert.equal(giants.length,8);
 const restricted={...defaultCampaign(),sourceRestrictions:true,enabledSourceIds:['srd51','phb14','xge','tce']};
 const filtered=campaignCatalog(playerCatalogs,[],restricted);
 assert.equal(filtered.index.list('feat').some(f=>f.data.rulesSourceId==='bgg'),false);
});
test('prerequisites require correct giant type and level, illegal feats cannot be forged',()=>{
 const d=fighter(8);
 const first=draftProgression(ctx,config,d).choices.find(q=>q.id==='fighter:asi-4');
 assert.ok(first.options.includes('bgg:feat:strike-of-the-giants'));
 assert.ok(!first.options.includes('bgg:feat:ember-of-the-fire-giant'));
 d.selections['fighter:asi-4']=['bgg:feat:strike-of-the-giants'];
 d.selections['bgg:feat:strike-of-the-giants:giant']=['cloud'];
 d.selections['fighter:asi-6']=['bgg:feat:ember-of-the-fire-giant'];
 const invalid=compileDraft(ctx,config,{...suggestChoices(ctx,config,d),confirmed:true,reviewed:true});
 assert.equal(invalid.valid,false);
 d.selections['bgg:feat:strike-of-the-giants:giant']=['fire'];
 const report=draftProgression(ctx,config,d);
 assert.ok(report.choices.find(q=>q.id==='fighter:asi-6').options.includes('bgg:feat:ember-of-the-fire-giant'));
 d.selections['bgg:feat:ember-of-the-fire-giant:ability']=['con'];
 const actual=suggestChoices(ctx,config,d);actual.reviewed=actual.confirmed=true;
 const built=compileDraft(ctx,config,actual);
 assert.equal(built.valid,true,JSON.stringify(built.issues));
 assert.ok(built.character.defenses.resistances.includes('fire'));
 assert.ok(built.stats.resources['bgg:feat:ember-of-the-fire-giant:uses'].max>0);
});
test('Rune Shaper resolves level-one rune spells as feat-granted, with separate free casts',()=>{
 let d=Object.assign(fighter(4),{classes:[{id:'wizard',level:4,subclassId:ctx.index.class('wizard').data.subclassIds[0]}]});
 d.selections['wizard:asi-4']=['bgg:feat:rune-shaper'];
 d.selections['bgg:feat:rune-shaper:casting-ability']=['int'];
 d.selections['bgg:feat:rune-shaper:runes']=['phb14:spell:armor-of-agathys'];
 d=suggestChoices(ctx,config,d);d.confirmed=d.reviewed=true;
 const result=compileDraft(ctx,config,d);
 assert.equal(result.valid,true,JSON.stringify(result.issues));
 const granted=result.spellbook.grants.filter(g=>g.originId.startsWith('bgg:feat:rune-shaper'));
 assert.ok(granted.some(g=>g.spellId==='srd51:comprehend-languages'));
 assert.ok(granted.some(g=>g.spellId==='phb14:spell:armor-of-agathys'));
 assert.ok(granted.every(g=>g.castingAbility==='int'&&g.acquisition==='granted'));
 assert.ok(result.stats.resources['bgg:feat:rune-shaper:rune-phb14-spell-armor-of-agathys'].max===1);
});