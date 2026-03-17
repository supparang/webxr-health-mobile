// === /herohealth/gate/gate-games.js ===
// HeroHealth Gate Game Registry
// FULL PATCH v20260317-GATE-GAMES-ALIAS-ROBUST-CANONICAL
// ✅ canonical game ids preserved
// ✅ exercise cat unified to "exercise"
// ✅ expanded aliases across hygiene / nutrition / exercise
// ✅ run paths kept as current canonical entry pages
// ✅ robust normalizeGameId() for launcher/query variations

export const GATE_GAMES = {
  // =========================
  // HYGIENE
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

  clean: {
    cat: 'hygiene',
    label: 'Clean Object',
    theme: 'clean',
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
    run: '../maskcough-vr.html'
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
  // NUTRITION
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
    run: '../goodjunk-launcher.html'
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
    run: '../plate-vr.html'
  },

  // =========================
  // EXERCISE
  // =========================
  shadow: {
    cat: 'exercise',
    label: 'Shadow Breaker',
    theme: 'shadow',
    warmupTitle: 'Shadow Breaker Warmup',
    cooldownTitle: 'Shadow Breaker Cooldown',
    files: {
      warmup: './games/shadowbreaker/warmup.js',
      cooldown: './games/shadowbreaker/cooldown.js',
      style: './games/shadowbreaker/style.css'
    },
    run: '../shadow-breaker-vr.html'
  },

  rhythm: {
    cat: 'exercise',
    label: 'Rhythm Boxer',
    theme: 'rhythm',
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
    cat: 'exercise',
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

  balance: {
    cat: 'exercise',
    label: 'Balance Hold',
    theme: 'balance',
    warmupTitle: 'Balance Hold Warmup',
    cooldownTitle: 'Balance Hold Cooldown',
    files: {
      warmup: './games/balancehold/warmup.js',
      cooldown: './games/balancehold/cooldown.js',
      style: './games/balancehold/style.css'
    },
    run: '../balance-hold-vr.html'
  },

  planner: {
    cat: 'exercise',
    label: 'Fitness Planner',
    theme: 'planner',
    warmupTitle: 'Fitness Planner Warmup',
    cooldownTitle: 'Fitness Planner Cooldown',
    files: {
      warmup: './games/fitnessplanner/warmup.js',
      cooldown: './games/fitnessplanner/cooldown.js',
      style: './games/fitnessplanner/style.css'
    },
    run: '../fitness-planner/planner.html'
  }
};

function squashId(id=''){
  return String(id || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_-]/g, '');
}

export function normalizeGameId(id=''){
  const s = squashId(id);

  if (!s) return '';

  // -------------------------
  // HYGIENE
  // -------------------------
  if (
    s === 'bath' ||
    s === 'bathvr' ||
    s === 'bath-vr' ||
    s === 'bath_vr'
  ) return 'bath';

  if (
    s === 'handwash' ||
    s === 'hand-wash' ||
    s === 'hand_wash' ||
    s === 'handwashvr' ||
    s === 'handwash-vr' ||
    s === 'handwash_vr'
  ) return 'handwash';

  if (
    s === 'brush' ||
    s === 'brushvr' ||
    s === 'brush-vr' ||
    s === 'brush_vr' ||
    s === 'toothbrush' ||
    s === 'brushing'
  ) return 'brush';

  if (
    s === 'clean' ||
    s === 'cleanobject' ||
    s === 'clean-object' ||
    s === 'clean_object' ||
    s === 'cleanobjects' ||
    s === 'clean-objects' ||
    s === 'clean_objects'
  ) return 'clean';

  if (
    s === 'maskcough' ||
    s === 'mask-cough' ||
    s === 'mask_cough' ||
    s === 'maskcoughvr' ||
    s === 'maskcough-vr' ||
    s === 'maskcough_vr' ||
    s === 'maskcoughv2'
  ) return 'maskcough';

  if (
    s === 'germdetective' ||
    s === 'germ-detective' ||
    s === 'germ_detective' ||
    s === 'germdetectivevr' ||
    s === 'germdetective-vr' ||
    s === 'germdetective_vr' ||
    s === 'germ' ||
    s === 'germdetect'
  ) return 'germdetective';

  // -------------------------
  // NUTRITION
  // -------------------------
  if (
    s === 'goodjunk' ||
    s === 'good-junk' ||
    s === 'good_junk' ||
    s === 'goodjunkvr' ||
    s === 'goodjunk-vr' ||
    s === 'goodjunk_vr'
  ) return 'goodjunk';

  if (
    s === 'groups' ||
    s === 'groupsvr' ||
    s === 'groups-vr' ||
    s === 'groups_vr' ||
    s === 'foodgroups' ||
    s === 'food-groups' ||
    s === 'food_groups' ||
    s === 'foodgroup'
  ) return 'groups';

  if (
    s === 'hydration' ||
    s === 'hydrationvr' ||
    s === 'hydration-vr' ||
    s === 'hydration_vr' ||
    s === 'watergame'
  ) return 'hydration';

  if (
    s === 'plate' ||
    s === 'platevr' ||
    s === 'plate-vr' ||
    s === 'plate_vr' ||
    s === 'balancedplate' ||
    s === 'balanced-plate' ||
    s === 'balanced_plate'
  ) return 'plate';

  // -------------------------
  // EXERCISE
  // -------------------------
  if (
    s === 'shadow' ||
    s === 'shadowvr' ||
    s === 'shadow-vr' ||
    s === 'shadow_vr' ||
    s === 'shadowbreaker' ||
    s === 'shadow-breaker' ||
    s === 'shadow_breaker'
  ) return 'shadow';

  if (
    s === 'rhythm' ||
    s === 'rhythmvr' ||
    s === 'rhythm-vr' ||
    s === 'rhythm_vr' ||
    s === 'rhythmboxer' ||
    s === 'rhythm-boxer' ||
    s === 'rhythm_boxer'
  ) return 'rhythm';

  if (
    s === 'jumpduck' ||
    s === 'jump-duck' ||
    s === 'jump_duck' ||
    s === 'jumpduckvr' ||
    s === 'jumpduck-vr' ||
    s === 'jumpduck_vr'
  ) return 'jumpduck';

  if (
    s === 'balance' ||
    s === 'balancevr' ||
    s === 'balance-vr' ||
    s === 'balance_vr' ||
    s === 'balancehold' ||
    s === 'balance-hold' ||
    s === 'balance_hold'
  ) return 'balance';

  if (
    s === 'planner' ||
    s === 'fitnessplanner' ||
    s === 'fitness-planner' ||
    s === 'fitness_planner' ||
    s === 'plannervr' ||
    s === 'planner-vr' ||
    s === 'planner_vr'
  ) return 'planner';

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