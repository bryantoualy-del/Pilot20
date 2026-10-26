import {el,button,field,select} from './dom.js';
const faces=[4,6,8,10,12,20];
export function parseDice(value){
 if(value===null||value===undefined||value==='')return {kind:'unknown'};
 if(/^\d+$/.test(value))return {kind:'fixed',amount:Number(value)};
 const m=/^(\d+)d(\d+)([+-]\d+)?$/.exec(value);
 if(m&&Number(m[1])>=1&&Number(m[1])<=100&&faces.includes(Number(m[2])))return {kind:'dice',count:Number(m[1]),faces:Number(m[2]),bonus:Number(m[3]??0)};
 return {kind:'preserved'};
}
export function numberControl(label,value,onChange,{min=0,max=100000,step=1,...attrs}={}){
 const input=el('input',{type:'number',value:value??'',min,max,step,...attrs});
 const minus=button('−',()=>adjust(-step)),plus=button('+',()=>adjust(step));
 minus.setAttribute('aria-label','Diminuer · '+label);plus.setAttribute('aria-label','Augmenter · '+label);
 function refresh(){minus.disabled=input.value!==''&&Number(input.value)<=min;plus.disabled=input.value!==''&&Number(input.value)>=max;}
 function emit(){if(input.value===''||!input.validity.valid)return;refresh();onChange(Number(input.value));}
 function adjust(delta){input.value=String(Math.min(max,Math.max(min,(input.value===''?min:Number(input.value))+delta)));emit();}
 input.addEventListener('input',emit);refresh();
 const result=field(label,input),wrapper=el('div',{class:'forge-stepper'});input.before(wrapper);wrapper.append(minus,input,plus);return result;
}
/** Existing JSON formula stays unchanged until a deliberate selection. */
export function diceControl(label,value,onChange,{optional=false}={}){
 let state=parseDice(value);
 const root=el('fieldset',{class:'forge-dice'},el('legend',{},label)),body=el('div',{}),preview=el('output',{'aria-live':'polite'},value??'À préciser');
 function publish(){value=state.kind==='unknown'?null:state.kind==='fixed'?String(state.amount):`${state.count}d${state.faces}${state.bonus?`${state.bonus>0?'+':''}${state.bonus}`:''}`;preview.textContent=value??'À préciser';onChange(value);}
 function render(){
  body.replaceChildren();
  if(state.kind==='preserved'){
   body.append(el('p',{},'Formule du modèle conservée : '+value),button('Remplacer par des dés guidés',()=>{state={kind:'dice',count:1,faces:6,bonus:0};publish();render();}));return;
  }
  body.append(field(label+' · Calcul',select([...(optional||state.kind==='unknown'?[['unknown','À préciser']]:[]),['dice','Dés'],['fixed','Valeur fixe']],state.kind,e=>{state=e.target.value==='dice'?{kind:'dice',count:1,faces:6,bonus:0}:e.target.value==='fixed'?{kind:'fixed',amount:1}:{kind:'unknown'};publish();render();})));
  if(state.kind==='dice')body.append(el('div',{class:'forge-dice-parts'},numberControl(label+' · Nombre',state.count,n=>{state.count=n;publish();},{min:1,max:100}),field(label+' · Dé',select(faces.map(n=>[String(n),'d'+n]),String(state.faces),e=>{state.faces=Number(e.target.value);publish();})),numberControl(label+' · Bonus',state.bonus,n=>{state.bonus=n;publish();},{min:-100,max:100})));
  if(state.kind==='fixed')body.append(numberControl(label+' · Valeur',state.amount,n=>{state.amount=n;publish();},{min:0}));
 }
 render();root.append(body,preview);return root;
}
