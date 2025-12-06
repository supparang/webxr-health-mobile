// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Goals & Mini quests ที่ปรับความยากใหม่ให้เหมาะกับเด็ก ป.5
// ใช้ร่วมกับ quest-director.js (สุ่ม Goal 2/10 + Mini 3/15 ตาม diff)

export const GOODJUNK_GOALS = [
  // 1) เน้นคะแนนรวม "ระดับเริ่มต้น"
  {
    id: 'G_SCORE_700',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 700 แต้ม',
    kind: 'score',
    easy:   400,   // เด็กส่วนใหญ่ทำได้
    normal: 700,
    hard:   1000
  },

  // 2) เน้นจำนวนอาหารดี
  {
    id: 'G_GOOD_16',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 16 ชิ้น',
    kind: 'goodHits',
    easy:   10,
    normal: 16,
    hard:   22
  },

  // 3) เน้นคอมโบระดับกลาง
  {
    id: 'G_COMBO_8',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 8',
    kind: 'combo',
    easy:   5,
    normal: 8,
    hard:   11
  },

  // 4) คุมจำนวน miss แบบไม่โหดเกินไป
  {
    id: 'G_MISS_MAX_8',
    label: 'แตะอาหารขยะไม่เกิน 8 ครั้ง',
    kind: 'missMax',
    easy:   10,   // easy อนุญาตให้พลาดเยอะสุด
    normal: 8,
    hard:   6
  },

  // 5) คะแนนรวมระดับกลาง
  {
    id: 'G_SCORE_900',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 900 แต้ม',
    kind: 'score',
    easy:   600,
    normal: 900,
    hard:   1200
  },

  // 6) เน้นเก็บของดีเพิ่มขึ้น
  {
    id: 'G_GOOD_22',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 22 ชิ้น',
    kind: 'goodHits',
    easy:   14,
    normal: 22,
    hard:   28
  },

  // 7) คอมโบสูงขึ้นอีกนิด
  {
    id: 'G_COMBO_12',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 12',
    kind: 'combo',
    easy:   7,
    normal: 12,
    hard:   15
  },

  // 8) คุม miss แบบ "เล่นดีขึ้น" แต่ไม่โหดมาก
  {
    id: 'G_MISS_MAX_6',
    label: 'แตะอาหารขยะไม่เกิน 6 ครั้ง',
    kind: 'missMax',
    easy:   8,
    normal: 6,
    hard:   4
  },

  // 9) คะแนนรวมระดับสูง แต่ยัง reachable
  {
    id: 'G_SCORE_1200',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 1,200 แต้ม',
    kind: 'score',
    easy:   800,
    normal: 1200,
    hard:   1500
  },

  // 10) ของดีจำนวนมาก (สำหรับเด็กที่เริ่มชินแล้ว)
  {
    id: 'G_GOOD_28',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 28 ชิ้น',
    kind: 'goodHits',
    easy:   18,
    normal: 28,
    hard:   34
  }
];

export const GOODJUNK_MINIS = [
  // 1) mini ง่ายมาก — ของดีนิดเดียวก็ผ่าน
  {
    id: 'M_GOOD_8',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 8 ชิ้น',
    kind: 'goodHits',
    easy:   6,
    normal: 8,
    hard:   10
  },

  // 2) คอมโบเบา ๆ
  {
    id: 'M_COMBO_5',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 5',
    kind: 'combo',
    easy:   4,
    normal: 5,
    hard:   7
  },

  // 3) คะแนนรวมเล็ก ๆ
  {
    id: 'M_SCORE_400',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 400 แต้ม',
    kind: 'score',
    easy:   300,
    normal: 400,
    hard:   550
  },

  // 4) คุม miss ระดับเบา
  {
    id: 'M_MISS_MAX_4',
    label: 'แตะอาหารขยะไม่เกิน 4 ครั้ง',
    kind: 'missMax',
    easy:   5,
    normal: 4,
    hard:   3
  },

  // 5) ของดีเพิ่มขึ้นอีกนิด
  {
    id: 'M_GOOD_12',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 12 ชิ้น',
    kind: 'goodHits',
    easy:   8,
    normal: 12,
    hard:   16
  },

  // 6) คะแนนช่วงต้นเกม (ใช้คำอธิบายแบบเดิมได้)
  {
    id: 'M_SCORE_600',
    label: 'ต้นเกมเก็บคะแนนให้ได้ 600 แต้ม',
    kind: 'score',
    easy:   450,
    normal: 600,
    hard:   800
  },

  // 7) คอมโบกลาง ๆ
  {
    id: 'M_COMBO_7',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 7',
    kind: 'combo',
    easy:   5,
    normal: 7,
    hard:   9
  },

  // 8) คะแนนรวมเพิ่มขึ้น
  {
    id: 'M_SCORE_800',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 800 แต้ม',
    kind: 'score',
    easy:   550,
    normal: 800,
    hard:   1000
  },

  // 9) ของดี 16 ชิ้น
  {
    id: 'M_GOOD_16',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 16 ชิ้น',
    kind: 'goodHits',
    easy:   10,
    normal: 16,
    hard:   20
  },

  // 10) miss น้อยลงสำหรับเด็กที่โฟกัสดี
  {
    id: 'M_MISS_MAX_3',
    label: 'แตะอาหารขยะไม่เกิน 3 ครั้ง',
    kind: 'missMax',
    easy:   4,
    normal: 3,
    hard:   2
  },

  // 11) คอมโบสูงขึ้นอีกนิด
  {
    id: 'M_COMBO_9',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 9',
    kind: 'combo',
    easy:   7,
    normal: 9,
    hard:   11
  },

  // 12) คะแนนรวม 900 แต้ม
  {
    id: 'M_SCORE_900',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 900 แต้ม',
    kind: 'score',
    easy:   600,
    normal: 900,
    hard:   1100
  },

  // 13) ของดี 20 ชิ้น
  {
    id: 'M_GOOD_20',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 20 ชิ้น',
    kind: 'goodHits',
    easy:   12,
    normal: 20,
    hard:   24
  },

  // 14) miss โหดหน่อยสำหรับโหมดปกติ/ยาก
  {
    id: 'M_MISS_MAX_2',
    label: 'แตะอาหารขยะไม่เกิน 2 ครั้ง',
    kind: 'missMax',
    easy:   3,
    normal: 2,
    hard:   1
  },

  // 15) คอมโบท้าทายสุดใน mini
  {
    id: 'M_COMBO_11',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 11',
    kind: 'combo',
    easy:   8,
    normal: 11,
    hard:   14
  }
];
