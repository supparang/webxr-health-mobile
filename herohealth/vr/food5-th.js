// === /herohealth/vr/food5-th.js ===
// Thai Food 5 Groups Mapping (STABLE, DO NOT CHANGE)
// ✅ Exports: FOOD5, JUNK, pickEmoji, labelForGroup, descForGroup, emojiForGroup,
//            groupKey, isValidGroup, clampGroupId
// ✅ Supports seeded rng: pickEmoji(rngFn, arr)
// ✅ Group ids are fixed 1..5 per your rule

'use strict';

// ✅ Fixed Thai food group mapping (must not drift)
export const FOOD5 = Object.freeze({
  1: Object.freeze({
    id: 1,
    key: 'g1',
    labelTH: 'หมู่ 1 โปรตีน',
    descTH: 'เนื้อ นม ไข่ ถั่วเมล็ดแห้ง',
    // protein
    emojis: Object.freeze(['🥚','🥛','🍗','🍖','🐟','🫘','🥜','🧀'])
  }),
  2: Object.freeze({
    id: 2,
    key: 'g2',
    labelTH: 'หมู่ 2 คาร์โบไฮเดรต',
    descTH: 'ข้าว แป้ง เผือก มัน น้ำตาล',
    // carbs / starch
    emojis: Object.freeze(['🍚','🍞','🥖','🍜','🍝','🥔','🍠','🥟'])
  }),
  3: Object.freeze({
    id: 3,
    key: 'g3',
    labelTH: 'หมู่ 3 ผัก',
    descTH: 'ผักสีเขียว เหลือง และหลากสี',
    // vegetables
    emojis: Object.freeze(['🥦','🥬','🥒','🌽','🥕','🍆','🫑','🍅'])
  }),
  4: Object.freeze({
    id: 4,
    key: 'g4',
    labelTH: 'หมู่ 4 ผลไม้',
    descTH: 'ผลไม้ให้วิตามินและใยอาหาร',
    // fruits
    emojis: Object.freeze(['🍎','🍌','🍊','🍉','🍇','🍍','🥭','🍓'])
  }),
  5: Object.freeze({
    id: 5,
    key: 'g5',
    labelTH: 'หมู่ 5 ไขมัน',
    descTH: 'ไขมันให้พลังงานและความอบอุ่น',
    // fats (keep only “fat-ish” icons as much as possible)
    emojis: Object.freeze(['🥑','🫒','🥥','🧈','🌰','🥜'])
  })
});

// Junk foods (not a Thai food group; used as negative targets)
export const JUNK = Object.freeze({
  key: 'junk',
  labelTH: 'ขยะอาหาร',
  descTH: 'หวาน/ทอด/น้ำอัดลม/ขนมกรุบกรอบ',
  emojis: Object.freeze(['🍟','🍔','🍕','🌭','🍩','🍪','🧁','🍰','🥤','🧋'])
});

// ---------------- helpers ----------------

export function isValidGroup(groupId){
  const g = Number(groupId);
  return g >= 1 && g <= 5 && !!FOOD5[g];
}

export function clampGroupId(groupId, fallback=3){
  const g = Number(groupId);
  if(isValidGroup(g)) return g;
  return isValidGroup(fallback) ? Number(fallback) : 3;
}

export function groupKey(groupId){
  const g = FOOD5[clampGroupId(groupId)];
  return g ? g.key : 'g3';
}

export function labelForGroup(groupId){
  const g = FOOD5[clampGroupId(groupId)];
  return g ? g.labelTH : 'หมู่ ?';
}

export function descForGroup(groupId){
  const g = FOOD5[clampGroupId(groupId)];
  return g ? g.descTH : '';
}

// rng can be: function()->[0,1) OR any falsy -> Math.random
export function pickEmoji(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return '❓';

  const r = (typeof rng === 'function') ? rng() : Math.random();
  const i = Math.max(0, Math.min(a.length - 1, Math.floor(r * a.length)));
  return a[i];
}

export function emojiForGroup(rng, groupId){
  const g = FOOD5[clampGroupId(groupId)];
  if(!g) return '🥦';
  return pickEmoji(rng, g.emojis);
}

export function emojiForJunk(rng){
  return pickEmoji(rng, JUNK.emojis);
}