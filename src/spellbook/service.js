import {check} from '../character/contracts.js';
import {compileDraft,draftProgression} from '../creator/model.js';
import {migrateLegacySpellbook} from './model.js';

const magicKinds=new Set(['spell','spellbook','prepared','ritual-spell','spell-mastery','signature-spell']);
export function grimoireView(context,config,draft,record){
  const book=record.spellbook??migrateLegacySpellbook(record.definition);
  const report=draft?draftProgression(context,config,draft):null;
  return {book,report,choices:(report?.choices??[]).filter(q=>magicKinds.has(q.kind)),classIds:record.definition.classes.filter(c=>c.casting).map(c=>c.id),editable:!!draft?.finalized};
}
function updateCurrentHistory(draft){
  if(draft.advancementHistory?.length)draft.advancementHistory.at(-1).selections=structuredClone(draft.selections);
}
/** A preparation is staged as a complete set; an intermediate uncheck never mutates the saved character. */
export function stagePreparation(context,config,input,{classId,spellIds}){
  const d=structuredClone(input),report=draftProgression(context,config,d);
  const q=report.choices.find(q=>q.classId===classId&&q.kind==='prepared');
  check(q,'This class does not prepare spells');
  check(Array.isArray(spellIds)&&new Set(spellIds).size===spellIds.length&&spellIds.length<=(q.count)&&spellIds.length>=(q.minimumCount??q.count)&&spellIds.every(id=>q.options.includes(id)),'Invalid preparation');
  d.selections[q.id]=[...spellIds];d.confirmed=true;updateCurrentHistory(d);return d;
}
/** Copying is explicit acquisition, distinct from the daily preparation and level-up allowance. */
export function stageWizardCopy(context,config,input,{spellId,confirmedCopy=false,note=''}){
  const d=structuredClone(input),report=draftProgression(context,config,d);
  const q=report.choices.find(q=>q.classId==='wizard'&&q.kind==='spellbook');
  check(q&&q.options.includes(spellId)&&context.index.get(spellId)?.data.level>0,'Spell cannot be copied into this book');
  check(!(d.selections[q.id]??[]).includes(spellId),'Spell already in book');
  check(confirmedCopy===true&&typeof note==='string'&&note.trim().length>0&&note.length<=500,'Confirm copy eligibility, time and material cost');
  d.spellbookTranscriptions??=[];
  d.spellbookTranscriptions.push({classId:'wizard',spellId,characterLevel:d.classes.reduce((n,c)=>n+c.level,0),reason:note.trim()});
  d.selections[q.id]=[...(d.selections[q.id]??[]),spellId];d.confirmed=true;updateCurrentHistory(d);return d;
}
function comparable(character){const c=structuredClone(character);c.revision=1;return JSON.stringify(c);}
/** Reuse the production compiler and the creator's atomic definition/book/draft transaction. */
export function grimoireService({library,drafts,campaigns}){
  return {
    async apply(characterId,command,{expectedCharacterRevision,expectedDraftRevision}){
      const [record,draft]=await Promise.all([library.get(characterId),drafts.get(characterId)]);
      check(record&&draft,'Open the character in the creator before modifying its spell choices');
      check(record.definition.revision===expectedCharacterRevision&&draft.revision===expectedDraftRevision,'Revision conflict');
      check(draft.finalized,'Finish or review the open character edit first');
      const config=await campaigns.get(draft.campaignId),context=await campaigns.context(config);
      const before=compileDraft(context,config,{...draft,confirmed:true});
      // External manual definition changes must never be discarded by rebuilding from an older draft.
      check(before.valid&&comparable(before.character)===comparable(record.definition),'Character differs from its build plan; review it before changing spells');
      const next=command.type==='prepare'?stagePreparation(context,config,draft,command):command.type==='copy'?stageWizardCopy(context,config,draft,command):null;
      check(next,'Unknown grimoire operation');
      const result=compileDraft(context,config,next);check(result.valid,'Spell choices need review');
      result.character.revision=expectedCharacterRevision+1;next.status=result.status;
      return drafts.finalize(next,result.character,{expectedCharacterRevision,expectedDraftRevision,spellbook:result.spellbook});
    },
  };
}
