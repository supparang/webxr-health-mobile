// === /herohealth/vr-groups/logger-cloud.js ===
// Food Groups VR — Cloud Logger (non-module version)
// ส่ง Session + Events ไป Google Apps Script
// 2025-12-06

(function (ns) {
  'use strict';

  let CONFIG = {
    endpoint: '',
    projectTag: 'HeroHealth-GroupsVR',
    debug: false
  };

  function logDebug(...args) {
    if (CONFIG.debug) {
      console.log('[GroupsVR:Cloud]', ...args);
    }
  }

  /**
   * เรียกจาก groups-vr.html
   *   GAME_MODULES.foodGroupsCloudLogger.init({
   *     endpoint: 'https://script.google.com/macros/s/XXXX/exec',
   *     projectTag: 'HeroHealth-GroupsVR',
   *     debug: true/false
   *   })
   */
  function init(opts) {
    opts = opts || {};
    CONFIG.endpoint   = opts.endpoint   || CONFIG.endpoint || '';
    CONFIG.projectTag = opts.projectTag || CONFIG.projectTag || 'HeroHealth-GroupsVR';
    CONFIG.debug      = !!opts.debug;
    logDebug('init', CONFIG);
  }

  /**
   * ส่งข้อมูลขึ้น Google Apps Script
   * session: { sessionId, score, difficulty, durationMs, ... }
   * events : [{ type, emoji, groupId, rtMs, scoreDelta, pos, ... }, ...]
   */
  function send(session, events) {
    if (!CONFIG.endpoint) {
      logDebug('skip send: no endpoint');
      return;
    }

    const payload = {
      projectTag: CONFIG.projectTag,
      sessions: [session || {}],
      events: Array.isArray(events) ? events : []
    };

    logDebug('send payload', payload);

    fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'no-cors', // กัน CORS error ฝั่ง browser
      body: JSON.stringify(payload)
    }).then(function () {
      logDebug('sent OK (no-cors)');
    }).catch(function (err) {
      console.warn('[GroupsVR:Cloud] send error', err);
    });
  }

  // โยนออกเป็น GAME_MODULES.foodGroupsCloudLogger
  ns.foodGroupsCloudLogger = {
    init,
    send
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
