// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Goal/Mini defs (HARDCORE A+B+C) — fair but brutal
// Expect state fields from goodjunk-vr.html qState:
// score, goodHits, miss, comboMax, timeLeft, streakGood, goldHitsThisMini,
// blocks, usedMagnet, timePlus, safeNoJunkSeconds, bossCleared, challenge, runMode,
// accuracyGoodPct, final8Good

'use strict';

// ---------- GOALS (2 goals per run) ----------
export const GOODJUNK_GOALS = [
  // A: Core performance
  {
    id:'g1',
    label:'ของดี 28 ชิ้น + Accuracy ≥ 78% 🥦🎯',
    hint:'แตะดีให้แม่น — พลาดเยอะจะไม่ผ่าน',
    targetByDiff:{ easy:22, normal:28, hard:34 },
    eval:(s)=> (s.goodHits|0),
    pass:(v,tgt)=> v>=tgt && ((sAccuracy(s)) >= accNeed(s))
  },

  // A: Combo with quality gate
  {
    id:'g2',
    label:'ComboMax ถึง 12+ พร้อมคุมพลาด 🔥',
    hint:'คอมโบถึงอย่างเดียวไม่พอ ต้องเล่นเนียนด้วย',
    targetByDiff:{ easy:10, normal:12, hard:14 },
    eval:(s)=> (s.comboMax|0),
    pass:(v,tgt)=> v>=tgt && ((s.miss|0) <= missNeedForCombo(s))
  },

  // B: Miss limit (hold quality all game)
  {
    id:'g3',
    label:'พลาดไม่เกิน (โหด) 🛡️',
    hint:'จบเกมแล้วค่อยตัดสิน แต่ระหว่างเกมดูไว้เลย',
    targetByDiff:{ easy:4, normal:3, hard:2 },
    eval:(s)=> (s.miss|0),
    pass:(v,tgt)=> v<=tgt
  },

  // C: Boss requirement (only boss)
  {
    id:'g4',
    label:'เคลียร์บอสให้ได้ 👑 + พลาดช่วงบอสไม่เกิน 1',
    hint:'บอสมาใกล้หมดเวลา — ห้ามแกว่ง',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.bossCleared ? 1 : 0),
    pass:(v)=> v>=1 && ((s.miss|0) <= bossMissCap(s)),
    onlyChallenge:['boss']
  }
];

// ---------- MINIS (endless chain) ----------
export const GOODJUNK_MINIS = [
  // A: Streak brutal
  {
    id:'m1',
    label:'Clean Streak: ดีติดกัน (โหด) ⚡',
    hint:'ห้ามพลาด — ถ้าพลาดรีเซ็ตใหม่',
    targetByDiff:{ easy:7, normal:9, hard:11 },
    eval:(s)=> (s.streakGood|0),
    pass:(v,tgt)=> v>=tgt
  },

  // A+B: Gold must be "clean finish" (anti-fluke)
  {
    id:'m2',
    label:'Gold Hunt PRO: เก็บ 🟡 แล้ว “ปิดด้วยดี 3 ติด” ✨',
    hint:'เก็บ GOLD ให้ได้ แล้วต้องเก็บดีต่ออีก 3 (ภายใน mini นี้)',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    // ใช้ proxy: goldHitsThisMini ต้องจริง และ streakGood ต้อง ≥ 3 ณ ตอนนั้น
    eval:(s)=> ((s.goldHitsThisMini && (s.streakGood|0) >= 3) ? 1 : 0),
    pass:(v)=> v>=1
  },

  // B: Fair No-Junk (ใช้ safeNoJunkSeconds) — โหดขึ้นด้วย block penalty
  {
    id:'m3',
    label:'No-Junk Zone: 12 วิ “แฟร์แต่โหด” 🧱',
    hint:'โดน junk/fake = รีเซ็ต | Block ได้แต่โดน -2 วิ (ยังพอแก้ตัวได้)',
    targetByDiff:{ easy:10, normal:12, hard:14 },
    eval:(s)=> (s.safeNoJunkSeconds|0),
    pass:(v,tgt)=> v>=tgt
  },

  // B: Shield mastery
  {
    id:'m4',
    label:'Shield Master: BLOCK ให้ได้ 🛡️',
    hint:'ต้องกด shield แล้วกันให้ทันจริง ๆ',
    targetByDiff:{ easy:2, normal:3, hard:3 },
    eval:(s)=> (s.blocks|0),
    pass:(v,tgt)=> v>=tgt
  },

  // A+B: Magnet high risk
  {
    id:'m5',
    label:'Magnet Chaos: ใช้ 🧲 แล้ว “ดีติดกัน” (โหด) 🧲💥',
    hint:'เปิดแม่เหล็กแล้วคุมมือให้ได้ (junk จะดูดเข้ามา)',
    targetByDiff:{ easy:5, normal:7, hard:9 },
    eval:(s)=> (s.usedMagnet ? (s.streakGood|0) : 0),
    pass:(v,tgt)=> v>=tgt
  },

  // A: Time trade harder
  {
    id:'m6',
    label:'Time Dealer+: ใช้ ⏳ 1 ครั้ง แล้วเก็บดีต่อ 4 ชิ้น',
    hint:'เก็บเวลาแล้วต้อง “ต่อคอมโบ” ให้ได้',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> ((s.timePlus|0) >= 1 && (s.streakGood|0) >= 4 ? 1 : 0),
    pass:(v)=> v>=1,
    notChallenge:['survival']
  },

  // C: Boss mini (only boss)
  {
    id:'m7',
    label:'Boss Slayer: เคลียร์บอสให้ได้ 👑',
    hint:'ช่วงท้ายเกมเท่านั้น',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:(s)=> (s.bossCleared ? 1 : 0),
    pass:(v)=> v>=1,
    onlyChallenge:['boss']
  },

  // A: Final sprint real counter (final8Good)
  {
    id:'m8',
    label:'Final Sprint: 8 วิท้าย เก็บดีให้ได้ 🏁',
    hint:'นับเฉพาะ 8 วิท้ายจริง ๆ (เริ่มนับเมื่อ <= 8s)',
    targetByDiff:{ easy:8, normal:10, hard:12 },
    eval:(s)=> (s.final8Good|0),
    pass:(v,tgt)=> v>=tgt
  }
];

// ---------- helpers ----------
function sAccuracy(s){ return (s && typeof s.accuracyGoodPct === 'number') ? (s.accuracyGoodPct|0) : 0; }
function accNeed(s){
  const ch = String(s?.challenge || '');
  // boss โหดขึ้นนิด
  return (ch === 'boss') ? 80 : 78;
}
function missNeedForCombo(s){
  // ถ้าจะผ่าน goal combo ต้องคุม miss ด้วย (โหดแต่แฟร์)
  const d = String(s?.runMode || 'play'); // ไม่ได้ใช้จริง แค่อ่านไว้
  const diff = String(s?.diff || '');     // ถ้าอยากใส่ต่อก็ได้
  // ใช้เกณฑ์คงที่แบบไม่โกง:
  return 3; // combo goal ต้อง miss ≤ 3 (ทุก diff)
}
function bossMissCap(s){
  // boss goal เพิ่มแรง: miss ≤ 4/3/2 ตาม diff จะได้แฟร์
  const df = String(s?.diff || 'normal').toLowerCase();
  if (df === 'easy') return 4;
  if (df === 'hard') return 2;
  return 3;
}