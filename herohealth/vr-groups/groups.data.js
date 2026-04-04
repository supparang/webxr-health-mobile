// /herohealth/vr-groups/groups.data.js
// Groups Solo Data Pack
// PATCH v20260404-groups-data-r1

export const GROUPS_PATCH_DATA = 'v20260404-groups-data-r1';

export const GROUPS_CATEGORIES = [
  { id:'g1', short:'หมู่ 1', name:'โปรตีน', icon:'🥚', hint:'เนื้อ นม ไข่ ถั่วเมล็ดแห้ง' },
  { id:'g2', short:'หมู่ 2', name:'ข้าว-แป้ง', icon:'🍚', hint:'ข้าว แป้ง เผือก มัน น้ำตาล' },
  { id:'g3', short:'หมู่ 3', name:'ผัก', icon:'🥦', hint:'ผักหลากสี' },
  { id:'g4', short:'หมู่ 4', name:'ผลไม้', icon:'🍌', hint:'ผลไม้สด' },
  { id:'g5', short:'หมู่ 5', name:'ไขมัน', icon:'🧈', hint:'ไขมันและน้ำมัน' }
];

export const GROUPS_ITEMS = [
  { id:'egg',        label:'ไข่',        emoji:'🥚', group:'g1' },
  { id:'milk',       label:'นม',         emoji:'🥛', group:'g1' },
  { id:'fish',       label:'ปลา',        emoji:'🐟', group:'g1' },
  { id:'beans',      label:'ถั่ว',       emoji:'🫘', group:'g1' },

  { id:'rice',       label:'ข้าว',       emoji:'🍚', group:'g2' },
  { id:'bread',      label:'ขนมปัง',     emoji:'🍞', group:'g2' },
  { id:'corn',       label:'ข้าวโพด',    emoji:'🌽', group:'g2' },
  { id:'potato',     label:'มันฝรั่ง',   emoji:'🥔', group:'g2' },

  { id:'broccoli',   label:'บรอกโคลี',   emoji:'🥦', group:'g3' },
  { id:'carrot',     label:'แครอท',      emoji:'🥕', group:'g3' },
  { id:'tomato',     label:'มะเขือเทศ',  emoji:'🍅', group:'g3' },
  { id:'cucumber',   label:'แตงกวา',     emoji:'🥒', group:'g3' },

  { id:'banana',     label:'กล้วย',      emoji:'🍌', group:'g4' },
  { id:'apple',      label:'แอปเปิล',    emoji:'🍎', group:'g4' },
  { id:'grapes',     label:'องุ่น',      emoji:'🍇', group:'g4' },
  { id:'watermelon', label:'แตงโม',       emoji:'🍉', group:'g4' },

  { id:'butter',     label:'เนย',        emoji:'🧈', group:'g5' },
  { id:'oil',        label:'น้ำมัน',      emoji:'🫗', group:'g5' },
  { id:'coconut',    label:'มะพร้าว',     emoji:'🥥', group:'g5' },
  { id:'avocado',    label:'อะโวคาโด',    emoji:'🥑', group:'g5' }
];

export const GROUPS_DIFF = {
  easy:   { spawnMs:900, lifeMs:4300, maxItems:4, speedMin:20, speedMax:38, goalNeed:2, sizeMin:88, sizeMax:108 },
  normal: { spawnMs:700, lifeMs:3400, maxItems:5, speedMin:30, speedMax:56, goalNeed:3, sizeMin:82, sizeMax:102 },
  hard:   { spawnMs:520, lifeMs:2800, maxItems:6, speedMin:42, speedMax:76, goalNeed:4, sizeMin:78, sizeMax:98  }
};

export const GROUPS_COACH_LINES = {
  intro: [
    'โค้ช: พร้อมแล้ว แตะ “เริ่มฝึกเลย” ได้เลย ✨'
  ],
  practiceGood: [
    'โค้ช: ถูกต้องเลย แบบนี้แหละ 💡',
    'โค้ช: ดีมาก! ลองต่ออีกชิ้นนะ 🌟',
    'โค้ช: ใช่เลย หมู่นี้ถูกต้อง ✅'
  ],
  practiceWrong: [
    'โค้ช: อันนี้ยังไม่ใช่หมู่เป้าหมายนะ',
    'โค้ช: ลองดูชื่อหมู่ด้านบนอีกครั้ง 💭'
  ],
  playGood: [
    'โค้ช: เยี่ยมมาก! ถูกหมู่แล้ว ✅',
    'โค้ช: เก่งมาก ไปต่อเลย 🌈',
    'โค้ช: แม่นมาก! อีกนิดเดียว 💪'
  ],
  playWrong: [
    'โค้ช: คนละหมู่นะ ลองดูไอคอนกับชื่อหมู่ใหม่อีกที',
    'โค้ช: ยังไม่ใช่หมู่นี้นะ ลองใหม่ได้เลย'
  ],
  miss: [
    'โค้ช: อุ๊ย หลุดเป้าหมายไปแล้ว ลองใหม่อีกครั้งนะ',
    'โค้ช: ไม่เป็นไร เป้าต่อไปเอาใหม่ได้ 🌼'
  ],
  fever: [
    'โค้ช: สุดยอด! เข้า FEVER แล้ว คะแนนคูณ 2 🔥',
    'โค้ช: ร้อนแรงมาก! ช่วงนี้เก็บแต้มได้ไวขึ้น ⚡'
  ],
  ready: [
    'โค้ช: เก่งมาก! รอบต่อไปจะนับคะแนนจริงแล้ว 🚀'
  ]
};

export const GROUPS_SUMMARY_COPY = {
  S: {
    lead: 'ยอดเยี่ยมมาก! ทั้งเร็วและแม่นสุด ๆ',
    stars: '⭐⭐⭐'
  },
  A: {
    lead: 'ดีมากเลย! อีกนิดเดียวก็แตะระดับสูงสุดแล้ว',
    stars: '⭐⭐⭐'
  },
  B: {
    lead: 'ทำได้ดีนะ ลองเพิ่มความแม่นอีกนิด',
    stars: '⭐⭐☆'
  },
  C: {
    lead: 'เริ่มได้ดีแล้ว ลองดูหมวดเป้าหมายให้ชัดขึ้นอีกหน่อย',
    stars: '⭐☆☆'
  }
};

export function getCategoryById(id){
  return GROUPS_CATEGORIES.find(c => c.id === id) || GROUPS_CATEGORIES[0];
}

export function getItemsByGroup(groupId){
  return GROUPS_ITEMS.filter(x => x.group === groupId);
}

export function getDiffPreset(diff='normal'){
  return GROUPS_DIFF[diff] || GROUPS_DIFF.normal;
}

export function createBlankCategoryStats(){
  return Object.fromEntries(
    GROUPS_CATEGORIES.map(c => [c.id, { correct:0, wrong:0, miss:0 }])
  );
}

export function pickRandom(arr, rng=Math.random){
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[Math.floor(rng() * arr.length)] || arr[0];
}

export function pickRandomCategory(rng=Math.random, avoidId=''){
  const list = GROUPS_CATEGORIES.filter(c => c.id !== avoidId);
  return pickRandom(list.length ? list : GROUPS_CATEGORIES, rng);
}

export function getCoachLine(bucket, rng=Math.random){
  const lines = GROUPS_COACH_LINES[bucket] || GROUPS_COACH_LINES.intro;
  return pickRandom(lines, rng) || '';
}