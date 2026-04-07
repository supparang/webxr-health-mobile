// === /goodjunk-intervention/research/config.js ===
// ROUTE + QUERY CONTEXT HELPERS
// PATCH v20260407a-GJI-ROUTES-COMPLETION-PARENT

export const ROUTES = {
  PRE_KNOWLEDGE: '../assessments/pre-knowledge.html',
  PRE_BEHAVIOR: '../assessments/pre-behavior.html',
  GAME: '../game/goodjunk-vr.html',
  POST_KNOWLEDGE: '../assessments/post-knowledge.html',
  POST_BEHAVIOR: '../assessments/post-behavior.html',
  POST_CHOICE: '../assessments/post-choice.html',
  COMPLETION: '../assessments/completion.html',
  PARENT_SUMMARY: '../parent/parent-summary.html'
};

const CTX_KEYS = [
  'pid', 'name', 'studyId',
  'studentKey', 'nickName',
  'session', 'sessionId',
  'condition', 'conditionGroup',
  'classRoom', 'classroom',
  'school', 'schoolName',
  'group',
  'lang',
  'mode', 'role',
  'roomId', 'room',
  'startAt',
  'diff', 'time', 'seed',
  'view', 'run', 'gameId',
  'hub',
  'host',
  'returnUrl'
];

function clean(v) {
  return String(v ?? '').trim();
}

export function normalizeCtx(input = {}) {
  const ctx = { ...(input || {}) };

  return {
    pid: clean(ctx.pid || ctx.studentKey),
    name: clean(ctx.name || ctx.nickName),
    studyId: clean(ctx.studyId),

    studentKey: clean(ctx.studentKey || ctx.pid),
    nickName: clean(ctx.nickName || ctx.name),

    session: clean(ctx.session || ctx.sessionId),
    sessionId: clean(ctx.sessionId || ctx.session),

    condition: clean(ctx.condition || ctx.conditionGroup),
    conditionGroup: clean(ctx.conditionGroup || ctx.condition),

    classRoom: clean(ctx.classRoom || ctx.classroom),
    classroom: clean(ctx.classroom || ctx.classRoom),

    school: clean(ctx.school || ctx.schoolName),
    schoolName: clean(ctx.schoolName || ctx.school),

    group: clean(
      ctx.group ||
      ctx.classRoom ||
      ctx.classroom ||
      ctx.conditionGroup ||
      ctx.condition
    ),

    lang: clean(ctx.lang || 'th'),

    mode: clean(ctx.mode),
    role: clean(ctx.role),

    roomId: clean(ctx.roomId || ctx.room).toUpperCase(),
    room: clean(ctx.room || ctx.roomId).toUpperCase(),

    startAt: clean(ctx.startAt),

    diff: clean(ctx.diff),
    time: clean(ctx.time),
    seed: clean(ctx.seed),

    view: clean(ctx.view),
    run: clean(ctx.run),
    gameId: clean(ctx.gameId || 'goodjunk'),

    hub: clean(ctx.hub),
    host: clean(ctx.host),
    returnUrl: clean(ctx.returnUrl)
  };
}

export function pickCtxFromQuery(search = window.location.search) {
  const q = new URLSearchParams(search || '');
  const raw = {};

  for (const key of CTX_KEYS) {
    const value = q.get(key);
    if (value != null && clean(value) !== '') {
      raw[key] = value;
    }
  }

  return normalizeCtx(raw);
}

export function buildQuery(ctx = {}, keepEmpty = false) {
  const norm = normalizeCtx(ctx);
  const q = new URLSearchParams();

  for (const key of CTX_KEYS) {
    const value = norm[key];
    if (keepEmpty || clean(value) !== '') {
      if (clean(value) !== '' || keepEmpty) {
        q.set(key, value ?? '');
      }
    }
  }

  return q.toString();
}

export function buildUrl(nextKey, ctx = {}, keepEmpty = false) {
  const route = ROUTES[nextKey];
  if (!route) {
    throw new Error(`Unknown route key: ${nextKey}`);
  }

  const query = buildQuery(ctx, keepEmpty);
  return query ? `${route}?${query}` : route;
}