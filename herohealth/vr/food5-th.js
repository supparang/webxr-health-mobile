// === /herohealth/vr/food5-th.js ===
// Thai Food 5 Groups Mapping (STABLE, DO NOT CHANGE)
// ✅ Exports: FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup, groupIdFromIndex0
// ✅ Supports seeded rng: pickEmoji(rng, arr) / emojiForGroup(rng, groupId)
// ✅ Group ids are fixed 1..5 per your rule (DO NOT DRIFT)

'use strict';

// ✅ Fixed Thai food group mapping (must not drift)
export const FOOD5 = Object.freeze({
  1: Object.freeze({
    id: 1,
    key: 'g1',
    labelTH: 'หมู่ 1 โปรตีน',
    descTH: 'เนื้อ นม ไข่ ถั่วเมล็ดแห้ง',
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
    emojis: Object.freeze(['🥑','🫒','🥥','🧈','🥜','🌰','🍳','🧀'])
  })
});

export const JUNK = Object.freeze({
  key: 'junk',
  labelTH: 'ขยะอาหาร',
  descTH: 'หวาน/ทอด/น้ำอัดลม/ขนมกรุบกรอบ',
  emojis: Object.freeze(['🍟','🍔','🍕','🌭','🍩','🍪','🧁','🍰','🥤','🧋'])
});

// --- helpers ---
export function pickEmoji(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return '❓';
  const r = (typeof rng === 'function') ? rng() : Math.random();
  const i = Math.max(0, Math.min(a.length - 1, Math.floor(r * a.length)));
  return a[i];
}

export function labelForGroup(groupId){
  const g = FOOD5[groupId];
  return g ? g.labelTH : 'หมู่ ?';
}

export function emojiForGroup(rng, groupId){
  const g = FOOD5[groupId];
  if(!g) return '🥦';
  return pickEmoji(rng, g.emojis);
}

// convenience: convert 0..4 -> 1..5 (used by spawners)
export function groupIdFromIndex0(idx0){
  const i = Number(idx0);
  if(!isFinite(i)) return 1;
  const n = Math.max(0, Math.min(4, Math.floor(i)));
  return n + 1;
}