// === /herohealth/shared/nutrition-logging.js ===
// Lightweight local logger for nutrition games
// PATCH v20260318-GROUPS-VSLICE-A

export function createLogger(ctx, gameId) {
  const startedAt = Date.now();
  const sessionId = `${gameId}-${ctx.pid}-${startedAt}`;
  const buffer = [];

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
  }

  function flush(reason = 'manual') {
    try {
      const key = `HHA_LOG_${gameId.toUpperCase()}`;
      const prev = JSON.parse(localStorage.getItem(key) || '[]');

      prev.push({
        sessionId,
        reason,
        startedAt,
        endedAt: Date.now(),
        events: buffer
      });

      localStorage.setItem(key, JSON.stringify(prev.slice(-50)));
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