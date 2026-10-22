import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCatalogs} from '../src/catalog/player-catalogs.js';
import {campaignCatalog,defaultCampaign} from '../src/campaign/sources.js';
import {newDraft,draftProgression} from '../src/creator/model.js';
import {selectOriginChoice} from '../src/creator/origin-selection.js';
import {selectRace} from '../src/creator/race-selection.js';
const config=defaultCampaign(),ctx=campaignCatalog(playerCatalogs,[],config),raceId='motm:race:kobold';
const make=()=>Object.assign(newDraft(),{raceId,scoresAreBase:true,scores:{str:10,dex:10,con:10,int:10,wis:10,cha:10}});
const report=d=>draftProgression(ctx,config,d).origin;
test('MotM bonuses support +2/+1 or three distinct +1s, without fixed Dexterity',()=>{
 const d=make();d.originSelections={[raceId+':ability-pattern']:['two-one'],[raceId+':ability-bonus-2']:['cha'],[raceId+':ability-bonus-1']:['con']};
 let o=report(d);assert.equal(o.scores.cha,12);assert.equal(o.scores.con,11);assert.equal(o.scores.dex,10);
 d.originSelections={[raceId+':ability-pattern']:['three-ones'],[raceId+':ability-bonus-1']:['cha','con','wis']};
 o=report(d);assert.equal(o.scores.cha,11);assert.equal(o.scores.con,11);assert.equal(o.scores.wis,11);assert.equal(o.scores.dex,10);
 d.originSelections[raceId+':ability-bonus-1']=['cha','cha','wis'];assert.ok(report(d).issues.some(i=>i.choiceId===raceId+':ability-bonus-1'));
 d.originSelections={[raceId+':ability-pattern']:['two-one'],[raceId+':ability-bonus-2']:['cha'],[raceId+':ability-bonus-1']:['cha']};assert.ok(report(d).issues.some(i=>i.choiceId===raceId+':ability-bonus-1'));
 d.scores.cha=19;assert.ok(report(d).issues.some(i=>i.code==='origin-score-cap'));
});
test('heritage changes remove inactive grants and preserve unrelated answers',()=>{
 const d=make(),owner=ctx.index.get(raceId);d.originSelections={[raceId+':legacy']:['draconic-sorcery'],[raceId+':draconic-ability']:['cha'],[raceId+':draconic-cantrip']:['srd51:fire-bolt'],[raceId+':language']:['draconic']};
 assert.equal(report(d).spells[0].ability,'cha');
 const q=report(d).choices.find(q=>q.key==='legacy');selectOriginChoice(d,q,['craftiness'],owner);
 assert.equal(report(d).spells.length,0);assert.ok(!Object.hasOwn(d.originSelections,raceId+':draconic-cantrip'));assert.deepEqual(d.originSelections[raceId+':language'],['draconic']);
 d.originSelections[raceId+':craftiness-skill']=['arcana'];assert.ok(report(d).ledger.some(x=>x.kind==='skill'&&x.value==='arcana'));
 selectOriginChoice(d,q,['defiance'],owner);assert.ok(!Object.hasOwn(d.originSelections,raceId+':craftiness-skill'));assert.ok(report(d).traits.some(t=>t.id==='defiance'));
 assert.ok(report(d).traits.some(t=>t.name.fr==='Héritage draconique'));
 selectRace(ctx,d,'volo:race:kobold');const o=report(d);assert.equal(o.bonuses.dex,2);assert.equal(o.spells.length,0);assert.ok(!o.traits.some(t=>t.name.fr==='Héritage draconique'));
});
