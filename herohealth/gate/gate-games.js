// === /herohealth/gate/gate-games.js ===
// FULL PATCH v20260413b-GATE-GAMES-REGISTRY-FINAL

const PATCH = 'v20260413b-GATE-GAMES-REGISTRY-FINAL';

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
  summaryPath: '',
  warmupTitle: '',
  cooldownTitle: ''
};

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
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

function defaultSummaryByZone(zone = '') {
  const z = String(zone || '').trim().toLowerCase();
  if (z === 'nutrition') return '../nutrition-zone.html';
  if (z === 'fitness') return '../fitness-zone.html';
  if (z === 'hygiene') return '../hygiene-zone.html';
  return '';
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

  const zone = base.zone || inferZoneFromId(key);
  const cat = base.cat || zone;

  const warmupFile = hasOwn(cfg, 'warmupFile') ? cfg.warmupFile : '';
  const cooldownFile = hasOwn(cfg, 'cooldownFile') ? cfg.cooldownFile : '';
  const styleFile = hasOwn(cfg, 'styleFile') ? cfg.styleFile : '';

  const summaryPath = base.summaryPath || defaultSummaryByZone(zone);

  return {
    id: key,
    title: base.title || prettyTitle(key),
    label: base.label || base.title || prettyTitle(key),
    emoji: base.emoji || '🎮',
    zone,
    cat,
    theme: base.theme || key,
    runFile: base.runFile || runCandidates[0] || '',
    runCandidates,

    warmupFile,
    cooldownFile,
    styleFile,

    summaryPath,
    warmupTitle: base.warmupTitle || `${base.label || base.title || prettyTitle(key)} Warmup`,
    cooldownTitle: base.cooldownTitle || `${base.label || base.title || prettyTitle(key)} Cooldown`,

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
    summaryPath: defaultSummaryByZone(zone),
    warmupTitle: `${prettyTitle(key)} Warmup`,
    cooldownTitle: `${prettyTitle(key)} Cooldown`
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
    summaryPath: '../hydration-v2.html',
    warmupTitle: 'Hydration Warmup',
    cooldownTitle: 'Hydration Cooldown'
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
    summaryPath: '../goodjunk-launcher.html',
    warmupTitle: 'GoodJunk Warmup',
    cooldownTitle: 'GoodJunk Cooldown'
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
    summaryPath: '../plate-v1.html',
    warmupTitle: 'Plate Warmup',
    cooldownTitle: 'Plate Cooldown'
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
      '../group-v1.html',
      '../groups-vr.html'
    ],

    /* ใช้ warmup-gate.html patch ฝั่ง page แทน module */
    warmupFile: null,
    cooldownFile: null,
    styleFile: null,

    summaryPath: '../group-v1.html',
    warmupTitle: 'Food Groups Warmup',
    cooldownTitle: 'Food Groups Cooldown'
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
    summaryPath: '../hygiene-zone.html',
    warmupTitle: 'Brush Warmup',
    cooldownTitle: 'Brush Cooldown'
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
    summaryPath: '../hygiene-zone.html',
    warmupTitle: 'Handwash Warmup',
    cooldownTitle: 'Handwash Cooldown'
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
    summaryPath: '../hygiene-zone.html',
    warmupTitle: 'Germ Detective Warmup',
    cooldownTitle: 'Germ Detective Cooldown'
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
    summaryPath: '../hygiene-zone.html',
    warmupTitle: 'Bath Warmup',
    cooldownTitle: 'Bath Cooldown'
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
    summaryPath: '../hygiene-zone.html',
    warmupTitle: 'Mask & Cough Warmup',
    cooldownTitle: 'Mask & Cough Cooldown'
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
    summaryPath: '../fitness-zone.html',
    warmupTitle: 'Shadow Breaker Warmup',
    cooldownTitle: 'Shadow Breaker Cooldown'
  }),

  'jump-duck': makeMeta('jump-duck', {
    title: 'Jump Duck',
    label: 'Jump Duck',
    emoji: '🏃',
    zone: 'fitness',
    cat: 'fitness',
    theme: 'jump-duck',

    /* ใช้หน้าใหม่ที่มี menu / play / result รวมอยู่แล้วเป็นตัวหลัก */
    runFile: '../jumpduck.html',
    runCandidates: [
      '../jumpduck.html',
      '../jump-duck-vr.html',
      '../fitness/jump-duck.html'
    ],

    /* ใช้ warmup-gate.html patch ฝั่ง page แทน module */
    warmupFile: null,
    cooldownFile: null,
    styleFile: null,

    summaryPath: '../jumpduck.html',
    warmupTitle: 'JumpDuck Warmup',
    cooldownTitle: 'JumpDuck Cooldown'
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
    summaryPath: '../fitness-zone.html',
    warmupTitle: 'Balance Hold Warmup',
    cooldownTitle: 'Balance Hold Cooldown'
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
    summaryPath: '../fitness-zone.html',
    warmupTitle: 'Rhythm Boxer Warmup',
    cooldownTitle: 'Rhythm Boxer Cooldown'
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
    summaryPath: '../fitness-zone.html',
    warmupTitle: 'Fitness Planner Warmup',
    cooldownTitle: 'Fitness Planner Cooldown'
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
  'group-v1': 'groups',
  groupv1: 'groups',
  'groups-v1': 'groups',
  groupsv1: 'groups',
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
  'jump-duck-vr': 'jump-duck',
  jumpduckvr: 'jump-duck',
  jd: 'jump-duck',

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
    if (meta.warmupFile === null) return '';
    return meta.warmupFile || defaultPhaseFile(meta.id, 'warmup');
  }

  if (phase === 'cooldown') {
    if (meta.cooldownFile === null) return '';
    return meta.cooldownFile || defaultPhaseFile(meta.id, 'cooldown');
  }

  return '';
}

export function getGameStyleFile(id = '') {
  const meta = getGameMeta(id);
  if (!meta) return '';
  if (meta.styleFile === null) return '';
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