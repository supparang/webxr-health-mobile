// === /herohealth/vr/food5-th.js ===
// Thai Food 5 Groups Mapping (STABLE, DO NOT CHANGE)
// ✅ Exports: FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup, groupForEmoji
// ✅ Supports seeded rng: pickEmoji(rngFn, arr)
// ✅ Group ids are fixed 1..5 (ตามกติกาไทย: อย่าได้แปลผัน)

'use strict';

// ✅ Fixed Thai food group mapping (must not drift)
export const FOOD5 = Object.freeze({
  1: Object.freeze({
    id: 1,
    key: 'g1',
    labelTH: 'หมู่ 1 โปรตีน',
    descTH: 'เนื้อ นม ไข่ ถั่วเมล็ดแห้ง',
    // NOTE: emoji set can expand, but group id meaning must not change
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
    emojis: Object.freeze(['🥑','🫒','🥥','🧈','🌰','🥜','🍳','🧀'])
  })
});

// Junk / ultra-processed / sweet / fried / soda
export const JUNK = Object.freeze({
  key: 'junk',
  labelTH: 'ขยะอาหาร',
  descTH: 'หวาน/ทอด/น้ำอัดลม/ขนมกรุบกรอบ',
  emojis: Object.freeze(['🍟','🍔','🍕','🌭','🍩','🍪','🧁','🍰','🥤','🧋','🍫'])
});

// -----------------------------
// helpers
// -----------------------------
export function pickEmoji(rngFn, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return '❓';
  const r = (typeof rngFn === 'function') ? rngFn() : Math.random();
  const i = Math.max(0, Math.min(a.length - 1, Math.floor(r * a.length)));
  return a[i];
}

export function labelForGroup(groupId){
  const g = FOOD5[groupId];
  return g ? g.labelTH : 'หมู่ ?';
}

export function emojiForGroup(rngFn, groupId){
  const g = FOOD5[groupId];
  if(!g) return '🥦';
  return pickEmoji(rngFn, g.emojis);
}

// optional: infer group by emoji (useful for GoodJunk/Groups if you ever need reverse mapping)
export function groupForEmoji(emoji){
  const e = String(emoji || '');
  for(const id of [1,2,3,4,5]){
    const g = FOOD5[id];
    if(g && Array.isArray(g.emojis) && g.emojis.includes(e)) return id;
  }
  if(JUNK.emojis.includes(e)) return 'junk';
  return null;
}