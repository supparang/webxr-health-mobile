// === /herohealth/vr/ai-predictor.js ===
// HHA AI Predictor — PRODUCTION (Play-only)
// ✅ Purpose: small “ML-like” predictor that outputs:
//    - pred: risk signals (fail/storm/greenLow) + reasons
//    - pick: easing actions (spawnMul/badMul/waterNudgeMul/lockPxMul) + optional coach msg
// ✅ Research mode: OFF (no actions) to keep deterministic + fair study
// ✅ Deterministic-ish: uses seed for tie-break noise (but still OFF in research)
//
// Usage:
//   import { createAIPredictor } from '../vr/ai-predictor.js';
//   const AIPRED = createAIPredictor({ emit, game:'hydration', mode: run, seed });
//   const out = AIPRED.update(features);  // returns { pred, pick } or null if throttled

'use strict';

export function createAIPredictor(opts = {}){
  const emit = typeof opts.emit === 'function' ? opts.emit : ()=>{};
  const game = String(opts.game || 'unknown');
  const mode = String(opts.mode || 'play').toLowerCase();
  const seedStr = String(opts.seed || 'seed');

  const minIntervalMs = Number(opts.minIntervalMs ?? 500);
  const actionCooldownMs = Number(opts.actionCooldownMs ?? 2200);

  const thrFail = Number(opts.thrFail ?? 0.58);
  const thrStorm = Number(opts.thrStorm ?? 0.60);
  const thrGreenLow = Number(opts.thrGreenLow ?? 0.42);

  const emitEveryMs = Number(opts.emitEveryMs ?? 1200);

  // research OFF
  const inResearch = (mode === 'research' || mode === 'study');
  const enabled = !inResearch;

  // deterministic tiny RNG (for play-only tie-break)
  function hashStr(s){
    s = String(s||'');
    let h = 2166136261;
    for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h>>>0);
  }
  let _x = hashStr(seedStr) || 123456789;
  function rnd(){
    _x ^= _x << 13; _x >>>= 0;
    _x ^= _x >> 17; _x >>>= 0;
    _x ^= _x << 5;  _x >>>= 0;
    return (_x>>>0) / 4294967296;
  }

  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  let lastAt = 0;
  let lastActionAt = 0;
  let lastEmitAt = 0;

  // EMA state (lightweight “online learning” feel)
  const st = {
    emaAcc: 0.62,
    emaMissRate: 0.12,
    emaCombo: 0.20,
    emaFatigue: 0.00,
    emaZoneOsc: 0.20,
    lastAction: '',
    lastReason: []
  };

  function update(features = {}){
    const now = performance.now ? performance.now() : Date.now();
    if (now - lastAt < minIntervalMs) return null;
    lastAt = now;

    // features (normalized-ish)
    const misses = Number(features.misses || 0);
    const combo = Number(features.combo || 0);
    const playedSec = Math.max(1, Number(features.playedSec || 1));

    const acc = clamp(Number(features.accuracyGoodPct || 0) / 100, 0, 1);
    const fatigue = clamp(Number(features.fatigue || 0), 0, 1);
    const frustration = clamp(Number(features.frustration || 0), 0, 1);

    const waterZone = String(features.waterZone || '');
    const green = (waterZone === 'GREEN');

    const zoneOsc10s = clamp(Number(features.zoneOsc10s || 0), 0, 1);
    const rtNorm = clamp(Number(features.rtNorm || 0.6), 0, 1);
    const shield = clamp(Number(features.shield || 0), 0, 9);
    const inStorm = !!features.inStorm;
    const stormFailLast2 = clamp(Number(features.stormFailLast2 || 0), 0, 1);
    const kids = !!features.kids;

    // EMAs
    const missRate = clamp(misses / (playedSec/10 + 1), 0, 1);
    st.emaAcc = st.emaAcc*0.86 + acc*0.14;
    st.emaMissRate = st.emaMissRate*0.86 + missRate*0.14;
    st.emaCombo = st.emaCombo*0.86 + clamp(combo/20,0,1)*0.14;
    st.emaFatigue = st.emaFatigue*0.90 + fatigue*0.10;
    st.emaZoneOsc = st.emaZoneOsc*0.90 + zoneOsc10s*0.10;

    // -------- risk model (simple but “ML-like”) ----------
    // fail risk: low acc + high miss + frustration + fatigue + slow RT
    let pFail =
      (1 - st.emaAcc)*0.48 +
      st.emaMissRate*0.28 +
      frustration*0.10 +
      st.emaFatigue*0.08 +
      (1-rtNorm)*0.06;

    // storm risk: fail risk + oscillation + low shield + recent storm fails
    let pStorm =
      pFail*0.55 +
      st.emaZoneOsc*0.20 +
      clamp(1 - (shield/2), 0, 1)*0.15 +
      stormFailLast2*0.10;

    // green low (needs help): if not green + miss rising
    let pGreenLow =
      (green ? 0 : 0.45) +
      st.emaMissRate*0.30 +
      st.emaZoneOsc*0.15 +
      st.emaFatigue*0.10;

    // kids dampen (more forgiving)
    if (kids){
      pFail *= 0.92;
      pStorm *= 0.92;
      pGreenLow *= 0.92;
    }

    pFail = clamp(pFail, 0, 1);
    pStorm = clamp(pStorm, 0, 1);
    pGreenLow = clamp(pGreenLow, 0, 1);

    const reason=[];
    if (st.emaAcc < 0.55) reason.push('low_accuracy');
    if (st.emaMissRate > 0.35) reason.push('high_miss_rate');
    if (st.emaZoneOsc > 0.55) reason.push('zone_oscillation');
    if (st.emaFatigue > 0.60) reason.push('fatigue');
    if (!green) reason.push('not_green');
    if (shield <= 0) reason.push('no_shield');

    const pred = {
      game,
      mode,
      enabled,
      pFail: Number(pFail.toFixed(3)),
      pStorm: Number(pStorm.toFixed(3)),
      pGreenLow: Number(pGreenLow.toFixed(3)),
      reason: reason.slice(0, 8)
    };

    // -------- action policy (only in play) ----------
    let pick = null;

    if (enabled && (now - lastActionAt >= actionCooldownMs)){
      const needFailHelp = (pFail >= thrFail);
      const needStormHelp = (pStorm >= thrStorm);
      const needGreenHelp = (pGreenLow >= thrGreenLow);

      // score actions
      const scoreEaseBad = (needFailHelp?0.6:0) + (needStormHelp?0.4:0) + (shield<=0?0.2:0);
      const scoreEaseSpawn = (needFailHelp?0.55:0) + (needStormHelp?0.25:0) + (st.emaFatigue>0.65?0.15:0);
      const scoreWaterHelp = (needGreenHelp?0.7:0) + (!green?0.25:0) + (st.emaZoneOsc>0.55?0.15:0);
      const scoreAimHelp = (needFailHelp?0.55:0) + (st.emaAcc<0.58?0.25:0) + ((1-rtNorm)>0.35?0.20:0);

      // choose best
      const scores = [
        {action:'ease_bad', s:scoreEaseBad},
        {action:'ease_spawn', s:scoreEaseSpawn},
        {action:'ease_water', s:scoreWaterHelp},
        {action:'ease_aim', s:scoreAimHelp},
        {action:'none', s:0.05}
      ].sort((a,b)=>b.s-a.s);

      // tie-break with seed RNG
      const best = scores[0];
      const second = scores[1];
      let action = best.action;
      if (second && Math.abs(best.s - second.s) < 0.08){
        if (rnd() < 0.5) action = second.action;
      }

      // build easing multipliers
      const ease = {
        spawnMul: 1.0,
        badMul: 1.0,
        waterNudgeMul: 1.0,
        lockPxMul: 1.0
      };

      let coach = '';

      if (action === 'ease_bad'){
        ease.badMul = 0.86;          // fewer bad
        ease.spawnMul = 1.08;        // slightly slower spawn feel
        coach = inStorm ? 'พายุแรง! โฟกัสเป้าใหญ่ก่อนนะ 🛡️' : 'ค่อย ๆ ยิงทีละเป้า จะคุมเกมง่ายขึ้น 😊';
      } else if (action === 'ease_spawn'){
        ease.spawnMul = 1.18;        // slower spawns
        coach = 'ช้าลงนิดนึง… เล็งให้ชัวร์ก่อนยิง 🎯';
      } else if (action === 'ease_water'){
        ease.waterNudgeMul = 1.22;   // help water recover faster
        coach = 'พยายามคุมให้อยู่ GREEN นาน ๆ นะ 💧';
      } else if (action === 'ease_aim'){
        ease.lockPxMul = 1.14;       // more generous aim assist
        coach = 'ยิงจากกลางจอแล้วรอให้ล็อกเป้าก่อนนิดนึง ✨';
      } else {
        // none: gently relax toward neutral
        ease.spawnMul = 1.0;
        ease.badMul = 1.0;
        ease.waterNudgeMul = 1.0;
        ease.lockPxMul = 1.0;
      }

      // if currently in storm, avoid too much spawn slowdown (keep exciting)
      if (inStorm){
        ease.spawnMul = clamp(ease.spawnMul, 0.95, 1.12);
      }

      // kids: slightly more help
      if (kids){
        ease.badMul = clamp(ease.badMul*0.98, 0.78, 1.0);
        ease.lockPxMul = clamp(ease.lockPxMul*1.02, 0.95, 1.20);
        ease.spawnMul = clamp(ease.spawnMul*1.03, 0.90, 1.28);
        ease.waterNudgeMul = clamp(ease.waterNudgeMul*1.03, 0.90, 1.35);
      }

      pick = { action, ease, coach };

      // mark action
      if (action !== 'none'){
        lastActionAt = now;
        st.lastAction = action;
        st.lastReason = pred.reason.slice(0,6);
      }
    }

    // optional telemetry emit (rate-limited)
    if (enabled && (now - lastEmitAt >= emitEveryMs)){
      lastEmitAt = now;
      try{
        emit('hha:ai', { kind:'predict', pred, pick });
      }catch(_){}
    }

    return { pred, pick };
  }

  return {
    game,
    mode,
    enabled,
    inResearch,
    update
  };
}