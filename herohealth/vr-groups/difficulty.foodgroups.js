// === /herohealth/vr-groups/difficulty.foodgroups.js ===
// Food Groups VR — Difficulty Table (แนะนำ tuning v1)

(function (ns) {
  'use strict';

  const table = {
    easy: {
      spawnInterval: 1300,   // ms: มาช้า
      lifetime:      2800,   // ms: อยู่จอนาน
      maxActive:     3,
      scale:         1.25,
      feverGainHit:  8,
      feverLossMiss: 12,
      questTarget:   4
    },
    normal: {
      spawnInterval: 1000,
      lifetime:      2200,
      maxActive:     4,
      scale:         1.0,
      feverGainHit:  7,
      feverLossMiss: 16,
      questTarget:   5
    },
    hard: {
      spawnInterval: 800,
      lifetime:      1900,
      maxActive:     5,
      scale:         0.9,
      feverGainHit:  6,
      feverLossMiss: 22,
      questTarget:   6
    }
  };

  ns.foodGroupsDifficulty = {
    get (key) {
      key = String(key || 'normal').toLowerCase();
      return table[key] || table.normal;
    }
  };

})(window.HeroHealth = window.HeroHealth || {});
