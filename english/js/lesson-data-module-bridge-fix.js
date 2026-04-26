// === /english/js/lesson-data-module-bridge-fix.js ===
// PATCH v20260426a-LESSON-DATA-MODULE-BRIDGE
// Fix: lesson-data.js is ES module/export, but lesson.html needs window.missionDB.
// ✅ Do not load lesson-data.js as normal script
// ✅ Dynamically imports module lesson-data.js
// ✅ Exposes window.missionDB / window.LESSON_DATA / window.LESSON_SESSIONS
// ✅ Dispatches lesson:data-bridge-ready and lesson:data-skill-ready
// ✅ Removes data error warning after successful load

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-DATA-MODULE-BRIDGE';

  const DATA_URL = './lesson-data.js?v=20260426';

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function normalizeData(mod) {
    if (!mod) return null;

    const candidates = [
      mod.missionDB,
      mod.LESSON_DATA,
      mod.LESSON_SESSIONS,
      mod.sessions,
      mod.default?.missionDB,
      mod.default?.LESSON_DATA,
      mod.default?.LESSON_SESSIONS,
      mod.default?.sessions,
      mod.default
    ];

    for (const c of candidates) {
      if (Array.isArray(c) && c.length) return c;

      if (c && typeof c === 'object') {
        if (Array.isArray(c.sessions) && c.sessions.length) return c.sessions;
        if (Array.isArray(c.missionDB) && c.missionDB.length) return c.missionDB;
        if (Array.isArray(c.LESSON_DATA) && c.LESSON_DATA.length) return c.LESSON_DATA;
      }
    }

    return null;
  }

  function dispatchReady(data, mod) {
    const detail = {
      version: VERSION,
      count: Array.isArray(data) ? data.length : 0,
      hasMissionDB: !!window.missionDB,
      exportedKeys: mod ? Object.keys(mod) : []
    };

    window.dispatchEvent(new CustomEvent('lesson:data-bridge-ready', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:data-bridge-ready', { detail }));

    window.dispatchEvent(new CustomEvent('lesson:data-skill-ready', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:data-skill-ready', { detail }));

    window.dispatchEvent(new CustomEvent('lesson:router-ready', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:router-ready', { detail }));
  }

  async function boot() {
    try {
      const mod = await import(DATA_URL);
      const data = normalizeData(mod);

      if (!data || !Array.isArray(data) || !data.length) {
        throw new Error('lesson-data.js imported, but no array data found');
      }

      window.missionDB = data;
      window.LESSON_DATA = data;
      window.LESSON_SESSIONS = data;

      window.LESSON_DATA_BRIDGE_FIX = {
        version: VERSION,
        dataUrl: DATA_URL,
        count: data.length,
        module: mod,
        data
      };

      try {
        document.body.classList.remove('lesson-data-error');
      } catch (err) {}

      dispatchReady(data, mod);

      setTimeout(() => {
        try {
          window.LESSON_MISSION_PANEL_FIX?.render?.(true);
        } catch (err) {}
      }, 80);

      setTimeout(() => {
        try {
          window.LESSON_MISSION_PANEL_FIX?.render?.(true);
        } catch (err) {}
      }, 650);

      console.log('[LessonDataBridge]', VERSION, {
        count: data.length,
        keys: Object.keys(mod)
      });
    } catch (err) {
      console.error('[LessonDataBridge] failed', VERSION, err);

      window.LESSON_DATA_BRIDGE_ERROR = err;

      try {
        document.body.classList.add('lesson-data-error');
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('lesson:data-bridge-error', {
        detail: {
          version: VERSION,
          message: safe(err && err.message)
        }
      }));
    }
  }

  boot();
})();