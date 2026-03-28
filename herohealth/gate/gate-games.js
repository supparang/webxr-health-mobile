// === /herohealth/gate/gate-games.js ===
// FULL PATCH v20260328b-GATE-GAMES-GOODJUNK-SOLO-BOSS-ABS

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

  return x;
}

function clean(v) {
  return String(v || '').trim();
}

function defaultHubUrl() {
  return new URL('/herohealth/hub.html', location.origin).toString();
}

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

const GAME_META = {
  goodjunk: {
    id: 'goodjunk',
    title: 'GoodJunk Solo Boss v2',
    shortTitle: 'GoodJunk',
    zone: 'nutrition',
    category: 'nutrition',
    theme: 'goodjunk',

    launcherPath: '/herohealth/goodjunk-launcher.html',
    warmupPath: '/herohealth/warmup-gate.html',
    runPath: '/herohealth/goodjunk-vr.html',
    cooldownPath: '/herohealth/warmup-gate.html',
    hubPath: '/herohealth/hub.html',

    supports: {
      warmup: true,
      cooldown: true,
      solo: true,
      multiplayer: false
    },

    buildRunUrl: buildGoodJunkRunUrl,
    buildCooldownGateUrl: buildGoodJunkCooldownGateUrl
  }
};

export function getGameMeta(gameId = '') {
  const key = normalizeGameId(gameId);
  return GAME_META[key] || null;
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