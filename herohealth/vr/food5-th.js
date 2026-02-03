// === /herohealth/vr/food5-th.js ===
// Thai Food 5 Groups Mapping (STABLE, DO NOT CHANGE)
// ----------------------------------------------------
// ✅ Exports:
//   FOOD5, JUNK,
//   pickEmoji, labelForGroup, emojiForGroup,
//   groupForKey, allGroupIds
// ✅ Supports seeded rng: pickEmoji(rng, arr)
// ✅ Group ids are fixed 1..5 (per your rule)
// ----------------------------------------------------

'use strict';

// ✅ Fixed Thai food group mapping (must not drift)
export const FOOD5 = Object.freeze({
  1: Object.freeze({
    id: 1,
    key: 'g1',
    labelTH: 'หมู่ 1 โปรตีน',
    descTH: 'เนื้อ นม ไข่ ถั่วเมล็ดแห้ง',
    // NOTE: keep emojis kid-friendly + obvious
    emojis: Object.freeze(['🥚','🥛','🍗','🍖','🐟','🫘','🥜','🧀'])
  }),
  2: Object.freeze({
    id: 2,
    key: 'g2',
    labelTH: 'หมู่ 2 คาร์โบไฮเดรต',
    descTH: 'ข้าว แป้ง เผือก มัน น้ำตาล',
    emojis: Object.freeze(['🍚','🍞','🥖','🍜','🍝','🥔','🍠','🥟'])
  }),
  3: Object.freeze({
    id: 3,
    key: 'g3',
    labelTH: 'หมู่ 3 ผัก',
    descTH: 'ผักสีเขียว เหลือง และหลากสี',
    emojis: Object.freeze(['🥦','🥬','🥒','🌽','🥕','🍆','🫑','🍅'])
  }),
  4: Object.freeze({
    id: 4,
    key: 'g4',
    labelTH: 'หมู่ 4 ผลไม้',
    descTH: 'ผลไม้ให้วิตามินและใยอาหาร',
    emojis: Object.freeze(['🍎','🍌','🍊','🍉','🍇','🍍','🥭','🍓'])
  }),
  5: Object.freeze({
    id: 5,
    key: 'g5',
    labelTH: 'หมู่ 5 ไขมัน',
    descTH: 'ไขมันให้พลังงานและความอบอุ่น',
    // NOTE: some overlap allowed (e.g., 🧀, 🥜) but group id stays fixed
    emojis: Object.freeze(['🥑','🫒','🥥','🧈','🥜','🌰','🍳','🧀'])
  })
});

export const JUNK = Object.freeze({
  id: 0,
  key: 'junk',
  labelTH: 'ขยะอาหาร',
  descTH: 'หวาน/ทอด/น้ำอัดลม/ขนมกรุบกรอบ',
  emojis: Object.freeze(['🍟','🍔','🍕','🌭','🍩','🍪','🧁','🍰','🥤','🧋'])
});

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
export function pickEmoji(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return '❓';
  const r = (typeof rng === 'function') ? (Number(rng()) || 0) : Math.random();
  const i = Math.max(0, Math.min(a.length - 1, Math.floor(r * a.length)));
  return a[i];
}

export function labelForGroup(groupId){
  const id = Number(groupId) || 0;
  const g = FOOD5[id];
  return g ? g.labelTH : (id === 0 ? JUNK.labelTH : 'หมู่ ?');
}

export function emojiForGroup(rng, groupId){
  const id = Number(groupId) || 0;
  if(id === 0) return pickEmoji(rng, JUNK.emojis);
  const g = FOOD5[id];
  if(!g) return '🥦';
  return pickEmoji(rng, g.emojis);
}

// Key -> group object (g1..g5 or junk)
export function groupForKey(key){
  const k = String(key || '').toLowerCase().trim();
  if(!k) return null;
  if(k === 'junk') return JUNK;
  for(const id of [1,2,3,4,5]){
    if(FOOD5[id]?.key === k) return FOOD5[id];
  }
  return null;
}

export const allGroupIds = Object.freeze([1,2,3,4,5]);