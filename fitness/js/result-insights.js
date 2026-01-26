// === /fitness/js/result-insights.js ===
// Build human-readable + research-ready insights from session summary + predictor stats
'use strict';

export function buildInsights(summary, extras = {}) {
  const lines = [];
  const tips = [];

  const acc = summary?.accuracy_pct ?? 0;
  const miss = summary?.total_miss ?? 0;
  const combo = summary?.max_combo ?? 0;
  const feverS = summary?.fever_total_time_s ?? 0;
  const lowHpS = summary?.low_hp_time_s ?? 0;

  const rtN = summary?.avg_rt_normal_ms;
  const rtD = summary?.avg_rt_decoy_ms;

  // headline
  if (acc >= 92 && combo >= 6) lines.push('ฟอร์มดีมาก: คุมจังหวะได้และรักษาคอมโบได้ต่อเนื่อง ✅');
  else if (acc < 75 && miss >= 6) lines.push('วันนี้พลาดเยอะหน่อย: น่าจะเกิดจากรีบ/ล้า ลองปรับจังหวะให้นิ่งขึ้น ✅');
  else lines.push('ภาพรวมกำลังดี: ยังมีจุดให้ดันขึ้นได้อีก 🔥');

  // RT
  if (typeof rtN === 'number') {
    if (rtN < 380) tips.push('RT เป้าปกติดีมาก: เพิ่มความยากได้ (โหมด Play จะเร่งให้เอง)');
    else if (rtN < 480) tips.push('RT ปกติอยู่ในโซนดี: โฟกัส “ไม่พลาด” แล้วไล่ PERFECT เพิ่ม');
    else tips.push('RT ค่อนข้างช้า: ลดการกดมั่ว แล้วรอเป้าเข้ากลางก่อนค่อยชก');
  }

  // decoy
  if (typeof rtD === 'number') {
    if (rtD && rtN && rtD < rtN + 40) tips.push('อ่านเป้าลวงได้ดี: พร้อมรับ phase 3 แล้ว');
    else tips.push('เป้าลวงยังหลอกได้บ่อย: ให้มองสี/ชนิดก่อนกด 0.2–0.3 วินาที');
  }

  // fatigue proxy
  if (lowHpS >= 6) tips.push('ช่วงท้ายเริ่มล้า (HP ต่ำอยู่นาน): แนะนำพัก 30–45 วิ ก่อนรอบถัดไป');
  if (feverS >= 6) tips.push('คุณกด FEVER ได้ดี: ลองเร่งให้ FEVER ติด “2 รอบ” ใน 1 เกม');

  // miss
  if (miss >= 8) tips.push('Miss สูง: เป้าหมายรอบหน้า = ลด Miss ลง 30% ก่อนค่อยเพิ่มสปีด');
  else if (miss <= 2) tips.push('Miss ต่ำมาก: เพิ่มเป้าลวง/ระเบิดได้แล้ว (Play จะค่อย ๆ ใส่ให้)');

  // ML/DL-ready note
  const ml = [
    'ML-ready: features = {avg_rt_normal, miss_rate, slope_rt, phase, fever_time, lowhp_time, combo}',
    'DL-ready: sequence = event-level rows (timestamped) → train RNN/Transformer เพื่อทำนาย fatigue/precision'
  ];

  return {
    headline: lines[0] || '',
    tips: tips.slice(0, 5),
    researchNotes: ml
  };
}