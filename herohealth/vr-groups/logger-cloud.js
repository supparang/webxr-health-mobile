// === /herohealth/vr-groups/logger-cloud.js ===
// Food Groups VR — Cloud logger (Apps Script / no-cors)
// 2025-12-06

(function (root) {
  'use strict';

  let CONFIG = {
    endpoint: '',
    projectTag: 'HeroHealth-GroupsVR',
    debug: false
  };

  function init(opts) {
    opts = opts || {};
    CONFIG.endpoint   = opts.endpoint   || CONFIG.endpoint;
    CONFIG.projectTag = opts.projectTag || CONFIG.projectTag;
    CONFIG.debug      = !!opts.debug;

    if (CONFIG.debug) {
      console.log('[GroupsVR-Logger] init', CONFIG);
    }
  }

  function send(sessionSummary, events) {
    const endpoint = CONFIG.endpoint;
    if (!endpoint || typeof fetch !== 'function') {
      if (CONFIG.debug) {
        console.warn('[GroupsVR-Logger] no endpoint or fetch not available');
      }
      return;
    }

    const payload = {
      projectTag: CONFIG.projectTag,
      session: sessionSummary,
      events: Array.isArray(events) ? events : []
    };

    if (CONFIG.debug) {
      console.log('[GroupsVR-Logger] send()', payload);
    }

    fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).then(function () {
      if (CONFIG.debug) {
        console.log('[GroupsVR-Logger] sent OK (no-cors)');
      }
    }).catch(function (err) {
      if (CONFIG.debug) {
        console.warn('[GroupsVR-Logger] send error', err);
      }
    });
  }

  const mod = { init, send };

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.foodGroupsCloudLogger = mod;

})(window);
