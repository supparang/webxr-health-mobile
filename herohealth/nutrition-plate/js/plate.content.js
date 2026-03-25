// === /herohealth/nutrition-plate/js/plate.content.js ===
// Content bank for Nutrition Plate
// PATCH v20260325-PLATE-P5-BALANCE-3221-A

export const TARGET_MODEL = {
  label: 'P5 Balanced Plate',
  riceUnits: 3,
  proteinUnits: 2,
  vegUnits: 2,
  fruitUnits: 1
};

export const SLOT_META = {
  base: {
    id: 'base',
    label: 'อาหารหลัก',
    short: 'ข้าว-แป้ง',
    targetUnits: TARGET_MODEL.riceUnits
  },
  protein: {
    id: 'protein',
    label: 'โปรตีน',
    short: 'โปรตีน',
    targetUnits: TARGET_MODEL.proteinUnits
  },
  veg: {
    id: 'veg',
    label: 'ผัก',
    short: 'ผัก',
    targetUnits: TARGET_MODEL.vegUnits
  },
  fruit: {
    id: 'fruit',
    label: 'ผลไม้/ของหวาน',
    short: 'ผลไม้',
    targetUnits: TARGET_MODEL.fruitUnits
  },
  drink: {
    id: 'drink',
    label: 'เครื่องดื่ม',
    short: 'เครื่องดื่ม',
    targetUnits: 1
  }
};

export const FOODS = [
  // BASE / ข้าว-แป้ง เป้าหมาย 3 หน่วย
  {
    id: 'brownRice',
    label: 'ข้าวกล้อง',
    emoji: '🍚',
    slot: 'base',
    units: 3,
    tier: 'best',
    qualityScore: 20,
    helper: 'ครบพลังงานพอดี',
    tags: ['wholegrain']
  },
  {
    id: 'rice',
    label: 'ข้าวสวย',
    emoji: '🍚',
    slot: 'base',
    units: 3,
    tier: 'good',
    qualityScore: 18,
    helper: 'พลังงานหลักของมื้อ',
    tags: []
  },
  {
    id: 'instantNoodles',
    label: 'บะหมี่กึ่งสำเร็จรูป',
    emoji: '🍜',
    slot: 'base',
    units: 3,
    tier: 'poor',
    qualityScore: 8,
    helper: 'มีแป้ง แต่แปรรูปมาก',
    processed: true,
    tags: ['processed']
  },

  // PROTEIN / โปรตีน เป้าหมาย 2 หน่วย
  {
    id: 'grilledFish',
    label: 'ปลาเผา',
    emoji: '🐟',
    slot: 'protein',
    units: 2,
    tier: 'best',
    qualityScore: 20,
    helper: 'โปรตีนดี ไม่ทอด',
    leanProtein: true,
    tags: ['lean']
  },
  {
    id: 'boiledEgg',
    label: 'ไข่ต้ม',
    emoji: '🥚',
    slot: 'protein',
    units: 2,
    tier: 'good',
    qualityScore: 18,
    helper: 'โปรตีนดี กินง่าย',
    leanProtein: true,
    tags: ['lean']
  },
  {
    id: 'tofu',
    label: 'เต้าหู้',
    emoji: '🧈',
    slot: 'protein',
    units: 2,
    tier: 'good',
    qualityScore: 18,
    helper: 'โปรตีนจากถั่ว',
    leanProtein: true,
    tags: ['plant']
  },
  {
    id: 'friedChicken',
    label: 'ไก่ทอด',
    emoji: '🍗',
    slot: 'protein',
    units: 2,
    tier: 'poor',
    qualityScore: 8,
    helper: 'โปรตีนมี แต่ทอดมาก',
    fried: true,
    tags: ['fried']
  },
  {
    id: 'sausage',
    label: 'ไส้กรอก',
    emoji: '🌭',
    slot: 'protein',
    units: 2,
    tier: 'poor',
    qualityScore: 6,
    helper: 'แปรรูปมากไป',
    processed: true,
    tags: ['processed']
  },

  // VEG / ผัก เป้าหมาย 2 หน่วย
  {
    id: 'broccoli',
    label: 'บรอกโคลี',
    emoji: '🥦',
    slot: 'veg',
    units: 2,
    tier: 'best',
    qualityScore: 25,
    helper: 'ผักครบดีมาก',
    isVeg: true,
    tags: ['veg']
  },
  {
    id: 'cucumber',
    label: 'แตงกวา',
    emoji: '🥒',
    slot: 'veg',
    units: 2,
    tier: 'good',
    qualityScore: 22,
    helper: 'เพิ่มผักให้จาน',
    isVeg: true,
    tags: ['veg']
  },
  {
    id: 'carrot',
    label: 'แครอท',
    emoji: '🥕',
    slot: 'veg',
    units: 2,
    tier: 'good',
    qualityScore: 22,
    helper: 'ช่วยให้จานมีผัก',
    isVeg: true,
    tags: ['veg']
  },
  {
    id: 'noVeg',
    label: 'ไม่เอาผัก',
    emoji: '🚫',
    slot: 'veg',
    units: 0,
    tier: 'poor',
    qualityScore: 0,
    helper: 'จานจะขาดผัก',
    noVeg: true,
    tags: ['no-veg']
  },

  // FRUIT / ผลไม้ เป้าหมาย 1 หน่วย
  {
    id: 'orange',
    label: 'ส้ม',
    emoji: '🍊',
    slot: 'fruit',
    units: 1,
    tier: 'best',
    qualityScore: 15,
    helper: 'ผลไม้สด',
    isFruit: true,
    tags: ['fruit']
  },
  {
    id: 'watermelon',
    label: 'แตงโม',
    emoji: '🍉',
    slot: 'fruit',
    units: 1,
    tier: 'best',
    qualityScore: 15,
    helper: 'ผลไม้สด',
    isFruit: true,
    tags: ['fruit']
  },
  {
    id: 'banana',
    label: 'กล้วย',
    emoji: '🍌',
    slot: 'fruit',
    units: 1,
    tier: 'good',
    qualityScore: 14,
    helper: 'ผลไม้กินง่าย',
    isFruit: true,
    tags: ['fruit']
  },
  {
    id: 'cake',
    label: 'เค้ก',
    emoji: '🍰',
    slot: 'fruit',
    units: 0,
    tier: 'poor',
    qualityScore: 2,
    helper: 'หวานเกินไป',
    sweet: true,
    tags: ['sweet']
  },

  // DRINK
  {
    id: 'water',
    label: 'น้ำเปล่า',
    emoji: '💧',
    slot: 'drink',
    units: 1,
    tier: 'best',
    qualityScore: 20,
    helper: 'ดีที่สุดสำหรับมื้อนี้',
    isHealthyDrink: true,
    tags: ['water']
  },
  {
    id: 'milk',
    label: 'นมจืด',
    emoji: '🥛',
    slot: 'drink',
    units: 1,
    tier: 'good',
    qualityScore: 16,
    helper: 'ดีรองจากน้ำเปล่า',
    isHealthyDrink: true,
    isMilk: true,
    tags: ['milk']
  },
  {
    id: 'sweetMilk',
    label: 'นมหวาน',
    emoji: '🧋',
    slot: 'drink',
    units: 1,
    tier: 'poor',
    qualityScore: 6,
    helper: 'หวานเกินไป',
    sugary: true,
    tags: ['sweet-drink']
  },
  {
    id: 'soda',
    label: 'น้ำอัดลม',
    emoji: '🥤',
    slot: 'drink',
    units: 1,
    tier: 'poor',
    qualityScore: 0,
    helper: 'หวานมาก',
    sugary: true,
    tags: ['sweet-drink']
  }
];

export const BUILD_QUESTIONS = [
  {
    id: 'build-base',
    type: 'build',
    slot: 'base',
    prompt: 'เลือกอาหารหลักสำหรับมื้อนี้',
    options: ['brownRice', 'rice', 'instantNoodles']
  },
  {
    id: 'build-protein',
    type: 'build',
    slot: 'protein',
    prompt: 'เลือกโปรตีนสำหรับมื้อนี้',
    options: ['grilledFish', 'boiledEgg', 'tofu', 'friedChicken', 'sausage']
  },
  {
    id: 'build-veg',
    type: 'build',
    slot: 'veg',
    prompt: 'เลือกผักสำหรับมื้อนี้',
    options: ['broccoli', 'cucumber', 'carrot', 'noVeg']
  },
  {
    id: 'build-fruit',
    type: 'build',
    slot: 'fruit',
    prompt: 'เลือกผลไม้หรือของหวานสำหรับมื้อนี้',
    options: ['orange', 'watermelon', 'banana', 'cake']
  },
  {
    id: 'build-drink',
    type: 'build',
    slot: 'drink',
    prompt: 'เลือกเครื่องดื่มสำหรับมื้อนี้',
    options: ['water', 'milk', 'sweetMilk', 'soda']
  }
];

export function getFoodById(id) {
  return FOODS.find(item => item.id === id) || null;
}

export function hydrateQuestion(question) {
  return {
    ...question,
    slotMeta: SLOT_META[question.slot] || null,
    options: question.options.map(id => getFoodById(id)).filter(Boolean)
  };
}