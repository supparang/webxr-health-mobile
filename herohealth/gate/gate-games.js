// === /herohealth/gate/gate-games.js ===
// FULL PATCH v20260328c-GATE-GAMES-GOODJUNK-SHADOWBREAKER-COMPAT

function clean(v) {
  return String(v || '').trim();
}

function defaultHubUrl() {
  return new URL('/herohealth/hub.html', location.origin).toString();
}

export function normalizeGameId(id = '') {
  const x = String(id || '').trim().toLowerCase();

  if (!x) return '';

  if (
    x === 'goodjunk' ||
    x === 'goodjunkv1' ||
    x === 'goodjunkv2' ||
    x === 'good-junk' ||
    x === 'good_junk' ||
    x === 'nutrition-goodjunk' ||
    x === 'goodjunk-solo' ||
    x === 'goodjunk-boss' ||
    x === 'goodjunk-solo-boss'
  ) {
    return 'goodjunk';
  }

  if (
    x === 'shadowbreaker' ||
    x === 'shadow-breaker' ||
    x === 'shadow_breaker' ||
    x === 'shadowbreaker-vr' ||
    x === 'fitness-shadowbreaker'
  ) {
    return 'shadowbreaker';
  }

  return x;
}

/* -------------------------------------------------------
 * GOODJUNK
 * ----------------------------------------------------- */

function buildGoodJunkRunUrl(params = {}) {
  const url = new URL('/herohealth/goodjunk-vr.html', location.origin);

  url.searchParams.set('pid', clean(params.pid) || 'anon');
  url.searchParams.set('name', clean(params.name) || 'Hero');
  if (clean(params.studyId)) url.searchParams.set('studyId', clean(params.studyId));

  url.searchParams.set('mode', 'solo');
  url.searchParams.set('diff', clean(params.diff) || 'normal');
  url.searchParams.set('time', clean(params.time) || '150');
  url.searchParams.set('seed', clean(params.seed) || String(Date.now()));
  url.searchParams.set('hub', clean(params.hub) || defaultHubUrl());
  url.searchParams.set('view', clean(params.view) || 'mobile');
  url.searchParams.set('run', clean(params.run) || 'play');
  url.searchParams.set('gameId', 'goodjunk');
  url.searchParams.set('game', 'goodjunk');
  url.searchParams.set('theme', 'goodjunk');
  url.searchParams.set('cat', 'nutrition');
  url.searchParams.set('zone', 'nutrition');

  if (clean(params.api)) url.searchParams.set('api', clean(params.api));
  if (clean(params.conditionGroup)) url.searchParams.set('conditionGroup', clean(params.conditionGroup));
  if (clean(params.phaseTag)) url.searchParams.set('phase', clean(params.phaseTag));
  if (clean(params.studentKey)) url.searchParams.set('studentKey', clean(params.studentKey));
  if (clean(params.schoolCode)) url.searchParams.set('schoolCode', clean(params.schoolCode));
  if (clean(params.classRoom)) url.searchParams.set('classRoom', clean(params.classRoom));
  if (clean(params.studentNo)) url.searchParams.set('studentNo', clean(params.studentNo));
  if (clean(params.nickName)) url.searchParams.set('nickName', clean(params.nickName));

  if (clean(params.wType)) url.searchParams.set('wType', clean(params.wType));
  if (clean(params.wPct)) url.searchParams.set('wPct', clean(params.wPct));
  if (clean(params.wCrit)) url.searchParams.set('wCrit', clean(params.wCrit));
  if (clean(params.wDmg)) url.searchParams.set('wDmg', clean(params.wDmg));
  if (clean(params.wHeal)) url.searchParams.set('wHeal', clean(params.wHeal));
  if (clean(params.rank)) url.searchParams.set('rank', clean(params.rank));
  if (clean(params.calm)) url.searchParams.set('calm', clean(params.calm));

  return url.toString();
}

function buildGoodJunkCooldownGateUrl(params = {}) {
  const gate = new URL('/herohealth/warmup-gate.html', location.origin);

  gate.searchParams.set('phase', 'cooldown');
  gate.searchParams.set('gatePhase', 'cooldown');
  gate.searchParams.set('game', 'goodjunk');
  gate.searchParams.set('gameId', 'goodjunk');
  gate.searchParams.set('theme', 'goodjunk');
  gate.searchParams.set('cat', 'nutrition');
  gate.searchParams.set('zone', 'nutrition');

  gate.searchParams.set('pid', clean(params.pid) || 'anon');
  gate.searchParams.set('name', clean(params.name) || 'Hero');
  if (clean(params.studyId)) gate.searchParams.set('studyId', clean(params.studyId));

  gate.searchParams.set('diff', clean(params.diff) || 'normal');
  gate.searchParams.set('time', clean(params.time) || '150');
  gate.searchParams.set('seed', clean(params.seed) || String(Date.now()));
  gate.searchParams.set('hub', clean(params.hub) || defaultHubUrl());
  gate.searchParams.set('view', clean(params.view) || 'mobile');
  gate.searchParams.set('run', clean(params.run) || 'play');
  gate.searchParams.set('forcegate', '1');

  if (clean(params.api)) gate.searchParams.set('api', clean(params.api));
  if (clean(params.conditionGroup)) gate.searchParams.set('conditionGroup', clean(params.conditionGroup));
  if (clean(params.phaseTag)) gate.searchParams.set('phaseTag', clean(params.phaseTag));
  if (clean(params.studentKey)) gate.searchParams.set('studentKey', clean(params.studentKey));
  if (clean(params.schoolCode)) gate.searchParams.set('schoolCode', clean(params.schoolCode));
  if (clean(params.classRoom)) gate.searchParams.set('classRoom', clean(params.classRoom));
  if (clean(params.studentNo)) gate.searchParams.set('studentNo', clean(params.studentNo));
  if (clean(params.nickName)) gate.searchParams.set('nickName', clean(params.nickName));

  return gate.toString();
}

/* -------------------------------------------------------
 * SHADOW BREAKER
 * ----------------------------------------------------- */

function buildShadowBreakerRunUrl(params = {}) {
  const url = new URL('/fitness/shadow-breaker.html', location.origin);

  url.searchParams.set('pid', clean(params.pid) || 'anon');
  url.searchParams.set('diff', clean(params.diff) || 'normal');
  url.searchParams.set('time', clean(params.time) || '80');
  url.searchParams.set('seed', clean(params.seed) || String(Date.now()));
  url.searchParams.set('hub', clean(params.hub) || defaultHubUrl());
  url.searchParams.set('view', clean(params.view) || 'mobile');

  const runMode = clean(params.run) || clean(params.mode) || 'normal';
  url.searchParams.set('run', runMode);
  url.searchParams.set('mode', runMode);

  url.searchParams.set('game', 'shadowbreaker');
  url.searchParams.set('gameId', 'shadowbreaker');
  url.searchParams.set('theme', 'shadowbreaker');
  url.searchParams.set('cat', 'fitness');
  url.searchParams.set('zone', 'fitness');

  url.searchParams.set('finalGame', '/webxr-health-mobile/fitness/shadow-breaker.html');
  url.searchParams.set('plannedGame', '/webxr-health-mobile/fitness/shadow-breaker.html');

  if (clean(params.studyId)) url.searchParams.set('studyId', clean(params.studyId));
  if (clean(params.group)) url.searchParams.set('group', clean(params.group));
  if (clean(params.conditionGroup)) url.searchParams.set('conditionGroup', clean(params.conditionGroup));

  return url.toString();
}

function buildShadowBreakerCooldownGateUrl(params = {}) {
  const gate = new URL('/herohealth/warmup-gate.html', location.origin);

  const runMode = clean(params.run) || clean(params.mode) || 'normal';
  const hub = clean(params.hub) || defaultHubUrl();
  const pid = clean(params.pid) || 'anon';
  const diff = clean(params.diff) || 'normal';
  const time = clean(params.time) || '80';
  const seed = clean(params.seed) || String(Date.now());

  gate.searchParams.set('phase', 'cooldown');
  gate.searchParams.set('gatePhase', 'cooldown');
  gate.searchParams.set('game', 'shadowbreaker');
  gate.searchParams.set('gameId', 'shadowbreaker');
  gate.searchParams.set('theme', 'shadowbreaker');
  gate.searchParams.set('cat', 'fitness');
  gate.searchParams.set('zone', 'fitness');

  gate.searchParams.set('pid', pid);
  gate.searchParams.set('run', runMode);
  gate.searchParams.set('mode', runMode);
  gate.searchParams.set('diff', diff);
  gate.searchParams.set('time', time);
  gate.searchParams.set('seed', seed);
  gate.searchParams.set('hub', hub);
  gate.searchParams.set('view', clean(params.view) || 'mobile');
  gate.searchParams.set('forcegate', '1');

  if (clean(params.studyId)) gate.searchParams.set('studyId', clean(params.studyId));
  if (clean(params.group)) gate.searchParams.set('group', clean(params.group));
  if (clean(params.conditionGroup)) gate.searchParams.set('conditionGroup', clean(params.conditionGroup));

  const summaryUrl = new URL('/herohealth/shadow-breaker-summary.html', location.origin);
  summaryUrl.searchParams.set('pid', pid);
  summaryUrl.searchParams.set('hub', hub);
  summaryUrl.searchParams.set('diff', diff);
  summaryUrl.searchParams.set('mode', runMode);

  gate.searchParams.set('cdnext', summaryUrl.toString());

  return gate.toString();
}

/* -------------------------------------------------------
 * REGISTRY
 * ----------------------------------------------------- */

const GAME_META = {
  goodjunk: {
    id: 'goodjunk',
    title: 'GoodJunk Solo Boss v2',
    shortTitle: 'GoodJunk',
    label: 'GoodJunk',
    zone: 'nutrition',
    cat: 'nutrition',
    category: 'nutrition',
    theme: 'goodjunk',

    launcherPath: '/herohealth/goodjunk-launcher.html',
    warmupPath: '/herohealth/warmup-gate.html',
    runPath: '/herohealth/goodjunk-vr.html',
    cooldownPath: '/herohealth/warmup-gate.html',
    hubPath: '/herohealth/hub.html',

    warmupTitle: 'GoodJunk Warmup',
    cooldownTitle: 'GoodJunk Cooldown',

    supports: {
      warmup: true,
      cooldown: true,
      solo: true,
      multiplayer: false
    },

    run: '../goodjunk-vr.html',
    runCandidates: [
      '../goodjunk-vr.html',
      '/webxr-health-mobile/herohealth/goodjunk-vr.html'
    ],

    phases: {
      warmup: './games/goodjunk/warmup.js',
      cooldown: './games/goodjunk/cooldown.js'
    },

    gateStyle: '',
    buildRunUrl: buildGoodJunkRunUrl,
    buildCooldownGateUrl: buildGoodJunkCooldownGateUrl
  },

  shadowbreaker: {
    id: 'shadowbreaker',
    title: 'Shadow Breaker',
    shortTitle: 'Shadow Breaker',
    label: 'Shadow Breaker',
    zone: 'fitness',
    cat: 'fitness',
    category: 'fitness',
    theme: 'shadowbreaker',

    launcherPath: '/herohealth/shadow-breaker-vr.html',
    warmupPath: '/herohealth/warmup-gate.html',
    runPath: '/fitness/shadow-breaker.html',
    cooldownPath: '/herohealth/warmup-gate.html',
    hubPath: '/herohealth/hub.html',

    warmupTitle: 'Shadow Breaker Warmup',
    cooldownTitle: 'Shadow Breaker Cooldown',

    supports: {
      warmup: true,
      cooldown: true,
      solo: true,
      multiplayer: false
    },

    run: '../fitness/shadow-breaker.html',
    runCandidates: [
      '../fitness/shadow-breaker.html',
      '/webxr-health-mobile/fitness/shadow-breaker.html'
    ],

    phases: {
      warmup: './games/shadowbreaker/warmup.js',
      cooldown: './games/shadowbreaker/cooldown.js'
    },

    gateStyle: '',
    buildRunUrl: buildShadowBreakerRunUrl,
    buildCooldownGateUrl: buildShadowBreakerCooldownGateUrl
  }
};

/* -------------------------------------------------------
 * PUBLIC HELPERS
 * ----------------------------------------------------- */

export function getGameMeta(gameId = '') {
  const key = normalizeGameId(gameId);
  return GAME_META[key] || null;
}

export function getRunFile(gameId = '') {
  return getGameMeta(gameId)?.run || '';
}

export function getRunCandidates(gameId = '') {
  const meta = getGameMeta(gameId);
  if (!meta) return [];

  if (Array.isArray(meta.runCandidates) && meta.runCandidates.length) {
    return meta.runCandidates.filter(Boolean);
  }

  return meta.run ? [meta.run] : [];
}

export function getPhaseFile(gameId = '', phase = 'warmup') {
  const meta = getGameMeta(gameId);
  if (!meta) return '';

  const p = String(phase || 'warmup').trim().toLowerCase();
  return meta?.phases?.[p] || '';
}

export function getGameStyleFile(gameId = '') {
  const meta = getGameMeta(gameId);
  return meta?.gateStyle || '';
}

export function getRunUrl(gameId = '', params = {}) {
  const meta = getGameMeta(gameId);
  if (!meta || typeof meta.buildRunUrl !== 'function') return '';
  return meta.buildRunUrl(params);
}

export function getCooldownGateUrl(gameId = '', params = {}) {
  const meta = getGameMeta(gameId);
  if (!meta || typeof meta.buildCooldownGateUrl !== 'function') return '';
  return meta.buildCooldownGateUrl(params);
}