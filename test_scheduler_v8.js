const fs=require('fs'); const vm=require('vm');
class Store { constructor(){this.m=new Map()} getItem(k){return this.m.has(k)?this.m.get(k):null} setItem(k,v){this.m.set(k,String(v))} removeItem(k){this.m.delete(k)} get length(){return this.m.size} key(i){return [...this.m.keys()][i]||null} }
const store=new Store();
const fakeNode=()=>({textContent:'',dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},removeAttribute(){},setAttribute(){},showModal(){},close(){}});
const doc={querySelector:()=>fakeNode(),querySelectorAll:()=>[],documentElement:{}};
const ctx={window:{},document:doc,localStorage:store,console,URLSearchParams,Date,Math,setTimeout:()=>0,clearTimeout:()=>{},confirm:()=>true,alert:()=>{},CustomEvent:function(){}};
ctx.window=ctx; ctx.history={replaceState:()=>{}}; ctx.location={search:'',pathname:'/w1-ux-detective.html'}; ctx.requestAnimationFrame=(fn)=>fn(); ctx.scrollTo=()=>{}; ctx.addEventListener=()=>{};
vm.createContext(ctx);
const root='/mnt/data/uxquest_w1_v8_final/sgnal-hunt/js/';
vm.runInContext(fs.readFileSync(root+'uxq-w1-data.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(root+'uxq-progress-v8.js','utf8'),ctx);
let code=fs.readFileSync(root+'uxq-w1-v8.js','utf8');
code=code.replace(/\n  loadProgress\(\);[\s\S]*?\n\}\)\(\);\s*$/m, `
  window.__debugV8 = {
    reset: () => { progress = freshProgress(); state = freshState(); },
    getProgress: () => progress,
    buildReplayRound,
    recordReplayCycle,
    setRound: (round) => { state = { ...freshState(), mode:'replay', coreIds:round.coreIds, caseIds:round.caseIds, answered: round.coreIds.map((id) => { const c=REPLAY_CORES.find(x=>x.coreId===id); return { coreId:id, skill:c.skill, scenarioId:round.caseIds.find(cid=>CASE_BY_ID.get(cid).coreId===id) }; }) }; }
  };
})();
`);
vm.runInContext(code,ctx);
const d=ctx.__debugV8; d.reset();
const seen=[]; const tutorialReserved=new Set(ctx.UXQ_W1_TUTORIAL_CASES.map(c=>c.sourceCoreId));
for(let round=1;round<=12;round++){
  const r=d.buildReplayRound();
  if(r.coreIds.length!==5||new Set(r.coreIds).size!==5) throw Error('round duplicate '+round);
  seen.push(...r.coreIds);
  d.setRound(r); d.recordReplayCycle();
}
if(new Set(seen).size!==60) throw Error('core repeated: '+new Set(seen).size);
if(seen.slice(0,15).some(id=>tutorialReserved.has(id))) throw Error('tutorial core in first three rounds');
console.log('PASS scheduler: 12 rounds / 60 unique; tutorial cores avoided first 3 rounds');
