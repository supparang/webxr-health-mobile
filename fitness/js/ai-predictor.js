// === /fitness/js/ai-predictor.js ===
// Shadow Breaker AI Predictor — ES Module + Global Bridge (window.RB_AI)
// ✅ Fix: provides export named AIPredictor
// ✅ Also sets window.RB_AI for backward compatibility
// ✅ Research lock: mode=research => assist disabled & locked
// ✅ Normal: enable assist only with ?ai=1

'use strict';

function clamp01(v){ v = Number(v)||0; return Math.max(0, Math.min(1, v)); }
function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function readQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}

function readQueryFlag(key){
  try{
    const v = readQS().get(key);
    return v === '1' || v === 'true' || v === 'yes';
  }catch{ return false; }
}

function readMode(){
  try{
    const m = (readQS().get('mode') || '').toLowerCase();
    return (m === 'research') ? 'research' : 'normal';
  }catch{ return 'normal'; }
}

// Lightweight heuristic predictor (placeholder for ML later)
function predictFromSnapshot(s){
  s = s || {};
  const acc = clamp01((Number(s.accPct)||0)/100);
  const hp  = clamp01((Number(s.hp)||100)/100);

  const off = Number(s.offsetAbsMean);
  const offScore = Number.isFinite(off) ? clamp01(1 - (off / 0.18)) : 0.5;

  const miss = Number(s.hitMiss)||0;
  const judged = (Number(s.hitPerfect)||0)+(Number(s.hitGreat)||0)+(Number(s.hitGood)||0)+miss;
  const missRate = judged > 0 ? clamp01(miss/judged) : 0;

  const fatigueRisk = clamp01((1-hp)*0.45 + missRate*0.35 + (1-offScore)*0.20);
  const skillScore  = clamp01(acc*0.55 + offScore*0.30 + (1-missRate)*0.15);

  let suggestedDifficulty = 'normal';
  if (skillScore >= 0.78 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
  else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

  let tip = '';
  if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้าหลัก แล้วค่อยแตะ';
  else if (offScore < 0.45) tip = 'รอให้เป้า “นิ่ง” ก่อนแตะ จะตรงขึ้น';
  else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเพิ่มความเร็ว/ยากขึ้นได้';
  else if (hp < 0.45) tip = 'ระวัง HP—อย่ากดรัว เลือกแตะเป้าหลัก';

  return { fatigueRisk, skillScore, suggestedDifficulty, tip };
}

export class AIPredictor {
  constructor(){}

  getMode(){ return readMode(); }

  isAssistEnabled(){
    // research locked
    if (readMode() === 'research') return false;
    // normal: require ?ai=1
    return readQueryFlag('ai');
  }

  isLocked(){ return readMode() === 'research'; }

  predict(snapshot){ return predictFromSnapshot(snapshot||{}); }
}

// ---- Global bridge (backward compatibility) ----
try{
  const API = {
    getMode(){ return readMode(); },
    isAssistEnabled(){ return (readMode() === 'research') ? false : readQueryFlag('ai'); },
    isLocked(){ return readMode() === 'research'; },
    predict(snapshot){ return predictFromSnapshot(snapshot||{}); }
  };
  window.RB_AI = API;
}catch{}