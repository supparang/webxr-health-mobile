// === /herohealth/gate/gate-games.js ===
// FULL PATCH v20260328h-HYDRATION-GATE-REGISTRY-FIX
// เป้าหมาย:
// 1) ให้ warmup/cooldown gate รู้จัก game=hydration
// 2) รองรับ alias หลายแบบ เช่น hydration-vr / hydrationhero
// 3) ถ้าเป็นเกมใหม่ที่ยังไม่ได้ลง registry แบบเต็ม ให้ fallback เข้า generic gate ได้ ไม่ขึ้น "ไม่พบเกมที่ต้องการ"

const DEFAULTS = {
  title: '',
  label: '',
  emoji: '🎮',
  zone: '',
  cat: '',
  theme: '',
  runFile: '',
  warmupFile: '',
  cooldownFile: '',
  styleFile: ''
};

function makeMeta(id, cfg = {}) {
  const base = { ...DEFAULTS, ...cfg };
  return {
    id: String(id || '').trim().toLowerCase(),
    title: base.title || prettyTitle(id),
    label: base.label || base.title || prettyTitle(id),
    emoji: base.emoji || '🎮',
    zone: base.zone || inferZoneFromId(id),
    cat: base.cat || inferZoneFromId(id),
    theme: base.theme || String(id || '').trim().toLowerCase(),
    runFile: base.runFile || '',
    warmupFile: base.warmupFile || '',
    cooldownFile: base.cooldownFile || '',
    styleFile: base.styleFile || ''
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
    k.includes('handwash')
  ) return 'hygiene';

  return '';
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
    warmupFile: '',
    cooldownFile: '',
    styleFile: '../hydration-vr/hydration-vr.css'
  }),

  goodjunk: makeMeta('goodjunk', {
    title: 'GoodJunk VR',
    label: 'GoodJunk VR',
    emoji: '🍎',
    zone: 'nutrition',
    cat: 'nutrition',
    theme: 'goodjunk',
    runFile: '../goodjunk-vr.html'
  }),

  plate: makeMeta('plate', {
    title: 'Plate VR',
    label: 'Plate VR',
    emoji: '🍽️',
    zone: 'nutrition',
    cat: 'nutrition',
    theme: 'plate',
    runFile: '../plate/plate-vr.html'
  }),

  groups: makeMeta('groups', {
    title: 'Food Groups VR',
    label: 'Food Groups VR',
    emoji: '🥦',
    zone: 'nutrition',
    cat: 'nutrition',
    theme: 'groups',
    runFile: '../vr-groups/groups.html'
  }),

  // Hygiene
  brush: makeMeta('brush', {
    title: 'Brush VR',
    label: 'Brush VR',
    emoji: '🪥',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'brush',
    runFile: '../brush-vr.html'
  }),

  'germ-detective': makeMeta('germ-detective', {
    title: 'Germ Detective',
    label: 'Germ Detective',
    emoji: '🦠',
    zone: 'hygiene',
    cat: 'hygiene',
    theme: 'germ-detective',
    runFile: '../germ-detective.html'
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

  // goodjunk
  goodjunk: 'goodjunk',
  'goodjunk-vr': 'goodjunk',
  goodjunkvr: 'goodjunk',
  goodjunkv1: 'goodjunk',

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

  // brush / hygiene
  brush: 'brush',
  brushvr: 'brush',
  'brush-vr': 'brush',
  hygiene: 'brush',
  handwash: 'brush',
  handwashvr: 'brush',

  'germ-detective': 'germ-detective',
  germdetective: 'germ-detective',
  germ: 'germ-detective',

  bath: 'bath',
  bathhero: 'bath',
  bathvr: 'bath',

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

function compactId(id = '') {
  return String(id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-');
}

function inferLooseMeta(id = '') {
  const key = compactId(id);
  if (!key) return null;

  return makeMeta(key, {
    title: prettyTitle(key),
    label: prettyTitle(key),
    emoji: inferZoneFromId(key) === 'nutrition'
      ? '🍎'
      : inferZoneFromId(key) === 'fitness'
        ? '🏃'
        : inferZoneFromId(key) === 'hygiene'
          ? '🧼'
          : '🎮',
    zone: inferZoneFromId(key),
    cat: inferZoneFromId(key),
    theme: key,
    runFile: '',
    warmupFile: '',
    cooldownFile: '',
    styleFile: ''
  });
}

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

  const phase = String(gatePhase || 'warmup').trim().toLowerCase();

  if (phase === 'warmup') return meta.warmupFile || '';
  if (phase === 'cooldown') return meta.cooldownFile || '';
  return meta.runFile || '';
}

export function getGameStyleFile(id = '') {
  const meta = getGameMeta(id);
  return meta?.styleFile || '';
}

export function getRunFile(id = '') {
  const meta = getGameMeta(id);
  return meta?.runFile || '';
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
  listGameIds
};