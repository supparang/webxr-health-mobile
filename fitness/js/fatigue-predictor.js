// === /fitness/js/fatigue-predictor.js ===
// Shadow Breaker — Fatigue/Focus Predictor (A-21)
// ✅ Real-time fatigue_pred (0..1) + focus_pred (0..1)
// ✅ Uses EWMA of RT, miss/timeout streak, lowHP exposure, fever recovery
'use strict';

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;

export function createFatiguePredictor(opts = {}){
  const cfg = Object.assign({
    ewmaA: 0.08,

    // normal RT reference (ms)
    rtGood: 260,
    rtBad: 720,

    // fatigue reacts to streaks
    streakGain: 0.09,
    streakDecay: 0.05,

    // lowHP adds fatigue
    lowHpGainPerSec: 0.10,

    // fever helps reduce fatigue
    feverReliefPerSec: 0.06,

    // clamp behavior
    maxFatigue: 1.0
  }, opts);

  const st = {
    rtEwma: 420,
    missStreak: 0,
    timeoutStreak: 0,
    fatigue: 0.35,
    focus: 0.65,
    lastTs: 0
  };

  function normRT(rtMs){
    const x = (rtMs - cfg.rtGood) / (cfg.rtBad - cfg.rtGood);
    return clamp(x, 0, 1);
  }

  function step(nowMs, ctx){
    // ctx: { dtMs, lowHp, feverOn, feverDtMs }
    const dt = Math.max(0, (ctx?.dtMs ?? 16) / 1000);

    // low hp -> fatigue rises
    if (ctx?.lowHp) st.fatigue = clamp(st.fatigue + cfg.lowHpGainPerSec * dt, 0, cfg.maxFatigue);

    // fever on -> relief a bit (player feels in control)
    if (ctx?.feverOn) st.fatigue = clamp(st.fatigue - cfg.feverReliefPerSec * dt, 0, cfg.maxFatigue);

    // streaks decay slowly when stable
    if (st.missStreak === 0 && st.timeoutStreak === 0){
      st.fatigue = clamp(st.fatigue - 0.02 * dt, 0, cfg.maxFatigue);
    }

    // focus is inverse-ish but also depends on RT
    const rtN = normRT(st.rtEwma);
    const streak = clamp((st.missStreak + st.timeoutStreak) / 6, 0, 1);
    st.focus = clamp(1 - (0.55*st.fatigue + 0.30*rtN + 0.25*streak), 0, 1);

    st.lastTs = nowMs;
    return snapshot();
  }

  function onHit(rtMs, kind){
    // only normal/bossface should affect RT strongly; decoy/bomb are different
    const rt = Number(rtMs);
    if (Number.isFinite(rt)){
      st.rtEwma = lerp(st.rtEwma, rt, cfg.ewmaA);
    }
    // good hit breaks streak
    st.timeoutStreak = 0;
    st.missStreak = 0;

    // small recovery on consistent hits
    st.fatigue = clamp(st.fatigue - 0.02, 0, cfg.maxFatigue);
  }

  function onMiss(type){
    // type: 'timeout' | 'bomb' | 'miss'
    if (type === 'timeout') st.timeoutStreak++;
    else st.missStreak++;

    const s = clamp((st.missStreak + st.timeoutStreak), 0, 8);
    st.fatigue = clamp(st.fatigue + cfg.streakGain * (0.6 + s*0.08), 0, cfg.maxFatigue);
  }

  function onStabilize(){
    // if player gets a heal/shield, treat as stabilization
    st.fatigue = clamp(st.fatigue - 0.03, 0, cfg.maxFatigue);
    st.missStreak = Math.max(0, st.missStreak - 1);
    st.timeoutStreak = Math.max(0, st.timeoutStreak - 1);
  }

  function snapshot(){
    const fatigue_pred = clamp(st.fatigue, 0, 1);
    const focus_pred = clamp(st.focus, 0, 1);
    return {
      fatigue_pred: +fatigue_pred.toFixed(3),
      focus_pred: +focus_pred.toFixed(3),
      rt_ewma_ms: Math.round(st.rtEwma),
      miss_streak: st.missStreak,
      timeout_streak: st.timeoutStreak
    };
  }

  return { step, onHit, onMiss, onStabilize, snapshot };
}