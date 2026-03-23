import { HYDRATION_V2_CONFIG } from './hydration-v2.config.js';

function safePushLocal(key, payload, maxKeep = 400) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(payload);
    while (arr.length > maxKeep) arr.shift();
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

function emitCloud(payload) {
  try {
    if (window.HHACloudLogger && typeof window.HHACloudLogger.log === 'function') {
      window.HHACloudLogger.log(payload);
    }
  } catch {}
}

export function createHydrationV2Logger(ctx) {
  function base(eventType, extra = {}) {
    return {
      timestampIso: new Date().toISOString(),
      projectTag: 'HeroHealth',
      runMode: ctx.runMode || 'play',
      studyId: ctx.studyId || '',
      phase: ctx.phase || '',
      conditionGroup: ctx.conditionGroup || '',
      sessionId: ctx.sessionId || '',
      eventType,
      gameMode: HYDRATION_V2_CONFIG.GAME_ID,
      studentKey: ctx.studentKey || '',
      schoolCode: ctx.schoolCode || '',
      classRoom: ctx.classRoom || '',
      studentNo: ctx.studentNo || '',
      nickName: ctx.nickName || '',
      pid: ctx.pid || '',
      zone: HYDRATION_V2_CONFIG.ZONE,
      ...extra
    };
  }

  return {
    start(meta = {}) {
      const payload = base('session_start', {
        gameVersion: HYDRATION_V2_CONFIG.VERSION,
        ...meta
      });
      safePushLocal(HYDRATION_V2_CONFIG.STORAGE_KEYS.EVENT_QUEUE, payload);
      emitCloud(payload);
    },

    step(meta = {}) {
      const payload = base('step_result', meta);
      safePushLocal(HYDRATION_V2_CONFIG.STORAGE_KEYS.EVENT_QUEUE, payload);
      emitCloud(payload);
    },

    finish(meta = {}) {
      const payload = base('session_finish', {
        gameVersion: HYDRATION_V2_CONFIG.VERSION,
        ...meta
      });
      safePushLocal(HYDRATION_V2_CONFIG.STORAGE_KEYS.EVENT_QUEUE, payload);
      emitCloud(payload);
    }
  };
}