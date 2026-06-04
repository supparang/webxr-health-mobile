// === /herohealth/vr-brush-kids/brush-toothpaste-play-p32.js ===
// PATCH v20260604-P32
// Purpose:
// - Add child-friendly toothpaste gate before Brush gameplay
// - Fix start flow without aggressive loops
// - Prevent Start button from jumping back to launcher
// - Provide safe bridge into existing Brush game APIs/events
// Canonical run file: /herohealth/vr-brush-kids/brush.html

(function () {
  'use strict';

  const PATCH = 'BRUSH_TOOTHPASTE_PLAY_P32';

  if (window.__BRUSH_TOOTHPASTE_PLAY_P32__) return;
  window.__BRUSH_TOOTHPASTE_PLAY_P32__ = true;

  const path = String(location.pathname || '');
  const isBrush =
    /\/herohealth\/vr-brush-kids\/brush\.html/i.test(path) ||
    /\/vr-brush-kids\/brush\.html/i.test(path) ||
    /brush/i.test(String(document.title || ''));

  if (!isBrush) return;

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();
  const run = String(qs.get('run') || '').toLowerCase();

  const WANT_PLAY =
    run === 'play' ||
    qs.get('direct') === '1' ||
    qs.get('autostart') === '1';

  const IS_MOBILE =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  let toothpasteDone = false;
  let playStarted = false;
  let bridgeBusy = false;

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

  function $(sel) {
    try {
      return document.querySelector(sel);
    } catch (_) {
      return null;
    }
  }

  function $all(sel) {
    try {
      return Array.from(document.querySelectorAll(sel));
    } catch (_) {
      return [];
    }
  }

  function textOf(el) {
    try {
      return String(
        el.innerText ||
        el.textContent ||
        el.value ||
        el.getAttribute('aria-label') ||
        ''
      ).trim();
    } catch (_) {
      return '';
    }
  }

  function injectStyle() {
    if ($('#brushP32Style')) return;

    const style = document.createElement('style');
    style.id = 'brushP32Style';
    style.textContent = `
      html, body {
        min-height: 100%;
        overflow-x: hidden;
        touch-action: manipulation;
      }

      body.brush-p32-lock {
        overflow: hidden !important;
      }

      .brush-p32-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: max(18px, env(safe-area-inset-top, 0px)) 16px max(18px, env(safe-area-inset-bottom, 0px));
        background:
          radial-gradient(circle at 25% 15%, rgba(186, 230, 253, .95), transparent 32%),
          radial-gradient(circle at 80% 10%, rgba(254, 240, 138, .92), transparent 26%),
          linear-gradient(180deg, #f0f9ff 0%, #ecfeff 52%, #f7fee7 100%);
        color: #0f172a;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .brush-p32-card {
        width: min(440px, 94vw);
        border-radius: 28px;
        background: rgba(255, 255, 255, .94);
        border: 2px solid rgba(14, 165, 233, .22);
        box-shadow: 0 22px 60px rgba(15, 23, 42, .18);
        padding: 20px 18px 18px;
        text-align: center;
      }

      .brush-p32-title {
        font-size: clamp(24px, 6vw, 34px);
        line-height: 1.05;
        font-weight: 1000;
        margin: 4px 0 8px;
        color: #075985;
      }

      .brush-p32-sub {
        font-size: clamp(15px, 4vw, 18px);
        line-height: 1.35;
        font-weight: 800;
        color: #475569;
        margin: 0 auto 14px;
      }

      .brush-p32-visual {
        position: relative;
        height: 178px;
        margin: 8px auto 16px;
        border-radius: 24px;
        background: linear-gradient(180deg, #e0f2fe, #f8fafc);
        overflow: hidden;
        border: 1px solid rgba(56, 189, 248, .28);
      }

      .brush-p32-tooth {
        position: absolute;
        left: 50%;
        bottom: 16px;
        transform: translateX(-50%);
        width: 112px;
        height: 118px;
        border-radius: 44% 44% 36% 36%;
        background: #ffffff;
        box-shadow:
          inset 0 -10px 0 rgba(226, 232, 240, .65),
          0 10px 24px rgba(15, 23, 42, .12);
        border: 3px solid #bae6fd;
      }

      .brush-p32-tooth::before,
      .brush-p32-tooth::after {
        content: "";
        position: absolute;
        top: 42px;
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: #0f172a;
      }

      .brush-p32-tooth::before { left: 32px; }
      .brush-p32-tooth::after { right: 32px; }

      .brush-p32-smile {
        position: absolute;
        left: 50%;
        top: 66px;
        width: 34px;
        height: 16px;
        transform: translateX(-50%);
        border-bottom: 4px solid #0f172a;
        border-radius: 0 0 999px 999px;
      }

      .brush-p32-brush {
        position: absolute;
        left: 22px;
        top: 48px;
        width: 136px;
        height: 22px;
        border-radius: 999px;
        background: #38bdf8;
        transform: rotate(-14deg);
        transform-origin: center;
        box-shadow: 0 8px 18px rgba(14, 165, 233, .22);
      }

      .brush-p32-brush::before {
        content: "";
        position: absolute;
        right: -28px;
        top: -13px;
        width: 44px;
        height: 40px;
        border-radius: 12px;
        background: #0ea5e9;
      }

      .brush-p32-brush::after {
        content: "";
        position: absolute;
        right: -22px;
        top: -24px;
        width: 30px;
        height: 18px;
        border-radius: 999px 999px 10px 10px;
        background: #f9a8d4;
        box-shadow: 0 -8px 0 #fbcfe8;
        opacity: 0;
        transform: translateY(-10px);
      }

      body.brush-p32-paste-on .brush-p32-brush::after {
        opacity: 1;
        transform: translateY(0);
        transition: .25s ease;
      }

      .brush-p32-sparkle {
        position: absolute;
        font-size: 26px;
        animation: brushP32Float 1.8s ease-in-out infinite;
      }

      .brush-p32-s1 { left: 34px; bottom: 22px; animation-delay: .1s; }
      .brush-p32-s2 { right: 38px; top: 34px; animation-delay: .35s; }
      .brush-p32-s3 { right: 62px; bottom: 30px; animation-delay: .65s; }

      @keyframes brushP32Float {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-8px) scale(1.08); }
      }

      .brush-p32-btn {
        appearance: none;
        width: 100%;
        border: 0;
        border-radius: 999px;
        padding: 15px 18px;
        font-size: clamp(17px, 4.6vw, 20px);
        font-weight: 1000;
        color: #07364a;
        background: linear-gradient(180deg, #67e8f9, #38bdf8);
        box-shadow: 0 12px 24px rgba(14, 165, 233, .26);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      .brush-p32-btn:active {
        transform: scale(.985);
      }

      .brush-p32-btn.secondary {
        margin-top: 10px;
        background: #f8fafc;
        color: #64748b;
        border: 1px solid #dbeafe;
        box-shadow: none;
        font-size: 14px;
      }

      .brush-p32-mini {
        margin-top: 10px;
        font-size: 12px;
        color: #94a3b8;
        font-weight: 700;
      }

      body.brush-p32-playing .brush-p32-overlay {
        display: none !important;
      }

      body.brush-p32-playing #game,
      body.brush-p32-playing #gameRoot,
      body.brush-p32-playing #brushGame,
      body.brush-p32-playing #stage,
      body.brush-p32-playing .game,
      body.brush-p32-playing .game-root,
      body.brush-p32-playing .brush-game,
      body.brush-p32-playing .stage,
      body.brush-p32-playing #hud,
      body.brush-p32-playing .hud,
      body.brush-p32-playing a-scene,
      body.brush-p32-playing canvas {
        display: block;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      body.brush-p32-playing #intro,
      body.brush-p32-playing #startScreen,
      body.brush-p32-playing #landing,
      body.brush-p32-playing .intro,
      body.brush-p32-playing .start-screen,
      body.brush-p32-playing .landing,
      body.brush-p32-playing .welcome {
        display: none !important;
        pointer-events: none !important;
      }

      .brush-p32-debug {
        position: fixed;
        left: 8px;
        bottom: 8px;
        z-index: 2147482999;
        max-width: 82vw;
        padding: 6px 9px;
        border-radius: 999px;
        background: rgba(15, 23, 42, .72);
        color: #fff;
        font-size: 11px;
        font-weight: 800;
        pointer-events: none;
        display: none;
      }

      body.brush-p32-show-debug .brush-p32-debug {
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  function setDebug(msg) {
    let el = $('#brushP32Debug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'brushP32Debug';
      el.className = 'brush-p32-debug';
      document.body.appendChild(el);
    }
    el.textContent = 'Brush P32: ' + msg;
    log(msg);
  }

  function createOverlay() {
    if ($('#brushP32Overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'brushP32Overlay';
    overlay.className = 'brush-p32-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'ใส่ยาสีฟันก่อนเริ่มแปรงฟัน');

    overlay.innerHTML = `
      <div class="brush-p32-card">
        <div class="brush-p32-title">เตรียมแปรงฟันกัน!</div>
        <p class="brush-p32-sub">ขั้นแรก บีบยาสีฟันลงบนแปรงก่อนนะ</p>

        <div class="brush-p32-visual" aria-hidden="true">
          <div class="brush-p32-brush"></div>
          <div class="brush-p32-tooth">
            <div class="brush-p32-smile"></div>
          </div>
          <div class="brush-p32-sparkle brush-p32-s1">🫧</div>
          <div class="brush-p32-sparkle brush-p32-s2">✨</div>
          <div class="brush-p32-sparkle brush-p32-s3">⭐</div>
        </div>

        <button id="brushP32PasteBtn" class="brush-p32-btn" type="button">
          🪥 บีบยาสีฟัน
        </button>

        <button id="brushP32SkipBtn" class="brush-p32-btn secondary" type="button">
          เข้าเกมเลย
        </button>

        <div class="brush-p32-mini">P32 Toothpaste Gate</div>
      </div>
    `;

    document.body.appendChild(overlay);

    const pasteBtn = $('#brushP32PasteBtn');
    const skipBtn = $('#brushP32SkipBtn');

    if (pasteBtn) {
      pasteBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        toothpasteDone = true;
        document.body.classList.add('brush-p32-paste-on');

        pasteBtn.textContent = '✅ ใส่ยาสีฟันแล้ว เริ่มแปรง!';
        setDebug('toothpaste done');

        setTimeout(function () {
          startGameplay('toothpaste-button');
        }, 360);
      }, true);
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        toothpasteDone = true;
        startGameplay('skip-button');
      }, true);
    }
  }

  function showOverlay() {
    document.body.classList.add('brush-p32-lock');
    createOverlay();
  }

  function hideOverlay() {
    document.body.classList.remove('brush-p32-lock');
    const overlay = $('#brushP32Overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function showGameSurface() {
    const showSelectors = [
      '#app',
      '#game',
      '#gameRoot',
      '#brushGame',
      '#stage',
      '.game',
      '.game-root',
      '.brush-game',
      '.stage',
      '#hud',
      '.hud',
      'a-scene',
      'canvas'
    ];

    showSelectors.forEach(function (sel) {
      $all(sel).forEach(function (el) {
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';

        const tag = String(el.tagName || '').toLowerCase();
        if (tag !== 'canvas' && tag !== 'a-scene') {
          if (getComputedStyle(el).display === 'none') {
            el.style.display = '';
          }
        }
      });
    });
  }

  function hideIntroSurface() {
    const hideSelectors = [
      '#intro',
      '#startScreen',
      '#landing',
      '#launcher',
      '.intro',
      '.start-screen',
      '.landing',
      '.launcher',
      '.welcome',
      '.qa-modal',
      '.test-modal',
      '.debug-modal'
    ];

    hideSelectors.forEach(function (sel) {
      $all(sel).forEach(function (el) {
        const t = textOf(el).toLowerCase();
        if (/summary|สรุป|result|ผลลัพธ์|cooldown/.test(t)) return;
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
      });
    });
  }

  function isStartCandidate(btn) {
    if (!btn) return false;
    if (btn.id === 'brushP32PasteBtn' || btn.id === 'brushP32SkipBtn') return false;

    const label = [
      textOf(btn),
      String(btn.id || ''),
      String(btn.className || ''),
      String(btn.getAttribute('href') || ''),
      String(btn.getAttribute('data-action') || '')
    ].join(' ').toLowerCase();

    const yes = /เริ่ม|เล่น|start|play|begin|brush/.test(label);
    const no = /hub|zone|back|กลับ|ออก|exit|summary|cooldown|warmup/.test(label);

    return yes && !no;
  }

  function findExistingStartButton() {
    const buttons = $all('button, a, [role="button"], input[type="button"], input[type="submit"], .btn');
    return buttons.find(isStartCandidate) || null;
  }

  function dispatchGameEvents() {
    const detail = {
      patch: PATCH,
      toothpasteDone,
      view,
      mobile: IS_MOBILE,
      source: 'p32'
    };

    [
      'hha:brush:toothpaste-done',
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

  function callKnownGameApi() {
    const candidates = [];

    if (window.HHA_BRUSH && typeof window.HHA_BRUSH.start === 'function') {
      candidates.push(['HHA_BRUSH.start', function () { window.HHA_BRUSH.start(); }]);
    }

    if (window.BrushGame && typeof window.BrushGame.start === 'function') {
      candidates.push(['BrushGame.start', function () { window.BrushGame.start(); }]);
    }

    if (window.Brush && typeof window.Brush.start === 'function') {
      candidates.push(['Brush.start', function () { window.Brush.start(); }]);
    }

    if (typeof window.startBrush === 'function') {
      candidates.push(['startBrush', function () { window.startBrush(); }]);
    }

    if (typeof window.startGame === 'function') {
      candidates.push(['startGame', function () { window.startGame(); }]);
    }

    if (!candidates.length) {
      setDebug('no known game API, events only');
      return false;
    }

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      try {
        item[1]();
        setDebug('called ' + item[0]);
        return true;
      } catch (err) {
        setDebug(item[0] + ' failed');
      }
    }

    return false;
  }

  function clickExistingStartOnce() {
    const btn = findExistingStartButton();
    if (!btn) return false;

    try {
      const href = String(btn.getAttribute('href') || '');

      const badHop =
        /brush-vr-kids\.html|brush-kids-vr\.html|brush-vr\.html/.test(href) &&
        !/vr-brush-kids\/brush\.html/.test(href);

      if (badHop) {
        setDebug('blocked bad launcher hop');
        return false;
      }

      btn.click();
      setDebug('clicked existing start');
      return true;
    } catch (err) {
      setDebug('existing start click failed');
      return false;
    }
  }

  function startGameplay(reason) {
    if (playStarted || bridgeBusy) return;

    bridgeBusy = true;
    playStarted = true;

    try {
      sessionStorage.setItem('HHA_BRUSH_TOOTHPASTE_DONE', toothpasteDone ? '1' : '0');
      sessionStorage.setItem('HHA_BRUSH_P32_STARTED_AT', String(Date.now()));
    } catch (_) {}

    document.body.classList.add('brush-p32-playing', 'is-playing', 'game-started', 'brush-playing');
    document.body.classList.remove('modal-open', 'show-intro', 'is-intro');

    hideOverlay();
    hideIntroSurface();
    showGameSurface();
    dispatchGameEvents();

    const clicked = clickExistingStartOnce();

    setTimeout(function () {
      if (!clicked) callKnownGameApi();
      hideIntroSurface();
      showGameSurface();
      bridgeBusy = false;
    }, 120);

    setTimeout(function () {
      hideIntroSurface();
      showGameSurface();
      setDebug('play bridge done: ' + reason);
    }, 500);
  }

  function interceptStartButtons() {
    document.addEventListener('click', function (ev) {
      const target = ev.target;
      const btn = target && target.closest
        ? target.closest('button, a, [role="button"], input[type="button"], input[type="submit"], .btn')
        : null;

      if (!btn) return;
      if (btn.id === 'brushP32PasteBtn' || btn.id === 'brushP32SkipBtn') return;

      if (!isStartCandidate(btn)) return;

      const href = String(btn.getAttribute('href') || '');
      const badHop =
        /brush-vr-kids\.html|brush-kids-vr\.html|brush-vr\.html/.test(href) &&
        !/vr-brush-kids\/brush\.html/.test(href);

      if (!toothpasteDone || badHop || WANT_PLAY) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        showOverlay();
        setDebug('start intercepted -> toothpaste');
        return false;
      }
    }, true);
  }

  function exposeApi() {
    window.HHA_BRUSH_P32 = {
      patch: PATCH,
      showToothpaste: showOverlay,
      startGameplay,
      status: function () {
        return {
          patch: PATCH,
          toothpasteDone,
          playStarted,
          bridgeBusy,
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
    exposeApi();
    interceptStartButtons();

    if (WANT_PLAY) {
      setTimeout(function () {
        showOverlay();
        setDebug('ready toothpaste gate');
      }, 180);
    }

    log('loaded', {
      wantPlay: WANT_PLAY,
      view,
      isMobile: IS_MOBILE
    });
  }

  ready(boot);
})();