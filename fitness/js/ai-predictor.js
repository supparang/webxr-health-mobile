// === /fitness/js/ai-predictor.js ===
'use strict';

/**
 * AIPredictor — feature builder + lightweight predictor hooks
 * (kept for future ML/DL swap-in)
 */

export const FEATURE_ORDER = [
  'accNorm',        // 0..1
  'comboNorm',      // 0..1
  'missNorm',       // 0..1 (higher = worse)
  'rtNorm',         // 0..1 (higher = slower)
  'hpNorm',         // 0..1
  'bossPhaseNorm',  // 0..1
  'timeNorm'        // 0..1 (progress through run)
];

function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }

export class AIPredictor {
  constructor(opts = {}) {
    this.opts = Object.assign({
      rtCapMs: 900,
      comboCap: 30,
      missCap: 18,
      phaseCap: 3,
      timeCapSec: 90
    }, opts || {});
  }

  buildFeatures(snapshot = {}) {
    const o = this.opts;

    const acc = clamp01((Number(snapshot.accPct) || 0) / 100);
    const combo = clamp01((Number(snapshot.combo) || 0) / o.comboCap);
    const miss = clamp01((Number(snapshot.miss) || 0) / o.missCap);

    // RT: normalize: 0 fast -> 1 slow
    const rtMs = Number(snapshot.rtMs);
    const rtNorm = Number.isFinite(rtMs) ? clamp01(rtMs / o.rtCapMs) : 0.45;

    const hp = clamp01((Number(snapshot.hp) || 100) / 100);
    const phase = clamp01((Number(snapshot.bossPhase) || 1) / o.phaseCap);

    const t = clamp01((Number(snapshot.timeSec) || 0) / o.timeCapSec);

    return {
      accNorm: acc,
      comboNorm: combo,
      missNorm: miss,
      rtNorm,
      hpNorm: hp,
      bossPhaseNorm: phase,
      timeNorm: t
    };
  }

  toVector(features) {
    const f = features || {};
    return FEATURE_ORDER.map(k => clamp01(f[k]));
  }

  // simple score for "skill"
  estimateSkill(features) {
    const f = features || {};
    // high acc + high combo + high hp - miss - slow rt
    return clamp01(
      (f.accNorm || 0) * 0.50 +
      (f.comboNorm || 0) * 0.20 +
      (f.hpNorm || 0) * 0.20 -
      (f.missNorm || 0) * 0.25 -
      (f.rtNorm || 0) * 0.15
    );
  }

  // "fatigue risk" / struggle indicator
  estimateFatigue(features) {
    const f = features || {};
    return clamp01(
      (1 - (f.hpNorm || 0)) * 0.45 +
      (f.missNorm || 0) * 0.35 +
      (f.rtNorm || 0) * 0.20
    );
  }
}

// ---------------------------------------------------------------------------
// ✅ PATCH: Provide RB_AI export for compatibility with earlier builds
// Some modules expect: import { RB_AI } from './ai-predictor.js'
// We keep the newer AIPredictor class AND expose a small bridge API.
// ---------------------------------------------------------------------------

function _rbClamp01(v){ return Math.max(0, Math.min(1, Number(v)||0)); }
function _rbClamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }

function _rbReadQueryFlag(key){
  try{
    const v = new URL(location.href).searchParams.get(key);
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }catch(_){ return false; }
}
function _rbReadQueryMode(){
  try{
    const m = (new URL(location.href).searchParams.get('mode') || '').toLowerCase();
    return (m === 'research') ? 'research' : 'normal';
  }catch(_){ return 'normal'; }
}

// Heuristic predictor from a snapshot (explainable, deterministic given snapshot)
function _rbPredictFromSnapshot(s){
  const acc = _rbClamp01((Number(s.accPct) || 0) / 100);
  const hp = _rbClamp01((Number(s.hp) || 100) / 100);

  // offsetAbsMean in seconds; smaller => better
  const off = Number(s.offsetAbsMean);
  const offScore = Number.isFinite(off) ? _rbClamp01(1 - (off / 0.18)) : 0.5;

  const miss = Number(s.hitMiss) || 0;
  const judged = (Number(s.hitPerfect)||0) + (Number(s.hitGreat)||0) + (Number(s.hitGood)||0) + miss;
  const missRate = judged > 0 ? _rbClamp01(miss / judged) : 0;

  const fatigueRisk = _rbClamp01(
    (1 - hp) * 0.45 +
    missRate * 0.35 +
    (1 - offScore) * 0.20
  );

  const skillScore = _rbClamp01(
    acc * 0.55 +
    offScore * 0.30 +
    (1 - missRate) * 0.15
  );

  let suggestedDifficulty = 'normal';
  if (skillScore >= 0.78 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
  else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

  let tip = '';
  if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้า แล้วค่อยแตะ';
  else if (offScore < 0.45) tip = 'ลอง “รอให้เป้านิ่ง/ใกล้กลาง” ก่อนแตะ จะตรงขึ้น';
  else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเพิ่มความเร็ว/โหมดยากขึ้นได้';
  else if (hp < 0.45) tip = 'ระวัง HP—อย่ารีบตีเป้าล่อ/กับดัก';

  return { fatigueRisk, skillScore, suggestedDifficulty, tip };
}

export const RB_AI = {
  getMode(){ return _rbReadQueryMode(); },               // 'research' | 'normal'
  isLocked(){ return _rbReadQueryMode() === 'research'; },
  isAssistEnabled(){
    // research => locked always
    if (_rbReadQueryMode() === 'research') return false;
    // normal => require ?ai=1 to enable adaptive/AI suggestions
    return _rbReadQueryFlag('ai');
  },
  predict(snapshot){ return _rbPredictFromSnapshot(snapshot || {}); }
};

// also expose to window for non-module usage / debugging
try { window.RB_AI = window.RB_AI || RB_AI; } catch {}