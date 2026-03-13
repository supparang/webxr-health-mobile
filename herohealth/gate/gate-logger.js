// === /herohealth/gate/gate-logger.js ===
// HeroHealth Gate Logger
// PATCH v20260313b-GATE-LOGGER-PUSH-FIX
// ✅ always returns logger.push()
// ✅ keeps in-memory rows
// ✅ safe localStorage append
// ✅ console debug friendly

const LOG_KEY = 'HHA_GATE_LOGS';

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readStore() {
  try {
    return safeJsonParse(localStorage.getItem(LOG_KEY), []);
  } catch {
    return [];
  }
}

function writeStore(rows) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(-300)));
  } catch {}
}

export function createGateLogger(ctx = {}) {
  const rows = [];

  function normalizeType(type) {
    return String(type || 'event').trim() || 'event';
  }

  function baseRow() {
    return {
      ts: Date.now(),
      iso: new Date().toISOString(),
      pid: ctx.pid || 'anon',
      run: ctx.run || 'play',
      studyId: ctx.studyId || '',
      phase: ctx.phase || ctx.mode || '',
      mode: ctx.mode || ctx.phase || '',
      cat: ctx.cat || '',
      zone: ctx.zone || '',
      theme: ctx.theme || '',
      game: ctx.game || '',
      diff: ctx.diff || '',
      seed: ctx.seed || '',
      view: ctx.view || '',
      hub: ctx.hub || '',
      gate: true
    };
  }

  function push(type, payload = {}) {
    const row = {
      ...baseRow(),
      type: normalizeType(type),
      ...(payload || {})
    };

    rows.push(row);

    try {
      const all = readStore();
      all.push(row);
      writeStore(all);
    } catch {}

    try {
      console.log('[gate-log]', row);
    } catch {}

    return row;
  }

  function list() {
    return rows.slice();
  }

  function flush() {
    return rows.slice();
  }

  function clear() {
    rows.length = 0;
  }

  return {
    push,
    list,
    flush,
    clear
  };
}