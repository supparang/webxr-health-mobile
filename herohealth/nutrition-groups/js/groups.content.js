// === /herohealth/nutrition-groups/js/groups.content.js ===
// Content bank for Nutrition Groups
// PATCH v20260323-GROUPS-CHILDFRIENDLY-A

export const FOOD_GROUPS = {
  m1: { id: 'm1', label: 'หมู่ 1 โปรตีน', emoji: '🥚', short: 'โปรตีน' },
  m2: { id: 'm2', label: 'หมู่ 2 คาร์โบไฮเดรต', emoji: '🍚', short: 'พลังงาน' },
  m3: { id: 'm3', label: 'หมู่ 3 ผัก', emoji: '🥦', short: 'ผัก' },
  m4: { id: 'm4', label: 'หมู่ 4 ผลไม้', emoji: '🍉', short: 'ผลไม้' },
  m5: { id: 'm5', label: 'หมู่ 5 ไขมัน', emoji: '🫗', short: 'ไขมัน' }
};

export const GROUP_OPTIONS = Object.values(FOOD_GROUPS).map(group => ({
  id: group.id,
  label: group.label,
  emoji: group.emoji,
  short: group.short
}));

export const FOOD_ITEMS = [
  { id: 'egg', label: 'ไข่', emoji: '🥚', groupId: 'm1', note: 'เป็นแหล่งโปรตีน' },
  { id: 'fish', label: 'ปลา', emoji: '🐟', groupId: 'm1', note: 'ช่วยเสริมโปรตีนที่เหมาะสม' },
  { id: 'milk', label: 'นมจืด', emoji: '🥛', groupId: 'm1', note: 'อยู่หมู่โปรตีน' },

  { id: 'rice', label: 'ข้าว', emoji: '🍚', groupId: 'm2', note: 'ให้พลังงานหลัก' },
  { id: 'bread', label: 'ขนมปัง', emoji: '🍞', groupId: 'm2', note: 'อยู่หมู่คาร์โบไฮเดรต' },
  { id: 'sweetPotato', label: 'มันเทศ', emoji: '🍠', groupId: 'm2', note: 'ให้พลังงานจากแป้ง' },

  { id: 'carrot', label: 'แครอท', emoji: '🥕', groupId: 'm3', note: 'เป็นผัก' },
  { id: 'broccoli', label: 'บรอกโคลี', emoji: '🥦', groupId: 'm3', note: 'อยู่หมู่ผัก' },
  { id: 'cucumber', label: 'แตงกวา', emoji: '🥒', groupId: 'm3', note: 'เป็นผักสด' },

  { id: 'banana', label: 'กล้วย', emoji: '🍌', groupId: 'm4', note: 'เป็นผลไม้' },
  { id: 'watermelon', label: 'แตงโม', emoji: '🍉', groupId: 'm4', note: 'อยู่หมู่ผลไม้' },
  { id: 'orange', label: 'ส้ม', emoji: '🍊', groupId: 'm4', note: 'เป็นผลไม้' },

  { id: 'oil', label: 'น้ำมันพืช', emoji: '🫗', groupId: 'm5', note: 'อยู่หมู่ไขมัน' },
  { id: 'butter', label: 'เนย', emoji: '🧈', groupId: 'm5', note: 'เป็นไขมัน' },
  { id: 'mayo', label: 'มายองเนส', emoji: '🥣', groupId: 'm5', note: 'อยู่หมู่ไขมัน' }
];

export const COMPARE_PAIRS = [
  {
    id: 'cmp-1',
    leftId: 'banana',
    rightId: 'candy',
    betterId: 'banana',
    betterText: 'กล้วย',
    prompt: 'ข้อไหนดีกว่าสำหรับร่างกาย',
    correctReason: 'มีประโยชน์กว่า',
    correctReasonHelper: 'และหวานน้อยกว่า',
    distractors: [
      { label: 'สีสวยกว่า', helper: 'แต่ไม่ใช่เหตุผลเรื่องสุขภาพ' },
      { label: 'ถือสบายกว่า', helper: 'แต่ไม่ใช่เหตุผลเรื่องสุขภาพ' }
    ]
  },
  {
    id: 'cmp-2',
    leftId: 'milk',
    rightId: 'soda',
    betterId: 'milk',
    betterText: 'นมจืด',
    prompt: 'ข้อไหนดีกว่าสำหรับร่างกาย',
    correctReason: 'มีประโยชน์กว่า',
    correctReasonHelper: 'และหวานน้อยกว่า',
    distractors: [
      { label: 'มีฟองน้อยกว่า', helper: 'แต่ไม่ใช่เหตุผลเรื่องสุขภาพ' },
      { label: 'แก้วใหญ่กว่า', helper: 'แต่ไม่ใช่เหตุผลเรื่องสุขภาพ' }
    ]
  },
  {
    id: 'cmp-3',
    leftId: 'watermelon',
    rightId: 'chips',
    betterId: 'watermelon',
    betterText: 'แตงโม',
    prompt: 'ข้อไหนดีกว่าสำหรับร่างกาย',
    correctReason: 'เป็นผลไม้',
    correctReasonHelper: 'และไม่ทอด',
    distractors: [
      { label: 'เสียงเบากว่า', helper: 'แต่ไม่ใช่เหตุผลเรื่องสุขภาพ' },
      { label: 'จับง่ายกว่า', helper: 'แต่ไม่ใช่เหตุผลเรื่องสุขภาพ' }
    ]
  },
  {
    id: 'cmp-4',
    leftId: 'broccoli',
    rightId: 'fries',
    betterId: 'broccoli',
    betterText: 'บรอกโคลี',
    prompt: 'ข้อไหนดีกว่าสำหรับร่างกาย',
    correctReason: 'เป็นผัก',
    correctReasonHelper: 'และดีต่อมื้ออาหาร',
    distractors: [
      { label: 'ชิ้นเล็กกว่า', helper: 'แต่ไม่ใช่เหตุผลเรื่องสุขภาพ' },
      { label: 'หยิบช้ากว่า', helper: 'แต่ไม่ใช่เหตุผลเรื่องสุขภาพ' }
    ]
  }
];

export const EXTRA_COMPARE_FOODS = {
  candy: { id: 'candy', label: 'ลูกอม', emoji: '🍬', groupId: 'extra' },
  soda: { id: 'soda', label: 'น้ำอัดลม', emoji: '🥤', groupId: 'extra' },
  chips: { id: 'chips', label: 'มันฝรั่งทอด', emoji: '🍟', groupId: 'extra' },
  fries: { id: 'fries', label: 'ของทอดกรอบ', emoji: '🍟', groupId: 'extra' }
};

export function getFoodById(id) {
  return FOOD_ITEMS.find(item => item.id === id) || EXTRA_COMPARE_FOODS[id] || null;
}