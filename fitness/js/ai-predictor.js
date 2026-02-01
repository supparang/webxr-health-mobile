// === /fitness/js/ai-predictor.js ===
// DL-lite predictor (heuristic) — ES module
// ✅ Export AIPredictor for module engines
// ✅ Research-lock aware via query params

'use strict';

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

function readQueryFlag(key) {
  try {
    const v = new URL(location.href).searchParams.get(key);
    return v === '1' || v === 'true' || v === 'yes';
  } catch (_) {
    return false;
  }
}
function readQueryMode() {
  try {
    const m = (new URL(location.href).searchParams.get('mode') || '').toLowerCase();
    if (m === 'research') return 'research';
    return 'normal';
  } catch (_) {
    return 'normal';
  }
}

function predictFromSnapshot(s) {
  const acc = clamp01((Number(s.accPct) || 0) / 100);
  const hp = clamp01((Number(s.hp) || 100) / 100);

  const miss = Number(s.hitMiss) || 0;
  const hits = Number(s.hits) || 0;
  const judged = hits + miss;
  const missRate = judged > 0 ? clamp01(miss / judged) : 0;

  const rtMean = Number(s.rtMean);
  const rtScore = Number.isFinite(rtMean) ? clamp01(1 - (rtMean / 900)) : 0.6;

  const fatigueRisk = clamp01(
    (1 - hp) * 0.45 +
    missRate * 0.35 +
    (1 - rtScore) * 0.20
  );

  const skillScore = clamp01(
    acc * 0.55 +
    rtScore * 0.30 +
    (1 - missRate) * 0.15
  );

  let suggestedDifficulty = 'normal';
  if (skillScore >= 0.78 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
  else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

  let tip = '';
  if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้าหลัก แล้วค่อยตี';
  else if (rtScore < 0.45) tip = 'ลอง “รอให้เห็นเป้าชัด” ก่อนตี จะตรงขึ้น';
  else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเพิ่มความยาก/ความเร็วได้';
  else if (hp < 0.45) tip = 'ระวัง HP—อย่าโลภเป้าล่อ โฟกัสเป้าปลอดภัย';

  return { fatigueRisk, skillScore, suggestedDifficulty, tip };
}

export class AIPredictor {
  getMode() { return readQueryMode(); }
  isLocked() { return readQueryMode() === 'research'; }

  isAssistEnabled() {
    const mode = readQueryMode();
    if (mode === 'research') return false; // locked
    return readQueryFlag('ai');            // require ?ai=1 in normal
  }

  predict(snapshot) {
    return predictFromSnapshot(snapshot || {});
  }
}