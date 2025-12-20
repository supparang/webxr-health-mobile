// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Goal/Mini defs (A+B+C heavy) — schema ใหม่สำหรับ quest-director
// Expect gameState fields from goodjunk-vr.html qState:
// score, goodHits, miss, comboMax, timeLeft, streakGood, goldHitsThisMini,
// blocks, usedMagnet, timePlus, safeNoJunkSeconds, bossCleared, challenge, runMode,
// final8Good

'use strict';

// ---------- GOALS (2 goals per run) ----------
export const GOODJUNK_GOALS = [
  {
    id:'g1',
    label:'เก็บของดีให้ได้ 25 ชิ้น 🥦',
    hint:'แตะเฉพาะอาหารดีเท่านั้น',
    targetByDiff:{ easy:20, normal:25, hard:30 },
    eval:(s)=> (s.goodHits|0),
    pass:(v,tgt)=> v>=tgt
  },
  {
    id:'g2',
    label:'ทำคอมโบสูงสุดให้ถึง 12 🔥',
    hint:'ห้ามพลาดระหว่างทาง',
    targetByDiff:{ easy:10, normal:12, hard:14 },
    eval:(s)=> (s.comboMax|0),
    pass:(v,tgt)=> v>=tgt
  },
  {
    id:'g3',
    label:'พลาดไม่เกิน 4 ครั้ง 🛡️',
    hint:'หลบ junk/fake ให้ดี',
    targetByDiff:{ easy:5, normal:4, hard:3 },
    eval:(s)=> (s.miss|0),
    pass:(v,tgt)=> v<=tgt
  },
  {
    id:'g4',
    label:'เคลียร์บอสให้ได้ 👑 (เฉพาะ Boss)',
    hint:'บอสจะมาใกล้หมดเวลา!',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.bossCleared ? 1 : 0),
    pass:(v)=> v>=1,
    onlyChallenge:['boss']
  }
];

// ---------- MINIS (endless chain) ----------
export const GOODJUNK_MINIS = [
  // A: streak/สปีด
  {
    id:'m1',
    label:'Clean Streak: เก็บดีติดกัน 8 ชิ้น ⚡',
    hint:'ห้ามพลาดแม้แต่ครั้งเดียว',
    targetByDiff:{ easy:6, normal:8, hard:10 },
    eval:(s)=> (s.streakGood|0),
    pass:(v,tgt)=> v>=tgt
  },

  // A: gold
  {
    id:'m2',
    label:'Gold Hunt: เก็บ GOLD ให้ได้ 1 🟡',
    hint:'ต้องเก็บภายใน mini นี้เท่านั้น',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.goldHitsThisMini ? 1 : 0),
    pass:(v)=> v>=1
  },

  // B: ✅ ยุติธรรมขึ้น: นับเฉพาะ “ไม่โดน junk/fake”
  {
    id:'m3',
    label:'No-Junk Zone: 10 วิห้ามโดนของเสีย 🚫',
    hint:'โดน junk/fake = รีเซ็ต (ปล่อยของดีหมดอายุไม่เป็นไร)',
    targetByDiff:{ easy:8, normal:10, hard:12 },
    eval:(s)=> (s.safeNoJunkSeconds|0),
    pass:(v,tgt)=> v>=tgt
  },

  // B: shield block
  {
    id:'m4',
    label:'Shield Save: BLOCK ให้ได้ 2 ครั้ง 🛡️',
    hint:'กด shield แล้วกันให้ทัน',
    targetByDiff:{ easy:1, normal:2, hard:2 },
    eval:(s)=> (s.blocks|0),
    pass:(v,tgt)=> v>=tgt
  },

  // A+B: magnet risk
  {
    id:'m5',
    label:'Magnet Risk: ใช้ 🧲 แล้วเก็บดี 6 ชิ้น',
    hint:'ระวัง junk จะถูกดูดเข้ามาด้วย!',
    targetByDiff:{ easy:4, normal:6, hard:7 },
    eval:(s)=> (s.usedMagnet ? (s.streakGood|0) : 0),
    pass:(v,tgt)=> v>=tgt
  },

  // A: time power (ไม่ใช้ใน survival)
  {
    id:'m6',
    label:'Time Dealer: ใช้ ⏳ เพิ่มเวลา 1 ครั้ง',
    hint:'ช่วยชีวิตได้!',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.timePlus|0),
    pass:(v)=> v>=1,
    notChallenge:['survival']
  },

  // C: boss focus
  {
    id:'m7',
    label:'Boss Slayer: เคลียร์บอสให้ได้ 👑',
    hint:'ช่วงท้ายเกมเท่านั้น',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.bossCleared ? 1 : 0),
    pass:(v)=> v>=1,
    onlyChallenge:['boss']
  },

  // โค้งสุดท้าย “เกมจริง”: นับดีในหน้าต่าง 8 วิสุดท้าย
  {
    id:'m8',
    label:'Final Sprint: 8 วิสุดท้าย เก็บดีให้ได้ 10 🏁',
    hint:'เริ่มนับเมื่อเข้า 8 วิสุดท้าย',
    targetByDiff:{ easy:8, normal:10, hard:12 },
    eval:(s)=> (s.final8Good|0),
    pass:(v,tgt)=> v>=tgt
  }
];
export const GOODJUNK_GOALS = [
  {
    id: 'G1_GOOD_HITS',
    title: 'แตะอาหารดีให้ได้ 18 ครั้ง',
    kind: 'count',
    max: 18,
    rule: null
  },
  {
    id: 'G2_SCORE',
    title: 'ทำคะแนนให้ถึง 160',
    kind: 'count',
    max: 160,
    rule: null
  }
];

export const GOODJUNK_MINIS = [
  {
    id: 'M_STREAK',
    title: 'คอมโบอาหารดี 6 ครั้งติด',
    kind: 'count',
    max: 6,
    timeTotal: 0,
    tags: ['rush','survival','boss']
  },
  {
    id: 'M_NOJUNK_5S',
    title: 'No-Junk Zone: ห้ามโดน junk 5 วินาที',
    kind: 'count',
    max: 5,
    timeTotal: 6500,   // กันหลุด (มี buffer)
    tags: ['rush','survival']
  },
  {
    id: 'M_GOLD_1',
    title: 'เก็บ Gold ⭐ ให้ได้ 1 ครั้ง',
    kind: 'count',
    max: 1,
    timeTotal: 0,
    tags: ['boss','rush']
  }
];
