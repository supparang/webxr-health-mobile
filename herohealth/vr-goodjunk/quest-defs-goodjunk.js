// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// รายการ Goal และ Mini quest สำหรับ Good vs Junk VR
// ใช้ร่วมกับ quest-director.js

// kind ที่รองรับใน quest-director:
//   - score     : คะแนนรวม
//   - goodHits  : เก็บของดี
//   - missMax   : พลาดไม่เกิน X ครั้ง
//   - combo     : คอมโบสูงสุด
// เพิ่ม field: lateOnly = true → ให้สุ่มมา "ช่วงท้าย" เกม

export const GOODJUNK_GOALS = [
  {
    id: 'G_SCORE_1200',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 1,200 แต้ม',
    kind: 'score',
    easy:   900,
    normal: 1200,
    hard:   1600,
    lateOnly: false
  },
  {
    id: 'G_GOOD_24',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 24 ชิ้น',
    kind: 'goodHits',
    easy:   18,
    normal: 24,
    hard:   30,
    lateOnly: false
  },
  {
    id: 'G_COMBO_14',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 14',
    kind: 'combo',
    easy:   10,
    normal: 14,
    hard:   18,
    lateOnly: false
  },

  // ✅ เควสต์แบบ "พลาดไม่เกิน..." ให้ lateOnly = true
  {
    id: 'G_MISS_MAX_6',
    label: 'แตะอาหารขยะไม่เกิน 6 ครั้ง',
    kind: 'missMax',
    easy:   8,
    normal: 6,
    hard:   4,
    lateOnly: true
  },

  {
    id: 'G_SCORE_1600',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 1,600 แต้ม',
    kind: 'score',
    easy:   1100,
    normal: 1600,
    hard:   2000,
    lateOnly: false
  },
  {
    id: 'G_GOOD_30',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 30 ชิ้น',
    kind: 'goodHits',
    easy:   22,
    normal: 30,
    hard:   38,
    lateOnly: false
  },
  {
    id: 'G_COMBO_18',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 18',
    kind: 'combo',
    easy:   12,
    normal: 18,
    hard:   22,
    lateOnly: false
  },

  {
    id: 'G_MISS_MAX_4',
    label: 'แตะอาหารขยะไม่เกิน 4 ครั้ง',
    kind: 'missMax',
    easy:   6,
    normal: 4,
    hard:   3,
    lateOnly: true
  },

  {
    id: 'G_SCORE_2000',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 2,000 แต้ม',
    kind: 'score',
    easy:   1300,
    normal: 2000,
    hard:   2400,
    lateOnly: false
  },
  {
    id: 'G_GOOD_40',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 40 ชิ้น',
    kind: 'goodHits',
    easy:   26,
    normal: 40,
    hard:   48,
    lateOnly: false
  }
];

export const GOODJUNK_MINIS = [
  {
    id: 'M_GOOD_10',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 10 ชิ้น',
    kind: 'goodHits',
    easy:   8,
    normal: 10,
    hard:   12,
    lateOnly: false
  },
  {
    id: 'M_COMBO_8',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 8',
    kind: 'combo',
    easy:   6,
    normal: 8,
    hard:   10,
    lateOnly: false
  },
  {
    id: 'M_SCORE_700',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 700 แต้ม',
    kind: 'score',
    easy:   500,
    normal: 700,
    hard:   900,
    lateOnly: false
  },

  // ✅ missMax → lateOnly
  {
    id: 'M_MISS_MAX_4',
    label: 'แตะอาหารขยะไม่เกิน 4 ครั้ง',
    kind: 'missMax',
    easy:   5,
    normal: 4,
    hard:   3,
    lateOnly: true
  },

  {
    id: 'M_GOOD_14',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 14 ชิ้น',
    kind: 'goodHits',
    easy:   10,
    normal: 14,
    hard:   18,
    lateOnly: false
  },
  {
    id: 'M_TIME_SCORE_500',
    label: 'ต้นเกมเก็บคะแนนให้ได้ 500 แต้ม',
    kind: 'score',
    easy:   400,
    normal: 500,
    hard:   650,
    lateOnly: false
  },
  {
    id: 'M_COMBO_10',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 10',
    kind: 'combo',
    easy:   8,
    normal: 10,
    hard:   12,
    lateOnly: false
  },
  {
    id: 'M_SCORE_900',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 900 แต้ม',
    kind: 'score',
    easy:   650,
    normal: 900,
    hard:   1100,
    lateOnly: false
  },
  {
    id: 'M_GOOD_18',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 18 ชิ้น',
    kind: 'goodHits',
    easy:   12,
    normal: 18,
    hard:   22,
    lateOnly: false
  },

  {
    id: 'M_MISS_MAX_3',
    label: 'แตะอาหารขยะไม่เกิน 3 ครั้ง',
    kind: 'missMax',
    easy:   4,
    normal: 3,
    hard:   2,
    lateOnly: true
  },

  {
    id: 'M_COMBO_12',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 12',
    kind: 'combo',
    easy:   10,
    normal: 12,
    hard:   14,
    lateOnly: false
  },
  {
    id: 'M_SCORE_1100',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 1,100 แต้ม',
    kind: 'score',
    easy:   800,
    normal: 1100,
    hard:   1400,
    lateOnly: false
  },
  {
    id: 'M_GOOD_22',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 22 ชิ้น',
    kind: 'goodHits',
    easy:   16,
    normal: 22,
    hard:   26,
    lateOnly: false
  },

  {
    id: 'M_MISS_MAX_2',
    label: 'แตะอาหารขยะไม่เกิน 2 ครั้ง',
    kind: 'missMax',
    easy:   3,
    normal: 2,
    hard:   1,
    lateOnly: true
  },

  {
    id: 'M_COMBO_15',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 15',
    kind: 'combo',
    easy:   12,
    normal: 15,
    hard:   18,
    lateOnly: false
  }
];
