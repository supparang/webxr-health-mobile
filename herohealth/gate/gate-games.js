// === /herohealth/gate/gate-games.js ===
// FULL PATCH v20260406a-GATE-REGISTRY-CONVENTION-PHASES

const DEFAULTS = {
  title: '',
  label: '',
  emoji: '🎮',
  zone: '',
  cat: '',
  theme: '',
  runFile: '',
  runCandidates: [],
  warmupFile: '',
  cooldownFile: '',
  styleFile: '',
  summaryPath: ''
};

function makeMeta(id, cfg = {}) {
  const base = { ...DEFAULTS, ...cfg };
  const key = String(id || '').trim().toLowerCase();

  const runCandidates = Array.isArray(base.runCandidates)
    ? base.runCandidates.filter(Boolean)
    : [];

  if (!runCandidates.length && base.runFile) {
    runCandidates.push(base.runFile);
  }

  return {
    id: key,
    title: base.title || prettyTitle(key),
    label: base.label || base.title || prettyTitle(key),
    emoji: base.emoji || '🎮',
    zone: base.zone || inferZoneFromId(key),
    cat: base.cat || inferZoneFromId(key),
    theme: base.theme || key,
    runFile: base.runFile || runCandidates[0] || '',
    runCandidates,
    warmupFile: base.warmupFile || '',
    cooldownFile: base.cooldownFile || '',
    styleFile: base.styleFile || '',
    summaryPath: base.summaryPath || ''
  };
}

function prettyTitle(id = '') {
  const raw = String(id || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!raw) return 'Game';
  return raw.replace(/\b\w/g, (m) => m.toUpperCase());
}

function inferZoneFromId(id = '') {
  const k = String(id || '').toLowerCase();

  if (
    k.includes('hydration') ||
    k.includes('plate') ||
    k.includes('group') ||
    k.includes('goodjunk') ||
    k.includes('nutrition')
  ) return 'nutrition';

  if (
    k.includes('shadow') ||
    k.includes('jump') ||
    k.includes('balance') ||
    k.includes('rhythm') ||
    k.includes('fitness')
  ) return 'fitness';

  if (
    k.includes('brush') ||
    k.includes('germ') ||
    k.includes('bath') ||
    k.includes('hygiene') ||
    k.includes('handwash') ||
    k.includes('mask') ||
    k.includes('cough')
  ) return 'hygiene';

  return '';
}

function compactId(id = '') {
  return String(id || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function defaultPhaseFile(gameId = '', phase = 'warmup') {
  const key = compactId(gameId);
  const p = String(phase || 'warmup').trim().toLowerCase() === 'cooldown'
    ? 'cooldown'
    : 'warmup';
  if (!key) return '';
  return `./games/${key}/${p}.js`;
}

function defaultStyleFile(gameId = '') {
  const key = compactId(gameId);
  if (!key) return '';
  return `./games/${key}/style.css`;
}

function inferLooseMeta(id = '') {
  const key = compactId(id);
  if (!key) return null;

  const zone = inferZoneFromId(key);

  return makeMeta(key, {
    title: prettyTitle(key),
    label: prettyTitle(key),
    emoji:
      zone === 'nutrition' ? '🍎' :
      zone === 'fitness' ? '🏃' :
      zone === 'hygiene' ? '🧼' :
      '🎮',
    zone,
    cat: zone,
    theme: key,
    runFile: '',
    runCandidates: [],
    warmupFile: '',
    cooldownFile: '',
    styleFile: ''
  });
}

export const GAME_REGISTRY = {
  // Nutrition
  hydration: makeMeta('hydration', {
    title: 'Hydration Hero',
    label: 'Hydration Hero',
    emoji: '💧',
    zone: 'nutrition',
    cat: 'nutrition',
    theme: 'hydration',
    runFile: '../hydration-vr/hydration-vr.html',
    runCandidates: [
      '../hydration-vr/hydration-vr.html',
      '../vr-hydration-v2/index.html',
      '../hydration-v2.html'
    ]
  }),

  goodjunk: makeMeta('goodjunk', {
    title: 'GoodJunk VR',
    label: 'GoodJunk VR',
    emoji: '🍎',
    zone: 'nutrition',
    cat: 'nutrition',
    theme: 'goodjunk',
    runFile: '../goodjunk-vr.html',
    runCandidates: [
      '../goodjunk-vr.html',
      '../goodjunk-solo-boss.html',
      '../goodjunk-launcher.html'
    ],
    warmupFile: './games/goodjunk/warmup.js',
    cooldownFile: './games/goodjunk/cooldown.js',
    styleFile: './games/goodjunk/style.css'
  }),

  plate: makeMeta('plate', {
    title: 'Plate VR',
    label: 'Plate VR',
    emoji: '🍽️',
    zone: 'nutrition',
    cat: 'nutrition',
    theme: 'plate',
    runFile: '../plate/plate-vr.html',
    runCandidates: [
      '../plate/plate-vr.html',
      '../plate-v1.html'
    ]
  }),

  groups: makeMeta('groups', {
    title: 'Food Groups VR',
    label: 'Food Groups VR',
    emoji: '🥦',
    zone: 'nutrition',
    cat: 'nutrition',
    theme: 'groups',
    runFile: '../vr-groups/groups.html',
    runCandidates: [
      '../vr-groups/groups.html',
      '../groups-v1.html'
    ]
  }),

  // Hygiene
  brush: makeMeta('brush', {
    title: 'Brush VR',
    label: 'Brush VR',
    emoji: '🪥',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'brush',
    runFile: '../brush-vr.html',
    runCandidates: [
      '../brush-vr.html',
      '../brush-vr-kids.html'
    ]
  }),

  'germ-detective': makeMeta('germ-detective', {
    title: 'Germ Detective',
    label: 'Germ Detective',
    emoji: '🦠',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'germ-detective',
    runFile: '../germ-detective.html',
    runCandidates: [
      '../germ-detective.html',
      '../germ-detective-v2.html'
    ]
  }),

  bath: makeMeta('bath', {
    title: 'Bath Hero',
    label: 'Bath Hero',
    emoji: '🛁',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'bath',
    runFile: '../bath.html'
  }),

  maskcough: makeMeta('maskcough', {
    title: 'Mask & Cough',
    label: 'Mask & Cough',
    emoji: '😷',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'maskcough',
    runFile: '../maskcough-v2.html'
  }),

  handwash: makeMeta('handwash', {
    title: 'Handwash',
    label: 'Handwash',
    emoji: '🧼',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'handwash',
    runFile: '../handwash-vr.html'
  }),

  // Fitness
  'shadow-breaker': makeMeta('shadow-breaker', {
    title: 'Shadow Breaker',
    label: 'Shadow Breaker',
    emoji: '🥊',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'shadow-breaker',
    runFile: '../fitness/shadow-breaker.html'
  }),

  'jump-duck': makeMeta('jump-duck', {
    title: 'Jump Duck',
    label: 'Jump Duck',
    emoji: '🏃',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'jump-duck',
    runFile: '../jump-duck-vr.html'
  }),

  'balance-hold': makeMeta('balance-hold', {
    title: 'Balance Hold',
    label: 'Balance Hold',
    emoji: '🧘',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'balance-hold',
    runFile: '../balance-hold.html'
  }),

  'rhythm-boxer': makeMeta('rhythm-boxer', {
    title: 'Rhythm Boxer',
    label: 'Rhythm Boxer',
    emoji: '🥁',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'rhythm-boxer',
    runFile: '../fitness/rhythm-boxer.html'
  }),

  'fitness-planner': makeMeta('fitness-planner', {
    title: 'Fitness Planner',
    label: 'Fitness Planner',
    emoji: '📅',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'fitness-planner',
    runFile: '../fitness-planner/index.html'
  })
};

const GAME_ALIAS = {
  // hydration
  hydration: 'hydration',
  'hydration-vr': 'hydration',
  hydrationvr: 'hydration',
  hydrationhero: 'hydration',
  'hydration-hero': 'hydration',
  hydrationv1: 'hydration',
  hydrationv2: 'hydration',

  // goodjunk
  goodjunk: 'goodjunk',
  'goodjunk-vr': 'goodjunk',
  goodjunkvr: 'goodjunk',
  goodjunkv1: 'goodjunk',
  'goodjunk-solo-boss': 'goodjunk',

  // plate
  plate: 'plate',
  platev1: 'plate',
  'plate-vr': 'plate',
  platevr: 'plate',

  // groups
  groups: 'groups',
  groupsvr: 'groups',
  'groups-vr': 'groups',
  foodgroups: 'groups',
  'food-groups': 'groups',

  // hygiene
  brush: 'brush',
  brushvr: 'brush',
  'brush-vr': 'brush',
  'brush-vr-kids': 'brush',

  handwash: 'handwash',
  handwashvr: 'handwash',
  'handwash-vr': 'handwash',

  'germ-detective': 'germ-detective',
  germdetective: 'germ-detective',
  germ: 'germ-detective',

  bath: 'bath',
  bathhero: 'bath',
  bathvr: 'bath',

  maskcough: 'maskcough',
  'mask-cough': 'maskcough',

  // fitness
  'shadow-breaker': 'shadow-breaker',
  shadowbreaker: 'shadow-breaker',
  shadow: 'shadow-breaker',

  'jump-duck': 'jump-duck',
  jumpduck: 'jump-duck',

  'balance-hold': 'balance-hold',
  balancehold: 'balance-hold',

  'rhythm-boxer': 'rhythm-boxer',
  rhythmboxer: 'rhythm-boxer',

  'fitness-planner': 'fitness-planner',
  fitnessplanner: 'fitness-planner'
};

export function normalizeGameId(id = '') {
  const raw = String(id || '').trim().toLowerCase();
  if (!raw) return '';

  const compact = compactId(raw);
  return GAME_ALIAS[raw] || GAME_ALIAS[compact] || compact;
}

export function getGameMeta(id = '') {
  const key = normalizeGameId(id);
  if (!key) return null;
  return GAME_REGISTRY[key] || inferLooseMeta(key);
}

export function hasGameMeta(id = '') {
  return !!getGameMeta(id);
}

export function getPhaseFile(id = '', gatePhase = 'warmup') {
  const meta = getGameMeta(id);
  if (!meta) return '';

  const phase = String(gatePhase || 'warmup').trim().toLowerCase() === 'cooldown'
    ? 'cooldown'
    : 'warmup';

  if (phase === 'warmup') {
    return meta.warmupFile || defaultPhaseFile(meta.id, 'warmup');
  }

  if (phase === 'cooldown') {
    return meta.cooldownFile || defaultPhaseFile(meta.id, 'cooldown');
  }

  return '';
}

export function getGameStyleFile(id = '') {
  const meta = getGameMeta(id);
  if (!meta) return '';
  return meta.styleFile || defaultStyleFile(meta.id);
}

export function getRunFile(id = '') {
  const meta = getGameMeta(id);
  return meta?.runFile || '';
}

export function getRunCandidates(id = '') {
  const meta = getGameMeta(id);
  if (!meta) return [];
  if (Array.isArray(meta.runCandidates) && meta.runCandidates.length) {
    return meta.runCandidates.filter(Boolean);
  }
  return meta.runFile ? [meta.runFile] : [];
}

export function listGameIds() {
  return Object.keys(GAME_REGISTRY);
}

export default {
  GAME_REGISTRY,
  normalizeGameId,
  getGameMeta,
  hasGameMeta,
  getPhaseFile,
  getGameStyleFile,
  getRunFile,
  getRunCandidates,
  listGameIds
};