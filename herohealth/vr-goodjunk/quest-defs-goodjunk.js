// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Goal/Mini defs (A+B+C heavy) — schema สำหรับ quest-director

'use strict';

export const GOODJUNK_GOALS = [
  {
    id:'g1',
    // ❗️อย่า hardcode 25 เพราะ easy เป็น 20 → ให้ดูจาก progress caption แทน
    label:'เก็บของดีให้ครบตามเป้า 🥦',
    hint:'แตะเฉพาะอาหารดีเท่านั้น',
    targetByDiff:{ easy:20, normal:25, hard:30 },
    eval:(s)=> (s.goodHits|0),
    pass:(v,tgt)=> v>=tgt
  },
  {
    id:'g2',
    label:'ทำคอมโบสูงสุดให้ถึงเป้า 🔥',
    hint:'ห้ามพลาดระหว่างทาง',
    targetByDiff:{ easy:10, normal:12, hard:14 },
    eval:(s)=> (s.comboMax|0),
    pass:(v,tgt)=> v>=tgt
  },
  {
    id:'g3',
    label:'พลาดไม่เกินเป้า 🛡️',
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

export const GOODJUNK_MINIS = [
  { id:'m1',
    label:'Clean Streak: เก็บดีติดกัน ⚡',
    hint:'ห้ามพลาดแม้แต่ครั้งเดียว',
    targetByDiff:{ easy:6, normal:8, hard:10 },
    eval:(s)=> (s.streakGood|0),
    pass:(v,tgt)=> v>=tgt
  },
  { id:'m2',
    label:'Gold Hunt: เก็บ GOLD ให้ได้ 🟡',
    hint:'ต้องเก็บภายใน mini นี้เท่านั้น',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.goldHitsThisMini ? 1 : 0),
    pass:(v)=> v>=1
  },
  { id:'m3',
    label:'No-Junk Zone: ห้ามโดนของเสีย 🚫',
    hint:'โดน junk/fake = รีเซ็ต (ปล่อยของดีหมดอายุไม่เป็นไร)',
    targetByDiff:{ easy:8, normal:10, hard:12 },
    eval:(s)=> (s.safeNoJunkSeconds|0),
    pass:(v,tgt)=> v>=tgt
  },
  { id:'m4',
    label:'Shield Save: BLOCK ให้ได้ 🛡️',
    hint:'กด shield แล้วกันให้ทัน',
    targetByDiff:{ easy:1, normal:2, hard:2 },
    eval:(s)=> (s.blocks|0),
    pass:(v,tgt)=> v>=tgt
  },
  { id:'m5',
    label:'STUN Risk: ใช้ 🧲 แล้วเก็บดีให้ครบ',
    hint:'ระวัง junk จะเข้าหาศูนย์กลาง!',
    targetByDiff:{ easy:4, normal:6, hard:7 },
    eval:(s)=> (s.usedMagnet ? (s.streakGood|0) : 0),
    pass:(v,tgt)=> v>=tgt
  },
  { id:'m6',
    label:'Time Dealer: ใช้ ⏳ เพิ่มเวลา 1 ครั้ง',
    hint:'ช่วยชีวิตได้!',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.timePlus|0),
    pass:(v)=> v>=1,
    notChallenge:['survival']
  },
  { id:'m7',
    label:'Boss Slayer: เคลียร์บอสให้ได้ 👑',
    hint:'ช่วงท้ายเกมเท่านั้น',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.bossCleared ? 1 : 0),
    pass:(v)=> v>=1,
    onlyChallenge:['boss']
  },
  { id:'m8',
    label:'Final Sprint: 8 วิสุดท้าย เก็บดีให้ครบ 🏁',
    hint:'เริ่มนับเมื่อเข้า 8 วิสุดท้าย (โดน junk = lock 1 วิ)',
    targetByDiff:{ easy:8, normal:10, hard:12 },
    eval:(s)=> (s.final8Good|0),
    pass:(v,tgt)=> v>=tgt
  }
];
