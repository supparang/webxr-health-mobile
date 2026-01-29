// === /herohealth/vr/food5-th.js ===
// Thai Food 5 Groups Mapping (STABLE, DO NOT CHANGE)
// --------------------------------------------------
// ✅ Exports: FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup, groupIdFromIndex
// ✅ Supports seeded rng: pickEmoji(rng, arr)
// ✅ Group ids are fixed 1..5 per your rule (ห้ามแปลผัน)
// ✅ groupIndex (0..4) -> groupId (1..5) helper
// --------------------------------------------------

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
    emojis: Object.freeze(['🥑','🫒','🥥','🧈','🌰','🥜','🧀','🍳'])
  })
});

// “ขยะอาหาร” (หวาน/ทอด/น้ำอัดลม/ขนมกรุบกรอบ)
export const JUNK = Object.freeze({
  key: 'junk',
  labelTH: 'ขยะอาหาร',
  descTH: 'หวาน/ทอด/น้ำอัดลม/ขนมกรุบกรอบ',
  emojis: Object.freeze(['🍟','🍔','🍕','🌭','🍩','🍪','🧁','🍰','🥤','🧋'])
});

/* ------------------------------------------------
 * Helpers
 * ------------------------------------------------ */
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

// groupIndex: 0..4  -> groupId: 1..5
export function groupIdFromIndex(groupIndex){
  const gi = Number(groupIndex);
  if(!isFinite(gi)) return 1;
  return Math.max(1, Math.min(5, Math.floor(gi) + 1));
}

// เลือก emoji ให้ตรงหมู่ (ใช้ rng ที่ seed มาได้)
export function emojiForGroup(rng, groupIdOrIndex){
  // รับได้ทั้ง groupId(1..5) หรือ groupIndex(0..4)
  let gid = Number(groupIdOrIndex);
  if(!isFinite(gid)) gid = 1;

  // ถ้าเผลอส่ง 0..4 มา ให้ map เป็น 1..5
  if(gid >= 0 && gid <= 4) gid = groupIdFromIndex(gid);

  const g = FOOD5[gid];
  if(!g) return '🥦';
  return pickEmoji(rng, g.emojis);
}