// === /herohealth/gate/gate-url.js ===
// FULL PATCH v20260407a-GATE-URL-BUILDER-STANDARD

function clean(v, d = '') {
  v = String(v ?? '').trim();
  return v || d;
}

function normalizeGameIdLoose(v = '') {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pick(obj, key, fallback = '') {
  if (!obj || typeof obj !== 'object') return fallback;
  return clean(obj[key], fallback);
}

export function getCanonicalHub(baseHref = location.href) {
  return new URL('./hub-v2.html', baseHref).href;
}

export function getCanonicalGate(baseHref = location.href) {
  return new URL('./warmup-gate.html', baseHref).href;
}

export function readCtxFromUrl(urlLike = location.href) {
  const u = new URL(urlLike, location.href);
  const q = u.searchParams;

  const gameRaw =
    q.get('game') ||
    q.get('gameId') ||
    q.get('theme') ||
    '';

  const game = normalizeGameIdLoose(gameRaw);

  return {
    pid: clean(q.get('pid'), localStorage.getItem('HH_PID') || 'anon'),
    name: clean(q.get('name'), clean(q.get('nickName'), localStorage.getItem('HH_NAME') || '')),
    studyId: clean(q.get('studyId'), ''),
    roomId: clean(q.get('roomId'), ''),
    diff: clean(q.get('diff'), 'normal'),
    time: clean(q.get('time'), '90'),
    seed: clean(q.get('seed'), String(Date.now())),
    hub: clean(q.get('hub'), getCanonicalHub(urlLike)),
    view: clean(q.get('view'), 'mobile'),
    run: clean(q.get('run'), 'play'),
    zone: clean(q.get('zone'), ''),
    cat: clean(q.get('cat'), clean(q.get('zone'), '')),
    scene: clean(q.get('scene'), ''),
    mode: clean(q.get('mode'), 'solo'),
    game,
    gameId: clean(q.get('gameId'), game),
    theme: clean(q.get('theme'), game),
    debug: clean(q.get('debug'), ''),
    api: clean(q.get('api'), ''),
    log: clean(q.get('log'), ''),
    studentKey: clean(q.get('studentKey'), ''),
    schoolCode: clean(q.get('schoolCode'), ''),
    classRoom: clean(q.get('classRoom'), ''),
    studentNo: clean(q.get('studentNo'), ''),
    conditionGroup: clean(q.get('conditionGroup'), '')
  };
}

export function buildPassthroughParams(ctx = {}, extra = {}) {
  const game = normalizeGameIdLoose(
    pick(ctx, 'game', pick(ctx, 'gameId', pick(ctx, 'theme', '')))
  );

  const payload = {
    pid: pick(ctx, 'pid', 'anon'),
    name: pick(ctx, 'name', ''),
    studyId: pick(ctx, 'studyId', ''),
    roomId: pick(ctx, 'roomId', ''),
    diff: pick(ctx, 'diff', 'normal'),
    time: pick(ctx, 'time', '90'),
    seed: pick(ctx, 'seed', String(Date.now())),
    hub: pick(ctx, 'hub', getCanonicalHub()),
    view: pick(ctx, 'view', 'mobile'),
    run: pick(ctx, 'run', 'play'),
    zone: pick(ctx, 'zone', ''),
    cat: pick(ctx, 'cat', pick(ctx, 'zone', '')),
    scene: pick(ctx, 'scene', ''),
    mode: pick(ctx, 'mode', 'solo'),
    game,
    gameId: normalizeGameIdLoose(pick(ctx, 'gameId', game)),
    theme: pick(ctx, 'theme', game),
    debug: pick(ctx, 'debug', ''),
    api: pick(ctx, 'api', ''),
    log: pick(ctx, 'log', ''),
    studentKey: pick(ctx, 'studentKey', ''),
    schoolCode: pick(ctx, 'schoolCode', ''),
    classRoom: pick(ctx, 'classRoom', ''),
    studentNo: pick(ctx, 'studentNo', ''),
    conditionGroup: pick(ctx, 'conditionGroup', '')
  };

  return { ...payload, ...extra };
}

export function applyParams(url, params = {}) {
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && String(v).trim() !== '') {
      url.searchParams.set(k, String(v));
    }
  });
  return url;
}

export function buildRunUrl(runHref, ctx = {}, extra = {}) {
  const url = new URL(runHref, location.href);
  const params = buildPassthroughParams(ctx, extra);
  applyParams(url, params);
  return url.toString();
}

export function buildGateUrl({
  phase = 'warmup',
  ctx = {},
  next = '',
  nextKey = '',
  cdnext = '',
  gateHref = '',
  extra = {}
} = {}) {
  const href = gateHref || getCanonicalGate(location.href);
  const url = new URL(href, location.href);

  const params = buildPassthroughParams(ctx, {
    phase: String(phase || 'warmup').toLowerCase() === 'cooldown' ? 'cooldown' : 'warmup',
    ...extra
  });

  applyParams(url, params);

  if (next) {
    url.searchParams.set('next', new URL(next, location.href).toString());
  }

  if (nextKey) {
    url.searchParams.set('nextKey', String(nextKey));
  }

  if (cdnext) {
    url.searchParams.set('cdnext', new URL(cdnext, location.href).toString());
  }

  return url.toString();
}

export function buildWarmupGateUrl(ctx = {}, next = '', extra = {}) {
  return buildGateUrl({
    phase: 'warmup',
    ctx,
    next,
    extra
  });
}

export function buildCooldownGateUrl(ctx = {}, extra = {}) {
  return buildGateUrl({
    phase: 'cooldown',
    ctx,
    cdnext: extra.cdnext || '',
    extra
  });
}

export default {
  getCanonicalHub,
  getCanonicalGate,
  readCtxFromUrl,
  buildPassthroughParams,
  buildRunUrl,
  buildGateUrl,
  buildWarmupGateUrl,
  buildCooldownGateUrl
};