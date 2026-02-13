// === /fitness/js/ai-predictor.js ===
// ESM + Global bridge (ใช้ได้ทั้ง import และ <script>)
// ✅ export: AIPredictor, RB_AI
// ✅ also attaches window.RB_AI for legacy fallback
'use strict';

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

function readQueryFlag(key) {
  try {
    const v = new URL(location.href).searchParams.get(key);
    return v === '1' || v === 'true' || v === 'yes';
  } catch (_) { return false; }
}
function readQueryMode() {
  try {
    const qs = new URL(location.href).searchParams;
    // รองรับทั้ง mode=research และ run=research
    const m1 = (qs.get('mode') || '').toLowerCase();
    const m2 = (qs.get('run') || '').toLowerCase();
    const m = (m1 || m2 || 'normal');
    return (m === 'research') ? 'research' : 'normal';
  } catch (_) {
    return 'normal';
  }
}

// ---- predictor (heuristic DL-lite; replaceable by ML later) ----
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
  if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้า แล้วค่อยตี';
  else if (offScore < 0.45) tip = 'รอให้ “เข้าโซน” ก่อนตี จะตรงขึ้น';
  else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเพิ่มความยากได้';
  else if (hp < 0.45) tip = 'ระวัง HP—อย่าตีรัว ให้ตีเฉพาะเป้าที่ชัวร์';

  return { fatigueRisk, skillScore, suggestedDifficulty, tip };
}

export class AIPredictor {
  getMode(){ return readQueryMode(); }              // 'research' | 'normal'
  isLocked(){ return this.getMode() === 'research'; }
  isAssistEnabled(){
    // research: lock always
    if (this.isLocked()) return false;
    // normal: require ?ai=1
    return readQueryFlag('ai');
  }
  predict(snapshot){ return predictFromSnapshot(snapshot || {}); }
}

// ✅ singleton bridge (importable)
export const RB_AI = new AIPredictor();

// ✅ legacy global fallback
try { window.RB_AI = window.RB_AI || RB_AI; } catch {}