// /herohealth/vr-brush-kids/brush.logger.js

import { GAME_ID, GAME_VARIANT, GAME_TITLE, ZONE } from './brush.constants.js';

function nowIso() {
  return new Date().toISOString();
}

function makeSessionId() {
  return `brush-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBrushLogger(ctx = {}) {
  const sessionId = makeSessionId();
  let sessionStartedAtMs = performance.now();
  let currentSceneId = 'launcher';
  let baseCtx = {
    sessionId,
    gameId: GAME_ID,
    gameVariant: GAME_VARIANT,
    gameTitle: GAME_TITLE,
    zone: ZONE,
    ...ctx
  };
  const buffer = [];

  function enrich(type, payload = {}) {
    return {
      type,
      at: nowIso(),
      timeFromStartMs: Math.round(performance.now() - sessionStartedAtMs),
      sceneId: currentSceneId,
      ...baseCtx,
      ...payload
    };
  }

  return {
    sessionId,
    updateContext(patch = {}) {
      baseCtx = { ...baseCtx, ...patch };
    },
    startSession(meta = {}) {
      sessionStartedAtMs = performance.now();
      buffer.push(enrich('brush_session_start', meta));
    },
    setScene(sceneId) {
      currentSceneId = sceneId;
    },
    event(type, payload = {}) {
      buffer.push(enrich(type, payload));
    },
    finish(result = {}) {
      buffer.push(enrich('brush_session_finish', {
        finalRank: result.finalRank || '',
        finalScore: result.finalScore || 0,
        coveragePercent: result.coveragePercent || 0
      }));
    },
    flush() {
      try {
        const key = 'HHA_BRUSH_LOG_BUFFER';
        const oldList = JSON.parse(localStorage.getItem(key) || '[]');
        oldList.push(...buffer);
        localStorage.setItem(key, JSON.stringify(oldList));
        buffer.length = 0;
      } catch (err) {
        console.warn('[BrushLogger] flush failed', err);
      }
    }
  };
}
