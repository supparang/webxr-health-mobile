// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// STEP 3 PATCH: Clean + Safe + FEVER Ready
// 2025-12

'use strict';

/*
state ที่ QuestDirector ใช้:
- score
- goodHits
- comboMax
- miss
- feverActive (boolean)
*/

// ======================================================
// GOALS (ภารกิจหลัก) — สุ่ม 2 ต่อเกม
// ======================================================
export const GOODJUNK_GOALS = [

  {
    id: 'G_SCORE',
    label: 'ทำคะแนนรวมให้ถึง',
    kind: 'score',
    easy:   400,
    normal: 600,
    hard:   800
  },

  {
    id: 'G_GOOD',
    label: 'เก็บอาหารดีให้ครบ',
    kind: 'goodHits',
    easy:   10,
    normal: 14,
    hard:   18
  },

  {
    id: 'G_COMBO',
    label: 'ทำคอมโบสูงสุด',
    kind: 'combo',
    easy:   6,
    normal: 10,
    hard:   14
  },

  {
    id: 'G_SAFE',
    label: 'เล่นโดยพลาดไม่เกิน',
    kind: 'missMax',
    easy:   6,
    normal: 4,
    hard:   3
  }

];

// ======================================================
// MINI QUESTS — ทำทีละอัน ต่อเนื่อง
// ======================================================
export const GOODJUNK_MINIS = [

  {
    id: 'M_FEVER_ONCE',
    label: 'เข้า FEVER ให้ได้',
    kind: 'fever',
    easy:   1,
    normal: 1,
    hard:   1
  },

  {
    id: 'M_GOOD_SHORT',
    label: 'เก็บของดีต่อเนื่อง',
    kind: 'goodHits',
    easy:   5,
    normal: 6,
    hard:   7
  },

  {
    id: 'M_COMBO_SHORT',
    label: 'ทำคอมโบสั้น',
    kind: 'combo',
    easy:   4,
    normal: 5,
    hard:   6
  },

  {
    id: 'M_SAFE_SHORT',
    label: 'อย่าพลาดเกิน',
    kind: 'missMax',
    easy:   3,
    normal: 2,
    hard:   1
  }

];

export default {
  GOODJUNK_GOALS,
  GOODJUNK_MINIS
};
