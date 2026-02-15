// === /herohealth/vr/food5-th.js ===
// HeroHealth — Food Groups (TH) + Emoji Packs — v20260215a
// ✅ Thai 5 food groups mapping (fixed)
// ✅ JUNK pack (snack/sweet/fried/soda etc.)
// ✅ pickEmoji(rng, arr) helper
// ✅ emojiForGroup(rng, groupId) weighted-ish variety
// ✅ labelForGroup(groupId) Thai labels

'use strict';

// NOTE (fixed mapping):
// หมู่ 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
// หมู่ 2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)
// หมู่ 3 ผัก
// หมู่ 4 ผลไม้
// หมู่ 5 ไขมัน

export const GROUPS = [
  {
    id: 1,
    key: 'protein',
    labelTH: 'หมู่ 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)',
    emojis: ['🍗','🥚','🐟','🥛','🫘','🧀','🍤','🥩','🍳']
  },
  {
    id: 2,
    key: 'carb',
    labelTH: 'หมู่ 2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)',
    emojis: ['🍚','🍞','🥖','🍜','🍝','🥔','🍠','🫓','🍘']
  },
  {
    id: 3,
    key: 'veg',
    labelTH: 'หมู่ 3 ผัก',
    emojis: ['🥦','🥬','🥒','🥕','🌽','🍆','🍅','🫑','🥗']
  },
  {
    id: 4,
    key: 'fruit',
    labelTH: 'หมู่ 4 ผลไม้',
    emojis: ['🍎','🍌','🍉','🍇','🍍','🍊','🍓','🥭','🍐']
  },
  {
    id: 5,
    key: 'fat',
    labelTH: 'หมู่ 5 ไขมัน',
    emojis: ['🥑','🫒','🥜','🌰','🧈','🛢️','🥥']
  }
];

export const JUNK = {
  key: 'junk',
  labelTH: 'ของหวาน/ทอด/น้ำอัดลม (JUNK)',
  emojis: [
    '🍟','🍔','🍕','🌭','🍗','🥓','🍩','🍰','🧁','🍫','🍬','🍭','🥤','🧋','🧃'
  ]
};

export function pickEmoji(rng, arr){
  const r = (typeof rng === 'function') ? rng : Math.random;
  if(!Array.isArray(arr) || arr.length === 0) return '❓';
  return arr[Math.floor(r() * arr.length)];
}

export function labelForGroup(groupId){
  const id = Number(groupId)||0;
  const g = GROUPS.find(x=>x.id === id);
  return g ? g.labelTH : 'อาหาร';
}

// Slight variety helper: allow caller to pass rng for determinism
export function emojiForGroup(rng, groupId){
  const id = Number(groupId)||0;
  const g = GROUPS.find(x=>x.id === id);
  if(!g) return '🍽️';
  return pickEmoji(rng, g.emojis);
}
