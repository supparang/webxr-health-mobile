// === /herohealth/vr-goodjunk/goodjunk-mobile-cooldown-return-launcher-final-patch.js ===
// PATCH v20260603-v848b
// Purpose: force reward/summary cooldown button to cooldown gate, then return GoodJunk launcher.

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_COOLDOWN_RETURN_LAUNCHER_V848B';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  const QS = new URLSearchParams(location.search || '');

  const CANONICAL = {
    launcher: 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html',
    nutritionZone: 'https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html',
    hub: 'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html',
    cooldownGate: 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html'
  };

  function q(name, fallback) {
    const v = QS.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function playerName() {
    return q('name', q('nick', 'Hero'));
  }

  function shell() {
    return window.GJ_SOLO_BOSS_SHELL || null;
  }

  function buildLauncherUrl() {
    try {
      if (shell() && typeof shell().buildGoodJunkLauncherUrl === 'function') {
        return shell().buildGoodJunkLauncherUrl();
      }
    } catch (_) {}

    const u = new URL(CANONICAL.launcher);
    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '120'));
    u.searchParams.set('view', q('view', 'mobile'));
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'mobile-solo-boss');
    u.searchParams.set('theme', 'goodjunk');
    return u.href;
  }

  function readLatestSummary() {
    const keys = [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'HHA_LAST_SUMMARY'
    ];

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') return obj;
      } catch (_) {}
    }

    return {};
  }

  function buildCooldownUrl(extra) {
    extra = extra || {};

    try {
      if (shell() && typeof shell().buildCooldownUrl === 'function') {
        return shell().buildCooldownUrl(extra);
      }
    } catch (_) {}

    const launcher = buildLauncherUrl();
    const keep = new URLSearchParams();

    keep.set('zone', 'nutrition');
    keep.set('cat', 'nutrition');
    keep.set('gameId', 'goodjunk');
    keep.set('game', 'goodjunk');
    keep.set('mode', 'solo_boss');
    keep.set('phase', 'cooldown');

    keep.set('pid', q('pid', 'anon'));
    keep.set('name', playerName());
    keep.set('diff', q('diff', 'normal'));
    keep.set('time', q('time', '120'));
    keep.set('view', q('view', 'mobile'));

    keep.set('hub', CANONICAL.launcher);
    keep.set('next', launcher);
    keep.set('back', launcher);
    keep.set('launcher', launcher);
    keep.set('return', launcher);

    const latest = Object.assign({}, readLatestSummary(), extra);

    const map = {
      score: latest.score ?? q('score', '0'),
      stars: latest.stars ?? q('stars', ''),
      rank: latest.rank ?? q('rank', ''),
      accuracy: latest.accuracy ?? latest.acc ?? q('accuracy', q('acc', '')),
      goodHits: latest.goodHits ?? latest.good ?? q('goodHits', q('good', '')),
      junkHits: latest.junkHits ?? latest.junk ?? q('junkHits', q('junk', '')),
      fakeHits: latest.fakeHits ?? latest.fake ?? q('fakeHits', q('fake', '')),
      miss: latest.miss ?? latest.misses ?? q('miss', q('misses', '0')),
      bestCombo: latest.bestCombo ?? latest.combo ?? q('bestCombo', q('combo', '')),
      coins: latest.coins ?? q('coins', ''),
      badge: latest.badge ?? q('badge', ''),
      missionDone: latest.missionDone ?? latest.mission ?? q('missionDone', q('mission', ''))
    };

    Object.keys(map).forEach(function (key) {
      const val = map[key];
      if (val !== undefined && val !== null && val !== '') {
        keep.set(key, String(val));
      }
    });

    keep.set('from', 'goodjunk-solo-boss-mobile');
    keep.set('reason', String(extra.reason || 'summary-cooldown'));
    keep.set('v', '20260603-v848b');

    return CANONICAL.cooldownGate + '?' + keep.toString();
  }

  function goCooldown(extra) {
    const url = buildCooldownUrl(extra || {});
    try {
      localStorage.setItem('GJ_SOLO_BOSS_COOLDOWN_TARGET_LAST', JSON.stringify({
        patch: PATCH,
        cooldownUrl: url,
        launcherUrl: buildLauncherUrl(),
        savedAt: new Date().toISOString()
      }));
    } catch (_) {}

    location.href = url;
  }

  function relabelButton(btn, detail) {
    if (!btn) return;

    btn.innerHTML = '🧘 Cooldown แล้วกลับเลือกโหมด';
    btn.setAttribute('aria-label', 'ไป Cooldown แล้วกลับหน้าเลือกโหมด GoodJunk');
    btn.dataset.goCooldown = '1';
    btn.dataset.gjCooldownPatched = '1';

    if (detail && typeof detail === 'object') {
      try {
        btn.dataset.gjSummary = JSON.stringify(detail);
      } catch (_) {}
    }
  }

  function patchKnownButtons(detail) {
    const selectors = [
      '#gjrZoneBtn',
      '#zoneBtn',
      '#cooldownBtn',
      '[data-go-cooldown="1"]',
      '[data-action="cooldown"]'
    ];

    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (btn) {
        relabelButton(btn, detail || {});
      });
    });

    document.querySelectorAll('button,a,[role="button"]').forEach(function (btn) {
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (!txt) return;

      const shouldPatch =
        txt.includes('cooldown') ||
        txt.includes('คูลดาวน์') ||
        txt.includes('กลับโซน') ||
        txt.includes('nutrition zone') ||
        txt.includes('zone');

      if (shouldPatch && /summary|result|reward|gjr|zone/i.test(btn.id + ' ' + btn.className + ' ' + txt)) {
        relabelButton(btn, detail || {});
      }
    });
  }

  function bindEvents() {
    window.addEventListener('gj:reward-summary-shown', function (ev) {
      const detail = ev && ev.detail ? ev.detail : {};
      setTimeout(function () {
        patchKnownButtons(detail);
      }, 30);
      setTimeout(function () {
        patchKnownButtons(detail);
      }, 250);
    });

    window.addEventListener('goodjunk:summary', function (ev) {
      const detail = ev && ev.detail ? ev.detail : {};
      setTimeout(function () {
        patchKnownButtons(detail);
      }, 30);
    });

    window.addEventListener('hha:summary', function (ev) {
      const detail = ev && ev.detail ? ev.detail : {};
      const game = String(detail.game || detail.gameId || '').toLowerCase();
      if (game && !game.includes('goodjunk')) return;
      setTimeout(function () {
        patchKnownButtons(detail);
      }, 30);
    });

    document.addEventListener('click', function (ev) {
      const target = ev.target && ev.target.closest
        ? ev.target.closest('#gjrZoneBtn,#zoneBtn,#cooldownBtn,[data-go-cooldown="1"],[data-action="cooldown"]')
        : null;

      if (!target) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      let detail = {};
      try {
        detail = JSON.parse(target.dataset.gjSummary || '{}') || {};
      } catch (_) {
        detail = {};
      }

      goCooldown(Object.assign({}, readLatestSummary(), detail, {
        reason: 'reward-zone-button'
      }));
    }, true);
  }

  function install() {
    bindEvents();

    setInterval(function () {
      patchKnownButtons(readLatestSummary());
    }, 1500);

    window.GJ_MOBILE_COOLDOWN_RETURN = {
      version: '20260603-v848b',
      buildLauncherUrl,
      buildCooldownUrl,
      goCooldown
    };

    try {
      console.log('[' + PATCH + '] installed', buildLauncherUrl());
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
