// === /herohealth/gate/gate-games.js ===
// HeroHealth Gate Game Registry
// FULL PATCH v20260314c-GATE-GAMES-GOODJUNK-RUN-FIX

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
    },
    run: '../bath-vr.html'
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
    },
    run: '../hygiene-vr.html'
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
    },
    run: '../brush-vr.html'
  },

  cleanobject: {
    cat: 'hygiene',
    label: 'Clean Object',
    theme: 'cleanobject',
    warmupTitle: 'Clean Object Quick Sort',
    cooldownTitle: 'Clean Object Calm Review',
    files: {
      warmup: './games/cleanobject/warmup.js',
      cooldown: './games/cleanobject/cooldown.js',
      style: './games/cleanobject/style.css'
    },
    run: '../clean-objects.html'
  },

  maskcough: {
    cat: 'hygiene',
    label: 'MaskCough',
    theme: 'maskcough',
    warmupTitle: 'MaskCough Quick Prep',
    cooldownTitle: 'MaskCough Calm Check',
    files: {
      warmup: './games/maskcough/warmup.js',
      cooldown: './games/maskcough/cooldown.js',
      style: './games/maskcough/style.css'
    },
    run: '../vr-maskcough/maskcough-v2.html'
  },

  germdetective: {
    cat: 'hygiene',
    label: 'Germ Detective',
    theme: 'germdetective',
    warmupTitle: 'Germ Detective Scan',
    cooldownTitle: 'Germ Detective Calm Review',
    files: {
      warmup: './games/germdetective/warmup.js',
      cooldown: './games/germdetective/cooldown.js',
      style: './games/germdetective/style.css'
    },
    run: '../germ-detective.html'
  },

  // =========================
  // NUTRITION ZONE
  // =========================
  goodjunk: {
    cat: 'nutrition',
    label: 'GoodJunk',
    theme: 'goodjunk',
    warmupTitle: 'GoodJunk Quick Sort',
    cooldownTitle: 'GoodJunk Calm Review',
    files: {
      warmup: './games/goodjunk/warmup.js',
      cooldown: './games/goodjunk/cooldown.js',
      style: './games/goodjunk/style.css'
    },
    // ✅ canonical run page จริงของ GoodJunk
    run: '../vr-goodjunk/goodjunk-vr.html'
  },

  groups: {
    cat: 'nutrition',
    label: 'Groups',
    theme: 'groups',
    warmupTitle: 'Food Groups Quick Prep',
    cooldownTitle: 'Food Groups Calm Review',
    files: {
      warmup: './games/groups/warmup.js',
      cooldown: './games/groups/cooldown.js',
      style: './games/groups/style.css'
    },
    run: '../groups-vr.html'
  },

  hydration: {
    cat: 'nutrition',
    label: 'Hydration',
    theme: 'hydration',
    warmupTitle: 'Hydration Quick Prep',
    cooldownTitle: 'Hydration Cooldown',
    files: {
      warmup: './games/hydration/warmup.js',
      cooldown: './games/hydration/cooldown.js',
      style: './games/hydration/style.css'
    },
    run: '../hydration-vr.html'
  },

  plate: {
    cat: 'nutrition',
    label: 'Plate',
    theme: 'plate',
    warmupTitle: 'Plate Quick Prep',
    cooldownTitle: 'Plate Calm Review',
    files: {
      warmup: './games/plate/warmup.js',
      cooldown: './games/plate/cooldown.js',
      style: './games/plate/style.css'
    },
    // ✅ canonical run page
    run: '../plate/plate-vr.html'
  },

  // =========================
  // FITNESS ZONE
  // =========================
  shadowbreaker: {
    cat: 'fitness',
    label: 'Shadow Breaker',
    theme: 'shadowbreaker',
    warmupTitle: 'Shadow Breaker Warmup',
    cooldownTitle: 'Shadow Breaker Cooldown',
    files: {
      warmup: './games/shadowbreaker/warmup.js',
      cooldown: './games/shadowbreaker/cooldown.js',
      style: './games/shadowbreaker/style.css'
    },
    run: '../shadow-breaker-vr.html'
  },

  rhythmboxer: {
    cat: 'fitness',
    label: 'Rhythm Boxer',
    theme: 'rhythmboxer',
    warmupTitle: 'Rhythm Boxer Warmup',
    cooldownTitle: 'Rhythm Boxer Cooldown',
    files: {
      warmup: './games/rhythmboxer/warmup.js',
      cooldown: './games/rhythmboxer/cooldown.js',
      style: './games/rhythmboxer/style.css'
    },
    run: '../rhythm-boxer-vr.html'
  },

  jumpduck: {
    cat: 'fitness',
    label: 'JumpDuck',
    theme: 'jumpduck',
    warmupTitle: 'JumpDuck Warmup',
    cooldownTitle: 'JumpDuck Cooldown',
    files: {
      warmup: './games/jumpduck/warmup.js',
      cooldown: './games/jumpduck/cooldown.js',
      style: './games/jumpduck/style.css'
    },
    run: '../jump-duck-vr.html'
  },

  balancehold: {
    cat: 'fitness',
    label: 'Balance Hold',
    theme: 'balancehold',
    warmupTitle: 'Balance Hold Warmup',
    cooldownTitle: 'Balance Hold Cooldown',
    files: {
      warmup: './games/balancehold/warmup.js',
      cooldown: './games/balancehold/cooldown.js',
      style: './games/balancehold/style.css'
    },
    run: '../balance-hold-vr.html'
  },

  fitnessplanner: {
    cat: 'fitness',
    label: 'Fitness Planner',
    theme: 'fitnessplanner',
    warmupTitle: 'Fitness Planner Warmup',
    cooldownTitle: 'Fitness Planner Cooldown',
    files: {
      warmup: './games/fitnessplanner/warmup.js',
      cooldown: './games/fitnessplanner/cooldown.js',
      style: './games/fitnessplanner/style.css'
    },
    run: '../fitness-planner.html'
  }
};

export function normalizeGameId(id=''){
  const s = String(id || '').trim().toLowerCase();

  // hygiene aliases
  if (s === 'hand-wash' || s === 'hand_wash') return 'handwash';
  if (s === 'toothbrush' || s === 'brushing') return 'brush';
  if (s === 'clean-object' || s === 'clean_object' || s === 'clean') return 'cleanobject';
  if (s === 'mask-cough' || s === 'mask_cough' || s === 'maskcoughv2') return 'maskcough';
  if (s === 'germ-detective' || s === 'germ_detective' || s === 'germ') return 'germdetective';

  // nutrition aliases
  if (s === 'good-junk' || s === 'good_junk') return 'goodjunk';
  if (s === 'foodgroups' || s === 'food-groups' || s === 'food_groups') return 'groups';
  if (s === 'balancedplate' || s === 'balanced-plate' || s === 'balanced_plate') return 'plate';

  // fitness aliases
  if (s === 'shadow-breaker' || s === 'shadow_breaker') return 'shadowbreaker';
  if (s === 'rhythm-boxer' || s === 'rhythm_boxer') return 'rhythmboxer';
  if (s === 'jump-duck' || s === 'jump_duck') return 'jumpduck';
  if (s === 'balance-hold' || s === 'balance_hold') return 'balancehold';
  if (s === 'fitness-planner' || s === 'fitness_planner') return 'fitnessplanner';

  return s;
}

export function getGameMeta(gameId=''){
  const id = normalizeGameId(gameId);
  return GATE_GAMES[id] || null;
}

export function getPhaseFile(gameId='', phase='warmup'){
  const meta = getGameMeta(gameId);
  if (!meta || !meta.files) return '';
  return phase === 'cooldown' ? meta.files.cooldown : meta.files.warmup;
}

export function getGameStyleFile(gameId=''){
  const meta = getGameMeta(gameId);
  return meta?.files?.style || '';
}

export function getRunFile(gameId=''){
  const meta = getGameMeta(gameId);
  return meta?.run || '';
}