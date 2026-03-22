// === /herohealth/shared/nutrition-logging.js ===
// Lightweight local logger for nutrition games
// PATCH v20260318-NUTRITION-SHARED-FULL

import { normalizeGameKey } from './nutrition-common.js';

function safeParseArray(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createLogger(ctx, gameId) {
  const startedAt = Date.now();
  const sessionId = `${gameId}-${ctx.pid}-${startedAt}`;
  const buffer = [];
  let flushCount = 0;

  function log(event, data = {}) {
    buffer.push({
      ts: Date.now(),
      sessionId,
      pid: ctx.pid,
      gameId,
      phase: ctx.phase,
      run: ctx.run,
      event,
      data
    });

    if (buffer.length > 600) {
      buffer.splice(0, buffer.length - 600);
    }
  }

  function flush(reason = 'manual') {
    try {
      const key = `HHA_LOG_${normalizeGameKey(gameId)}`;
      const prev = safeParseArray(localStorage.getItem(key));

      const record = {
        sessionId,
        pid: ctx.pid,
        gameId,
        reason,
        startedAt,
        endedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        flushCount: flushCount + 1,
        events: buffer.slice()
      };

      const idx = prev.findIndex(item => item?.sessionId === sessionId);
      if (idx >= 0) {
        prev[idx] = record;
      } else {
        prev.push(record);
      }

      localStorage.setItem(key, JSON.stringify(prev.slice(-80)));
      flushCount += 1;
      return true;
    } catch (err) {
      console.warn('[nutrition-logging] flush failed:', err);
      return false;
    }
  }

  function getSessionMeta() {
    return {
      sessionId,
      startedAt,
      endedAt: Date.now(),
      durationMs: Date.now() - startedAt
    };
  }

  return {
    log,
    flush,
    getSessionMeta
  };
}