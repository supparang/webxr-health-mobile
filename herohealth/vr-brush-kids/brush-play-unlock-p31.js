// === /herohealth/vr-brush-kids/brush-play-unlock-p31.js ===
// PATCH v20260604-P31
// Purpose:
// 1) Fix Brush Kids stuck start screen
// 2) Prevent old launcher/router from hijacking Start button
// 3) Remove QA/Test/Debug overlays that block gameplay
// 4) Force direct play when URL has run=play / direct=1 / autostart=1
// Canonical run file: /herohealth/vr-brush-kids/brush.html
// Canonical launcher: /herohealth/brush-kids-vr.html

(function () {
  'use strict';

  const PATCH = 'BRUSH_PLAY_UNLOCK_P31';

  const path = String(location.pathname || '');
  const title = String(document.title || '');

  const isBrush =
    /vr-brush-kids\/brush\.html/i.test(path) ||
    /brush/i.test(path + ' ' + title);

  if (!isBrush) return;

  if (window.__BRUSH_PLAY_UNLOCK_P31__) return;
  window.__BRUSH_PLAY_UNLOCK_P31__ = true;

  const qs = new URLSearchParams(location.search || '');

  const RUN_PLAY =
    qs.get('run') === 'play' ||
    qs.get('direct') === '1' ||
    qs.get('autostart') === '1' ||
    qs.get('forcePlay') === '1';

  const CANONICAL_LAUNCHER = '../brush-kids-vr.html';

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

  function safeText(el) {
    try {
      return String(el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
    } catch (_) {
      return '';
    }
  }

  function isVisible(el) {
    try {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 2 && r.height > 2;
    } catch (_) {
      return false;
    }
  }

  function injectStyle() {
    if (document.getElementById('brushPlayUnlockP31Style')) return;

    const style = document.createElement('style');
    style.id = 'brushPlayUnlockP31Style';
    style.textContent = `
      html, body {
        min-height: 100%;
        touch-action: manipulation;
      }

      body.brush-p31-force-play .qa-modal,
      body.brush-p31-force-play .test-modal,
      body.brush-p31-force-play .debug-modal,
      body.brush-p31-force-play [id*="qa" i],
      body.brush-p31-force-play [id*="test" i],
      body.brush-p31-force-play [id*="debug" i],
      body.brush-p31-force-play [class*="qa" i],
      body.brush-p31-force-play [class*="test" i],
      body.brush-p31-force-play [class*="debug" i] {
        pointer-events: none !important;
      }

      body.brush-p31-playing .brush-p31-emergency-start {
        display: none !important;
      }

      .brush-p31-emergency-start {
        position: fixed;
        left: 50%;
        bottom: max(18px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        z-index: 2147483000;
        border: 0;
        border-radius: 999px;
        padding: 14px 22px;
        font-size: 18px;
        font-weight: 900;
        background: #38bdf8;
        color: #07364a;
        box-shadow: 0 12px 28px rgba(15, 23, 42, .22);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      .brush-p31-emergency-start:active {
        transform: translateX(-50%) scale(.97);
      }

      body.brush-p31-playing [data-brush-intro],
      body.brush-p31-playing .brush-intro,
      body.brush-p31-playing .intro,
      body.brush-p31-playing .start-screen,
      body.brush-p31-playing .landing,
      body.brush-p31-playing .launcher,
      body.brush-p31-playing #intro,
      body.brush-p31-playing #startScreen,
      body.brush-p31-playing #landing,
      body.brush-p31-playing #launcher {
        display: none !important;
        pointer-events: none !important;
      }

      body.brush-p31-playing #game,
      body.brush-p31-playing #gameRoot,
      body.brush-p31-playing #brushGame,
      body.brush-p31-playing #stage,
      body.brush-p31-playing .game,
      body.brush-p31-playing .game-root,
      body.brush-p31-playing .stage,
      body.brush-p31-playing #hud,
      body.brush-p31-playing .hud,
      body.brush-p31-playing a-scene,
      body.brush-p31-playing canvas {
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  function markForcePlay() {
    document.documentElement.classList.add('brush-p31');
    document.body && document.body.classList.add('brush-p31');

    if (RUN_PLAY) {
      document.body && document.body.classList.add('brush-p31-force-play');
    }
  }

  function looksLikeBlocker(el) {
    if (!el || el === document.body || el === document.documentElement) return false;

    const id = String(el.id || '');
    const cls = String(el.className || '');
    const label = (id + ' ' + cls + ' ' + safeText(el)).toLowerCase();

    const maybeQa =
      /qa|test|debug|modal|dialog|diagnostic|ตรวจสอบ|ทดสอบ/.test(label);

    if (!maybeQa) return false;

    try {
      const cs = getComputedStyle(el);
      const zi = Number(cs.zIndex || 0);
      const pos = String(cs.position || '');
      const r = el.getBoundingClientRect();

      const coversScreen =
        r.width >= window.innerWidth * 0.45 &&
        r.height >= window.innerHeight * 0.25;

      return (
        isVisible(el) &&
        (pos === 'fixed' || pos === 'absolute') &&
        (zi >= 50 || coversScreen)
      );
    } catch (_) {
      return false;
    }
  }

  function disableBlockingOverlays() {
    const all = Array.from(document.querySelectorAll('body *'));
    all.forEach((el) => {
      if (!looksLikeBlocker(el)) return;

      el.setAttribute('data-brush-p31-disabled-blocker', '1');
      el.style.pointerEvents = 'none';
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
    });
  }

  function showGameSurfaces() {
    const selectors = [
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

    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.display = '';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      });
    });
  }

  function hideIntroSurfaces() {
    const selectors = [
      '[data-brush-intro]',
      '#intro',
      '#startScreen',
      '#landing',
      '#launcher',
      '.intro',
      '.start-screen',
      '.landing',
      '.launcher',
      '.welcome',
      '.home-screen',
      '.qa-modal',
      '.test-modal',
      '.debug-modal'
    ];

    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const txt = safeText(el).toLowerCase();

        const isGameSurface =
          el.matches('#game,#gameRoot,#brushGame,#stage,.game,.game-root,.stage,a-scene,canvas,#hud,.hud');

        if (isGameSurface) return;

        const isSummary =
          /summary|สรุป|result|ผลลัพธ์/.test(txt);

        if (isSummary) return;

        el.style.display = 'none';
        el.style.pointerEvents = 'none';
      });
    });
  }

  function callPossibleStartFunctions() {
    const candidates = [
      ['start', window.start],
      ['startGame', window.startGame],
      ['startBrush', window.startBrush],
      ['beginGame', window.beginGame],
      ['playGame', window.playGame],
      ['BRUSH.start', window.BRUSH && window.BRUSH.start],
      ['Brush.start', window.Brush && window.Brush.start],
      ['BrushGame.start', window.BrushGame && window.BrushGame.start],
      ['HHA_BRUSH.start', window.HHA_BRUSH && window.HHA_BRUSH.start],
      ['P30.start', window.P30 && window.P30.start],
      ['P30.play', window.P30 && window.P30.play]
    ];

    candidates.forEach(([name, fn]) => {
      if (typeof fn !== 'function') return;
      try {
        log('calling', name);
        fn.call(window);
      } catch (err) {
        log('start function failed:', name, err && err.message ? err.message : err);
      }
    });
  }

  function dispatchStartEvents() {
    [
      'hha:brush:start',
      'brush:start',
      'HHA_BRUSH_START',
      'hha:start',
      'game:start'
    ].forEach((name) => {
      try {
        window.dispatchEvent(new CustomEvent(name, {
          detail: {
            patch: PATCH,
            source: 'p31'
          }
        }));
        document.dispatchEvent(new CustomEvent(name, {
          detail: {
            patch: PATCH,
            source: 'p31'
          }
        }));
      } catch (_) {}
    });
  }

  function enterPlay(reason) {
    if (!document.body) return;

    log('enterPlay:', reason || 'manual');

    try {
      localStorage.setItem('HHA_BRUSH_P31_LAST_START', String(Date.now()));
    } catch (_) {}

    document.body.classList.add(
      'brush-p31-playing',
      'is-playing',
      'game-started',
      'brush-playing'
    );

    document.body.classList.remove(
      'is-intro',
      'show-intro',
      'show-start',
      'modal-open'
    );

    disableBlockingOverlays();
    hideIntroSurfaces();
    showGameSurfaces();
    dispatchStartEvents();
    callPossibleStartFunctions();

    setTimeout(function () {
      disableBlockingOverlays();
      showGameSurfaces();
    }, 300);

    setTimeout(function () {
      disableBlockingOverlays();
      showGameSurfaces();
    }, 1000);
  }

  function isStartButton(el) {
    if (!el) return false;

    const btn = el.closest('button, a, [role="button"], .btn, [data-start], [data-action], input[type="button"], input[type="submit"]');
    if (!btn) return false;

    const txt = safeText(btn).toLowerCase();
    const id = String(btn.id || '').toLowerCase();
    const cls = String(btn.className || '').toLowerCase();
    const href = String(btn.getAttribute('href') || '').toLowerCase();
    const action = String(btn.getAttribute('data-action') || '').toLowerCase();

    const label = [txt, id, cls, href, action].join(' ');

    return (
      /เริ่ม|เล่น|start|play|begin|brush|go/.test(label) &&
      !/summary|สรุป|cooldown|warmup|hub|zone|back|กลับ|ออก|exit/.test(label)
    );
  }

  function installStartInterceptor() {
    document.addEventListener('click', function (ev) {
      const target = ev.target;
      const btn = isStartButton(target);

      if (!btn) return;

      const href = String(btn.getAttribute && btn.getAttribute('href') || '');

      const badLauncherHop =
        /brush-vr|brush-vr-kids|brush-kids-vr/.test(href) &&
        !/vr-brush-kids\/brush\.html/.test(href);

      if (badLauncherHop || RUN_PLAY) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation && ev.stopImmediatePropagation();
        enterPlay('start-button-intercept');
        return false;
      }

      setTimeout(function () {
        enterPlay('start-button-after-click');
      }, 80);
    }, true);
  }

  function addEmergencyStartButton() {
    if (!RUN_PLAY) return;
    if (document.getElementById('brushP31EmergencyStart')) return;

    const btn = document.createElement('button');
    btn.id = 'brushP31EmergencyStart';
    btn.className = 'brush-p31-emergency-start';
    btn.type = 'button';
    btn.textContent = 'เริ่มแปรงฟัน';
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      enterPlay('emergency-button');
    });

    document.body.appendChild(btn);

    setTimeout(function () {
      if (document.body.classList.contains('brush-p31-playing')) {
        btn.style.display = 'none';
      }
    }, 1600);
  }

  function decorateCanonicalLinks() {
    document.querySelectorAll('a[href], button[data-href], [data-url]').forEach((el) => {
      const raw =
        el.getAttribute('href') ||
        el.getAttribute('data-href') ||
        el.getAttribute('data-url') ||
        '';

      if (!raw) return;

      if (/brush-vr-kids\.html|brush-vr\.html/.test(raw)) {
        const next = CANONICAL_LAUNCHER + location.search;
        if (el.hasAttribute('href')) el.setAttribute('href', next);
        if (el.hasAttribute('data-href')) el.setAttribute('data-href', next);
        if (el.hasAttribute('data-url')) el.setAttribute('data-url', next);
      }
    });
  }

  function cooldownUrl(force) {
    const hub =
      qs.get('hub') ||
      qs.get('zoneUrl') ||
      '../hygiene-zone.html';

    const p = new URLSearchParams();
    p.set('game', 'brush');
    p.set('variant', 'kids-vr');
    p.set('zone', 'hygiene');
    p.set('phase', 'cooldown');
    p.set('source', 'brush-summary');
    p.set('next', hub);

    if (force) {
      p.set('forceCooldownOnce', '1');
      p.set('forceGate', '1');
      p.set('skipDaily', '0');
    }

    return '../gate/warmup-gate.html?' + p.toString();
  }

  function exposeApi() {
    window.HHA_BRUSH_P31 = {
      patch: PATCH,
      enterPlay,
      disableBlockingOverlays,
      showGameSurfaces,
      hideIntroSurfaces,
      cooldownUrl,
      launcher: CANONICAL_LAUNCHER,
      status: function () {
        return {
          patch: PATCH,
          runPlay: RUN_PLAY,
          path: location.pathname,
          search: location.search,
          bodyClass: document.body ? document.body.className : '',
          emergencyButton: !!document.getElementById('brushP31EmergencyStart')
        };
      }
    };
  }

  function boot() {
    injectStyle();
    markForcePlay();
    exposeApi();
    installStartInterceptor();
    decorateCanonicalLinks();

    setTimeout(disableBlockingOverlays, 100);
    setTimeout(disableBlockingOverlays, 500);
    setTimeout(disableBlockingOverlays, 1200);

    addEmergencyStartButton();

    if (RUN_PLAY) {
      setTimeout(function () {
        enterPlay('url-run-play');
      }, 250);

      setTimeout(function () {
        enterPlay('url-run-play-second-pass');
      }, 900);
    }

    log('loaded', {
      runPlay: RUN_PLAY,
      path: location.pathname,
      search: location.search
    });
  }

  ready(boot);
})();