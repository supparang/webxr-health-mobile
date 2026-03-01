// === /fitness/js/ai-predictor.js ===
// ESM + Global bridge (Shadow Breaker / shared)
// ✅ export AIPredictor (for engine import)
// ✅ export RB_AI (optional)
// ✅ also sets window.RB_AI for non-module pages
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

// ---- small helpers ----
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

function readQueryFlag(key){
  try{
    const v = new URL(location.href).searchParams.get(key);
    return v === '1' || v === 'true' || v === 'yes';
  }catch(_){
    return false;
  }
}

function readQueryMode(){
  try{
    // รองรับทั้ง mode=research และ run=research (เผื่อใช้กับระบบ HeroHealth)
    const qs = new URL(location.href).searchParams;
    const m1 = (qs.get('mode') || '').toLowerCase();
    const m2 = (qs.get('run')  || '').toLowerCase();
    if (m1 === 'research' || m2 === 'research') return 'research';
    return 'normal';
  }catch(_){
    return 'normal';
  }
}

// ---- core heuristic predictor (replaceable by ML later) ----
function predictFromSnapshot(s){
  s = s || {};
  const acc = clamp01((Number(s.accPct) || 0) / 100);
  const hp  = clamp01((Number(s.hp) || 100) / 100);

  // smaller => better (seconds)
  const off = Number(s.offsetAbsMean);
  const offScore = Number.isFinite(off) ? clamp01(1 - (off / 0.18)) : 0.5;

  const miss = Number(s.hitMiss) || 0;
  const judged =
    (Number(s.hitPerfect)||0) +
    (Number(s.hitGreat)||0) +
    (Number(s.hitGood)||0) +
    miss;

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
  if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้าจริง แล้วค่อยกด';
  else if (offScore < 0.45) tip = 'ลอง “รอให้เป้าเข้ากลาง” ก่อนกด จะตรงขึ้น';
  else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเพิ่มความยากได้';
  else if (hp < 0.45) tip = 'ระวัง HP—อย่ากดรัว ให้กดเฉพาะเป้าที่ชัวร์';

  return { fatigueRisk, skillScore, suggestedDifficulty, tip };
}

// ---- exported class (engine-friendly) ----
export class AIPredictor {
  constructor(){}
  getMode(){ return readQueryMode(); }
  isLocked(){ return readQueryMode() === 'research'; }
  isAssistEnabled(){
    // Research lock: always OFF
    if (this.isLocked()) return false;
    // Play: require ?ai=1
    return readQueryFlag('ai');
  }
  predict(snapshot){ return predictFromSnapshot(snapshot || {}); }
}

// ---- exported RB_AI helper (optional) ----
export const RB_AI = new AIPredictor();

// ---- global bridge for non-module consumers ----
try{
  WIN.RB_AI = WIN.RB_AI || RB_AI;
  WIN.AIPredictor = WIN.AIPredictor || AIPredictor;
}catch(_){}