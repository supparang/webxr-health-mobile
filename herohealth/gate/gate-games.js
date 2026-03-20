// === /herohealth/gate/gate-games.js ===
// HeroHealth Gate Game Registry
// FULL PATCH v20260320-GATE-GAMES-ALL-ZONES-COMPLETE

export const GATE_GAMES = {
  // =========================================================
  // HYGIENE ZONE
  // =========================================================
  handwash: {
    cat: 'hygiene',
    label: 'Handwash',
    theme: 'handwash',
    warmupTitle: 'วอร์มอัปก่อนเล่น Handwash',
    cooldownTitle: 'พักหลังเล่น Handwash',
    phaseFiles: {
      warmup: './games/handwash/warmup.js',
      cooldown: './games/handwash/cooldown.js'
    },
    styleFile: './games/handwash/style.css',
    run: '../hygiene-vr.html',
    runCandidates: [
      '../hygiene-vr.html',
      '../handwash-vr.html'
    ]
  },

  brush: {
    cat: 'hygiene',
    label: 'Brush',
    theme: 'brush',
    warmupTitle: 'วอร์มอัปก่อนเล่น Brush',
    cooldownTitle: 'พักหลังเล่น Brush',
    phaseFiles: {
      warmup: './games/brush/warmup.js',
      cooldown: './games/brush/cooldown.js'
    },
    styleFile: './games/brush/style.css',
    run: '../brush-vr.html',
    runCandidates: [
      '../brush-vr.html'
    ]
  },

  bath: {
    cat: 'hygiene',
    label: 'Bath',
    theme: 'bath',
    warmupTitle: 'วอร์มอัปก่อนเล่น Bath',
    cooldownTitle: 'พักหลังเล่น Bath',
    phaseFiles: {
      warmup: './games/bath/warmup.js',
      cooldown: './games/bath/cooldown.js'
    },
    styleFile: './games/bath/style.css',
    run: '../bath-vr.html',
    runCandidates: [
      '../bath-vr.html'
    ]
  },

  maskcough: {
    cat: 'hygiene',
    label: 'Mask & Cough',
    theme: 'maskcough',
    warmupTitle: 'วอร์มอัปก่อนเล่น Mask & Cough',
    cooldownTitle: 'พักหลังเล่น Mask & Cough',
    phaseFiles: {
      warmup: './games/maskcough/warmup.js',
      cooldown: './games/maskcough/cooldown.js'
    },
    styleFile: './games/maskcough/style.css',
    run: '../maskcough-vr.html',
    runCandidates: [
      '../maskcough-vr.html'
    ]
  },

  germdetective: {
    cat: 'hygiene',
    label: 'Germ Detective',
    theme: 'germdetective',
    warmupTitle: 'วอร์มอัปก่อนเล่น Germ Detective',
    cooldownTitle: 'พักหลังเล่น Germ Detective',
    phaseFiles: {
      warmup: './games/germdetective/warmup.js',
      cooldown: './games/germdetective/cooldown.js'
    },
    styleFile: './games/germdetective/style.css',
    run: '../germ-detective-vr.html',
    runCandidates: [
      '../germ-detective-vr.html',
      '../germ-detective.html'
    ]
  },

  cleanobjects: {
    cat: 'hygiene',
    label: 'Clean Objects',
    theme: 'cleanobjects',
    warmupTitle: 'วอร์มอัปก่อนเล่น Clean Objects',
    cooldownTitle: 'พักหลังเล่น Clean Objects',
    phaseFiles: {
      warmup: './games/cleanobjects/warmup.js',
      cooldown: './games/cleanobjects/cooldown.js'
    },
    styleFile: './games/cleanobjects/style.css',
    run: '../vr-clean/home-clean.html',
    runCandidates: [
      '../vr-clean/home-clean.html',
      '../clean-objects.html',
      '../clean-object.html'
    ]
  },

  'cleanobjects-kids': {
    cat: 'hygiene',
    label: 'Clean Objects Kids',
    theme: 'cleanobjects-kids',
    warmupTitle: 'วอร์มอัปก่อนเล่น Clean Objects Kids',
    cooldownTitle: 'พักหลังเล่น Clean Objects Kids',
    phaseFiles: {
      warmup: './games/cleanobjects-kids/warmup.js',
      cooldown: './games/cleanobjects-kids/cooldown.js'
    },
    styleFile: './games/cleanobjects-kids/style.css',
    run: '../vr-clean/clean-kids.html',
    runCandidates: [
      '../vr-clean/clean-kids.html'
    ]
  },

  // =========================================================
  // NUTRITION ZONE
  // =========================================================
  goodjunk: {
    cat: 'nutrition',
    label: 'GoodJunk',
    theme: 'goodjunk',
    warmupTitle: 'วอร์มอัปก่อนเล่น GoodJunk',
    cooldownTitle: 'พักหลังเล่น GoodJunk',
    phaseFiles: {
      warmup: './games/goodjunk/warmup.js',
      cooldown: './games/goodjunk/cooldown.js'
    },
    styleFile: './games/goodjunk/style.css',
    run: '../goodjunk-launcher.html',
    runCandidates: [
      '../goodjunk-launcher.html',
      '../goodjunk-vr.html'
    ]
  },

  groups: {
    cat: 'nutrition',
    label: 'Groups',
    theme: 'groups',
    warmupTitle: 'วอร์มอัปก่อนเล่น Groups',
    cooldownTitle: 'พักหลังเล่น Groups',
    phaseFiles: {
      warmup: './games/groups/warmup.js',
      cooldown: './games/groups/cooldown.js'
    },
    styleFile: './games/groups/style.css',
    run: '../groups-vr.html',
    runCandidates: [
      '../groups-vr.html'
    ]
  },

  hydration: {
    cat: 'nutrition',
    label: 'Hydration',
    theme: 'hydration',
    warmupTitle: 'วอร์มอัปก่อนเล่น Hydration',
    cooldownTitle: 'พักหลังเล่น Hydration',
    phaseFiles: {
      warmup: './games/hydration/warmup.js',
      cooldown: './games/hydration/cooldown.js'
    },
    styleFile: './games/hydration/style.css',
    run: '../hydration-vr.html',
    runCandidates: [
      '../hydration-vr.html',
      '../hydration-vr/hydration-vr.html'
    ]
  },

  plate: {
    cat: 'nutrition',
    label: 'Plate',
    theme: 'plate',
    warmupTitle: 'วอร์มอัปก่อนเล่น Plate',
    cooldownTitle: 'พักหลังเล่น Plate',
    phaseFiles: {
      warmup: './games/plate/warmup.js',
      cooldown: './games/plate/cooldown.js'
    },
    styleFile: './games/plate/style.css',
    run: '../plate-vr.html',
    runCandidates: [
      '../plate-vr.html'
    ]
  },

  platev1: {
    cat: 'nutrition',
    label: 'Plate V1',
    theme: 'platev1',
    warmupTitle: 'วอร์มอัปก่อนเล่น Plate V1',
    cooldownTitle: 'พักหลังเล่น Plate V1',
    phaseFiles: {
      warmup: './games/plate/warmup-v1.js',
      cooldown: './games/plate/cooldown-v1.js'
    },
    styleFile: './games/plate/style.css',
    run: '../plate/plate-v1.html',
    runCandidates: [
      '../plate/plate-v1.html',
      '../plate-v1.html'
    ]
  },

  // =========================================================
  // EXERCISE ZONE
  // =========================================================
  shadowbreaker: {
    cat: 'exercise',
    label: 'Shadow Breaker',
    theme: 'shadowbreaker',
    warmupTitle: 'วอร์มอัปก่อนเล่น Shadow Breaker',
    cooldownTitle: 'พักหลังเล่น Shadow Breaker',
    phaseFiles: {
      warmup: './games/shadowbreaker/warmup.js',
      cooldown: './games/shadowbreaker/cooldown.js'
    },
    styleFile: './games/shadowbreaker/style.css',
    run: '../fitness/shadow-breaker.html',
    runCandidates: [
      '../fitness/shadow-breaker.html',
      '../shadow-breaker-vr.html'
    ]
  },

  rhythmboxer: {
    cat: 'exercise',
    label: 'Rhythm Boxer',
    theme: 'rhythmboxer',
    warmupTitle: 'วอร์มอัปก่อนเล่น Rhythm Boxer',
    cooldownTitle: 'พักหลังเล่น Rhythm Boxer',
    phaseFiles: {
      warmup: './games/rhythmboxer/warmup.js',
      cooldown: './games/rhythmboxer/cooldown.js'
    },
    styleFile: './games/rhythmboxer/style.css',
    run: '../fitness/rhythm-boxer.html',
    runCandidates: [
      '../fitness/rhythm-boxer.html',
      '../rhythm-boxer-vr.html'
    ]
  },

  jumpduck: {
    cat: 'exercise',
    label: 'JumpDuck',
    theme: 'jumpduck',
    warmupTitle: 'วอร์มอัปก่อนเล่น JumpDuck',
    cooldownTitle: 'พักหลังเล่น JumpDuck',
    phaseFiles: {
      warmup: './games/jumpduck/warmup.js',
      cooldown: './games/jumpduck/cooldown.js'
    },
    styleFile: './games/jumpduck/style.css',
    run: '../fitness/jump-duck.html',
    runCandidates: [
      '../fitness/jump-duck.html',
      '../jump-duck-vr.html'
    ]
  },

  balancehold: {
    cat: 'exercise',
    label: 'Balance Hold',
    theme: 'balancehold',
    warmupTitle: 'วอร์มอัปก่อนเล่น Balance Hold',
    cooldownTitle: 'พักหลังเล่น Balance Hold',
    phaseFiles: {
      warmup: './games/balancehold/warmup.js',
      cooldown: './games/balancehold/cooldown.js'
    },
    styleFile: './games/balancehold/style.css',
    run: '../fitness/balance-hold.html',
    runCandidates: [
      '../fitness/balance-hold.html',
      '../balance-hold-vr.html'
    ]
  },

  fitnessplanner: {
    cat: 'exercise',
    label: 'Fitness Planner',
    theme: 'fitnessplanner',
    warmupTitle: 'วอร์มอัปก่อนเล่น Fitness Planner',
    cooldownTitle: 'พักหลังเล่น Fitness Planner',
    phaseFiles: {
      warmup: './games/fitnessplanner/warmup.js',
      cooldown: './games/fitnessplanner/cooldown.js'
    },
    styleFile: './games/fitnessplanner/style.css',
    run: '../fitness-planner.html',
    runCandidates: [
      '../fitness-planner.html',
      './fitness-planner/planner.html'
    ]
  }
};

// --------------------------------------------------
// aliases / normalize
// --------------------------------------------------
const ALIASES = {
  // =========================
  // HYGIENE
  // =========================
  handwash: 'handwash',
  'hand-wash': 'handwash',
  hand_wash: 'handwash',
  handwashvr: 'handwash',
  'handwash-vr': 'handwash',
  handwash_vr: 'handwash',

  brush: 'brush',
  brushvr: 'brush',
  'brush-vr': 'brush',
  brush_vr: 'brush',
  toothbrush: 'brush',
  brushing: 'brush',

  bath: 'bath',
  bathvr: 'bath',
  'bath-vr': 'bath',
  bath_vr: 'bath',

  maskcough: 'maskcough',
  'mask-cough': 'maskcough',
  mask_cough: 'maskcough',
  maskcoughvr: 'maskcough',
  'maskcough-vr': 'maskcough',
  maskcough_vr: 'maskcough',
  maskcoughv2: 'maskcough',

  germdetective: 'germdetective',
  'germ-detective': 'germdetective',
  germ_detective: 'germdetective',
  germdetectivevr: 'germdetective',
  'germdetective-vr': 'germdetective',
  germdetective_vr: 'germdetective',
  germ: 'germdetective',
  germdetect: 'germdetective',

  clean: 'cleanobjects',
  'clean-object': 'cleanobjects',
  'clean-objects': 'cleanobjects',
  cleanobject: 'cleanobjects',
  cleanobjects: 'cleanobjects',

  'clean-kids': 'cleanobjects-kids',
  'clean-kid': 'cleanobjects-kids',
  'cleanobject-kids': 'cleanobjects-kids',
  'cleanobjects-kids': 'cleanobjects-kids',
  'clean-objects-kids': 'cleanobjects-kids',

  // =========================
  // NUTRITION
  // =========================
  goodjunk: 'goodjunk',
  'good-junk': 'goodjunk',
  good_junk: 'goodjunk',
  goodjunkvr: 'goodjunk',
  'goodjunk-vr': 'goodjunk',
  goodjunk_vr: 'goodjunk',

  groups: 'groups',
  groupsvr: 'groups',
  'groups-vr': 'groups',
  groups_vr: 'groups',
  foodgroups: 'groups',
  'food-groups': 'groups',
  food_groups: 'groups',
  foodgroup: 'groups',

  hydration: 'hydration',
  hydrationvr: 'hydration',
  'hydration-vr': 'hydration',
  hydration_vr: 'hydration',
  watergame: 'hydration',

  plate: 'plate',
  platevr: 'plate',
  'plate-vr': 'plate',
  plate_vr: 'plate',
  balancedplate: 'plate',
  'balanced-plate': 'plate',
  balanced_plate: 'plate',

  platev1: 'platev1',
  'plate-v1': 'platev1',
  plate_v1: 'platev1',
  platev1vr: 'platev1',
  'platev1-vr': 'platev1',
  platev1_vr: 'platev1',
  balancedplatev1: 'platev1',
  'balanced-plate-v1': 'platev1',
  balanced_plate_v1: 'platev1',

  // =========================
  // EXERCISE
  // =========================
  shadowbreaker: 'shadowbreaker',
  'shadow-breaker': 'shadowbreaker',
  shadow_breaker: 'shadowbreaker',
  shadow: 'shadowbreaker',
  shadowvr: 'shadowbreaker',
  'shadow-vr': 'shadowbreaker',
  shadow_vr: 'shadowbreaker',

  rhythmboxer: 'rhythmboxer',
  'rhythm-boxer': 'rhythmboxer',
  rhythm_boxer: 'rhythmboxer',
  rhythm: 'rhythmboxer',
  rhythmvr: 'rhythmboxer',
  'rhythm-vr': 'rhythmboxer',
  rhythm_vr: 'rhythmboxer',

  jumpduck: 'jumpduck',
  'jump-duck': 'jumpduck',
  jump_duck: 'jumpduck',
  jumpduckvr: 'jumpduck',
  'jumpduck-vr': 'jumpduck',
  jumpduck_vr: 'jumpduck',

  balancehold: 'balancehold',
  'balance-hold': 'balancehold',
  balance_hold: 'balancehold',
  balance: 'balancehold',
  balancevr: 'balancehold',
  'balance-vr': 'balancehold',
  balance_vr: 'balancehold',

  fitnessplanner: 'fitnessplanner',
  'fitness-planner': 'fitnessplanner',
  fitness_planner: 'fitnessplanner',
  planner: 'fitnessplanner',
  plannervr: 'fitnessplanner',
  'planner-vr': 'fitnessplanner',
  planner_vr: 'fitnessplanner'
};

export function normalizeGameId(v=''){
  const raw = String(v || '').trim().toLowerCase();
  if(!raw) return '';
  return ALIASES[raw] || raw;
}

export function getGameMeta(game=''){
  return GATE_GAMES[normalizeGameId(game)] || null;
}

export function getPhaseFile(game='', mode='warmup'){
  const meta = getGameMeta(game);
  if(!meta || !meta.phaseFiles) return '';
  return meta.phaseFiles[String(mode || '').toLowerCase()] || '';
}

export function getGameStyleFile(game=''){
  const meta = getGameMeta(game);
  return meta?.styleFile || '';
}

export function getRunFile(game=''){
  const meta = getGameMeta(game);
  return meta?.run || '';
}

export function getRunCandidates(game=''){
  const meta = getGameMeta(game);
  const list = Array.isArray(meta?.runCandidates) ? meta.runCandidates : [];
  if (list.length) return list.filter(Boolean);
  return meta?.run ? [meta.run] : [];
}