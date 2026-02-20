// === /fitness/js/boss-phase.js ===
// Universal Boss Phase Controller (deterministic-friendly)

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

export function createBossController(opts){
  const o = Object.assign({
    enabled: false,
    hp: 12,                 // hit points
    totalMs: 24000,         // boss window total
    phase1Ms: 9000,
    phase2Ms: 9000,
    burstMs: 6000,
    // difficulty knobs scaling (optional)
    ts: 1.0,                // time scale (<1 faster)
    // hooks
    onPhase: null,          // (phaseName, bossState)=>{}
    onClear: null,          // ()=>{}
    onFail: null,           // ()=>{}
  }, opts||{});

  const S = {
    on: !!o.enabled,
    hpMax: Math.max(1, o.hp|0),
    hp: Math.max(1, o.hp|0),
    phase: 'off',           // 'p1'|'p2'|'burst'|'clear'|'fail'
    t0: 0,
    tEnd: 0,
    lastPhase: '',
    hits: 0,
    misses: 0,
  };

  function start(nowMs){
    if(!S.on) return S;
    S.t0 = nowMs;
    const total = Math.max(1000, o.totalMs * (o.ts||1));
    S.tEnd = nowMs + total;
    S.phase = 'p1';
    S.lastPhase = '';
    emitPhase('p1');
    return S;
  }

  function elapsed(nowMs){ return Math.max(0, nowMs - S.t0); }
  function remaining(nowMs){ return Math.max(0, S.tEnd - nowMs); }

  function emitPhase(phaseName){
    if(S.lastPhase === phaseName) return;
    S.lastPhase = phaseName;
    S.phase = phaseName;
    try{ o.onPhase && o.onPhase(phaseName, snapshot()); }catch(_){}
  }

  function snapshot(){
    return {
      on: S.on, phase: S.phase,
      hp: S.hp, hpMax: S.hpMax,
      hits: S.hits, misses: S.misses,
      t0: S.t0, tEnd: S.tEnd
    };
  }

  function tick(nowMs){
    if(!S.on) return snapshot();

    const t = elapsed(nowMs);
    const p1 = Math.max(1000, o.phase1Ms * (o.ts||1));
    const p2 = Math.max(1000, o.phase2Ms * (o.ts||1));
    const b  = Math.max(1000, o.burstMs  * (o.ts||1));

    if(S.hp <= 0){
      S.phase = 'clear';
      try{ o.onClear && o.onClear(); }catch(_){}
      return snapshot();
    }

    if(nowMs >= S.tEnd){
      S.phase = 'fail';
      try{ o.onFail && o.onFail(); }catch(_){}
      return snapshot();
    }

    if(t < p1) emitPhase('p1');
    else if(t < p1 + p2) emitPhase('p2');
    else if(t < p1 + p2 + b) emitPhase('burst');
    else emitPhase('burst'); // safety

    return snapshot();
  }

  function hit(dmg=1){
    if(!S.on) return snapshot();
    dmg = Math.max(1, dmg|0);
    S.hp = clamp(S.hp - dmg, 0, S.hpMax);
    S.hits++;
    return snapshot();
  }

  function miss(){
    if(!S.on) return snapshot();
    S.misses++;
    return snapshot();
  }

  function isOn(){ return !!S.on; }

  return { start, tick, hit, miss, snapshot, isOn };
}