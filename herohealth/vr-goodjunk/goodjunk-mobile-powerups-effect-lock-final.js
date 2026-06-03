// === /herohealth/vr-goodjunk/goodjunk-mobile-powerups-effect-lock-final.js ===
// PATCH v20260603-v848b
// Purpose: stable global flags for powerup effects; avoid duplicate stacked timers.

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_POWERUPS_EFFECT_LOCK_V848B';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  const state = {
    shieldUntil: 0,
    magnetUntil: 0,
    slowUntil: 0,
    comboUntil: 0,
    timers: {}
  };

  function now() {
    return Date.now();
  }

  function active(type) {
    return Number(state[type + 'Until'] || 0) > now();
  }

  function setFlag(type, ms) {
    type = String(type || '').toLowerCase();
    ms = Number(ms || 0);

    const key = type + 'Until';
    if (!(key in state)) return;

    const until = now() + Math.max(900, ms || 4500);
    state[key] = until;

    window.GJ_POWERUP_FLAGS = window.GJ_POWERUP_FLAGS || {};
    window.GJ_POWERUP_FLAGS[type] = true;

    if (state.timers[type]) {
      clearTimeout(state.timers[type]);
    }

    state.timers[type] = setTimeout(function () {
      if (state[key] <= now()) {
        window.GJ_POWERUP_FLAGS[type] = false;

        try {
          window.dispatchEvent(new CustomEvent('goodjunk:powerup-end', {
            detail: { type: type, source: PATCH }
          }));
        } catch (_) {}
      }
    }, Math.max(900, ms || 4500) + 60);
  }

  function installEvents() {
    window.addEventListener('goodjunk:powerup-active', function (ev) {
      const type = String(ev.detail && ev.detail.type || '').toLowerCase();
      const ms = Number(ev.detail && (ev.detail.ms || ev.detail.duration) || 0);
      setFlag(type, ms || 5000);
    });

    window.addEventListener('goodjunk:junk-hit', function (ev) {
      if (!active('shield')) return;

      try {
        if (ev.preventDefault) ev.preventDefault();
        if (ev.stopPropagation) ev.stopPropagation();
      } catch (_) {}

      try {
        window.dispatchEvent(new CustomEvent('goodjunk:shield-block', {
          detail: { source: PATCH, at: now() }
        }));
      } catch (_) {}
    }, true);
  }

  function install() {
    installEvents();

    window.GJ_POWERUP_EFFECTS = {
      version: '20260603-v848b',
      state,
      active,
      setFlag
    };

    try {
      console.log('[' + PATCH + '] installed');
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
