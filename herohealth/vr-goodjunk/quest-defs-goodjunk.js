// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Quest definitions for GoodJunkVR
// ใช้กับ quest-director.js

export const GOODJUNK_GOALS = [
  {
    id: 'G_GOOD_HIT',
    label: 'เก็บอาหารดี',
    target: (diff, runMode) => {
      if (runMode === 'research') {
        if (diff === 'easy') return 12;
        if (diff === 'hard') return 18;
        return 15;
      }
      if (diff === 'easy') return 10;
      if (diff === 'hard') return 16;
      return 13;
    },
    type: 'goodHit'
  },
  {
    id: 'G_LOW_MISS',
    label: 'พลาดให้น้อย',
    target: (diff, runMode) => {
      if (diff === 'easy') return 3;
      if (diff === 'hard') return 1;
      return 2;
    },
    type: 'missMax'
  }
];

export const GOODJUNK_MINIS = [
  {
    id: 'M_COMBO',
    label: 'คอมโบต่อเนื่อง',
    target: (diff, runMode) => {
      if (diff === 'easy') return 5;
      if (diff === 'hard') return 10;
      return 7;
    },
    type: 'combo'
  },
  {
    id: 'M_FEVER',
    label: 'เข้า FEVER',
    target: () => 1,
    type: 'fever'
  },
  {
    id: 'M_NO_JUNK',
    label: 'ไม่ตีขยะต่อเนื่อง',
    target: (diff) => {
      if (diff === 'hard') return 12;
      return 8;
    },
    type: 'noJunkStreak'
  }
];
