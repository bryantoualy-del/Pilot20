import {execute} from '../../src/engine.js';
import {pendingDecisions} from '../../src/rules/reactive.js';
export const definition=(id,overrides={})=>({id,name:id,level:10,maxHp:100,ac:15,attacksPerAction:2,saves:{con:3,dex:2,str:3,wis:2,int:1,cha:4},resources:{power:{max:4,recovery:'long'}},abilities:{blade:{name:'Weapon',cost:'action',target:'selected',maxTargets:1,attackAction:true,attack:{bonus:5},effects:[{kind:'damage',amount:21,damageType:'slashing'}]}},resistances:[],immunities:[],vulnerabilities:[],...overrides});
export const rule=(id,overrides={})=>({version:1,id,trigger:{version:1,event:'attack-hit',scope:'target',limit:'none',whileEffect:null},phase:'before-damage',priority:0,conditions:[{fact:'external.visible',equals:true}],options:[{id:'reduce',label:'Reduce',costs:[{resourceId:'power',amount:1}],reaction:true,effects:[{kind:'adjust',field:'damageDivisor',amount:2}]}],...overrides});
export const run=(s,c)=>execute(s,c).state;
export const attack=(id='hit',extra={})=>({id,type:'useAbility',actorId:'a',abilityId:'blade',targetIds:['b'],attackRolls:[15],facts:{b:{visible:true}},...extra});
export const answer=(s,choice='accept',extra={})=>{const d=pendingDecisions(s)[0];return {id:'answer-'+s.revision,type:'respondDecision',actorId:d.actorId,decisionId:d.id,decisionRevision:d.revision,expectedRevision:s.revision,choice,optionId:d.options[0].id,...extra};};
