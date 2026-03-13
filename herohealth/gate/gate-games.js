// === /herohealth/gate/gate-games.js ===
// HeroHealth Gate Game Registry
// FULL PATCH v20260312g-ALL-ZONES-GATE-GAMES-TH-EXERCISE-SYNC

export const GATE_GAMES = {
  // =========================
  // HYGIENE ZONE
  // =========================
  bath: {
    cat: 'hygiene',
    label: 'Bath',
    theme: 'bath',
    warmupTitle: 'Bath Clean Hunt',
    cooldownTitle: 'Bath Calm Bubbles',
    files: {
      warmup: './games/bath/warmup.js',
      cooldown: './games/bath/cooldown.js',
      style: './games/bath/style.css'
    }
  },

  handwash: {
    cat: 'hygiene',
    label: 'Handwash',
    theme: 'handwash',
    warmupTitle: 'Handwash Quick Prep',
    cooldownTitle: 'Handwash Calm Check',
    files: {
      warmup: './games/handwash/warmup.js',
      cooldown: './games/handwash/cooldown.js',
      style: './games/handwash/style.css'
    }
  },

  brush: {
    cat: 'hygiene',
    label: 'Brush',
    theme: 'brush',
    warmupTitle: 'Brush Quick Prep',
    cooldownTitle: 'Brush Calm Check',
    files: {
      warmup: './games/brush/warmup.js',
      cooldown: './games/brush/cooldown.js',
      style: './games/brush/style.css'
    }
  },

  maskcough: {
    cat: 'hygiene',
    label: 'Mask & Cough',
    theme: 'maskcough',
    warmupTitle: 'Mask & Cough Quick Prep',
    cooldownTitle: 'Calm Air Check',
    files: {
      warmup: './games/maskcough/warmup.js',
      cooldown: './games/maskcough/cooldown.js',
      style: './games/maskcough/style.css'
    }
  },

  germdetective: {
    cat: 'hygiene',
    label: 'Germ Detective',
    theme: 'germdetective',
    warmupTitle: 'Germ Detective Quick Scan',
    cooldownTitle: 'Safe Bubble Review',
    files: {
      warmup: './games/germdetective/warmup.js',
      cooldown: './games/germdetective/cooldown.js',
      style: './games/germdetective/style.css'
    }
  },

  cleanobjects: {
    cat: 'hygiene',
    label: 'Clean Objects',
    theme: 'cleanobjects',
    warmupTitle: 'Clean Objects Quick Check',
    cooldownTitle: 'Clean Bubble Review',
    files: {
      warmup: './games/cleanobjects/warmup.js',
      cooldown: './games/cleanobjects/cooldown.js',
      style: './games/cleanobjects/style.css'
    }
  },

  // =========================
  // NUTRITION ZONE
  // =========================
  goodjunk: {
    cat: 'nutrition',
    label: 'GoodJunk',
    theme: 'goodjunk',
    warmupTitle: 'GoodJunk Quick Prep',
    cooldownTitle: 'Healthy Choice Review',
    files: {
      warmup: './games/goodjunk/warmup.js',
      cooldown: './games/goodjunk/cooldown.js',
      style: './games/goodjunk/style.css'
    }
  },

  groups: {
    cat: 'nutrition',
    label: 'Food Groups',
    theme: 'groups',
    warmupTitle: 'Food Groups Quick Prep',
    cooldownTitle: 'Food Group Review',
    files: {
      warmup: './games/groups/warmup.js',
      cooldown: './games/groups/cooldown.js',
      style: './games/groups/style.css'
    }
  },

  hydration: {
    cat: 'nutrition',
    label: 'Hydration',
    theme: 'hydration',
    warmupTitle: 'Hydration Quick Prep',
    cooldownTitle: 'Water Balance Review',
    files: {
      warmup: './games/hydration/warmup.js',
      cooldown: './games/hydration/cooldown.js',
      style: './games/hydration/style.css'
    }
  },

  plate: {
    cat: 'nutrition',
    label: 'Plate',
    theme: 'plate',
    warmupTitle: 'Balanced Plate Quick Prep',
    cooldownTitle: 'Balanced Plate Review',
    files: {
      warmup: './games/plate/warmup.js',
      cooldown: './games/plate/cooldown.js',
      style: './games/plate/style.css'
    }
  },

  // =========================
  // EXERCISE ZONE
  // =========================
  jumpduck: {
    cat: 'exercise',
    label: 'Jump Duck',
    theme: 'jumpduck',
    warmupTitle: 'ซ้อมกระโดด-ย่อ',
    cooldownTitle: 'ยืดขาหลังเล่น',
    files: {
      warmup: './games/jumpduck/warmup.js?v=20260312e',
      cooldown: './games/jumpduck/cooldown.js?v=20260312e',
      style: './games/jumpduck/style.css?v=20260312c'
    }
  },

  shadowbreaker: {
    cat: 'exercise',
    label: 'Shadow Breaker',
    theme: 'shadowbreaker',
    warmupTitle: 'ซ้อมหลบเร็ว',
    cooldownTitle: 'หายใจให้ช้าลง',
    files: {
      warmup: './games/shadowbreaker/warmup.js?v=20260312f',
      cooldown: './games/shadowbreaker/cooldown.js?v=20260312f',
      style: './games/shadowbreaker/style.css?v=20260312f'
    }
  },

  rhythmboxer: {
    cat: 'exercise',
    label: 'Rhythm Boxer',
    theme: 'rhythmboxer',
    warmupTitle: 'ซ้อมต่อยตามจังหวะ',
    cooldownTitle: 'หายใจผ่อนคลาย',
    files: {
      warmup: './games/rhythmboxer/warmup.js?v=20260312f',
      cooldown: './games/rhythmboxer/cooldown.js?v=20260312f',
      style: './games/rhythmboxer/style.css?v=20260312f'
    }
  },

  balancehold: {
    cat: 'exercise',
    label: 'Balance Hold',
    theme: 'balancehold',
    warmupTitle: 'ซ้อมทรงตัว',
    cooldownTitle: 'ผ่อนคลายช้า ๆ',
    files: {
      warmup: './games/balancehold/warmup.js?v=20260312f',
      cooldown: './games/balancehold/cooldown.js?v=20260312f',
      style: './games/balancehold/style.css?v=20260312f'
    }
  },

  fitnessplanner: {
    cat: 'exercise',
    label: 'Fitness Planner',
    theme: 'fitnessplanner',
    warmupTitle: 'ปลุกร่างกาย',
    cooldownTitle: 'ทบทวนความรู้สึก',
    files: {
      warmup: './games/fitnessplanner/warmup.js?v=20260312f',
      cooldown: './games/fitnessplanner/cooldown.js?v=20260312f',
      style: './games/fitnessplanner/style.css?v=20260312f'
    }
  }
};

export const GAME_ALIASES = {
  'jump-duck': 'jumpduck',
  'jump_duck': 'jumpduck',
  'jump duck': 'jumpduck',

  'shadow-breaker': 'shadowbreaker',
  'shadow_breaker': 'shadowbreaker',
  'shadow breaker': 'shadowbreaker',

  'rhythm-boxer': 'rhythmboxer',
  'rhythm_boxer': 'rhythmboxer',
  'rhythm boxer': 'rhythmboxer',

  'balance-hold': 'balancehold',
  'balance_hold': 'balancehold',
  'balance hold': 'balancehold',

  'fitness-planner': 'fitnessplanner',
  'fitness_planner': 'fitnessplanner',
  'fitness planner': 'fitnessplanner',

  'clean-objects': 'cleanobjects',
  'clean_objects': 'cleanobjects',

  'germ-detective': 'germdetective',
  'germ_detective': 'germdetective',

  'mask-cough': 'maskcough',
  'mask_cough': 'maskcough',

  'good-junk': 'goodjunk',
  'good_junk': 'goodjunk'
};

export function normalizeGameId(game) {
  const key = String(game || '').trim().toLowerCase();
  return GAME_ALIASES[key] || key;
}

export function getGameMeta(game) {
  return GATE_GAMES[normalizeGameId(game)] || null;
}

export function getGameFiles(game) {
  const meta = getGameMeta(game);
  return meta?.files || null;
}

export function getPhaseFile(game, phase = 'warmup') {
  const files = getGameFiles(game);
  if (!files) return null;
  return String(phase || '').toLowerCase() === 'cooldown'
    ? files.cooldown
    : files.warmup;
}

export function getGameStyleFile(game) {
  const files = getGameFiles(game);
  return files?.style || null;
}

export function listGateGames() {
  return Object.keys(GATE_GAMES);
}

export function listGateGamesByCat(cat = '') {
  const target = String(cat || '').trim().toLowerCase();
  return Object.entries(GATE_GAMES)
    .filter(([, meta]) => String(meta?.cat || '').toLowerCase() === target)
    .map(([key]) => key);
}