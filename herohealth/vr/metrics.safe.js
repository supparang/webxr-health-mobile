// === /herohealth/vr/metrics.safe.js ===
// HHA Metrics — PRODUCTION
// ✅ Rolling accuracy, RT median, miss burst, zone uptime helper
export function createMetrics(){
  const hits = [];
  const rts = [];
  let missBurst = 0;
  let missBurstMax = 0;

  function median(arr){
    if(!arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    return a[(a.length/2)|0];
  }

  return {
    onHit(rtMs){
      hits.push(1);
      if(rtMs>0 && isFinite(rtMs)) rts.push(rtMs);
      missBurst = 0;
    },
    onMiss(){
      hits.push(0);
      missBurst++;
      missBurstMax = Math.max(missBurstMax, missBurst);
    },
    snapshot(){
      const judged = hits.length || 1;
      const acc = Math.round((hits.reduce((s,x)=>s+x,0)/judged)*100);
      return {
        accuracyPct: acc,
        rtMedianMs: Math.round(median(rts) || 0),
        missBurst: missBurst,
        missBurstMax
      };
    }
  };
}