const PREFIX = 'HHA';

function safeJsonParse(raw, fallback = null) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value, fallback = '') {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function makeKey(...parts) {
  return [PREFIX, ...parts].filter(Boolean).join('_');
}

export function loadJson(key, fallback = null) {
  try {
    return safeJsonParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, safeJsonStringify(value, 'null'));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function summaryKey(pid, zone = 'nutrition', gameId = 'game', mode = 'solo') {
  return makeKey('LAST_SUMMARY', pid || 'anon', zone, gameId, mode);
}

export function zoneProgressKey(pid, zone = 'nutrition', dateKey = localDateKey()) {
  return makeKey('ZONE_PROGRESS', pid || 'anon', zone, dateKey);
}

export function sessionDraftKey(pid, gameId = 'game', mode = 'solo') {
  return makeKey('SESSION_DRAFT', pid || 'anon', gameId, mode);
}

export function saveLastSummary(ctx, summary) {
  const payload = {
    ctx,
    summary,
    savedAt: Date.now(),
    savedIso: new Date().toISOString()
  };
  const k = summaryKey(ctx?.pid, ctx?.zone, ctx?.gameId, ctx?.mode);
  return saveJson(k, payload);
}

export function loadLastSummary(ctx) {
  const k = summaryKey(ctx?.pid, ctx?.zone, ctx?.gameId, ctx?.mode);
  return loadJson(k, null);
}

export function markZonePlayed(ctx, patch = {}) {
  const k = zoneProgressKey(ctx?.pid, ctx?.zone, localDateKey());
  const prev = loadJson(k, {
    pid: ctx?.pid || 'anon',
    zone: ctx?.zone || 'nutrition',
    dateKey: localDateKey(),
    games: {}
  });

  prev.games[ctx?.gameId || 'game'] = {
    mode: ctx?.mode || 'solo',
    playedAt: Date.now(),
    playedIso: new Date().toISOString(),
    ...patch
  };

  saveJson(k, prev);
  return prev;
}