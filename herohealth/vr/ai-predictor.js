// === /herohealth/vr/ai-predictor.js ===
// HHA AI Predictor — PRODUCTION (Explainable + Research-safe)
// ✅ Predict p_fail (frustration/near-fail) + p_passGreen + p_stormFail
// ✅ Actions: easeSpawn / easeWater / hintCoach (Play only)
// ✅ Research: AI OFF by default (no actions), but can still compute/emit if you set ?ai=1
// ✅ Deterministic in research via seed (no Math.random usage when research)
// ✅ Emits: hha:ai { game, p_fail, p_green, p_storm, action, reason[], at, meta }

'use strict';

export function createAIPredictor(opts = {}){
  const WIN = (typeof window !== 'undefined') ? window : globalThis;
  const DOC = WIN.document;

  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : ((name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } });

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now=()=> Date.now();

  const game = String(opts.game || 'game').toLowerCase();
  const mode = String(opts.mode || qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const inResearch = (mode === 'research' || mode === 'study');

  // AI master switch:
  // - default: ON in play, OFF in research
  // - override: ?ai=0 disables even in play, ?ai=1 enables even in research (for debugging only)
  const aiQ = String(qs('ai', inResearch ? '0' : '1')).toLowerCase();
  const enabled = !(aiQ==='0' || aiQ==='false' || aiQ==='off');

  // deterministic noise helper (research-safe)
  const seedStr = String(opts.seed || qs('seed','') || '');
  function hashStr(s){
    s=String(s||''); let h=2166136261;
    for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
    return (h>>>0);
  }
  function makeRng(seed){
    let x = hashStr(seed) || 123456789;
    return function(){
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17; x >>>= 0;
      x ^= x << 5;  x >>>= 0;
      return (x>>>0) / 4294967296;
    };
  }
  const rng = makeRng(seedStr || 'ai');

  function sigmoid(z){ return 1/(1+Math.exp(-z)); }

  // rolling buffers
  const BUF = {
    miss10s: 0,
    comboBreak10s: 0,
    rtMed: 0.65,           // 0..1 (normalized)
    zoneOsc10s: 0,
    lastZone: '',
    lastZoneChangeAt: 0,

    // storm outcomes
    stormSeen: 0,
    stormFail: 0,
    stormFailLast2: 0,

    // smoothing
    emaFail: 0.25,
    emaGreen: 0.55,
    emaStorm: 0.35,
    lastEmitAt: 0,
  };

  // throttle outputs
  const OUT = {
    // update at ~500ms
    minIntervalMs: clamp(parseInt(qs('aiTick', String(opts.minIntervalMs ?? 500)),10)||500, 200, 2000),

    // action cool-down
    actionCdMs: clamp(parseInt(qs('aiCd', String(opts.actionCooldownMs ?? 2200)),10)||2200, 600, 8000),

    // coach cue cooldown handled by ai-coach itself; here just request
  };

  let lastActionAt = 0;
  let lastTickAt = 0;

  // ---- explainable logistic weights (tunable) ----
  // Inputs assumed in 0..1
  const W = {
    // fail/frustration predictor
    b_fail: -0.40,
    missRate:  2.10,   // high miss drives fail
    rtMed:     1.10,   // slower reactions drives fail
    comboBreak:0.95,
    zoneOsc:   1.05,
    fatigue:   0.60,

    // green pass predictor
    b_green:  0.30,
    acc:      1.20,
    zoneGreen:0.95,
    stability:0.80,
    fatigueG: -0.70,

    // storm fail predictor
    b_storm: -0.10,
    stormFailLast2: 1.30,
    missRateS:      1.10,
    zoneNonGreen:   0.85,
    shieldLow:      0.75,
  };

  function normMissRate(miss, playedSec){
    // miss per second ~0..0.6 normalize
    const r = (miss / Math.max(1, playedSec));
    return clamp(r/0.45, 0, 1);
  }

  function normComboBreaks(breaks){
    // 0..6 typical
    return clamp(breaks/6, 0, 1);
  }

  function normZoneOsc(x){
    // oscillations per 10s 0..4
    return clamp(x/4, 0, 1);
  }

  function normRT(rtMs){
    // hydration doesn't explicitly compute RT, we accept normalized 0..1 from engine
    // if caller passes raw ms, try normalize: 250..900ms -> 0..1
    const v = Number(rtMs);
    if (!isFinite(v)) return 0.6;
    if (v > 5) return clamp((v-250)/650, 0, 1);
    return clamp(v, 0, 1);
  }

  function zoneGreenK(zone){
    return String(zone||'').toUpperCase()==='GREEN' ? 1 : 0;
  }
  function zoneNonGreenK(zone){
    return String(zone||'').toUpperCase()==='GREEN' ? 0 : 1;
  }

  function decisionChance(p){
    // In play: slightly stochastic, in research: deterministic bucketed
    p = clamp(p,0,1);
    if (!inResearch) return Math.random() < p;
    return rng() < p;
  }

  function compute(st){
    // Expected state:
    // { misses, combo, comboBreaks10s, playedSec, accuracyGoodPct, waterZone,
    //   zoneOsc10s, rtNorm, fatigue, shield, stormFailLast2 }
    const playedSec = clamp(st.playedSec ?? 1, 1, 9999);
    const missRate = normMissRate(st.misses ?? 0, playedSec);
    const comboBreak = clamp(st.comboBreaks10s ?? 0, 0, 99);
    const comboBreakK = normComboBreaks(comboBreak);
    const zoneOscK = normZoneOsc(st.zoneOsc10s ?? 0);
    const rtK = normRT(st.rtNorm ?? 0.6);
    const fatigue = clamp(st.fatigue ?? 0, 0, 1);
    const accK = clamp((Number(st.accuracyGoodPct||0)/100), 0, 1);
    const zGreen = zoneGreenK(st.waterZone);
    const zNon = 1 - zGreen;
    const stability = clamp(1 - zoneOscK, 0, 1);
    const shield = clamp((st.shield|0), 0, 6);
    const shieldLow = clamp(1 - (shield/3), 0, 1);
    const stormFailLast2 = clamp(st.stormFailLast2 ?? 0, 0, 1);

    // p_fail
    const zf =
      W.b_fail +
      W.missRate * missRate +
      W.rtMed * rtK +
      W.comboBreak * comboBreakK +
      W.zoneOsc * zoneOscK +
      W.fatigue * fatigue;

    const p_fail = sigmoid(zf);

    // p_green pass
    const zg =
      W.b_green +
      W.acc * accK +
      W.zoneGreen * zGreen +
      W.stability * stability +
      W.fatigueG * fatigue;

    const p_green = sigmoid(zg);

    // storm fail
    const zs =
      W.b_storm +
      W.stormFailLast2 * stormFailLast2 +
      W.missRateS * missRate +
      W.zoneNonGreen * zNon +
      W.shieldLow * shieldLow;

    const p_stormFail = sigmoid(zs);

    // smooth
    BUF.emaFail  = BUF.emaFail*0.82  + p_fail*0.18;
    BUF.emaGreen = BUF.emaGreen*0.82 + p_green*0.18;
    BUF.emaStorm = BUF.emaStorm*0.82 + p_stormFail*0.18;

    // explainable reasons
    const reason = [];
    if (missRate > 0.55) reason.push('high_miss');
    if (rtK > 0.68) reason.push('slow_rt');
    if (comboBreakK > 0.55) reason.push('combo_breaks');
    if (zoneOscK > 0.55) reason.push('zone_oscillation');
    if (fatigue > 0.75) reason.push('fatigue_high');
    if (shieldLow > 0.65) reason.push('low_shield');
    if (stormFailLast2 > 0.5) reason.push('recent_storm_fail');

    return {
      p_fail: BUF.emaFail,
      p_green: BUF.emaGreen,
      p_stormFail: BUF.emaStorm,
      reason,
      meta: {
        missRate, rtK, comboBreakK, zoneOscK, fatigue, accK, zGreen, shieldLow, stormFailLast2
      }
    };
  }

  function chooseAction(pred, st){
    // Actions only if enabled AND not research (default)
    if (!enabled) return { action:'off', ease:{}, coach:null };
    if (inResearch) return { action:'research_off', ease:{}, coach:null };

    const t = now();
    if (t - lastActionAt < OUT.actionCdMs){
      return { action:'hold', ease:{}, coach:null };
    }

    // thresholds (kids-friendly; can be tuned by URL)
    const thrFail = clamp(parseFloat(qs('aiFail', String(opts.thrFail ?? 0.58))), 0.1, 0.95);
    const thrStorm = clamp(parseFloat(qs('aiStorm', String(opts.thrStorm ?? 0.60))), 0.1, 0.95);

    const thrGreenLow = clamp(parseFloat(qs('aiGreenLow', String(opts.thrGreenLow ?? 0.42))), 0.1, 0.95);

    const isKids = !!st.kids;

    // ease profile (small nudges)
    const ease = { spawnMul:1.0, badMul:1.0, waterNudgeMul:1.0, lockPxMul:1.0 };
    let coach = null;
    let action = 'none';

    // 1) if near-fail -> soften slightly
    if (pred.p_fail >= thrFail){
      action = 'ease_fail';
      ease.spawnMul = isKids ? 1.10 : 1.06;         // slower spawns
      ease.badMul   = isKids ? 0.88 : 0.92;         // fewer bad
      ease.waterNudgeMul = isKids ? 1.12 : 1.06;    // easier gauge control
      ease.lockPxMul = isKids ? 1.06 : 1.03;        // a bit more assist in cVR

      coach = isKids
        ? 'ค่อย ๆ เล็งก่อนนะ ยิงช้า ๆ แต่ชัวร์ 😊'
        : 'ลดการรัวยิง—คุมจังหวะให้ชัวร์';

      // probabilistic fire to avoid being too obvious
      if (!decisionChance(0.80)) return { action:'hold', ease:{}, coach:null };
      lastActionAt = t;
      return { action, ease, coach };
    }

    // 2) storm fail risk -> prep storm
    if (pred.p_stormFail >= thrStorm){
      action = 'prep_storm';
      ease.badMul = isKids ? 0.90 : 0.94;
      ease.spawnMul = isKids ? 1.06 : 1.03;

      coach = isKids
        ? 'ใกล้พายุแล้ว เก็บ 🛡️ ไว้บล็อกช่วงท้าย!'
        : 'เตรียม STORM: เก็บโล่ไว้บล็อกท้ายพายุ';

      if (!decisionChance(0.70)) return { action:'hold', ease:{}, coach:null };
      lastActionAt = t;
      return { action, ease, coach };
    }

    // 3) green success low -> gentle water help
    if (pred.p_green <= thrGreenLow){
      action = 'help_green';
      ease.waterNudgeMul = isKids ? 1.10 : 1.04;
      coach = isKids ? 'ลองยิง 💧 ให้เข้า GREEN นะ!' : 'โฟกัสคุม GREEN';
      if (!decisionChance(0.55)) return { action:'hold', ease:{}, coach:null };
      lastActionAt = t;
      return { action, ease, coach };
    }

    return { action:'none', ease:{}, coach:null };
  }

  function update(st = {}){
    const t = now();
    if (t - lastTickAt < OUT.minIntervalMs) return null;
    lastTickAt = t;

    const pred = compute(st);
    const pick = chooseAction(pred, st);

    // emit AI event occasionally (even if action none)
    const emitEvery = clamp(parseInt(qs('aiEmit', String(opts.emitEveryMs ?? 1200)),10)||1200, 400, 4000);
    if (t - BUF.lastEmitAt >= emitEvery){
      BUF.lastEmitAt = t;
      emit('hha:ai', {
        game,
        runMode: mode,
        p_fail: Number(pred.p_fail.toFixed(3)),
        p_green: Number(pred.p_green.toFixed(3)),
        p_stormFail: Number(pred.p_stormFail.toFixed(3)),
        action: pick.action,
        reason: pred.reason.slice(0,6),
        at: t,
        meta: pred.meta
      });
    }

    return { pred, pick };
  }

  return {
    enabled,
    inResearch,
    update
  };
}