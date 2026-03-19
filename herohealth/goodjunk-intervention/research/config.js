// === /herohealth/goodjunk-intervention/research/config.js ===
// ROUTE + CONTEXT HELPERS
// PATCH v20260319a-GJI-CONFIG

const QUERY_KEYS = [
  'pid',
  'studentKey',
  'nickName',
  'name',
  'studyId',
  'phase',
  'group',
  'condition',
  'conditionGroup',
  'session',
  'sessionId',
  'classroom',
  'classRoom',
  'school',
  'schoolName',
  'diff',
  'view',
  'mode',
  'run',
  'time',
  'lang',
  'hub',
  'projectTag',
  'sessionOrder',
  'blockLabel',
  'schoolCode',
  'studentNo',
  'gradeLevel',
  'gender',
  'age',
  'seed',
  'gameId',
  'kid',
  'readable',
  'spawnDebug',
  'roomId',
  'room',
  'startAt'
];

export const ROUTES = {
  PORTAL: 'index.html',
  TEACHER_PANEL: 'launcher/teacher-panel.html',
  STUDENT_LAUNCHER: 'launcher/student-launcher.html',

  PRE_KNOWLEDGE: 'assessments/pre-knowledge.html',
  PRE_BEHAVIOR: 'assessments/pre-behavior.html',

  GAME: 'game/goodjunk-vr.html',
  GAME_SUMMARY: 'game/goodjunk-vr.html',

  POST_KNOWLEDGE: 'assessments/post-knowledge.html',
  POST_BEHAVIOR: 'assessments/post-behavior.html',
  POST_CHOICE: 'assessments/post-choice.html',
  COMPLETION: 'assessments/completion.html',

  PARENT_FORM: 'parent/parent-questionnaire.html',
  PARENT_SUMMARY: 'parent/parent-summary.html',

  SHORT_FOLLOWUP: 'followup/short-followup.html',
  WEEKLY_CHECK: 'followup/weekly-check.html',

  SESSION_SUMMARY_TOOL: 'tools/session-summary.html',
  TEACHER_DEBUG_DASHBOARD: 'tools/teacher-debug-dashboard.html',
  EXPORT_RESEARCH_BUNDLE: 'tools/export-research-bundle.html',
  MERGE_RESEARCH_DATASETS: 'tools/merge-research-datasets.html'
};

function q(key, fallback = '') {
  try {
    return new URL(window.location.href).searchParams.get(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeUrl(input, fallback) {
  try {
    return new URL(input);
  } catch {
    return fallback;
  }
}

export function getProjectRootUrl() {
  const current = safeUrl(window.location.href, null);
  if (!current) return new URL('./', window.location.href);

  const marker = '/herohealth/goodjunk-intervention/';
  const idx = current.pathname.indexOf(marker);

  if (idx >= 0) {
    const path = current.pathname.slice(0, idx + marker.length);
    return new URL(`${current.origin}${path}`);
  }

  const rootMarker = '/goodjunk-intervention/';
  const idx2 = current.pathname.indexOf(rootMarker);
  if (idx2 >= 0) {
    const path = current.pathname.slice(0, idx2 + rootMarker.length);
    return new URL(`${current.origin}${path}`);
  }

  return new URL('./', current.href);
}

export function routePath(routeKeyOrPath) {
  if (!routeKeyOrPath) return '';
  return ROUTES[routeKeyOrPath] || String(routeKeyOrPath);
}

export function normalizeCtx(ctx = {}) {
  const out = { ...ctx };

  if (!out.pid) out.pid = out.studentKey || out.nickName || out.name || '';
  if (!out.studentKey) out.studentKey = out.pid || '';

  if (!out.name) out.name = out.nickName || out.studentKey || out.pid || '';
  if (!out.nickName) out.nickName = out.name || out.studentKey || out.pid || '';

  if (!out.group) {
    out.group =
      out.classRoom ||
      out.classroom ||
      out.conditionGroup ||
      out.condition ||
      '';
  }

  if (!out.classRoom) out.classRoom = out.classroom || '';
  if (!out.classroom) out.classroom = out.classRoom || '';

  if (!out.condition) out.condition = out.conditionGroup || 'intervention';
  if (!out.conditionGroup) out.conditionGroup = out.condition || 'intervention';

  if (!out.session) out.session = out.sessionId || '';
  if (!out.sessionId) out.sessionId = out.session || '';

  if (!out.school) out.school = out.schoolName || '';
  if (!out.schoolName) out.schoolName = out.school || '';

  if (!out.mode) out.mode = out.run || 'play';
  if (!out.run) out.run = out.mode || 'play';

  if (!out.phase) out.phase = 'pretest';
  if (!out.diff) out.diff = 'easy';
  if (!out.view) out.view = 'mobile';
  if (!out.time) out.time = '80';
  if (!out.lang) out.lang = 'th';
  if (!out.gameId) out.gameId = 'goodjunk';
  if (!out.hub) out.hub = '../../hub.html';

  if (out.kid == null) out.kid = '1';
  if (out.readable == null) out.readable = '1';
  if (out.spawnDebug == null) out.spawnDebug = '0';

  return out;
}

export function withDefaultCtx(ctx = {}) {
  return normalizeCtx(ctx);
}

export function pickCtxFromQuery() {
  const out = {};
  for (const key of QUERY_KEYS) {
    const value = q(key, '');
    if (value !== '') out[key] = value;
  }
  return normalizeCtx(out);
}

export function ctxToQueryObject(ctx = {}) {
  const c = normalizeCtx(ctx);
  return {
    pid: c.pid || '',
    studentKey: c.studentKey || '',
    nickName: c.nickName || '',
    name: c.name || '',
    studyId: c.studyId || '',
    phase: c.phase || '',
    group: c.group || '',
    condition: c.condition || '',
    conditionGroup: c.conditionGroup || '',
    session: c.session || '',
    sessionId: c.sessionId || '',
    classroom: c.classroom || '',
    classRoom: c.classRoom || '',
    school: c.school || '',
    schoolName: c.schoolName || '',
    diff: c.diff || 'easy',
    view: c.view || 'mobile',
    mode: c.mode || c.run || 'play',
    run: c.run || c.mode || 'play',
    time: c.time || '80',
    lang: c.lang || 'th',
    hub: c.hub || '../../hub.html',
    projectTag: c.projectTag || '',
    sessionOrder: c.sessionOrder || '',
    blockLabel: c.blockLabel || '',
    schoolCode: c.schoolCode || '',
    studentNo: c.studentNo || '',
    gradeLevel: c.gradeLevel || '',
    gender: c.gender || '',
    age: c.age || '',
    seed: c.seed || '',
    gameId: c.gameId || 'goodjunk',
    kid: c.kid ?? '1',
    readable: c.readable ?? '1',
    spawnDebug: c.spawnDebug ?? '0',
    roomId: c.roomId || '',
    startAt: c.startAt || ''
  };
}

export function buildUrl(routeKeyOrPath, ctx = {}, includeEmpty = false) {
  const path = routePath(routeKeyOrPath);
  const rootBase = getProjectRootUrl();

  let target;
  if (ROUTES[routeKeyOrPath]) {
    target = new URL(path, rootBase);
  } else {
    target = new URL(path, window.location.href);
  }

  const queryObj = ctxToQueryObject(ctx);

  Object.entries(queryObj).forEach(([key, value]) => {
    const v = value == null ? '' : String(value);
    if (includeEmpty || v !== '') {
      target.searchParams.set(key, v);
    }
  });

  return target.toString();
}