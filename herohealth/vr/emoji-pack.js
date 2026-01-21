// === /herohealth/vr/emoji-pack.js ===
// HHA Emoji Pack — shared icons for all games
// ✅ Groups/Plate: 5-food-groups random emoji + rarity
// ✅ GoodJunk/Hydration: good vs junk pools
// ✅ Deterministic option: pass rng() seeded

export const HHA_EMOJI = {
  hud: {
    quest: "🎯",
    mini: "🧩",
    bonus: "⭐",
    fever: "🔥",
    time: "⏱️",
    end: "🏁",
    ok: "✅",
    miss: "❌",
    warn: "⚠️",
    shield: "🛡️",
    ai: "🧠",
    stats: "📊",
    party: "🎉",
  },

  // 5 หมู่: index 0..4
  groups: [
    // 0 Carb
    [
      { e:"🍚", w:6 }, { e:"🍞", w:6 }, { e:"🥖", w:4 },
      { e:"🍜", w:4 }, { e:"🥔", w:3 }, { e:"🌽", w:2 }
    ],
    // 1 Protein
    [
      { e:"🍗", w:6 }, { e:"🐟", w:5 }, { e:"🥚", w:5 },
      { e:"🥩", w:3 }, { e:"🫘", w:3 }, { e:"🥜", w:2 }
    ],
    // 2 Veg
    [
      { e:"🥦", w:6 }, { e:"🥬", w:4 }, { e:"🥕", w:5 },
      { e:"🍅", w:4 }, { e:"🥒", w:3 }, { e:"🌶️", w:2 }
    ],
    // 3 Fruit
    [
      { e:"🍎", w:6 }, { e:"🍌", w:5 }, { e:"🍇", w:4 },
      { e:"🍉", w:4 }, { e:"🍍", w:3 }, { e:"🍊", w:3 }
    ],
    // 4 Dairy
    [
      { e:"🥛", w:7 }, { e:"🧀", w:5 }, { e:"🥣", w:3 }, { e:"🍼", w:2 }
    ],
  ],

  good: [
    { e:"🥗", w:6 }, { e:"🍲", w:5 }, { e:"🍱", w:4 },
    { e:"🍌", w:4 }, { e:"🥛", w:3 }, { e:"💧", w:3 }
  ],

  junk: [
    { e:"🍟", w:7 }, { e:"🍔", w:6 }, { e:"🍕", w:5 },
    { e:"🌭", w:4 }, { e:"🍩", w:6 }, { e:"🍰", w:4 },
    { e:"🧋", w:7 }, { e:"🥤", w:5 }
  ],

  water: [
    { e:"💧", w:8 }, { e:"🚰", w:6 }, { e:"🫗", w:4 }, { e:"🌊", w:2 }
  ]
};

export function pickWeighted(list, rng=Math.random){
  let sum = 0;
  for(const it of list) sum += (it.w||1);
  let r = rng() * sum;
  for(const it of list){
    r -= (it.w||1);
    if(r <= 0) return it.e;
  }
  return list[list.length-1]?.e || "❓";
}

// For groups/plate: pick emoji by groupIndex 0..4
export function pickGroupEmoji(groupIndex, rng=Math.random){
  const pool = HHA_EMOJI.groups[groupIndex] || [];
  return pickWeighted(pool, rng);
}

export function pickGoodEmoji(rng=Math.random){
  return pickWeighted(HHA_EMOJI.good, rng);
}

export function pickJunkEmoji(rng=Math.random){
  return pickWeighted(HHA_EMOJI.junk, rng);
}

export function pickWaterEmoji(rng=Math.random){
  return pickWeighted(HHA_EMOJI.water, rng);
}