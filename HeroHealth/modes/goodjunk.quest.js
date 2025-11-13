// === /HeroHealth/modes/goodjunk.quest.js ===
import { makeQuestDirector } from './quest-director.js';

// กำหนด 10 เป้าหลัก
const GOAL_DEFS = [
  { id:'score1200', label:'ทำคะแนนรวม 1200+', kind:'score',  easy:800,  normal:1200, hard:1600 },
  { id:'score2000', label:'ทำคะแนนรวม 2000+', kind:'score',  easy:1200, normal:2000, hard:2600 },
  { id:'good20',    label:'เก็บของดีให้ได้ 20 ชิ้น', kind:'goodHits', easy:14, normal:20, hard:26 },
  { id:'good30',    label:'เก็บของดีให้ได้ 30 ชิ้น', kind:'goodHits', easy:20, normal:30, hard:40 },
  { id:'missLow',   label:'พลาดไม่เกิน 8 ครั้ง',    kind:'missMax',  easy:12, normal:8,  hard:6  },
  { id:'combo10',   label:'คอมโบต่อเนื่อง 10 ครั้ง', kind:'combo',    easy:8,  normal:10, hard:14 },
  { id:'combo15',   label:'คอมโบต่อเนื่อง 15 ครั้ง', kind:'combo',    easy:10, normal:15, hard:20 },
  { id:'scoreFever',label:'ทำคะแนนช่วง Fever 800+', kind:'score',    easy:500,normal:800,hard:1000},
  { id:'goodNoBad', label:'เก็บของดี 10 ชิ้นติดไม่โดนของเสีย', kind:'goodHits', easy:8, normal:10, hard:12 },
  { id:'mixed',     label:'ทั้งคะแนนและของดีต้องถึงเกณฑ์', kind:'score', easy:900, normal:1400, hard:1900 }
];

// กำหนด 15 mini quest
const MINI_DEFS = [
  { id:'miss8',     label:'พลาดไม่เกิน 8 ครั้ง',       kind:'missMax',  easy:12, normal:8,  hard:6  },
  { id:'miss5',     label:'พลาดไม่เกิน 5 ครั้ง',       kind:'missMax',  easy:10, normal:7,  hard:5  },
  { id:'combo8',    label:'คอมโบต่อเนื่อง 8 ครั้ง',    kind:'combo',    easy:6,  normal:8,  hard:12 },
  { id:'combo12',   label:'คอมโบต่อเนื่อง 12 ครั้ง',   kind:'combo',    easy:8,  normal:12, hard:16 },
  { id:'goodLeft',  label:'เก็บของดีฝั่งซ้ายให้ได้ 8 ชิ้น',  kind:'goodHits', easy:6, normal:8, hard:10 },
  { id:'goodRight', label:'เก็บของดีฝั่งขวาให้ได้ 8 ชิ้น',   kind:'goodHits', easy:6, normal:8, hard:10 },
  { id:'goodRow',   label:'เก็บของดี 5 ชิ้นติดกัน',    kind:'goodHits', easy:4,  normal:5,  hard:6  },
  { id:'scoreRush', label:'ทำคะแนน 600+ ภายใน 15 วินาที', kind:'score', easy:400,normal:600,hard:800},
  { id:'noBad10s',  label:'10 วินาทีห้ามโดนของเสีย',   kind:'missMax',  easy:2,  normal:1,  hard:0  },
  { id:'comboStart',label:'เปิดเกมด้วยคอมโบ 5 ขึ้นไป', kind:'combo',    easy:4,  normal:5,  hard:7  },
  { id:'score1200m',label:'ทำคะแนนรวมให้ได้ 1200+',   kind:'score',    easy:800,normal:1200,hard:1600},
  { id:'good18',    label:'เก็บของดีให้ถึง 18 ชิ้น',   kind:'goodHits', easy:12, normal:18, hard:24 },
  { id:'good25',    label:'เก็บของดีให้ถึง 25 ชิ้น',   kind:'goodHits', easy:18, normal:25, hard:32 },
  { id:'comboChain',label:'คอมโบสูงสุดอย่างน้อย 15',   kind:'combo',    easy:10, normal:15, hard:20 },
  { id:'miss10',    label:'พลาดไม่เกิน 10 ครั้ง',      kind:'missMax',  easy:14, normal:10, hard:8  }
];

export function createGoodJunkQuest(diff){
  const director = makeQuestDirector({
    diff,
    goalDefs: GOAL_DEFS,
    miniDefs: MINI_DEFS,
    maxGoals: 2,
    maxMini:  3
  });

  return director;
}
