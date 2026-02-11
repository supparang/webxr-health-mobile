// === /fitness/js/ai-predictor.js ===
// HHA AI Predictor — shared module for all fitness games (Shadow/Rhythm/Jump/Balance)
// ✅ ES Module export (AIPredictor + HHA_AI)
// ✅ Also exposes window.HHA_AI for legacy usage
// ✅ Deterministic-friendly (no randomness inside predictor)
// NOTE: This is "DL-lite" heuristic now; ML/DL model can replace predict() later.

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v) || 0)); }
function clamp01(v){ return clamp(v, 0, 1); }

function qsp(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
function qFlag(key){
  try{
    const v = (qsp().get(key) || '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }catch{ return false; }
}
function qMode(){
  try{
    // support both ?mode=research and your older ?run=research
    const sp = qsp();
    const m = (sp.get('mode') || sp.get('run') || 'normal').toLowerCase();
    return (m === 'research') ? 'research' : 'normal';
  }catch{ return 'normal'; }
}

// -------------------------
// Core predictor (heuristic)
// Snapshot can include:
// { accPct, missRate, fatigueProxy, rtMeanMs, rtMedianMs, hp, fever, diff, phase, bossesCleared, ... }
// -------------------------
function predictFromSnapshot(s){
  const acc = clamp01((Number(s.accPct)||0) / 100);
  const missRate = clamp01(Number(s.missRate) ?? (Number(s.misses||0) / Math.max(1, Number(s.judged||0))));
  const hp = clamp01((Number(s.hp) || 100) / 100);

  // RT proxy: lower = better
  const rt = Number(s.rtMedianMs || s.rtMeanMs || 0);
  const rtScore = rt > 0 ? clamp01(1 - ((rt - 320) / 900)) : 0.55; // 320ms baseline

  const fatigueProxy = clamp01(Number(s.fatigueProxy) || 0);

  // skillScore: accuracy + RT + low miss
  const skillScore = clamp01(
    acc * 0.55 +
    rtScore * 0.25 +
    (1 - missRate) * 0.20
  );

  // fatigueRisk: low hp + fatigueProxy + missRate
  const fatigueRisk = clamp01(
    (1 - hp) * 0.40 +
    fatigueProxy * 0.35 +
    missRate * 0.25
  );

  // suggestion (string)
  let suggestedDifficulty = 'normal';
  if (skillScore >= 0.80 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
  else if (skillScore <= 0.46 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

  // pacing suggestion (0.85..1.15) -> can multiply spawn interval
  // higher fatigue => slower ( >1 ), high skill & low fatigue => faster (<1)
  let paceMult = 1.0;
  if (fatigueRisk >= 0.70) paceMult = 1.12;
  else if (fatigueRisk >= 0.55) paceMult = 1.06;
  else if (skillScore >= 0.82 && fatigueRisk <= 0.35) paceMult = 0.92;
  else if (skillScore >= 0.74 && fatigueRisk <= 0.42) paceMult = 0.96;

  paceMult = clamp(paceMult, 0.85, 1.15);

  // micro tip (Thai)
  let tip = '';
  if (missRate >= 0.35) tip = 'MISS เยอะ—ช้าลงนิดนึง โฟกัสเป้าก่อนแตะ';
  else if (rtScore < 0.45) tip = 'ลอง “รอให้เป้าอยู่ในตำแหน่งถนัด” แล้วค่อยแตะ จะเร็วขึ้น';
  else if (hp < 0.45) tip = 'ระวัง HP—เลือกตีเป้าปลอดภัยก่อน (หลบ bomb/decoy)';
  else if (skillScore > 0.82 && fatigueRisk < 0.35) tip = 'ฟอร์มดีมาก! เพิ่มความยาก/เพิ่มความเร็วได้เลย 🔥';
  else tip = 'รักษาคอมโบ—ตีให้ต่อเนื่อง จะคุมเกมได้ง่ายขึ้น';

  return {
    skillScore,
    fatigueRisk,
    paceMult,
    suggestedDifficulty,
    tip
  };
}

// -------------------------
// Public API class
// -------------------------
export class AIPredictor {
  getMode(){ return qMode(); }                 // 'normal' | 'research'
  isLocked(){ return qMode() === 'research'; } // research lock
  isAssistEnabled(){
    // research locked always off
    if (this.isLocked()) return false;
    // normal: enable only when ?ai=1 (so it won't affect research/play by accident)
    return qFlag('ai');
  }
  predict(snapshot){
    return predictFromSnapshot(snapshot || {});
  }
}

// Convenience singleton for simple usage
export const HHA_AI = new AIPredictor();

// Also expose global for legacy scripts
try{
  window.HHA_AI = HHA_AI;
}catch{}