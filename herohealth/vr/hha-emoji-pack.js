// === /herohealth/vr/hha-emoji-pack.js ===
// HHA Emoji Pack — PRODUCTION (Adapter)
// ✅ Keeps old API used by games: HHA_EMOJI, pickFrom
// ✅ Uses stable Thai mapping from food5-th.js (single source of truth)
// ✅ Deterministic-friendly: pickFrom(arr, rngFn)

'use strict';

import { FOOD5, JUNK, pickEmoji } from './food5-th.js';

// เกมอื่น ๆ ของคุณเรียกแบบ: pickFrom(HHA_EMOJI.g3, rng)
// ให้รองรับทั้ง pickFrom(arr, rngFn) และ pickFrom(arr) ได้เหมือนเดิม
export function pickFrom(arr, rng){
  return pickEmoji(rng, arr);
}

// ✅ HHA_EMOJI: keys ที่เกมใช้อยู่แล้ว (g1..g5, junk)
// ตรงนี้ “ห้ามแปลผัน” เพราะผูกกับกติกาวิจัย+คอนเทนต์
export const HHA_EMOJI = Object.freeze({
  g1: Object.freeze([ ...(FOOD5[1]?.emojis || ['🍗']) ]),
  g2: Object.freeze([ ...(FOOD5[2]?.emojis || ['🍚']) ]),
  g3: Object.freeze([ ...(FOOD5[3]?.emojis || ['🥦']) ]),
  g4: Object.freeze([ ...(FOOD5[4]?.emojis || ['🍎']) ]),
  g5: Object.freeze([ ...(FOOD5[5]?.emojis || ['🥑']) ]),
  junk: Object.freeze([ ...(JUNK?.emojis || ['🍟']) ]),

  // (option) alias เผื่อบางเกมเรียก fat/oil
  fat:  Object.freeze([ ...(FOOD5[5]?.emojis || ['🥑']) ]),
  carb: Object.freeze([ ...(FOOD5[2]?.emojis || ['🍚']) ]),
  veg:  Object.freeze([ ...(FOOD5[3]?.emojis || ['🥦']) ]),
  fruit:Object.freeze([ ...(FOOD5[4]?.emojis || ['🍎']) ]),
  prot: Object.freeze([ ...(FOOD5[1]?.emojis || ['🍗']) ]),
});

// ✅ helpers เพิ่มเติม (ถ้าอยากใช้ใน Plate/Groups/GoodJunk)
export const GROUP_KEYS = Object.freeze(['g1','g2','g3','g4','g5']);
export const GROUP_BADGES = Object.freeze(['🍗','🍚','🥦','🍎','🥑']); // 1 ตัว/หมู่ สำหรับ “ยังขาด: …”
export const JUNK_KEY = 'junk';

export function emojiByKey(rng, key){
  const arr = HHA_EMOJI[key] || ['❓'];
  return pickFrom(arr, rng);
}

export function emojiByGroupIndex(rng, groupIndex){ // 0..4
  const key = GROUP_KEYS[groupIndex] || 'g1';
  return emojiByKey(rng, key);
}