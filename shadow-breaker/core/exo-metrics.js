// EXO Metrics (D3 Neuro Performance)
window.EXO_METRICS=(function(){
  function std(arr){ if(!arr.length) return 0; const m = arr.reduce((a,b)=>a+b,0)/arr.length; return Math.sqrt(arr.reduce((s,x)=>s+(x-m)*(x-m),0)/arr.length); }
  class Recorder{
    constructor(module){ this.module=module; this.events=[]; }
    log(ev){ this.events.push(ev); }
    summary(){
      const ok=this.events.filter(e=>e.success); const rts=ok.map(e=>e.reactionMs||0).sort((a,b)=>a-b);
      const avg = rts.length? rts.reduce((a,b)=>a+b,0)/rts.length : 0;
      const p95 = rts.length? rts[Math.floor(0.95*(rts.length-1))] : 0;
      const acc = this.events.length? (ok.length*100/this.events.length):0;
      const stab= std(rts);
      const score=(acc*5) + Math.max(0,200-avg)*1.5 + Math.max(0,50-stab);
      return {module:this.module,total:this.events.length,success:ok.length,avgReactionMs:avg,p95ReactionMs:p95,accuracyPct:acc,stability:stab,score};
    }
    csv(sessionId){
      let s="sessionId,module,eventIndex,timestamp,stimulusTime,responseTime,reactionMs,success,hitQuality,timingErrorMs,decisionMs\n";
      this.events.forEach((e,i)=>{
        s+=`${sessionId},${this.module},${i},${e.t||0},${e.stimulus||0},${e.response||0},${e.reactionMs||0},${e.success},${(e.hitQuality??0).toFixed(3)},${(e.timingErrorMs??0).toFixed(1)},${(e.decisionMs??0).toFixed(1)}\n`;
      });
      const sum=this.summary();
      s+=`\n# Summary,module,total,avgReactionMs,p95ReactionMs,accuracyPct,stability,score\n`;
      s+=`# ,${sum.module},${sum.total},${sum.avgReactionMs.toFixed(1)},${sum.p95ReactionMs.toFixed(1)},${sum.accuracyPct.toFixed(1)},${sum.stability.toFixed(1)},${sum.score.toFixed(1)}\n`;
      return s;
    }
  }
  return {Recorder};
})();
