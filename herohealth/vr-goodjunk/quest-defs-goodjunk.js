// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
'use strict';

// GOALS (ยังคุม 2 เป้าหลัก เพื่อให้จบเกมได้ชัวร์ แต่ปรับให้เร้าใจขึ้น)
export const GOODJUNK_GOALS = [
  {
    id:'g1',
    label:'เก็บของดีให้ได้ 🥦',
    targetByDiff:{ easy:18, normal:22, hard:26 },
    eval:s=>s.goodHits|0,
    pass:(v,t)=>v>=t
  },
  {
    id:'g2',
    label:'คอมโบสูงสุด 🔥',
    targetByDiff:{ easy:10, normal:14, hard:18 },
    eval:s=>s.comboMax|0,
    pass:(v,t)=>v>=t
  }
];

// MINIS — H+++ PACK (มีเวลา + ห้ามโดน junk + ช่วงท้าย)
export const GOODJUNK_MINIS = [
  // 1) Rush: เก็บของดี X ภายใน 8 วิ + ห้ามโดน junk ระหว่างทำ
  {
    id:'m_rush',
    label:'RUSH 8s ⚡ (ห้ามโดน junk)',
    targetByDiff:{ easy:4, normal:5, hard:6 },
    eval:s=>s.miniGoodCount|0,
    pass:(v,t,s)=> (v>=t) && ((s.miniElapsed|0) <= 8) && !s.miniBadTouched
  },

  // 2) Clean Zone: อยู่ให้รอด X วิ โดยห้ามโดน junk ระหว่าง mini (โหดแบบ “นิ่ง ๆ แต่กดดัน”)
  {
    id:'m_nojunk',
    label:'No-Junk Zone 🚫 (ห้ามโดน junk)',
    targetByDiff:{ easy:7, normal:10, hard:12 },
    eval:s=>s.safeNoJunkSeconds|0,
    pass:(v,t,s)=> (v>=t) && !s.miniBadTouched
  },

  // 3) Gold + Clean: ต้องได้ Gold อย่างน้อย 1 และห้ามโดน junk ระหว่าง mini
  {
    id:'m_goldclean',
    label:'Gold Clean 🟡✨ (ได้ Gold + ห้ามโดน junk)',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:s=> (s.miniGoldHit ? 1 : 0),
    pass:(v,t,s)=> (v>=1) && !s.miniBadTouched
  },

  // 4) Shield Master: block ให้ถึงจำนวน (บังคับให้เล่นเชิงรับ)
  {
    id:'m_block',
    label:'Shield Master 🛡️',
    targetByDiff:{ easy:1, normal:2, hard:3 },
    eval:s=>s.miniBlocks|0,
    pass:(v,t)=> v>=t
  },

  // 5) Final Lock: ช่วงท้าย (<=8s) ต้องเก็บของดี X ชิ้น (เร้าใจตอนจบ)
  {
    id:'m_final',
    label:'Final Lock 🏁 (8s ท้าย)',
    targetByDiff:{ easy:3, normal:4, hard:5 },
    eval:s=>s.finalWindowGood|0,
    pass:(v,t,s)=> (v>=t) && ((s.timeLeft|0) <= 8)
  }
];