// === /herohealth/nutrition-plate/js/plate.content.js ===
// Content bank for Nutrition Plate
// PATCH v20260318-PLATE-RUN-FULL

export const SLOT_META = {
  base: { id: 'base', label: 'อาหารหลัก' },
  protein: { id: 'protein', label: 'โปรตีน' },
  veg: { id: 'veg', label: 'ผัก' },
  fruit: { id: 'fruit', label: 'ผลไม้/ของหวาน' },
  drink: { id: 'drink', label: 'เครื่องดื่ม' }
};

export const FOODS = [
  { id: 'rice', label: 'ข้าว', emoji: '🍚', slot: 'base', balancePoints: 8, tier: 'good' },
  { id: 'brownRice', label: 'ข้าวกล้อง', emoji: '🍚', slot: 'base', balancePoints: 10, tier: 'best' },
  { id: 'instantNoodles', label: 'บะหมี่กึ่งสำเร็จรูป', emoji: '🍜', slot: 'base', balancePoints: 4, tier: 'poor', processed: true },

  { id: 'grilledFish', label: 'ปลาเผา', emoji: '🐟', slot: 'protein', balancePoints: 10, tier: 'best' },
  { id: 'boiledEgg', label: 'ไข่ต้ม', emoji: '🥚', slot: 'protein', balancePoints: 9, tier: 'good' },
  { id: 'friedChicken', label: 'ไก่ทอด', emoji: '🍗', slot: 'protein', balancePoints: 4, tier: 'poor', fried: true },
  { id: 'sausage', label: 'ไส้กรอก', emoji: '🌭', slot: 'protein', balancePoints: 3, tier: 'poor', processed: true },

  { id: 'broccoli', label: 'บรอกโคลี', emoji: '🥦', slot: 'veg', balancePoints: 15, tier: 'best', isVeg: true },
  { id: 'cucumber', label: 'แตงกวา', emoji: '🥒', slot: 'veg', balancePoints: 12, tier: 'good', isVeg: true },
  { id: 'noVeg', label: 'ไม่เอาผัก', emoji: '🚫', slot: 'veg', balancePoints: 0, tier: 'poor', noVeg: true },

  { id: 'orange', label: 'ส้ม', emoji: '🍊', slot: 'fruit', balancePoints: 10, tier: 'best', isFruit: true },
  { id: 'watermelon', label: 'แตงโม', emoji: '🍉', slot: 'fruit', balancePoints: 10, tier: 'best', isFruit: true },
  { id: 'cake', label: 'เค้ก', emoji: '🍰', slot: 'fruit', balancePoints: 0, tier: 'poor', sweet: true },

  { id: 'water', label: 'น้ำเปล่า', emoji: '💧', slot: 'drink', balancePoints: 15, tier: 'best', isHealthyDrink: true },
  { id: 'milk', label: 'นมจืด', emoji: '🥛', slot: 'drink', balancePoints: 12, tier: 'good', isHealthyDrink: true },
  { id: 'soda', label: 'น้ำอัดลม', emoji: '🥤', slot: 'drink', balancePoints: 0, tier: 'poor', sugary: true }
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
    options: ['grilledFish', 'boiledEgg', 'friedChicken', 'sausage']
  },
  {
    id: 'build-veg',
    type: 'build',
    slot: 'veg',
    prompt: 'เลือกผักสำหรับมื้อนี้',
    options: ['broccoli', 'cucumber', 'noVeg']
  },
  {
    id: 'build-fruit',
    type: 'build',
    slot: 'fruit',
    prompt: 'เลือกผลไม้หรือของหวานสำหรับมื้อนี้',
    options: ['orange', 'watermelon', 'cake']
  },
  {
    id: 'build-drink',
    type: 'build',
    slot: 'drink',
    prompt: 'เลือกเครื่องดื่มสำหรับมื้อนี้',
    options: ['water', 'milk', 'soda']
  }
];

export function getFoodById(id) {
  return FOODS.find(item => item.id === id) || null;
}

export function hydrateQuestion(question) {
  return {
    ...question,
    options: question.options.map(id => getFoodById(id)).filter(Boolean)
  };
}