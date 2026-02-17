// === /fitness/js/ai-predictor.js ===
// ES Module + Global bridge (RB_AI)
// ✅ export class AIPredictor
// ✅ also sets window.RB_AI for legacy callers
// ✅ research lock: mode=research OR run=research => AI disabled

'use strict';

const WIN = window;

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

function readQS(key) {
  try { return new URL(location.href).searchParams.get(key); }
  catch { return null; }
}
function readQueryFlag(key) {
  const v = (readQS(key) || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
function readMode() {
  const run = (readQS('run') || '').toLowerCase();
  const mode = (readQS('mode') || '').toLowerCase();
  if (run === 'research' || mode === 'research') return 'research';
  return 'normal';
}

// heuristic predictor (lightweight now; can replace with ML later)
function predictFromSnapshot(s) {
  const acc = clamp01((Number(s.accPct) || 0) / 100);
  const hp = clamp01((Number(s.hp) || 100) / 100);

  // offsetAbsMean in seconds; smaller => better
  const off = Number(s.offsetAbsMean);
  const offScore = Number.isFinite(off) ? clamp01(1 - (off / 0.18)) : 0.5;

  const miss = Number(s.hitMiss) || 0;
  const judged = (Number(s.hitPerfect)||0) + (Number(s.hitGreat)||0) + (Number(s.hitGood)||0) + miss;
  const missRate = judged > 0 ? clamp01(miss / judged) : 0;

  const fatigueRisk = clamp01(
    (1 - hp) * 0.45 +
    missRate * 0.35 +
    (1 - offScore) * 0.20
  );

  const skillScore = clamp01(
    acc * 0.55 +
    offScore * 0.30 +
    (1 - missRate) * 0.15
  );

  let suggestedDifficulty = 'normal';
  if (skillScore >= 0.78 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
  else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

  let tip = '';
  if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้า แล้วค่อยแตะ';
  else if (offScore < 0.45) tip = 'รอให้เป้า “นิ่ง” ก่อนแตะ จะตรงขึ้น';
  else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเพิ่มความยากได้';
  else if (hp < 0.45) tip = 'ระวัง HP—อย่าแตะรัว เลือกแตะเฉพาะเป้าหลัก';

  return { fatigueRisk, skillScore, suggestedDifficulty, tip };
}

export class AIPredictor {
  getMode(){ return readMode(); }
  isAssistEnabled(){
    if (readMode() === 'research') return false;
    return readQueryFlag('ai'); // play mode require ?ai=1
  }
  isLocked(){ return readMode() === 'research'; }
  predict(snapshot){ return predictFromSnapshot(snapshot || {}); }
}

// global bridge (legacy)
try {
  WIN.RB_AI = {
    getMode: () => readMode(),
    isAssistEnabled: () => (readMode() === 'research' ? false : readQueryFlag('ai')),
    isLocked: () => readMode() === 'research',
    predict: (snap) => predictFromSnapshot(snap || {})
  };
} catch {}