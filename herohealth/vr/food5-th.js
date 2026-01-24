// === /herohealth/vr/food5-th.js ===
// Thai Food 5 Groups (fixed mapping) + helpers
// Group 1 โปรตีน, 2 คาร์บ, 3 ผัก, 4 ผลไม้, 5 ไขมัน

export const FOOD5 = {
  1: { id:1, key:'g1', labelTH:'หมู่ 1 โปรตีน', emojis:['🥚','🥛','🐟','🍗','🫘','🧀'] },
  2: { id:2, key:'g2', labelTH:'หมู่ 2 คาร์โบไฮเดรต', emojis:['🍚','🍞','🥔','🍠','🥨','🍜'] },
  3: { id:3, key:'g3', labelTH:'หมู่ 3 ผัก', emojis:['🥦','🥬','🥕','🌽','🍅','🥒'] },
  4: { id:4, key:'g4', labelTH:'หมู่ 4 ผลไม้', emojis:['🍌','🍎','🍇','🍉','🍍','🍊'] },
  5: { id:5, key:'g5', labelTH:'หมู่ 5 ไขมัน', emojis:['🥑','🧈','🫒','🥜','🧀','🥥'] },
};

export const JUNK = {
  key:'junk',
  labelTH:'ขยะอาหาร (หวาน/ทอด/น้ำอัดลม)',
  emojis:['🍟','🍔','🍕','🍩','🍪','🧋','🥤','🍫']
};

export function pickEmoji(rng, arr){
  const r = (typeof rng === 'function') ? rng() : Math.random();
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return '❓';
  return a[Math.floor(r * a.length)] || a[0];
}

export function labelForGroup(gid){
  const g = FOOD5[Number(gid)] || FOOD5[1];
  return g.labelTH;
}

export function emojiForGroup(rng, gid){
  const g = FOOD5[Number(gid)] || FOOD5[1];
  return pickEmoji(rng, g.emojis);
}