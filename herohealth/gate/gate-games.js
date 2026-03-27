// === /herohealth/gate/gate-games.js ===
// HeroHealth Gate Game Registry
// FULL PATCH v20260317b-GATE-GAMES-ALIAS-ROBUST-RUN-CANDIDATES

export const GATE_GAMES = {
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
    run: '../bath-vr.html',
    runCandidates: ['../bath-vr.html']
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
    run: '../hygiene-vr.html',
    runCandidates: ['../hygiene-vr.html', '../handwash-vr.html']
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
    run: '../brush-vr.html',
    runCandidates: ['../brush-vr.html']
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
    run: '../clean-objects.html',
    runCandidates: ['../clean-objects.html', '../clean-object.html']
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
    run: '../maskcough-vr.html',
    runCandidates: ['../maskcough-vr.html']
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
    run: '../germ-detective.html',
    runCandidates: ['../germ-detective.html', '../germ-detective-vr.html']
  },

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
    run: '../goodjunk-launcher.html',
    runCandidates: ['../goodjunk-launcher.html', '../goodjunk-vr.html']
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
    run: '../groups-vr.html',
    runCandidates: ['../groups-vr.html']
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
    run: '../hydration-vr.html',
    runCandidates: ['../hydration-vr.html', '../hydration-vr/hydration-vr.html']
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
    run: '../plate-vr.html',
    runCandidates: ['../plate-vr.html']
  },

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
    run: '../shadow-breaker-vr.html',
    runCandidates: ['../shadow-breaker-vr.html']
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
    run: '../rhythm-boxer-vr.html',
    runCandidates: ['../rhythm-boxer-vr.html']
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
    run: '../jump-duck-vr.html',
    runCandidates: ['../jump-duck-vr.html']
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
    run: '../balance-hold-vr.html',
    runCandidates: ['../balance-hold-vr.html']
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
    run: '../fitness-planner/planner.html',
    runCandidates: ['../fitness-planner/planner.html', '../fitness-planner.html']
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

  if (['bath','bathvr','bath-vr','bath_vr'].includes(s)) return 'bath';
  if (['handwash','hand-wash','hand_wash','handwashvr','handwash-vr','handwash_vr'].includes(s)) return 'handwash';
  if (['brush','brushvr','brush-vr','brush_vr','toothbrush','brushing'].includes(s)) return 'brush';
  if (['clean','cleanobject','clean-object','clean_object','cleanobjects','clean-objects','clean_objects'].includes(s)) return 'clean';
  if (['maskcough','mask-cough','mask_cough','maskcoughvr','maskcough-vr','maskcough_vr','maskcoughv2'].includes(s)) return 'maskcough';
  if (['germdetective','germ-detective','germ_detective','germdetectivevr','germdetective-vr','germdetective_vr','germ','germdetect'].includes(s)) return 'germdetective';

  if (['goodjunk','good-junk','good_junk','goodjunkvr','goodjunk-vr','goodjunk_vr'].includes(s)) return 'goodjunk';
  if (['groups','groupsvr','groups-vr','groups_vr','foodgroups','food-groups','food_groups','foodgroup'].includes(s)) return 'groups';
  if (['hydration','hydrationvr','hydration-vr','hydration_vr','watergame'].includes(s)) return 'hydration';
  if (['plate','platevr','plate-vr','plate_vr','balancedplate','balanced-plate','balanced_plate'].includes(s)) return 'plate';

  if (['shadow','shadowvr','shadow-vr','shadow_vr','shadowbreaker','shadow-breaker','shadow_breaker'].includes(s)) return 'shadow';
  if (['rhythm','rhythmvr','rhythm-vr','rhythm_vr','rhythmboxer','rhythm-boxer','rhythm_boxer'].includes(s)) return 'rhythm';
  if (['jumpduck','jump-duck','jump_duck','jumpduckvr','jumpduck-vr','jumpduck_vr'].includes(s)) return 'jumpduck';
  if (['balance','balancevr','balance-vr','balance_vr','balancehold','balance-hold','balance_hold'].includes(s)) return 'balance';
  if (['planner','fitnessplanner','fitness-planner','fitness_planner','plannervr','planner-vr','planner_vr'].includes(s)) return 'planner';

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

export function getRunCandidates(gameId=''){
  const meta = getGameMeta(gameId);
  const list = Array.isArray(meta?.runCandidates) ? meta.runCandidates : [];
  if (list.length) return list.filter(Boolean);
  return meta?.run ? [meta.run] : [];
}