const fs = require('fs'); const vm=require('vm');
class Store { constructor(){this.m=new Map()} getItem(k){return this.m.has(k)?this.m.get(k):null} setItem(k,v){this.m.set(k,String(v))} removeItem(k){this.m.delete(k)} get length(){return this.m.size} key(i){return [...this.m.keys()][i]||null} }
const store=new Store();
store.setItem('uxquest-w1-progress-v7', JSON.stringify({bestStars:3,bestScore:350,tutorialComplete:true,totalRounds:1}));
const ctx={window:{},localStorage:store,console,Date,Math,CustomEvent:function(){}}; ctx.window=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('/mnt/data/uxquest_w1_v8_final/sgnal-hunt/js/uxq-progress-v8.js','utf8'),ctx);
const w1=ctx.UXQProgressV8.readW1();
if(!w1.cleared || w1.stars!==3 || w1.score!==350) throw new Error('legacy migration failure '+JSON.stringify(w1));
console.log('PASS legacy migration',w1);
// data checks
vm.runInContext(fs.readFileSync('/mnt/data/uxquest_w1_v8_final/sgnal-hunt/js/uxq-w1-data.js','utf8'),ctx);
if(ctx.UXQ_W1_TUTORIAL_CASES.length!==5||ctx.UXQ_W1_REPLAY_CORE_CASES.length!==60||ctx.UXQ_W1_REPLAY_SCENARIOS.length!==720) throw new Error('bank counts incorrect');
console.log('PASS data counts',ctx.UXQ_W1_TUTORIAL_CASES.length,ctx.UXQ_W1_REPLAY_CORE_CASES.length,ctx.UXQ_W1_REPLAY_SCENARIOS.length);
