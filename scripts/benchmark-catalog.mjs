import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {loadSRD} from '../src/catalog/srd51-catalog.js';
import {resolveProgression} from '../src/catalog/progression.js';
import {buildCharacter} from '../src/catalog/character-builder.js';
import {bardRequest} from '../examples/catalog-demo.mjs';
const samples=(n,f)=>{const times=[];for(let i=0;i<n;i++){const t=performance.now();f();times.push(performance.now()-t);}times.sort((a,b)=>a-b);return {runs:n,medianMs:+times[Math.floor(n/2)].toFixed(3),p95Ms:+times[Math.floor(n*.95)].toFixed(3)};};
const index=loadSRD();
console.log(JSON.stringify({environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model},scope:'Warm Node process; JSON module parse excluded. No iPad measurement.',entries:index.size,index:samples(30,loadSRD),resolve:samples(100,()=>resolveProgression(index,bardRequest)),build:samples(50,()=>buildCharacter(index,bardRequest))},null,2));
