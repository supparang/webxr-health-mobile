// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Step D: Final Sprint harder (แบบ 2)
// Expect qState: score, goodHits, miss, comboMax, timeLeft, streakGood, goldHitsThisMini,
// blocks, usedMagnet, timePlus, safeNoJunkSeconds, bossCleared, challenge, runMode, final8Good

'use strict';

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

export const GOODJUNK_MINIS = [
  {
    id:'m1',
    label:'Clean Streak: เก็บดีติดกัน 8 ชิ้น ⚡',
    hint:'ห้ามพลาดแม้แต่ครั้งเดียว',
    targetByDiff:{ easy:6, normal:8, hard:10 },
    eval:(s)=> (s.streakGood|0),
    pass:(v,tgt)=> v>=tgt
  },
  {
    id:'m2',
    label:'Gold Hunt: เก็บ GOLD ให้ได้ 1 🟡',
    hint:'ต้องเก็บภายใน mini นี้เท่านั้น',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.goldHitsThisMini ? 1 : 0),
    pass:(v)=> v>=1
  },
  {
    id:'m3',
    label:'No-Junk Zone: 10 วิห้ามโดนของเสีย 🚫',
    hint:'โดน junk/fake = รีเซ็ต (ปล่อยของดีหมดอายุไม่เป็นไร)',
    targetByDiff:{ easy:8, normal:10, hard:12 },
    eval:(s)=> (s.safeNoJunkSeconds|0),
    pass:(v,tgt)=> v>=tgt
  },
  {
    id:'m4',
    label:'Shield Save: BLOCK ให้ได้ 2 ครั้ง 🛡️',
    hint:'มีโล่แล้วค่อยเสี่ยงชน junk',
    targetByDiff:{ easy:1, normal:2, hard:2 },
    eval:(s)=> (s.blocks|0),
    pass:(v,tgt)=> v>=tgt
  },
  {
    id:'m5',
    label:'STUN Magnet: ใช้ 🧲 แล้วให้ junk แตกเอง 4 ครั้ง',
    hint:'แตะพื้นที่ว่างเพื่อย้ายศูนย์กลาง vortex!',
    targetByDiff:{ easy:2, normal:4, hard:5 },
    eval:(s)=> (s.stunBreaks|0),
    pass:(v,tgt)=> v>=tgt
  },
  {
    id:'m6',
    label:'Time Dealer: ใช้ ⏱️ เพิ่มเวลา 1 ครั้ง',
    hint:'ช่วยชีวิตได้!',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.timePlus|0),
    pass:(v)=> v>=1,
    notChallenge:['survival']
  },
  {
    id:'m7',
    label:'Boss Slayer: เคลียร์บอสให้ได้ 👑',
    hint:'ช่วงท้ายเกมเท่านั้น',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.bossCleared ? 1 : 0),
    pass:(v)=> v>=1,
    onlyChallenge:['boss']
  },

  // ✅ Step D: Final Sprint (แบบ 2) — โหดขึ้น
  {
    id:'m8',
    label:'Final Sprint (PRO): 8 วิสุดท้าย เก็บดีให้ได้ 12 🏁',
    hint:'ล็อกทุก 1 วิ • junk โผล่เยอะขึ้น • อย่าพลาด!',
    targetByDiff:{ easy:10, normal:12, hard:14 },
    eval:(s)=> (s.final8Good|0),
    pass:(v,tgt)=> v>=tgt
  }
];