// === /herohealth/vr-goodjunk/goodjunk-mobile-powerups-earned-final-patch.js ===
// PATCH v20260603-v848b
// Purpose: grant powerups fairly from combo / good hits / score changes.

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_POWERUPS_EARNED_V848B';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  const state = {
    goodHits: 0,
    scoreLast: 0,
    comboLast: 0,
    earnedCount: 0,
    lastEarnAt: 0,
    nextIndex: 0
  };

  const rotation = ['shield', 'magnet', 'slow', 'combo'];

  function dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  function now() {
    return Date.now();
  }

  function canEarn() {
    return now() - state.lastEarnAt > 2800;
  }

  function earn(type, reason) {
    type = String(type || rotation[state.nextIndex % rotation.length]).toLowerCase();
    if (!rotation.includes(type)) type = rotation[state.nextIndex % rotation.length];

    if (!canEarn()) return false;

    state.lastEarnAt = now();
    state.earnedCount += 1;
    state.nextIndex += 1;

    dispatch('goodjunk:powerup-earned', {
      type: type,
      reason: reason || 'earned',
      count: state.earnedCount,
      at: state.lastEarnAt
    });

    dispatch('hha:event', {
      game: 'goodjunk',
      event: 'powerup_earned',
      type: type,
      reason: reason || 'earned',
      at: state.lastEarnAt
    });

    return true;
  }

  function readNumber(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback || 0;
    const n = Number(String(el.textContent || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function checkScoreAndCombo() {
    const score = readNumber('gjmScore', state.scoreLast);
    const comboText = document.getElementById('gjmCombo')
      ? document.getElementById('gjmCombo').textContent
      : '';
    const combo = Number(String(comboText || '').replace(/[^\d.-]/g, '')) || 0;

    if (score > state.scoreLast) {
      const diff = score - state.scoreLast;
      state.scoreLast = score;

      if (diff >= 20) {
        state.goodHits += 1;
      }

      if (state.goodHits > 0 && state.goodHits % 5 === 0) {
        earn(null, 'good_hits_' + state.goodHits);
      }
    }

    if (combo > state.comboLast) {
      state.comboLast = combo;

      if (combo > 0 && combo % 6 === 0) {
        earn('combo', 'combo_' + combo);
      }
    }
  }

  function bindEvents() {
    const eventNames = [
      'goodjunk:good-hit',
      'gj:good-hit',
      'goodjunk:correct',
      'hha:correct'
    ];

    eventNames.forEach(function (name) {
      window.addEventListener(name, function () {
        state.goodHits += 1;

        if (state.goodHits % 5 === 0) {
          earn(null, 'event_good_hits_' + state.goodHits);
        }
      });
    });

    window.addEventListener('goodjunk:combo', function (ev) {
      const combo = Number(ev.detail && ev.detail.combo || 0);
      if (combo > 0 && combo % 6 === 0) {
        earn('combo', 'event_combo_' + combo);
      }
    });
  }

  function install() {
    bindEvents();

    setInterval(checkScoreAndCombo, 900);

    window.GJ_POWERUPS_EARNED = {
      version: '20260603-v848b',
      state,
      earn
    };

    setTimeout(function () {
      earn('shield', 'starter-safety');
    }, 1800);

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
