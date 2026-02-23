// === /fitness/js/fatigue-guard.js ===
// Fatigue Guard — detects rising RT + high miss streak (research-safe)

'use strict';

function nowMs(){ return performance.now ? performance.now() : Date.now(); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function mean(xs){ return xs.reduce((a,b)=>a+b,0)/xs.length; }

export function makeFatigueGuard(opts){
  const o = Object.assign({
    windowMs: 20000,       // analyze last 20s
    minActions: 12,        // need enough samples
    missHi: 0.60,          // high miss rate threshold
    rtHiMs: 900,           // high RT mean threshold
    rtJumpMs: 250,         // jump compared to baseline
    cooldownMs: 45000,     // don't spam fatigue alerts
    restMs: 15000,         // suggested rest time
    // hooks
    onFlag: null,          // ({reason, snapshot})=>{}
    emit: null             // (type, meta)=>{}  e.g. logger.emit('warn', {...})
  }, opts||{});

  // rolling action log
  const acts = []; // {t, ok, rt}
  let lastFlagAt = -1;
  let baselineRT = null;

  function prune(t){
    const cut = t - o.windowMs;
    while(acts.length && acts[0].t < cut) acts.shift();
  }

  function snapshot(t){
    prune(t);
    const N = acts.length;
    const missN = acts.filter(a=>!a.ok).length;
    const missRate = N ? (missN/N) : 0;
    const rts = acts.filter(a=>a.ok && Number.isFinite(a.rt)).map(a=>a.rt);
    const rtMean = rts.length ? mean(rts) : NaN;
    return { N, missN, missRate, rtMean, baselineRT };
  }

  function canFlag(t){
    return (lastFlagAt < 0) || (t - lastFlagAt > o.cooldownMs);
  }

  function check(t){
    const s = snapshot(t);
    if(s.N < o.minActions) return;

    // baseline build: first stable 8-20 hits
    if(s.baselineRT == null && Number.isFinite(s.rtMean)){
      // baseline only when miss not too crazy
      if(s.missRate < 0.45) baselineRT = s.rtMean;
    }

    // conditions
    const missBad = (s.missRate >= o.missHi);
    const rtBadAbs = (Number.isFinite(s.rtMean) && s.rtMean >= o.rtHiMs);
    const rtBadJump = (baselineRT != null && Number.isFinite(s.rtMean) && (s.rtMean - baselineRT) >= o.rtJumpMs);

    if(!canFlag(t)) return;

    if(missBad && (rtBadAbs || rtBadJump)){
      lastFlagAt = t;
      const reason = rtBadJump ? 'rt_jump+miss' : 'rt_high+miss';

      // emit event (research safe)
      try{
        o.emit && o.emit('warn', {
          ai:'fatigue',
          kind:'flag',
          reason,
          windowMs:o.windowMs,
          N:s.N, missN:s.missN,
          missRate:Number(s.missRate.toFixed(3)),
          rtMean: Number.isFinite(s.rtMean) ? Math.round(s.rtMean) : '',
          baselineRT: baselineRT!=null ? Math.round(baselineRT) : ''
        });
      }catch(_){}

      try{ o.onFlag && o.onFlag({ reason, snapshot:s }); }catch(_){}
    }
  }

  return {
    pushAction(ok, rt){
      const t = nowMs();
      acts.push({ t, ok:!!ok, rt: Number(rt) });
      check(t);
    },
    resetBaseline(){
      baselineRT = null;
    },
    getSnapshot(){
      return snapshot(nowMs());
    }
  };
}