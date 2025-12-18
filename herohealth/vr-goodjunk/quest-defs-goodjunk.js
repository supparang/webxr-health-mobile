// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Goal/Mini definitions for GoodJunkVR
// Compatible with quest-director.js (supports deferStart)

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
    target: ({ diff }) => byDiff(diff, 520, 700, 880),
    progress: (s) => (s && typeof s.score === 'number') ? (s.score|0) : 0
  },
  {
    id: 'miss_limit',
    label: 'อย่าพลาดเกินกำหนด',
    hint: 'อย่าให้ MISS เพิ่ม! โฟกัสเฉพาะของดี และหลบขยะ 🛡️',
    deferStart: true, // ✅ สำคัญ: กัน “ผ่านเลยตอนเริ่ม”
    target: ({ diff }) => byDiff(diff, 6, 4, 3),
    // ทำเป็น constraint: done() ตรวจว่า miss <= target
    progress: () => 0,
    done: (s, _prog, target) => {
      const miss = (s && typeof s.miss === 'number') ? (s.miss|0) : 0;
      // ✅ จะผ่านได้จริงเมื่อเกมเดินไปแล้ว (QuestDirector กันตอน start ด้วย deferStart)
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
    target: ({ diff }) => byDiff(diff, 18, 24, 28),
    progress: (s) => (s && typeof s.goodHits === 'number') ? (s.goodHits|0) : 0
  },
  {
    id: 'fever_once',
    label: 'เข้า FEVER อย่างน้อย 1 ครั้ง',
    target: () => 1,
    progress: (s) => (s && s.feverActive) ? 1 : 0
  }
];