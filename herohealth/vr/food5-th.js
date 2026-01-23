// === /herohealth/vr/food5-th.js ===
// Thai Food 5 Groups mapping (fixed)
// หมู่ 1 โปรตีน, หมู่ 2 คาร์โบไฮเดรต, หมู่ 3 ผัก, หมู่ 4 ผลไม้, หมู่ 5 ไขมัน

export const FOOD5 = [
  null,
  { id:1, labelTH:'หมู่ 1 โปรตีน', emojis:['🍗','🥚','🥛','🫘','🐟'] },
  { id:2, labelTH:'หมู่ 2 คาร์โบไฮเดรต', emojis:['🍚','🍞','🥔','🍠','🍜'] },
  { id:3, labelTH:'หมู่ 3 ผัก', emojis:['🥦','🥬','🥕','🍅','🥒'] },
  { id:4, labelTH:'หมู่ 4 ผลไม้', emojis:['🍎','🍌','🍇','🍉','🍊'] },
  { id:5, labelTH:'หมู่ 5 ไขมัน', emojis:['🥑','🫒','🥥','🧈','🥜'] }
];

export const JUNK = {
  labelTH:'ขยะอาหาร (หวาน/ทอด/น้ำอัดลม)',
  emojis:['🍟','🍔','🍕','🍩','🍪','🧁','🍫','🥤']
};

export function pickEmoji(rng, arr){
  const r = (typeof rng === 'function') ? rng() : Math.random();
  const i = Math.max(0, Math.min(arr.length-1, Math.floor(r * arr.length)));
  return arr[i] || arr[0] || '❓';
}

export function labelForGroup(groupId){
  const g = FOOD5[Number(groupId)||1];
  return g ? g.labelTH : 'หมู่ 1 โปรตีน';
}

export function emojiForGroup(rng, groupId){
  const g = FOOD5[Number(groupId)||1] || FOOD5[1];
  return pickEmoji(rng, g.emojis);
}