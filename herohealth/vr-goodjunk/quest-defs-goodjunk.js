// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
'use strict';

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
    targetByDiff:{ easy:8, normal:12, hard:15 },
    eval:s=>s.comboMax|0,
    pass:(v,t)=>v>=t
  }
];

export const GOODJUNK_MINIS = [
  {
    id:'m1',
    label:'Clean Streak ⚡',
    targetByDiff:{ easy:5, normal:8, hard:10 },
    eval:s=>s.streakGood|0,
    pass:(v,t)=>v>=t
  },
  {
    id:'m2',
    label:'Gold Hunt 🟡',
    targetByDiff:{ easy:1, normal:1, hard:1 },
    eval:s=>s.goldHitsThisMini?1:0,
    pass:v=>v>=1
  },
  {
    id:'m3',
    label:'No Junk Zone 🚫',
    targetByDiff:{ easy:6, normal:10, hard:12 },
    eval:s=>s.safeNoJunkSeconds|0,
    pass:(v,t)=>v>=t
  }
];