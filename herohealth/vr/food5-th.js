// === /herohealth/vr/food5-th.js ===
// Thai Food 5 Groups Mapping (STABLE, DO NOT CHANGE)
// ✅ Exports: FOOD5, JUNK, pickEmoji, labelForGroup, descForGroup, emojiForGroup, groupIdFromIndex
// ✅ Supports seeded rng: pickEmoji(rng, arr) / emojiForGroup(rng, groupId)
// ✅ Group ids are fixed 1..5 per your rule (ห้ามแปลผัน)
//
// หมู่ 1 โปรตีน: เนื้อ นม ไข่ ถั่วเมล็ดแห้ง
// หมู่ 2 คาร์โบไฮเดรต: ข้าว แป้ง เผือก มัน น้ำตาล
// หมู่ 3 ผัก
// หมู่ 4 ผลไม้
// หมู่ 5 ไขมัน
//
// JUNK: หวาน/ทอด/น้ำอัดลม/ขนมกรุบกรอบ

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
    // หมายเหตุ: ไขมันบางตัว emoji อาจซ้ำกับโปรตีน/นมได้ แต่ถือเป็น “ชุดไอคอน” สำหรับเกม
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

// ---------- helpers ----------
function safeArr(arr){
  return Array.isArray(arr) ? arr : [];
}

export function pickEmoji(rng, arr){
  const a = safeArr(arr);
  if(!a.length) return '❓';
  const r = (typeof rng === 'function') ? Number(rng()) : Math.random();
  const rr = Number.isFinite(r) ? r : Math.random();
  const i = Math.max(0, Math.min(a.length - 1, Math.floor(rr * a.length)));
  return a[i];
}

export function labelForGroup(groupId){
  const g = FOOD5[groupId];
  return g ? g.labelTH : (groupId === 0 ? JUNK.labelTH : 'หมู่ ?');
}

export function descForGroup(groupId){
  const g = FOOD5[groupId];
  return g ? g.descTH : (groupId === 0 ? JUNK.descTH : '');
}

export function emojiForGroup(rng, groupId){
  if(groupId === 0) return pickEmoji(rng, JUNK.emojis);
  const g = FOOD5[groupId];
  if(!g) return '🥦';
  return pickEmoji(rng, g.emojis);
}

// บาง engine ส่ง groupIndex 0..4 มา (เช่น mode-factory) ให้แปลงเป็น 1..5
export function groupIdFromIndex(groupIndex){
  const i = Math.floor(Number(groupIndex) || 0);
  // 0->1, 1->2, ... 4->5
  return Math.max(1, Math.min(5, i + 1));
}