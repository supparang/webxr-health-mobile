// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Goal/Mini defs (A+B+C heavy) — for quest-director
// Expect state fields from goodjunk-vr.html qState:
// score, goodHits, miss, comboMax, timeLeft, streakGood, goldHitsThisMini,
// blocks, usedMagnet, timePlus, safeSeconds, bossCleared, challenge, runMode

'use strict';

// ---------- GOALS (2 goals per run) ----------
export const GOODJUNK_GOALS = [
  {
    id:'g1',
    label:'เก็บของดีให้ได้ 25 ชิ้น 🥦',
    hint:'แตะเฉพาะอาหารดีเท่านั้น',
    targetByDiff:{ easy:20, normal:25, hard:30 },
    eval:(s, tgt)=> (s.goodHits|0),
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
    label:'เคลียร์บอสให้ได้ 👑 (ถ้าเล่น Boss)',
    hint:'บอสจะมาใกล้หมดเวลา!',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.bossCleared ? 1 : 0),
    pass:(v)=> v>=1,
    onlyChallenge:['boss']
  }
];

// ---------- MINIS (endless chain) ----------
export const GOODJUNK_MINIS = [
  // A: Rush / speed / combo
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

  // B: Avoid / survival pressure
  {
    id:'m3',
    label:'No-Junk Zone: 10 วินาทีห้ามพลาด 🚫',
    hint:'ไม่แตะ junk/fake และไม่ปล่อยของดีให้หลุด',
    targetByDiff:{ easy:8, normal:10, hard:12 },
    eval:(s)=> (s.safeSeconds|0),
    pass:(v,tgt)=> v>=tgt
  },
  {
    id:'m4',
    label:'Shield Save: BLOCK ให้ได้ 2 ครั้ง 🛡️',
    hint:'ต้องกด shield แล้วกันให้ทัน',
    targetByDiff:{ easy:1, normal:2, hard:2 },
    eval:(s)=> (s.blocks|0),
    pass:(v,tgt)=> v>=tgt
  },

  // A+B: Risk with magnet
  {
    id:'m5',
    label:'Magnet Risk: ใช้ 🧲 แล้วเก็บดี 6 ชิ้น',
    hint:'ระวัง junk จะถูกดูดเข้ามาด้วย!',
    targetByDiff:{ easy:4, normal:6, hard:7 },
    eval:(s)=> (s.usedMagnet ? (s.streakGood|0) : 0),
    pass:(v,tgt)=> v>=tgt
  },

  // A: Time trade
  {
    id:'m6',
    label:'Time Dealer: ใช้ ⏳ เพิ่มเวลา 1 ครั้ง',
    hint:'แลกคะแนนแต่ช่วยชีวิต!',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.timePlus|0),
    pass:(v)=> v>=1,
    notChallenge:['survival'] // survival ไม่ใช้เวลา
  },

  // C: Boss focus
  {
    id:'m7',
    label:'Boss Slayer: เคลียร์บอสให้ได้ 👑',
    hint:'ช่วงท้ายเกมเท่านั้น',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.bossCleared ? 1 : 0),
    pass:(v)=> v>=1,
    onlyChallenge:['boss']
  },

  // Final sprint (works all)
  {
    id:'m8',
    label:'Final Sprint: 8 วิสุดท้าย เก็บดีให้ได้ 10 🏁',
    hint:'โค้งสุดท้าย! เร่งมือ!',
    targetByDiff:{ easy:8, normal:10, hard:12 },
    // quest-director จะต้องส่ง progress เฉพาะหน้าต่างเวลาเอง
    // ที่นี่ใช้ proxy: ถ้า timeLeft <= 8 ให้เอา streakGood มานับ
    eval:(s)=> (s.timeLeft <= 8 ? (s.streakGood|0) : 0),
    pass:(v,tgt)=> v>=tgt
  }
];
