// === /herohealth/vr/hha-emoji-pack.js ===
// HHA Emoji Pack — STANDARD (shared across games)
// Goal: variety (not boring) + consistent meaning across 4 games

export const HHA_EMOJI = {
  // 5 food groups (Plate + Groups)
  groups: {
    // 1) ข้าว-แป้ง-ธัญพืช
    g1: ['🍚','🍞','🥖','🥔','🍜','🥨','🌽','🥯'],
    // 2) ผัก
    g2: ['🥦','🥕','🥬','🥒','🍅','🫑','🍆','🌶️'],
    // 3) ผลไม้
    g3: ['🍎','🍌','🍇','🍉','🍓','🍍','🥭','🍊'],
    // 4) โปรตีน (เนื้อ/ปลา/ไข่/ถั่ว)
    g4: ['🐟','🍗','🥚','🫘','🥜','🧆','🍤','🥩'],
    // 5) นม/ผลิตภัณฑ์นม
    g5: ['🥛','🧀','🥣','🍦','🧈','🍼']
  },

  // Junk (GoodJunk + Plate/Groups as “หลอก”)
  junk: ['🍟','🍔','🍕','🍩','🍪','🍬','🧋','🥤','🍗','🌭'],

  // Hydration
  water: ['💧','🚰','🫗','🥤'],

  // Generic FX / badges (optional)
  fx: {
    star: '⭐',
    shield: '🛡️',
    warn: '⚠️',
    goal: '🎯',
    plate: '🍽️'
  }
};

// deterministic picker (seeded)
export function pickFrom(list, rng){
  if(!list || !list.length) return '';
  const i = Math.floor((rng ? rng() : Math.random()) * list.length);
  return list[Math.max(0, Math.min(list.length-1, i))];
}