const MODE_SET = new Set(['solo', 'duet', 'race', 'battle', 'coop']);
const VIEW_SET = new Set(['mobile', 'pc', 'cvr', 'vr']);
const RUN_SET = new Set(['play', 'research', 'demo']);
const DIFF_SET = new Set(['easy', 'normal', 'hard']);

function str(v, d = '') {
  return v == null || v === '' ? d : String(v);
}

function num(v, d = 0, min = -Infinity, max = Infinity) {
  v = Number(v);
  if (!Number.isFinite(v)) v = d;
  return Math.max(min, Math.min(max, v));
}

function bool01(v, d = 0) {
  if (v == null || v === '') return d;
  return String(v) === '1' ? 1 : 0;
}

function pick(v, allowed, d) {
  v = str(v, d);
  return allowed.has(v) ? v : d;
}

function guessHubUrl() {
  const origin = location.origin || '';
  const path = location.pathname || '';

  if (path.includes('/webxr-health-mobile/')) {
    return `${origin}/webxr-health-mobile/herohealth/hub.html`;
  }
  if (path.includes('/herohealth/')) {
    return `${origin}/herohealth/hub.html`;
  }
  return `${origin}/herohealth/hub.html`;
}

export function getNutritionCtx(overrides = {}) {
  const q = new URLSearchParams(location.search);

  const ctx = {
    pid: str(q.get('pid'), 'anon'),
    name: str(q.get('name'), ''),
    studyId: str(q.get('studyId'), ''),

    zone: str(q.get('zone'), 'nutrition'),
    cat: str(q.get('cat'), 'nutrition'),
    game: str(q.get('game'), ''),
    gameId: str(q.get('gameId'), str(q.get('game'), '')),
    mode: pick(q.get('mode'), MODE_SET, 'solo'),

    diff: pick(q.get('diff'), DIFF_SET, 'normal'),
    time: num(q.get('time'), 90, 15, 1800),
    seed: str(q.get('seed'), String(Date.now())),

    hub: str(q.get('hub'), guessHubUrl()),
    view: pick(q.get('view'), VIEW_SET, 'mobile'),
    run: pick(q.get('run'), RUN_SET, 'play'),

    phase: str(q.get('phase'), 'main'),
    gate: bool01(q.get('gate'), 1),
    cooldown: bool01(q.get('cooldown'), 1),

    sessionNo: num(q.get('sessionNo'), 0, 0, 9999),
    weekNo: num(q.get('weekNo'), 0, 0, 9999),

    api: str(q.get('api'), window.HHA_APPS_SCRIPT_URL || ''),
    log: str(q.get('log'), ''),
    debug: bool01(q.get('debug'), 0),

    roomId: str(q.get('roomId'), ''),
    matchId: str(q.get('matchId'), ''),
    teamId: str(q.get('teamId'), ''),
    opponentId: str(q.get('opponentId'), ''),

    returnPhase: str(q.get('returnPhase'), ''),
    theme: str(q.get('theme'), str(q.get('gameId'), 'nutrition'))
  };

  return { ...ctx, ...overrides };
}

export function serializeCtx(ctx, keys) {
  const pickKeys = keys || [
    'pid', 'name', 'studyId', 'zone', 'cat', 'game', 'gameId', 'mode',
    'diff', 'time', 'seed', 'hub', 'view', 'run', 'phase', 'gate', 'cooldown',
    'sessionNo', 'weekNo', 'api', 'log', 'debug', 'roomId', 'matchId', 'teamId',
    'opponentId', 'returnPhase', 'theme'
  ];

  const out = new URLSearchParams();
  for (const key of pickKeys) {
    const v = ctx[key];
    if (v == null || v === '') continue;
    out.set(key, String(v));
  }
  return out;
}

export function withMergedQuery(baseUrl, patch = {}, keepHash = true) {
  const url = new URL(baseUrl, location.href);
  const next = new URLSearchParams(url.search);

  for (const [k, v] of Object.entries(patch || {})) {
    if (v == null || v === '') next.delete(k);
    else next.set(k, String(v));
  }

  url.search = next.toString();
  if (!keepHash) url.hash = '';
  return url.toString();
}

export function buildLauncherCtx(ctx, patch = {}) {
  return { ...ctx, phase: 'main', ...patch };
}

export function buildRunCtx(ctx, patch = {}) {
  return { ...ctx, phase: 'main', ...patch };
}

export function buildCooldownCtx(ctx, patch = {}) {
  return { ...ctx, phase: 'cooldown', ...patch };
}

export function isResearchRun(ctx) {
  return String(ctx?.run || '') === 'research';
}

export function isMultiplayerMode(mode) {
  return mode === 'duet' || mode === 'race' || mode === 'battle' || mode === 'coop';
}