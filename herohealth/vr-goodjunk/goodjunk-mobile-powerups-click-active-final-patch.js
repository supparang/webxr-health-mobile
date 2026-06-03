// === /herohealth/vr-goodjunk/goodjunk-mobile-powerups-click-active-final-patch.js ===
// PATCH v20260603-v848b
// Purpose: tapping powerup card activates ready powerup.

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_POWERUPS_CLICK_ACTIVE_V848B';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  const durationMap = {
    shield: 6500,
    magnet: 5500,
    slow: 5000,
    combo: 4500
  };

  function dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  function toast(msg) {
    try {
      if (window.GJ_POWERUPS_ACTIVE_UI && typeof window.GJ_POWERUPS_ACTIVE_UI.toast === 'function') {
        window.GJ_POWERUPS_ACTIVE_UI.toast(msg);
      }
    } catch (_) {}
  }

  function activate(type) {
    type = String(type || '').toLowerCase();
    if (!durationMap[type]) return false;

    const card = document.querySelector('.gjpu-card[data-powerup="' + type + '"]');
    const ready = card && card.dataset.ready === '1';

    if (!ready) {
      toast('ยังไม่มีพลังนี้');
      return false;
    }

    if (card) {
      card.dataset.ready = '0';
      card.classList.remove('ready');
      card.dataset.active = '1';
      card.classList.add('on');
    }

    dispatch('goodjunk:powerup-active', {
      type: type,
      ms: durationMap[type],
      source: 'mobile-click'
    });

    dispatch('hha:event', {
      game: 'goodjunk',
      event: 'powerup_active',
      type: type,
      source: 'mobile-click',
      at: Date.now()
    });

    return true;
  }

  function bindClicks() {
    document.addEventListener('click', function (ev) {
      const card = ev.target && ev.target.closest
        ? ev.target.closest('.gjpu-card[data-powerup]')
        : null;

      if (!card) return;

      ev.preventDefault();
      ev.stopPropagation();

      activate(card.dataset.powerup);
    }, true);

    document.addEventListener('touchend', function (ev) {
      const card = ev.target && ev.target.closest
        ? ev.target.closest('.gjpu-card[data-powerup]')
        : null;

      if (!card) return;

      ev.preventDefault();
      ev.stopPropagation();

      activate(card.dataset.powerup);
    }, { passive: false, capture: true });
  }

  function install() {
    bindClicks();

    window.GJ_POWERUPS_CLICK_ACTIVE = {
      version: '20260603-v848b',
      activate
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
