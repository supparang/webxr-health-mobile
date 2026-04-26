// === /english/js/lesson-data-module-bridge-fix.js ===
// PATCH v20260426c-LESSON-DATA-MODULE-BRIDGE-ABSOLUTE-PATH
// Fix: browser still imports /english/js/js/lesson-data.js.
// ✅ Uses absolute GitHub Pages path
// ✅ No ./js relative path anymore
// ✅ Correct URL: /webxr-health-mobile/english/js/lesson-data.js
// ✅ Dynamically imports lesson-data.js as module
// ✅ Exposes window.missionDB / window.LESSON_DATA / window.LESSON_SESSIONS
// ✅ Dispatches lesson:data-bridge-ready

(function () {
  'use strict';

  const VERSION = 'v20260426c-LESSON-DATA-MODULE-BRIDGE-ABSOLUTE-PATH';

  function makeDataUrl() {
    const origin = location.origin;
    const path = location.pathname || '';

    // GitHub Pages repo path
    const repoBase = path.includes('/webxr-health-mobile/')
      ? '/webxr-health-mobile'
      : '';

    return `${origin}${repoBase}/english/js/lesson-data.js?v=20260426c`;
  }

  const DATA_URL = makeDataUrl();

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
        if (Array.isArray(c.LESSON_SESSIONS) && c.LESSON_SESSIONS.length) return c.LESSON_SESSIONS;
      }
    }

    return null;
  }

  function exposeData(data, mod) {
    window.missionDB = data;
    window.LESSON_DATA = data;
    window.LESSON_SESSIONS = data;

    window.LESSON_DATA_BRIDGE_FIX = {
      version: VERSION,
      dataUrl: DATA_URL,
      count: Array.isArray(data) ? data.length : 0,
      moduleKeys: mod ? Object.keys(mod) : [],
      module: mod,
      data
    };
  }

  function dispatchReady(data, mod) {
    const detail = {
      version: VERSION,
      dataUrl: DATA_URL,
      count: Array.isArray(data) ? data.length : 0,
      hasMissionDB: !!window.missionDB,
      hasLessonData: !!window.LESSON_DATA,
      hasLessonSessions: !!window.LESSON_SESSIONS,
      exportedKeys: mod ? Object.keys(mod) : []
    };

    [
      'lesson:data-bridge-ready',
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:item-ready'
    ].forEach((name) => {
      try {
        window.dispatchEvent(new CustomEvent(name, { detail }));
      } catch (err) {}

      try {
        document.dispatchEvent(new CustomEvent(name, { detail }));
      } catch (err) {}
    });
  }

  function clearDataError() {
    try {
      document.body.classList.remove('lesson-data-error');
    } catch (err) {}

    const warning = document.getElementById('fallbackWarning');
    if (warning) {
      warning.style.display = 'none';
    }
  }

  function showDataError(err) {
    try {
      document.body.classList.add('lesson-data-error');
    } catch (e) {}

    const warning = document.getElementById('fallbackWarning');
    if (warning) {
      warning.style.display = '';
      warning.innerHTML =
        'โหลดข้อมูลบทเรียนไม่สำเร็จ<br>' +
        'ตรวจไฟล์ <b>/english/js/lesson-data.js</b> หรือ export data ให้ถูกต้อง<br>' +
        '<small>' + safe(err && err.message) + '</small><br>' +
        '<small>DATA_URL: ' + DATA_URL + '</small>';
    }
  }

  function rerenderMissionPanel() {
    [80, 350, 800, 1500, 2500].forEach((ms) => {
      setTimeout(() => {
        try {
          window.LESSON_MISSION_PANEL_FIX?.render?.(true);
        } catch (err) {}

        try {
          window.LESSON_SPEAKING_FIX?.render?.(true);
        } catch (err) {}
      }, ms);
    });
  }

  async function boot() {
    try {
      const mod = await import(DATA_URL);
      const data = normalizeData(mod);

      if (!data || !Array.isArray(data) || !data.length) {
        throw new Error('lesson-data.js imported, but no array data found');
      }

      exposeData(data, mod);
      clearDataError();
      dispatchReady(data, mod);
      rerenderMissionPanel();

      console.log('[LessonDataBridge]', VERSION, {
        dataUrl: DATA_URL,
        count: data.length,
        keys: Object.keys(mod)
      });
    } catch (err) {
      console.error('[LessonDataBridge] failed', VERSION, err);

      window.LESSON_DATA_BRIDGE_ERROR = err;

      showDataError(err);

      try {
        window.dispatchEvent(new CustomEvent('lesson:data-bridge-error', {
          detail: {
            version: VERSION,
            dataUrl: DATA_URL,
            message: safe(err && err.message)
          }
        }));
      } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();