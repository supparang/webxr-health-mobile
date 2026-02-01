'use strict';

/**
 * dl-features.js
 * - สร้าง feature vector “DL-lite” จากสถานะ/หน้าต่างข้อมูล
 * - ใช้ร่วมกับ ai-predictor.js (heuristic) เพื่อให้เหตุผลได้ (explainable)
 */

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

export function buildFeatureVector(snapshot){
  // snapshot: {acc, missRate, avgRt, combo, hp, feverOn, phase, diff, timeLeftMs}
  const acc = clamp((snapshot.acc ?? 85)/100, 0, 1);
  const miss = clamp(snapshot.missRate ?? 0.12, 0, 1);
  const rt = clamp((snapshot.avgRt ?? 520)/1200, 0, 1);
  const combo = clamp((snapshot.combo ?? 0)/30, 0, 1);
  const hp = clamp(snapshot.hp ?? 1, 0, 1);
  const fever = snapshot.feverOn ? 1 : 0;
  const phase = clamp(((snapshot.phase ?? 1)-1)/2, 0, 1);
  const diff = snapshot.diff === 'hard' ? 1 : snapshot.diff === 'easy' ? 0 : 0.5;
  const tleft = clamp((snapshot.timeLeftMs ?? 30000)/90000, 0, 1);

  // vector length 9
  return [acc, 1-miss, 1-rt, combo, hp, fever, phase, diff, tleft];
}

export function explainVector(vec){
  if(!Array.isArray(vec) || vec.length < 9) return [];
  const [acc, surv, spd, combo, hp, fever, phase, diff, tleft] = vec;

  const tips = [];
  if(acc < 0.75) tips.push('ความแม่นยำยังต่ำ — โฟกัสเป้า “Normal” ให้ชัดก่อน');
  if(spd < 0.6) tips.push('จังหวะยังช้า — ลดการส่ายมือ แล้วชกให้สั้น/ไว');
  if(combo < 0.3) tips.push('คอมโบยังไม่ต่อเนื่อง — เลือกเป้าง่ายก่อนเพื่อไต่คอมโบ');
  if(hp < 0.55) tips.push('HP ต่ำ — หา Heal/Shield เพื่อยื้อเกม');
  if(!fever && combo > 0.4) tips.push('ใกล้ติด FEVER — รักษาคอมโบต่ออีกนิด!');
  if(phase > 0.66) tips.push('เฟสท้ายแล้ว — เป้าจะเร็วขึ้น ระวัง Bomb/Decoy');
  if(diff > 0.8) tips.push('โหมด Hard — อย่าลืม “กันระเบิด” ด้วย Shield');
  if(tleft < 0.25) tips.push('ใกล้หมดเวลา — โฟกัสตีเป้า Normal เพื่อปิดบอส');

  return tips;
}