// === /herohealth/vr-brush-kids/brush-play-unlock-p31b-safe.js ===
// PATCH v20260604-P31B-SAFE
// Purpose:
// - Fix mobile Chrome Aw Snap caused by aggressive P31
// - No auto-start loop
// - No heavy body-wide scanning
// - No repeated start-function storm
// - User taps once to enter Brush gameplay safely

(function () {
  'use strict';

  const PATCH = 'BRUSH_PLAY_UNLOCK_P31B_SAFE';

  if (window.__BRUSH_PLAY_UNLOCK_P31B_SAFE__) return;
  window.__BRUSH_PLAY_UNLOCK_P31B_SAFE__ = true;

  const path = String(location.pathname || '');
  const isBrush = /\/herohealth\/vr-brush-kids\/brush\.html/i.test(path) ||
                  /\/vr-brush-kids\/brush\.html/i.test(path);

  if (!isBrush) return;

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();
  const run = String(qs.get('run') || '').toLowerCase();

  const IS_MOBILE =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  const WANT_PLAY =
    run === 'play' ||
    qs.get('direct') === '1' ||
    qs.get('autostart') === '1';

  let started = false;

  function log() {
    try {
      console.info.apply(console, ['[' + PATCH + ']'].concat([].slice.call(arguments)));
    } catch (_) {}
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function injectStyle() {
    if (document.getElementById('brushP31bSafeStyle')) return;

    const style = document.createElement('style');
    style.id = 'brushP31bSafeStyle';
    style.textContent = `
      html, body {
        min-height: 100%;
        overflow-x: hidden;
        touch-action: manipulation;
      }

      #brushP31bSafeStart {
        position: fixed;
        left: 50%;
        bottom: max(18px, env(safe-area-inset-bottom, 0px));
        transform: translateX(-50%);
        z-index: 2147483000;
        border: 0;
        border-radius: 999px;
        padding: 14px 22px;
        font-size: 18px;
        font-weight: 900;
        background: #38bdf8;
        color: #07364a;
        box-shadow: 0 12px 28px rgba(15, 23, 42, .24);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      #brushP31bSafeStart:active {
        transform: translateX(-50%) scale(.97);
      }

      body.brush-p31b-started #brushP31bSafeStart {
        display: none !important;
      }

      body.brush-p31b-started #game,
      body.brush-p31b-started #gameRoot,
      body.brush-p31b-started #brushGame,
      body.brush-p31b-started #stage,
      body.brush-p31b-started .game,
      body.brush-p31b-started .game-root,
      body.brush-p31b-started .stage,
      body.brush-p31b-started #hud,
      body.brush-p31b-started .hud,
      body.brush-p31b-started a-scene,
      body.brush-p31b-started canvas {
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      body.brush-p31b-started #intro,
      body.brush-p31b-started #startScreen,
      body.brush-p31b-started #landing,
      body.brush-p31b-started .intro,
      body.brush-p31b-started .start-screen,
      body.brush-p31b-started .landing {
        display: none !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function showGameOnlyLight() {
    const showList = [
      '#app',
      '#game',
      '#gameRoot',
      '#brushGame',
      '#stage',
      '.game',
      '.game-root',
      '.stage',
      '#hud',
      '.hud',
      'a-scene',
      'canvas'
    ];

    showList.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      });
    });

    const hideList = [
      '#intro',
      '#startScreen',
      '#landing',
      '.intro',
      '.start-screen',
      '.landing',
      '.qa-modal',
      '.test-modal',
      '.debug-modal'
    ];

    hideList.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
      });
    });
  }

  function textOf(el) {
    try {
      return String(el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
    } catch (_) {
      return '';
    }
  }

  function findRealStartButton() {
    const buttons = Array.from(document.querySelectorAll(
      'button, a, [role="button"], input[type="button"], input[type="submit"]'
    ));

    return buttons.find(function (btn) {
      if (!btn || btn.id === 'brushP31bSafeStart') return false;

      const txt = textOf(btn).toLowerCase();
      const id = String(btn.id || '').toLowerCase();
      const cls = String(btn.className || '').toLowerCase();
      const href = String(btn.getAttribute('href') || '').toLowerCase();
      const label = [txt, id, cls, href].join(' ');

      const yes = /เริ่ม|เล่น|start|play|begin/.test(label);
      const no = /hub|zone|back|กลับ|ออก|exit|summary|cooldown|warmup/.test(label);

      return yes && !no;
    }) || null;
  }

  function dispatchSafeStartEvents() {
    const detail = {
      patch: PATCH,
      source: 'p31b-safe',
      view: view || 'unknown',
      mobile: IS_MOBILE
    };

    [
      'hha:brush:start',
      'brush:start',
      'hha:start',
      'game:start'
    ].forEach(function (name) {
      try {
        window.dispatchEvent(new CustomEvent(name, { detail }));
        document.dispatchEvent(new CustomEvent(name, { detail }));
      } catch (_) {}
    });
  }

  function callOnlyKnownSafeStart() {
    const safeCandidates = [];

    if (window.HHA_BRUSH && typeof window.HHA_BRUSH.start === 'function') {
      safeCandidates.push(function () { window.HHA_BRUSH.start(); });
    } else if (window.BrushGame && typeof window.BrushGame.start === 'function') {
      safeCandidates.push(function () { window.BrushGame.start(); });
    } else if (typeof window.startBrush === 'function') {
      safeCandidates.push(function () { window.startBrush(); });
    } else if (typeof window.startGame === 'function') {
      safeCandidates.push(function () { window.startGame(); });
    }

    if (!safeCandidates.length) return false;

    try {
      safeCandidates[0]();
      return true;
    } catch (err) {
      log('safe start failed', err && err.message ? err.message : err);
      return false;
    }
  }

  function startBrushSafely(reason) {
    if (started) return;
    started = true;

    document.body.classList.add('brush-p31b-started');

    try {
      sessionStorage.setItem('HHA_BRUSH_P31B_SAFE_STARTED', String(Date.now()));
    } catch (_) {}

    log('startBrushSafely:', reason || 'tap');

    showGameOnlyLight();
    dispatchSafeStartEvents();

    const realBtn = findRealStartButton();

    if (realBtn) {
      try {
        realBtn.click();
        setTimeout(showGameOnlyLight, 120);
        return;
      } catch (err) {
        log('real start click failed', err && err.message ? err.message : err);
      }
    }

    callOnlyKnownSafeStart();

    setTimeout(showGameOnlyLight, 120);
  }

  function addSafeStartButton() {
    if (document.getElementById('brushP31bSafeStart')) return;

    const btn = document.createElement('button');
    btn.id = 'brushP31bSafeStart';
    btn.type = 'button';
    btn.textContent = 'เริ่มแปรงฟัน';

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      startBrushSafely('safe-button');
    }, true);

    document.body.appendChild(btn);
  }

  function interceptBadStartRedirect() {
    document.addEventListener('click', function (ev) {
      const target = ev.target;
      const btn = target && target.closest
        ? target.closest('a, button, [role="button"]')
        : null;

      if (!btn || btn.id === 'brushP31bSafeStart') return;

      const href = String(btn.getAttribute('href') || '');
      const label = [
        textOf(btn),
        String(btn.id || ''),
        String(btn.className || ''),
        href
      ].join(' ').toLowerCase();

      const isStart = /เริ่ม|เล่น|start|play|begin/.test(label);
      const isBadLauncherHop =
        /brush-vr-kids\.html|brush-kids-vr\.html|brush-vr\.html/.test(href) &&
        !/vr-brush-kids\/brush\.html/.test(href);

      if (isStart && isBadLauncherHop) {
        ev.preventDefault();
        ev.stopPropagation();
        startBrushSafely('intercept-bad-launcher-hop');
      }
    }, true);
  }

  function exposeDebugApi() {
    window.HHA_BRUSH_P31B_SAFE = {
      patch: PATCH,
      start: startBrushSafely,
      showGame: showGameOnlyLight,
      status: function () {
        return {
          patch: PATCH,
          started,
          wantPlay: WANT_PLAY,
          view,
          isMobile: IS_MOBILE,
          path: location.pathname,
          search: location.search
        };
      }
    };
  }

  function boot() {
    injectStyle();
    exposeDebugApi();
    interceptBadStartRedirect();

    if (WANT_PLAY) {
      addSafeStartButton();
    }

    log('loaded', {
      wantPlay: WANT_PLAY,
      view,
      isMobile: IS_MOBILE
    });
  }

  ready(boot);
})();