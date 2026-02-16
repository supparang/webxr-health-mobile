// === /fitness/js/ai-predictor.js ===
// AI Predictor — ES Module + Global bridge (PATCH ABCD)
// ✅ Provides: export class AIPredictor
// ✅ Also sets window.RB_AI for legacy access
// ✅ Research lock: mode=research => assist disabled always
// ✅ Play enable: only when ?ai=1

'use strict';

// ---- small helpers ----
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

function readQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
function readQueryFlag(key) {
  const QS = readQS();
  const v = (QS.get(key) || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
function readMode() {
  const QS = readQS();
  const m = (QS.get('mode') || '').toLowerCase();
  return (m === 'research') ? 'research' : 'normal';
}

// ---- predictor core (heuristic now; ML later) ----
// snapshot example (best effort):
// { accPct, missRate, combo, offsetAbsMean, hp, phase, bossesCleared }
function predictFromSnapshot(s) {
  const acc = clamp01((Number(s.accPct) || 0) / 100);
  const hp = clamp01((Number(s.hp) || 100) / 100);

  // offsetAbsMean in seconds; smaller => better
  const off = Number(s.offsetAbsMean);
  const offScore = Number.isFinite(off) ? clamp01(1 - (off / 0.18)) : 0.55;

  const missRate = clamp01(Number(s.missRate) || 0);

  const fatigueRisk = clamp01(
    (1 - hp) * 0.45 +
    missRate * 0.35 +
    (1 - offScore) * 0.20
  );

  const skillScore = clamp01(
    acc * 0.58 +
    offScore * 0.27 +
    (1 - missRate) * 0.15
  );

  let suggestedDifficulty = 'normal';
  if (skillScore >= 0.78 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
  else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

  let tip = '';
  if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้าใหญ่ก่อน แล้วค่อยเก็บเป้าเล็ก';
  else if (offScore < 0.45) tip = 'อย่ากดรัว—เล็งให้ศูนย์กลางก่อนค่อยแตะ';
  else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเร่งคอมโบ + เก็บ Shield ให้ทัน';
  else if (hp < 0.45) tip = 'HP ใกล้หมด—เลี่ยง Bomb แล้วเก็บ Heal/Shield';

  return { fatigueRisk, skillScore, suggestedDifficulty, tip };
}

// ---- export class ----
export class AIPredictor {
  getMode(){ return readMode(); }
  isLocked(){ return readMode() === 'research'; }

  // allow assist only in play + ?ai=1
  isAssistEnabled(){
    if (this.isLocked()) return false;
    return readQueryFlag('ai');
  }

  predict(snapshot){
    return predictFromSnapshot(snapshot || {});
  }
}

// ---- legacy/global bridge ----
try{
  const api = new AIPredictor();
  if (typeof window !== 'undefined') window.RB_AI = api;
}catch(_){}