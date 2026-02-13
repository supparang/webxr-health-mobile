// === /fitness/js/ai-predictor.js ===
// AIPredictor — ESM (export) ✅ ใช้ร่วมกับเกมอื่นได้
// - ถ้า mode=research => lock (ไม่ทำ adaptive ปรับเกมเอง)
// - ถ้า normal => เปิด assist ต้องใส่ ?ai=1

'use strict';

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

function readQueryFlag(key) {
  try {
    const v = new URL(location.href).searchParams.get(key);
    return v === '1' || v === 'true' || v === 'yes';
  } catch (_) { return false; }
}

function readMode() {
  try {
    const qs = new URL(location.href).searchParams;
    // รองรับทั้ง mode=research และ run=research
    const m = (qs.get('mode') || qs.get('run') || 'normal').toLowerCase();
    return (m === 'research') ? 'research' : 'normal';
  } catch (_) { return 'normal'; }
}

export class AIPredictor {
  getMode(){ return readMode(); }
  isLocked(){ return readMode() === 'research'; }
  isAssistEnabled(){
    if (readMode() === 'research') return false;
    return readQueryFlag('ai');
  }

  predict(snapshot = {}){
    const acc = clamp01((Number(snapshot.accPct) || 0) / 100);
    const hp = clamp01((Number(snapshot.hp) || 100) / 100);

    const off = Number(snapshot.offsetAbsMean);
    const offScore = Number.isFinite(off) ? clamp01(1 - (off / 0.18)) : 0.5;

    const miss = Number(snapshot.hitMiss) || 0;
    const judged = (Number(snapshot.hitPerfect)||0) + (Number(snapshot.hitGreat)||0) + (Number(snapshot.hitGood)||0) + miss;
    const missRate = judged > 0 ? clamp01(miss / judged) : 0;

    const fatigueRisk = clamp01((1 - hp) * 0.45 + missRate * 0.35 + (1 - offScore) * 0.20);
    const skillScore  = clamp01(acc * 0.55 + offScore * 0.30 + (1 - missRate) * 0.15);

    let suggestedDifficulty = 'normal';
    if (skillScore >= 0.78 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
    else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

    let tip = '';
    if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้าสำคัญก่อน';
    else if (offScore < 0.45) tip = 'รอให้ “เข้าโซน” ก่อนค่อยตี จะตรงขึ้น';
    else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเพิ่มความยากได้';
    else if (hp < 0.45) tip = 'ระวัง HP—อย่าตีรัว เลือกตีเป้าชัวร์ ๆ';

    return { fatigueRisk, skillScore, suggestedDifficulty, tip };
  }
}