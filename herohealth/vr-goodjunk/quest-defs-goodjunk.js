// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Goal/Mini definitions for GoodJunkVR
// Compatible with UPDATED quest-director.js (supports target/progress/done functions)

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
    label: 'คุม MISS ให้น้อย (อย่าพลาดเกินกำหนด)',
    hint: 'ยิ่ง MISS น้อยยิ่งดี — แตะของดี, หลีกเลี่ยงขยะ 🛡️',
    // เป้าหมายคือ "พลาด <= limit"
    target: ({ diff }) => byDiff(diff, 6, 4, 3),

    // ให้แถบ progress “ยิ่ง MISS เพิ่มยิ่งลด” (เป็นโควต้าที่เหลือ)
    // prog = เหลือโควต้าพลาด (0..limit)
    progress: (s, ctx) => {
      const limit = byDiff(ctx?.diff, 6, 4, 3);
      const miss = (s && typeof s.miss === 'number') ? (s.miss|0) : 0;
      return Math.max(0, limit - miss);
    },

    // done = ยังอยู่ในเกณฑ์ (miss <= limit)
    done: (s, _prog, target) => {
      const miss = (s && typeof s.miss === 'number') ? (s.miss|0) : 0;
      return miss <= (target|0);
    }
  }
];

export const GOODJUNK_MINIS = [
  {
    id: 'combo_best',
    label: 'ทำคอมโบให้ถึงเกณฑ์',
    hint: 'เก็บของดีติด ๆ กันให้คอมโบพุ่ง 🎯',
    target: ({ diff }) => byDiff(diff, 6, 8, 10),
    progress: (s) => (s && typeof s.comboMax === 'number') ? (s.comboMax|0) : 0
  },
  {
    id: 'good_hits',
    label: 'เก็บของดีให้ครบจำนวน',
    hint: 'เน้นผัก ผลไม้ นม ให้ครบตามเป้า 🥦🍎🥛',
    target: ({ diff }) => byDiff(diff, 20, 24, 28),
    progress: (s) => (s && typeof s.goodHits === 'number') ? (s.goodHits|0) : 0
  },
  {
    id: 'fever_once',
    label: 'เข้า FEVER อย่างน้อย 1 ครั้ง',
    hint: 'เก็บของดีต่อเนื่องเพื่อเร่งหลอด FEVER 🔥',
    target: () => 1,
    progress: (s) => (s && s.feverActive) ? 1 : 0
  }
];
