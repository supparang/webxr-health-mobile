// === /herohealth/vr/food5-th.js ===
// FOOD 5 Groups (TH) — Canonical Mapping (Do NOT change)
// หมู่ 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
// หมู่ 2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)
// หมู่ 3 ผัก
// หมู่ 4 ผลไม้
// หมู่ 5 ไขมัน
//
// Exports:
//   FOOD5, JUNK
//   pickEmoji(rng, arr)
//   labelForGroup(gid)
//   emojiForGroup(rng, gid)

'use strict';

// ---------- RNG-safe picker ----------
export function pickEmoji(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return '❓';
  const r = (typeof rng === 'function') ? rng() : Math.random();
  const i = Math.max(0, Math.min(a.length - 1, Math.floor(r * a.length)));
  return a[i];
}

// ---------- Canonical labels ----------
export const FOOD5 = Object.freeze({
  g1: Object.freeze({
    id: 1,
    key: 'g1',
    labelTH: 'หมู่ 1 โปรตีน',
    descTH: 'เนื้อ นม ไข่ ถั่วเมล็ดแห้ง',
    emojis: Object.freeze(['🥚','🥛','🐟','🍗','🥩','🫘','🧀','🍤'])
  }),
  g2: Object.freeze({
    id: 2,
    key: 'g2',
    labelTH: 'หมู่ 2 คาร์โบไฮเดรต',
    descTH: 'ข้าว แป้ง เผือก มัน น้ำตาล',
    emojis: Object.freeze(['🍚','🍞','🍜','🥖','🥔','🍠','🥨','🍘'])
  }),
  g3: Object.freeze({
    id: 3,
    key: 'g3',
    labelTH: 'หมู่ 3 ผัก',
    descTH: 'ผักใบเขียว/สีต่าง ๆ',
    emojis: Object.freeze(['🥦','🥬','🥒','🍅','🥕','🌽','🫑','🍆'])
  }),
  g4: Object.freeze({
    id: 4,
    key: 'g4',
    labelTH: 'หมู่ 4 ผลไม้',
    descTH: 'ผลไม้สารอาหารมากมาย',
    emojis: Object.freeze(['🍌','🍎','🍊','🍇','🍉','🍓','🥭','🍍'])
  }),
  g5: Object.freeze({
    id: 5,
    key: 'g5',
    labelTH: 'หมู่ 5 ไขมัน',
    descTH: 'ไขมันให้พลังงาน/ความอบอุ่น',
    emojis: Object.freeze(['🥑','🫒','🥥','🧈','🌰','🥜','🍶','🛢️'])
  })
});

// ---------- Junk pack (for GoodJunk) ----------
export const JUNK = Object.freeze({
  key: 'junk',
  labelTH: 'ของหวาน/ทอด/น้ำอัดลม',
  descTH: 'เลี่ยงของทอด หวาน เค็มจัด',
  emojis: Object.freeze(['🍟','🍔','🍕','🌭','🍩','🧁','🍪','🍫','🥤','🍿'])
});

// ---------- Helpers ----------
export function labelForGroup(gid){
  const id = Number(gid)||1;
  if(id===1) return FOOD5.g1.labelTH;
  if(id===2) return FOOD5.g2.labelTH;
  if(id===3) return FOOD5.g3.labelTH;
  if(id===4) return FOOD5.g4.labelTH;
  if(id===5) return FOOD5.g5.labelTH;
  return FOOD5.g1.labelTH;
}

export function emojiForGroup(rng, gid){
  const id = Number(gid)||1;
  const pack =
    (id===1) ? FOOD5.g1 :
    (id===2) ? FOOD5.g2 :
    (id===3) ? FOOD5.g3 :
    (id===4) ? FOOD5.g4 :
    FOOD5.g5;
  return pickEmoji(rng, pack.emojis);
}