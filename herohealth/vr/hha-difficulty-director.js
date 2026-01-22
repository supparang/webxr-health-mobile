// === /herohealth/vr/hha-difficulty-director.js ===
// HHA Difficulty Director — FAIR Survival Tuning (Explainable + Deterministic Research)
// API: window.HHA_DD.create({ seed, runMode, base, bounds }) -> dd
// dd.onEvent(type, payload) // 'step_hit','haz_hit','tick'
// dd.getParams() -> {spawnPerSec, hazardRate, decoyRate}
// dd.getSummaryExtras()

(function(root){
  'use strict';

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };
  const now = ()=>Date.now();
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const lerp = (a,b,t)=>a + (b-a)*t;

  function makeRNG(seed){
    let x = (Number(seed)||123456789) >>> 0;
    return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
  }

  function median(arr){
    arr = (arr||[]).map(Number).filter(x=>isFinite(x)).sort((a,b)=>a-b);
    if(!arr.length) return 0;
    const m = (arr.length-1)/2;
    return (arr.length%2) ? arr[m|0] : (arr[m|0] + arr[(m|0)+1])/2;
  }

  function create(cfg){
    cfg = cfg || {};
    const runMode = String(cfg.runMode || qs('run','play') || 'play').toLowerCase();
    const isResearch = runMode === 'research';

    const seed = (cfg.seed != null ? cfg.seed : (qs('seed') || Date.now()));
    const rnd = makeRNG(seed);

    // Base + bounds (safe defaults)
    const base = Object.assign({
      spawnPerSec: 2.2,
      hazardRate: 0.12,
      decoyRate: 0.22,
      windowMs: 10000
    }, cfg.base||{});

    const bounds = Object.assign({
      spawnPerSec: [1.2, 4.2],
      hazardRate:  [0.05, 0.28],
      decoyRate:   [0.10, 0.40],
    }, cfg.bounds||{});

    // Current params
    let p = {
      spawnPerSec: base.spawnPerSec,
      hazardRate:  base.hazardRate,
      decoyRate:   base.decoyRate
    };

    // Events buffer (rolling window)
    const ev = []; // {t,type, ok, rtMs}
    let lastTuneAt = 0;

    // Research deterministic schedule: compute target difficulty from time bucket (no feedback loop)
    const researchPlan = {
      // 0..1 difficulty over time
      // simple 3-stage curve: warmup -> mid -> boss
      diffAtSec(s){
        // deterministic but not random; uses seed to vary slightly (still deterministic)
        const wobble = (rnd()*0.10) - 0.05; // fixed for session because rnd advances
        if(s < 15) return clamp(0.25 + wobble, 0, 1);
        if(s < 45) return clamp(0.50 + wobble, 0, 1);
        return clamp(0.72 + wobble, 0, 1);
      }
    };

    // Explainable diagnostics
    const ddLog = []; // last N tunes

    function pushEvent(type, payload){
      const t = now();
      payload = payload || {};
      if(type === 'step_hit'){
        ev.push({ t, type, ok: !!payload.ok, rtMs: Number(payload.rtMs||0) });
      }else if(type === 'haz_hit'){
        ev.push({ t, type });
      }else if(type === 'tick'){
        // can store tick markers if needed
      }
      // purge old
      const cutoff = t - base.windowMs;
      while(ev.length && ev[0].t < cutoff) ev.shift();
    }

    function windowStats(){
      const hits = ev.filter(x=>x.type==='step_hit');
      const ok = hits.filter(x=>x.ok).length;
      const bad= hits.length - ok;
      const haz= ev.filter(x=>x.type==='haz_hit').length;
      const rt = median(hits.filter(x=>x.ok).map(x=>x.rtMs).filter(x=>x>0));
      const acc = hits.length ? (ok / hits.length) : 0;
      return { hits: hits.length, ok, bad, haz, rtMs: rt, acc };
    }

    function computeStress(st){
      // stress high when acc low, haz high, rt very high (slow)
      // normalize
      const accBad = clamp(1 - st.acc, 0, 1);
      const hazBad = clamp(st.haz / 3.0, 0, 1);      // 0..3 haz/window ~ bad
      const rtBad  = clamp((st.rtMs - 900) / 900, 0, 1); // 900..1800ms
      // weighted
      return clamp(accBad*0.55 + hazBad*0.30 + rtBad*0.15, 0, 1);
    }

    function tuneAdaptive(){
      const t = now();
      if(t - lastTuneAt < 1200) return; // tune at most ~0.8Hz
      lastTuneAt = t;

      const st = windowStats();
      // if no data yet, stay near base
      if(st.hits < 5 && st.haz < 1) return;

      const stress = computeStress(st);

      // goal: keep stress around 0.45–0.55
      const targetStress = 0.50;
      const err = (stress - targetStress); // + => too hard, - => too easy

      // update rules (small steps)
      // too hard: decrease spawn/haz/decoy
      // too easy: increase
      const step = clamp(Math.abs(err), 0.05, 0.20); // magnitude
      const dir = (err > 0) ? -1 : +1;

      const sp = p.spawnPerSec + dir * step * 0.55;
      const hz = p.hazardRate  + dir * step * 0.08;
      const dc = p.decoyRate   + dir * step * 0.10;

      const prev = Object.assign({}, p);
      p.spawnPerSec = clamp(sp, bounds.spawnPerSec[0], bounds.spawnPerSec[1]);
      p.hazardRate  = clamp(hz, bounds.hazardRate[0],  bounds.hazardRate[1]);
      p.decoyRate   = clamp(dc, bounds.decoyRate[0],   bounds.decoyRate[1]);

      ddLog.unshift({
        atMs: t,
        mode: 'adaptive',
        stats: st,
        stress: Number(stress.toFixed(3)),
        err: Number(err.toFixed(3)),
        prev, next: Object.assign({}, p)
      });
      ddLog.splice(18);
    }

    function tuneResearch(elapsedSec){
      // deterministic params from difficulty scalar
      const t = now();
      if(t - lastTuneAt < 900) return;
      lastTuneAt = t;

      const d = researchPlan.diffAtSec(elapsedSec); // 0..1
      const prev = Object.assign({}, p);

      // map diff -> params (monotonic)
      p.spawnPerSec = lerp(bounds.spawnPerSec[0], bounds.spawnPerSec[1], d);
      p.hazardRate  = lerp(bounds.hazardRate[0],  bounds.hazardRate[1],  d*0.85);
      p.decoyRate   = lerp(bounds.decoyRate[0],   bounds.decoyRate[1],   0.25 + d*0.75);

      // keep clean numeric
      p.spawnPerSec = Number(p.spawnPerSec.toFixed(3));
      p.hazardRate  = Number(p.hazardRate.toFixed(3));
      p.decoyRate   = Number(p.decoyRate.toFixed(3));

      // still compute stats for “analysis” but not used to change schedule
      const st = windowStats();
      const stress = computeStress(st);

      ddLog.unshift({
        atMs: t,
        mode: 'research_plan',
        elapsedSec: Number(elapsedSec.toFixed(1)),
        diff: Number(d.toFixed(3)),
        stats: st,
        stress: Number(stress.toFixed(3)),
        prev, next: Object.assign({}, p)
      });
      ddLog.splice(18);
    }

    function onEvent(type, payload){
      pushEvent(type, payload);

      if(isResearch){
        const elapsedSec = Number(payload && payload.elapsedSec != null ? payload.elapsedSec : 0);
        tuneResearch(elapsedSec);
      }else{
        tuneAdaptive();
      }
    }

    function getParams(){
      return Object.assign({}, p);
    }

    function getSummaryExtras(){
      return {
        ddMode: isResearch ? 'research_plan' : 'adaptive',
        ddSeed: Number(seed)||seed,
        ddParamsFinal: Object.assign({}, p),
        ddLogLast: ddLog.slice(0,8), // keep short
      };
    }

    return { onEvent, getParams, getSummaryExtras };
  }

  root.HHA_DD = { create };

})(window);