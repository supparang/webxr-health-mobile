// === /herohealth/gate/gate-games.js ===
// FULL REPLACEMENT v20260621-GATE-GAMES-SYNTAX-STABLE-V10
// Shared registry for HeroHealth Gate.

export const PATCH = 'v20260621-GATE-GAMES-SYNTAX-STABLE-V10';

const FITNESS_MODULE = './games/fitness/fitness-readiness-recovery.js?v=20260621-frr-v10';
const FITNESS_STYLE = './games/fitness/fitness-readiness-recovery.css?v=20260621-frr-v10';

function clean(id) {
  return String(id || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function title(id) {
  const x = clean(id).replace(/-/g, ' ');
  if (!x) return 'Game';
  return x.replace(/\b[a-z]/g, function(ch) { return ch.toUpperCase(); });
}

function meta(id, options) {
  const cfg = options || {};
  const runs = Array.isArray(cfg.runCandidates) ? cfg.runCandidates.filter(Boolean) : [];
  if (!runs.length && cfg.runFile) runs.push(cfg.runFile);

  return {
    id: clean(id),
    title: cfg.title || title(id),
    label: cfg.label || cfg.title || title(id),
    emoji: cfg.emoji || '🎮',
    zone: cfg.zone || '',
    cat: cfg.cat || cfg.zone || '',
    theme: cfg.theme || clean(id),
    runFile: cfg.runFile || runs[0] || '',
    runCandidates: runs,
    warmupFile: cfg.warmupFile || '',
    cooldownFile: cfg.cooldownFile || '',
    styleFile: cfg.styleFile || '',
    summaryPath: cfg.summaryPath || '',
    warmupTitle: cfg.warmupTitle || '',
    cooldownTitle: cfg.cooldownTitle || ''
  };
}

export const GAME_REGISTRY = {
  hydration: meta('hydration', {
    title:'Hydration Hero', emoji:'💧', zone:'nutrition',
    runFile:'../hydration-vr/hydration-vr.html',
    runCandidates:['../hydration-vr/hydration-vr.html','../hydration-v2.html','../vr-hydration-v2/index.html'],
    warmupFile:'./games/hydration/warmup.js',
    cooldownFile:'./games/hydration/cooldown.js',
    styleFile:'./games/hydration/style.css',
    summaryPath:'../nutrition-zone.html'
  }),
  goodjunk: meta('goodjunk', {
    title:'GoodJunk Solo Boss', emoji:'🍎', zone:'nutrition',
    runFile:'../vr-goodjunk/goodjunk-solo-boss.html',
    runCandidates:['../vr-goodjunk/goodjunk-solo-boss.html'],
    warmupFile:'./games/goodjunk/warmup.js',
    cooldownFile:'./games/goodjunk/cooldown.js',
    styleFile:'./games/goodjunk/style.css',
    summaryPath:'../goodjunk-launcher.html'
  }),
  plate: meta('plate', {
    title:'Balanced Plate AR', emoji:'🍽️', zone:'nutrition',
    runFile:'../plate/plate-ar.html',
    runCandidates:['../plate/plate-ar.html','../plate/plate-vr.html','../plate-vr.html'],
    summaryPath:'../nutrition-zone.html'
  }),
  groups: meta('groups', {
    title:'Food Groups AR', emoji:'🥦', zone:'nutrition',
    runFile:'../vr-groups/groups.html',
    runCandidates:['../vr-groups/groups.html','../groups-vr.html'],
    summaryPath:'../nutrition-zone.html'
  }),
  brush: meta('brush', {
    title:'Brush AR', emoji:'🪥', zone:'hygiene',
    runFile:'../brush-vr.html',
    runCandidates:['../brush-vr.html','../brush-vr-kids.html'],
    summaryPath:'../hygiene-zone.html'
  }),
  handwash: meta('handwash', {
    title:'Handwash AR', emoji:'🧼', zone:'hygiene',
    runFile:'../vr-handwash/handwash-vr.html',
    runCandidates:['../vr-handwash/handwash-vr.html','../handwash-vr.html'],
    summaryPath:'../hygiene-zone.html'
  }),
  'germ-detective': meta('germ-detective', {
    title:'Germ Detective AR', emoji:'🦠', zone:'hygiene',
    runFile:'../germ-detective.html',
    runCandidates:['../germ-detective.html','../germ-detective-v2.html'],
    summaryPath:'../hygiene-zone.html'
  }),
  bath: meta('bath', {
    title:'Bath Hero AR', emoji:'🛁', zone:'hygiene',
    runFile:'../bath.html',
    runCandidates:['../bath.html','../bath-vr.html'],
    summaryPath:'../hygiene-zone.html'
  }),
  maskcough: meta('maskcough', {
    title:'Mask & Cough AR', emoji:'😷', zone:'hygiene',
    runFile:'../maskcough-v2.html',
    runCandidates:['../maskcough-v2.html'],
    summaryPath:'../hygiene-zone.html'
  }),
  'shadow-breaker': meta('shadow-breaker', {
    title:'Shadow Breaker AR', emoji:'🥊', zone:'fitness',
    warmupFile:FITNESS_MODULE, cooldownFile:FITNESS_MODULE, styleFile:FITNESS_STYLE,
    warmupTitle:'Hero Ready Mission • Punch Power',
    cooldownTitle:'Hero Recovery Mission • Arms & Shoulders',
    runFile:'../fitness/shadow-breaker-ar.html',
    runCandidates:['../fitness/shadow-breaker-ar.html','../fitness/shadow-breaker.html'],
    summaryPath:'../fitness-zone.html'
  }),
  'rhythm-boxer': meta('rhythm-boxer', {
    title:'Rhythm Boxer AR', emoji:'🥁', zone:'fitness',
    warmupFile:FITNESS_MODULE, cooldownFile:FITNESS_MODULE, styleFile:FITNESS_STYLE,
    warmupTitle:'Hero Ready Mission • Beat Control',
    cooldownTitle:'Hero Recovery Mission • Rhythm Reset',
    runFile:'../fitness/rhythm-boxer-ar.html',
    runCandidates:['../fitness/rhythm-boxer-ar.html','../fitness/rhythm-boxer.html'],
    summaryPath:'../fitness-zone.html'
  }),
  'jump-duck': meta('jump-duck', {
    title:'JumpDuck AR', emoji:'🐶', zone:'fitness',
    warmupFile:FITNESS_MODULE, cooldownFile:FITNESS_MODULE, styleFile:FITNESS_STYLE,
    warmupTitle:'Hero Ready Mission • Agility',
    cooldownTitle:'Hero Recovery Mission • Legs & Ankles',
    runFile:'../fitness/jumpduck-ar.html',
    runCandidates:['../fitness/jumpduck-ar.html','../fitness/jump-duck.html','../fitness/jumpduck.html'],
    summaryPath:'../fitness-zone.html'
  }),
  'balance-hold': meta('balance-hold', {
    title:'Balance Hold AR', emoji:'🧘', zone:'fitness',
    warmupFile:FITNESS_MODULE, cooldownFile:FITNESS_MODULE, styleFile:FITNESS_STYLE,
    warmupTitle:'Hero Ready Mission • Stability',
    cooldownTitle:'Hero Recovery Mission • Calm Balance',
    runFile:'../fitness/balance-hold-ar2.html',
    runCandidates:['../fitness/balance-hold-ar2.html','../fitness/balance-hold.html'],
    summaryPath:'../fitness-zone.html'
  }),
  'fitness-planner': meta('fitness-planner', {
    title:'Fitness Planner', emoji:'📅', zone:'fitness',
    runFile:'../fitness-planner.html',
    runCandidates:['../fitness-planner.html','../fitness-planner/index.html'],
    summaryPath:'../fitness-zone.html'
  })
};

const ALIAS = {
  'shadowbreaker':'shadow-breaker','shadow-breaker-ar':'shadow-breaker','shadow':'shadow-breaker',
  'rhythmboxer':'rhythm-boxer','rhythm-boxer-ar':'rhythm-boxer',
  'jumpduck':'jump-duck','jumpduck-ar':'jump-duck','jump-duck-ar':'jump-duck',
  'balancehold':'balance-hold','balance-hold-ar2':'balance-hold',
  'goodjunk-vr':'goodjunk','hydration-vr':'hydration','plate-vr':'plate','groups-vr':'groups',
  'germdetective':'germ-detective','mask-cough':'maskcough','fitnessplanner':'fitness-planner'
};

export function normalizeGameId(id) {
  const raw = String(id || '').trim().toLowerCase();
  if (!raw) return '';
  const key = clean(raw);
  return ALIAS[raw] || ALIAS[key] || key;
}

export function getGameMeta(id) {
  const key = normalizeGameId(id);
  if (!key) return null;
  if (GAME_REGISTRY[key]) return GAME_REGISTRY[key];
  return meta(key, { title:title(key), zone:key.indexOf('fitness') >= 0 ? 'fitness' : '' });
}

export function hasGameMeta(id) {
  return !!getGameMeta(id);
}

export function getPhaseFile(id, phase) {
  const m = getGameMeta(id);
  if (!m) return '';
  const p = String(phase || 'warmup').toLowerCase() === 'cooldown' ? 'cooldown' : 'warmup';
  if (p === 'warmup') return m.warmupFile || '';
  return m.cooldownFile || '';
}

export function getGameStyleFile(id) {
  const m = getGameMeta(id);
  return m ? m.styleFile || '' : '';
}

export function getRunFile(id) {
  const m = getGameMeta(id);
  return m ? m.runFile || '' : '';
}

export function getRunCandidates(id) {
  const m = getGameMeta(id);
  return m && Array.isArray(m.runCandidates) ? m.runCandidates.slice() : [];
}

export function getSummaryPath(id) {
  const m = getGameMeta(id);
  return m ? m.summaryPath || '' : '';
}

export function listGameIds() {
  return Object.keys(GAME_REGISTRY);
}

export default {
  PATCH: PATCH,
  GAME_REGISTRY: GAME_REGISTRY,
  normalizeGameId: normalizeGameId,
  getGameMeta: getGameMeta,
  hasGameMeta: hasGameMeta,
  getPhaseFile: getPhaseFile,
  getGameStyleFile: getGameStyleFile,
  getRunFile: getRunFile,
  getRunCandidates: getRunCandidates,
  getSummaryPath: getSummaryPath,
  listGameIds: listGameIds
};
