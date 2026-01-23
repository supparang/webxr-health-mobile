// === /herohealth/vr/food5-th.js ===
// Thai Food 5 Groups — shared icon set (HHA Standard)
// mapping (fixed):
// 1 protein (meat/milk/egg/beans), 2 carbs, 3 veg, 4 fruit, 5 fat

export const FOOD5 = [
  { id: 1, key: 'protein', labelTH: 'หมู่ 1 โปรตีน', emojis: ['🥩','🍗','🐟','🥚','🥛','🫘','🧀'] },
  { id: 2, key: 'carbs',   labelTH: 'หมู่ 2 คาร์โบไฮเดรต', emojis: ['🍚','🍞','🍜','🥔','🍠','🥖','🥨'] },
  { id: 3, key: 'veg',     labelTH: 'หมู่ 3 ผัก', emojis: ['🥦','🥬','🥕','🥒','🌽','🍅'] },
  { id: 4, key: 'fruit',   labelTH: 'หมู่ 4 ผลไม้', emojis: ['🍎','🍌','🍊','🍉','🍇','🍍','🥭'] },
  { id: 5, key: 'fat',     labelTH: 'หมู่ 5 ไขมัน', emojis: ['🥑','🧈','🫒','🥥','🌰'] },
];

export const JUNK = {
  labelTH: 'ของหวาน/ทอด',
  emojis: ['🍟','🍔','🍩','🍪','🧁','🍰','🍫','🥤','🍦']
};

export function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function pickEmoji(rng, arr){
  const a = arr && arr.length ? arr : ['❓'];
  const i = Math.floor((rng ? rng() : Math.random()) * a.length);
  return a[Math.max(0, Math.min(a.length-1, i))];
}

export function emojiForGroup(rng, groupId){
  const g = FOOD5.find(x=>x.id===Number(groupId)) || FOOD5[0];
  return pickEmoji(rng, g.emojis);
}

export function labelForGroup(groupId){
  const g = FOOD5.find(x=>x.id===Number(groupId));
  return g ? g.labelTH : 'หมู่ ?';
}