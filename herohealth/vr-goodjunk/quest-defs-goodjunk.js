// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Goal/Mini definitions for GoodJunkVR
// FIX: miss_limit will NOT pass at start; it is evaluated at end (timeLeft<=0)

'use strict';

function byDiff(diff, easy, normal, hard){
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') return easy;
  if (d === 'hard') return hard;
  return normal;
}

export const GOODJUNK_GOALS = [
  {
    id: 'score_total',
    label: 'ทำคะแนนรวมให้ถึงเกณฑ์',
    hint: 'เก็บอาหารดีต่อเนื่องเพื่อดันคะแนนขึ้น 🥦🍎',
    target: ({ diff }) => byDiff(diff, 500, 700, 900),
    progress: (s) => (s && typeof s.score === 'number') ? (s.score|0) : 0
  },
  {
    id: 'miss_limit',
    label: 'อย่าพลาดเกินกำหนด (ตัดสินตอนจบ)',
    hint: 'พยายามรักษา MISS ให้ต่ำ และอย่าปล่อยของดีหลุดมือ 🛡️',
    target: ({ diff }) => byDiff(diff, 6, 4, 3), // ต้อง “miss <= target” ตอนจบเกม
    progress: (s) => {
      // แสดง progress เป็น "miss ปัจจุบัน" เพื่อให้เด็กเห็นว่าตอนนี้พลาดไปกี่ครั้ง
      const miss = (s && typeof s.miss === 'number') ? (s.miss|0) : 0;
      return miss;
    },
    done: (s, prog, target) => {
      const miss = (s && typeof s.miss === 'number') ? (s.miss|0) : (prog|0);
      const timeLeft = (s && typeof s.timeLeft === 'number') ? (s.timeLeft|0) : 9999;

      // ✅ กันผ่านตั้งแต่เริ่ม: ตัดสินเฉพาะตอนจบ (timeLeft<=0)
      if (timeLeft > 0) return false;
      return miss <= (target|0);
    }
  }
];

export const GOODJUNK_MINIS = [
  {
    id: 'combo_best',
    label: 'ทำคอมโบให้ถึงเกณฑ์',
    target: ({ diff }) => byDiff(diff, 6, 8, 10),
    progress: (s) => (s && typeof s.comboMax === 'number') ? (s.comboMax|0) : 0
  },
  {
    id: 'good_hits',
    label: 'เก็บของดีให้ครบจำนวน',
    target: ({ diff }) => byDiff(diff, 20, 24, 28),
    progress: (s) => (s && typeof s.goodHits === 'number') ? (s.goodHits|0) : 0
  },
  {
    id: 'fever_once',
    label: 'เข้า FEVER อย่างน้อย 1 ครั้ง',
    target: () => 1,
    progress: (s) => (s && s.feverActive) ? 1 : 0
  }
];