// === /fitness/js/ai-predictor.js ===
// HYBRID MODULE (ESM + global) — works with:
// 1) import { RB_AI } from './ai-predictor.js'
// 2) classic access window.RB_AI
'use strict';

// ---- small helpers ----
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

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

// ---- Predictor (lightweight heuristic; reusable across games) ----
// Snapshot keys (best effort):
// { accPct, hp, hitMiss, hitPerfect, hitGreat, hitGood, offsetAbsMean }
// - accPct: 0..100
// - hp: 0..100 (or 0..1 ok)
// - offsetAbsMean: seconds
function predictFromSnapshot(s) {
  const acc = clamp01((Number(s.accPct) || 0) / 100);

  // accept hp in 0..1 or 0..100
  let hpRaw = Number(s.hp);
  if (!Number.isFinite(hpRaw)) hpRaw = 100;
  const hp = hpRaw <= 1.2 ? clamp01(hpRaw) : clamp01(hpRaw / 100);

  const off = Number(s.offsetAbsMean);
  const offScore = Number.isFinite(off) ? clamp01(1 - (off / 0.18)) : 0.5;

  const miss = Number(s.hitMiss) || 0;
  const judged =
    (Number(s.hitPerfect) || 0) +
    (Number(s.hitGreat) || 0) +
    (Number(s.hitGood) || 0) +
    miss;

  const missRate = judged > 0 ? clamp01(miss / judged) : 0;

  const fatigueRisk = clamp01((1 - hp) * 0.45 + missRate * 0.35 + (1 - offScore) * 0.20);

  const skillScore = clamp01(acc * 0.55 + offScore * 0.30 + (1 - missRate) * 0.15);

  let suggestedDifficulty = 'normal';
  if (skillScore >= 0.78 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
  else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

  let tip = '';
  if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้าก่อน แล้วค่อยตี';
  else if (offScore < 0.45) tip = 'ลอง “รอให้เป้าอยู่กลาง” ก่อนตี จะตรงขึ้น';
  else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเพิ่มความยาก/ความเร็วได้';
  else if (hp < 0.45) tip = 'ระวัง HP—อย่าตีรัว ให้ตีเฉพาะเป้าที่ชัวร์';

  return { fatigueRisk, skillScore, suggestedDifficulty, tip };
}

// ---- Public bridge used by engine/UI ----
// Research lock rule:
// - mode=research => lock adjustments ALWAYS
// - normal => allow assist only when ?ai=1
const API = {
  getMode() {
    return readQueryMode(); // 'research' | 'normal'
  },
  isAssistEnabled() {
    const mode = readQueryMode();
    if (mode === 'research') return false;
    return readQueryFlag('ai');
  },
  isLocked() {
    return readQueryMode() === 'research';
  },
  predict(snapshot) {
    return predictFromSnapshot(snapshot || {});
  }
};

// ✅ ESM export (fixes: "does not provide an export named RB_AI")
export const RB_AI = API;
export default API;

// ✅ Global fallback (keeps compatibility with classic callers)
try {
  if (typeof window !== 'undefined') window.RB_AI = API;
} catch {}