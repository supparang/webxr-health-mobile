// === /fitness/js/ai-features.js ===
// Shadow Breaker — AI Features (ESM)
// ✅ AI prediction + explainable micro-tips
// ✅ Pattern/pacing suggestion (fair) for play mode
// ✅ Research lock: mode=research => no adaptive adjustments
// Usage: import { AI } from './ai-features.js';  then AI.predict(snapshot) / AI.pickSpawnPlan(ctx)
// Note: This file is safe even if RB_AI (global) is absent.

'use strict';

function clamp01(v){ v = Number(v)||0; return Math.max(0, Math.min(1, v)); }
function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function readQuery(key, d=''){
  try{ return new URL(location.href).searchParams.get(key) ?? d; }catch{ return d; }
}
function readFlag(key){
  const v = String(readQuery(key,'')).toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
function readMode(){
  const m = String(readQuery('mode','normal')).toLowerCase();
  return m === 'research' ? 'research' : 'normal';
}

function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

// ---- Snapshot normalizer (engine should pass a lightweight object) ----
// Recommended snapshot keys (best effort):
// {
//   mode, diff,
//   tSec, durationSec,
//   score, combo, maxCombo,
//   hitPerfect, hitGood, hitBad, miss,
//   rtMeanMs, rtP50Ms, rtP90Ms,
//   playerHp01, bossHp01,
//   fever01, shield,
//   last10: { hit: n, miss: n, avgRtMs: n, bad: n }
// }
function normalizeSnapshot(s){
  s = s && typeof s === 'object' ? s : {};
  const mode = (s.mode === 'research' || readMode()==='research') ? 'research' : 'normal';
  const diff = String(s.diff || readQuery('diff','normal') || 'normal').toLowerCase();

  const hitP = Number(s.hitPerfect)||0;
  const hitG = Number(s.hitGood)||0;
  const hitB = Number(s.hitBad)||0;
  const miss = Number(s.miss)||0;
  const judged = hitP + hitG + hitB + miss;

  const acc = judged > 0 ? clamp01((hitP + hitG*0.75 + hitB*0.25) / judged) : 0;

  const rtMeanMs = Number.isFinite(Number(s.rtMeanMs)) ? Number(s.rtMeanMs) : null;
  const rtP90Ms  = Number.isFinite(Number(s.rtP90Ms))  ? Number(s.rtP90Ms)  : null;

  const playerHp01 = clamp01(s.playerHp01 ?? 1);
  const bossHp01   = clamp01(s.bossHp01 ?? 1);
  const fever01    = clamp01(s.fever01 ?? 0);
  const shield     = clamp(Number(s.shield)||0, 0, 9);

  const last10 = (s.last10 && typeof s.last10==='object') ? s.last10 : {};
  const lastHit  = Number(last10.hit)||0;
  const lastMiss = Number(last10.miss)||0;
  const lastBad  = Number(last10.bad)||0;
  const lastN = lastHit + lastMiss + lastBad;

  const recentMissRate = lastN > 0 ? clamp01((lastMiss + lastBad) / lastN) : null;

  return {
    mode, diff,
    acc,
    judged,
    hitP, hitG, hitB, miss,
    rtMeanMs, rtP90Ms,
    playerHp01, bossHp01, fever01, shield,
    recentMissRate
  };
}

// ---- Core predictor (DL-lite heuristic for now; explainable) ----
function predictCore(s0){
  const s = normalizeSnapshot(s0);

  // skillScore: accuracy + speed quality
  // speed quality: lower RT => better; use soft cap 520ms (mobile) to 360ms (pc)
  const rtRef = (s.diff === 'hard') ? 420 : (s.diff === 'easy' ? 560 : 500);
  const rtMean = s.rtMeanMs ?? rtRef;
  const rtScore = clamp01(1 - (rtMean - 220) / (rtRef - 220)); // 220..rtRef

  const missRate = s.judged > 0 ? clamp01(s.miss / s.judged) : 0;
  const badRate  = s.judged > 0 ? clamp01(s.hitB / s.judged) : 0;

  const skillScore = clamp01(
    s.acc * 0.58 +
    rtScore * 0.27 +
    (1 - missRate) * 0.10 +
    (1 - badRate) * 0.05
  );

  // fatigueRisk: low hp + rising recent misses + slow RT tail
  const rtTail = s.rtP90Ms ?? (rtMean * 1.22);
  const tailScore = clamp01(1 - (rtTail - 260) / (720 - 260)); // 260..720ms

  const recentMiss = (s.recentMissRate == null) ? missRate : s.recentMissRate;

  const fatigueRisk = clamp01(
    (1 - s.playerHp01) * 0.48 +
    recentMiss * 0.34 +
    (1 - tailScore) * 0.18
  );

  // Suggest diff only (engine may choose to ignore)
  let suggestedDifficulty = 'normal';
  if (skillScore >= 0.80 && fatigueRisk <= 0.34) suggestedDifficulty = 'hard';
  else if (skillScore <= 0.46 || fatigueRisk >= 0.72) suggestedDifficulty = 'easy';

  // Micro tips (explainable)
  let tip = '';
  let tipKey = 'neutral';

  if (recentMiss >= 0.38) {
    tip = 'ช้าลงนิดนึง → โฟกัส “จุดศูนย์กลางเป้า” แล้วค่อยชก/แตะ';
    tipKey = 'timing_slow';
  } else if (rtScore < 0.42) {
    tip = 'ลองเตรียมมือไว้กลางจอ และชกทันทีที่เป้า “Pop” จะลด RT ได้';
    tipKey = 'reaction_ready';
  } else if (s.playerHp01 < 0.45) {
    tip = 'ระวัง HP → เลือกเก็บ 🩹/🛡️ ก่อน แล้วค่อยเร่งทำคอมโบ';
    tipKey = 'survive';
  } else if (skillScore > 0.84 && fatigueRisk < 0.30) {
    tip = 'ฟอร์มดีมาก! เปิด Hard หรือเปิด AI pattern จะ “เดือด” ขึ้น';
    tipKey = 'push';
  } else if (s.fever01 > 0.85) {
    tip = 'FEVER ใกล้เต็ม! ช่วงนี้เน้นตี 🎯 เพื่อเร่งคะแนน/ดาเมจ';
    tipKey = 'fever_push';
  } else {
    tip = 'รักษาคอมโบต่อเนื่อง → หลบ/ข้าม 💣 และอย่าเสียจังหวะกับ 👀';
    tipKey = 'combo_keep';
  }

  // Explain factors (for UI debug)
  const explain = {
    acc: Number(s.acc.toFixed(3)),
    rtScore: Number(rtScore.toFixed(3)),
    missRate: Number(missRate.toFixed(3)),
    recentMiss: Number((recentMiss ?? 0).toFixed(3)),
    hp: Number(s.playerHp01.toFixed(3)),
    tailScore: Number(tailScore.toFixed(3))
  };

  return {
    mode: s.mode,
    diff: s.diff,
    skillScore,
    fatigueRisk,
    suggestedDifficulty,
    tip,
    tipKey,
    explain
  };
}

// ---- Fair spawn/pacing plan (engine chooses how to apply) ----
// Returns a small plan object; in research mode always "no-op".
function pickSpawnPlan(ctx0){
  const mode = (ctx0 && ctx0.mode) ? String(ctx0.mode) : readMode();
  if (mode === 'research') {
    return {
      locked: true,
      paceMul: 1,
      hazardBias: 0,
      rewardBias: 0,
      note: 'research locked'
    };
  }

  // allow only when ?ai=1 (or if global RB_AI says enabled)
  const enabled = (globalThis.RB_AI && typeof globalThis.RB_AI.isAssistEnabled === 'function')
    ? !!globalThis.RB_AI.isAssistEnabled()
    : readFlag('ai');

  if (!enabled) {
    return {
      locked: false,
      paceMul: 1,
      hazardBias: 0,
      rewardBias: 0,
      note: 'ai disabled'
    };
  }

  // ctx may include rolling performance
  const s = normalizeSnapshot(ctx0 && ctx0.snapshot ? ctx0.snapshot : ctx0);
  const pred = predictCore(s);

  // paceMul: >1 = faster spawns (harder), <1 = slower
  // hazardBias: + => more bomb/decoy, rewardBias: + => more heal/shield
  let paceMul = 1;
  let hazardBias = 0;
  let rewardBias = 0;

  if (pred.skillScore > 0.80 && pred.fatigueRisk < 0.35) {
    paceMul = 1.12;
    hazardBias = 0.10;
    rewardBias = -0.06;
  } else if (pred.fatigueRisk > 0.70 || s.playerHp01 < 0.42) {
    paceMul = 0.88;
    hazardBias = -0.08;
    rewardBias = 0.14;
  } else if ((s.recentMissRate ?? 0) > 0.32) {
    paceMul = 0.94;
    hazardBias = -0.06;
    rewardBias = 0.10;
  }

  // fairness clamps
  paceMul = clamp(paceMul, 0.82, 1.18);
  hazardBias = clamp(hazardBias, -0.15, 0.18);
  rewardBias = clamp(rewardBias, -0.10, 0.20);

  return {
    locked: false,
    enabled: true,
    paceMul,
    hazardBias,
    rewardBias,
    tip: pred.tip,
    tipKey: pred.tipKey
  };
}

// ---- Public API ----
export const AI = {
  getMode(){ return readMode(); },
  isLocked(){ return readMode() === 'research'; },

  // play assist enabled? (normal only, requires ?ai=1)
  isAssistEnabled(){
    if (readMode() === 'research') return false;
    if (globalThis.RB_AI && typeof globalThis.RB_AI.isAssistEnabled === 'function') {
      try{ return !!globalThis.RB_AI.isAssistEnabled(); }catch{}
    }
    return readFlag('ai');
  },

  // prediction from snapshot
  predict(snapshot){ return predictCore(snapshot); },

  // suggest spawn/pacing plan (engine can apply)
  pickSpawnPlan(ctx){ return pickSpawnPlan(ctx); },

  // tiny helper for debug overlay
  makeDebugLine(pred){
    if (!pred) return '';
    const s = [
      `skill=${pred.skillScore.toFixed(2)}`,
      `fatigue=${pred.fatigueRisk.toFixed(2)}`,
      `suggest=${pred.suggestedDifficulty}`,
      `tip=${pred.tipKey}`
    ];
    return s.join(' · ');
  },

  // timestamp helper (stable)
  nowMs
};