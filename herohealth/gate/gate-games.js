// === /herohealth/gate/gate-games.js ===
// HeroHealth Gate Game Registry
// FULL PATCH v20260312c-ALL-ZONES-GATE-GAMES

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
    warmupTitle: 'Quick Feet Prep',
    cooldownTitle: 'Leg Stretch Stars',
    files: {
      warmup: './games/jumpduck/warmup.js?v=20260312c',
      cooldown: './games/jumpduck/cooldown.js?v=20260312c',
      style: './games/jumpduck/style.css?v=20260312c'
    }
  },

  shadowbreaker: {
    cat: 'exercise',
    label: 'Shadow Breaker',
    theme: 'shadowbreaker',
    warmupTitle: 'Light Dodge Prep',
    cooldownTitle: 'Energy Fade',
    files: {
      warmup: './games/shadowbreaker/warmup.js',
      cooldown: './games/shadowbreaker/cooldown.js',
      style: './games/shadowbreaker/style.css'
    }
  },

  rhythmboxer: {
    cat: 'exercise',
    label: 'Rhythm Boxer',
    theme: 'rhythmboxer',
    warmupTitle: 'Shoulder Roll Beat',
    cooldownTitle: 'Calm Breathing Rings',
    files: {
      warmup: './games/rhythmboxer/warmup.js',
      cooldown: './games/rhythmboxer/cooldown.js',
      style: './games/rhythmboxer/style.css'
    }
  },

  balancehold: {
    cat: 'exercise',
    label: 'Balance Hold',
    theme: 'balancehold',
    warmupTitle: 'Core Activate',
    cooldownTitle: 'Slow Sway Relax',
    files: {
      warmup: './games/balancehold/warmup.js',
      cooldown: './games/balancehold/cooldown.js',
      style: './games/balancehold/style.css'
    }
  },

  fitnessplanner: {
    cat: 'exercise',
    label: 'Fitness Planner',
    theme: 'fitnessplanner',
    warmupTitle: 'Body Wake Flow',
    cooldownTitle: 'Mindful Reflection',
    files: {
      warmup: './games/fitnessplanner/warmup.js',
      cooldown: './games/fitnessplanner/cooldown.js',
      style: './games/fitnessplanner/style.css'
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