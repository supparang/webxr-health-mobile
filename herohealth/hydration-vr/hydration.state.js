// === /herohealth/hydration-vr/hydration.state.js ===
// แปลง stats (ดิบ) จาก hydration.quest.js ให้เป็น state เดียว
// ที่ goals / minis ใช้อ่านค่าได้ง่าย

'use strict';

// แปลง diff ให้เหลือ easy / normal / hard
export function normalizeHydrationDiff (raw) {
  const t = String(raw || 'normal').toLowerCase();
  if (t === 'easy' || t === 'normal' || t === 'hard') return t;
  return 'normal';
}

// แปลง stats → state ที่ quest ใช้ตรวจเงื่อนไข
export function mapHydrationState (stats) {
  const s = stats || {};
  const tick = Number(s.tick || 0);          // เวลาเล่นสะสม (วินาที)
  const greenTick = Number(s.greenTick || 0); // เวลาที่อยู่โซน GREEN

  return {
    // คะแนน / combo
    score: Number(s.score || 0),
    combo: Number(s.combo || 0),
    comboMax: Number(s.comboMax || 0),

    // จำนวนเป้าดี / miss
    good: Number(s.goodCount || 0),
    goodCount: Number(s.goodCount || 0),
    miss: Number(s.junkMiss || 0),
    junkMiss: Number(s.junkMiss || 0),

    // เวลา
    timeSec: tick,
    tick,

    // เวลาโซนเขียว + สัดส่วนเวลาใน GREEN
    greenTick,
    greenRatio: tick > 0 ? (greenTick / tick) : 0,

    // โซนล่าสุด
    zone: s.zone || 'GREEN'
  };
}