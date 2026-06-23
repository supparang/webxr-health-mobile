const fs=require('fs'); const vm=require('vm');
class Store { constructor(){this.m=new Map()} getItem(k){return this.m.has(k)?this.m.get(k):null} setItem(k,v){this.m.set(k,String(v))} removeItem(k){this.m.delete(k)} get length(){return this.m.size} key(i){return [...this.m.keys()][i]||null} }
const store=new Store();
const doc={ querySelector:()=>({}), querySelectorAll:()=>[], documentElement:{} };
const ctx={window:{},document:doc,localStorage:store,console,URLSearchParams,Date,Math,setTimeout:()=>0,clearTimeout:()=>{},confirm:()=>true,alert:()=>{},CustomEvent:function(){}};
ctx.window=ctx; ctx.history={replaceState:()=>{}}; ctx.location={search:'',pathname:'/w1-ux-detective.html'}; ctx.requestAnimationFrame=(fn)=>fn(); ctx.scrollTo=()=>{}; ctx.addEventListener=()=>{};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('/mnt/data/uxquest_w1_replay_v7/sgnal-hunt/js/uxq-w1-data.js','utf8'),ctx);
console.log('data counts',ctx.UXQ_W1_TUTORIAL_CASES.length,ctx.UXQ_W1_REPLAY_CORE_CASES.length,ctx.UXQ_W1_REPLAY_SCENARIOS.length,ctx.UXQ_W1_CASE_BANK.length);
if(ctx.UXQ_W1_TUTORIAL_CASES.length!==5||ctx.UXQ_W1_REPLAY_CORE_CASES.length!==60||ctx.UXQ_W1_REPLAY_SCENARIOS.length!==720)throw Error('data counts bad');
let code=fs.readFileSync('/mnt/data/uxquest_w1_replay_v7/sgnal-hunt/js/uxq-w1-v7.js','utf8');
code=code.replace(/\n  loadProgress\(\);[\s\S]*?\n\}\)\(\);\s*$/m, `\n  window.__debugV7 = {\n    reset: () => { progress = freshProgress(); state = freshState(); },\n    getProgress: () => progress,\n    getState: () => state,\n    buildReplayRound,\n    recordReplayCycle,\n    setRound: (round) => { state = { ...freshState(), mode:'replay', coreIds:round.coreIds, caseIds:round.caseIds, answered: round.coreIds.map((id) => { const c=REPLAY_CORES.find(x=>x.coreId===id); return { coreId:id, skill:c.skill }; }) }; }\n  };\n})();\n`);
vm.runInContext(code,ctx);
const d=ctx.__debugV7; d.reset();
const seen=[];
for(let round=1;round<=12;round++){
 const r=d.buildReplayRound();
 if(r.coreIds.length!==5||new Set(r.coreIds).size!==5)throw Error('round duplicate '+round);
 seen.push(...r.coreIds);
 d.setRound(r); d.recordReplayCycle();
 console.log(round, r.coreIds.join(', '));
}
console.log('unique',new Set(seen).size,'of',seen.length);
if(new Set(seen).size!==60) throw Error('Core repeated before 12 rounds');
const tutorialReserved=new Set(ctx.UXQ_W1_TUTORIAL_CASES.map(c=>c.sourceCoreId));
const first15=seen.slice(0,15);
if(first15.some(id=>tutorialReserved.has(id))) throw Error('Tutorial base core found in first three replay rounds');
console.log('PASS: strict 12 rounds / 60 unique cores; first 3 rounds avoid tutorial base cores');
