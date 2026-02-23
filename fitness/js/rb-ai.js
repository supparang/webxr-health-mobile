// === /fitness/js/rb-ai.js ===
// Rhythm Boxer AI Director / Prediction Hook
// ✅ Research lock support
// ✅ Normal assist flag ?ai=1
// ✅ Predict fatigue / skill / suggestion / pressure chance
// ✅ Hook points for future ML/DL models (window.RB_AI_MODEL)
'use strict';

(function(){
  const WIN = window;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function clamp01(v){ return clamp(v,0,1); }
  function num(v, d=0){ v=Number(v); return Number.isFinite(v)?v:d; }

  const SP = new URL(location.href).searchParams;
  const qAi = (SP.get('ai') || '').toLowerCase();
  const qMode = (SP.get('mode') || '').toLowerCase();

  // policy:
  // - research => locked (no adaptive)
  // - normal/play => assist if ?ai=1
  let _assistEnabled = (qAi === '1' || qAi === 'on' || qAi === 'true');
  let _locked = (qMode === 'research');

  function setAssistEnabled(v){ _assistEnabled = !!v; }
  function setLocked(v){ _locked = !!v; }

  function isAssistEnabled(){ return !!_assistEnabled; }
  function isLocked(){ return !!_locked; }

  // ---- feature engineering ----
  function featurize(snap){
    const acc = clamp01(num(snap.accPct,0) / 100);
    const miss = num(snap.hitMiss,0);
    const perf = num(snap.hitPerfect,0);
    const great = num(snap.hitGreat,0);
    const good = num(snap.hitGood,0);
    const combo = num(snap.combo,0);
    const hp = clamp01(num(snap.hp,100) / 100);
    const t = num(snap.songTime,0);
    const dur = Math.max(1, num(snap.durationSec,60));
    const p = clamp01(t / dur);
    const offAbs = num(snap.offsetAbsMean, 0.08); // sec

    const judged = perf + great + good + miss;
    const hit = perf + great + good;
    const perfectRate = judged ? perf / judged : 0;
    const missRate = judged ? miss / judged : 0;

    return {
      acc, miss, perf, great, good, combo, hp, t, dur, p, offAbs,
      judged, hit, perfectRate, missRate
    };
  }

  // ---- fallback heuristic predictor (production-safe, deterministic for same snap) ----
  function heuristicPredict(snap){
    const f = featurize(snap);

    // fatigue risk rises when hp low, miss rate high, offsets large, late-session progress
    let fatigueRisk =
      0.35 * (1 - f.hp) +
      0.25 * f.missRate +
      0.20 * clamp01((f.offAbs - 0.04) / 0.12) +
      0.20 * f.p;

    // skill score from acc/perfect/combo stability
    let skillScore =
      0.50 * f.acc +
      0.20 * f.perfectRate +
      0.20 * clamp01(f.combo / 25) +
      0.10 * (1 - clamp01((f.offAbs - 0.03) / 0.10));

    fatigueRisk = clamp01(fatigueRisk);
    skillScore = clamp01(skillScore);

    // suggested difficulty (prediction only)
    let suggestedDifficulty = 'normal';
    if (skillScore > 0.80 && fatigueRisk < 0.35) suggestedDifficulty = 'hard';
    else if (skillScore < 0.45 || fatigueRisk > 0.70) suggestedDifficulty = 'easy';

    // pressure chance = probability of "mix pattern / fake pressure" burst recommendation
    const pressureChance = clamp01(
      0.15 +
      0.35 * skillScore +
      0.20 * clamp01(f.combo / 20) -
      0.20 * fatigueRisk
    );

    // boss intensity recommendation 1..3
    let bossIntensity = 1;
    if (skillScore > 0.55 && fatigueRisk < 0.75) bossIntensity = 2;
    if (skillScore > 0.78 && fatigueRisk < 0.45) bossIntensity = 3;

    let tip = '';
    if (fatigueRisk > 0.75) tip = 'หายใจลึก ๆ ลดแรงตี เน้นจังหวะกลางก่อน';
    else if (f.offAbs > 0.095) tip = 'จังหวะยังแกว่ง ลองโฟกัส hit line และกดให้พอดี';
    else if (f.missRate > 0.22) tip = 'อย่ารีบกดล่วงหน้า รอให้โน้ตเข้าเส้นแล้วค่อยตี';
    else if (skillScore > 0.82) tip = 'ดีมาก! พร้อมรับช่วง Pressure Burst ได้';
    else if (f.combo >= 10) tip = 'คอมโบมาแล้ว รักษาจังหวะคงที่ไว้';

    return {
      fatigueRisk,
      skillScore,
      suggestedDifficulty,
      pressureChance,
      bossIntensity,
      tip
    };
  }

  // ---- optional external ML/DL model hook ----
  // If future model exists, it can replace/augment heuristic:
  // window.RB_AI_MODEL.predict(features) => { ... }
  function predict(snap){
    const base = heuristicPredict(snap);

    try{
      if (WIN.RB_AI_MODEL && typeof WIN.RB_AI_MODEL.predict === 'function'){
        const out = WIN.RB_AI_MODEL.predict({
          accPct: snap.accPct,
          hitMiss: snap.hitMiss,
          hitPerfect: snap.hitPerfect,
          hitGreat: snap.hitGreat,
          hitGood: snap.hitGood,
          combo: snap.combo,
          offsetAbsMean: snap.offsetAbsMean,
          hp: snap.hp,
          songTime: snap.songTime,
          durationSec: snap.durationSec
        }) || {};

        // merge carefully
        return {
          fatigueRisk: clamp01(num(out.fatigueRisk, base.fatigueRisk)),
          skillScore: clamp01(num(out.skillScore, base.skillScore)),
          suggestedDifficulty: String(out.suggestedDifficulty || base.suggestedDifficulty),
          pressureChance: clamp01(num(out.pressureChance, base.pressureChance)),
          bossIntensity: Math.max(1, Math.min(3, Math.round(num(out.bossIntensity, base.bossIntensity)))),
          tip: String(out.tip || base.tip || '')
        };
      }
    }catch(err){
      // silent fallback
      console.warn('[RB_AI] model predict fallback:', err);
    }

    return base;
  }

  WIN.RB_AI = {
    predict,
    isLocked,
    isAssistEnabled,
    setLocked,
    setAssistEnabled
  };
})();