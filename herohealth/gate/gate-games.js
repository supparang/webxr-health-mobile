// === /herohealth/gate/gate-games.js ===
// FULL PATCH v20260408b-GJ-SOLOBOSS-FLOW-FINAL

const PATCH = 'v20260408b-GJ-SOLOBOSS-FLOW-FINAL';

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

function makeMeta(id, cfg = {}) {
  const base = { ...DEFAULTS, ...cfg };
  const key = compactId(id);

  const runCandidates = Array.isArray(base.runCandidates)
    ? base.runCandidates.filter(Boolean)
    : [];

  if (!runCandidates.length && base.runFile) {
    runCandidates.push(base.runFile);
  }

  const summaryPath = base.summaryPath || '';

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
    summaryPath,
    defaults: {
      summaryPath
    }
  };
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
    styleFile: '',
    summaryPath: ''
  });
}

export const GAME_REGISTRY = {
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
      '../hydration-v2.html',
      '../vr-hydration-v2/index.html'
    ],
    summaryPath: '../hydration-v2.html'
  }),

  goodjunk: makeMeta('goodjunk', {
    title: 'GoodJunk VR',
    label: 'GoodJunk VR',
    emoji: '🍎',
    zone: 'nutrition',
    cat: 'nutrition',
    theme: 'goodjunk',
    runFile: '../goodjunk-solo-boss.html',
    runCandidates: [
      '../goodjunk-solo-boss.html',
      '../goodjunk-vr.html',
      '../goodjunk-launcher.html'
    ],
    warmupFile: './games/goodjunk/warmup.js',
    cooldownFile: './games/goodjunk/cooldown.js',
    styleFile: './games/goodjunk/style.css',
    summaryPath: 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html?pid=anon&hub=https%3A%2F%2Fsupparang.github.io%2Fwebxr-health-mobile%2Fherohealth%2Fhub.html'
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
      '../plate-v1.html',
      '../plate-vr.html'
    ],
    summaryPath: '../plate-v1.html'
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
      '../groups-v1.html',
      '../groups-vr.html'
    ],
    summaryPath: '../groups-v1.html'
  }),

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
    ],
    summaryPath: '../hygiene-zone.html'
  }),

  handwash: makeMeta('handwash', {
    title: 'Handwash',
    label: 'Handwash',
    emoji: '🧼',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'handwash',
    runFile: '../handwash-vr.html',
    runCandidates: [
      '../handwash-vr.html',
      '../vr-handwash/handwash-vr.html'
    ],
    summaryPath: '../hygiene-zone.html'
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
      '../germ-detective-v2.html',
      '../germ-detective/germ-detective-vr.html'
    ],
    summaryPath: '../hygiene-zone.html'
  }),

  bath: makeMeta('bath', {
    title: 'Bath Hero',
    label: 'Bath Hero',
    emoji: '🛁',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'bath',
    runFile: '../bath.html',
    runCandidates: [
      '../bath.html',
      '../bath-vr.html',
      '../vr-bath/bath.html'
    ],
    summaryPath: '../hygiene-zone.html'
  }),

  maskcough: makeMeta('maskcough', {
    title: 'Mask & Cough',
    label: 'Mask & Cough',
    emoji: '😷',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'maskcough',
    runFile: '../maskcough-v2.html',
    runCandidates: [
      '../maskcough-v2.html',
      '../vr-maskcough/maskcough-v2.html'
    ],
    summaryPath: '../hygiene-zone.html'
  }),

  'shadow-breaker': makeMeta('shadow-breaker', {
    title: 'Shadow Breaker',
    label: 'Shadow Breaker',
    emoji: '🥊',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'shadow-breaker',
    runFile: '../fitness/shadow-breaker.html',
    runCandidates: [
      '../fitness/shadow-breaker.html',
      '../shadow-breaker-vr.html'
    ],
    summaryPath: '../fitness-zone.html'
  }),

  'jump-duck': makeMeta('jump-duck', {
    title: 'Jump Duck',
    label: 'Jump Duck',
    emoji: '🏃',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'jump-duck',
    runFile: '../jump-duck-vr.html',
    runCandidates: [
      '../jump-duck-vr.html',
      '../fitness/jump-duck.html'
    ],
    summaryPath: '../fitness-zone.html'
  }),

  'balance-hold': makeMeta('balance-hold', {
    title: 'Balance Hold',
    label: 'Balance Hold',
    emoji: '🧘',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'balance-hold',
    runFile: '../balance-hold.html',
    runCandidates: [
      '../balance-hold.html',
      '../fitness/balance-hold.html'
    ],
    summaryPath: '../fitness-zone.html'
  }),

  'rhythm-boxer': makeMeta('rhythm-boxer', {
    title: 'Rhythm Boxer',
    label: 'Rhythm Boxer',
    emoji: '🥁',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'rhythm-boxer',
    runFile: '../fitness/rhythm-boxer.html',
    runCandidates: [
      '../fitness/rhythm-boxer.html',
      '../rhythm-boxer-vr.html'
    ],
    summaryPath: '../fitness-zone.html'
  }),

  'fitness-planner': makeMeta('fitness-planner', {
    title: 'Fitness Planner',
    label: 'Fitness Planner',
    emoji: '📅',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'fitness-planner',
    runFile: '../fitness-planner/index.html',
    runCandidates: [
      '../fitness-planner/index.html',
      '../fitness-planner.html'
    ],
    summaryPath: '../fitness-zone.html'
  })
};

const GAME_ALIAS = {
  hydration: 'hydration',
  'hydration-vr': 'hydration',
  hydrationvr: 'hydration',
  hydrationhero: 'hydration',
  'hydration-hero': 'hydration',
  hydrationv1: 'hydration',
  hydrationv2: 'hydration',

  goodjunk: 'goodjunk',
  'goodjunk-vr': 'goodjunk',
  goodjunkvr: 'goodjunk',
  goodjunkv1: 'goodjunk',
  'goodjunk-solo-boss': 'goodjunk',
  goodjunkboss: 'goodjunk',
  phaseboss: 'goodjunk',
  'solo-boss': 'goodjunk',

  plate: 'plate',
  platev1: 'plate',
  'plate-vr': 'plate',
  platevr: 'plate',

  groups: 'groups',
  groupsvr: 'groups',
  'groups-vr': 'groups',
  foodgroups: 'groups',
  'food-groups': 'groups',

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

export function getSummaryPath(id = '') {
  const meta = getGameMeta(id);
  return meta?.summaryPath || meta?.defaults?.summaryPath || '';
}

export function listGameIds() {
  return Object.keys(GAME_REGISTRY);
}

export { PATCH };

export default {
  PATCH,
  GAME_REGISTRY,
  normalizeGameId,
  getGameMeta,
  hasGameMeta,
  getPhaseFile,
  getGameStyleFile,
  getRunFile,
  getRunCandidates,
  getSummaryPath,
  listGameIds
};