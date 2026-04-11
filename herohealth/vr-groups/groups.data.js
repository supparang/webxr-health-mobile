// /herohealth/vr-groups/groups.data.js
// Groups Solo Data
// PATCH v20260405-groups-data-r1

export const GROUPS_PATCH_DATA = 'v20260405-groups-data-r1';

export const GROUPS_CATEGORIES = [
  { id:'g1', short:'หมู่ 1', name:'โปรตีน', icon:'🥚', color:'#ffd7a8' },
  { id:'g2', short:'หมู่ 2', name:'ข้าว-แป้ง', icon:'🍚', color:'#ffe89e' },
  { id:'g3', short:'หมู่ 3', name:'ผัก', icon:'🥦', color:'#c9f2b8' },
  { id:'g4', short:'หมู่ 4', name:'ผลไม้', icon:'🍌', color:'#ffd2c9' },
  { id:'g5', short:'หมู่ 5', name:'ไขมัน', icon:'🧈', color:'#fff0b8' }
];

export const GROUPS_CATEGORY_MAP = Object.fromEntries(
  GROUPS_CATEGORIES.map((x) => [x.id, x])
);

export const GROUPS_ITEMS = [
  { id:'egg', label:'ไข่', emoji:'🥚', group:'g1' },
  { id:'milk', label:'นม', emoji:'🥛', group:'g1' },
  { id:'fish', label:'ปลา', emoji:'🐟', group:'g1' },
  { id:'chicken', label:'ไก่', emoji:'🍗', group:'g1' },
  { id:'tofu', label:'เต้าหู้', emoji:'🧈', group:'g1' },

  { id:'rice', label:'ข้าว', emoji:'🍚', group:'g2' },
  { id:'bread', label:'ขนมปัง', emoji:'🍞', group:'g2' },
  { id:'noodle', label:'เส้น', emoji:'🍜', group:'g2' },
  { id:'potato', label:'มันฝรั่ง', emoji:'🥔', group:'g2' },
  { id:'corn', label:'ข้าวโพด', emoji:'🌽', group:'g2' },

  { id:'broccoli', label:'บรอกโคลี', emoji:'🥦', group:'g3' },
  { id:'carrot', label:'แครอท', emoji:'🥕', group:'g3' },
  { id:'cucumber', label:'แตงกวา', emoji:'🥒', group:'g3' },
  { id:'mushroom', label:'เห็ด', emoji:'🍄', group:'g3' },
  { id:'leafy', label:'ผักใบ', emoji:'🥬', group:'g3' },

  { id:'banana', label:'กล้วย', emoji:'🍌', group:'g4' },
  { id:'apple', label:'แอปเปิล', emoji:'🍎', group:'g4' },
  { id:'watermelon', label:'แตงโม', emoji:'🍉', group:'g4' },
  { id:'orange', label:'ส้ม', emoji:'🍊', group:'g4' },
  { id:'grape', label:'องุ่น', emoji:'🍇', group:'g4' },

  { id:'butter', label:'เนย', emoji:'🧈', group:'g5' },
  { id:'oil', label:'น้ำมัน', emoji:'🫗', group:'g5' },
  { id:'avocado', label:'อะโวคาโด', emoji:'🥑', group:'g5' },
  { id:'coconut', label:'มะพร้าว', emoji:'🥥', group:'g5' },
  { id:'nuts', label:'ถั่ว', emoji:'🥜', group:'g5' }
];

export function getDiffPreset(diff = 'normal'){
  const d = String(diff || 'normal').toLowerCase();

  if (d === 'easy') {
    return {
      spawnMs: 1100,
      lifeMs: 5200,
      maxItems: 4,
      speedMin: 52,
      speedMax: 84,
      sizeMin: 82,
      sizeMax: 104,
      goalNeed: 3
    };
  }

  if (d === 'hard') {
    return {
      spawnMs: 720,
      lifeMs: 3600,
      maxItems: 6,
      speedMin: 74,
      speedMax: 120,
      sizeMin: 68,
      sizeMax: 90,
      goalNeed: 4
    };
  }

  return {
    spawnMs: 900,
    lifeMs: 4300,
    maxItems: 5,
    speedMin: 62,
    speedMax: 102,
    sizeMin: 74,
    sizeMax: 96,
    goalNeed: 3
  };
}

export function createBlankCategoryStats(){
  return Object.fromEntries(
    GROUPS_CATEGORIES.map((cat) => [
      cat.id,
      { correct: 0, wrong: 0, miss: 0 }
    ])
  );
}

export function pickRandomCategory(rng = Math.random, avoidId = ''){
  const pool = GROUPS_CATEGORIES.filter((x) => x.id !== avoidId);
  const arr = pool.length ? pool : GROUPS_CATEGORIES;
  return arr[Math.floor(rng() * arr.length)];
}

export function getCategoryById(id){
  return GROUPS_CATEGORY_MAP[String(id || '').trim()] || GROUPS_CATEGORIES[0];
}

export function getCoachLine(kind = 'intro', rng = Math.random){
  const lines = COACH_LINES[kind] || COACH_LINES.intro;
  return lines[Math.floor(rng() * lines.length)] || '';
}

const COACH_LINES = {
  intro: [
    'โค้ช: พร้อมแล้วแตะปุ่มเริ่มได้เลย ✨',
    'โค้ช: วันนี้มาช่วยกันแยกอาหารให้ถูกหมู่นะ',
    'โค้ช: ดูเป้าหมายก่อน แล้วค่อยแตะให้แม่น ๆ'
  ],
  ready: [
    'โค้ช: เยี่ยมมาก! ต่อไปรอบจริงแล้ว 🚀',
    'โค้ช: อุ่นเครื่องเสร็จแล้ว ลุยรอบหลักกัน',
    'โค้ช: จำหมู่เป้าหมายไว้ แล้วทำ streak ให้ได้'
  ],
  practiceGood: [
    'โค้ช: ถูกต้องเลย แบบนี้แหละ 💡',
    'โค้ช: ใช่เลย อันนี้อยู่หมู่เป้าหมาย',
    'โค้ช: ดีมาก ฝึกแบบนี้เดี๋ยวรอบจริงสบายเลย'
  ],
  practiceWrong: [
    'โค้ช: อันนี้ยังไม่ใช่หมู่เป้าหมายนะ',
    'โค้ช: ลองดูชื่อหมู่กับไอคอนอีกที',
    'โค้ช: ไม่เป็นไร รอบหน้าเล็งใหม่ได้'
  ],
  playGood: [
    'โค้ช: เยี่ยมมาก! ถูกหมู่แล้ว ✅',
    'โค้ช: เก่งมาก เก็บต่อได้เลย',
    'โค้ช: แม่นมาก รักษาจังหวะนี้ไว้'
  ],
  playWrong: [
    'โค้ช: คนละหมู่นะ ลองดูไอคอนใหม่อีกที',
    'โค้ช: อันนี้ยังไม่ตรงเป้า ลองใหม่ได้',
    'โค้ช: ใจเย็น ๆ ดูหมู่ก่อนแตะนะ'
  ],
  miss: [
    'โค้ช: อุ๊ย หลุดเป้าหมายไปแล้ว ลองใหม่อีกครั้งนะ',
    'โค้ช: เป้าหมายหลุดไปแล้ว รีบเก็บตัวถัดไปเลย',
    'โค้ช: ไม่เป็นไร ยังแก้เกมได้'
  ],
  fever: [
    'โค้ช: สุดยอด! เข้า FEVER แล้ว 🔥',
    'โค้ช: ว้าว! คะแนนคูณสองแล้ว',
    'โค้ช: ร้อนแรงมาก รักษา streak ไว้'
  ]
};
