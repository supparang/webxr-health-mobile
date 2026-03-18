// === /goodjunk-intervention/research/localstore.js ===
// STORAGE HELPERS
// PATCH v20260318a-GJI-LOCALSTORE

export const KEYS = {
  CTX: 'GJI_CTX',
  COMPLETED: 'GJI_COMPLETED',

  PRE_KNOWLEDGE: 'GJI_PRE_KNOWLEDGE',
  PRE_BEHAVIOR: 'GJI_PRE_BEHAVIOR',

  GAME_SUMMARY: 'GJI_GAME_SUMMARY',
  GAME_EVENTS: 'GJI_GAME_EVENTS',

  POST_KNOWLEDGE: 'GJI_POST_KNOWLEDGE',
  POST_BEHAVIOR: 'GJI_POST_BEHAVIOR',
  POST_CHOICE: 'GJI_POST_CHOICE',

  SHORT_FOLLOWUP: 'GJI_SHORT_FOLLOWUP',
  WEEKLY_CHECK: 'GJI_WEEKLY_CHECK',

  PARENT_RESPONSE: 'GJI_PARENT_RESPONSE',
};

export const PAGE_TO_KEY = {
  'pre-knowledge.html': KEYS.PRE_KNOWLEDGE,
  'pre-behavior.html': KEYS.PRE_BEHAVIOR,
  'post-knowledge.html': KEYS.POST_KNOWLEDGE,
  'post-behavior.html': KEYS.POST_BEHAVIOR,
  'post-choice.html': KEYS.POST_CHOICE,
  'short-followup.html': KEYS.SHORT_FOLLOWUP,
  'weekly-check.html': KEYS.WEEKLY_CHECK,
  'parent-questionnaire.html': KEYS.PARENT_RESPONSE,
};

function hasStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function saveRaw(key, value) {
  if (!hasStorage()) return;
  localStorage.setItem(key, value);
}

export function loadRaw(key, fallback = null) {
  if (!hasStorage()) return fallback;
  const value = localStorage.getItem(key);
  return value === null ? fallback : value;
}

export function saveJSON(key, value) {
  saveRaw(key, JSON.stringify(value));
}

export function loadJSON(key, fallback = null) {
  const raw = loadRaw(key, null);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function removeKey(key) {
  if (!hasStorage()) return;
  localStorage.removeItem(key);
}

export function pageStorageKey(filename) {
  return PAGE_TO_KEY[filename] ?? `GJI_PAGE_${String(filename).replace(/\W+/g, '_').toUpperCase()}`;
}

export function saveCtx(ctx = {}) {
  const oldCtx = loadCtx();
  const merged = { ...oldCtx, ...ctx };
  saveJSON(KEYS.CTX, merged);
  return merged;
}

export function loadCtx() {
  return loadJSON(KEYS.CTX, {}) || {};
}

export function mergeCtx(partial = {}) {
  return saveCtx(partial);
}

export function saveAssessment(filename, payload = {}) {
  const key = pageStorageKey(filename);
  saveJSON(key, payload);
  return key;
}

export function loadAssessment(filename, fallback = {}) {
  return loadJSON(pageStorageKey(filename), fallback) || fallback;
}

export function markCompleted(extra = {}) {
  const payload = {
    done: true,
    at: new Date().toISOString(),
    ...extra
  };
  saveJSON(KEYS.COMPLETED, payload);
  return payload;
}

export function loadCompleted() {
  return loadJSON(KEYS.COMPLETED, null);
}

export function clearSessionData() {
  const keepCtx = loadCtx();
  const keys = Object.values(KEYS);
  for (const key of keys) removeKey(key);
  saveCtx(keepCtx);
}