// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// Goal + Mini defs for GoodJunk (Grade 5 friendly)

'use strict';

// Goals (ทำทีละ goal ต่อเนื่องจนจบ)
export const GOODJUNK_GOALS = [
  {
    id: 'collect_good',
    label: 'เก็บของดีให้ได้',
    makeTarget: (diff)=> diff==='easy'? 18 : diff==='hard'? 22 : 20,
    calc: (state, target)=> ({ prog: state.goodHits|0, target })
  },
  {
    id: 'combo',
    label: 'ทำคอมโบให้ถึง',
    makeTarget: (diff)=> diff==='easy'? 10 : diff==='hard'? 14 : 12,
    calc: (state, target)=> ({ prog: state.comboMax|0, target })
  },
  {
    id: 'miss_limit',
    label: 'พลาดไม่เกิน (รักษาเงื่อนไขจนจบเกม)',
    makeTarget: (diff)=> diff==='easy'? 5 : diff==='hard'? 3 : 4,
    calc: (state, target)=> ({ prog: (state.miss|0) <= target ? 1 : 0, target: 1, hold:true, limit:target })
  },
  {
    id: 'gold_hunter',
    label: 'ล่า GOLD ให้ได้',
    makeTarget: (diff)=> diff==='easy'? 1 : diff==='hard'? 2 : 1,
    calc: (state, target)=> ({ prog: state.goldHits|0, target })
  },
  {
    id: 'boss_clear',
    label: 'โค่นบอสท้ายเกม',
    makeTarget: (_diff)=> 1,
    calc: (state, target)=> ({ prog: state.bossCleared?1:0, target, only:'boss' })
  }
];

// Minis (ต่อเนื่องเรื่อย ๆ จนจบเกม)
export const GOODJUNK_MINIS = [
  {
    id:'streak3',
    label:'เก็บของดีติดกัน 3 ครั้ง',
    makeTarget: ()=> 3,
    calc: (state, target)=> ({ prog: state.streakGood|0, target })
  },
  {
    id:'block_once',
    label:'ใช้โล่บล็อก junk ให้ได้ 1 ครั้ง',
    makeTarget: ()=> 1,
    calc: (state, target)=> ({ prog: state.blocks|0, target })
  },
  {
    id:'use_magnet',
    label:'เก็บ 🧲 แล้วใช้ให้คุ้ม!',
    makeTarget: ()=> 1,
    calc: (state, target)=> ({ prog: state.usedMagnet?1:0, target })
  },
  {
    id:'time_plus',
    label:'เก็บ ⏳ เพิ่มเวลา 1 ครั้ง',
    makeTarget: ()=> 1,
    calc: (state, target)=> ({ prog: state.timePlus|0, target })
  },
  {
    id:'no_junk_8s',
    label:'ห้ามโดน junk 8 วินาที',
    makeTarget: ()=> 8,
    calc: (state, target)=> ({ prog: state.safeSeconds|0, target, timer:true })
  },
  {
    id:'gold_now',
    label:'เก็บ GOLD ภายในรอบนี้',
    makeTarget: ()=> 1,
    calc: (state, target)=> ({ prog: state.goldHitsThisMini?1:0, target })
  }
];
