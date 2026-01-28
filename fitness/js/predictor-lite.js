// === /fitness/js/predictor-lite.js ===
// Shadow Breaker — Offline AI Prediction (A-17)
// Output: { fatigue_prob, flow_score, focus_side, coach_line }

'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

function sigmoid(x){ return 1 / (1 + Math.exp(-x)); }

export function predictWindow(feat){
  // feat: { hitRate, missRate, avgRt, rtJitter, lowHpRatio, feverRatio, bombRate, parryRate, zoneWeakId }
  const hitRate = clamp(feat.hitRate, 0, 1);
  const missRate = clamp(feat.missRate, 0, 1);
  const avgRt = clamp(feat.avgRt, 120, 1200);
  const rtJitter = clamp(feat.rtJitter, 0, 1); // 0..1
  const lowHp = clamp(feat.lowHpRatio, 0, 1);
  const fever = clamp(feat.feverRatio, 0, 1);
  const bombRate = clamp(feat.bombRate, 0, 1);
  const parryRate = clamp(feat.parryRate, 0, 1);

  // ---- fatigue probability (heuristic logistic) ----
  // fatigue ↑ if avgRt high, missRate high, lowHP high, jitter high
  // fatigue ↓ if hitRate high, fever high
  const zFat =
    (+2.1 * (avgRt - 420) / 420) +
    (+3.0 * (missRate - 0.18)) +
    (+2.2 * (lowHp - 0.25)) +
    (+1.2 * (rtJitter - 0.35)) +
    (-1.6 * (hitRate - 0.55)) +
    (-0.8 * (fever - 0.18));

  const fatigue_prob = clamp(sigmoid(zFat), 0, 1);

  // ---- flow score (0..1) ----
  // flow ↑ when hitRate high, miss low, avgRt moderate, fever some, jitter low
  const zFlow =
    (+2.0 * (hitRate - 0.55)) +
    (-2.4 * (missRate - 0.18)) +
    (-1.6 * (Math.abs(avgRt - 420) / 520)) +
    (+0.8 * (fever - 0.12)) +
    (-0.9 * (rtJitter - 0.35));

  const flow_score = clamp(sigmoid(zFlow), 0, 1);

  // ---- focus_side (simple) ----
  // zoneWeakId 0..5 -> map to Left/Center/Right + Top/Bottom
  let focus_side = 'CENTER';
  const z = Number(feat.zoneWeakId);
  if (Number.isFinite(z)){
    const col = z % 3; // 0,1,2
    focus_side = col === 0 ? 'LEFT' : col === 2 ? 'RIGHT' : 'CENTER';
  }

  // ---- coach line ----
  let coach_line = '';
  if (fatigue_prob > 0.72){
    coach_line = 'เริ่มล้าแล้วนะ 🫧 ลดแรงนิดนึง แล้วเล็ง “ช้าแต่ชัวร์”';
  } else if (flow_score > 0.72){
    coach_line = 'กำลังเข้าฝัก! 🔥 เก็บ PERFECT 3 ครั้งให้ได้เพื่อเปิด Power Punch';
  } else if (missRate > 0.32){
    coach_line = 'พลาดบ่อยไปหน่อย 👀 ลองโฟกัสโซน ' + focus_side + ' ก่อน';
  } else if (bombRate > 0.18 && parryRate < 0.08){
    coach_line = 'ระวังระเบิด! 💣 ถ้าตีได้ <220ms จะ PARRY ได้เกราะ';
  } else {
    coach_line = 'จังหวะกำลังดี 👍 รักษาคอมโบ แล้วรอ FEVER';
  }

  return { fatigue_prob, flow_score, focus_side, coach_line };
}