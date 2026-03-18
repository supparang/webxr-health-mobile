// === /goodjunk-intervention/research/config.js ===
// CORE FLOW CONFIG
// PATCH v20260318a-GJI-CONFIG

export const APP_CONFIG = {
  appId: 'goodjunk-intervention',
  version: '20260318a-GJI-CONFIG',
  defaultLang: 'th',
  defaultStudyId: 'GJI-2026',
  defaultCondition: 'intervention',
  defaultGroup: 'grade5',
  defaultSession: 's1',
  researchMode: true,
};

export const ROUTES = {
  INDEX: 'index.html',

  STUDENT_LAUNCHER: 'launcher/student-launcher.html',
  TEACHER_PANEL: 'launcher/teacher-panel.html',

  GAME: 'game/goodjunk-vr.html',
  GAME_SUMMARY: 'game/summary.html',

  PRE_KNOWLEDGE: 'assessments/pre-knowledge.html',
  PRE_BEHAVIOR: 'assessments/pre-behavior.html',
  POST_KNOWLEDGE: 'assessments/post-knowledge.html',
  POST_BEHAVIOR: 'assessments/post-behavior.html',
  POST_CHOICE: 'assessments/post-choice.html',
  COMPLETION: 'assessments/completion.html',

  SHORT_FOLLOWUP: 'followup/short-followup.html',
  WEEKLY_CHECK: 'followup/weekly-check.html',

  PARENT_FORM: 'parent/parent-questionnaire.html',
  PARENT_SUMMARY: 'parent/parent-summary.html',
};

const CTX_KEYS = [
  'pid',
  'studyId',
  'group',
  'condition',
  'session',
  'lang',
  'teacher',
  'classroom',
  'school',
  'mode'
];

export function getProjectBase(pathname = (typeof window !== 'undefined' ? window.location.pathname : '/goodjunk-intervention/')) {
  const tokenA = '/goodjunk-intervention/';
  const iA = pathname.indexOf(tokenA);
  if (iA >= 0) return pathname.slice(0, iA + tokenA.length);

  const tokenB = '/goodjunk-intervention';
  const iB = pathname.indexOf(tokenB);
  if (iB >= 0) return `${pathname.slice(0, iB + tokenB.length)}/`;

  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return '/';
  return `/${parts.slice(0, -1).join('/')}/`;
}

export function toAbsoluteRoute(routeKeyOrPath) {
  const rel = ROUTES[routeKeyOrPath] ?? routeKeyOrPath ?? ROUTES.STUDENT_LAUNCHER;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = getProjectBase();
  return new URL(rel, `${origin}${base}`).toString();
}

export function pickCtxFromQuery(search = (typeof window !== 'undefined' ? window.location.search : '')) {
  const params = new URLSearchParams(search || '');
  const ctx = {};
  for (const key of CTX_KEYS) {
    const value = params.get(key);
    if (value !== null && value !== '') ctx[key] = value;
  }
  return ctx;
}

export function buildUrl(routeKeyOrPath, params = {}, preserveCurrent = true) {
  const url = new URL(toAbsoluteRoute(routeKeyOrPath));

  if (preserveCurrent && typeof window !== 'undefined') {
    const current = new URLSearchParams(window.location.search);
    for (const [k, v] of current.entries()) {
      if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    }
  }

  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }

  return url.toString();
}

export function withDefaultCtx(ctx = {}) {
  return {
    studyId: APP_CONFIG.defaultStudyId,
    group: APP_CONFIG.defaultGroup,
    condition: APP_CONFIG.defaultCondition,
    session: APP_CONFIG.defaultSession,
    lang: APP_CONFIG.defaultLang,
    ...ctx
  };
}