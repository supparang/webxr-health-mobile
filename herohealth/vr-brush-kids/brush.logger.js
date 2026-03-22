const BUFFER_KEY = 'HHA_EVENT_BUFFER_BRUSH';

const CANONICAL_GAME_ID = 'brush';
const CANONICAL_GAME_VARIANT = 'kids-vr';
const CANONICAL_GAME_TITLE = 'Brush Kids';
const CANONICAL_ZONE = 'hygiene';

export function createBrushLogger(runCtx = {}) {
  const sessionId = runCtx.sessionId || makeSessionId();
  const startedAt = new Date().toISOString();
  let queue = [];

  function baseRow() {
    return {
      timestampIso: new Date().toISOString(),

      projectTag: 'herohealth',
      runMode: runCtx.runMode || 'play',
      studyId: runCtx.studyId || '',
      phase: runCtx.phase || '',
      conditionGroup: runCtx.conditionGroup || '',

      sessionId,

      gameId: runCtx.gameId || CANONICAL_GAME_ID,
      gameVariant: runCtx.variant || CANONICAL_GAME_VARIANT,
      gameTitle: runCtx.gameTitle || CANONICAL_GAME_TITLE,
      zone: runCtx.zone || CANONICAL_ZONE,

      pid: runCtx.pid || '',
      seed: runCtx.seed || '',
      modeId: runCtx.modeId || '',
      view: runCtx.view || '',

      logVersion: 'brush-v2'
    };
  }

  function startSession(extra = {}) {
    event('session_start', {
      startedAtIso: startedAt,
      ...extra
    });
  }

  function event(eventType, extra = {}) {
    const row = {
      ...baseRow(),
      eventType,
      ...extra
    };

    queue.push(row);
    persistRow(row);
  }

  function finish(result = {}) {
    event('session_finish', {
      durationPlayedSec: result.durationPlayedSec ?? '',
      coveragePercent: result.coveragePercent ?? '',
      zonesDone: result.zonesDone ?? '',
      zonesTotal: result.zonesTotal ?? '',
      warnings: result.warnings ?? '',
      comboMax: result.comboMax ?? '',
      finalRank: result.finalRank ?? ''
    });
  }

  async function flush() {
    const logUrl = runCtx.log || '';
    if (!logUrl || !queue.length) return false;

    const payload = {
      sessionId,
      gameId: runCtx.gameId || CANONICAL_GAME_ID,
      gameVariant: runCtx.variant || CANONICAL_GAME_VARIANT,
      gameTitle: runCtx.gameTitle || CANONICAL_GAME_TITLE,
      zone: runCtx.zone || CANONICAL_ZONE,
      count: queue.length,
      rows: queue.slice()
    };

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json'
        });
        const ok = navigator.sendBeacon(logUrl, blob);
        if (ok) {
          queue = [];
          return true;
        }
      }

      const res = await fetch(logUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
        keepalive: true
      });

      if (res.ok) {
        queue = [];
        return true;
      }
    } catch {}

    return false;
  }

  function getSessionId() {
    return sessionId;
  }

  return {
    startSession,
    event,
    finish,
    flush,
    getSessionId
  };
}

function persistRow(row) {
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(row);
    localStorage.setItem(BUFFER_KEY, JSON.stringify(arr.slice(-2000)));
  } catch {}
}

function makeSessionId() {
  return `brush-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}